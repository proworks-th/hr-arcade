# Plan: cozy village goes live (tonight's build) — 10 Nov 2026

## TL;DR
- **Same village, new skin + new life.** Keep everything village.js already does (12 lots, building stages, bricks,
  board jobs, pets, gardens, coworkers walking live). Swap only the drawing for the Farm RPG pack look from
  `_test/village-cozy.html`, then add villager friendship and the Loy Krathong festival.
- **No data changes for old saves.** Lot positions, stages and save fields stay the same; new things get new fields.
- **Your avatar and clothes stay.** People are still drawn with `drawChar` (16×32, same pixel size as the pack),
  so the wardrobe keeps working. Crops stay the farm's own crops.
- **Safe switch.** Everything ships behind `?cozy=1` first. The live look changes only when you say so.
- **Order tonight:** A new look → B villager friendship → C Loy Krathong festival. A must finish; B and C if time allows.
- **Commit locally only, no push** (HR Arcade rule).

## A. New look (must finish)
| What | How |
|---|---|
| Ground | Grass autotile over dirt roads, stone plaza, pond (from the prototype). Painted once to an offscreen canvas. |
| Lots by stage | 0 sign · 1 stakes + sign · 2 building = foundation, built = cottage · 3 big house (frame while building) · 4 garden fenced · 5 moved in + door wreath/lantern. Same `LOTS` x/y, the house fits in X..X+4. |
| Roof / wall colours | Palette-swap the pack house per `ROOFS` / `WALLS` (cached per colour pair), so paid paint still shows. |
| Front extras (XTRA) | Map each to a pack sprite or a matching hand-drawn sprite. |
| Trees, fences, stumps | Pack maple trees around the edges and between lanes; fences around gardens. |
| Depth | One y-sorted list: houses, trees, fences, people, pets, NPCs, so you walk behind roofs. |
| Time of day | Real Thai clock: morning warm, noon clear, sunset pink, night dark blue + window glow. |
| Tower, board, well | Keep spots; draw in the pack style (tower like the prototype). |
| Credit | "Art: Tiny Farm RPG by Maeve Devs" in the village footer. Pack files packed into one atlas in `assets/village/` with the licence note. |

Done when: `?cozy=1` shows the full live village in the new look, every stage of a lot looks right, the build card,
bricks, board, pets and coworkers all still work, and there are no console errors.

## B. Villager friendship (if time)
- Three villagers (ป้าแม่ครัว, ลุงยาม, น้องฝึกงาน) move to set places by the real hour (canteen at lunch, plaza in the evening).
- Tap one → card: 10 hearts (250 points each), talk once a day +20, gifts 2 a week from your farm crops:
  loved +80, liked +45, other +20. Each villager loves one crop and likes two. No decay, no dating.
- Hearts unlock: ❤️3 a recipe, ❤️5 a 10% shop discount, ❤️8 a decor item for your house.
- Saved in `prog.vil.npc = {id: {p, td, gw, gn}}` (points, talk day, gift week, gifts this week). Mine only, no shared writes.

## C. Loy Krathong festival (if time)
- Runs on the real date (**24 Nov 2026 — please confirm**), from 17:00 to midnight Thai time; `?fest=loy` previews it any day.
- Village redecorated: lights over the plaza, lanterns, villagers gather at the pond.
- One activity: float your krathong (1 button, once a night) → +30 🪙 and a badge. Everyone's krathong floats on the
  pond with their name, shared through `rooms/_vil/fest/2026-loy/{key}`.
- Small festival shop (limited): krathong lantern decor, a flower garland for the door. Paid in coins.

## Not tonight (later)
- Seasons that repaint the map (needs the full pack, $6.49, or our own recolour).
- A calendar and a "festival in 3 days" note in the feed.
- More festivals: New Year, Songkran, payday market.

## How I'll check it
- In-page checks with `Village._dbg` + fixed-step ticks (the hidden pane and headless browsers don't work here).
- `python verify/run.py` if it launches; it failed tonight on this PC, so the in-page checks are the fallback.
- Phone width 375 px: no sideways scroll, buttons ≥ 44 px.
- Test mode only (`?test=1`), never the real Firebase.

## Risks
- The pack's big house is 4.5 tiles wide, tight next to the garden. Fallback: draw it 1 px narrower or shift the garden.
- Palette swap may look off on some colour pairs. Fallback: tint the roof only.
- The raw pack files become public on GitHub Pages; the licence allows use in a game, and packing them into one
  atlas avoids sharing them as a loose pack.
