# _test: design prototypes (not part of the live game)

This folder is gitignored; the files below were force-added so work can continue on another computer.
Add new files with `git add -f _test/<file>`; never `git add -A`.

## Village (หมู่บ้านพนักงาน)
- `gdd-village.md` - design doc, draft 2: real economy stats, ×5 prices, pets, consumables, deliveries, clusters
- `village-proto.html` - playable prototype (Kenney Tiny Town + Tiny Farm, LimeZu characters, 2dPig dog/cat)
- `wireframe-village.html` - early gray wireframe
- `village-room.png` - house interior rendered by the real `drawRoom`

Run: from the repo root `python -m http.server 8767`, open http://localhost:8767/_test/village-proto.html
Live players: open `village-proto.html?test=1&name=A&who=adam` and `?test=1&name=B&who=alex` in two tabs of the same browser (mock DB).
Screenshots: `python _test/village-shots-a.py` / `-b.py` (Playwright, channel chrome) -> `_test/village-*.png`

Status (6 Nov 2026): prices ×5, house raised to 50,000 on 9 Nov, pet dog + food 150/400, street cat, road pickups,
fertiliser, bike 7,500 / scooter 20,000, board deliveries (3 jobs/day, canteen price +30%).
Pet: Elthen cat (assets/pixel/elthen_cat.png, credited in assets/pixel/CREDITS.txt); collar + party hat drawn in code. Dogs: to be drawn later.
use CC0 art or get written permission. Open questions are at the end of the GDD.

## Other mockups
`mockup-*.html`, `wireframe-office.html`, `wireframes.html`, `mock-*.js` (offline mocks for the mockups)

## Third-party
`dl-tinytown/`, `dl-tinyfarm/`: Kenney (CC0), only License.txt + Tilemap committed.
