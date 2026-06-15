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

// PeerJS / WebRTC config. Multiple public STUN servers improve the odds of a
// successful peer-to-peer connection across different networks (NAT traversal).
const PEER_OPTS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  },
};

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
      this.peer = new Peer(peerId, PEER_OPTS);
      this.id = 'host';

      this.peer.on('open', () => resolve(this.code));
      this.peer.on('error', (err) => {
        // If the code is taken, retry with a new one.
        if (err.type === 'unavailable-id') {
          this.code = makeCode();
          this.peer.destroy();
          this.peer = new Peer(ROOM_PREFIX + this.code, PEER_OPTS);
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
    // Register the connection immediately so it's findable even if a data
    // message (e.g. 'hello') arrives before the 'open' event fires. Without
    // this, sendTo() can't find the conn yet and the 'welcome' is dropped,
    // causing the joiner to time out ("Could not reach that room").
    this.conns.set(conn.peer, conn);
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

  // host: send to one peer. If the data channel isn't reported open yet,
  // wait for its 'open' event and flush then (instead of silently dropping).
  sendTo(peerId, msg) {
    const c = this.conns.get(peerId);
    if (!c) return;
    if (c.open) { try { c.send(msg); } catch (e) {} }
    else { c.once ? c.once('open', () => { try { c.send(msg); } catch (e) {} }) : c.on('open', () => { try { c.send(msg); } catch (e) {} }); }
  }
  // host: send to everyone
  broadcast(msg) {
    for (const c of this.conns.values()) {
      if (c.open) { try { c.send(msg); } catch (e) {} }
    }
  }

  // ---- PEER ----
  join(code, name) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      // Normalize: strip whitespace/dashes the user may have typed, uppercase.
      this.code = String(code).replace(/[^a-zA-Z]/g, '').toUpperCase();
      this.peer = new Peer(PEER_OPTS);
      let settled = false;
      let helloTimer = null;
      let failTimer = null;

      this.peer.on('open', (myId) => {
        this.id = myId;
        const conn = this.peer.connect(ROOM_PREFIX + this.code, { reliable: true });
        this.hostConn = conn;

        const sendHello = () => { try { conn.send({ t: 'hello', name }); } catch (e) {} };

        // Give the connection longer to complete (cross-network ICE can be slow).
        failTimer = setTimeout(() => {
          if (!settled) { settled = true; clearInterval(helloTimer); reject(new Error('Could not reach that room. Check the code.')); }
        }, 20000);

        conn.on('open', () => {
          sendHello();
          // The host may not have wired its side in time for the first hello
          // (open-vs-data race). Re-send hello a few times until welcomed.
          let tries = 0;
          helloTimer = setInterval(() => {
            if (settled || tries++ > 8) { clearInterval(helloTimer); return; }
            sendHello();
          }, 1200);
        });
        conn.on('data', (msg) => {
          if (msg.t === 'welcome' && !settled) {
            settled = true; clearTimeout(failTimer); clearInterval(helloTimer);
            this.id = msg.you; // host assigns canonical id
            resolve(msg);
          }
          this.emit('message', msg);
        });
        conn.on('close', () => this.emit('hostgone'));
        conn.on('error', (e) => {
          if (!settled) { settled = true; clearTimeout(failTimer); clearInterval(helloTimer); reject(e); }
        });
      });
      this.peer.on('error', (err) => {
        // 'peer-unavailable' means the room code doesn't exist on the broker.
        if (!settled) {
          settled = true; clearTimeout(failTimer); clearInterval(helloTimer);
          if (err && err.type === 'peer-unavailable') {
            reject(new Error('Could not reach that room. Check the code.'));
          } else {
            this.emit('neterror', err);
            reject(err);
          }
        }
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
