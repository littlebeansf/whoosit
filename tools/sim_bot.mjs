// Headless simulation: run full games of human-vs-bot(s) using ONLY the engine
// + bot brain (no DOM). Validates that bots ask sensible questions, prune
// candidates, guess, and that games terminate with a winner. Also pits bots
// against each other to sanity-check difficulty strength.

import { Game } from '../src/engine.js';
import { Bot } from '../src/bot.js';

const DECKS_IDS = ['cryptid', 'space', 'haunted'];

// A simple scripted "human" that plays like a competent bot (so all-seats are bots).
// We reuse the Bot brain for every seat to drive a fully-automated game.
function playGame({ deckId, nBots, difficulty, twists, maxTurns = 400 }) {
  const players = [];
  for (let i = 0; i < nBots; i++) players.push({ id: 'p' + i, name: 'P' + i, bot: true });
  const game = new Game({ deckId, players, twists });
  const brains = {};
  for (const p of players) brains[p.id] = new Bot({ id: p.id, deckId, difficulty });

  let guard = 0;
  while (game.phase !== 'over' && guard < maxTurns) {
    guard++;
    const cur = game.current();
    const brain = brains[cur.id];
    const snap = game.snapshotFor(cur.id);
    const intent = brain.decideTurn(snap);
    if (!intent) { game.handleIntent(cur.id, { kind: 'endTurn' }); continue; }

    const res = game.handleIntent(cur.id, intent);
    // if it asked, resolve: learn + flip + endturn
    const asked = res.events.find((e) => e.type === 'asked');
    if (asked) {
      if (!asked.isHunch) brain.learn(asked.oppId, asked.attr, asked.value, asked.answer, game.snapshotFor(cur.id).castState);
      const tiles = brain.flipTiles(game.snapshotFor(cur.id), asked);
      if (tiles.length) game.handleIntent(cur.id, { kind: 'flip', tiles });
      if (game.phase !== 'over' && game.current().id === cur.id) game.handleIntent(cur.id, { kind: 'endTurn' });
    }
    // guesses / sabotage already advance turn inside engine as needed
  }
  return { over: game.phase === 'over', winner: game.winner, turns: game.turnCount, guard, log: game.log };
}

let pass = 0, fail = 0, stuck = 0;
const turnsByDiff = { rookie: [], sleuth: [], mastermind: [] };

for (const difficulty of ['rookie', 'sleuth', 'mastermind']) {
  for (const deckId of DECKS_IDS) {
    for (const nBots of [2, 3, 4]) {
      for (let trial = 0; trial < 8; trial++) {
        const twists = {
          mutation: trial % 2 === 0,
          hunch: true,
          sabotage: nBots >= 3,
          suddenGuess: true,
        };
        const r = playGame({ deckId, nBots, difficulty, twists });
        if (!r.over) { stuck++; fail++; if (stuck <= 3) console.log('STUCK', { difficulty, deckId, nBots, guard: r.guard, lastLog: r.log.slice(-3) }); }
        else if (r.winner) { pass++; turnsByDiff[difficulty].push(r.turns); }
        else { fail++; console.log('NO WINNER', { difficulty, deckId, nBots }); }
      }
    }
  }
}

const avg = (a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 'n/a';
console.log('\n=== RESULTS ===');
console.log(`PASS=${pass}  FAIL=${fail}  STUCK=${stuck}`);
console.log('Avg turns to resolve by difficulty:');
for (const d of ['rookie', 'sleuth', 'mastermind']) console.log(`  ${d}: ${avg(turnsByDiff[d])} turns (n=${turnsByDiff[d].length})`);
console.log(pass > 0 && fail === 0 ? '\nALL GAMES COMPLETED ✔' : '\nSOME GAMES FAILED �’');
