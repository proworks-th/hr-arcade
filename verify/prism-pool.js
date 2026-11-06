// Generate solver-checked Prism puzzles offline (the browser can't afford the search).
//   node verify/prism-pool.js '<opts json>' <seedFrom> <want> <out.jsonl>
// opts = { layout, colours, res, resCap, locks, lo, hi, limit } (see PrismCore.candidate). Appends one level per line.
'use strict';
const fs = require('fs'), P = require('../prism-core.js');
const [, , optsJson, from, want, out] = process.argv;
const o = JSON.parse(optsJson);
let got = 0;
for (let seed = +from; got < +want; seed++) {
  const def = P.candidate(o, seed);
  if (!def) continue;
  got++;
  fs.appendFileSync(out, JSON.stringify({ cfg: o.layout + '/' + o.colours, seed, ...def }) + '\n');
  console.log(new Date().toISOString().slice(11, 19), o.layout, o.colours, 'seed', seed, 'par', def.par);
}
