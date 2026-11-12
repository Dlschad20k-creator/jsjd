# Hole World · Game Design Document

All tuning values live in `shared/src/constants.ts` and `shared/src/maps.ts` (data-driven; server and client
read the same numbers).

## 1. Core loop
Move → swallow objects that fit → XP → level → radius grows → bigger objects fit → (swallow rival) → score.

## 2. Growth
- Radius `R = 1.2 · 1.13^(levelFloat − 1)` (continuous within a level).
- XP to next level `6 · 1.3^(level − 1)`; object XP `10 · r²` (r = footprint radius).
- An object fits when `r ≤ 0.86 · R` and its centre is within `R − 0.35 r` (+ reach bonuses).

## 3. PvP
- A swallows B when `R_A ≥ 1.12 · R_B` and `dist ≤ R_A − 0.4 R_B`.
- Victim: respawns after 3 s at the intersection farthest from the killer, **level 1, upgrades reset**,
  3 s spawn protection. Score is kept. Killer keeps everything and gains `25 + 50 %` of victim's life XP and
  `150 + 25·level` score.
- Shielded, spawn-protected and disconnected holes cannot be eaten.

## 4. Abilities, upgrades, power-ups, combos
| Thing | Effect |
|---|---|
| Dash (Space / right-click / Ⓐ) | ×2.6 speed for 0.35 s, 6 s cooldown |
| Vortex (E / Shift / Ⓑ) | swallows every fitting object within 2.4 R, 15 s cooldown |
| Upgrade: Turbo Core | +7 % speed per level (max 5) |
| Upgrade: Event Horizon | +12 % pull reach per level |
| Upgrade: Appetite | +12 % XP per level |
| Turbo / Magnet / Shield / Giant / Slime | ×1.55 speed 8 s / +0.6 R reach 10 s / immune 7 s / ×1.3 size 8 s / rival ×0.55 speed 5 s |
| Combo | each swallow within 1.6 s: +5 % multiplier (max ×3) |

Swallowed objects respawn after 22–38 s (never under a hole).

## 5. Match
3 s countdown, 180 s match, highest score wins (draw possible). Leaving or 30 s disconnect = forfeit.

## 6. Room state machine (server/src/game/Room.ts)
`lobby → starting (2 connected players, 4 s) → countdown → playing → ended → (both rematch) → starting`;
a player leaving during `starting/ended` returns the room to `lobby`.

## 7. Networking
| Message | Direction | Strategy |
|---|---|---|
| `snap` (players, power-ups, events) | S→C | reliable, 30 Hz, ~0.6 KB |
| `world` (layout + ~800 objects) | S→C | reliable, once per match / reconnect, ~20 KB |
| `input` (direction only) | C→S | 20 Hz + on change, rate-limited 45/s |
| dash / vortex / upgrade / rematch | C→S | reliable, rate-limited 8/s |
Server is authoritative; the client predicts its own hole with the same movement rules and softly reconciles;
the rival is interpolated 110 ms behind. `PROTOCOL_VERSION` is checked on `hello`.

## 8. Art direction
- **Mood:** toy-box diorama cities you want to eat; each world has its own palette and soundtrack.
- **Camera & scale:** tilted top-down perspective following the hole; zooms out as the hole grows.
- **Shapes:** soft rounded primitives (Pink, Bunny); boxier, grittier blocks (Berlin). Every kind has its own
  silhouette; the hole is the darkest thing on screen with a glowing rim in the player's colour.
- **Palette:** Pink = hot pink / pearl / mint, warm-pink fog. Bunny = pastel blue/mint/lilac + carrot orange.
  Berlin = asphalt grey, sandstone, BVG-style yellow, neon signs, sunset sky. Shadows cool, light warm.
- **Rules:** PBR (`MeshStandardMaterial`) + room-environment reflections; bloom only on HDR emissives.
- **Signature:** the ground is truly cut open — swallowed objects tumble down a glowing shaft.
- **No emoji art:** avatars, icons and emblems are drawn SVG; all 3D models and textures are generated in code.

## 9. Audio
Fully synthesised (Web Audio): per-material swallow sounds (crunch, squeak, honk, boing, glass, metal, thud,
splat) pitched by size, combo chimes, level-up arpeggios, kill stingers (Berlin: synth air-horn), countdown,
and a procedural sequencer per world (pop / music-box lullaby / Berlin techno) that intensifies in the last
30 s. Optional "voice memes" use the browser speech engine.
