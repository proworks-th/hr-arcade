# GDD: หมู่บ้านพนักงาน (Village)

Draft 2.2 · 9 Nov 2026 (stats re-check, delivery pay, help progress) · prototype: `_test/village-proto.html`

## 1. One line
After the biggest condo room, you save up, reserve land, and build your own house + garden over 5 stages. Neighbours are coworkers. The village is where you live; the office tower is where you work and play (games, canteen, missions).

## 2. Real economy (re-checked 9 Nov 2026 from rooms/_stat, full days 5–8 Nov; 7–8 Nov = weekend)
"Active" = browsers at Lv 5+ that day (8–15 a day). One person can have 2 browsers, so treat these as rough.

| Per active player per day | 5 Nov | 6 Nov | 7 Nov | 8 Nov |
|---|---|---|---|---|
| Earned (gross) | 3,220 | 2,796 | 1,895 | 2,048 |
| Spent | 1,651 | 1,846 | 935 | 681 |
| Kept (net) | 1,569 | 950 | 960 | 1,367 |
| Farm share of income (sell + canteen) | 67% | 76% | 84% | 84% |
| Games share | 26% | 16% | 9% | 10% |
| Median coins in hand | 2,617 | 5,868 | 7,112 | 10,628 |

What changed since draft 2 (stats of 4–6 Nov):
- **Canteen is now the income.** Since repeatable canteen orders, 8 Nov income was canteen 83%, plain selling 1%. Canteen pays ~38 🪙 per item on average (sell ×1.2, weather mutations ×1.5–5, +40 per filled order), not the base 1.2× of the crop price.
- **Spending is drying up.** Furniture/wardrobe spending fell from ~6,000/day to 0 on 8 Nov; only seeds are left. Coins pile up: the median player now holds ~10,600, the top ones 11,000–18,000.
- **Earning per day went down** (farm sell prices cut 5 Nov), but because nothing is spent, savings did not.

Saving per player (change in coins in hand, same browser, 6–8 Nov):
| Player | Level | Coins in hand 9 Nov | Kept per day |
|---|---|---|---|
| Top | 35–39 | 11,800–18,200 | ~2,400–3,000 |
| Regular | 20–27 | 6,700–12,800 | ~1,500 |
| Light | 10–13 | 500–1,300 | ~100–400 |

### 2b. Who are the light players, and what ×2 game pay does (checked 9 Nov from the same stats)
Browsers at Lv 5+ seen 4–9 Nov (latest record each; one person may have 2 browsers):
| Level | Browsers | Coins in hand |
|---|---|---|
| 30+ | 5 | 9,500–19,000 |
| 20–29 | 8 | 5,200–13,100 |
| 10–14 (light) | 4 | 730–1,900 |
Plus ~3 new players a day under Lv 10 with almost no coins. So light players are about **1 in 4** of the regular crowd.

Mini games pay ×2 coins since 9 Nov 08:48 (XP unchanged). Games were 17% of all income on 5–8 Nov (26% / 16% / 10% / 11%). If people play the same amount, ×2 adds that 17% again: about **+300–500 🪙 a day per player on weekdays, +200 on weekends**.
| Player | Kept/day before | Kept/day with ×2 (estimate) | House 50,000 (from coins in hand) |
|---|---|---|---|
| Top | ~2,700 | ~3,100 | ~11 days (was ~13) |
| Regular | ~1,500 | ~1,850 | ~23 days (was ~28) |
| Light | ~250 | ~300–350 | still months |
Still inside the 2–4 week target, so **house 50,000 stays**. Light players get the least out of ×2 (they play less), so ×2 doesn't fix them. Bricks also come from games, so ×2 makes games more worth playing either way. Re-check once a full week of ×2 stats exists (from 16 Nov).

## 3. Target pace (target 2–4 weeks for a regular player)
Players start the village with their savings, so pace = (house − coins in hand) ÷ kept per day, but never under ~5 days (96 h of build timers, 60 🧱 at 12 a day).

| Player | In hand | Kept/day | House 37,500 | House 50,000 |
|---|---|---|---|---|
| Top | ~15,000 | ~2,700 | **~8 days** | ~13 days |
| Regular | ~8,000 | ~1,500 | ~20 days | ~28 days |
| Light | ~1,000 | ~250 | ~5 months | ~7 months |

**Decided (9 Nov): 50,000.** At 37,500 the top players finish in about a week, faster than planned, because of their savings. Regulars land in the 2–4 week window either way. Light players can't realistically get a house at either price: they need a cheaper first step (a small house, or the garden stage on its own) or more catch-up income.
When the village goes live, the extra consumable sinks (§7, ~300–600/day) slow everyone down by ~20–40%.
Delivery pay (§8) must follow the real canteen price per item (with mutation), not the base crop price.

## 4. House build — total 50,000 🪙 (raised from 37,500 on 9 Nov 2026, see §3) + 60 🧱 + 30 🥬
| # | Stage | Cost | Build time |
|---|---|---|---|
| 1 | 🪧 Reserve land | 10,000 | instant |
| 2 | 🧱 Foundation | 10,000 + 20 🧱 | 24 h |
| 3 | 🏠 Walls + roof | 15,000 + 40 🧱 | 48 h |
| 4 | 🌳 Garden (14 plots) | 10,000 + 30 🥬 | 24 h |
| 5 | 🎉 Move-in party | 5,000 | instant |
- Help build: −2 h, helper +5 🪙, max 5 helps/house/day. Progress bar = 1 − hours left ÷ stage hours (so 2 h is 8% of a 24 h stage, 4% of 48 h). **No paid speed-up** (decided 9 Nov): coins can't skip build time; only coworkers' help makes it faster, so helping stays worth something.
- Bricks 🧱: from games, 1–3 per round, cap 12/day (keeps the office/game room daily) **+ 3 on the village roads a day** (owner, 9 Nov 2026): same spots for everyone that day, walk over one to pick it up. Max 15/day → the 60 bricks take about 4 days at full pace.
- Card wording (step 4): the cost and "ขาดอีก …" are always shown, so a player knows what to go and get; the move-in card says the farm moves over in the next update (step 5).

### Moving in: the farm goes with you (decided 9 Nov 2026)
One player = one garden. At the move-in party:
1. **The rooftop farm closes.** Your condo plots (4–10) are gone; the house garden (14, later 18/24) replaces them, so moving is always an upgrade.
2. **Everything carries over:** crops still growing (same timers, same weather mutation), the basket, the vegetable book (สมุดผัก), the sprinkler, your signature fruit, and the farm stats.
3. **Friend watering stays the same** at the house garden (−15% grow time each, max 3 friends per crop, helper +2 🪙, max 20 🪙/day). Watering is the main way people help each other, so it must keep working. Tapping a house in the village or its balcony in the tower opens the same garden.
4. Players still in the condo keep their rooftop farm as it is.

## 5. After the house (×5)
| Upgrade | Cost | Gives |
|---|---|---|
| Garden 18 plots | 10,000 | +4 plots |
| Garden 24 plots | 20,000 + 40 🧱 | +6 plots |
| House Lv 2 (second floor) | 20,000 + 60 🧱 | bedroom/office room |
| House Lv 3 (pavilion/pool) | 30,000 + 80 🧱 | street decoration, 🏅 |
Garden expansions are priced high on purpose: the farm is already 70% of income, so more plots = more coins. At today's farm rates 18 plots pays back in ~1–2 weeks; watch it.

## 6. Getting around (×4–5)
| Item | Cost | Effect |
|---|---|---|
| 🚲 Bicycle | 7,500 | walk speed ×1.6 + style |
| 🛵 Scooter | 20,000 | ×2.2 + style, colour variants 3,000 each |
No fuel or upkeep: one-time luxury, no nickel-and-diming.

## 7. Consumables (recurring coin sinks)
Rule: nothing punishes you for skipping. A consumable makes things nicer, it never takes something away.

| Consumable | Cost | What it does | Sink per active player |
|---|---|---|---|
| 🐾 Pet food (basic) | 150 / day | pet follows you, wags, 1 free road pickup a day (~50 🪙 value) | ~150/day |
| 🐾 Pet food (premium) | 400 / day | + a trick and a hat, digs up a random seed | ~400/day |
| 🧪 Fertiliser | 30% of the crop's sell price per plot | that plot grows ×2 faster | scales with garden size |
| 🎁 Gift box (mailbox) | 200 / 500 / 1,000 | a coworker gets a surprise item | social |
| 🎉 Plaza party | 5,000 | 30 min party at your cluster's plaza; everyone who comes gets +20 🪙 and a heart | rich players pay, everyone gains |
| 🌸 Seasonal decor (rent) | 500 / week | flowers, lights, festival stuff on your house | ~70/day |

Pets: buy once for **6,000** (decided 9 Nov: the lowest price in the old 6,000–10,000 range, so more people can have one). A hungry pet just naps at home — it never runs away, gets sick or dies (an office game must never make people feel guilty). Pet food should cost more than the pickup it finds, so it's a pleasure, not an investment.

Target: consumables absorb ~300–600 🪙/day for active players, which brings net saving down toward the ~1,000/day the house pace assumes for regulars.

## 8. Walking (fun, short)
- Something every 5–10 seconds: daily road pickups (coin, fruit, flower, rare 🍀), a moving food cart (sells fertiliser, seeds, pet treats; parks in a different cluster daily), deliveries ("take 5 🍅 to จ๋า" pays more than the canteen), waving to online coworkers, petting street cats/dogs.
- Deliveries (in prototype): the notice board lists 3 jobs a day, e.g. "5 🍅 → จ๋า, she's making som tam for friends". You get the canteen price +30% (canteen = sell ×1.2, so delivery = sell ×1.56; e.g. 5 🍅 at sell 25: canteen 150, delivery 195). The owner pays nothing (the coins come from the system), so nobody feels they owe anything. The house shows a 📦 sticker until you deliver. Jobs go to different clusters, which mixes people up.
- Tapping a far house still opens its card at once; your character walks there by itself.

### Live players (decided 9 Nov 2026: same as the hub room)
- Everyone in the village is a real person walking live, like ห้องรวม (hubroom.js). Presence = `rooms/_hub/on/{sid}` with `g:'village'`, the target cell `x,y` and the ride `r`; each client walks the others there along the same paths, so one write per tap is enough and the online box still counts them.
- Their bike or scooter shows, and they move at its speed. Name tag = 🟢 name.
- Offline owners don't walk: their character stands at home with a quiet "away" look; the house, garden and help/water buttons all still work.
- Tab hidden → `v:0` → others stop seeing you (same as the hub). No position history is stored.
- Prototype: open with `?test=1&name=…&who=adam|alex|amelia|bob` in two tabs (mock DB, never the real one); without `?test=1` the old pretend neighbours wander.

## 9. Clusters without กีดกัน
1. Any empty lot in any cluster can be picked; no reserving lots for friends; no private clusters.
2. No cluster leaderboard or cluster-only rewards; village-wide goals only.
3. Helping in another cluster pays the same.
4. 💛 houses nobody visited today pay double to help, and "next house →" goes there first.
5. Events (cart, parties) rotate between clusters.
6. Moving to another lot is allowed (fee 5,000).
7. Cute neutral cluster names, never team names.
8. Living next to friends: cosmetic perks only.

## 10. The office tower
Starter condos for new players; lobby = party room + missions + notice board; 🎮 game room = the only brick source; 🍱 canteen = sell crops ×1.2; freed condo units become shared corners; rooftop = farm plots of players still in a condo (closed for each player at move-in); the crane keeps building shared floors (office-wide goal).

## 11. Open questions
1. ~~Games give bricks?~~ Decided 9 Nov: yes, bricks come from games (1–3 per round, cap 12/day), plus 3 a day on the village roads.
2. ~~Unlock at room 22 or Lv 12?~~ Decided 9 Nov: needs **both** room size 22 **and** Lv 12. The lock card shows both checks with progress, e.g. "ห้อง 18/22 · Lv 12 ✓".
3. Re-check prices with 2 weeks of stats before launch?
4. ~~House 37,500 or ~50,000?~~ Decided 9 Nov: 50,000 (10k/10k/15k/10k/5k).
5. Light players (Lv 10–13, ~250/day) can't reach a house: add a smaller first home or catch-up income? Counted 9 Nov (§2b): only ~4 browsers. Parked: think about it later.
6. ~~Speed-up price?~~ Decided 9 Nov: no paid speed-up.
7. ~~Pet price?~~ Decided 9 Nov: 6,000.

## 12. Future update: life skills (ความชำนาญ), after the village launch
Owner idea, 9 Nov 2026. Not in v2.0.

Rule: a skill rewards doing what you already do. It is never a wall: nothing in the game needs a skill level to use.

| Skill | Grows from | Rewards per tier (5 tiers) |
|---|---|---|
| 🌱 Farming | harvesting garden plots | rare seed varieties, garden decorations, a little faster growth (cap +10%) |
| 🍳 Cooking | cooking/selling at the canteen | recipes that combine crops into dishes (worth more than the raw crops, so they stretch your crops further rather than print coins) |
| 🔨 Building | stages of your own house + helping coworkers build | help gives −2.5 h instead of −2 h, house decorations, titles |
| 🐾 Pet care | feeding, petting, tricks | new tricks, accessories (hats, collars) |
| 📦 Errands | deliveries, road pickups | an extra delivery job some days, pickup magnet range |

- Titles shown on your name tag: "เชฟประจำซอย", "ช่างใจดี", "นักปลูกผักมือทอง". Social status is the main reward.
- No coin multipliers above a few %. The economy already inflates (§2); skills should give choices and looks, not more coins.
- A daily XP cap per skill keeps it fair for people who play 10 minutes a day.
- Building XP from helping others makes cooperation the fastest path, which fits rule set §9.
- Launch with 2–3 skills (Farming, Building, Pet care: their data exists after v2.0), add Cooking with recipes later.

**Update 12–13 Nov 2026:** superseded by `prd-skills-dungeon.md` + `gdd-dungeon.md` §9 (owner: 7 skills — Farming, Cooking, Pet care, Mining, Foraging, Fishing, Combat; walls by tool not skill; titles as the social reward; a new map for the gathering skills; combat via the dungeon).
