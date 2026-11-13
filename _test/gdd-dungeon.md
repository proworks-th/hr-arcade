# GDD: ดันเจี้ยนใต้ตึก (the dungeon) + life skills

Game design as built in the prototype (13 Nov 2026). Every number here comes from `dungeon/data.js` and
`skills.js`; if they disagree, the code wins and this doc should be updated. Why we build it: `prd-skills-dungeon.md`.

---

## 1. Pillars

1. **A break, not a chore.** A run fits a coffee break, pauses instantly (Esc), and never takes anything away.
2. **Move, read, survive.** You only steer and dodge; skill is positioning and reading honest warnings.
3. **Builds that snowball.** Every level is a small decision; weapons evolve when you plan for it.
4. **Today's dungeon is everyone's dungeon.** One seed per day, so people can compare and talk about it.
5. **What you do lasts.** Combat tiers, discovered weapons and the armoury carry between runs.

## 2. Loops

**Moment (seconds):** steer → weapons fire → gems spill → magnet pulls them in → XP bar fills.
**Floor (1–3 min):** explore with fog of war → waves pour in → reach the kill target → door opens → next floor.
**Run (5–15 min):** level-ups every ~30–60 s → boss every 5th floor → chest: evolution or upgrade → vault altar → deeper until you faint or leave.
**Days / weeks:** combat XP (200/day cap) → tiers → lasting perks; first visit to B3 / B6 / B11 unlocks a weapon forever; daily best depth; titles.

## 3. Controls

| | PC | Phone |
|---|---|---|
| Move | WASD / arrows | drag anywhere on the canvas (floating stick) |
| Dodge (0.16 s, i-frames 0.24 s, cooldown 0.8 s) | Shift / Space / K | big "หลบ" button, bottom right |
| Map | M / Tab, or click the minimap | tap the minimap, or the "แผนที่" button |
| Level-up pick | 1 / 2 / 3, R = reroll | tap a card |
| Boss key | Esc (freeze + office screen) | — |

## 4. Floors

### 4.1 Purposes (floor size follows what the floor is for)
| Purpose | When | Size (tiles) | Rooms | Room size | Monster density | Chests | Measured avg (2,000 floors) |
|---|---|---|---|---|---|---|---|
| ชั้นตื้น warm | B1–B2 | 36–42 × 24–28 | 5–7 | 6–10 × 5–8 | .030 | 1 | 39×26, 5.6 monsters, 34 tiles start→exit |
| โถงล่า hunt | default, B3+ | 40–52 × 26–34 | 6–10 | 6–11 × 5–8 | .036 | 1–2 | 46×30, 13.6, 45 |
| เขาวงกต maze | B4+ (25%) | 52–60 × 34–40 | 11–15 | 4–7 × 4–6 | .034 | 2–3 | 56×37, 16.1, 61 |
| รังสัตว์ nest | B4+ (25%) | 44–54 × 30–36 | 5–7 | 9–14 × 7–10 | .050 | 1–2 | 49×33, 25.5, 43 |
| รังบอส lair | every 5th | 40–48 × 28–32 | 4–6 + arena | arena ≤ 16×11 | .018 | 0–1 | 44×30, 6.5 + boss, 30 |
| ห้องสมบัติ vault | after each boss | 36–40 × 24–26 | 4–5 | 6–9 × 5–7 | .012 | 2–3 + altar | 38×25, 3.3, 30 |

Theme: sand (B1–B5), brown stone (B6–B10, darkened so monsters read), alternating every 5 floors.

### 4.2 Generator (`gen.js`, pure, ~0.25 ms a floor)
seed = `dgn-YYYY-MM-DD` + `#depth` → purpose → size → rooms (non-overlapping, 2–3 tile gaps; lair places its arena first) →
corridors (Prim spanning tree on room centres + extra links for loops, maze 45%, others 20%; L-shaped, 2 tiles wide) →
walls (any void touching floor; a top strip above every brick face) → start room (random; lair: farthest from the arena) →
exit = brick face in the top wall of the room farthest by walking distance (lair: the arena) → props only on cells whose
8 neighbours are open (can never cut a path) → chests (mimic chance from B4: 15% + 1%/floor, max 35%) → spikes from B3
(w·h/260; down 1.6 s, warning 0.5 s, up 0.5 s; dodging through is safe) → altar on vaults → monsters by room area × density × depth scale, never within 5 tiles of the start.

Invariants (tested in `test-gen.js`, 50 days × 40 floors): every open cell reachable; exit on a real face; ≥ 3 monsters; boss on lairs; altar on vaults; deterministic.

### 4.3 Door and waves
- Door opens at **kill target = max(6, round(placed monsters × 1.15))**; wave kills count. Lairs: when the boss dies. Vaults: kill target, no waves.
- **Waves** while the door is shut: first after 6 s, then every `max(5, 10 − 0.3·depth)` s; size `min(16, 4 + floor(0.8·depth))` (lairs half); floor cap 60 monsters.
  Spawn 6–11 tiles from you on a reachable cell; **each monster is announced by a purple swirl for 0.8 s** (honest warning).

| Floor | Wave size | Every |
|---|---|---|
| B1 | 4 | 9.7 s |
| B5 | 8 | 8.5 s |
| B10 | 12 | 7.0 s |
| B15 | 16 | 5.5 s |

## 5. Monsters

| id | Name | HP | Speed | Contact dmg | Points | From | Weight | Behaviour (warning) |
|---|---|---|---|---|---|---|---|---|
| slime | สไลม์ | 2 | 55 | 1 | 10 | B1 | 10 | walks at you |
| bat | ค้างคาว | 1 | 100 | 1 | 8 | B2 | 7 | weaves while chasing |
| rat | หนูท่อ | 1 | 125 | 1 | 6 | B3 | 5 | packs of 3–4, back off after a bite |
| spider | แมงมุมยักษ์ | 3 | 60 | 1 | 20 | B3 | 6 | red line 0.55 s → charge 340 px/s 0.45 s; stunned on a wall |
| bigslime | สไลม์ใหญ่ | 4 | 42 | 1 | 25 | B4 | 4 | splits into 2 slimes |
| bandit | โจรเงา | 2 | 70 | 1 | 25 | B5 | 5 | keeps 2.6–4 tiles away, red line 0.5 s → knife |
| ghost | วิญญาณ | 2 | 48 | 1 | 22 | B6 | 4 | through walls; faded 1.4 s of every 3.8 s (untouchable, harmless) |
| brute | อสูรแดง | 5 | 40 | 2 | 45 | B8 | 3 | red circle 0.8 s → slam r 92 |
| mimic | หีบมิมิค | 3 | 95 | 1 | 35 | B4 | chests | looks like a chest until you're within 1.25 tiles |
| cyclops | ยักษ์ตาเดียว | 14 + 1.6/floor | 30 | 1 | 200 | B5, 15, 25… | — | orb ring (10 + depth/4) · aimed triple · summons 2 slimes |
| demon | ราชาอสูรแดง | 18 + 1.6/floor | 36 | 2 | 260 | B10, 20… | — | red line 0.7 s → charge · red circle 0.9 s → slam r 120 · fire ring (14) |

Monsters sleep until they see you within 6.5 tiles; only those within 16 tiles think; pathing is a shared flow field (BFS from you, recomputed when you change cell). Enemy shots are destroyed by your knives/bolts (+2 score).

### 5.1 Difficulty curve (`DD.scale`)
| Floor | HP × | Speed × | Contact dmg | Density × |
|---|---|---|---|---|
| B1 | 1.00 | 1.02 | 1 | 1.03 |
| B4 | 1.07 | 1.09 | 1 | 1.10 |
| B10 | 1.49 | 1.22 | 1 | 1.25 |
| B12 | 1.63 | 1.26 | **2** | 1.30 |
| B20 | 2.19 | 1.44 | 2 | 1.50 |
HP: base until B3, then +7% a floor (cap ×3). Speed +2.2% a floor (cap +45%). Warnings never shorten.

## 6. Player and build

### 6.1 Player
5 hearts (+ combat tier), speed 165 px/s, hit radius 11, i-frames 0.9 s after a hit, base crit 5% (×2), gem magnet 70 px, 4 weapon + 4 passive slots.

### 6.2 Weapons (Lv 1 → 5 → evolution)
| id | Name | Kind | Dmg | Cooldown s | Other | Partner | Evolution |
|---|---|---|---|---|---|---|---|
| sword | ดาบ | arc at nearest (reach 70→92, n 1→2 = second swing behind) | 2,2,3,3,4 | 1.0→0.7 | | พลัง might | ดาบเพลิง: 360°, dmg 5, cd 0.6, reach 104 |
| axe | ขวานหมุน | orbit (r 70→88; on 3→4 s / off 2.5→1.8 s) | 1.5,2,2,2.5,3 | — | n 1,2,2,3,3; hits a monster every 0.45 s | แผ่กว้าง area | ขวานพายุ: 4 axes, nonstop, dmg 3.5, r 96 |
| dagger | มีดบิน | throw at nearest, 440 px/s | 1.5,1.5,2,2,2.5 | 1.0→0.65 | n 1,2,2,3,4; pierce 1,1,2,2,3 | รัวเร็ว haste | พายุมีด: stream every 0.14 s, pierce 4 |
| wand | คทาเวท | homing bolt | 2,2.5,3,3,4 | 1.3→0.9 | n 1,1,2,2,3 | คมกริบ crit | คทาจันทรา: 4 bolts, cd 0.7, +30% crit |
| staff | ไม้เท้าโนวา | ring pulse, knockback | 2,2,3,3,4 | 2.6→1.8 | r 90→135 | เกราะ armor | โนวาศักดิ์สิทธิ์: r 180, dmg 5, cd 1.5, heals 1 every 10 pulses |
| spear | หอกพุ่ง | lance in move direction, 560 px/s, pierces all | 3,3,4,4,5 | 1.6→1.0 | n 1,1,2,2,3 (front, back, side) | เท้าไฟ speed | หอกสามแฉก: 5-spear fan, dmg 6, cd 0.8 |
| hammer | ค้อนธรณี | quake at nearest within 6 tiles, stun 0.7 s | 4,4,5,6,7 | 3.0→2.0 | r 60→90; n 1,1,1,2,2 | หัวใจ heart | ค้อนเทพ: 3 quakes, dmg 8, r 100, cd 1.8 |

Projectiles stop at walls; orbit/nova/quake do not need line of sight. Knockback on bosses ×0.1; stun never on bosses.

### 6.3 Passives (5 levels each)
| id | Name | Per level |
|---|---|---|
| might | พลัง | damage +10% |
| haste | รัวเร็ว | weapon cooldowns −8% |
| area | แผ่กว้าง | weapon reach / radius +10% |
| heart | หัวใจ | max hearts +1 and heal 1 |
| speed | เท้าไฟ | move +8%, dodge cooldown −5% |
| magnet | แม่เหล็ก | gem pull range +30% |
| armor | เกราะ | 10% chance a hit costs no heart |
| crit | คมกริบ | crit chance +6% |

### 6.4 XP, level-ups, chests
- Gems: monster points × (1 + 0.12·(depth−1)) split into big (12 score, 3 XP) and small (3 score, 1 XP) gems. Score = pay; XP = levels.
- XP to next level = `round(8 + 6·lv + 0.6·lv²)` → Lv 2 at 15, Lv 5 at 110 total, Lv 10 at 513 total.
- Level-up: pick 1 of 3, drawn weighted from: upgrade an owned weapon (3), new weapon if a slot is free and it's discovered (2),
  upgrade a passive (2), new passive (1.5). Nothing left → "ถุงทอง" (score + heal). Rerolls from combat tier. Game pauses while picking.
- Boss kill → boss chest (walk into it) and 2 potions. Boss chest / vault altar: **an evolution if one is ready** (weapon Lv 5 + partner passive owned), else pick 1 of 3.
- Floor chests (walk into / hit with an arc): gems worth 25·depth, 45% potion. Potions: heal 1 when you walk over them below max. Monster potion drop 6%.

## 7. Lasting progression

| Layer | What carries over | Where |
|---|---|---|
| Combat skill | XP per run = 10 + kills + 5·floor (200/day cap); tiers below | `skills.js` (live: `Prog.sk`) |
| Discovery | wand (B3), spear (B6), hammer (B11): glowing chest near the start the first time you reach that depth; unlocked forever | `localStorage dgn_codex` (live: Prog) |
| Armoury | found weapons, evolutions seen, deepest ever, runs, kills | same |
| Daily best | deepest floor today | `dgn_best_<day>` (live: rooms/_stat leaderboard) |
| Daily checkpoint | deepest boss beaten today | `dgn_cp_<day>` (live: Prog, per day) |

| Combat tier (XP) | Perk (carries into every run) |
|---|---|
| 1 (100) | choose your starting weapon · title นักผจญภัยมือใหม่ |
| 2 (500) | +1 heart |
| 3 (1,300) | +10% damage · 1 reroll per run |
| 4 (2,700) | +2 hearts · start at Lv 2 |
| 5 (5,000) | +20% damage · 2 rerolls · title ตำนานดันเจี้ยน |

## 8. Economy and pay
- **Coins = round(score ÷ 20). No cap, no ×2 game pay, no bricks** (owner, 13 Nov). Combat XP as in §7.
- Score = gems (monster points × depth bonus) + floor clear 40·depth + chests 25·depth. Run upgrades never touch coins.
- Measured on 30 days of maps (kills to the door target only; waves beyond it add more):

| Reach | Run score | Coins |
|---|---|---|
| B1 | 125 | 6 |
| B3 | 701 | 35 |
| B5 | 1,880 | 94 |
| B8 | 4,592 | 230 |
| B10 | 7,030 | 351 |
| B12 | 9,754 | 488 |
| B15 | 14,638 | 732 |
| B20 | 25,045 | 1,252 |

- Risk accepted by the owner: checkpoints let a player start deep every day (PRD §10). The dungeon will drop its own material instead of bricks (design open, PRD §9.1).

### 8.1 Daily checkpoints
Beating a boss saves the floor in today's checkpoint (`dgn_cp_<day>`). The intro card offers B1 or the floor after any boss
beaten today (B6, B11…), latest pre-selected. Starting deeper grants 3 level-up picks per 5 floors skipped (B6: Lv 4,
B11: Lv 7) so the build isn't empty. Checkpoints reset with the daily map.

### 8.2 Leaderboard (go-live step)
Deepest floor today (fair: same map for everyone) and all-time deepest, in `rooms/_stat`. The prototype keeps only the local daily best.

## 9. Life skills (all activities)

| Skill | Phase | Grows from | Tier rewards (capped) |
|---|---|---|---|
| การเกษตร Farming | 1 | harvests (XP = crop XP) | growth +3% / +6% / +6% & golden seeds / +5% bonus crop / +10% growth & +10% bonus crop |
| ดูแลสัตว์เลี้ยง Pet care | 1 | feed 20, premium 40, pat 3 | fed +2 h / new trick / +3 h & star collar / +4 h & high-five |
| การต่อสู้ Combat | 1 | dungeon runs | §7 |
| ทำอาหาร Cooking | 2 | recipes (crops + fish + herbs) | recipes, dish quality |
| ขุดแร่ Mining | 2 | rocks, ore (tile 56), floors; deeper floors need a better pickaxe (walls by tool) | ore yield, finding the ladder |
| หาของป่า Foraging | 2 | trees, herbs | yield, rare finds |
| ตกปลา Fishing | 2 | timing mini-game | easier bar, rare fish |

Tiers at 100 / 500 / 1,300 / 2,700 / 5,000 XP; 200 XP per skill per day (≈ 25 days to T5). Each tier = a title; wear one on the name tag.
Skills screen (approved sketch, not built): name tag hero + change title; a row per skill (icon, 5-step bar, next reward, today 132/200);
detail card (XP sources with numbers, now-vs-next bonus, tier ladder with checkmarks); locked skills in one line.

## 10. UI, feedback, art, audio
- HUD (DOM): hearts · floor · Lv · score · "ปราบ x/target" (or boss / door open) · leave button; second row: weapon and passive icons with level badges (EVO in orange).
- Canvas: XP bar across the top; minimap top right (fog-revealed; big map with legend and % explored); boss bar; edge arrow to door / relic / boss chest; yellow ring at your feet; damage numbers (crits yellow with "!").
- Telegraphs: red lines (charge, knife, boss charge), red circles (slam), purple swirls (spawns), flashing spikes.
- Art: Kenney Tiny Dungeon (CC0) for map, monsters, weapons, chests, potions; LimeZu avatars (the player's own). Credit line on canvas.
- Audio: hub SFX only (tick, good, bad, level). No music (office).

## 11. Tech
- `dungeon/data.js` all numbers · `dungeon/engine.js` (DE: seeded RNG, grid, collision, line of sight, flow field, map painter, fog, minimap, camera; pure except the painter) · `dungeon/gen.js` (pure) · `dungeon/game.js` (`Dungeon.mount(root, api)`).
- Map painted once at 16 px, drawn ×3 by slicing the visible part; camera snaps to art pixels; fog = 1 px per cell scaled with smoothing.
- Measured: generator 0.25 ms/floor; frame 0.3–0.5 ms normal, 1.5 ms average / 11.6 ms worst with 55 monsters (B15). Level-up overlay creation happens while paused.
- Test hooks with `?test=1` (`window.__dgn`): state, god, killAll, openDoor, toExit, toBoss, toAltar, toChest, toMon, give, xp, wave, pick, hurt, perf.

## 12. Playtest log
1. **12 Nov (manual combat):** "hard to attack on phone", "swing a little delayed", "monsters take too many hits", B12 in 15 min → on-screen buttons, input buffer, faster swing, lower HP; last 3 monsters came to you.
2. **13 Nov:** "attack too fast, too easy; easy first then juice up" → curve; "keep warnings honest" → fixed-length warnings; auto-attack → **pivot to Vampire Survivors logic**, floors + waves, full build, lasting progression.
3. **13 Nov (VS build):** "levelling really fast" → steeper XP; "waves a little thin" → bigger, faster waves; "B1 easy when you kite, good for motivation" → keep.
4. **13 Nov (numbers):** pay → score ÷ 20, no cap, no ×2, no bricks; daily checkpoints; leaderboard daily + all-time; 7 skills confirmed.
