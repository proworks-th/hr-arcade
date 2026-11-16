// Prism Foundry level checker / generator (Node, no packages).
//   node verify/prism-levels.js            → solve every shipped level, check par, print a table (exit 1 on any problem)
//   node verify/prism-levels.js gen <layout> <colours> <res> <resCap> <locks> <lo> <hi> [tries]
//                                          → print random levels whose shortest solution is lo..hi moves
'use strict';
const P = require('../prism-core.js');
const LEVELS = require('../prism-levels.js');

const LAYOUTS = {
  line3: ['0,0', '1,0', '2,0'],
  line4: ['0,0', '1,0', '2,0', '3,0'],
  tri: ['0,0', '1,0', '0,1'],
  diamond: ['0,0', '1,0', '0,1', '1,-1'],
  bar5: ['0,0', '1,0', '2,0', '0,1', '1,1'],
  flower: ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'],
  wide: ['0,0', '1,0', '2,0', '3,0', '-1,1', '0,1', '1,1', '2,1'],
  flower9: ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1', '2,-1', '-2,1'],
  ring: ['1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1', '2,-1', '-2,1', '0,0'],
};

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function report(def, i) {
  const { geo, st } = P.load(def);
  const t = Date.now(), sol = P.solve(geo, st, 2000000);
  const ms = Date.now() - t;
  let noRes = '-';
  if (def.res) { const d2 = { ...def, res: 0 }; const L = P.load(d2), s2 = P.solve(L.geo, L.st, 2000000); noRes = s2 === null ? 'needs' : s2 === 'limit' ? '?' : s2.length; }
  return { i: i + 1, name: def.name, cells: geo.nBoard, res: def.res || 0, par: def.par, best: Array.isArray(sol) ? sol.length : sol, noRes, ms, sol };
}

if (process.argv[2] === 'gen') {
  const [, , , layout, colours, res, resCap, locks, lo, hi, tries = '4000'] = process.argv;
  const cells = LAYOUTS[layout]; if (!cells) throw new Error('layouts: ' + Object.keys(LAYOUTS).join(' '));
  let found = 0;
  for (let seed = 1; seed <= +tries && found < 6; seed++) {
    const r = rng(seed * 7919 + cells.length), units = [];
    for (const c of colours) for (let k = 0; k < P.CAP; k++) units.push(c);
    for (let i = units.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [units[i], units[j]] = [units[j], units[i]]; }
    const fill = cells.map(() => '');
    let ok = true;
    for (const u of units) { const open = fill.map((s, i) => s.length < P.CAP ? i : -1).filter(i => i >= 0); if (!open.length) { ok = false; break; } fill[open[Math.floor(r() * open.length)]] += u; }
    if (!ok) continue;
    const def = { cells: {}, res: +res, resCap: +resCap };
    const lockSet = new Set(); while (lockSet.size < +locks) lockSet.add(Math.floor(r() * cells.length));
    cells.forEach((k, i) => { def.cells[k] = (lockSet.has(i) ? '#' : '') + fill[i]; });
    let L; try { L = P.load(def); } catch { continue; }
    // no cell may start already charged or one move from trivially clearing everything
    if (fill.some((s, i) => !lockSet.has(i) && s.length === P.CAP && P.run(s) === P.CAP)) continue;
    const sol = P.solve(L.geo, L.st, 600000);
    if (!Array.isArray(sol) || sol.length < +lo || sol.length > +hi) continue;
    if (def.res) { const L2 = P.load({ ...def, res: 0 }), s2 = P.solve(L2.geo, L2.st, 600000); if (Array.isArray(s2) && s2.length <= sol.length) continue; }
    found++;
    console.log(JSON.stringify({ cells: def.cells, res: def.res, resCap: def.resCap, par: sol.length }), '// seed', seed);
  }
  if (!found) console.log('nothing found');
} else {
  let bad = 0; const rows = [];
  LEVELS.forEach((d, i) => {
    let r; try { r = report(d, i); } catch (e) { console.log(`#${i + 1} ${d.name}: ${e.message}`); bad++; return; }
    const okPar = r.best === r.par;
    if (!okPar) bad++;
    rows.push(`${String(r.i).padStart(2)} ${okPar ? 'ok ' : 'BAD'} ${r.name.padEnd(22)} cells ${String(r.cells).padStart(2)} res ${r.res}  par ${String(r.par).padStart(2)}  best ${String(r.best).padStart(5)}  without-res ${String(r.noRes).padStart(5)}  ${r.ms} ms`);
  });
  console.log(rows.join('\n'));
  if (process.argv[2] === 'sol') LEVELS.forEach((d, i) => { const r = report(d, i); console.log(i + 1, JSON.stringify(r.sol)); });
  process.exit(bad ? 1 : 0);
}
