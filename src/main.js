// main.js — controller. Wires Net (WebRTC) + Game (engine) + UI together.
// Host runs the authoritative Game; peers are thin clients that send intents and render snapshots.

import { Net } from './net.js';
import { Game } from './engine.js';
import { Bot, difficultyList } from './bot.js';
import { DECKS } from './data/decks.js';
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
  // ---- solo (vs AI) ----
  solo: false,           // true when playing offline against bots
  bots: {},              // botId -> Bot brain instance
  soloCount: 1,          // number of AI opponents
  soloDiff: 'sleuth',    // chosen difficulty
  botBusy: false,        // guard so we drive one bot action at a time
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
$('#btn-solo').onclick = () => openSolo();
$('#btn-how').onclick = () => ($('#overlay-how').hidden = false);
$('#btn-how-close').onclick = () => ($('#overlay-how').hidden = true);
$('#btn-rules').onclick = () => ($('#overlay-how').hidden = false);
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => UI.screens.show('menu')));

// ============================================================
// SOLO MODE (PLAY VS AI) — offline, no network. Host game + bot brains.
// ============================================================
const BOT_NAMES = ['Bizzle', 'Marlow', 'Quincy', 'Sleuthbot'];

function openSolo() {
  UI.renderDeckPicker(state.deckId, (id) => { state.deckId = id; UI.tintForDeck(id); }, '#solo-deck-picker');
  UI.tintForDeck(state.deckId);
  // difficulty picker
  const dp = $('#solo-diff'); dp.innerHTML = '';
  difficultyList().forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'diff-opt' + (d.id === state.soloDiff ? ' sel' : '');
    b.innerHTML = `<div class="dn">${d.name}</div><div class="db">${d.blurb}</div>`;
    b.onclick = () => { state.soloDiff = d.id; document.querySelectorAll('#solo-diff .diff-opt').forEach((x) => x.classList.toggle('sel', x === b)); };
    dp.appendChild(b);
  });
  // opponent count segmented control
  document.querySelectorAll('#solo-count .seg-opt').forEach((b) => {
    b.onclick = () => {
      state.soloCount = parseInt(b.dataset.count, 10);
      document.querySelectorAll('#solo-count .seg-opt').forEach((x) => x.classList.toggle('sel', x === b));
    };
  });
  UI.screens.show('solo');
}

$('#btn-solo-start').onclick = () => {
  state.myName = ($('#solo-name').value || 'You').slice(0, 14);
  state.twists = {
    mutation: $('#sw-mutation').checked,
    hunch: $('#sw-hunch').checked,
    sabotage: $('#sw-sabotage').checked,
    suddenGuess: $('#sw-sudden').checked,
  };
  state.solo = true;
  state.isHost = true;   // human is the authoritative "host" locally
  state.net = null;      // no network in solo
  state.bots = {};

  // build lobby: human first (seat 0), then N bots
  state.lobby = [{ id: 'host', name: state.myName }];
  for (let i = 0; i < state.soloCount; i++) {
    const id = 'bot' + (i + 1);
    const name = BOT_NAMES[i] || ('Bot ' + (i + 1));
    state.lobby.push({ id, name, bot: true });
    state.bots[id] = new Bot({ id, deckId: state.deckId, difficulty: state.soloDiff });
  }
  boardBuilt = false;
  state.game = new Game({ deckId: state.deckId, players: state.lobby, twists: state.twists });
  pushState();
  UI.toast('The hunt begins!');
};

// Drive bots: after every state push, if it's a bot's turn, let it act.
function maybeDriveBots(snap, events) {
  if (!state.solo || !state.game || snap.phase === 'over') return;
  // react to MY-as-victim events handled in applySnapshot; here we only act for bots
  const turnId = snap.turnPlayer;
  const bot = state.bots[turnId];
  if (!bot || state.botBusy) return;
  // if the bot just asked (pendingAnswer belongs to it), resolve flip + end turn instead
  const pending = snap.pendingAnswer && snap.pendingAnswer.askerId === turnId;
  if (pending) return; // handled by the 'asked' event path below
  state.botBusy = true;
  setTimeout(() => botTakeAction(turnId), bot.thinkDelay());
}

function botTakeAction(botId) {
  state.botBusy = false;
  if (!state.solo || !state.game) return;
  const bot = state.bots[botId];
  const snap = state.game.snapshotFor(botId); // bot sees only its own info
  if (!bot || snap.phase === 'over' || snap.turnPlayer !== botId) return;
  const intent = bot.decideTurn(snap);
  if (!intent) { hostHandleIntent(botId, { kind: 'endTurn' }); return; }
  if (intent.kind === 'ask') UI.toast(`${bot.deck.name ? '' : ''}${nameOf(botId)} is asking…`);
  hostHandleIntent(botId, intent);
}

function nameOf(id) { const p = state.lobby.find((x) => x.id === id); return p ? p.name : id; }

// When a bot's question gets answered, let the bot learn, flip, and end its turn.
function botResolveAnswer(botId, ev) {
  const bot = state.bots[botId];
  if (!bot) return;
  const snap = state.game.snapshotFor(botId);
  // learn from the answer (yes/no only; hunch is fuzzy and not used to prune)
  if (!ev.isHunch) bot.learn(ev.oppId, ev.attr, ev.value, ev.answer, snap.castState);
  const tiles = bot.flipTiles(snap, ev);
  setTimeout(() => {
    if (tiles.length) hostHandleIntent(botId, { kind: 'flip', tiles });
    // brief pause, then end turn (unless the game ended)
    setTimeout(() => {
      if (state.game && state.game.phase !== 'over' && state.game.current().id === botId) {
        hostHandleIntent(botId, { kind: 'endTurn' });
      }
    }, 500);
  }, bot.thinkDelay());
}

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
  // each peer (networked only)
  if (state.net) {
    for (const p of state.lobby) {
      if (p.id === 'host' || p.bot) continue;
      const snap = state.game.snapshotFor(p.id);
      state.net.sendTo(p.id, { t: 'state', snap, events });
    }
  }

  // SOLO: react to bot-relevant events, then drive whoever's turn it is.
  if (state.solo) {
    for (const ev of events) {
      // a bot asked a question -> let it learn, flip, and end its turn
      if (ev.type === 'asked' && state.bots[ev.askerId]) botResolveAnswer(ev.askerId, ev);
    }
    maybeDriveBots(state.snap, events);
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
    // SOLO: surface what a bot just asked so the human can follow along
    if (ev.type === 'asked' && state.solo && ev.askerId !== viewerId && state.bots[ev.askerId]) {
      const deck = DECKS[snap.deckId];
      const at = deck.attributes.find((a) => a.id === ev.attr);
      const qtext = at ? at.q(ev.value) : 'a question';
      if (ev.isHunch) UI.toast(`🔮 ${nameOf(ev.askerId)} played a hunch → ${ev.hot}`);
      else UI.toast(`${nameOf(ev.askerId)} asked: “${qtext}” → ${ev.answer ? 'YES' : 'NO'}`);
    }
    if (ev.type === 'turn' && ev.mutation) {
      UI.flashMutation(ev.mutation.cid);
      UI.toast('☣ Mutation! A trait shifted.');
    }
    if (ev.type === 'sabotage' && ev.victimId === viewerId) {
      UI.toast('💥 You were sabotaged! Two tiles forced down.');
    } else if (ev.type === 'sabotage' && state.solo) {
      UI.toast(`💥 ${nameOf(ev.byId)} sabotaged ${nameOf(ev.victimId)}!`);
    }
    if (ev.type === 'guess') {
      if (ev.correct && ev.oppId === viewerId) UI.toast('You were unmasked!');
      else if (ev.correct && ev.playerId === viewerId) UI.toast('🎯 Correct! Unmasked.');
      else if (!ev.correct && ev.playerId === viewerId) UI.toast('❌ Wrong — 4 tiles flipped back up.');
      else if (state.solo && ev.correct) UI.toast(`🎯 ${nameOf(ev.playerId)} unmasked ${nameOf(ev.oppId)}!`);
      else if (state.solo && !ev.correct && state.bots[ev.playerId]) UI.toast(`❌ ${nameOf(ev.playerId)} guessed wrong!`);
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
    // SOLO: fresh bot brains so they forget last round's deductions
    if (state.solo) {
      state.botBusy = false;
      for (const id of Object.keys(state.bots)) {
        state.bots[id] = new Bot({ id, deckId: state.deckId, difficulty: state.soloDiff });
      }
    }
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
