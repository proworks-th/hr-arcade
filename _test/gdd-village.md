# GDD: หมู่บ้านพนักงาน (Village)

Draft 2.1 · 9 Nov 2026 (delivery pay, help progress) · prototype: `_test/village-proto.html`

## 1. One line
After the biggest condo room, you save up, reserve land, and build your own house + garden over 5 stages. Neighbours are coworkers. The village is where you live; the office tower is where you work and play (games, canteen, missions).

## 2. Real economy (stats 4–6 Nov 2026, economy counters only started 4 Nov, ~11–13 players a day)
| | Coins |
|---|---|
| Earned per active player per day (gross) | ~2,200 |
| Spent per active player per day | ~1,400 (seeds 54%, furniture 34%) |
| Kept per active player per day (net) | ~750 |
| Top players (Lv 31–33), coins in hand | 939 → 9,311 in 2 days (≈ +4,000/day net) |
| Where coins come from | selling crops 43%, canteen 27%, games ~20% |

Draft 1 assumed ~650/day gross. Real earning is 3–4× that, so draft-1 prices would let top players buy a house in 2 days. Prices below are ×4–5.
Only 3 days of data: re-check after 2 weeks before launch.

## 3. Target pace
| Player | Net coins/day if saving | House (37,500) |
|---|---|---|
| Top player (Lv 30+) | ~4,000 | ~10 days (brick cap + build timers also hold them back) |
| Average active player | ~1,500 (skips furniture) | ~25 days |
| Light player | ~500 | ~2.5 months (aims for it as a long goal) |

## 4. House build (×5) — total 37,500 🪙 + 60 🧱 + 30 🥬
| # | Stage | Cost | Build time |
|---|---|---|---|
| 1 | 🪧 Reserve land | 7,500 | instant |
| 2 | 🧱 Foundation | 7,500 + 20 🧱 | 24 h |
| 3 | 🏠 Walls + roof | 10,000 + 40 🧱 | 48 h |
| 4 | 🌳 Garden (14 plots) | 7,500 + 30 🥬 | 24 h |
| 5 | 🎉 Move-in party | 5,000 | instant |
- Help build: −2 h, helper +5 🪙, max 5 helps/house/day. Progress bar = 1 − hours left ÷ stage hours (so 2 h is 8% of a 24 h stage, 4% of 48 h). Speed-up: 30 🪙 per hour left (open: probably too cheap, whole build ≈ 2,900).
- Bricks 🧱: from games only, 1–3 per round, cap 12/day (keeps the office/game room daily).

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

Pets: buy once (🐶 / 🐱 6,000–10,000). A hungry pet just naps at home — it never runs away, gets sick or dies (an office game must never make people feel guilty). Pet food should cost more than the pickup it finds, so it's a pleasure, not an investment.

Target: consumables absorb ~300–600 🪙/day for active players, which brings net saving down toward the ~1,000/day the house pace assumes for regulars.

## 8. Walking (fun, short)
- Something every 5–10 seconds: daily road pickups (coin, fruit, flower, rare 🍀), a moving food cart (sells fertiliser, seeds, pet treats; parks in a different cluster daily), deliveries ("take 5 🍅 to จ๋า" pays more than the canteen), waving to online coworkers, petting street cats/dogs.
- Deliveries (in prototype): the notice board lists 3 jobs a day, e.g. "5 🍅 → จ๋า, she's making som tam for friends". You get the canteen price +30% (canteen = sell ×1.2, so delivery = sell ×1.56; e.g. 5 🍅 at sell 25: canteen 150, delivery 195). The owner pays nothing (the coins come from the system), so nobody feels they owe anything. The house shows a 📦 sticker until you deliver. Jobs go to different clusters, which mixes people up.
- Tapping a far house still opens its card at once; your character walks there by itself.

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
Starter condos for new players; lobby = party room + missions + notice board; 🎮 game room = the only brick source; 🍱 canteen = sell crops ×1.2; freed condo units become shared corners; rooftop = shared garden; the crane keeps building shared floors (office-wide goal).

## 11. Open questions
1. Games give bricks — OK? (or also farm rewards)
2. Unlock at room 22 or Lv 12?
3. Re-check prices with 2 weeks of stats before launch?
