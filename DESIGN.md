# WHO-O-SITT? — Game Design Doc

A weird, modern take on *Guess Who?* for 2–4 players over local network (WebRTC P2P, no server).

## The Hook
The classic game has ~24 bland humans and one yes/no question per turn. WHO-O-SITT keeps the
satisfying *flip-the-tile* ritual but makes the cast genuinely memorable, adds multiple swappable
**Decks** (categories) of retro comic-book archetypes, and layers in original twists so it never
plays 1:1 like the board game.

## Architecture (ships on GitHub Pages — fully static)
- **WebRTC peer-to-peer** via PeerJS (free public signaling broker). One player = HOST, others
  join with a 4-letter ROOM CODE. Works on the same LAN or across the internet.
- Host is authoritative for game state; broadcasts state to peers; peers send intents.
- 2–4 players. With 2 it's a duel; with 3–4 it's a free-for-all "last detective standing".
- No localStorage (sandbox + Pages friendly) — in-memory state only.

## Decks (categories) — each has its own cast + its own attribute set
Four decks of pop-art archetypes, each with clear (legally-safe) nods to famous characters.
1. **ORDER OF THE MISTY TOWER** — fantasy wizards & sorcerers (Gandalf-ish, etc.). Accent: violet.
   Attributes: robe color, beard, has hat, staff/magic-item, familiar, glow/aura.
2. **SATURDAY MORNING MAYHEM** — cartoon toons (SpongeBob/Pumbaa/Lucky Luke-ish). Accent: amber.
   Attributes: kind, color, has teeth, headgear, feet, face.
3. **THE JUSTICE BUREAU** — superheroes (Iron Man/Wonder Woman/Hulk-ish). Accent: red.
   Attributes: suit color, power, has cape, mask, emblem, hair.
4. **THE LEGION OF GLOOM** — supervillains (Voldemort/evil-clown/Dracula-ish). Accent: cyan.
   Attributes: skin, hair, has cape, weapon, has scar, grin.
All four decks ship with full original PNG art (16 portraits each). Inspiration is intentional but
every design is original — clear archetype nods, no copying of protected/trademarked designs.

Each deck = 16 characters laid out 4×4 (classic is 24; 16 reads cleaner on screens and on mobile).

## Turn loop (the familiar ritual)
1. Each player is secretly dealt ONE **target** character (their hidden identity to be guessed).
2. On your turn you ask ONE yes/no question about an attribute ("Does your character have a cape?").
3. Opponent answers truthfully. You FLIP DOWN every tile that doesn't match — the board-game
   *clack*. Animation = the physical tile pivoting down on its hinge.
4. Whoever guesses the opponent's exact character first wins. Wrong guess = penalty.

## THE TWISTS (so it's not a 1:1 copy)
- **MUTATION ROUNDS**: every 3rd turn the round "mutates" — one random attribute value across the
  whole board shifts (a tile grows a horn, changes color). Eliminated tiles can come *back*. Keeps
  players from brute-forcing and rewards re-reading the board. (toggleable)
- **HUNCH TOKENS**: each player starts with 2. Spend one to ask a *fuzzy* question
  ("Is your character… kinda heroic?") and get a HOT/COLD answer instead of yes/no. High-risk intel.
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
- Retro comic / pop-art. Halftone Ben-Day dots, bold black ink outlines, flat bold primary colors,
  high-contrast cel shading, expressive comic-book faces. Think vintage Silver-Age comic panels /
  Lichtenstein pop-art, not clip-art or 2010 "doodle".
- Palette: punchy pop-art. Deep ink navy board, warm bone tiles, electric accent per deck
  (wizards = violet, toons = amber, heroes = red, villains = cyan).
- Two fonts: display = a chunky characterful sans; body = clean grotesk.

## Tech
- Vanilla JS + Vite-free single-bundle (plain ES modules) to deploy clean to Pages.
- PeerJS via CDN. CSS-driven flip animations (transform-3d) for buttery 60fps.
- Generated pop-art PNG portraits for all four casts (64 total, transparent bg), composited onto CSS tiles.
