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
| `test-phone.py` | `python3 _test/dungeon/test-phone.py [--quick]`: phone controls at 414×896 / 390×844 in every hand + size setting, and desktop (thumb zone, sizes, gaps, edge markers, stick halves, menu, cards in the lower half, no key names on touch) | — |
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

## Pitfalls (bugs we shipped, so they don't come back)

- **A door that can't open** (live 15 Nov 2026, B6 vault). The door target assumed waves top up the kills, but vault
  floors spawn no waves, so 3 placed monsters against a target of 6 left the run stuck. Rule: any floor's target
  must be reachable from what that floor can actually spawn. If you add a purpose without waves, or change
  `DD.TARGET`, `DD.WAVE` or the generator's monster counts, extend the door check in `test-gen.js` to cover it.
- **A chest you can't open** (live 15 Nov 2026). Floor chests only opened when a sword/axe swing reached them, and
  they block their tile, so a dagger/staff/wand build could never open one. Now walking up to a chest from any side
  opens it (swings still work). Rule: anything the player must interact with has to work with every build, by
  walking to it; the `verify/run.py` dungeon screen opens each B1 chest with a dagger-only build.
- **Test mode on live.** `?floor=` / `?seed=` must stay behind `window.__TEST__` (set only by `verify/testmode.js`),
  never a URL check, or anyone can skip floors and fake the deepest-floor leaderboard.
- **Cache.** Bump `?v=N` on every changed `dungeon/*.js` in `index.html`; Pages caches about 10 minutes.
- **A fix isn't done until** the floor that broke is replayed with its own seed in test mode
  (`index.html?test=1&seed=dgn-YYYY-MM-DD&floor=N`) and the matching rule is added to `test-gen.js`.

## Phone layout (pf-dungeon, 15 Nov 2026)

On `Phone.touch` the canvas fills the hub's game-mode stage at 1 logical px = 1 CSS px, and the world is drawn at
zoom `Z` so at least 15.5 tiles show across (7+ each side of the player). Every screen position lives in `L`
(computed in `layout()`, re-run on resize, orientation and `Phone.on`). Desktop keeps the fixed 720×432 view (Z = 1).
- Keep the top-left 56×56 clear: it is the hub's exit button (`#gmExit`).
- Map and leave are in the menu (`.dgn-menu` → `.dgn-sheet`; the leave button is still `.dgn-hud .q`, but only
  visible once the menu is open). The game is paused while the menu or the map from it is open.
- Any new warned attack must also get an edge marker: add it to `drawMarkers()` (owner rule: warnings are honest).
- Test hooks: `__dgn.controls()` (stick / dodge / menu rects in viewport px, view in tiles), `__dgn.swirlOff()`
  (a spawn warning outside the view), `__dgn.markers()` (markers drawn last frame), `__dgn.menu()`.
