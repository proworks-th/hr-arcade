// Floor generator: one call builds a whole floor from (day seed, depth). Pure — no DOM — so node can test it.
// Steps: purpose → size → rooms → corridors (spanning tree + a few loops, 2 tiles wide) → walls → start/exit →
// props, chests (some are mimics), spikes, an altar on vault floors → monsters by room, depth and purpose.
// Everyone gets the same floors on the same day ("new random map every day", owner 12 Nov 2026).
'use strict';
const DGen = (() => {
  const { FLOOR, WALL, VOID } = DE;

  function floor(seed, depth) {
    const r = DE.rng(seed + '#' + depth), purpose = DD.purposeFor(depth, r), P = DD.PURPOSE[purpose];
    const w = r.int(P.w[0], P.w[1]), h = r.int(P.h[0], P.h[1]), g = DE.grid(w, h), rooms = [];
    const fits = (x, y, rw, rh) => x >= 2 && y >= 3 && x + rw <= w - 2 && y + rh <= h - 2 && rooms.every(o => x > o.x + o.w + 2 || x + rw + 2 < o.x || y > o.y + o.h + 3 || y + rh + 3 < o.y);
    // boss lair: one big arena first, so it always fits
    if (P.boss) { const rw = Math.min(16, w - 10), rh = Math.min(11, h - 10); rooms.push({ x: (w - rw) >> 1, y: 3 + r.int(0, 2), w: rw, h: rh, boss: true }); }
    const want = r.int(P.rooms[0], P.rooms[1]);
    for (let tries = 0; rooms.length < want && tries < 600; tries++) {
      const rw = r.int(P.room[0], P.room[1]), rh = r.int(P.room[2], P.room[3]), x = r.int(2, w - rw - 2), y = r.int(3, h - rh - 2);
      if (fits(x, y, rw, rh)) rooms.push({ x, y, w: rw, h: rh });
    }
    rooms.forEach((R, i) => { R.id = i; R.cx = R.x + (R.w >> 1); R.cy = R.y + (R.h >> 1);
      for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) { g.cells[y * w + x] = FLOOR; g.room[y * w + x] = i; } });

    // ---- corridors: Prim's spanning tree on room centres, then extra links for loops (mazes get more) ----
    const d2 = (a, b) => (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2, links = [], inTree = [0];
    while (inTree.length < rooms.length) {
      let best = null;
      for (const i of inTree) for (let j = 0; j < rooms.length; j++) if (!inTree.includes(j)) { const d = d2(rooms[i], rooms[j]); if (!best || d < best[2]) best = [i, j, d]; }
      links.push(best); inTree.push(best[1]);
    }
    const loops = P.loops ?? .2;
    rooms.forEach((a, i) => { if (r() < loops) { const near = rooms.map((b, j) => [j, d2(a, b)]).filter(([j]) => j !== i && !links.some(l => (l[0] === i && l[1] === j) || (l[0] === j && l[1] === i))).sort((p, q) => p[1] - q[1])[0];
      if (near) links.push([i, near[0], 0]); } });
    const dig = (x, y) => { for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const X = x + ox, Y = y + oy; if (X > 0 && Y > 1 && X < w - 1 && Y < h - 1) g.cells[Y * w + X] = FLOOR; } };
    for (const [i, j] of links) { const a = rooms[i], b = rooms[j];
      if (r() < .5) { for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) dig(x, a.cy); for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) dig(b.cx, y); }
      else { for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) dig(a.cx, y); for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) dig(x, b.cy); } }

    // ---- walls: anything touching floor; then a top strip above every brick face so walls read as raised ----
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g.cells[y * w + x] === VOID) {
      let near = false; for (let oy = -1; oy <= 1 && !near; oy++) for (let ox = -1; ox <= 1; ox++) if (DE.at(g, x + ox, y + oy) === FLOOR) { near = true; break; }
      if (near) g.cells[y * w + x] = WALL; }
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) if (g.cells[y * w + x] === VOID && DE.isFace(g, x, y + 1)) g.cells[y * w + x] = WALL;
    for (let i = 0; i < w * h; i++) g.block[i] = g.cells[i] === FLOOR ? 0 : 1;
    g.rooms = rooms;

    // ---- start + exit: exit is the room farthest from the start by walking distance (the boss arena on lairs) ----
    const start = P.boss ? rooms.slice(1).sort((a, b) => b.cy - a.cy)[0] || rooms[0] : rooms[r.int(0, rooms.length - 1)];
    const dist = bfs(g, start.cx, start.cy);
    // the exit door sits in a room's top wall, on a brick face, near the middle. Farthest room first; if corridors
    // ate that room's whole top wall, the next farthest room takes it.
    const order = P.boss ? [rooms[0]] : rooms.filter(R => R !== start).sort((a, b) => dist[b.cy * w + b.cx] - dist[a.cy * w + a.cx]);
    let exit = null, exitRoom = order[0];
    for (const R of order) { for (let k = 0; k < R.w * 2 && !exit; k++) { const x = R.cx + (k % 2 ? -(k + 1 >> 1) : k >> 1);
      if (x >= R.x && x < R.x + R.w && DE.isFace(g, x, R.y - 1)) exit = { x, y: R.y - 1 }; } if (exit) { exitRoom = R; break; } }
    if (!exit) { exit = { x: exitRoom.cx, y: exitRoom.y - 1, forced: true }; g.cells[exit.y * w + exit.x] = WALL; g.block[exit.y * w + exit.x] = 1; }
    start.start = true; exitRoom.exit = true;

    // ---- things in rooms (only on cells whose 8 neighbours are open floor, so nothing can ever cut a path) ----
    const used = new Set(), key = (x, y) => y * w + x;
    const open8 = (x, y) => { for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const X = x + ox, Y = y + oy; if (DE.at(g, X, Y) !== FLOOR || g.block[key(X, Y)] || used.has(key(X, Y))) return false; } return true; };
    const nearExit = (x, y) => Math.abs(x - exit.x) <= 1 && y - exit.y <= 2;
    const spot = (R, pad = 1) => { for (let t = 0; t < 40; t++) { const x = r.int(R.x + pad, R.x + R.w - 1 - pad), y = r.int(R.y + pad, R.y + R.h - 1 - pad);
      if (open8(x, y) && !nearExit(x, y) && !(R === start && Math.abs(x - start.cx) <= 1 && Math.abs(y - start.cy) <= 1)) return [x, y]; } return null; };
    // monsters don't block anyone, so they only need an open cell away from the start and the exit
    const monSpot = R => { for (let t = 0; t < 60; t++) { const x = r.int(R.x, R.x + R.w - 1), y = r.int(R.y, R.y + R.h - 1);
      if (!g.block[key(x, y)] && !used.has(key(x, y)) && !nearExit(x, y) && Math.hypot(x - start.cx, y - start.cy) >= 5) return [x, y]; } return null; };
    const props = [];
    for (const R of rooms) { if (R.boss) continue; const n = r.int(0, Math.floor(R.w * R.h / (purpose === 'vault' ? 30 : 16)));
      for (let i = 0; i < n; i++) { const s = spot(R); if (!s) break; props.push({ id: r.pick(DD.T.props), x: s[0], y: s[1] }); g.block[key(...s)] = 1; used.add(key(...s)); } }
    const chests = [], others = rooms.filter(R => R !== start && !R.boss), nCh = r.int(P.chests[0], P.chests[1]);
    for (let i = 0; i < nCh && others.length; i++) { const R = r.pick(others), s = spot(R); if (!s) continue;
      chests.push({ x: s[0], y: s[1], mimic: purpose !== 'vault' && r() < DD.MIMIC_CHANCE(depth) }); used.add(key(...s)); }
    let altar = null;
    if (P.altar) for (const R of [...rooms].sort((a, b) => (a === start) - (b === start) || b.w * b.h - a.w * a.h)) {
      const s = spot(R, 2) || spot(R, 1); if (s) { altar = { x: s[0], y: s[1] }; g.block[key(...s)] = 1; used.add(key(...s)); break; } }
    const spikes = [];
    if (depth >= 3 && purpose !== 'vault') { const n = Math.floor(w * h / 260);
      for (let i = 0; i < n; i++) { const R = r.pick(others.length ? others : rooms), s = spot(R, 0); if (s) { spikes.push({ x: s[0], y: s[1], ph: r() }); used.add(key(...s)); } } }

    // ---- monsters: a budget from room area × density, shared out by room size; types by depth and purpose ----
    const sc = DD.scale(depth), bias = { maze: { bat: 2, rat: 2 }, nest: { slime: 2, bigslime: 2, spider: 1.5 } }[purpose] || {};
    const pool = Object.entries(DD.MON).filter(([, m]) => m.w > 0 && m.from <= depth).map(([id, m]) => [id, m.w * (bias[id] || 1)]);
    const pickMon = () => { let t = r() * pool.reduce((s, x) => s + x[1], 0); for (const [id, n] of pool) if ((t -= n) < 0) return id; return 'slime'; };
    const fightRooms = rooms.filter(R => R !== start), area = fightRooms.reduce((s, R) => s + R.w * R.h, 0);
    let budget = Math.max(3, Math.round(area * P.dens * sc.dens));
    const spawns = [];
    if (P.boss) { const R = rooms[0]; spawns.push({ kind: DD.bossFor(depth), x: R.cx, y: R.cy - 1 }); budget = Math.round(budget * .6); }
    for (const R of fightRooms) {
      let n = Math.round(budget * R.w * R.h / area);
      while (n > 0) { const kind = pickMon(), m = DD.MON[kind], group = m.group ? r.int(m.group[0], m.group[1]) : 1;
        for (let k = 0; k < group && n > 0; k++, n--) { const s = monSpot(R); if (!s) { n = 0; break; } spawns.push({ kind, x: s[0], y: s[1] }); used.add(key(...s)); } }
    }
    // rounding and crowded rooms can leave a floor short: top it up so every floor has a real fight
    for (let t = 0; spawns.filter(x => !DD.MON[x.kind].boss).length < Math.max(3, Math.round(budget * .9)) && t < 200; t++) {
      const R = r.pick(fightRooms.length ? fightRooms : rooms), s = monSpot(R); if (s) { spawns.push({ kind: pickMon(), x: s[0], y: s[1] }); used.add(key(...s)); } }
    for (const c of chests) if (c.mimic) spawns.push({ kind: 'mimic', x: c.x, y: c.y, chest: c });

    return { seed, depth, purpose, name: P.name, theme: DD.themeFor(depth), w, h, g, rooms, start: { x: start.cx, y: start.cy }, exit, props, chests, altar, spikes, spawns,
      reach: dist };
  }

  // breadth-first walking distance over open cells from (sx, sy); returns an Int16Array (−1 = unreachable)
  function bfs(g, sx, sy) {
    const d = new Int16Array(g.w * g.h).fill(-1); if (DE.solid(g, sx, sy)) return d;
    const q = [sy * g.w + sx]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % g.w;
      for (const j of [x > 0 ? i - 1 : -1, x < g.w - 1 ? i + 1 : -1, i - g.w, i + g.w]) if (j >= 0 && j < d.length && d[j] < 0 && !g.block[j]) { d[j] = d[i] + 1; q.push(j); } }
    return d;
  }
  return { floor, bfs };
})();
if (typeof module !== 'undefined') module.exports = DGen;
