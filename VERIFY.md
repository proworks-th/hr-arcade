# Visual verify

The agent's own eyes for HR Arcade: it opens every screen in a real browser, runs objective layout checks and
saves screenshots, so UI changes are checked before a human has to look.

## Run

```bash
pip install playwright==1.48.0 pillow
python -m playwright install chromium
python verify/run.py                    # all screens × all viewports
python verify/run.py --only hub,party3d # some screens
python verify/run.py --vp iphone11      # one viewport: iphone11, narrow, desktop, tablet (mobile = narrow)
```

Output: `verify/out/<screen>@<viewport>.png` and `verify/out/report.json`. Exit code 1 = at least one check failed.
On PCs that block Playwright's bundled Chromium ("spawn UNKNOWN") the runner falls back to installed Edge/Chrome.
CI (`.github/workflows/verify.yml`) runs the same thing on every PR and uploads the screenshots as an artifact.

## What is covered

| Screen | Steps |
|---|---|
| `hub` | open, "❓ วิธีเล่น" dialog, close, full-page shot |
| `spot` `run` `whack` `stack` `tetris` `stamp` `barista` `toss` `slack` `conga` `prism` | open from the hub, intro dialog, start, play for a moment, frame rate |
| `dungeon` | play (frame rate), open chests, clear a floor, leave, check the result and saved progress |
| `office` `farm` `tower` `village` | open, walk through the screen's own rules (basket, market, build path, pet, deliveries, moving, community farm) |
| `party` | 2D party join screen, join, lobby canvas must not be blank |
| `party3d` | 3D room: models load, join dialog, join, WebGL canvas must not be blank |

Viewports, in run order — **phone first** (PRD `_test/prd-phone-first.md`):

| Name | Size | Why |
|---|---|---|
| `iphone11` | 414×896, touch, 2× | **primary**: the iPhone 11 is the reference device (weakest phone in the office) |
| `narrow` | 390×844, touch, 2× | the narrow phone case (old name `mobile` still works on the CLI) |
| `desktop` | 1366×768 | office PCs |
| `tablet` | 768×1024, touch | |

## Test mode (`?test=1`)

`verify/testmode.js` (loaded in the `<head>` of `index.html` and `party3d.html`) maps the Firebase SDK and
`firebase-config.js` to in-memory mocks in `verify/mocks/` through an import map. Nothing reaches the real
database: the runner fails the screen if any request goes to `firebasedatabase.app`, `firebaseio.com` or the
real Firebase SDK. Without `?test=1` the script only writes the page's normal import map (party3d: three.js),
so real visitors are unaffected. `window.__app` (open / start / state) exists only in test mode.

## Objective checks (fail)

- No `pageerror` and no console error (allowlisted: Google Fonts, which can be blocked offline/CI).
- No request to a real backend in test mode.
- No sideways page scroll; no visible element past the right edge (unless inside a scroller).
- No text cut off without an ellipsis (with ellipsis = warning).
- Touch viewports: every visible control is at least 44×44 px.
- Controls do not overlap, and nothing covers a control's centre — except an open modal (dialog/overlay),
  which deliberately covers the page behind it; controls behind an open modal are skipped.
- Each screen becomes ready within its budget (hub 3 s, 3D room 20 s).
- Canvas / WebGL scenes are not a single flat colour.

## Frame rate (warn)

On every game screen (the solo games and the dungeon), right after the play screenshot, the runner samples
`requestAnimationFrame` for 5 s with the CPU slowed 4× (CDP `Emulation.setCPUThrottlingRate`) and records the average
fps and the worst frame in ms (`report.json` → `fps`, and the table at the end of the run). Under 55 fps is a
warning, never a failure: the numbers are simulated. The real number comes from the iPhone (below).

## Phone checks (warn for now)

On `iphone11` and `narrow` only. Warnings today; they become failures once the phone-first game work lands — set
`PHONE_STRICT = True` in `verify/run.py` (one switch). Listed in `report.json` → `phone`. Code: `verify/phone-checks.js`.

- (a) No key names on touch (WASD, Shift, Esc, Space, ลูกศร, "กด 1–6"-style hints) in a running game or the village.
  HTML text only; text drawn on a canvas is not seen.
- (b) Visible controls in a running game are at least 48 px and inside the bottom 40% of the screen, except an exit
  button inside the top-left 56×56 px and one optional menu button top-right. Canvas-drawn controls: the dungeon
  exposes `window.__dgn.controls()` → `{ stick, dodge, menu }`, each `{ x, y, w, h }` in viewport CSS px (or null);
  those are checked instead of the canvas.
- (c) Zoom blocked: `html` or `body` has `touch-action: manipulation` or `none`.
- (d) No text under 12 px.
- (e) No sideways scroll at 390 px.

Checks run after entrance animations settle. Full-page screenshots are only taken for the hub's last shot,
because a full-page capture resets touch emulation for later checks.

## Measuring on the real iPhone (`?fps=1`)

Simulated numbers are only a guide. The owner opens the site on the iPhone 11 with `?fps=1` added to the address
(e.g. `…/hr-arcade/?fps=1`), **Low Power Mode off** (it caps every page at 30 fps), plays each game for about
30 seconds and takes a screenshot showing the counter in the top-left corner (average fps and worst frame over the
last 5 s). Those screenshots are the "before" for Phase 0 and the pass check for Phase 4. Simulated before-numbers:
`verify/baseline-2026-11-15.md`.

## Taste rubric (look at the screenshots; add a line whenever the owner corrects something)

Phone first: look at the `@iphone11` shots before anything else, then `@narrow`, then desktop.

0. iPhone 11 portrait: during a game the playfield fills the screen (80%+), controls sit where the thumbs are
   (bottom 40%), at least 48 px, and no keyboard hints are shown.
1. Desktop 1366×768: the party buttons (🎉 เข้าห้องปาร์ตี้, 🧊 ห้อง 3D) and all four solo games are visible without scrolling.
2. The hub is at most ~1.5 screens tall on desktop (today: one screen).
3. Important buttons carry a text label on desktop — อันดับ, วิธีเล่น, หัวหน้ามา! (Esc), หน้าแรก. On narrow phones the
   header may drop to icons, each with an `aria-label`.
4. The boss key is always reachable and never covers game content (it lives in the sticky header).
5. Long explanations live behind "❓ วิธีเล่น", not on the hub itself.
6. Thai game titles never break mid-word on phones (one-column game list under 480 px).
