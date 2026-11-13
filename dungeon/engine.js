// Dungeon engine (DE): the reusable half — seeded randomness, tile grid, collision, line of sight, a shared flow field
// for monster pathing, and the drawing side (pre-rendered map, fog of war, minimap, camera).
// Built for the arcade dungeon first and meant to carry the new map later (Mining / Foraging), so nothing here
// knows about monsters or scores. The top half is pure (runs in node for tests); the drawing half needs a DOM.
'use strict';
const DE = (() => {
  // ---------- seeded randomness ----------
  // same seed → same floor for everyone (the daily dungeon), and a fixed ?seed= for tests
  function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return (h ^= h >>> 16) >>> 0; }
  function rng(seed) { let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
    const r = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)); r.pick = a => a[Math.floor(r() * a.length)];
    r.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    return r; }

  // ---------- grid ----------
  const VOID = 0, FLOOR = 1, WALL = 2;
  // cells: what the map is (void / floor / wall). block: what stops feet (walls, void, props). Both w×h bytes.
  function grid(w, h) { return { w, h, cells: new Uint8Array(w * h), block: new Uint8Array(w * h).fill(1), room: new Int16Array(w * h).fill(-1) }; }
  const inb = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;
  const at = (g, x, y) => inb(g, x, y) ? g.cells[y * g.w + x] : VOID;
  const solid = (g, x, y) => !inb(g, x, y) || g.block[y * g.w + x] === 1;
  // a wall cell with floor right below it shows its brick face (the only walls you see from the front)
  const isFace = (g, x, y) => at(g, x, y) === WALL && at(g, x, y + 1) === FLOOR;

  // line of sight between two cells (Bresenham over blocking cells); props block sight too
  function los(g, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (let n = 0; n < 200; n++) { if (x0 === x1 && y0 === y1) return true; if ((n > 0) && solid(g, x0, y0)) return false;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    return false;
  }

  // ---------- flow field ----------
  // one breadth-first search from the player, shared by every monster: each monster just walks downhill.
  // Recomputed only when the player changes cell (60×40 = 2,400 cells → well under a millisecond).
  function flow(g) {
    const d = new Int16Array(g.w * g.h), q = new Int32Array(g.w * g.h); let ox = -1, oy = -1;
    return {
      d,
      update(cx, cy, max = 48) {
        if (cx === ox && cy === oy) return false; ox = cx; oy = cy; d.fill(-1);
        if (solid(g, cx, cy)) return true;
        let h = 0, t = 0; q[t++] = cy * g.w + cx; d[cy * g.w + cx] = 0;
        while (h < t) { const i = q[h++], x = i % g.w, y = (i / g.w) | 0, v = d[i]; if (v >= max) continue;
          if (x > 0 && d[i - 1] < 0 && !g.block[i - 1]) { d[i - 1] = v + 1; q[t++] = i - 1; }
          if (x < g.w - 1 && d[i + 1] < 0 && !g.block[i + 1]) { d[i + 1] = v + 1; q[t++] = i + 1; }
          if (y > 0 && d[i - g.w] < 0 && !g.block[i - g.w]) { d[i - g.w] = v + 1; q[t++] = i - g.w; }
          if (y < g.h - 1 && d[i + g.w] < 0 && !g.block[i + g.w]) { d[i + g.w] = v + 1; q[t++] = i + g.w; } }
        return true;
      },
      dist: (cx, cy) => inb(g, cx, cy) ? d[cy * g.w + cx] : -1,
      // the neighbour (8 ways, no corner cutting) that is closest to the player; null = no path
      next(cx, cy) {
        if (!inb(g, cx, cy)) return null; let best = d[cy * g.w + cx], bx = null, by = null;
        if (best < 0) best = 1e9;
        for (let oy2 = -1; oy2 <= 1; oy2++) for (let ox2 = -1; ox2 <= 1; ox2++) {
          if (!ox2 && !oy2) continue; const x = cx + ox2, y = cy + oy2; if (!inb(g, x, y)) continue;
          const v = d[y * g.w + x]; if (v < 0) continue;
          if (ox2 && oy2 && (solid(g, cx + ox2, cy) || solid(g, cx, cy + oy2))) continue;
          const s = v + (ox2 && oy2 ? .4 : 0); if (s < best) { best = s; bx = x; by = y; }
        }
        return bx === null ? null : [bx, by];
      },
    };
  }

  // ---------- movement ----------
  // feet box [x−r, x+r] × [y−r·0.7, y]; moves one axis at a time so you slide along walls
  function blocked(g, T, x, y, r) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r * .7) / T), y1 = Math.floor(y / T);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (solid(g, cx, cy)) return true;
    return false;
  }
  function move(g, T, e, dx, dy, r) {
    let hitX = false, hitY = false;
    if (dx) { if (!blocked(g, T, e.x + dx, e.y, r)) e.x += dx; else hitX = true; }
    if (dy) { if (!blocked(g, T, e.x, e.y + dy, r)) e.y += dy; else hitY = true; }
    return hitX || hitY;
  }

  // ---------- drawing (DOM only) ----------
  // the whole floor is painted once at native 16 px; each frame draws just the visible slice scaled ×3
  function paintMap(g, theme, tile, r) {
    const S = 16, c = document.createElement('canvas'); c.width = g.w * S; c.height = g.h * S;
    const x2 = c.getContext('2d'); x2.imageSmoothingEnabled = false;
    x2.fillStyle = theme.void; x2.fillRect(0, 0, c.width, c.height);
    const put = (id, x, y) => { const t = tile(id); if (t) x2.drawImage(t, x * S, y * S); };
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const v = g.cells[y * g.w + x];
      if (v === FLOOR) put(r() < theme.rate ? r.pick(theme.deco) : theme.base, x, y);
      else if (v === WALL) {
        if (isFace(g, x, y)) put(r.pick(DD.T.faceAlt), x, y);
        else { x2.fillStyle = theme.top; x2.fillRect(x * S, y * S, S, S); x2.fillStyle = theme.rim;
          // a light rim where the wall top meets something lower, so the map reads as raised walls
          if (at(g, x - 1, y) === FLOOR || isFace(g, x - 1, y)) x2.fillRect(x * S, y * S, 1, S);
          if (at(g, x + 1, y) === FLOOR || isFace(g, x + 1, y)) x2.fillRect(x * S + S - 1, y * S, 1, S);
          if (at(g, x, y + 1) === WALL && isFace(g, x, y + 1)) x2.fillRect(x * S, y * S + S - 1, S, 1);
          if (at(g, x, y - 1) === FLOOR) x2.fillRect(x * S, y * S, S, 1); }
      }
    }
    if (theme.wash) { x2.fillStyle = theme.wash; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y * g.w + x] === FLOOR) x2.fillRect(x * S, y * S, S, S); }
    // soft shadow under every wall face
    x2.fillStyle = 'rgba(0,0,0,.28)';
    for (let y = 1; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y * g.w + x] === FLOOR && isFace(g, x, y - 1)) x2.fillRect(x * S, y * S, S, 2);
    return c;
  }
  // fog of war: one pixel per cell, drawn scaled up with smoothing on, which gives soft edges for free
  function fog(g) {
    const c = document.createElement('canvas'); c.width = g.w; c.height = g.h; const x2 = c.getContext('2d');
    x2.fillStyle = '#0c0812'; x2.fillRect(0, 0, g.w, g.h);
    const seen = new Uint8Array(g.w * g.h); let fresh = [];
    return { c, seen,
      // reveal a radius around the player, plus the whole room they stand in
      reveal(cx, cy, rad = 5) { fresh = [];
        const open = (x, y) => { if (!inb(g, x, y)) return; const i = y * g.w + x; if (seen[i]) return; seen[i] = 1; fresh.push(i); x2.clearRect(x, y, 1, 1); };
        for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad + 1) open(x, y);
        const rm = inb(g, cx, cy) ? g.room[cy * g.w + cx] : -1;
        if (rm >= 0 && g.rooms) { const R = g.rooms[rm]; for (let y = R.y - 2; y <= R.y + R.h; y++) for (let x = R.x - 1; x <= R.x + R.w; x++) open(x, y); }
        return fresh; },
      revealAll() { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (!seen[y * g.w + x]) { seen[y * g.w + x] = 1; } x2.clearRect(0, 0, g.w, g.h); } };
  }
  // minimap: 1 px per cell, updated only for newly revealed cells
  function minimap(g) {
    const c = document.createElement('canvas'); c.width = g.w; c.height = g.h; const x2 = c.getContext('2d');
    return { c, add(list) { for (const i of list) { const v = g.cells[i]; if (v === VOID) continue; x2.fillStyle = v === FLOOR ? (g.block[i] ? '#8b7a6b' : '#d8c8b0') : '#5b4c66'; x2.fillRect(i % g.w, (i / g.w) | 0, 1, 1); } } };
  }
  // camera: follows a point, stops at the map edge, snaps to whole art pixels (×3) so tiles never shimmer
  function camera(W, H, mw, mh) {
    const cam = { x: 0, y: 0, W, H,
      follow(px, py, dt, snap = 3) {
        const tx = Math.max(0, Math.min(mw - W, px - W / 2)), ty = Math.max(0, Math.min(mh - H, py - H / 2));
        const k = dt ? 1 - Math.exp(-dt * 10) : 1; cam.fx = (cam.fx ?? tx) + (tx - (cam.fx ?? tx)) * k; cam.fy = (cam.fy ?? ty) + (ty - (cam.fy ?? ty)) * k;
        cam.x = Math.round(cam.fx / snap) * snap; cam.y = Math.round(cam.fy / snap) * snap; },
      sees: (x, y, m = 64) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m };
    return cam;
  }

  return { hash, rng, VOID, FLOOR, WALL, grid, inb, at, solid, isFace, los, flow, blocked, move, paintMap, fog, minimap, camera };
})();
if (typeof module !== 'undefined') module.exports = DE;
