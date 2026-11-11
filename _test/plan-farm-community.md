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
- **Game time (owner, 11 Nov):** 1 game day = 20 real minutes, the same clock for everyone. Done in sample 2.
- **Crops stay on the real timer (owner, 11 Nov)**; only the sky, villagers and shop hours follow the 20-minute day.
- **Community farm prototype is playable** in sample 2 (`?farm=1`).
- **No stealing (owner, 11 Nov):** you can only harvest what you planted. Others can water and help, never take.
- **Bus stop moves to the dungeon + combat update** (owner, 11 Nov), not this one.
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

## Game time: 1 day = 20 minutes
- Clock = (server time − start) mod 20 min, so every player sees the same hour. 1 game hour = 50 s. 72 game days per real day.
- Sample 2 shows "วัน N · HH:MM" and the sky, window light and villager schedules follow it (`_test/village-cozy-big.html`).
- **What follows game time:** sky and night lights, villager schedules (canteen at lunch etc.), shop open hours,
  daily villager talk. (Crops do NOT follow game time — see below.)
- **What stays real time:** build timers (12–24 h), coworker-help and gift limits per real day, pet meals, weekly awards,
  festivals on real dates (Loy Krathong). Otherwise a busy worker who plays 20 min at lunch falls 20 days behind.
- **Decided (owner, 11 Nov): crops grow on the real timer** (farm.js minutes: ผักบุ้ง 3 นาที … แตงโม 3 ชม.), same as the live farm.
  Watering = −15% grow time each, up to 3 waters (owner 1 + friends 2) = up to 45% faster. Crops never die or wilt; they wait.

## No stealing: who can do what
| On | Owner | Friends / anyone |
|---|---|---|
| My backyard farm | loosen soil, plant, water, harvest | water (+ kindness), leave a gift in the mailbox; cannot harvest or dig |
| Community farm plot | the player who loosened it owns that plot until harvest; only they harvest | water it (+ kindness, and the owner gets the speed-up) |
| Community order fields | crops go straight to the board order, credited to the planter | anyone can water |
- A plot is claimed when you loosen it; ripe crops wait for their owner (no rot, nobody can take them).
- Unused claims free up after 3 real days, and the seeds return to the owner's bag, so nobody loses anything.
- Max claims per player on the community farm (e.g. 6) so one person can't fill it.

## Stardew loop: loosen → plant → water
- 🪓 **Loosen** the soil (tap with the hoe) → 🌱 **plant** a seed from the bag → 💧 **water** (once by you, up to 2 friends)
  → each water makes it grow 15% faster (real timer) → 🧺 **harvest** when ripe (2 per plot). The soil stays loosened, so you replant straight away.
- Not watering doesn't kill: the crop just grows at normal speed. Friends' watering counts too (max 2 friends a crop).
- Same loop on the backyard farm and the community farm, so you learn it once.

## Playable prototype: community farm (11 Nov)
In `_test/village-cozy-big.html` (south of the village, or open with `?farm=1`; `?fresh=1` resets, `?fast=60` = test speed).
- 44 plots (4 rows × 11). Tool bar at the farm: 🪓 พรวนดิน · 🌱 เมล็ด (tap again = seed bag) · 💧 รดน้ำ · 🧺 เก็บ. Keys 1–4 + E/Space on the plot in front.
- Tap a plot → you walk next to it → the tool is used. Wrong tool → a hint and the bar switches to the right one.
- Loosen = claim (max 6 a player, coloured flag = owner). Only the owner plants and harvests; others can only water.
- Neighbours แพร / ฝน / ต้น farm their own plots, water yours first ("รดน้ำให้พลนะ 💧"), and when your crop is ripe they say
  they'll wait for you; they never harvest it. Their harvests go into the village order.
- 🛒 Seed shop: tap a seed = preview (growth stages, time, yield, sell price, ×1/×5/×10), then a separate "ซื้อ" click pays. Sell crops 1 by 1.
- 📋 Village order: one shared bar (e.g. ผักบุ้ง 30 for the canteen) with who gave what; when full, everyone who gave is paid
  (50 + 8 a crop, +3 น้ำใจ) and the next order starts.
- HUD: 🪙 coins · 💗 น้ำใจ (kindness: +1 per friend watering, +1 per delivery, +3 per finished order) · 🌾 plots n/6.
- Saved in this browser only (localStorage `cozyFarm1`); the live version would keep plots in Firebase with a transaction per action.

## Prototype update: arrive-to-open, backpack, hot bar, chest (11 Nov)

- **Menus open only when you get there.** Tap 🛒 ร้านเมล็ด, 📋 ออร์เดอร์, 📦 หีบ, a house lot or a neighbour: you walk over, and the menu opens on arrival. Walk away (more than about 2 cells) and it closes by itself.
- **🎒 Backpack: 24 slots.** The top row is the **hot bar** (6 slots, keys 1–6, or tap). Whatever you hold is what you use on a plot:
  - 🪓 จอบ loosens and claims a plot.
  - 💧 บัวรดน้ำ waters.
  - A seed packet plants.
  - Ripe crops of yours are picked whatever you hold.
- **Organising the bag:** tap an item, then tap another slot to move, swap or merge (key I/B opens the bag). If a hint needs a tool that is only in the bag, it tells you to move it to the hot bar.
- **📦 Farm chest: 24 slots.** Tap an item to move the whole stack between chest and bag. "เก็บผักทั้งหมดเข้าหีบ" stores every crop in one go. A full bag blocks harvesting ("กระเป๋าเต็ม — เก็บของเข้าหีบ").
- Seeds you buy, crops you pick, crops you sell, order deliveries and gifts to neighbours all come from the backpack. The order card also shows how many more are in the chest.
- **Open questions for later:**
  - Should the chest be shared with friends? (Now: personal.)
  - One chest at the farm, or one at home too?
  - Should the bag size grow with level?

## Prototype update: starter house → big house (11 Nov)

- **Everyone starts in a small starter house** (บ้านหลังแรก): an 8×6 room and a 10-plot garden.
- **Upgrade flow:** tap your house (or 🏠 บ้านฉัน), then ⬆️ ขยายบ้าน.
  - A preview shows the house now › the house after, the room growing 8×6 → 11×7, and what you get (sofa, kitchen counter, flowers + garden fence).
  - Only the second click, "สร้าง · 1,500 🪙", pays.
- **Building takes 30 real minutes.** Scaffolding and a progress bar sit over your house, and you can still use the old house meanwhile. When it's done, ✨ ย้ายเข้าบ้านหลังใหญ่ moves you in.
- Prototype only: the demo starts with 2,000 🪙 so you can try it (`?fast=60` makes the build take 30 s).
- **To decide:**
  - Price (1,500?) and build time (30 min?).
  - Should it also need farm crops as materials?
  - Should the condo room move into the starter house, as decided earlier?

## Prototype update: every house garden farms the same way (11 Nov)

- **Every garden plot by a house is now a real plot with the community-farm rules.** That's 98 plots across the village, 10 of them by your house.
  - It's already loosened and belongs to the house owner, so it needs no claiming and doesn't count towards the 6 community-farm claims.
  - Only the owner plants and harvests. Anyone can help water (+3 🪙 +1 น้ำใจ, max 3 waters per crop, 20 helps a day).
  - Tapping a neighbour's ripe crop says only the owner can pick it.
- **Neighbours tend their own gardens:** they harvest ripe crops a few minutes after they ripen and replant 1–4 minutes later. Walking neighbours only help water plots within about 14 tiles, so they stay near the farm.
- **Your garden starts with:** ripe chilli, young bok choy and tomato, a lettuce and a carrot that still need water, and 5 empty beds.
- **To decide:** should the big house's garden grow to 14 plots (it stays at 10 for now)?

## Prototype update: central park (11 Nov)

- **The two middle lots are now the village's central park.** The 10 house lots form a ring around it.
- **What's in the park:**
  - A stone cross path with a round plaza and a ⛲ fountain in the middle (bunting over it).
  - A 🛕 Thai sala, the 🪷 สระลอยกระทง pond with lotus pads (ready for the Loy Krathong festival).
  - Benches, trees, flower beds and 4 street lamps that glow at night.
- **Your house moved to the lot facing the park, on its east side.** เบียร์'s house moved to the free lot below yours; จอย's reserved lot moved to the top row. One lot is left free.
- In the evening, neighbours go to the park (ป้าแม่ครัว sits at the sala, น้องฝึกงาน on a bench). The office plaza and the big lake on the town side stay.
- The save key changed to `cozyFarm3`, so old test saves start fresh.

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
- **Community farm (south)** = shared fields for village orders and festival crops. You claim a plot by loosening it and
  only you harvest it (see "No stealing"); friends water. That is where "farming together" happens.

## Extra ideas (ranked: easy + fits the goal first)
1. **Mailbox at every house** — friends leave a crop gift or a note; you open it when you come home.
2. **"ขอความช่วยเหลือ" flag** — raise a flag on your house ("รดน้ำให้หน่อย" / "ขาดอิฐ 3 ก้อน"); friends see it on the map.
3. **Village level** unlocks park pieces (fountain, gazebo, food stalls, night lights) — shared pride.
4. **Neighbour bonus** — two houses side by side that help each other weekly get a small shared fence/garden arch.
5. **Seasonal crops + festival crops** (krathong flowers before Loy Krathong) grown on the community farm.
6. **Canteen recipes** — deliver crops, the canteen cooks a dish for the whole village for an hour (a buff for everyone).

## Later: dungeon + combat update
- Bus stop fast-travel ships with the new dungeon map (Kenney Tiny Dungeon pack is already in `_test/kenney/`):
  the bus takes you to the village stops and to the dungeon gate.

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
6. Which extra first: mailbox · help flag · village board orders?
7. ~~Crops grow in game days or real minutes?~~ Decided: real timer.

## Order once decided
A. Map v2 (park centre, lot ring, game clock) in `_test` → B. Relocation + preview → C. House interior from the condo →
D. Yard planner → E. Community farm (claimed plots) + board orders + village level. Later: dungeon + combat + bus. Each behind a flag, test mode only, commit locally.
