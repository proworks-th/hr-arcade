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
| `dungeon/data.js` (`DD`) | every number: tiles, floor purposes, monsters, weapons, passives, waves, XP, pay | no |
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

## In the hub (branch `dungeon-life-skills`, 13 Nov 2026)

The engine now lives in `/dungeon/` and skills in `/skills.js`; this folder keeps only the tests, shots and the
prototype pages. Already wired: scripts in `index.html`, the `GAMES` entry (ranked by deepest floor, unit
`ชั้นลึกสุด`), `PROG_NORM.dungeon = 20` and `PAY_RULES.dungeon` (no ×2, no bricks) in `office.js`,
`RANK_GAMES.dungeon` in `online.js`, saves in `prog.dgn`, combat XP via `Skills.add`. `?floor=` and `?seed=` only
work in test mode (`window.__TEST__`, set by `verify/testmode.js`). Verify screen: `python verify/run.py --only dungeon`.
