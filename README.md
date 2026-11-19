# Hole World – Ultimate Multiplayer

> This repo also contains **[Funkfoto](funkfoto/)**: a website that sends photos between phones by sound or vibration.

A real-time **1v1 browser multiplayer** game: you are a black hole that swallows a whole city. Grow by eating
objects, chain combos, grab power-ups, pick upgrades — and once you are bigger than your rival, **swallow
them**. The victim respawns at level 1; the survivor keeps everything. Highest score after 3 minutes wins.

Original game: every 3D model, texture, icon and sound is generated in code (no external assets).

| World | Vibe |
|---|---|
| **Pink Dream World** | Pink fashion city: dream castle, mansions, boutiques, convertibles, glitter ferris wheel |
| **Baby Bunny World** | Pastel wonderland: hopping bunnies, giant carrots, mushroom houses, rainbows, teddies |
| **Berlin Meme City** | Brandenburger Tor, Fernsehturm, U-Bahn, Döner shops, Spätis, graffiti, techno bunker, Kiez characters |

## Features
- **Multiplayer:** automatic matchmaking, private room codes + invite links, waiting lobby (the match starts only
  when two players are in), names/avatars/colours, kill feed, rematch, reconnect after network drops or page
  reloads (30 s grace, then forfeit). Server-authoritative simulation at 30 Hz over Socket.IO WebSockets.
- **Gameplay:** growth levels, PvP swallowing, respawn at level 1, combos (up to ×3), 3 upgrade tracks,
  Dash + Vortex abilities, 5 power-ups (Turbo, Magnet, Shield, Giant, Slime), global leaderboard.
- **Graphics:** Three.js, PBR materials + environment reflections, real-time shadows, bloom, a ground shader
  that cuts the hole open so objects tumble into a glowing shaft, objects tipping at the hole edge, particles,
  ~800 instanced objects per world, quality presets for phones.
- **Audio:** synthesised SFX per material (crunch, squeak, honk, boing, glass…), per-world procedural music
  (pop, music-box, Berlin techno), optional meme voice lines.
- **UI:** React dark-glass design, EN/DE, settings (volume, graphics, reduced motion), mobile safe areas.
- **Controls:** mouse (steer towards the pointer), WASD/arrows, touch drag joystick, gamepad.
  Dash = Space / right-click / Ⓐ · Vortex = E / Shift / Ⓑ · Upgrades = 1/2/3.

## Tech
TypeScript everywhere · React 18 + Vite + Three.js (client) · Node.js + Express + Socket.IO (server) ·
shared rules/protocol in `shared/` · JSON-file leaderboard (no paid database).

```
shared/src    game constants, protocol types, map definitions + deterministic world generator
server/src    index.ts (sockets, matchmaking, validation), game/Room.ts (lifecycle), game/Match.ts (simulation)
client/src    game/ (Engine, World, Hole, Ground shader, Effects, Input, assets/ models per world)
              ui/ (Home, Lobby, Hud, Results, Panels), audio/Audio.ts, net/socket.ts
design/       game brief + design document (tuning, state machine, netcode, art direction)
```

## Run locally
Requires Node 18+ (22 recommended).
```bash
npm install
npm run dev          # server on :3001 + Vite client on :5173 (proxied websockets)
```
Open http://localhost:5173 in two browser windows (or on your phone in the same Wi-Fi via the printed
network URL) and press **Quick Match** in both.

Production build (one process serves client + websockets):
```bash
npm run build
npm start            # http://localhost:3001
```

## Tests
```bash
npm run typecheck    # client + server
npm test             # unit tests of the match simulation
npm run test:e2e     # protocol end-to-end: matchmaking, reconnect, results, rematch, forfeit, private rooms
npm run smoke        # two headless browsers play a match (needs Playwright + Chromium and a running server)
```
Art review without a server: open `/?preview=berlin&cam=0,25,70,0` (also `pink`, `bunny`).

## Deploy (free tiers)
**Option A – Render (single free web service, recommended).** The repo contains `render.yaml`.
1. Push this repo to GitHub.
2. https://dashboard.render.com → **New → Blueprint** → select the repo → Apply.
3. Open `https://hole-world.onrender.com` (your service URL). Health check: `/api/health`.
Free instances sleep after ~15 min idle; the first visit then takes ~30–60 s to wake up.

**Option B – Docker** (Fly.io, Koyeb, Railway, Cloud Run…): `docker build -t hole-world . && docker run -p 3001:3001 hole-world`.

**Option C – split hosting:** server on Render/Fly (set `CORS_ORIGIN=https://<user>.github.io`), client on
GitHub Pages via the manual workflow `.github/workflows/pages.yml` (set repo variable `SERVER_URL`).

### Environment variables
| Name | Where | Purpose |
|---|---|---|
| `PORT` | server | listen port (Render sets it) |
| `CORS_ORIGIN` | server | allowed client origins, comma-separated (default `*`) |
| `DATA_DIR` | server | leaderboard storage dir — use a persistent disk to keep scores across deploys |
| `VITE_SERVER_URL` | client build | server URL when client is hosted separately (default: same origin) |
| `VITE_BASE` | client build | base path, e.g. `/jsjd/` for GitHub Pages |

## Status
Built and verified in this repo: typecheck, unit tests, protocol e2e tests, production build and a two-browser
headless match. The game has **not been deployed** by the author of this commit — follow "Deploy" above.
