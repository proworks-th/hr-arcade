# Dungeon prototype: code map and how to work on it

Design: `../gdd-dungeon.md` · Product: `../prd-skills-dungeon.md` · Play: `../combat-proto.html`

## Run it
```
python -m http.server 8767          # from the repo root
open http://localhost:8767/_test/combat-proto.html
```
URL options: `?seed=demo` fixed map · `?floor=N` start deeper · `?test=1` test hooks on `window.__dgn`.
`_test/skills-proto.html` is the life-skills page; both share the save key `skills_proto` (combat XP shows up there).
The prototype mocks `Prog`, `bkkDay`, `meWho`, `fmt`, `toast` and the hub's `api` (see the top of `combat-proto.html`).

## Files
| File | Role | Needs DOM |
|---|---|---|
| `data.js` (`DD`) | every number: tiles, floor purposes, monsters, weapons, passives, waves, XP, pay | no |
| `engine.js` (`DE`) | seeded RNG, grid, collision (`move`, `blocked`), line of sight, flow field, `paintMap`, `fog`, `minimap`, `camera` | only the painters |
| `gen.js` (`DGen`) | `DGen.floor(seed, depth)` → grid, rooms, start, exit, props, chests, spikes, altar, spawns | no |
| `game.js` (`Dungeon`) | `Dungeon.mount(root, api)`: run state, weapons, waves, AI, level-ups, HUD, drawing | yes |
| `test-gen.js` | `node _test/dungeon/test-gen.js`: 2,000 floors, invariants, stats table | no |
| `test-play.py` | Playwright smoke test (desktop + phone): weapons kill, level-up, door, relic, boss chest, perf, no errors | — |
| `../skills.js` (`Skills`) | life skills: XP, tiers, daily cap, titles, capped bonuses (`Skills.bonus('combat','hp')`) | no |

## Where to change things
- Balance: only `data.js` (`MON`, `scale`, `ARMS`, `PASSIVES`, `XP`, `WAVE`, `TARGET`, `NORM`). Re-run both tests.
- New weapon: add to `DD.ARMS` with an existing `kind` (arc, orbit, throw, bolt, nova, lance, quake), or add a kind in `fireWeapons()` + its drawing in `draw()`.
- New monster: add to `DD.MON` with an existing `ai`, or add a branch in `step()`; always give attacks a visible warning (owner rule).
- New floor purpose: `DD.PURPOSE` + `DD.purposeFor`; the generator reads the ranges.
- The new map (Phase 2) should reuse `engine.js` as is and get its own generator (outdoor: fields, river, forest, cave mouth).

## Into the live hub (not done)
1. Load `data.js`, `engine.js`, `gen.js`, `game.js` (and `skills.js`) as classic scripts in `index.html`, add `{ id: 'dungeon', mount: Dungeon.mount, ... }` to the game list, `PROG_NORM.dungeon`.
2. Replace the prototype's localStorage (`dgn_codex`, `dgn_best_*`, `skills_proto`) with `Prog` fields; daily best → `rooms/_stat`.
3. Add a `verify/run.py` screen (`?seed=` for stable screenshots); bump `?v=N`.

## Owner rules to keep
Nothing is lost on faint/leave · warnings are fixed-length and always visible · skills never gate content · skill bonuses capped · B1 stays easy · Esc freezes everything.
