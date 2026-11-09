// "หมู่บ้าน" — the home page's third view (village v2.0, see _test/gdd-village.md and _test/plan-village-build.md).
// Step 1 = groundwork: the map, 12 empty lots in 2 lanes, the office tower, walking with your own avatar.
// Reserving and building come in step 4; until the release step the tab is hidden behind a flag:
//   ?village=1 turns it on for this browser (remembered), ?village=0 turns it off; test mode (?test=1) always shows it.
// Art: Kenney Tiny Town + Tiny Farm (CC0, assets/village/). Classic script after solo-games.js / office.js / tower.js
// (uses drawChar, drawAcc, meWho, myName, Prog, roomW, store, toast at run time).
'use strict';
const Village = (() => {
  const T = 16, C = 48, R = 34;                   // tile px, map columns, rows
  const UNLOCK_W = 22, UNLOCK_LV = 12, LOT_PRICE = 10000;
  // read lazily: `store` is declared by index.html's inline script, which runs after this file
  let flagRead = false;
  const on = () => {
    if (!flagRead) { flagRead = true; const q = /[?&]village=([01])\b/.exec(location.search); if (q) store.set('vilFlag', q[1] === '1'); }
    return !!window.__TEST__ || !!store.get('vilFlag', false);
  };

  // 2 lanes × 6 lots (a new lane opens when most lots are taken — later steps)
  const LANES = ['ซอยมะลิ', 'ซอยดาวเรือง'];
  const LOTS = [];
  [4, 12, 19, 26].forEach((y, r) => [11, 23, 35].forEach((x, c) => LOTS.push({ id: LOTS.length + 1, x, y, lane: LANES[r < 2 ? 0 : 1], stage: 0 })));
  const TOWER = { x: 1, y: 1, w: 8, door: [5, 6] }, BOARD = [8, 12], WELL = [5, 13];

  const town = new Image(), farm = new Image();
  let el = null, cv, ctx, wrapEl, barEl, world = null, wctx, started = false, loaded = 0;
  let base, obj, block, Z = 2, dpr = 1, cam = { x: 0, y: 0 }, hits = [], t = 0, last = 0;
  const me = { x: TOWER.door[0], y: TOWER.door[1] + 1, path: [], dir: 'down', sp: 3.2, t: 0 };

  /* ---------- map ---------- */
  const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const grid = v => Array.from({ length: R }, () => Array(C).fill(v));
  function rebuild() {
    const rnd = rng(7); base = grid(0); obj = grid(-1); block = grid(0);
    const gnd = (x, y, tl) => { base[y][x] = tl; }, put = (x, y, tl, b = 1) => { obj[y][x] = tl; block[y][x] = b; };
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const r = rnd(); gnd(x, y, r < .07 ? 1 : r < .1 ? 2 : 0); }
    const road = (x, y) => gnd(x, y, rnd() < .12 ? 40 + Math.floor(rnd() * 2) : 25);
    for (let x = 0; x < C; x++) { road(x, 9); road(x, 10); }
    for (let y = 7; y < 31; y++) { road(22, y); road(34, y); }
    for (const y of [16, 23, 30]) for (let x = 1; x <= 46; x++) road(x, y);
    for (let y = 11; y <= 17; y++) for (let x = 1; x <= 9; x++) gnd(x, y, 43);   // plaza
    for (let y = 7; y <= 8; y++) gnd(5, y, 43);
    put(WELL[0], WELL[1], 92); put(WELL[0], WELL[1] + 1, 104); put(BOARD[0], BOARD[1], 83);
    const { x: tx, y: ty, w } = TOWER, row = (y, a, m, b, extra = {}) => { for (let i = 0; i < w; i++) put(tx + i, y, extra[i] ?? (i === 0 ? a : i === w - 1 ? b : m)); };
    row(ty, 48, 49, 50, { 2: 51, 5: 51 }); row(ty + 1, 60, 61, 62, { 4: 63 });
    for (let k = 0; k < 3; k++) row(ty + 2 + k, 76, 77, 79, { 1: 88, 3: 88, 5: 88, 6: 88 });
    row(ty + 5, 76, 77, 79, { 1: 88, 2: 88, 4: 89, 6: 88 });
    for (const L of LOTS) { L.front = [L.x + 2, L.y + 3]; gnd(L.x + 2, L.y + 3, 43); put(L.x + 2, L.y + 1, 83); }  // empty lot = a sign
    const inLot = (x, y) => LOTS.some(L => x >= L.x - 1 && x <= L.x + 10 && y >= L.y - 1 && y <= L.y + 3);
    const free = (x, y) => ![43, 25, 40, 41].includes(base[y][x]) && obj[y][x] < 0 && !inLot(x, y);
    const plant = (x, y) => { const r = rnd(); if (r < .45 && y + 1 < R && free(x, y + 1)) { const a = rnd() < .7 ? 4 : 3; put(x, y, a); put(x, y + 1, a + 12); } else put(x, y, r < .7 ? 28 : r < .85 ? 27 : 5); };
    for (let y = 31; y < R; y++) for (let x = 0; x < C; x++) if (free(x, y) && rnd() < (y > 31 ? .8 : .45)) plant(x, y);
    for (let y = 0; y < 31; y++) for (const x of [0, C - 1]) if (free(x, y) && rnd() < .65) plant(x, y);
    for (let x = 10; x < C - 1; x++) if (free(x, 0) && rnd() < .55) plant(x, 0);
    for (let i = 0; i < 46; i++) { const x = 1 + Math.floor(rnd() * (C - 2)), y = 1 + Math.floor(rnd() * 29); if (free(x, y) && free(x, y + 1)) plant(x, y); }
    for (const [x, y] of [[2, 18], [4, 18], [7, 18]]) if (free(x, y)) put(x, y, 1083);
  }
  const tile = (g, tl, x, y) => { const s = tl >= 1000 ? farm : town, n = tl % 1000; g.drawImage(s, (n % 12) * T, Math.floor(n / 12) * T, T, T, x * T, y * T, T, T); };
  function paintWorld() {
    world = document.createElement('canvas'); world.width = C * T; world.height = R * T; wctx = world.getContext('2d');
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { tile(wctx, base[y][x], x, y); if (obj[y][x] >= 0) tile(wctx, obj[y][x], x, y); }
  }

  /* ---------- walking ---------- */
  const walk = (x, y) => x >= 0 && y >= 0 && x < C && y < R && !block[y][x];
  function bfs(from, to) {
    const k = (x, y) => y * C + x, prev = new Map([[k(...from), -1]]), q = [from];
    while (q.length) { const [x, y] = q.shift(); if (x === to[0] && y === to[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (walk(nx, ny) && !prev.has(k(nx, ny))) { prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]); } } }
    if (!prev.has(k(...to))) return null; const out = []; for (let c = k(...to); c !== k(...from) && c >= 0; c = prev.get(c)) out.unshift([c % C, Math.floor(c / C)]); return out;
  }
  function nearestWalk(tx, ty) { for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walk(tx + dx, ty + dy)) return [tx + dx, ty + dy]; return null; }
  function goTo(cell) { if (!cell) return; const p = bfs([Math.round(me.x), Math.round(me.y)], cell); if (p) me.path = p; }
  function step(a, dt) {
    if (!a.path.length) return false; const [nx, ny] = a.path[0], dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy), mv = a.sp * dt;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (d <= mv) { a.x = nx; a.y = ny; a.path.shift(); } else { a.x += dx / d * mv; a.y += dy / d * mv; }
    a.t += dt; return true;
  }

  /* ---------- unlock (room 22 AND Lv 12) ---------- */
  function lock() { const p = Prog.get(), w = roomW(p.room || {}); return { w, lv: p.lv || 1, ok: w >= UNLOCK_W && (p.lv || 1) >= UNLOCK_LV }; }
  function renderBar() {
    if (!barEl) return; const L = lock(), ck = b => b ? '✓' : '';
    barEl.innerHTML = `<span class="vil-test">🧪 ทดสอบ · ยังไม่เปิดให้ทุกคน</span><span class="muted">${L.ok ? '✅ ครบเงื่อนไขแล้ว · จองที่ดินได้เร็ว ๆ นี้'
      : `🔒 สร้างบ้านได้เมื่อมีห้อง ${UNLOCK_W} + Lv ${UNLOCK_LV} · ตอนนี้ ห้อง ${L.w}/${UNLOCK_W} ${ck(L.w >= UNLOCK_W)} · Lv ${L.lv}/${UNLOCK_LV} ${ck(L.lv >= UNLOCK_LV)}`}</span>`;
  }

  /* ---------- drawing ---------- */
  const S = () => Z * dpr, sx = wx => (wx - cam.x) * S(), sy = wy => (wy - cam.y) * S();
  function resize() {
    if (!cv) return; dpr = Math.min(2, window.devicePixelRatio || 1); const r = wrapEl.getBoundingClientRect(); if (!r.width) return;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); Z = r.width < 720 ? 1.5 : 2;
  }
  function camTarget() {
    const vw = cv.width / S(), vh = cv.height / S(), cl = (v, lo, hi) => hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
    return { x: cl((me.x + .5) * T - vw / 2, 0, C * T - vw), y: cl((me.y + .5) * T - vh / 2, 0, R * T - vh) };
  }
  function pill(x, y, text, o = {}) {
    const fs = (o.fs || 12) * dpr; ctx.font = `600 ${fs}px Kanit, sans-serif`;
    const w = ctx.measureText(text).width + 14 * dpr, h = fs + 9 * dpr, l = x - w / 2, tp = y - h;
    ctx.fillStyle = o.bg || '#fff'; ctx.strokeStyle = o.line || '#3a2a20'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.roundRect(l, tp, w, h, 7 * dpr); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2a20'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, l + w / 2, tp + h / 2 + dpr);
    if (o.hit) hits.push({ l, t: tp, w, h, hit: o.hit }); return { l, t: tp, w, h };
  }
  function drawMe() {
    const who = typeof meWho === 'function' ? meWho() : 'adam', an = me.path.length ? 'run' : 'idle_anim', k = S() * .75;
    const px = sx((me.x + .5) * T), py = sy((me.y + 1) * T - 1);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(px, sy((me.y + 1) * T - 2), 6 * S(), 2.2 * S(), 0, 0, 7); ctx.fill();
    drawChar(ctx, who, an, me.dir, me.t + t, px, py, k);
    if (typeof drawAcc === 'function' && typeof Wardrobe !== 'undefined') for (const sl of ['f', 'h']) drawAcc(ctx, Wardrobe.eq(sl), who, an, me.dir, me.t + t, px, py, k);
    const nm = (typeof myName === 'function' && myName()) || 'คุณ';
    pill(px, py - 25 * S(), `⭐ ${nm}`, { fs: 11, bg: '#ffe0ea', line: '#d14d72' });
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
    if (!world || !visible()) return; t += dt;
    if (cv.width !== Math.round(wrapEl.clientWidth * dpr)) resize();
    step(me, dt);
    const tg = camTarget(); cam.x += (tg.x - cam.x) * Math.min(1, dt * 8); cam.y += (tg.y - cam.y) * Math.min(1, dt * 8);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#5a9b3a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(world, cam.x, cam.y, cv.width / S(), cv.height / S(), 0, 0, cv.width, cv.height);
    hits = [];
    pill(sx((TOWER.x + 4) * T), sy(TOWER.y * T) - 4 * dpr, '🏢 ตึกออฟฟิศ', { bg: '#e8f0ff', hit: 'tower' });
    pill(sx((BOARD[0] + .5) * T), sy(BOARD[1] * T) - 2 * dpr, '📌 บอร์ด', { fs: 11, hit: 'board' });
    for (const L of LOTS) pill(sx((L.x + 2.5) * T), sy(L.y * T) - 4 * dpr, `🪧 แปลง ${L.id} · 🪙 ${LOT_PRICE.toLocaleString('en-US')}`, { bg: '#fff8d6', hit: L });
    drawMe();
  }
  const visible = () => el && el.isConnected && !el.hidden && !document.getElementById('hub').hidden;

  /* ---------- input ---------- */
  function tap(e) {
    const b = cv.getBoundingClientRect(), px = (e.clientX - b.left) * dpr, py = (e.clientY - b.top) * dpr;
    const h = hits.slice().reverse().find(r => px >= r.l && px <= r.l + r.w && py >= r.t && py <= r.t + r.h);
    if (h) return act(h.hit);
    goTo(nearestWalk(Math.floor((px / S() + cam.x) / T), Math.floor((py / S() + cam.y) / T)));
  }
  function act(g) {
    if (g === 'tower') { goTo([TOWER.door[0], TOWER.door[1] + 1]); typeof Tower !== 'undefined' && Tower.setView('tower'); return; }
    if (g === 'board') { goTo(nearestWalk(BOARD[0], BOARD[1] + 1)); toast('📌 บอร์ดงานส่งของ · เร็ว ๆ นี้'); return; }
    if (g && g.id) { goTo([g.front[0], g.front[1] + 1]); const L = lock();
      toast(`🪧 แปลง ${g.id} · ${g.lane} · ว่าง · ${L.ok ? 'เปิดจองเร็ว ๆ นี้' : `จองได้เมื่อมีห้อง ${UNLOCK_W} + Lv ${UNLOCK_LV}`}`); }
  }

  /* ---------- DOM ---------- */
  function build() {
    el = document.createElement('section'); el.className = 'village'; el.id = 'village'; el.hidden = true;
    el.innerHTML = `<div class="vil-wrap"><canvas aria-label="แผนที่หมู่บ้าน"></canvas></div><div class="vil-bar"></div>`;
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d'); wrapEl = el.querySelector('.vil-wrap'); barEl = el.querySelector('.vil-bar');
    cv.addEventListener('click', tap);
    window.addEventListener('resize', resize);
  }
  function start() {
    if (started) return; started = true; rebuild();
    const go = () => { if (++loaded < 2) return; paintWorld(); resize(); cam = camTarget(); };
    town.onload = farm.onload = go; town.src = 'assets/village/tinytown.png'; farm.src = 'assets/village/tinyfarm.png';
    requestAnimationFrame(frame);
  }
  return {
    on,
    mount(slot) { if (!slot) return; if (!on()) { slot.remove(); return; } if (!el) build(); slot.replaceWith(el); renderBar(); },
    show() { if (!el) return; start(); renderBar(); requestAnimationFrame(() => { resize(); if (world) cam = camTarget(); }); },
    _dbg: { me, LOTS, get hits() { return hits; }, get ready() { return !!world; }, act, lock },
  };
})();
