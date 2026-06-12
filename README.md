# WHO-O-SITT? 🔍👹

A weird, modern take on the classic **Guess Who?** board game. Play **solo against AI detectives**, or go head-to-head with **2–4 players** over your local network (or the internet). Flip the tiles, ask the questions, unmask the monster.

**Funny-but-modern cartoon art. Real board-game flip animations. Original twists that keep it from playing 1:1 like the original.**

🎮 **Play it:** [https://littlebeansf.github.io/whoosit/](https://littlebeansf.github.io/whoosit/)

---

## How it works (no server required)

WHO-O-SITT is **fully static** — it runs entirely in the browser and ships on GitHub Pages. Multiplayer uses **WebRTC peer-to-peer** (via [PeerJS](https://peerjs.com/) and its free public signaling broker), so there's **no backend to host**.

- One player **hosts** a game and gets a **4-letter ROOM CODE** (e.g. `BMBD`).
- Everyone else **joins with that code**.
- The host is authoritative for game state and syncs it to the other players.

Because it's WebRTC, it works on the **same Wi-Fi / LAN** *and* across the **internet** — the players just need to be able to reach the public signaling broker (almost always fine).

### Local-network multiplayer setup

1. **Everyone opens the same URL** — either the GitHub Pages link above, or a locally-served copy (see *Run locally* below).
2. **Host:** click **Host a game** → enter a name → pick a deck and twists → **Create room**. You'll get a 4-letter code.
3. **Host shares the code** with the other players (say it out loud — you're on the same network).
4. **Each other player:** click **Join with a code** → enter a name and the 4-letter code → **Join room**.
5. Once **2–4 players** are in the lobby, the host clicks **Start the hunt**.

> Tip: For purely-offline LAN play with no internet at all, you'd need a self-hosted PeerJS broker — but for normal home/office Wi-Fi the default public broker works out of the box.

---

## Play vs AI (solo mode)

No friends online? Hunt against the bots. Click **Play vs AI** from the menu, pick your name, a deck, **1–3 AI opponents**, and a difficulty. The whole match runs offline in your browser — no network, no room code.

The bots are real opponents, not scripted dummies: each one keeps its **own candidate list**, sees only **public information** plus the answers to the questions *it* asked (it never peeks at your secret), and chooses questions that best split its remaining suspects. They flip their own tiles, spend hunch tokens, sabotage threatening rivals in 3–4-player games, and accuse when confident.

### Difficulty tiers

| Tier | Plays like |
|------|-----------|
| 🟢 **Rookie** | Learning the ropes. Asks loose questions, gambles on hasty guesses (and often whiffs, flipping tiles back up). Beatable. |
| 🟡 **Sleuth** | Sharp, mostly-optimal deductions. Guesses only when the odds are good. A fair fight. |
| 🔴 **Mastermind** | Cold and optimal. Always asks the best information-splitting question, never wastes a turn, and pounces the moment it's certain. Ruthless. |

All twists (mutation rounds, hunch tokens, sabotage, sudden guess) are toggleable in solo mode too.

---

## The game

You're each secretly assigned **one hidden identity** from the deck. On your turn you ask **one yes/no question** about a trait ("Does your cryptid have horns?"). Based on the answer you **flip down** the tiles that don't match — the satisfying board-game *clack*. First to correctly **accuse** an opponent's exact character wins.

### Decks (categories)

Each deck has its own cast of 16 and its own set of traits:

| Deck | Vibe | Traits |
|------|------|--------|
| **Cryptid Precinct** 🟢 | Cryptids & monsters (flagship, hand-made art) | pelt colour · # of eyes · horns · habitat · mood · accessory |
| **Space Bureaucrats** 🟣 | Aliens working office jobs | skin hue · antennae · tentacles · job · eyewear · snack |
| **Haunted B&B** 🔵 | Friendly-ish ghosts & ghouls | ectoplasm · transparency · chains · headwear · era · vibe |

### The twists (not a 1:1 copy)

- ☣ **Mutation rounds** — every 3rd turn, one trait morphs across the whole board. Eliminated tiles can pop *back up*. No brute-forcing.
- 🔮 **Hunch tokens** — 2 per player. Spend one to ask a *fuzzy* question and get a **HOT / WARM / COLD** answer instead of yes/no.
- 💥 **Sabotage** (3–4 players) — once a game, force a rival to drop 2 of their own standing tiles. Chaos.
- 🎯 **Sudden guess** — accuse at *any* time, not just your turn — but a wrong guess flips 4 of your tiles back up.
- 🔥 **Streak multiplier** — matching questions in a row builds a combo that reduces your final-guess penalty.

All twists are toggleable by the host before the game starts.

---

## Run locally

No build step — it's plain ES modules. You just need any static file server (browsers block ES-module imports over `file://`).

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000 on each device on your network
```

Other devices on the same Wi-Fi can reach your machine at `http://<your-local-ip>:8000`. (Find your IP with `ipconfig` / `ifconfig` / `ip addr`.) Or just have everyone use the GitHub Pages URL.

---

## Tech

- **Vanilla JS**, plain ES modules — no bundler, deploys clean to GitHub Pages.
- **PeerJS** (WebRTC P2P) loaded from CDN for serverless multiplayer.
- **CSS 3D transforms** for the board-game flip/tilt animations (60fps).
- Generated **transparent PNG portraits** for the cryptid cast, composited onto CSS tiles.

### Project structure

```
whoosit/
├── index.html          # all screens (menu, host, join, lobby, game, overlays)
├── styles.css          # design tokens + board-game flip animations
├── src/
│   ├── data/decks.js   # 3 decks × 16 characters, each with its own traits
│   ├── net.js          # WebRTC P2P (PeerJS)
│   ├── engine.js       # host-authoritative game logic + twists
│   ├── bot.js          # AI opponent brain (solo / Play vs AI mode)
│   ├── ui.js           # DOM rendering + animations
│   └── main.js         # controller wiring net + engine + UI + bots
├── tools/
│   ├── sim_bot.mjs     # headless bot-vs-bot game simulator
│   └── winrate.mjs     # head-to-head difficulty win-rate tester
├── assets/
│   ├── cryptid/        # c01–c16 character portraits
│   └── ui/             # cover art, favicon
└── DESIGN.md           # full design doc
```

---

## Credits

Designed & built by **Sebastian Fries**. Character art generated to a consistent cartoon style. Inspired by — but deliberately not a copy of — the classic *Guess Who?* board game.

MIT License.
