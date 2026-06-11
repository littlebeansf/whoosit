// main.js — controller. Wires Net (WebRTC) + Game (engine) + UI together.
// Host runs the authoritative Game; peers are thin clients that send intents and render snapshots.

import { Net } from './net.js';
import { Game } from './engine.js';
import * as UI from './ui.js';

const $ = (s) => document.querySelector(s);

const state = {
  net: null,
  isHost: false,
  game: null,            // host only
  lobby: [],             // host: [{id,name}]  — id 'host' for host, peerId for others
  deckId: 'cryptid',
  twists: { mutation: true, hunch: true, sabotage: true, suddenGuess: true },
  snap: null,            // latest snapshot (both host & peer render from this)
  myName: 'Detective',
  candidateMode: false,
};

// ---------- THEME TOGGLE ----------
(function () {
  const r = document.documentElement;
  let d = matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark';
  r.setAttribute('data-theme', d);
  const paint = (btn) => {
    btn.innerHTML = d === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
  };
  document.querySelectorAll('[data-theme-toggle]').forEach(paint);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]'); if (!t) return;
    d = d === 'dark' ? 'light' : 'dark';
    r.setAttribute('data-theme', d);
    document.querySelectorAll('[data-theme-toggle]').forEach(paint);
  });
})();

// ============================================================
// MENU NAVIGATION
// ============================================================
UI.renderHow();
$('#btn-host').onclick = () => { UI.renderDeckPicker(state.deckId, (id) => { state.deckId = id; UI.tintForDeck(id); }); UI.tintForDeck(state.deckId); UI.screens.show('host'); };
$('#btn-join').onclick = () => UI.screens.show('join');
$('#btn-how').onclick = () => ($('#overlay-how').hidden = false);
$('#btn-how-close').onclick = () => ($('#overlay-how').hidden = true);
$('#btn-rules').onclick = () => ($('#overlay-how').hidden = false);
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => UI.screens.show('menu')));

// ============================================================
// HOSTING
// ============================================================
$('#btn-create').onclick = async () => {
  state.myName = ($('#host-name').value || 'Host').slice(0, 14);
  state.twists = {
    mutation: $('#tw-mutation').checked,
    hunch: $('#tw-hunch').checked,
    sabotage: $('#tw-sabotage').checked,
    suddenGuess: $('#tw-sudden').checked,
  };
  state.isHost = true;
  state.net = new Net();
  wireHostNet();
  try {
    const code = await state.net.host();
    state.lobby = [{ id: 'host', name: state.myName }];
    UI.tintForDeck(state.deckId);
    UI.renderLobby(code, state.lobby, state.deckId, true);
    UI.screens.show('lobby');
  } catch (e) {
    UI.toast('Could not open a room. Try again.');
  }
};

function wireHostNet() {
  const net = state.net;
  net.on('peerjoin', (peerId, name) => {
    if (state.lobby.length >= 4) { net.sendTo(peerId, { t: 'kick', reason: 'Room full' }); return; }
    if (!state.lobby.find((p) => p.id === peerId)) {
      state.lobby.push({ id: peerId, name: (name || 'Player').slice(0, 14) });
    }
    // welcome with current lobby + deck
    net.sendTo(peerId, { t: 'welcome', you: peerId, code: net.code, deckId: state.deckId, twists: state.twists, lobby: state.lobby, phase: 'lobby' });
    broadcastLobby();
    UI.renderLobby(net.code, state.lobby, state.deckId, true);
  });
  net.on('peerleave', (peerId) => {
    state.lobby = state.lobby.filter((p) => p.id !== peerId);
    if (state.game) {
      // mark player gone -> treat as eliminated
      const pl = state.game.byId(peerId);
      if (pl && pl.alive) { pl.alive = false; pl.eliminatedBy = 'left'; state.game._logLine(`${pl.name} left the hunt.`); if (state.game.alivePlayers().length <= 1) state.game._end(); }
      pushState();
    } else {
      broadcastLobby();
      UI.renderLobby(net.code, state.lobby, state.deckId, true);
    }
  });
  net.on('intent', (peerId, intent) => hostHandleIntent(peerId, intent));
  net.on('neterror', () => UI.toast('Network hiccup — check your connection.'));
}

function broadcastLobby() {
  state.net.broadcast({ t: 'event', kind: 'lobby', lobby: state.lobby, deckId: state.deckId, twists: state.twists });
}

$('#btn-start').onclick = () => {
  if (!state.isHost || state.lobby.length < 2) return;
  state.game = new Game({ deckId: state.deckId, players: state.lobby, twists: state.twists });
  pushState();
  UI.toast('The hunt begins!');
};

// host applies an intent, then pushes new state + animation events
function hostHandleIntent(playerId, intent) {
  if (intent && intent.kind === 'rematchRequest') {
    state.game = new Game({ deckId: state.deckId, players: state.lobby, twists: state.twists });
    boardBuilt = false;
    pushState();
    return;
  }
  if (!state.game) return;
  const res = state.game.handleIntent(playerId, intent);
  pushState(res.events);
}

// send tailored snapshot to each viewer; render locally for host
function pushState(events = []) {
  if (!state.game) return;
  // host view
  state.snap = state.game.snapshotFor('host');
  applySnapshot(state.snap, events, 'host');
  // each peer
  for (const p of state.lobby) {
    if (p.id === 'host') continue;
    const snap = state.game.snapshotFor(p.id);
    state.net.sendTo(p.id, { t: 'state', snap, events });
  }
}

// ============================================================
// JOINING
// ============================================================
$('#btn-do-join').onclick = async () => {
  const name = ($('#join-name').value || 'Player').slice(0, 14);
  const code = ($('#join-code').value || '').trim().toUpperCase();
  $('#join-err').hidden = true;
  if (code.length !== 4) { showJoinErr('Enter the 4-letter room code.'); return; }
  state.myName = name; state.isHost = false;
  state.net = new Net();
  wirePeerNet();
  try {
    const welcome = await state.net.join(code, name);
    state.deckId = welcome.deckId; state.twists = welcome.twists;
    state.lobby = welcome.lobby || [];
    UI.tintForDeck(state.deckId);
    UI.renderLobby(code, state.lobby, state.deckId, false);
    UI.screens.show('lobby');
  } catch (e) {
    showJoinErr(e.message || 'Could not join. Check the code.');
  }
};
function showJoinErr(m) { const el = $('#join-err'); el.textContent = m; el.hidden = false; }

function wirePeerNet() {
  const net = state.net;
  net.on('message', (msg) => {
    if (msg.t === 'event' && msg.kind === 'lobby') {
      state.lobby = msg.lobby; state.deckId = msg.deckId; state.twists = msg.twists;
      UI.tintForDeck(state.deckId);
      UI.renderLobby(net.code, state.lobby, state.deckId, false);
    } else if (msg.t === 'state') {
      state.snap = msg.snap;
      applySnapshot(msg.snap, msg.events || [], net.id);
    } else if (msg.t === 'kick') {
      UI.toast(msg.reason || 'Removed from room.');
      setTimeout(() => location.reload(), 1500);
    }
  });
  net.on('hostgone', () => { UI.toast('Host left — game ended.'); setTimeout(() => UI.screens.show('menu'), 1500); });
  net.on('neterror', () => UI.toast('Network hiccup — check your connection.'));
}

// ============================================================
// SNAPSHOT -> UI  (shared by host & peers)
// ============================================================
let boardBuilt = false;
let lastGameId = null;

function applySnapshot(snap, events, viewerId) {
  if (!snap) return;
  snap.youAre = viewerId; // ensure local viewer id
  // entering game screen for the first time, or a new round (rematch) started
  if (!boardBuilt || lastGameId !== snap.gameId) {
    UI.screens.show('game');
    UI.tintForDeck(snap.deckId);
    // close any lingering overlays from a previous round
    ['overlay-end','overlay-answer','overlay-guess','overlay-ask','overlay-peek'].forEach((id)=>{const el=document.getElementById(id);if(el)el.hidden=true;});
    UI.buildBoard(snap, { onTileClick: onTileClick });
    boardBuilt = true; lastGameId = snap.gameId;
    UI.markCandidates([], false); state.candidateMode = false;
    // auto-peek identity at the very start
    setTimeout(() => UI.showPeek(snap), 700);
  }
  UI.syncBoard(snap);
  UI.renderTop(snap);
  UI.renderRivals(snap);
  UI.renderActionBar(snap, barHandlers);

  // process animation events
  for (const ev of events) {
    if (ev.type === 'asked' && ev.askerId === viewerId) {
      UI.showAnswer(snap, ev, (e) => beginFlipPhase(snap, e));
    }
    if (ev.type === 'turn' && ev.mutation) {
      UI.flashMutation(ev.mutation.cid);
      UI.toast('☣ Mutation! A trait shifted.');
    }
    if (ev.type === 'sabotage' && ev.victimId === viewerId) {
      UI.toast('💥 You were sabotaged! Two tiles forced down.');
    }
    if (ev.type === 'guess') {
      if (ev.correct && ev.oppId === viewerId) UI.toast('You were unmasked!');
      else if (ev.correct && ev.playerId === viewerId) UI.toast('🎯 Correct! Unmasked.');
      else if (!ev.correct && ev.playerId === viewerId) UI.toast('❌ Wrong — 4 tiles flipped back up.');
    }
  }

  if (snap.phase === 'over') { setTimeout(() => UI.showEnd(snap), 500); }
}

// ============================================================
// LOCAL INTENT DISPATCH (host calls engine directly, peer sends to host)
// ============================================================
function dispatch(intent) {
  if (state.isHost) hostHandleIntent('host', intent);
  else state.net.toHost(intent);
}

// flip phase: after an answer, let the player click tiles to flip; we auto-suggest non-matches
function beginFlipPhase(snap, ev) {
  // compute which of MY still-up tiles do NOT match the answer -> candidates to flip down
  state.candidateMode = true;
  UI.toast('Tap the suspects to flip down — or use Auto‑flip.');
  // show an Auto-flip helper in the action bar
  showAutoFlip(snap, ev);
}

function showAutoFlip(snap, ev) {
  const actions = $('#ab-actions');
  const me = snap.players.find((p) => p.id === snap.youAre);
  // determine non-matching characters using the public castState
  const nonMatch = [];
  const matchVal = ev.value;
  for (const b of me.board) {
    if (!b.up) continue;
    const cs = snap.castState[b.id];
    let matches;
    if (typeof matchVal === 'boolean') matches = (cs[ev.attr] === true) === matchVal;
    else matches = cs[ev.attr] === matchVal;
    // for hunch answers we don't auto-eliminate (fuzzy); only for yes/no
    if (!ev.isHunch) {
      const keep = ev.answer ? matches : !matches;
      if (!keep) nonMatch.push(b.id);
    }
  }
  UI.markCandidates(nonMatch, true);
  if (!ev.isHunch && nonMatch.length) {
    const b = document.createElement('button');
    b.className = 'btn btn-primary';
    b.textContent = `Auto‑flip ${nonMatch.length}`;
    b.onclick = () => { dispatch({ kind: 'flip', tiles: nonMatch }); UI.markCandidates([], false); state.candidateMode = false; };
    $('#ab-actions').prepend(b);
  }
}

function onTileClick(cid, el) {
  if (!state.snap) return;
  // during flip phase: toggle this tile down (manual elimination)
  if (state.candidateMode) {
    dispatch({ kind: 'flip', tiles: [cid] });
    return;
  }
  // otherwise tapping a tile = quick info (no-op for now / could be accuse shortcut)
}

const barHandlers = {
  ask: () => UI.showAsk(state.snap, { onPick: (q) => { UI.hideAsk(); dispatch({ kind: 'ask', attr: q.attr, value: q.value, hunch: q.hunch, targetPlayer: q.targetPlayer }); } }),
  endTurn: () => { UI.markCandidates([], false); state.candidateMode = false; dispatch({ kind: 'endTurn' }); },
  guess: () => UI.showGuess(state.snap, { onConfirm: (g) => { UI.hideGuess(); dispatch({ kind: 'guess', targetPlayer: g.targetPlayer, charId: g.charId }); } }),
  sabotage: () => {
    const opps = state.snap.players.filter((p) => p.id !== state.snap.youAre && p.alive);
    if (!opps.length) return;
    // simple: sabotage the first rival (could add a picker)
    dispatch({ kind: 'sabotage', targetPlayer: opps[0].id });
  },
};

// ---------- overlay buttons ----------
$('#btn-peek').onclick = () => UI.showPeek(state.snap);
$('#btn-peek-close').onclick = () => ($('#overlay-peek').hidden = true);
$('#btn-ask-cancel').onclick = () => UI.hideAsk();
$('#btn-guess-cancel').onclick = () => UI.hideGuess();
$('#btn-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#lobby-code').textContent); UI.toast('Code copied'); } catch (e) { UI.toast('Copy failed'); } };
$('#btn-quit').onclick = () => location.reload();
$('#btn-rematch').onclick = () => {
  $('#overlay-end').hidden = true;
  if (state.isHost) {
    state.game = new Game({ deckId: state.deckId, players: state.lobby, twists: state.twists });
    boardBuilt = false;
    pushState();
  } else {
    state.net.toHost({ kind: 'rematchRequest' });
    UI.toast('Asked host for a rematch…');
  }
};

// join-code input uppercasing
$('#join-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });

UI.tintForDeck(state.deckId);
