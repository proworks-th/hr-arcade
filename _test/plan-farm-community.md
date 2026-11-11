# Plan: "farming community, helping friends" — 11 Nov 2026 (for discussion)

## TL;DR
- **Main goal = grow your farm, grow the village together.** Every big loop should end in "I helped someone" or
  "we did it together", not only "I got richer". Most of the parts already exist (friend watering, build helpers,
  shared office level) — this plan points them at one goal.
- **Park in the middle** of the 72×48 map; lots ring around it. Saves keep working (lots are stored by id, the
  positions live only in code), so this is a free move for everyone.
- **Relocation:** 1st move free, then 5,000 🪙, 7-day cooldown, house + paint + garden + crops move with you.
- **Condo room → house:** at move-in your room's furniture moves into the house, and the house is bigger than any condo.
  The condo stays for players without a house.
- **Farm = one farm.** The lot's backyard *is* your farm.js plots (already true since Step 5), now laid out
  Stardew-style by you. The south "community farm" is shared, not a second personal farm.
- Everything purchasable keeps the **preview → second click to buy** rule.

## Today's numbers (from the code)
| Thing | Cost / reward |
|---|---|
| Reserve a lot | 10,000 + room 22 + Lv 12 |
| House stages | 5,000 cottage · 20,000 big house · 10,000 garden 14 plots · 5,000 move-in party |
| Whole house | ≈ 50,000 🪙 + bricks + vegetables |
| Condo room sizes | 12 → 15 (300) → 18 (700) → 22 (1,500) tiles wide; farm plots 4 / 6 / 8 / 10 |
| Helping | build helper −2 h, +5 🪙 (max 5 a day) · friend watering up to 20 a day |
| Income | mini-games about +20 to +30 a round, cat 50 a day |

## The 5 questions — my take

### 1. Main goal: farming community + helping friends — **yes**
It fits HR Arcade (coworkers, not strangers) and the code already rewards helping. Make it visible:
- **Village board orders** (shared): "ส่ง 300 มะเขือเทศให้โรงอาหาร" — anyone can deliver, everyone who gave gets a reward,
  the village levels up (like the ห้องรวม office level: a shared counter that adds things for good —
  a bridge, park fountain, market stalls, bus line).
- **Help counts as progress:** a "น้ำใจ" (kindness) score per week from watering, build help, gifts, orders → weekly award
  (fits the weekly awards in cloud.js).
- **Never punish:** helping gives you something; not being helped never hurts you (no wilting, no theft).

### 2. Park in the centre — **yes**
- Park + lake + plaza in the middle = festival spot (Loy Krathong pond), everyone passes it, live players meet there.
- Lots in rings around the park, town street east, community farm south, office tower north.
- Because lot data is keyed by id, moving the park is a code change only. Show a one-time note: "หมู่บ้านจัดผังใหม่ บ้านคุณย้ายไปที่..."
  This move never uses up anyone's free relocation.

### 3. Relocation 1 free, then 5,000 — **fair, with 3 small rules**
- 5,000 = half a lot and ~10% of a full house, about a week of normal play — enough to stop hopping, not a punishment.
- Rules: 7-day cooldown · can't move while a build timer runs · can only move to an empty lot.
- **Preview first:** pick the new lot → see your house drawn there → "ย้าย (ฟรี)" / "ย้าย 5,000 🪙" as a separate click.
- Optional: moving next to a friend who invites you is free once ("ชวนมาเป็นเพื่อนบ้าน") — fits the goal.

### 4. Condo room moves into the house, bigger — **yes**
- At the move-in party: furniture and room layout carry over 1:1, placed in the house interior.
- House sizes: cottage 24 × 12 tiles · big house 30 × 14 with 2 rooms (living + bedroom). Bigger than the 22-wide condo,
  so moving feels like an upgrade.
- The condo stays as the home for players without a house (and newcomers). After move-in it becomes "ห้องเก่า", not a 2nd room to keep up.
- Decorating keeps the preview-in-room → buy rule.

### 5. Stardew-style farm at each house vs. garden on the live map — **one farm, laid out by you**
- **Don't** build two personal farms (double the chores and confusion). The lot backyard on the live map *is* your farm:
  same plots array as farm.js, so crops and friends' watering already carry over.
- New: **plan your yard** — a grid behind the house (e.g. 8 × 6 at cottage, 10 × 8 at big house) where you place
  plots, paths, sprinkler, scarecrow, flower beds, a bench. Friends see it live when they walk by and can water it.
- **Community farm (south)** = shared fields for village orders and festival crops: anyone can plant/harvest there,
  the harvest goes to the board. That is where "farming together" happens.

## Extra ideas (ranked: easy + fits the goal first)
1. **Bus stop fast-travel** — the walk across the map is ~30 s; 4 stops (park, town, farm, tower), free.
2. **Mailbox at every house** — friends leave a crop gift or a note; you open it when you come home.
3. **"ขอความช่วยเหลือ" flag** — raise a flag on your house ("รดน้ำให้หน่อย" / "ขาดอิฐ 3 ก้อน"); friends see it on the map.
4. **Village level** unlocks park pieces (fountain, gazebo, food stalls, night lights) — shared pride.
5. **Neighbour bonus** — two houses side by side that help each other weekly get a small shared fence/garden arch.
6. **Seasonal crops + festival crops** (krathong flowers before Loy Krathong) grown on the community farm.
7. **Canteen recipes** — deliver crops, the canteen cooks a dish for the whole village for an hour (a buff for everyone).

## Revisions I'd suggest
- Keep **coin sinks soft**: relocation, paint and decor are the sinks; nothing that makes friends lose things.
- **Newcomer path:** condo → help others (earn kindness + coins) → reserve a lot → cottage. A newcomer is useful from day one.
- **Cap helping rewards** per day (already 5 build helps) so it stays kind, not a farm for coins.

## Easy to decide first
1. Main goal "farming community, helping friends" — go?
2. Park in the centre, lots in a ring — go?
3. Relocation: 1st free, then 5,000, 7-day cooldown, no move during builds — go?
4. Condo furniture moves into a bigger house; condo stays for people without a house — go?
5. One farm: backyard = farm plots you lay out yourself + a shared community farm — go?
6. Which extra first: bus stop · mailbox · help flag · village board orders?

## Order once decided
A. Map v2 (park centre, lot ring, bus stops) in `_test` → B. Relocation + preview → C. House interior from the condo →
D. Yard planner → E. Community farm + board orders + village level. Each behind a flag, test mode only, commit locally.
