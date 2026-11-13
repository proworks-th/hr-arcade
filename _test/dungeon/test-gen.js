// node _test/dungeon/test-gen.js — builds thousands of floors and checks the rules that must never break
global.DD = require('../../dungeon/data.js'); global.DE = require('../../dungeon/engine.js'); const DGen = require('../../dungeon/gen.js');
const fails = [], stats = {}; let n = 0; const t0 = Date.now();
for (let day = 0; day < 50; day++) for (let depth = 1; depth <= 40; depth++) {
  const seed = '2026-11-' + String(day).padStart(2, '0'), f = DGen.floor(seed, depth), g = f.g, P = DD.PURPOSE[f.purpose]; n++;
  const bad = m => fails.push(`${seed} B${depth} ${f.purpose}: ${m}`);
  if (f.w < P.w[0] || f.w > P.w[1] || f.h < P.h[0] || f.h > P.h[1]) bad(`size ${f.w}×${f.h}`);
  if (depth % 5 === 0 && f.purpose !== 'lair') bad('boss floor is not a lair');
  const d = DGen.bfs(g, f.start.x, f.start.y); let open = 0, reached = 0;
  for (let i = 0; i < g.w * g.h; i++) if (!g.block[i]) { open++; if (d[i] >= 0) reached++; }
  if (reached !== open) bad(`${open - reached} open cells unreachable`);
  if (f.exit.forced || !DE.isFace(g, f.exit.x, f.exit.y)) bad('exit not on a wall face');
  if (d[(f.exit.y + 1) * g.w + f.exit.x] < 0) bad('cell in front of exit unreachable');
  for (const s of f.spawns) { if (g.block[s.y * g.w + s.x] && s.kind !== 'mimic') bad(`${s.kind} spawned in a wall`);
    if (Math.hypot(s.x - f.start.x, s.y - f.start.y) < 4) bad(`${s.kind} spawned on top of the start`); }
  if (f.spawns.filter(s => s.kind !== 'mimic').length < 3) bad('fewer than 3 monsters');
  if (f.purpose === 'lair' && !f.spawns.some(s => DD.MON[s.kind].boss)) bad('lair without a boss');
  if (f.purpose === 'vault' && !f.altar) bad('vault without an altar');
  const st = stats[f.purpose] ||= { n: 0, w: 0, h: 0, mon: 0, rooms: 0, walk: 0 };
  st.n++; st.w += f.w; st.h += f.h; st.mon += f.spawns.length; st.rooms += f.rooms.length; st.walk += d[(f.exit.y + 1) * g.w + f.exit.x];
}
// same seed + depth must give the same floor (the daily dungeon is the same for everyone)
const a = DGen.floor('2026-11-13', 7), b = DGen.floor('2026-11-13', 7);
if (Buffer.compare(Buffer.from(a.g.cells), Buffer.from(b.g.cells)) || JSON.stringify(a.spawns) !== JSON.stringify(b.spawns)) fails.push('not deterministic');
console.log(`${n} floors in ${Date.now() - t0} ms (${((Date.now() - t0) / n).toFixed(2)} ms each)`);
console.log('purpose  floors  avg size   rooms  monsters  start→exit (tiles)');
for (const [k, s] of Object.entries(stats)) console.log(k.padEnd(8), String(s.n).padStart(6), `${(s.w / s.n).toFixed(0)}×${(s.h / s.n).toFixed(0)}`.padStart(9), (s.rooms / s.n).toFixed(1).padStart(7), (s.mon / s.n).toFixed(1).padStart(9), (s.walk / s.n).toFixed(0).padStart(19));
console.log(fails.length ? `FAIL ${fails.length}\n` + [...new Set(fails.map(f => f.replace(/^\S+ B\d+ /, '')))].slice(0, 15).join('\n') + '\n…e.g. ' + fails[0] : 'ALL CHECKS PASS');
process.exit(fails.length ? 1 : 0);
