# WHO-O-SITT? — Game Design Doc

A weird, modern take on *Guess Who?* for 2–4 players over local network (WebRTC P2P, no server).

## The Hook
The classic game has ~24 bland humans and one yes/no question per turn. WHO-O-SITT keeps the
satisfying *flip-the-tile* ritual but makes the cast genuinely strange, adds multiple swappable
**Decks** (categories), and layers in original twists so it never plays 1:1 like the board game.

## Architecture (ships on GitHub Pages — fully static)
- **WebRTC peer-to-peer** via PeerJS (free public signaling broker). One player = HOST, others
  join with a 4-letter ROOM CODE. Works on the same LAN or across the internet.
- Host is authoritative for game state; broadcasts state to peers; peers send intents.
- 2–4 players. With 2 it's a duel; with 3–4 it's a free-for-all "last detective standing".
- No localStorage (sandbox + Pages friendly) — in-memory state only.

## Decks (categories) — each has its own cast + its own attribute set
1. **CRYPTID PRECINCT** — cryptids/monsters. Attributes: pelt color, # of eyes, has horns,
   habitat, mood, accessory.
2. **SPACE BUREAUCRATS** — aliens working office jobs. Attributes: skin hue, antenna count,
   tentacles, job title, eyewear, snack.
3. **HAUNTED B&B** — friendly-ish ghosts & ghouls. Attributes: ectoplasm color, transparency,
   chains, headwear, era, vibe.
(Initial graphics generated for **CRYPTID PRECINCT** — the flagship deck. Others ship as
data + procedurally-tinted placeholders, expandable later.)

Each deck = 16 characters laid out 4×4 (classic is 24; 16 reads cleaner on screens and on mobile).

## Turn loop (the familiar ritual)
1. Each player is secretly dealt ONE **target** character (their hidden identity to be guessed).
2. On your turn you ask ONE yes/no question about an attribute ("Does your monster have horns?").
3. Opponent answers truthfully. You FLIP DOWN every tile that doesn't match — the board-game
   *clack*. Animation = the physical tile pivoting down on its hinge.
4. Whoever guesses the opponent's exact character first wins. Wrong guess = penalty.

## THE TWISTS (so it's not a 1:1 copy)
- **MUTATION ROUNDS**: every 3rd turn the round "mutates" — one random attribute value across the
  whole board shifts (a tile grows a horn, changes color). Eliminated tiles can come *back*. Keeps
  players from brute-forcing and rewards re-reading the board. (toggleable)
- **HUNCH TOKENS**: each player starts with 2. Spend one to ask a *fuzzy* question
  ("Is your monster… kinda spooky?") and get a HOT/COLD answer instead of yes/no. High-risk intel.
- **SABOTAGE (3–4p only)**: once per game, force another player to flip down 2 of *their own*
  still-standing tiles at random. Chaos.
- **SUDDEN GUESS**: you may guess at any time, not just your turn — but a wrong guess flips 4 of
  your tiles back UP (undoes your progress). Pressure mechanic.
- **STREAK MULTIPLIER**: matching questions in a row builds a combo that shrinks your final-guess
  penalty. Rewards deductive logic.

## Animations (reflect the physical board)
- Tile flip-DOWN: 3D rotateX hinge with spring easing + a soft "clack" SFX + dust puff.
- Tile flip-UP (mutation / wrong guess): reverse hinge, slight overshoot wobble.
- Board entrance: tiles cascade-drop into their slots (staggered).
- Target card peek: card lifts and tilts toward you (rotateY) when you "peek" your secret identity.
- Win: confetti + the winning tile spins and zooms.

## Art direction
- Funny cartoon, modern, NOT cringe. Thick-but-clean outlines, flat-ish shading with one soft
  gradient, slightly off-kilter shapes, expressive eyes. Think contemporary indie-game character
  art / Cartoon Saloon-meets-vector, not clip-art or 2010 "doodle".
- Palette: moody-playful. Deep ink navy board, warm bone tiles, electric accent per deck
  (cryptid = toxic lime, space = magenta, haunted = ghoul cyan).
- Two fonts: display = a chunky characterful sans; body = clean grotesk.

## Tech
- Vanilla JS + Vite-free single-bundle (plain ES modules) to deploy clean to Pages.
- PeerJS via CDN. CSS-driven flip animations (transform-3d) for buttery 60fps.
- Generated PNG portraits for the cryptid cast (transparent bg), composited onto CSS tiles.
