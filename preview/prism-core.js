// Prism Foundry rules engine — pure functions, no drawing. Used by the game (prism.js) and by the level checker
// (verify/prism-levels.js under Node). Same state + same move always gives the same result.
//
// Rules
// - Board = hex cells (axial q,r). Each cell holds a stack of energy units, bottom → top, at most CAP (4).
// - Reservoirs = side slots (capacity resCap) reachable from ANY cell; board cells only reach their 6 neighbours.
// - Move: the whole same-colour run on top of the source goes to the target, as many units as fit.
//   Legal when the target is empty or its top colour matches, and has room. Locked cells can't be used.
// - Charge: a board cell holding CAP units of one colour charges and clears. Every charge breaks the locks on
//   its neighbours; a freed cell that is already full of one colour charges in the next wave (chain).
// - Win: no energy left anywhere. Reservoirs never charge.
'use strict';
(function (root) {
  const CAP = 4;
  const COLORS = {
    R: { c: '#ff5c7a', d: '#c22d4d', sym: 'circle', n: 'แดง' },
    B: { c: '#4ca3ff', d: '#2264c4', sym: 'tri', n: 'ฟ้า' },
    Y: { c: '#ffd23f', d: '#c79a0a', sym: 'square', n: 'เหลือง' },
    G: { c: '#3ed18a', d: '#1d8e57', sym: 'diamond', n: 'เขียว' },
    P: { c: '#b07cff', d: '#7343c7', sym: 'star', n: 'ม่วง' },
  };
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  // Level definition: { cells: { 'q,r': 'RRB' | '' | '#B' (locked, holding B) | '#' (locked, empty) }, res: 1, resCap: 3, par }
  function load(def) {
    const keys = Object.keys(def.cells), pos = keys.map(k => k.split(',').map(Number));
    const idx = new Map(keys.map((k, i) => [k, i]));
    const nb = pos.map(([q, r]) => DIRS.map(([dq, dr]) => idx.get(`${q + dq},${r + dr}`)).filter(i => i !== undefined));
    const nBoard = keys.length, nRes = def.res || 0, resCap = def.resCap || CAP;
    const stacks = [], locked = [];
    for (const k of keys) { const s = def.cells[k]; locked.push(s[0] === '#'); stacks.push(s.replace('#', '')); }
    for (let i = 0; i < nRes; i++) { stacks.push(''); locked.push(false); }
    const geo = { pos, nb, nBoard, nRes, resCap };
    const st = { s: stacks, l: locked };
    check(geo, st);
    return { geo, st };
  }
  function check(geo, st) {
    const n = {};
    for (const s of st.s) for (const ch of s) { if (!COLORS[ch]) throw new Error('bad colour ' + ch); n[ch] = (n[ch] || 0) + 1; }
    for (const [ch, k] of Object.entries(n)) if (k % CAP) throw new Error(`colour ${ch} has ${k} units (needs a multiple of ${CAP})`);
    st.s.forEach((s, i) => { if (s.length > cap(geo, i)) throw new Error('stack over capacity at ' + i); });
  }
  const isRes = (geo, i) => i >= geo.nBoard;
  const cap = (geo, i) => isRes(geo, i) ? geo.resCap : CAP;
  const top = s => s[s.length - 1];
  const run = s => { let k = 0; const c = top(s); for (let i = s.length - 1; i >= 0 && s[i] === c; i--) k++; return k; };
  const clone = st => ({ s: st.s.slice(), l: st.l.slice() });
  const key = st => st.s.join('|') + '/' + st.l.map(b => b ? 1 : 0).join('');
  const done = st => st.s.every(s => !s);

  // why a move is illegal, or '' when it is fine
  function why(geo, st, a, b) {
    if (a === b) return 'same';
    if (st.l[a] || st.l[b]) return 'lock';
    if (!st.s[a]) return 'empty';
    if (!isRes(geo, a) && !isRes(geo, b) && !geo.nb[a].includes(b)) return 'far';
    const t = st.s[b];
    if (t.length >= cap(geo, b)) return 'full';
    if (t && top(t) !== top(st.s[a])) return 'color';
    return '';
  }
  function moves(geo, st) {
    const out = [], N = st.s.length;
    for (let a = 0; a < N; a++) {
      if (!st.s[a] || st.l[a]) continue;
      const sa = st.s[a], r = run(sa), mono = r === sa.length;
      for (let b = 0; b < N; b++) {
        if (why(geo, st, a, b)) continue;
        // pointless for the solver: a whole one-colour reservoir into another empty reservoir
        // (on the board the same move changes who the stack touches, so it stays)
        if (mono && !st.s[b] && isRes(geo, a) && isRes(geo, b)) continue;
        out.push([a, b]);
      }
    }
    return out;
  }
  // apply a legal move; returns { st, n (units moved), waves: [{ charged:[i], color:{i:ch}, freed:[i] }] }
  function apply(geo, st0, a, b) {
    const st = clone(st0), sa = st.s[a], c = top(sa);
    const n = Math.min(run(sa), cap(geo, b) - st.s[b].length);
    st.s[a] = sa.slice(0, sa.length - n); st.s[b] += c.repeat(n);
    return { st, n, color: c, waves: resolve(geo, st) };
  }
  function resolve(geo, st) {
    const waves = [];
    for (;;) {
      const charged = [];
      for (let i = 0; i < geo.nBoard; i++) { const s = st.s[i]; if (!st.l[i] && s.length === CAP && run(s) === CAP) charged.push(i); }
      if (!charged.length) break;
      const color = {}, freed = [];
      for (const i of charged) { color[i] = st.s[i][0]; st.s[i] = ''; }
      for (const i of charged) for (const j of geo.nb[i]) if (st.l[j]) { st.l[j] = false; freed.push(j); }
      waves.push({ charged, color, freed });
    }
    return waves;
  }
  // breadth-first search: shortest solution from st, or null if none; 'limit' when the search gave up
  function solve(geo, st, limit = 250000) {
    if (done(st)) return [];
    const seen = new Map([[key(st), null]]); let q = [st], n = 0;
    while (q.length) {
      const nq = [];
      for (const s of q) for (const [a, b] of moves(geo, s)) {
        const r = apply(geo, s, a, b), k = key(r.st);
        if (seen.has(k)) continue;
        seen.set(k, [key(s), a, b]);
        if (done(r.st)) { const path = []; let cur = k; while (seen.get(cur)) { const [p, x, y] = seen.get(cur); path.unshift([x, y]); cur = p; } return path; }
        if (++n > limit) return 'limit';
        nq.push(r.st);
      }
      q = nq;
    }
    return null;
  }
  // best-first search: finds *a* solution fast (not the shortest) — enough for a hint, which only has to keep
  // the level solvable. null = proven stuck (whole reachable space searched), 'limit' = gave up.
  function solveAny(geo, st, limit = 1500000) {
    if (done(st)) return [];
    const h = s => { let v = 0; for (let i = 0; i < s.s.length; i++) { const x = s.s[i]; if (!x) continue; v += x.length; for (let k = 1; k < x.length; k++) if (x[k] !== x[k - 1]) v += 2; if (s.l[i]) v += 1; } return v; };
    const heap = [], push = (p, v) => { heap.push([p, v]); let i = heap.length - 1; while (i) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top[1]; };
    const seen = new Map([[key(st), null]]); push(h(st), { st, g: 0 }); let n = 0;
    while (heap.length) {
      const { st: s, g } = pop(), ks = key(s);
      for (const [a, b] of moves(geo, s)) {
        const r = apply(geo, s, a, b), k = key(r.st);
        if (seen.has(k)) continue;
        seen.set(k, [ks, a, b]);
        if (done(r.st)) { const path = []; let cur = k; while (seen.get(cur)) { const [p, x, y] = seen.get(cur); path.unshift([x, y]); cur = p; } return path; }
        if (++n > limit) return 'limit';
        push(h(r.st) + (g + 1) * .3, { st: r.st, g: g + 1 });
      }
    }
    return null;
  }
  /* ---------- level generator (shared by the daily puzzle and `node verify/prism-levels.js gen`) ---------- */
  const LAYOUTS = {
    line3: ['0,0', '1,0', '2,0'], line4: ['0,0', '1,0', '2,0', '3,0'], tri: ['0,0', '1,0', '0,1'], diamond: ['0,0', '1,0', '0,1', '1,-1'],
    bar5: ['0,0', '1,0', '2,0', '0,1', '1,1'],
    flower: ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1'],
    wide: ['0,0', '1,0', '2,0', '3,0', '-1,1', '0,1', '1,1', '2,1'],
    flower9: ['0,0', '1,0', '1,-1', '0,-1', '-1,0', '-1,1', '0,1', '2,-1', '-2,1'],
    zig: ['0,0', '1,0', '1,-1', '2,-1', '0,1', '-1,1', '2,0'],
  };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // one random candidate for (opts, seed) → { def, par } when it is a good puzzle, else null.
  // Good = solvable, shortest solution lo..hi moves, nothing charged at the start, and (with a reservoir) the reservoir matters.
  function candidate(o, seed) {
    const cells = LAYOUTS[o.layout], r = rng(seed * 7919 + cells.length), units = [];
    for (const c of o.colours) for (let k = 0; k < CAP; k++) units.push(c);
    for (let i = units.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [units[i], units[j]] = [units[j], units[i]]; }
    const fill = cells.map(() => '');
    for (const u of units) { const open = fill.map((s, i) => s.length < CAP ? i : -1).filter(i => i >= 0); if (!open.length) return null; fill[open[Math.floor(r() * open.length)]] += u; }
    const def = { cells: {}, res: o.res, resCap: o.resCap };
    const lockSet = new Set(); while (lockSet.size < o.locks) lockSet.add(Math.floor(r() * cells.length));
    cells.forEach((k, i) => { def.cells[k] = (lockSet.has(i) ? '#' : '') + fill[i]; });
    if (fill.some((s, i) => !lockSet.has(i) && s.length === CAP && run(s) === CAP)) return null;
    let L; try { L = load(def); } catch (e) { return null; }
    const sol = solve(L.geo, L.st, o.limit || 300000);
    if (!Array.isArray(sol) || sol.length < o.lo || sol.length > o.hi) return null;
    if (o.res) { const L2 = load({ ...def, res: 0 }), s2 = solve(L2.geo, L2.st, o.limit || 300000); if (Array.isArray(s2) && s2.length <= sol.length) return null; }
    def.par = sol.length;
    return def;
  }
  const api = { CAP, COLORS, LAYOUTS, load, why, moves, apply, solve, solveAny, candidate, key, done, isRes, cap, top, run, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PrismCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
