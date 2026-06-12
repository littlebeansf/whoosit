// ui.js — all DOM rendering + animation orchestration. No networking, no game rules.
import { DECKS } from './data/decks.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const screens = {
  show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === `screen-${id}`));
  },
};

const SEAT_COLORS = ['#b6ff3b', '#ff5cc8', '#54f0e8', '#ffc83d'];

export function artUrl(deckId, charId) {
  // only cryptid has bespoke art; others fall back to a tinted silhouette generated on the fly
  if (deckId === 'cryptid') return `./assets/cryptid/${charId}.png`;
  return null;
}

// procedurally render a placeholder portrait for decks without bespoke art (space, haunted)
export function placeholderDataUrl(deck, char) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const seed = [...char.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const hueBase = deck.id === 'space' ? 310 : 175;
  const hue = (hueBase + seed * 23) % 360;
  // body blob
  x.fillStyle = `hsl(${hue} 70% 60%)`;
  x.beginPath();
  x.ellipse(128, 150, 86, 92, 0, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#10121b'; x.lineWidth = 9; x.stroke();
  // eyes (count varies a touch by seed)
  const eyes = 1 + (seed % 3);
  for (let i = 0; i < eyes; i++) {
    const ex = 128 + (i - (eyes - 1) / 2) * 46;
    x.fillStyle = '#fff'; x.beginPath(); x.arc(ex, 128, 22, 0, 7); x.fill();
    x.strokeStyle = '#10121b'; x.lineWidth = 5; x.stroke();
    x.fillStyle = '#10121b'; x.beginPath(); x.arc(ex + (seed % 5) - 2, 130, 9, 0, 7); x.fill();
  }
  // accent tuft
  x.fillStyle = `hsl(${hue} 90% 75%)`;
  x.beginPath(); x.arc(128, 64, 16, 0, 7); x.fill();
  return c.toDataURL();
}

export function tintForDeck(deckId) {
  const d = DECKS[deckId];
  document.documentElement.style.setProperty('--accent', d.accent);
  document.documentElement.style.setProperty('--accent-ink', d.accentInk);
}

// ---------- BOARD ----------
let boardEls = {}; // charId -> tile element

export function buildBoard(snap, { onTileClick }) {
  const deck = DECKS[snap.deckId];
  const me = snap.players.find((p) => p.id === snap.youAre);
  const board = $('#board');
  board.innerHTML = '';
  boardEls = {};
  deck.cast.forEach((char, i) => {
    const myTile = me.board.find((b) => b.id === char.id);
    const el = document.createElement('button');
    el.className = 'tile drop';
    el.style.animationDelay = `${i * 28}ms`;
    el.dataset.cid = char.id;
    el.setAttribute('aria-label', char.name);
    const img = artUrl(snap.deckId, char.id) || placeholderDataUrl(deck, char);
    el.innerHTML = `
      <div class="face"><img src="${img}" alt="${char.name}"/><span class="name">${char.name}</span></div>
      <div class="back"></div>
      <div class="puff"></div>`;
    if (!myTile.up) el.classList.add('down');
    el.addEventListener('click', () => onTileClick(char.id, el));
    board.appendChild(el);
    boardEls[char.id] = el;
    el.addEventListener('animationend', () => el.classList.remove('drop'), { once: true });
  });
}

// reconcile tile up/down with snapshot, animating changes
export function syncBoard(snap) {
  const me = snap.players.find((p) => p.id === snap.youAre);
  if (!me) return;
  me.board.forEach((b) => {
    const el = boardEls[b.id];
    if (!el) return;
    const wasDown = el.classList.contains('down');
    if (b.up && wasDown) {
      el.classList.remove('down');
    } else if (!b.up && !wasDown) {
      el.classList.add('down', 'puffing');
      setTimeout(() => el.classList.remove('puffing'), 520);
    }
  });
}

export function markCandidates(ids, on) {
  Object.entries(boardEls).forEach(([cid, el]) => {
    el.classList.toggle('cand', on && ids.includes(cid));
  });
}

export function flashMutation(cid) {
  const el = boardEls[cid];
  if (el) { el.classList.add('mutate'); setTimeout(() => el.classList.remove('mutate'), 820); }
}

// ---------- TOP / TURN ----------
export function renderTop(snap) {
  const me = snap.players.find((p) => p.id === snap.youAre);
  const turnP = snap.players.find((p) => p.id === snap.turnPlayer);
  const banner = $('#turn-banner');
  const mine = snap.turnPlayer === snap.youAre;
  banner.classList.toggle('mine', mine);
  banner.textContent = snap.phase === 'over'
    ? 'Case closed'
    : mine ? 'Your move, detective' : `${turnP ? turnP.name : '—'} is thinking…`;
  $('#hunch-n').textContent = me ? me.hunch : 0;
  $('#chip-hunch').style.display = snap.twists.hunch ? '' : 'none';
}

// ---------- RIVALS ----------
export function renderRivals(snap) {
  const wrap = $('#rivals');
  const total = DECKS[snap.deckId].cast.length;
  wrap.innerHTML = '';
  snap.players.filter((p) => p.id !== snap.youAre).forEach((p) => {
    const down = p.board.filter((b) => !b.up).length;
    const remaining = total - down;
    const el = document.createElement('div');
    el.className = 'rival' + (p.id === snap.turnPlayer ? ' turn' : '') + (p.alive ? '' : ' dead');
    el.innerHTML = `
      <div class="rn"><span class="dot" style="background:${SEAT_COLORS[p.seat % 4]}"></span>${p.name}</div>
      <div class="meta">${remaining}/${total} suspects · 🔮${p.hunch}${p.sabotageUsed ? '' : ' · 💥'}</div>
      <div class="standing"><i style="width:${(remaining / total) * 100}%"></i></div>`;
    wrap.appendChild(el);
  });
}

// ---------- ACTION BAR ----------
export function renderActionBar(snap, handlers) {
  const me = snap.players.find((p) => p.id === snap.youAre);
  const status = $('#ab-status');
  const actions = $('#ab-actions');
  actions.innerHTML = '';
  if (snap.phase === 'over') { status.textContent = 'Game over.'; return; }

  const mine = snap.turnPlayer === snap.youAre;
  const pending = snap.pendingAnswer && snap.pendingAnswer.askerId === snap.youAre;
  const down = me.board.filter((b) => !b.up).length;
  const remaining = DECKS[snap.deckId].cast.length - down;

  status.innerHTML = mine
    ? `Your turn — <b>${remaining}</b> suspects left${me.streak > 1 ? ` · 🔥 streak ${me.streak}` : ''}`
    : `Narrow it down — <b>${remaining}</b> suspects left`;

  const add = (label, cls, fn, disabled) => {
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.textContent = label;
    b.disabled = !!disabled;
    b.addEventListener('click', fn);
    actions.appendChild(b);
    return b;
  };

  if (mine && !pending) {
    add('Ask a question', 'btn-primary', handlers.ask);
    if (snap.twists.sabotage && snap.players.length >= 3 && !me.sabotageUsed) add('💥 Sabotage', '', handlers.sabotage);
    add('End turn', '', handlers.endTurn);
  } else if (pending) {
    status.innerHTML = `Answer received — <b>flip the board</b> to eliminate suspects.`;
    add('End turn', '', handlers.endTurn);
  }
  // sudden guess available to everyone, anytime
  if (snap.twists.suddenGuess || mine) add('🎯 Accuse', mine && !pending ? '' : 'btn-primary', handlers.guess);
}

// ---------- PEEK ----------
export function showPeek(snap) {
  const me = snap.players.find((p) => p.id === snap.youAre);
  const deck = DECKS[snap.deckId];
  const char = deck.cast.find((c) => c.id === me.myTarget);
  if (!char) return;
  $('#peek-img').src = artUrl(snap.deckId, char.id) || placeholderDataUrl(deck, char);
  $('#peek-name').textContent = char.name;
  const ov = $('#overlay-peek'); const card = $('#peek-card');
  ov.hidden = false; card.classList.remove('lift'); void card.offsetWidth; card.classList.add('lift');
}

// ---------- ASK ----------
export function showAsk(snap, { onPick }) {
  const deck = DECKS[snap.deckId];
  const opps = snap.players.filter((p) => p.id !== snap.youAre && p.alive);
  $('#ask-sub').textContent = opps.length === 1
    ? `Asking ${opps[0].name}.`
    : `Asking the player to your left (${opps[0] ? opps[0].name : '—'}).`;
  const wrap = $('#ask-attrs');
  wrap.innerHTML = '';
  deck.attributes.forEach((attr) => {
    const g = document.createElement('div');
    g.className = 'ask-group';
    let opts = '';
    if (attr.type === 'bool') {
      opts = `<button class="ask-opt" data-attr="${attr.id}" data-val="true">${attr.q(true).replace(/^Does |^Is /, '').replace(/\?$/, '')}?</button>`;
      // simpler: just the question
      opts = `<button class="ask-opt" data-attr="${attr.id}" data-val="true">${attr.q(true)}</button>`;
    } else {
      opts = attr.values.map((v) => `<button class="ask-opt" data-attr="${attr.id}" data-val="${v}">${v}</button>`).join('');
    }
    g.innerHTML = `<div class="lbl">${attr.label}</div><div class="ask-opts">${opts}</div>`;
    wrap.appendChild(g);
  });
  $('#hunch-toggle-wrap').style.display = snap.twists.hunch ? '' : 'none';
  $('#ask-hunch').checked = false;
  const me = snap.players.find((p) => p.id === snap.youAre);
  $('#ask-hunch').disabled = !me || me.hunch <= 0;
  $('#overlay-ask').hidden = false;
  wrap.onclick = (e) => {
    const b = e.target.closest('.ask-opt');
    if (!b) return;
    onPick({ attr: b.dataset.attr, value: b.dataset.val === 'true' ? true : b.dataset.val, hunch: $('#ask-hunch').checked, targetPlayer: opps[0] ? opps[0].id : null });
  };
}
export function hideAsk() { $('#overlay-ask').hidden = true; }

// ---------- ANSWER reveal ----------
export function showAnswer(snap, ev, onOk) {
  const deck = DECKS[snap.deckId];
  const attr = deck.attributes.find((a) => a.id === ev.attr);
  const q = attr ? attr.q(ev.value) : '…';
  $('#answer-q').textContent = q;
  const big = $('#answer-big');
  big.className = 'answer-big';
  if (ev.isHunch) {
    big.textContent = ev.hot;
    big.classList.add(ev.hot.toLowerCase());
  } else {
    big.textContent = ev.answer ? 'YES' : 'NO';
    big.classList.add(ev.answer ? 'yes' : 'no');
  }
  $('#overlay-answer').hidden = false;
  $('#btn-answer-ok').onclick = () => { $('#overlay-answer').hidden = true; onOk(ev); };
}

// ---------- GUESS ----------
export function showGuess(snap, { onConfirm }) {
  const deck = DECKS[snap.deckId];
  const opps = snap.players.filter((p) => p.id !== snap.youAre && p.alive);
  let selOpp = opps[0] ? opps[0].id : null;
  const rwrap = $('#guess-rivals');
  rwrap.innerHTML = opps.map((p) => `<button data-id="${p.id}" class="${p.id === selOpp ? 'sel' : ''}">${p.name}</button>`).join('');
  rwrap.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; selOpp = b.dataset.id; $$('#guess-rivals button').forEach((x) => x.classList.toggle('sel', x === b)); };
  const grid = $('#guess-grid');
  // show only still-standing suspects on MY board as candidates (helps narrow)
  const me = snap.players.find((p) => p.id === snap.youAre);
  grid.innerHTML = deck.cast.map((c) => {
    const up = me.board.find((b) => b.id === c.id).up;
    const img = artUrl(snap.deckId, c.id) || placeholderDataUrl(deck, c);
    return `<button data-cid="${c.id}" class="${up ? '' : 'dim'}"><img src="${img}" alt="${c.name}"/><span class="gn">${c.name}</span></button>`;
  }).join('');
  grid.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    onConfirm({ targetPlayer: selOpp, charId: b.dataset.cid });
  };
  $('#overlay-guess').hidden = false;
}
export function hideGuess() { $('#overlay-guess').hidden = true; }

// ---------- END ----------
export function showEnd(snap) {
  const deck = DECKS[snap.deckId];
  const winner = snap.players.find((p) => p.id === snap.winner);
  const me = snap.players.find((p) => p.id === snap.youAre);
  const won = snap.winner === snap.youAre;
  $('#end-title').textContent = won ? 'You win!' : `${winner ? winner.name : 'Nobody'} wins`;
  // show winner's secret identity
  if (winner && winner.target) {
    const char = deck.cast.find((c) => c.id === winner.target);
    $('#end-img').src = artUrl(snap.deckId, char.id) || placeholderDataUrl(deck, char);
    $('#end-sub').textContent = `${winner.name} was hiding ${char.name} all along.`;
  }
  spawnConfetti(deck.accent);
  $('#overlay-end').hidden = false;
}
function spawnConfetti(accent) {
  const c = $('#confetti'); c.innerHTML = '';
  const cols = [accent, '#fff', '#ff5cc8', '#54f0e8', '#ffc83d'];
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = cols[i % cols.length];
    s.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    s.style.animationDelay = Math.random() * 0.6 + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    c.appendChild(s);
  }
}

// ---------- LOBBY ----------
export function renderLobby(code, players, deckId, isHost) {
  $('#lobby-code').textContent = code;
  $('#lobby-deck').textContent = `Deck: ${DECKS[deckId].name} — ${DECKS[deckId].tagline}`;
  const ul = $('#lobby-players'); ul.innerHTML = '';
  players.forEach((p, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="seat" style="background:${SEAT_COLORS[i % 4]}">${i + 1}</span><b>${p.name}</b>${i === 0 ? '<span class="host-tag">HOST</span>' : ''}`;
    ul.appendChild(li);
  });
  const enough = players.length >= 2;
  $('#lobby-hint').textContent = enough ? `${players.length} players ready (2–4).` : 'Waiting for players… you need at least 2.';
  if (isHost) { $('#btn-start').hidden = !enough; $('#lobby-wait').hidden = true; }
  else { $('#btn-start').hidden = true; $('#lobby-wait').hidden = false; }
}

// ---------- DECK PICKER ----------
export function renderDeckPicker(selected, onSelect, sel = '#deck-picker') {
  const wrap = $(sel); wrap.innerHTML = '';
  Object.values(DECKS).forEach((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'deck-opt' + (d.id === selected ? ' sel' : '');
    b.innerHTML = `<div class="dn">${d.name}</div><div class="swatch" style="background:${d.accent}"></div>`;
    b.addEventListener('click', () => { onSelect(d.id); $$(sel + ' .deck-opt').forEach((x) => x.classList.toggle('sel', x === b)); });
    wrap.appendChild(b);
  });
}

// ---------- toast ----------
let toastT;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- how to play ----------
export function renderHow() {
  $('#how-body').innerHTML = `
    <p>WHO-O-SITT is a weird twist on the classic “who am I?” guessing game for <b>2–4 players</b>.</p>
    <h4>Goal</h4>
    <p>Everyone is secretly dealt one monster identity. Be the first to correctly <b>unmask</b> a rival's secret monster.</p>
    <h4>On your turn</h4>
    <ul>
      <li>Ask one <b>yes/no question</b> about a trait (“Does your monster have horns?”).</li>
      <li>Read the answer, then <b>flip down</b> every suspect on your board that doesn't match — that's the satisfying clack.</li>
      <li>End your turn, or make an accusation.</li>
    </ul>
    <h4>The twists</h4>
    <ul>
      <li><b>☣ Mutation rounds</b> — every 3rd turn one trait morphs across the board, and that suspect pops back up. No lazy brute-forcing.</li>
      <li><b>🔮 Hunch tokens</b> — spend one for a fuzzy <b>hot / warm / cold</b> reading instead of yes/no. You start with two.</li>
      <li><b>💥 Sabotage (3–4p)</b> — once per game, force a rival to flip down two of their own standing tiles.</li>
      <li><b>🎯 Sudden accuse</b> — you can accuse <i>anytime</i>, even off-turn. But a wrong guess flips 4 of your tiles back up.</li>
      <li><b>🔥 Streaks</b> — matching questions in a row build a streak you can flaunt.</li>
    </ul>
    <h4>Local network play</h4>
    <p>One player hosts and shares the 4-letter room code. Everyone on the same Wi‑Fi (or anywhere on the internet) opens the page and joins with that code. No install, no account.</p>`;
}
