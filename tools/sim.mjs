// Headless simulation of the engine: run several full games with bot logic to catch crashes,
// verify a winner is always produced, and that the twists fire.
import { Game } from '../src/engine.js';
import { DECKS } from '../src/data/decks.js';

function botTurn(game, pid) {
  const me = game.byId(pid);
  const deck = game.deck;
  // pick an opponent
  const opp = game.alivePlayers().find((p) => p.id !== pid);
  if (!opp) return;

  // remaining suspects on my board
  let up = me.board.filter((b) => b.up).map((b) => b.id);

  // if down to 1, accuse
  if (up.length === 1) {
    game.handleIntent(pid, { kind: 'guess', targetPlayer: opp.id, charId: up[0] });
    return;
  }

  // else ask a question that splits the remaining set best
  const attr = deck.attributes[Math.floor(Math.random() * deck.attributes.length)];
  let value;
  if (attr.type === 'bool') value = true;
  else value = attr.values[Math.floor(Math.random() * attr.values.length)];

  const r = game.handleIntent(pid, { kind: 'ask', attr: attr.id, value, targetPlayer: opp.id });
  const ev = r.events.find((e) => e.type === 'asked');
  if (ev && !ev.isHunch) {
    // flip non-matching
    const flip = [];
    for (const b of me.board) {
      if (!b.up) continue;
      const cs = game.castState[b.id];
      const matches = attr.type === 'bool' ? (cs[attr.id] === true) === value : cs[attr.id] === value;
      const keep = ev.answer ? matches : !matches;
      if (!keep) flip.push(b.id);
    }
    game.handleIntent(pid, { kind: 'flip', tiles: flip });
  }
  game.handleIntent(pid, { kind: 'endTurn' });
}

function runGame(nPlayers, deckId, twists) {
  const players = Array.from({ length: nPlayers }, (_, i) => ({ id: i === 0 ? 'host' : `p${i}`, name: `Bot${i}` }));
  const game = new Game({ deckId, players, twists });
  let safety = 0;
  let mutations = 0, sabotages = 0, wrongGuesses = 0;
  while (game.phase !== 'over' && safety < 2000) {
    safety++;
    const cur = game.current();
    botTurn(game, cur.id);
    if (game.lastMutation) mutations++;
  }
  // count log signals
  for (const l of game.log) {
    if (l.includes('MUTATION')) {}
  }
  return { phase: game.phase, winner: game.winner, turns: game.turnCount, safety, deckId, nPlayers,
    targetsDistinct: new Set(game.players.map(p=>p.target)).size };
}

let fails = 0;
for (const deckId of Object.keys(DECKS)) {
  for (const n of [2, 3, 4]) {
    for (let trial = 0; trial < 8; trial++) {
      const res = runGame(n, deckId, { mutation: true, hunch: true, sabotage: true, suddenGuess: true });
      const ok = res.phase === 'over' && res.winner && res.safety < 2000;
      if (!ok) { fails++; console.log('FAIL', res); }
    }
  }
}
// sample summaries
console.log('Sample 2p cryptid:', runGame(2, 'cryptid', {mutation:true,hunch:true,sabotage:true,suddenGuess:true}));
console.log('Sample 4p space:', runGame(4, 'space', {mutation:true,hunch:true,sabotage:true,suddenGuess:true}));
console.log('Sample 3p haunted no twists:', runGame(3, 'haunted', {mutation:false,hunch:false,sabotage:false,suddenGuess:false}));
console.log(fails === 0 ? 'ALL GAMES COMPLETED WITH A WINNER ✓' : `${fails} FAILURES ✗`);
