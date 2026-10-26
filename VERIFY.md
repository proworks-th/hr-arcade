# Visual verify

The agent's own eyes for HR Arcade: it opens every screen in a real browser, runs objective layout checks and
saves screenshots, so UI changes are checked before a human has to look.

## Run

```bash
pip install playwright==1.48.0 pillow
python -m playwright install chromium
python verify/run.py                    # all screens × all viewports
python verify/run.py --only hub,party3d # some screens
python verify/run.py --vp desktop       # one viewport
```

Output: `verify/out/<screen>@<viewport>.png` and `verify/out/report.json`. Exit code 1 = at least one check failed.
On PCs that block Playwright's bundled Chromium ("spawn UNKNOWN") the runner falls back to installed Edge/Chrome.
CI (`.github/workflows/verify.yml`) runs the same thing on every PR and uploads the screenshots as an artifact.

## What is covered

| Screen | Steps |
|---|---|
| `hub` | open, "❓ วิธีเล่น" dialog, close, full-page shot |
| `spot` `run` `whack` `stack` | open from the hub, intro dialog, start, play for a moment |
| `party` | 2D party join screen, join, lobby canvas must not be blank |
| `party3d` | 3D room: models load, join dialog, join, WebGL canvas must not be blank |

Viewports: **desktop 1366×768 (primary: office PCs)**, mobile 390×844 (touch), tablet 768×1024 (touch).

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

Checks run after entrance animations settle. Full-page screenshots are only taken for the hub's last shot,
because a full-page capture resets touch emulation for later checks.

## Taste rubric (look at the screenshots; add a line whenever the owner corrects something)

1. Desktop 1366×768: the party buttons (🎉 เข้าห้องปาร์ตี้, 🧊 ห้อง 3D) and all four solo games are visible without scrolling.
2. The hub is at most ~1.5 screens tall on desktop (today: one screen).
3. Important buttons carry a text label on desktop — อันดับ, วิธีเล่น, หัวหน้ามา! (Esc), หน้าแรก. On narrow phones the
   header may drop to icons, each with an `aria-label`.
4. The boss key is always reachable and never covers game content (it lives in the sticky header).
5. Long explanations live behind "❓ วิธีเล่น", not on the hub itself.
6. Thai game titles never break mid-word on phones (one-column game list under 480 px).
