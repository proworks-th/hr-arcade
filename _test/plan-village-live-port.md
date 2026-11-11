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
- Community farm (online since 11 Nov 2026, owner's rules: anyone may pick a ripe crop, plots are never reset):
  - Every plot lives in `rooms/_vil/cfarm/{x_y}` = `{o, by, bn, c, t, w, fw, rt, hk, hn}`; one shared listener keeps all players' plots in step.
  - Till, plant, water and harvest each run as a transaction: the engine's `act()` runs first on the server's copy as a dry run, then once more locally for the bag and coins after it commits. Two people can't plant the same plot.
  - Anyone can harvest any ripe crop; the planter gets +1 น้ำใจ and a toast when someone else picks theirs. Tilled plots stay tilled forever (the old 3-day weeds rule is gone).
  - The village order is shared in `rooms/_vil/corder` = `{i, n, by, nm, h}`. When it fills, the givers are written into `h` (last 10 orders) and each player claims their own reward (50 + 8 per crop, +3 น้ำใจ) the next time they see it, online or not. Crops that didn't fit go back to the bag.
  - The bag, chest, NPC hearts and farm counters are saved in Prog (`prog.vil.cozy`, a JSON string so empty slots survive), so they follow the player's Google save. The old per-browser save (`localStorage vilCozy1`) is moved in once; crops still growing in it come back as seeds.
  - You can grow up to 8 crops at once. Coins are arcade coins. A new player starts with a hoe, a watering can and 4 bok choy seeds.
  - Firebase rules: no change needed (`rooms/$room` already covers `_vil`).
- NPC friendship starts at 0 and is saved with the bag in Prog. Daily talks reset each day and gifts reset each week. A delivery job for that NPC shows as a button on their card.
- Keyboard walking is smooth, pixel by pixel (no cell stops). The verify test was changed to match.

## Not done yet
- No server-side validation on `cfarm` / `corder` yet (any client could write anything there, like the other `rooms/*` data).
- Plant times use each player's clock corrected by the server offset; a player whose clock is badly wrong could still pick a crop early, because ripeness is checked on their own device.
