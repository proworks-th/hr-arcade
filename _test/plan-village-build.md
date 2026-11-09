# Build plan: Village v2.0 into the real game

9 Nov 2026 · design = `_test/gdd-village.md` (draft 2.2) · look and feel = `_test/village-proto.html`
Life skills (GDD §12) are a future update, not part of this plan.

## 0. Ground rules
- **Hidden until release.** The village tab only shows with `?village=1` (remembered in `store`) or `?test=1`. Real players see nothing until we switch the flag off in the release step.
- **Nothing old breaks.** Players who never open the village keep their condo, rooftop farm, coins and save exactly as today.
- **Tests never touch real Firebase**: every new screen runs under `?test=1` with `verify/mocks/`.
- **Each step lands on its own commit** with `python verify/run.py` passing, so any step can be reverted alone.

## 1. How the real game works today (what the village plugs into)
| Thing | Where | Notes for the village |
|---|---|---|
| Player save | `store('prog')` in localStorage → `Cloud` copies all `hra_*` keys to `rooms/_usave/{uid}` | Village state goes inside `prog` (`prog.vil`), so cloud save and "newest copy wins" cover it for free |
| Coins, XP, level | `Prog.give / Prog.award` (office.js) | Every price is paid with `Prog.give(-n, 0, 'house')` style calls so `Stats.econ` counts it (`out_house`, `out_pet`, …) |
| Game rewards | `Prog.award(game, score)` | Bricks hook in here (1–3 per round, cap 12/day) |
| Room size | `ROOM_SIZES` 12/15/18/22, `roomW(p.room)` | Unlock = `roomW == 22 && lv >= 12` |
| Farm | `farm.js`, state `prog.farm`, public copy `rooms/_farm/{key}`, friends' water `rooms/_farmw` | **Hard cap of 10 plots** in `saveFarm`, `Farm.n`, the balcony view (farm.js 99/106/176, online.js 173) → must allow 14/18/24 |
| Public profile | `rooms/_prof/{key}` (`saveProfile`) | Add `vh` (house stage) so the tower and village can show it |
| Live players | `rooms/_hub/on/{sid}` with `g` = view (`setPresence`, `watchOnline`) | Village uses `g:'village'` + target cell `x,y` + ride `r` (same idea as the prototype) |
| Home views | `Tower.setView('room' / 'tower')`, buttons `[data-view]` in index.html | Add a third view `'village'` |
| Server clock | `watchOffset` (`.info/serverTimeOffset`) | Build timers use server time, not the PC clock |
| DB rules | `rooms/$room` open (name ≤ 16 chars), `_usave` private | New room `rooms/_vil` fits without a rules change |

## 2. Data
**Private (inside `prog.vil`, cloud-saved):**
`{ lot, stage, end, bricks, brickDay, brickN, garden: 14|18|24, house: 1|2|3, pet: {coat, n, full, prem}, rides: {...}, ride }`

**Public (`rooms/_vil`):**
- `lots/{id}` = `{k, n, who, stage, end, g, h, t}` — claimed with a **transaction** so two people can never take the same lot
- `help/{id}/{day}/{helperKey}` = 1 — max 5 a day per house, one per helper; the owner's client applies −2 h each
- `jobs/{day}` = the 3 delivery jobs (made by the first client of the day, transaction)
- Garden: keep `rooms/_farm/{key}` and `rooms/_farmw` (same paths = friend watering keeps working), only lift the 10-plot cap

**Lots:** start with 2 clusters × 6 = 12 lots; a new cluster opens when 80% are taken (no empty ghost town, no waiting list).

## 3. Steps (each one = a commit, verify passes, can ship hidden)
| # | Step | What changes | Done when |
|---|---|---|---|
| 1 ✅ | **Groundwork** (done 9 Nov) | `village.js` (classic script like tower.js), Kenney tilemaps → `assets/village/` + licence, `?village=1` flag, third tab "🏘️ หมู่บ้าน", verify screen `village` | Empty village map renders on desktop/phone, all old screens still pass |
| 2 ✅ | **Village map + live players** (done 9 Nov, not pushed) | Map, roads, tower, board from the prototype; houses from `rooms/_vil/lots`; presence `g:'village'`; name tags (🟢 live, tap = house) | Two test tabs see each other walk |
| 3 ✅ | **Bricks from games** (done 9 Nov, not pushed) | `Prog.award` adds 1–3 🧱 (cap 12/day) to `prog.vil.bricks`; shown in the game result + village bar. **+ 3 bricks on the village roads a day** (owner, 9 Nov): same 3 spots for everyone (seeded by the date), walk over one to pick it up, each once (`prog.vil.fd/fp`) | Verify: a game round gives bricks, cap holds. Can go live early (bricks collect before launch) |
| 4 ✅ | **Unlock + reserve + build** (done 9 Nov, not pushed) | Lock card ("ห้อง 18/22 · Lv 12 ✓"), reserve via transaction, stages 2–4 with server-time timers, help build (no paid speed-up), move-in party → feed message | Full build path works in test mode with fast timers (`?vilFast=1` = minutes instead of hours) |
| 5 ✅ | **Farm moves in** (done 9 Nov, not pushed) | `prog.vil.g` set at the move-in party → `Farm.n` = garden size (`Farm.home()`); cap 10 → 24 in farm.js + online.js; rooftop farm closes at move-in; crops/basket/book/sprinkler carry over; garden 18/24 upgrades; tower balcony shows "ย้ายไปบ้านแล้ว". Also done: farm screen = "🏡 สวนข้างบ้าน" with a yard background and rows of 8; the village map draws everyone's real crops in their garden; house card → "ไปที่สวน" (own) / "ไปดูสวน · รดน้ำช่วย" (friend); garden size goes to the lot record (`Village.setGarden`) | Move-in keeps every crop and timer; friends can still water |
| 6 ✅ | **Pets** (done 9 Nov, not pushed — ships with step 7 in the next update) | Bar button 🐾 → card: adopt a cat for 6,000 (first day's food included), food 150/400 (1 meal = 1 day, can't feed while more than half full), first meal of the day brings 50 🪙, premium = party hat + trick + digs up a vegetable, dye 300 (8 coats), rename free. Hungry = naps at your house (or the tower door). Others see it: presence `pe`, lot record `pet` (napping at home when the owner is away) | Pet follows, sleeps when hungry, never dies |
| 7 ✅ | **Walking extras** (done 9 Nov, ships with step 6) | Board deliveries (canteen +30%): 3 jobs a day seeded by the date, to the 3 plaza NPCs (ป้าแม่ครัว, ลุงยาม, น้องฝึกงาน) or a moved-in house (never your own), once each per player (`prog.vil.jd/jp`), `in_delivery`. Road pickups: 4 extras after the 3 bricks (2 × 15 🪙, 1 vegetable, 🍀 40 🪙; `in_pickup`, `pickup_veg`) | Jobs are the same for everyone that day |
| 8 | **Release** | Flag off, "มีอะไรใหม่" popup once, feed message, `Stats.econ` keys `out_house/out_pet/out_dye/in_delivery/in_pickup`, CREDITS updated | Owner plays it on the live site first with `?village=1`, then everyone |

**Shipping (owner, 9 Nov 2026):** steps 1–5 pushed; the village tab opened to everyone the same day (no flag needed, `?village=0` hides it). Still to do from step 8: the "มีอะไรใหม่" popup, launch feed message, CREDITS. Pets (step 6) were pushed by mistake and taken back off (74a8ca6); the work is on the local branch `village-pets` and ships in the next update with step 7. Step 8 leftovers done 9 Nov (news popup 82ccd4b, launch feed post + credits f85bd73, both pushed). Pets brought back onto main with step 7 (local until the owner says push).

**Later (v2.1):** bike/scooter, plaza party, gift boxes, house Lv 2/3, dogs (to be drawn), seasonal decor.

## 4. Risks and how we handle them
| Risk | Plan |
|---|---|
| Two players reserve the same lot | Firebase transaction on `lots/{id}`; the loser gets "มีคนจองแล้ว" and keeps their coins |
| PC clock changed to skip build time | Timers use `serverTimeOffset` |
| Losing coins on a failed write | Take coins only after the transaction succeeds |
| Farm migration loses crops | Move-in copies `prog.farm` as is (only the plot count changes); test with a save that has growing, ripe and mutated crops |
| Old browsers (not reloaded) still cap farms at 10 | They only show the first 10 plots of a house garden; harmless; Pages refreshes within ~10 min |
| Coins are trusted on the client (like today) | Same as the rest of the game; stats watch for odd jumps |
| Phone performance | Draw the static map once to an offscreen canvas (prototype already does) |

## 5. Still open (decide before the step that needs it)
Decided 9 Nov: **no paid speed-up**, **pet 6,000**. Checked 9 Nov (GDD §2b): ×2 game pay ≈ +17% income, house still lands in 2–4 weeks, so 50,000 stays.
1. Light players (only ~4 browsers at Lv 10–14) can't afford a house → parked, decide later (before release).
2. Re-check prices with a full week of ×2 stats (from 16 Nov, before release).

## 6. Test checklist (each step adds its own lines to `verify/run.py`)
- [ ] All existing screens pass on desktop / phone / tablet.
- [ ] Village hidden without `?village=1` / `?test=1`.
- [x] Locked player sees what's missing (room size, level).
- [x] Reserve → build → help → move-in with fast timers; coins and bricks go down by the right amounts.
- [x] Reserve race: the lot was taken a moment ago but still looks empty here → the transaction refuses, coins kept (tested in one tab with a stale lot; same transaction path as two tabs).
- [x] Road bricks: 3 a day, each picked up once.
- [x] Move-in with growing / ripe crops → all still there (same plots array, same timers). Friend watering uses the same plot numbers; plots 11–24 are not yet tested with a second player.
- [x] Garden 18: coins taken, lot record and public farm copy show 18.
- [ ] Cloud save on another device shows the same house stage.
- [ ] Pet hungry → sleeps at home; fed → follows; dye and rename stick after reload.
- [ ] Nothing reaches the real Firebase in tests.
