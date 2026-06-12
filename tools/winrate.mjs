import { Game } from '../src/engine.js';
import { Bot } from '../src/bot.js';

function duel(diffA, diffB, deckId='cryptid', n=300){
  let aWins=0,bWins=0,draws=0;
  const twists={mutation:false,hunch:true,sabotage:false,suddenGuess:true};
  for(let i=0;i<n;i++){
    const players=[{id:'A',name:'A'},{id:'B',name:'B'}];
    const g=new Game({deckId,players,twists});
    const brains={A:new Bot({id:'A',deckId,difficulty:diffA}),B:new Bot({id:'B',deckId,difficulty:diffB})};
    let guard=0;
    while(g.phase!=='over'&&guard<400){
      guard++;const cur=g.current();const brain=brains[cur.id];
      const snap=g.snapshotFor(cur.id);const intent=brain.decideTurn(snap);
      if(!intent){g.handleIntent(cur.id,{kind:'endTurn'});continue;}
      const res=g.handleIntent(cur.id,intent);
      const asked=res.events.find(e=>e.type==='asked');
      if(asked){if(!asked.isHunch)brain.learn(asked.oppId,asked.attr,asked.value,asked.answer,g.snapshotFor(cur.id).castState);
        const tiles=brain.flipTiles(g.snapshotFor(cur.id),asked);if(tiles.length)g.handleIntent(cur.id,{kind:'flip',tiles});
        if(g.phase!=='over'&&g.current().id===cur.id)g.handleIntent(cur.id,{kind:'endTurn'});}
    }
    if(g.winner==='A')aWins++;else if(g.winner==='B')bWins++;else draws++;
  }
  return {aWins,bWins,draws};
}
// Note: A always moves first (first-move advantage). Run both orders.
for(const [x,y] of [['mastermind','rookie'],['sleuth','rookie'],['mastermind','sleuth']]){
  const r1=duel(x,y);const r2=duel(y,x);
  const xWins=r1.aWins+r2.bWins, yWins=r1.bWins+r2.aWins, total=xWins+yWins;
  console.log(`${x} vs ${y}: ${x} wins ${(100*xWins/total).toFixed(1)}%  (${y} ${(100*yWins/total).toFixed(1)}%)  over ${total} games`);
}
