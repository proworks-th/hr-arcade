# Lessons for 🕹️ ตึกเกม (12 Nov 2026)

Studied (from memory of play / well-known design, no assets copied): Stardew Valley saloon arcade machines, Club Penguin / Habbo game rooms.

**Core loop:** walk into the hall → walk up to a machine → tap → play → come back standing at the same machine → tap again.

**Why it feels good**
1. Each game is a physical machine against the wall; tap it and the game starts, with no menus.
2. The machine shows today's #1, so the room itself works as the leaderboard.
3. You can see coworkers standing at machines live ("🎮 name กำลังเล่น"). That pulls people in.
4. Today's ⭐ ×2 machine glows. The trophy board by the wall opens the rankings.
5. After a game you're back at the same machine, so another round is one tap (plus the R hotkey).

**What we do differently:** our own pixel cabinets drawn in code (colour = the game's card colour, emoji on the screen), our 11 games, and the hall on the town street south of the lake. The owner chose to move the games fully into the hall: the home page shows one "ไปตึกเกม" card, and the old grid only comes back when the village is off (?village=0).

**Where:** building in `_test/gen_village_world.py` (slot 16, x61 y27, room kind 'arcade'; drawCab/drawTrophy); labels, live players and play/rank hooks in `village.js` (arcGames/arcRank/arcPlay, H.games/featured/play/arcadeRank); `goArcade()` in index.html.
