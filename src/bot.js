// bot.js — the AI opponent's "brain" for WHO-O-SITT solo mode.
//
// A Bot plays exactly like a human would: it can only see PUBLIC information
// (the shared snapshot) plus the answers to the questions IT asked. It never
// peeks at an opponent's secret target. It maintains its own candidate set for
// each rival and chooses questions that best split that set.
//
// Difficulty tiers:
//   rookie     — asks a fair question but plays loose; occasional random pick,
//                rarely uses twists, guesses late and sometimes sloppily.
//   sleuth     — greedy information gain (closest-to-50/50 split), guesses when
//                down to ~2 candidates, uses a hunch now and then.
//   mastermind — optimal split, aggressive confident guessing, smart hunch +
//                sabotage usage. A genuinely tough detective.
//
// The brain is stateless across instances except for `mem` (its candidate
// memory), which the controller keeps alive for the whole game.

import { DECKS } from './data/decks.js';

// noise         : chance of asking a non-optimal (random) question
// guessAt       : guess confidently when candidates <= this (1 = only when certain)
// jumpChance    : per-turn chance to gamble an early guess while still >guessAt cands
//                 (models a hasty/sloppy detective — often wrong)
// hunchChance   : chance to spend a hunch token / take fuzzy info
// sabotageChance: chance to sabotage a threatening rival (3-4p)
// noise         : chance of asking a non-optimal (random) question (wastes info)
// guessAt       : guess confidently when candidates <= this
// gambleAt      : the IDEAL pool size at/below which a smart gamble is +EV.
//                 Bots gamble when set.size <= gambleAt with prob gambleChance.
//                 Rookie gambles RECKLESSLY at large pools (low hit rate, often
//                 wrong); mastermind gambles only at small pools (high hit rate).
const DIFFS = {
  rookie:     { name: 'Rookie',     noise: 0.55, guessAt: 1, gambleAt: 9, gambleChance: 0.55, hunchChance: 0.05, sabotageChance: 0.15, thinkMs: [700, 1300] },
  sleuth:     { name: 'Sleuth',     noise: 0.14, guessAt: 1, gambleAt: 3, gambleChance: 0.55, hunchChance: 0.18, sabotageChance: 0.45, thinkMs: [600, 1100] },
  mastermind: { name: 'Mastermind', noise: 0.0,  guessAt: 1, gambleAt: 2, gambleChance: 1.0,  hunchChance: 0.28, sabotageChance: 0.75, thinkMs: [450, 900] },
};

export function difficultyLabel(id) { return (DIFFS[id] || DIFFS.sleuth).name; }
export function difficultyList() {
  return [
    { id: 'rookie', name: 'Rookie', blurb: 'Learning the ropes. Beatable.' },
    { id: 'sleuth', name: 'Sleuth', blurb: 'Sharp deductions. A fair fight.' },
    { id: 'mastermind', name: 'Mastermind', blurb: 'Cold, optimal, ruthless.' },
  ];
}

export class Bot {
  constructor({ id, deckId, difficulty = 'sleuth' }) {
    this.id = id;
    this.deckId = deckId;
    this.deck = DECKS[deckId];
    this.diff = DIFFS[difficulty] || DIFFS.sleuth;
    this.difficulty = difficulty;
    // candidate memory: per opponent id -> Set of still-possible character ids
    this.mem = {};
  }

  _cands(oppId) {
    if (!this.mem[oppId]) this.mem[oppId] = new Set(this.deck.cast.map((c) => c.id));
    return this.mem[oppId];
  }

  // current value of an attribute for a character, honouring mutations (castState)
  _val(castState, cid, attrId) {
    const cs = castState && castState[cid];
    return cs ? cs[attrId] : this.deck.cast.find((c) => c.id === cid)[attrId];
  }

  // After the bot asked a question and got an answer, prune its candidate set.
  // (Mutations may have re-opened tiles; we simply re-filter against castState.)
  learn(oppId, attr, value, answer, castState) {
    const set = this._cands(oppId);
    const at = this.deck.attributes.find((a) => a.id === attr);
    for (const cid of [...set]) {
      const v = this._val(castState, cid, attr);
      const matches = at.type === 'bool' ? v === true : v === value;
      const keep = answer ? matches : !matches;
      if (!keep) set.delete(cid);
    }
  }

  // Re-sync candidate set against the live castState so a mutation that changed a
  // surviving candidate doesn't leave stale beliefs. We can only re-validate what
  // we still believe; we conservatively keep everything consistent with no info
  // we don't have, so mutation simply means we may need to re-ask. Here we just
  // make sure the set never empties to zero (safety) and never holds unknowns.
  _safety(oppId) {
    const set = this._cands(oppId);
    if (set.size === 0) {
      // our beliefs got invalidated (e.g. by a mutation) — reset to full and move on
      this.mem[oppId] = new Set(this.deck.cast.map((c) => c.id));
      return this.mem[oppId];
    }
    return set;
  }

  // Score how well asking (attr,value) splits the candidate set. Best split is
  // closest to half. Returns the size of the smaller resulting partition (higher
  // = more balanced = more information).
  _splitScore(set, at, value, castState) {
    let yes = 0;
    for (const cid of set) {
      const v = this._val(castState, cid, at.id);
      const m = at.type === 'bool' ? v === true : v === value;
      if (m) yes++;
    }
    const no = set.size - yes;
    return Math.min(yes, no); // maximise the minimum partition
  }

  // Choose the single best (attr,value) question over the candidate set.
  _bestQuestion(set, castState) {
    let best = null, bestScore = -1;
    for (const at of this.deck.attributes) {
      const values = at.type === 'bool' ? [true] : at.values;
      for (const value of values) {
        const score = this._splitScore(set, at, at.type === 'bool' ? true : value, castState);
        if (score > bestScore) { bestScore = score; best = { attr: at.id, value: at.type === 'bool' ? true : value }; }
      }
    }
    return best;
  }

  _randomQuestion() {
    const at = this.deck.attributes[Math.floor(Math.random() * this.deck.attributes.length)];
    const value = at.type === 'bool' ? true : at.values[Math.floor(Math.random() * at.values.length)];
    return { attr: at.id, value };
  }

  // ---- main decision: given a snapshot where it is the bot's turn, return an
  // array of intents to play in sequence (with small think-pauses applied by the
  // controller). Typically: [ask] then later [flip] handled separately, OR a
  // [guess]. We keep it to a single decision per call; the controller loops.
  // ----
  decideTurn(snap) {
    const me = snap.players.find((p) => p.id === this.id);
    if (!me || !me.alive || snap.phase === 'over') return null;
    const opps = snap.players.filter((p) => p.id !== this.id && p.alive);
    if (!opps.length) return null;

    // pick the opponent we know the most about (smallest candidate set)
    opps.sort((a, b) => this._safety(a.id).size - this._safety(b.id).size);
    const opp = opps[0];
    const set = this._safety(opp.id);

    // 1) Confident guess when candidates are small enough for this difficulty.
    if (set.size >= 1 && set.size <= this.diff.guessAt) {
      const charId = [...set][Math.floor(Math.random() * set.size)];
      return { kind: 'guess', targetPlayer: opp.id, charId };
    }
    // 2) Gamble guess. Skilled bots gamble only when the pool is small (high hit
    //    rate, so +EV given a correct guess wins instantly). A rookie gambles
    //    recklessly even at large pools, where the hit rate is poor and the
    //    wrong-guess penalty (4 tiles back up) repeatedly sets it back.
    if (set.size > this.diff.guessAt && set.size <= this.diff.gambleAt) {
      if (Math.random() < this.diff.gambleChance) {
        const charId = [...set][Math.floor(Math.random() * set.size)];
        return { kind: 'guess', targetPlayer: opp.id, charId };
      }
    }

    // 2) Sabotage (3-4p only) when available and a rival is close to winning.
    if (snap.twists.sabotage && snap.players.length >= 3 && !me.sabotageUsed) {
      // find a rival who has flipped down a lot (close to solving)
      const total = this.deck.cast.length;
      const threatened = opps
        .map((o) => ({ o, down: o.board.filter((b) => !b.up).length }))
        .filter((x) => x.down >= total - 3)
        .sort((a, b) => b.down - a.down)[0];
      if (threatened && Math.random() < this.diff.sabotageChance) {
        return { kind: 'sabotage', targetPlayer: threatened.o.id };
      }
    }

    // 3) Ask a question. Greedy best split, with difficulty noise.
    let q;
    if (Math.random() < this.diff.noise) q = this._randomQuestion();
    else q = this._bestQuestion(set, snap.castState) || this._randomQuestion();

    // occasionally spend a hunch (fuzzy) — only when it has tokens and feels lucky
    const useHunch = me.hunch > 0 && snap.twists.hunch && Math.random() < this.diff.hunchChance && set.size > 4;

    return { kind: 'ask', attr: q.attr, value: q.value, hunch: useHunch, targetPlayer: opp.id };
  }

  // After asking & receiving an answer, decide which of the bot's OWN tiles to
  // flip down. Returns an array of char ids. (Pure board bookkeeping — the bot
  // flips down everything inconsistent with the yes/no answer; hunches don't
  // auto-eliminate.)
  flipTiles(snap, ev) {
    const me = snap.players.find((p) => p.id === this.id);
    if (!me || ev.isHunch) return [];
    const tiles = [];
    const at = this.deck.attributes.find((a) => a.id === ev.attr);
    for (const b of me.board) {
      if (!b.up) continue;
      const v = this._val(snap.castState, b.id, ev.attr);
      const matches = at.type === 'bool' ? v === true : v === ev.value;
      const keep = ev.answer ? matches : !matches;
      if (!keep) tiles.push(b.id);
    }
    return tiles;
  }

  thinkDelay() {
    const [a, b] = this.diff.thinkMs;
    return a + Math.random() * (b - a);
  }
}
