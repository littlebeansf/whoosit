// engine.js — pure, host-authoritative game logic for WHO-O-SITT.
// No DOM, no network. The host runs one Game instance and broadcasts snapshots.
//
// Core: each player gets a secret target from the deck. On their turn they ASK a yes/no
// question; the other side answers truthfully; the asker flips down non-matching tiles on
// their own board. First to correctly GUESS an opponent's target wins.
//
// Twists: mutation rounds, hunch tokens (hot/cold), sabotage, sudden guess penalty, streaks.

import { DECKS } from './data/decks.js';

function shuffle(a, rnd) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// seeded RNG so host & clients could replay deterministically if needed
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor({ deckId = 'cryptid', players, twists }) {
    this.deck = DECKS[deckId];
    this.deckId = deckId;
    this.seed = (Math.random() * 1e9) | 0;
    this.rnd = mulberry32(this.seed);
    this.twists = Object.assign(
      { mutation: true, hunch: true, sabotage: true, suddenGuess: true },
      twists || {}
    );

    // players: [{id, name}] — keep order = turn order
    this.players = players.map((p, i) => ({
      id: p.id,
      name: p.name,
      seat: i,
      // deep-copy the cast so mutations can diverge per player board if desired (here: shared mutation)
      board: this.deck.cast.map((c) => ({ id: c.id, up: true })),
      target: null,
      hunch: this.twists.hunch ? 2 : 0,
      sabotageUsed: false,
      streak: 0,
      alive: true,
      eliminatedBy: null,
    }));

    // assign distinct secret targets
    const pool = shuffle(this.deck.cast, this.rnd);
    this.players.forEach((p, i) => { p.target = pool[i % pool.length].id; });

    // shared mutable copy of attribute values (mutation rounds modify this)
    this.castState = {};
    for (const c of this.deck.cast) this.castState[c.id] = Object.assign({}, c);

    this.turnIndex = 0;
    this.turnCount = 0;
    this.phase = 'play'; // 'play' | 'over'
    this.log = [];
    this.winner = null;
    this.lastMutation = null;
    this.pendingAnswer = null; // {askerId, targetId, attr, value, isHunch}
  }

  current() { return this.players[this.turnIndex]; }
  alivePlayers() { return this.players.filter((p) => p.alive); }
  byId(id) { return this.players.find((p) => p.id === id); }

  _logLine(text) {
    this.log.push(text);
    if (this.log.length > 40) this.log.shift();
  }

  _advanceTurn() {
    if (this.alivePlayers().length <= 1) { this._end(); return; }
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
    } while (!this.players[this.turnIndex].alive);
    this.turnCount++;
    // Mutation: every 3rd completed turn
    if (this.twists.mutation && this.turnCount > 0 && this.turnCount % 3 === 0) {
      this._mutate();
    }
  }

  _mutate() {
    const attrs = this.deck.attributes;
    const attr = attrs[Math.floor(this.rnd() * attrs.length)];
    // pick a random character to morph one attribute
    const ids = Object.keys(this.castState);
    const cid = ids[Math.floor(this.rnd() * ids.length)];
    const cur = this.castState[cid][attr.id];
    let next;
    if (attr.type === 'bool') {
      next = !cur;
    } else {
      const opts = attr.values.filter((v) => v !== cur);
      next = opts[Math.floor(this.rnd() * opts.length)];
    }
    this.castState[cid][attr.id] = next;
    // a mutated tile pops back UP for everyone (it changed — re-evaluate it)
    for (const p of this.players) {
      const t = p.board.find((b) => b.id === cid);
      if (t) t.up = true;
    }
    this.lastMutation = { cid, attr: attr.id };
    const name = this.deck.cast.find((c) => c.id === cid).name;
    this._logLine(`☣ MUTATION: ${name} changed its ${attr.label}!`);
  }

  // ---- intents from players ----
  // returns {events:[...]} describing what happened (used for animation cues)
  handleIntent(playerId, intent) {
    if (this.phase === 'over') return { events: [] };
    const p = this.byId(playerId);
    if (!p || !p.alive) return { events: [] };
    const events = [];

    switch (intent.kind) {
      case 'ask': return this._ask(p, intent, events);
      case 'flip': return this._flip(p, intent, events);
      case 'guess': return this._guess(p, intent, events);
      case 'sabotage': return this._sabotage(p, intent, events);
      case 'endTurn': return this._endTurn(p, events);
      default: return { events };
    }
  }

  // Ask a question. Must be your turn. The OTHER player(s)' targets are evaluated.
  // In 2p: question is about the single opponent. In 3-4p: about a chosen opponent.
  _ask(p, intent, events) {
    if (this.current().id !== p.id) return { events, error: 'Not your turn.' };
    const attr = this.deck.attributes.find((a) => a.id === intent.attr);
    if (!attr) return { events, error: 'Bad question.' };

    const opp = this.byId(intent.targetPlayer) || this.alivePlayers().find((x) => x.id !== p.id);
    if (!opp) return { events };

    const targetChar = this.castState[opp.target];
    let answer, hot;
    const isHunch = !!intent.hunch;
    if (isHunch) {
      if (p.hunch <= 0) return { events, error: 'No hunch tokens left.' };
      p.hunch--;
      // HOT/COLD: hot if the asked value matches, warm if shares an axis "neighbour"
      const match = attr.type === 'bool'
        ? targetChar[attr.id] === true
        : targetChar[attr.id] === intent.value;
      hot = match ? 'HOT' : (this.rnd() < 0.5 ? 'WARM' : 'COLD');
      answer = null;
      this._logLine(`${p.name} used a HUNCH on ${opp.name} → ${hot}`);
    } else {
      answer = attr.type === 'bool'
        ? targetChar[attr.id] === true
        : targetChar[attr.id] === intent.value;
      // streak: a "yes" that meaningfully narrows -> +1; otherwise reset handled on flip
      this._logLine(`${p.name} asked ${opp.name}: "${attr.q(intent.value)}" → ${answer ? 'YES' : 'NO'}`);
    }
    this.pendingAnswer = {
      askerId: p.id, oppId: opp.id, attr: attr.id, value: intent.value,
      answer, hot, isHunch,
    };
    events.push({ type: 'asked', askerId: p.id, oppId: opp.id, attr: attr.id, value: intent.value, answer, hot, isHunch });
    return { events };
  }

  // Flip tiles on your own board. tilesToFlip = array of char ids to set down.
  _flip(p, intent, events) {
    let flipped = 0;
    for (const cid of intent.tiles || []) {
      const t = p.board.find((b) => b.id === cid);
      if (t && t.up) { t.up = false; flipped++; }
    }
    if (flipped > 0) { p.streak++; events.push({ type: 'flipped', playerId: p.id, tiles: intent.tiles, streak: p.streak }); }
    return { events };
  }

  _endTurn(p, events) {
    if (this.current().id !== p.id) return { events };
    this.pendingAnswer = null;
    this._advanceTurn();
    events.push({ type: 'turn', turnPlayer: this.current().id, turnCount: this.turnCount, mutation: this.lastMutation });
    this.lastMutation = null;
    return { events };
  }

  // Guess an opponent's identity. Allowed any time (sudden guess) but penalised if wrong.
  _guess(p, intent, events) {
    const opp = this.byId(intent.targetPlayer) || this.alivePlayers().find((x) => x.id !== p.id);
    if (!opp || !opp.alive) return { events };
    const correct = opp.target === intent.charId;
    if (correct) {
      events.push({ type: 'guess', playerId: p.id, oppId: opp.id, correct: true, charId: intent.charId });
      opp.alive = false;
      opp.eliminatedBy = p.id;
      this._logLine(`🎯 ${p.name} correctly unmasked ${opp.name} as ${this.deck.cast.find(c=>c.id===intent.charId).name}!`);
      // in 2p (or last opponent) -> win
      if (this.alivePlayers().filter((x) => x.id !== p.id).length === 0) {
        this._end(p.id);
      }
      // free continue: do not advance turn on correct guess (reward)
    } else {
      // PENALTY: flip 4 of your own down tiles back UP (undo progress)
      const down = p.board.filter((b) => !b.up);
      const back = shuffle(down, this.rnd).slice(0, 4);
      for (const b of back) b.up = true;
      p.streak = 0;
      events.push({ type: 'guess', playerId: p.id, oppId: opp.id, correct: false, charId: intent.charId, undone: back.map(b=>b.id) });
      this._logLine(`❌ ${p.name} guessed wrong — 4 tiles flip back up!`);
      // wrong guess ends your turn if it was your turn
      if (this.current().id === p.id) { this.pendingAnswer = null; this._advanceTurn();
        events.push({ type: 'turn', turnPlayer: this.current().id, turnCount: this.turnCount }); }
    }
    return { events };
  }

  _sabotage(p, intent, events) {
    if (!this.twists.sabotage) return { events, error: 'Sabotage disabled.' };
    if (this.players.length < 3) return { events, error: 'Sabotage needs 3+ players.' };
    if (p.sabotageUsed) return { events, error: 'Sabotage already used.' };
    if (this.current().id !== p.id) return { events, error: 'Sabotage only on your turn.' };
    const victim = this.byId(intent.targetPlayer);
    if (!victim || !victim.alive || victim.id === p.id) return { events };
    p.sabotageUsed = true;
    const up = victim.board.filter((b) => b.up);
    const hit = shuffle(up, this.rnd).slice(0, 2);
    for (const b of hit) b.up = false;
    events.push({ type: 'sabotage', byId: p.id, victimId: victim.id, tiles: hit.map(b=>b.id) });
    this._logLine(`💥 ${p.name} SABOTAGED ${victim.name} — 2 tiles forced down!`);
    return { events };
  }

  _end(winnerId) {
    this.phase = 'over';
    const alive = this.alivePlayers();
    this.winner = winnerId || (alive[0] && alive[0].id) || null;
    const w = this.winner && this.byId(this.winner);
    this._logLine(`🏆 ${w ? w.name : 'Nobody'} wins!`);
  }

  // ---- snapshot for a specific viewer (hides other players' targets) ----
  snapshotFor(viewerId) {
    return {
      deckId: this.deckId,
      gameId: this.seed,
      phase: this.phase,
      winner: this.winner,
      turnPlayer: this.current() ? this.current().id : null,
      turnCount: this.turnCount,
      twists: this.twists,
      log: this.log.slice(-12),
      castState: this.castState, // public: shared mutated values
      pendingAnswer: this.pendingAnswer,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, seat: p.seat, alive: p.alive,
        hunch: p.hunch, sabotageUsed: p.sabotageUsed, streak: p.streak,
        board: p.board, // tiles up/down are public so others see your progress
        // only reveal a target if it's the viewer's own OR the game is over
        target: (p.id === viewerId || this.phase === 'over') ? p.target : null,
        myTarget: p.id === viewerId ? p.target : undefined,
      })),
      youAre: viewerId,
    };
  }
}
