// net.js — WebRTC peer-to-peer networking via PeerJS.
// One player HOSTS (creates a room), others JOIN with a room code.
// Works on the same LAN or across the internet (PeerJS public broker handles signaling).
// Host is authoritative: it owns game state and broadcasts it; peers send intents to the host.
//
// Message envelope: { t: <type>, ...payload }
// Types host->peer:  'welcome', 'state', 'event', 'kick'
// Types peer->host:  'hello', 'intent'

import { Peer } from 'https://esm.sh/peerjs@1.5.4';

const ROOM_PREFIX = 'whoosit-v1-'; // namespacing so codes don't collide with other apps on the broker

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O for legibility
  let s = '';
  for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

export class Net {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.code = null;
    this.id = null; // my player id
    this.conns = new Map(); // peerId -> DataConnection (host side)
    this.hostConn = null; // connection to host (peer side)
    this.handlers = {}; // event name -> fn
  }

  on(name, fn) { this.handlers[name] = fn; }
  emit(name, ...args) { if (this.handlers[name]) this.handlers[name](...args); }

  // ---- HOST ----
  host() {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      this.code = makeCode();
      const peerId = ROOM_PREFIX + this.code;
      this.peer = new Peer(peerId, { debug: 1 });
      this.id = 'host';

      this.peer.on('open', () => resolve(this.code));
      this.peer.on('error', (err) => {
        // If the code is taken, retry with a new one.
        if (err.type === 'unavailable-id') {
          this.code = makeCode();
          this.peer.destroy();
          this.peer = new Peer(ROOM_PREFIX + this.code, { debug: 1 });
          this.peer.on('open', () => resolve(this.code));
          this.peer.on('connection', (c) => this._wireHostConn(c));
          this.peer.on('error', reject);
        } else {
          this.emit('neterror', err);
          reject(err);
        }
      });
      this.peer.on('connection', (c) => this._wireHostConn(c));
    });
  }

  _wireHostConn(conn) {
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
    });
    conn.on('data', (msg) => {
      if (msg.t === 'hello') {
        this.emit('peerjoin', conn.peer, msg.name);
      } else if (msg.t === 'intent') {
        this.emit('intent', conn.peer, msg.intent);
      }
    });
    conn.on('close', () => {
      this.conns.delete(conn.peer);
      this.emit('peerleave', conn.peer);
    });
    conn.on('error', () => {
      this.conns.delete(conn.peer);
      this.emit('peerleave', conn.peer);
    });
  }

  // host: send to one peer
  sendTo(peerId, msg) {
    const c = this.conns.get(peerId);
    if (c && c.open) c.send(msg);
  }
  // host: send to everyone
  broadcast(msg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  // ---- PEER ----
  join(code, name) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      this.code = code.toUpperCase();
      this.peer = new Peer({ debug: 1 });
      this.peer.on('open', (myId) => {
        this.id = myId;
        const conn = this.peer.connect(ROOM_PREFIX + this.code, { reliable: true });
        this.hostConn = conn;
        let settled = false;
        const failTimer = setTimeout(() => {
          if (!settled) { settled = true; reject(new Error('Could not reach that room. Check the code.')); }
        }, 12000);
        conn.on('open', () => {
          conn.send({ t: 'hello', name });
        });
        conn.on('data', (msg) => {
          if (msg.t === 'welcome' && !settled) {
            settled = true; clearTimeout(failTimer);
            this.id = msg.you; // host assigns canonical id
            resolve(msg);
          }
          this.emit('message', msg);
        });
        conn.on('close', () => this.emit('hostgone'));
        conn.on('error', (e) => {
          if (!settled) { settled = true; clearTimeout(failTimer); reject(e); }
        });
      });
      this.peer.on('error', (err) => {
        this.emit('neterror', err);
        reject(err);
      });
    });
  }

  // peer: send intent to host
  toHost(intent) {
    if (this.hostConn && this.hostConn.open) this.hostConn.send({ t: 'intent', intent });
  }

  destroy() {
    try { this.peer && this.peer.destroy(); } catch (e) {}
  }
}
