# _test: design prototypes (not part of the live game)

This folder is gitignored; the files below were force-added so work can continue on another computer.
Add new files with `git add -f _test/<file>`; never `git add -A`.

## Village (หมู่บ้านพนักงาน)
- `gdd-village.md` - design doc, draft 2.2: real economy stats, house 50,000, pets, consumables, deliveries, clusters
- `plan-village-build.md` - build plan for the real game: 8 hidden steps, data, risks, open decisions, test checklist (waiting for owner OK)
- `village-proto.html` - playable prototype (Kenney Tiny Town + Tiny Farm, LimeZu characters, Elthen cat, live players with ?test=1)
- `starter-house-proto.html` - starter house prototype (10 Nov): farm moves at จองที่ดิน, move in at a small cottage, roof/wall colours (tinted Tiny Town tiles) + front extras; `starter-house-mockup.png` = first sketch
- `basket-proto.html` - farm basket prototype (10 Nov): pink button only harvests/plants/waters, per-crop quantity picker + one bulk sell bar, "pick all" keeps what village deliveries and the house stage still need, warning before selling those
- `wireframe-village.html` - early gray wireframe
- `village-room.png` - house interior rendered by the real `drawRoom`

Run: from the repo root `python -m http.server 8767`, open http://localhost:8767/_test/village-proto.html
Live players: open `village-proto.html?test=1&name=A&who=adam` and `?test=1&name=B&who=alex` in two tabs of the same browser (mock DB).
Screenshots: `python _test/village-shots-a.py` / `-b.py` (Playwright, channel chrome) -> `_test/village-*.png`

Status (9 Nov 2026), GDD draft 2.2:
- Economy re-checked with 5–8 Nov stats; house 50,000 (10k/10k/15k/10k/5k), bike 7,500, scooter 20,000.
- Real farm crops and prices (ผักสลัด, แครอท, มะเขือเทศ, ข้าวโพด; sell + seed), deliveries = canteen price +30%.
- Build progress from hours left; caps: 5 helps/house/day, 20 🪙/day from watering friends.
- Move-in: rooftop farm closes, farm items carry over, friend watering stays.
- Live players like the hub room (test mode only in the prototype).
- Name tags over everyone, drawn on top without overlapping: ⭐ you (+ pet name when beside you), 🟢 live players, neighbours (tap = their house). Pet coat colours (dye 300) + free rename.
- Pet: Elthen cat (assets/pixel/elthen_cat.png, credited in assets/pixel/CREDITS.txt); collar + party hat drawn in code. Dogs: to be drawn later.
- Live game: mini games pay ×2 coins since 9 Nov (GAME_PAY in office.js).
Art rule: CC0 or written permission only. Decided 9 Nov: bricks from games only; unlock needs room 22 AND Lv 12. Decided 9 Nov too: no paid speed-up, pet 6,000; ×2 game pay checked (GDD §2b), house stays 50,000. Parked: light players. Life skills = future plan (GDD §12).

## Other mockups
`mockup-*.html`, `wireframe-office.html`, `wireframes.html`, `mock-*.js` (offline mocks for the mockups)

## Third-party
`dl-tinytown/`, `dl-tinyfarm/`: Kenney (CC0), only License.txt + Tilemap committed.
