# Cozy village → live village (11 Nov 2026)

The prototype `_test/village-cozy-big.html` is now the live หมู่บ้าน tab.

## How it fits together
- `village-world.js` is generated from the prototype by `_test/gen_village_world.py`. Never edit it by hand: change the prototype or the generator, then run `python _test/gen_village_world.py`.
- The engine runs inside a shadow root in `.vil-wrap`, so its CSS can't leak into the page.
- `village.js` keeps every live system and passes them to the engine through `HOOKS`:
  - lots and their transactions
  - presence
  - bricks and road pickups
  - pets
  - delivery jobs
  - house gardens (real farm.js crops)
  - Prog coins
  - the wardrobe avatar
- Name tags and the lot, tower and board pills are drawn on the `#ov` overlay canvas.
- If the engine fails to start, the old Kenney map takes over (`startOld`).
- Art lives in `assets/village/`:
  - `maeve-atlas.png` (Maeve sheets packed into one image; credit stays on screen, the raw pack isn't shipped)
  - `kenney-*.png` (CC0)

## Decisions taken without asking (owner said continue)
- Lots 5 and 8 sat inside the new park, so they moved to (49,20) and (49,27). Ids, owners and data are unchanged; only the drawing position moved.
- Live prices are unchanged: lot 10,000 · starter 5,000 + 8 🧱 / 12 h · big 20,000 + 40 🧱 / 48 h · garden 14 = 10,000 + 30 veg / 24 h · move-in 5,000.
- House building, colours and garden size still come from the live lot card. The prototype's own house menu, upgrade card, garden card and garden rank were not ported, to avoid two price lists. A 🚪 button next to ✕ on the lot card enters a house that has a room.
- Rides cost Prog coins at live scale: bike 3,000 (×1.6), scooter 9,000 (×2.3). Each shows a preview first and buys on the second tap. They are saved in `prog.vil.rides`.
- Community farm:
  - The bag, chest and plots are saved in this browser (`localStorage vilCozy1`), not online yet.
  - You can grow up to 8 crops at once.
  - Coins you earn there are arcade coins.
  - A new player starts with a hoe, a watering can and 4 bok choy seeds.
  - The demo neighbour bots were removed.
- NPC friendship starts at 0 and is saved in this browser. Daily talks reset each day and gifts reset each week. A delivery job for that NPC shows as a button on their card.
- Keyboard walking is smooth, pixel by pixel (no cell stops). The verify test was changed to match.

## Not done yet
- Community farm plots aren't shared online, so other players don't see your community crops.
- The NPC friendship save is per browser.
