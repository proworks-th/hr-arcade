// Builds prism-climb.js (endless tower pool) from the offline tiers t1..t7 + the daily pool, easy → hard.
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '../..');
const rd = t => { const f = path.join(__dirname, t + '.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []; };
const win = {}; new Function('window', fs.readFileSync(path.join(root, 'prism-daily.js'), 'utf8'))(win);
const clean = p => ({ cells: p.cells, res: p.res || 0, resCap: p.resCap || 0, par: p.par });
const byPar = a => a.slice().sort((x, y) => x.par - y.par);
const seen = new Set(), out = [];
for (const tier of [rd('t1'), rd('t2'), rd('t3'), rd('t4'), rd('t5'), win.PRISM_DAILY || [], rd('t7')])
  for (const p of byPar(tier)) { const k = JSON.stringify(p.cells); if (!seen.has(k)) { seen.add(k); out.push(clean(p)); } }
fs.writeFileSync(path.join(root, 'prism-climb.js'), `/* Prism 🗼 endless tower pool, easy → hard (built by _test/climb/build.js from solver-checked offline tiers + the daily pool).
   Past the last floor prism.js reuses the hardest quarter with shuffled colours. */
window.PRISM_CLIMB = [\n${out.map(p => '  ' + JSON.stringify(p)).join(',\n')}\n];\n`);
console.log('floors', out.length, 'pars', out.map(p => p.par).join(' '));
