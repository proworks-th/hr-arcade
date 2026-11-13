# PRD: Life skills + the dungeon (ดันเจี้ยนใต้ตึก)

Status: prototype built and playtested (12–13 Nov 2026), not live. Owner: Phol.
Companion docs: `gdd-dungeon.md` (full game design, every number), `gdd-village.md` §12 (the original life-skills idea),
`dungeon/README.md` (code map, how to run and test). This PRD says what we are building and why; the GDD says how it plays.

---

## 1. Summary

HR Arcade (ห้องพักสมอง) is an office break-time game hub with a cozy shared village (live since 11 Nov 2026).
This project adds two connected things:

1. **Life skills (ความชำนาญ):** lasting proficiency in Farming, Cooking, Pet care, Mining, Foraging, Fishing and Combat.
   Skills make you better at the activity itself and give titles shown on your name tag.
2. **The dungeon:** an endless, daily-seeded roguelite in the Vampire Survivors style. You move and dodge; weapons fire by
   themselves; gems level you up; you pick upgrades and evolve weapons. It ships first as an arcade game, then its engine
   carries a new map for Mining / Foraging / Fishing.

## 2. Problem

- **Coins pile up with nothing to spend them on.** The median player holds ~10,600 coins; farming is 84% of income
  (`gdd-village.md` §2). The village needs sinks and goals that are not "more coins".
- **No adventure loop.** Everything active in the village is farming, errands or building. Players asked for an RPG side.
- **No long-term identity.** Level titles are the only status; nothing says "this person is the best fisher" or "the dungeon legend".

## 3. Goals and success metrics

| Goal | Metric | Target |
|---|---|---|
| A fun active loop people come back to | Players who start ≥ 1 dungeon run in the first week | ≥ 30% of weekly active players |
| | Players with runs on ≥ 3 different days in 2 weeks | ≥ 15% |
| Fits a break | Median run length | 4–10 min |
| Doesn't inflate the economy | Net coins from the dungeon per player per day | ≤ one long arcade session (cap 60 base × 2) |
| Lasting status | Players wearing a skill title after 2 weeks | ≥ 20% of regulars |
| Works on office PCs and phones | Worst in-play frame | < 16.7 ms on a 1366×768 office PC |

## 4. Users and context

- Hospital / office staff (Thai UI), playing in short breaks on office PCs (1366×768, mouse + keyboard) and phones (portrait).
- **Boss key:** Esc must freeze everything instantly; a hidden tab pauses; nothing can hurt you while paused.
- ~12–20 regular players; social features matter more than depth for most; a few theorycrafters want builds.

## 5. Owner rules (non-negotiable)

1. **Nothing is lost.** Fainting or leaving a run pays out what you earned. No item loss, no energy bars, no chores.
2. **Warnings are honest.** Every enemy attack and every spawn shows a visible warning (red line / circle, purple swirl)
   of a fixed length. Depth makes monsters tougher, never less readable. ("The indicator needs to be there and honest to the player.")
3. **Skills are never a wall.** No content needs a skill level. Skills only add (bonuses, titles, choices).
   Where depth needs a gate, it is a **tool** anyone can get ("walls by tool, not by skill").
4. **Skill bonuses are capped** so a maxed skill never prints coins (farming +10% growth max, etc.).
5. **B1 stays easy** for anyone who kites: it's the motivation hook.
6. Art: CC0 (Kenney) or already-licensed (LimeZu, non-commercial). Thai UI. No build step; classic scripts; `?v=N` cache bumps.

## 6. Scope and phases

| Phase | What | Status |
|---|---|---|
| 1A | Life-skills framework (XP, 5 tiers, daily cap, titles) on existing systems: Farming, Pet care, Combat | Prototype (`skills.js`, `skills-proto.html`) |
| 1B | Dungeon as an arcade game (endless, daily seed, Vampire Survivors logic, lasting progression) | Prototype, playtested twice (`combat-proto.html`, `dungeon/`) |
| 1C | Skills screen redesign (approved sketch: name-tag hero, compact skill rows, detail card) | Designed, not built |
| 2 | New map next to the village: Foraging + Fishing first, then Mining with tool tiers; Cooking recipes use what they produce | Not started |
| 3 | The dungeon engine moves into the new map's deep cave (if 1B proves popular) | Not started |

Out of scope for now: co-op combat, paid anything, Building and Errands skills (dropped by owner 12 Nov; confirm, see §9).

## 7. Requirements

### 7.1 Life skills (Phase 1A)
- R1. 7 skills; Phase 1 active: Farming, Pet care, Combat. Others show as "coming with the new map".
- R2. XP per action; 5 tiers at 100 / 500 / 1,300 / 2,700 / 5,000 XP; **200 XP per skill per day** (Bangkok day).
- R3. Each tier gives a title; one title (or the level title) is worn on the name tag.
- R4. Bonuses capped in code (`Skills.CAP`). Combat tiers carry into every dungeon run (see 7.3).
- R5. Skills screen per the approved sketch: name tag + "change title", one row per skill (icon, 5-step tier bar,
  next reward, today's XP), detail card with the tier ladder, "how to earn XP" with real numbers, now-vs-next bonus.

### 7.2 Dungeon run (Phase 1B)
- R6. Endless floors; floor N of day D is identical for everyone (seed = date).
- R7. Floor size and layout by purpose (warm-up, hunt, maze, nest, boss lair every 5th, vault after each boss), 36×24 to 60×40 tiles.
- R8. The door opens at a kill target (placed monsters × 1.15); lairs open when the boss falls; waves pour in while it's shut.
- R9. You only move and dodge; 4 weapon + 4 passive slots; 7 weapons, 8 passives, 5 levels each; evolution = weapon Lv 5 + partner passive, from a boss chest or the vault altar.
- R10. Fog of war, minimap (big map on M / tap), edge arrow to the open door / waiting chest.
- R11. Esc / hidden tab freezes the game; leaving or fainting pays out (score ÷ 25, cap 60, ×2, bricks 1–3) and combat XP.
- R12. Phone: steer by dragging anywhere; one dodge button under the right thumb; all touch targets ≥ 44 px.

### 7.3 Lasting progression
- R13. Combat skill tiers: T1 choose starting weapon · T2 +1 heart · T3 +10% damage, 1 reroll · T4 +2 hearts, start at Lv 2 · T5 +20% damage, 2 rerolls.
- R14. Start with sword, dagger, staff, axe. Wand (B3), spear (B6), hammer (B11) wait in a glowing chest the first time you reach that depth and stay unlocked.
- R15. Armoury record: weapons found, evolutions, deepest floor, runs, kills. Shown on the start screen and results.

### 7.4 Non-functional
- R16. 60 fps on office PCs: worst in-play frame < 16.7 ms with 60 monsters (measured 11.6 ms with 55 on B15).
- R17. Generator invariants (tested over 2,000 floors): every open cell reachable, exit on a real wall face, ≥ 3 monsters, nothing spawns within 5 tiles of the start.
- R18. Same `mount(root, api)` contract as every arcade game, so it drops into `index.html`'s game list.

## 8. Decisions log

| Date | Decision | Why / owner words |
|---|---|---|
| 12 Nov | Skills first, the new map is where new skills live | "life skill proficiency with an extension map" |
| 12 Nov | Walls by tool, not skill (option C) | keeps "skills never a wall" |
| 12 Nov | Combat starts as an arcade game to test demand | "make arcade first, try the market" |
| 12 Nov | Skills make you better at the activity; titles are the social reward | |
| 12 Nov | Kenney Tiny Dungeon for the dungeon (scales up to the new map) | already in the repo, CC0 |
| 12 Nov | Endless floors, new map daily, no room locks but floors must be cleared, size by purpose, new organised engine | |
| 13 Nov | Phone attack button, faster swing, fewer hits (playtest 1) | "hard to attack on phone", "swing a little delayed", "too many hits" |
| 13 Nov | Then: easy early, harder deeper; warnings never shorten | "easy at first and juice up later"; "indicator must be honest" |
| 13 Nov | Vampire Survivors logic for the whole game, floors + waves, full build system | "use the logic of Vampire Survivors" |
| 13 Nov | Lasting progression across runs | "this mode has no progression on personal skills" |
| 13 Nov | Slower levelling, thicker waves; B1 stays easy (playtest 2) | "levelling really fast", "waves a little thin", "B1 easy when you kite, good for motivation" |

## 9. Open questions (for the owner / next agent)

1. **Pay cap:** score per floor ≈ B1 105 · B2 200 · B3 350 · B4 760 · B5 720 (old tuning), so the 60-coin cap lands at B4–B5.
   Keep it, or set `DD.NORM` ≈ 60 so the cap lands around B8–B10? (Re-measure after the XP/wave changes.)
2. Building and Errands skills were dropped from the owner's list on 12 Nov. Confirm.
3. Cooking: Phase 1 with crop-only recipes, or Phase 2 when fish/herbs exist? (Default used: Phase 2.)
4. Leaderboard "deepest floor today" in `rooms/_stat` (best depth is local only in the prototype). Anti-cheat level?
5. Checkpoint stairs (start at B6 / B11 after beating that boss today)? Proposed, not chosen.
6. Where the skills screen opens: village side menu, hub profile, or both (proposed: both).
7. Does the dungeon get its own building in the village, or stay in the arcade list?

## 10. Risks

| Risk | Mitigation |
|---|---|
| Runs too long for a break (B12 took 15 min in playtest 1) | checkpoint stairs (§9.5); pay cap means no reason to grind deep |
| Coin inflation | pay cap; run upgrades never touch coins; skill bonuses capped |
| Office PCs too slow for swarms | measured budget; monster cap 60; far monsters sleep; prerendered map |
| Fairness of a shared daily leaderboard | same seed for all; client-reported depth is fakeable: fine for an office game, or validate run length |
| Art licence | Kenney CC0; LimeZu avatars already used site-wide (non-commercial) |

## 11. Acceptance criteria for going live (Phase 1B)

- [ ] Owner playtest sign-off on B1–B10 feel (levelling pace, wave density, boss fights).
- [ ] Pay decision (§9.1) made and `DD.NORM` set; `PROG_NORM.dungeon` added in `office.js`.
- [ ] Added to `GAMES` in `index.html`; uses the real `Prog`, `Skills` (live), `meWho()`; best depth to `rooms/_stat`.
- [ ] `verify/run.py` screen with `?seed=`; desktop + phone screenshots; no console errors.
- [ ] `node _test/dungeon/test-gen.js` passes; browser smoke test (`_test/dungeon/test-play.py`) passes.
- [ ] Esc freezes the frame (pixel-identical over 1 s) on the live hub.

## 12. Next-level backlog (for the next agent to evaluate and extend)

Ranked by value ÷ cost; none are decided.

| # | Idea | Why it matters | Size |
|---|---|---|---|
| 1 | Checkpoint stairs (Stardew elevator) | short breaks still reach new depths | S |
| 2 | Daily leaderboard + "today's dungeon" card in the village | social pull, uses the shared seed | S–M |
| 3 | Combo meter (fast kills → gem multiplier, small heal at 20) | moment-to-moment juice | S |
| 4 | Potion belt (carry 2, drink on a button) | agency in hard fights | S |
| 5 | Village pet joins the run (follows, nips, fetches gems; Pet care tier scales it) | links skills and village | M–L |
| 6 | Today's twist (daily modifier: bats ×2, gems +50%…) | variety per day | S |
| 7 | Characters / starting kits (unlock by achievements) | Vampire Survivors-style replay | M |
| 8 | Banish / skip on level-up (from combat tier) | build control for theorycrafters | S |
| 9 | Elites (gold-outlined, drop a chest) and curse chests (harder floor, better reward) | risk/reward | M |
| 10 | Sound pass (hits, level-up, evolution sting) | feel; office: muted by default | S |
| 11 | New map Phase 2 on the same engine (`DE` + `DGen` with an outdoor generator; ore tile 56 for Mining) | the bigger plan | L |
| 12 | Ghost presence: see coworkers' "deepest today" markers on the floor where they fainted | social without co-op netcode | M |
