# PRD: Phone-first play

Status: draft v3 for owner sign-off (15 Nov 2026). Owner: Phol.
v2 corrected the findings against the code and added the iPhone risks; v3 records the owner's answers and adds phone
controls as the core of the project (changes listed in section 14).
Companion docs: `VERIFY.md` (visual checks), `prd-skills-dungeon.md` (dungeon and skills), `gdd-dungeon.md`.
This PRD covers how the game runs and feels on a phone. Rule changes (game of the day, coworker traces, the
dungeon's near-miss reward) are listed in section 11 and get their own GDD once this is done.

---

## 1. Summary

HR Arcade was designed and verified for office PCs (1366×768). Play happens mostly on phones in 1–5 minute breaks.
This project makes the phone the primary target. **Easy control is the core** (owner, 15 Nov 2026): every game is
played in portrait with one or two thumbs, with its buttons where the thumbs already are. Around that: no browser zoom
or copy pop-ups anywhere, a play screen that fills the phone without changing what the player can see coming, fast
loading, and one tidy look for icons and text.
Desktop keeps working as the second target.

## 2. Problem

Owner's report (15 Nov 2026), on an iPhone:

- The page zooms in and out during play, and the copy button appears on a long press.
- Some UI and text do not look good.
- Buttons should be arranged for phone players: easy control comes first.

Findings. "Code" rows were checked in the source on 15 Nov. "Simulated" rows come from a 390×844 viewport in test mode
with the CPU slowed 4×; those numbers are relative, not real-device.

| Finding                      | Source    | Detail                                                                                                  |
|------------------------------|-----------|---------------------------------------------------------------------------------------------------------|
| Zoom and copy are possible   | Code      | Text selection and the long-press menu are off only inside game boxes (`.game`, `.g2box`, `.nohold`); pinch and double-tap zoom are not blocked anywhere |
| Not the cause: input zoom    | Code      | Safari zooms on focus into a text field under 16 px. Every text field is 16–17 px, so the zoom seen is pinch or double-tap |
| Dungeon playfield is small   | Simulated | A bit over half the screen; the header and stats card take the top quarter                               |
| Dungeon is the slowest game  | Simulated | 34 frames per second at the start of B1; whack and stack hold 60, the runner 52                          |
| Hub redraws while idle       | Simulated | 43 frames per second with nothing happening                                                              |
| Everything loads up front    | Code      | 24 script tags (23 local, about 861 KB) before a game is picked; images and fonts not yet measured        |
| Keyboard hints on touch      | Code      | Dungeon intro says "WASD" and "Shift"; the village hotbar shows keys 1–6                                 |
| Cut-off text                 | Simulated | The name field and the house lock text on the first screen                                               |
| Emoji as icons               | Simulated | Nine unlabeled system-emoji buttons on the first screen, on top of pixel art                             |
| Small text                   | Simulated | None under 12 px on the first screen at 414 px wide                                                      |
| Verify gaps                  | Code      | Dungeon, farm, village and tower screens exist, but desktop is the primary viewport, the phone size is 390×844 (not the iPhone 11), and there is no frame-rate check |
| Controls built for desktop   | Code      | Touch buttons sit where the desktop layout put them (under or beside the game, e.g. the party games' touch row under the stage); the dungeon's dodge button is fixed on the right with no left-hand option |
| No real-device numbers       | —         | Every frame rate above is simulated; nothing yet measures the owner's iPhone                             |

## 3. Goals and success metrics

Reference device: iPhone 11 (414×896, Safari), the weakest phone in the office as far as the owner knows. Measured
with Low Power Mode off (it caps every page at 30 frames per second).

| Goal                          | Metric                                                         | Target                           |
|-------------------------------|----------------------------------------------------------------|----------------------------------|
| The browser stays out of play | Zoom, text selection or copy menu during play and on map views | Never                            |
| The game fills the phone      | Share of the screen used by the playfield during a game        | At least 80%                     |
| Same view of danger           | World area visible in the dungeon, vs today's desktop view     | At least as wide in both directions, or every warned spawn off-screen has an edge marker |
| Smooth play                   | Frames per second in every arcade game on the iPhone 11        | 55 or more, incl. the dungeon at 60 monsters |
| Still fair when slow          | Game speed at 30 frames per second (Low Power Mode)            | Same speed and damage as at 60   |
| Fast start                    | Time from opening the site to a usable first screen            | Under 2 s on office Wi-Fi        |
| Quick to play                 | Taps from the first screen to playing a game                   | 2                                |
| Easy control                  | Game controls inside the thumb zone (bottom 40% of the screen) and at least 48 px | Every game |
| Nothing mis-tapped            | Owner plays each game on the iPhone 11 without a missed or wrong tap from button placement | Every game |
| Reads as one game             | Keyboard hints on touch, cut-off text, unlabeled emoji buttons | 0 of each                        |
| Changes stay verified         | Screens covered by verify at phone size                        | All live screens                 |

## 4. Users and context

- One Thai office, 8–15 players a day, phones first (portrait only, owner 15 Nov 2026), office PCs second.
- Sessions of 1–5 minutes. The village stays the first screen (owner, 15 Nov 2026).
- **Boss key:** the yellow button in the header (Esc on a keyboard). It freezes the game and covers it with a fake
  spreadsheet. It is a desktop feature and is hidden on touch devices (owner, 15 Nov 2026). On a phone, locking the
  screen already shows the pause screen (`visibilitychange`).

## 5. Owner rules that apply

1. Locking the phone or switching apps pauses the game, and coming back continues it. If the tab is closed (by the
   player or by iOS), the run counts as lost and the player starts again from the spawn (owner, 15 Nov 2026; see 7.6).
2. Warnings are honest: a different playfield shape must not hide or shorten any attack or spawn warning.
3. Cozy lo-fi pixel art everywhere. No decorative emoji, no gradients, aligned text, one font set.
4. Static site, classic scripts, no build step, `?v=N` cache bumps. Thai UI.

## 6. Scope and phases

| Phase | What                                                                                       | Changes game code   |
|-------|--------------------------------------------------------------------------------------------|---------------------|
| 0     | Baseline: phone-first verify, a frame-rate check, a frame counter for the real iPhone        | Test code + one overlay |
| 1     | Browser behaviour: no zoom or selection during play and on map views, safe areas            | CSS and one handler |
| 2     | Play screen and controls: full-screen portrait game mode, thumb-zone controls for every game, dungeon view kept fair, touch-only hints | Yes |
| 3     | Look: pixel icons with labels, text fit, font check                                        | Yes                 |
| 4     | Speed: load games on open, stop the idle redraw, dungeon at 60 monsters                     | Yes                 |

Out of scope: economy, new games, the extension map, rule changes (section 11), installing to the home screen
(section 9, question 4).

No decisions are blocking Phase 2.

## 7. Requirements

### 7.1 Baseline (Phase 0)

- `verify/run.py`: mobile becomes the primary viewport, sized to the iPhone 11 (414×896); keep 390×844 as the
  narrow case. The dungeon, farm, village and tower screens already exist; run them at both phone sizes.
- Add a frame-rate check per game screen (average and worst frame over 5 s, with the CPU slowed).
- Add a frame counter the owner can open on the real iPhone (`?fps=1`): average and worst frame over the last 5 s
  in a corner, readable in a screenshot. Off by default, never shown to players.
- Update `VERIFY.md` and the taste rubric to say phone first.
- Record today's numbers, simulated and from the real iPhone, as the "before" for every later phase.

### 7.2 Browser behaviour (Phase 1)

- The whole site, every screen (owner, 15 Nov 2026): no pinch zoom, no double-tap zoom, no text selection, no
  long-press menu, no tap highlight. Text inputs and chat text opt back in to selection.
- Safari on iPhone ignores the viewport's zoom lock, so blocking zoom needs `touch-action: manipulation` on the page
  plus a `gesturestart` handler.
- With zoom gone, text size is the only way to read: no UI text under 12 px on a phone, and text pages (patch notes,
  stats, credits) use at least 14 px body text.
- Text fields stay at 16 px or larger. Blocking pinch does not stop Safari's focus zoom; only the font size does.
- Images and canvases: no long-press "save image" sheet.
- Respect the notch and the home bar (`env(safe-area-inset-*)`) on every fixed bar and on the dodge button.
- No pull-to-refresh or page bounce while a game is open.

### 7.3 Play screen (Phase 2)

- On touch devices, starting any game enters a full-screen game mode built with CSS (fixed to the viewport, sized
  with `dvh` so the Safari bars don't cut it). The browser's own full-screen feature does not exist on iPhone, so the
  village's full-screen button must use the same CSS mode there.
- In game mode the page header is replaced by one exit button. The boss key is hidden on touch devices (needs owner
  OK, section 8).
- **Portrait only** (owner, 15 Nov 2026). Turning the phone sideways shows a "turn your phone upright" card; the game
  stays paused behind it.
- **Dungeon view stays fair in portrait.** A tall screen shows less of the map to the left and right, so monsters
  could spawn off-screen and their warnings would never be seen. Every warned spawn and attack outside the view gets
  an edge marker for its full warning time, and the camera zooms out until at least 7 tiles are visible to each side
  of the player.
- Dungeon HUD: hearts, floor, level and kill count are drawn over the top edge of the map; the map button and the
  leave button move into a small menu; the weapon row sits above the bottom edge, clear of the dodge button.
- Controls: see 7.4. Menus, cards and buttons are reachable with one thumb.
- **Play button.** On phones, a "play" button sits at the bottom of the village screen at all times, in the thumb
  zone. Tap it, pick a game from the list, and the game starts: 2 taps. The arcade building in the village stays as
  a second way in.
- Hints match the device: touch devices never see key names (dungeon intro, village hotbar numbers).
- When chat is focused in game mode, the input stays above the on-screen keyboard (`visualViewport`).
- Leaving game mode returns to exactly where the player was.

### 7.4 Phone controls (Phase 2, the core)

Rules for every game:

- **Thumb zone.** Everything the player presses during play sits in the bottom 40% of the screen. The top of the
  screen is for reading only (score, hearts, timer).
- **Size and spacing.** Every control is at least 48 px, with at least 12 px between controls, so a thumb never
  presses the wrong one.
- **Tap anywhere when there is one action.** Games with a single action (stack, stamp, runner jump, slack hold) take
  the press anywhere on the playfield, not only on a button.
- **Two-action games** put the actions in the two lower corners, one per thumb.
- **Moving.** Games where you walk (dungeon, village, party room) use a floating stick: put your thumb down anywhere
  on the left or lower half and drag. The stick appears under the thumb, and nothing needs aiming at.
- **Adjustable in settings** (owner, 15 Nov 2026). The site has no settings screen today, so this adds one:
  "ตั้งค่า", opened from the player card on the first screen and from the pause screen during a game. It holds:
  - **Hand:** right (default: stick left, action buttons right) or left (mirrored).
  - **Button size:** normal or large (+25% on every in-game control, gaps kept).
  - Changes show at once in a small preview of the dungeon controls, and are remembered on the device (also in the
    cloud save, so a new phone signed in to the same Google account gets them).
- **Feedback.** Every press shows a visible press state at once (no waiting for the game to react).
- **Nothing important under the home bar or notch** (safe areas, 7.2).

Per game (first pass; the owner confirms each on the iPhone 11):

| Game                 | Phone control                                                                 |
|----------------------|-------------------------------------------------------------------------------|
| ดันเจี้ยนใต้ตึก        | Floating stick on the left half; dodge in the lower right (swaps with the hand setting); map and leave in the top menu; level-up cards in the lower half |
| วิ่งไปตอกบัตร          | Tap anywhere = jump; swipe down or a lower-left button = duck                  |
| ซ้อนแฟ้มเสียดฟ้า        | Tap anywhere                                                                  |
| ปั๊มตรารัวๆ            | Tap anywhere                                                                  |
| แอบเล่นมือถือ          | Hold anywhere                                                                 |
| Printer Tetris       | Lower-left: left / right; lower-right: rotate / drop; swipe as a second way    |
| ขบวนไปกินข้าว          | Swipe to turn, or the floating stick                                          |
| สายด่วนถล่มโต๊ะ         | Tap the targets (the board sits in the lower two thirds)                      |
| บาริสต้าพักเที่ยง        | Ingredient buttons in two rows at the bottom; the order card at the top         |
| ปากระดาษลงถัง          | Drag back and release from the lower half                                     |
| จับผิดภาพ              | Tap the picture; the hint and give-up buttons at the bottom                    |
| โรงหลอมปริซึม          | Tap the cells; the undo and restart buttons at the bottom                       |
| Party room games     | Their one or two buttons in the lower corners                                 |

### 7.5 Look (Phase 3)

- Replace system-emoji icons on buttons with pixel icons from the existing art packs; every icon button has a
  text label or, on narrow phones, an `aria-label`.
- No cut-off text on the first screen at 390 px wide (name field, house lock text, status chips).
- One font set: check every screen, including the fake spreadsheet (which keeps its own office font on purpose).
- The owner marks up screenshots of anything else that looks wrong; each fix adds a line to the taste rubric.

### 7.6 Speed (Phase 4)

- Measure first: bytes and requests by type (scripts, images, fonts, Firebase) on the first screen, then decide
  what to defer. The 3D assets already load only on `party3d.html`.
- Load a game's scripts when the game is opened, by adding classic script tags at that moment (no build step,
  `?v=N` kept). The intro card shows at once; its start button waits until the scripts have loaded.
- The hub and village redraw only when something on screen changes or moves.
- Profile the dungeon with 60 monsters alive on the iPhone 11 and fix the top costs until it meets the target.
- Every game must run at the same speed at 30 and 60 frames per second (movement, timers and warnings use elapsed
  time, not frame counts). The dungeon already does; check the others.

### 7.7 Leaving mid-game

- Locking the phone or switching apps: the game pauses (as today) and continues when the player comes back.
- Tab closed, by the player or by iOS in the background: the run counts as lost and the player starts again from the
  spawn (owner, 15 Nov 2026). In the dungeon that is B1, or today's checkpoint if one was reached (checkpoints are
  saved the moment a boss falls, so they survive). Nothing from the lost run is paid: a closing tab can't be relied on
  to finish a payout, and paying only sometimes would be unfair.
- No new saving code is needed. Verify checks that a closed tab leaves no half-paid run behind.

### 7.8 Sound

- Sound starts on the first tap (iOS needs a user gesture). Check that the ringer switch behaviour is acceptable:
  Safari may mute Web Audio when the phone is on silent.

## 8. Decisions log

| Date        | Decision                                                                   | By    |
|-------------|----------------------------------------------------------------------------|-------|
| 15 Nov 2026 | Phones are the primary target; desktop is second                            | Owner |
| 15 Nov 2026 | Reference device is the iPhone 11                                           | Owner |
| 15 Nov 2026 | The village stays the first screen                                          | Owner |
| 15 Nov 2026 | Easy control is the core: phone controls rearranged for every game          | Owner |
| 15 Nov 2026 | Portrait only on phones                                                     | Owner |
| 15 Nov 2026 | Hide the boss key on touch devices                                          | Owner |
| 15 Nov 2026 | Block zoom and selection for the whole site                                 | Owner |
| 15 Nov 2026 | A closed tab counts as a lost run; start again from the spawn               | Owner |
| 15 Nov 2026 | A "play" button always at the bottom of the village screen (2 taps to a game) | Owner |
| 15 Nov 2026 | Hand side and button size are adjustable in a new settings screen           | Owner |
| 15 Nov 2026 | This is a PRD, not a GDD: it changes how the game runs, not its rules       | Draft |

## 9. Open questions

1. Is there an Android phone in the office that is slower than the iPhone 11?
2. Decided (owner, 15 Nov 2026): option (a), a "play" button always visible at the bottom of the village screen.
3. Which screens look worst to the owner? Screenshots with marks decide the Phase 3 list.
4. Should the site be installable to the home screen? It removes the Safari bars, but on iPhone an installed web
   app has its own storage, separate from Safari: guest players would start over, and Google sign-in pop-ups are
   unreliable there. Out of scope until tested with a guest account and a Google account.
5. Decided (owner, 15 Nov 2026): both are adjustable in a new settings screen (7.4).

## 10. Measuring on the real phone

The owner opens the site on the iPhone 11 with `?fps=1`, plays each game for about 30 seconds and screenshots the
counter. Low Power Mode off. Those screenshots are the "before" for Phase 0 and the pass check for Phase 4. Agents
work from the simulated numbers in between.

## 11. Later (own GDD)

- Game of the day: one ranked board for the whole office each day.
- Coworker traces in the daily dungeon: where each person fainted, and the build that went deepest.
- Dungeon feel: a short pause on hits, a music loop, a gem reward for a near miss on a warned attack.

## 12. Risks

| Risk                                                       | Mitigation                                                     |
|------------------------------------------------------------|----------------------------------------------------------------|
| Simulated numbers differ from a real iPhone                 | The `?fps=1` counter; the owner checks each phase before merge   |
| Low Power Mode caps at 30 frames per second                 | Measure with it off; games stay fair at 30 (7.6)                 |
| A portrait dungeon hides spawns at the sides                | Edge markers and a 7-tile minimum view (7.3)                 |
| iOS closes a background tab and players lose runs they didn't choose to end | Owner's rule (7.7); the pause screen on lock keeps short breaks safe; watch for complaints |
| Blocking zoom everywhere hurts players who need larger text | 12 px floor, 14 px on text pages; a text-size setting if anyone asks |
| Loading games on open adds a wait at game start             | Show the intro card at once; start button waits for the scripts  |
| Game mode breaks desktop layouts                            | Game mode is touch-only; verify still runs desktop               |
| Installing to the home screen splits saves                  | Out of scope until tested (question 4)                           |

## 13. Acceptance criteria

- Phase 0: verify runs phone first at 414×896 and 390×844, covers every live screen, reports frame rates; the owner
  has sent `?fps=1` screenshots from the iPhone 11.
- Phase 1: on the iPhone 11, ten minutes across the hub, village, dungeon and text pages with no zoom, no selection
  and no copy menu.
- Phase 2: in portrait, the dungeon playfield covers at least 80% of the screen; no warned spawn or attack happens
  unseen (in view or marked at the edge); every game's controls are in the thumb zone and at least 48 px; the owner
  plays each game on the iPhone 11 without a mis-tap, with both hand settings and both button sizes.
- Phase 3: zero cut-off texts and zero unlabeled emoji buttons in verify at 390 px.
- Phase 4: targets in section 3 met on the iPhone 11.

## 14. Changes in v3

- Owner's answers recorded: portrait only, boss key hidden on touch, zoom and selection blocked for the whole site,
  a closed tab is a lost run (back to the spawn, nothing paid). The run-saving requirement is removed.
- New core section 7.4, phone controls: thumb zone, 48 px, tap-anywhere for one-action games, floating stick,
  hand swap and button size settings, and a per-game control table.
- Dungeon view in portrait: edge markers plus a minimum of 7 tiles each side.
- Open question 2 decided: a "play" button on the village screen (7.3). Question 5 decided: hand side and button size in a new settings screen (7.4).

## 15. Changes from v1 (in v2)

- Findings now say where each comes from (code or simulated). Verify gaps corrected: the dungeon, farm, village and
  tower screens already exist. Script count corrected to what the source shows. Input focus zoom ruled out.
- New metrics: same view of danger in the dungeon, still fair at 30 frames per second.
- New requirements: `?fps=1` real-device counter (7.1, section 10); zoom blocked only during play and on map views
  (7.2); dungeon view kept fair in portrait (7.3); one thumb for menus, two for two-input games (7.3); chat above
  the keyboard (7.3); measure bytes by type before deferring (7.5); run kept on `pagehide` (7.6); sound (7.7).
- New open questions: portrait or landscape (5), losing short rounds (6); home-screen install moved out of scope
  with the storage risk spelled out (4).
- Decisions log: two proposals marked as needing owner OK.
