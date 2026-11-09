// "หมู่บ้าน" — the home page's third view (village v2.0, see _test/gdd-village.md and _test/plan-village-build.md).
// Step 1 = groundwork: the map, 12 lots in 2 lanes, the office tower, walking with your own avatar.
// Step 2 = live: coworkers in the village walk around live (like ห้องรวม) and houses come from rooms/_vil/lots.
//   presence rooms/_hub/on/{sid}: g:'village' + vx,vy = the cell you are walking TO (own fields, so the ห้องรวม x,y
//   never mix with it); every client walks the others there itself, so one write per tap is enough.
// Step 3 = bricks: mini games give 1–3 (office.js Prog.brick, max 12 a day); + 3 bricks lie on the village roads each day
//   (same spots for everyone, from the date; each player can pick up each one once).
// Step 4 = build: tap a lot → card. Reserve (room 22 + Lv 12, 10,000) and every stage go through a transaction on
//   rooms/_vil/lots/{id}; coins/bricks/vegetables are only taken after it commits. Timers use the server clock.
//   Coworkers help: −2 h each, max 5 helpers a house a day, helper +5 🪙. No paid speed-up (decided 9 Nov 2026).
// Step 5 = the farm moves in: at the move-in party prog.vil.g = 14 and Farm.n() becomes the house garden (farm.js);
//   the same plots array, so every crop and friends' water carries over. The map draws the real crops in each garden
//   (rooms/_farm rows, mine from local progress); tapping a house garden opens that farm.
// The tab is open to everyone since 9 Nov 2026 (owner); ?village=0 hides it in that browser, ?village=1 shows it again.
//   Pets (step 6) are kept off the live site on the local branch village-pets until the next update.
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
    return !!window.__TEST__ || store.get('vilFlag', true) !== false;   // open to everyone since 9 Nov 2026; ?village=0 hides it in that browser
  };

  // 2 lanes × 6 lots (a new lane opens when most lots are taken — later steps)
  const LANES = ['ซอยมะลิ', 'ซอยดาวเรือง'];
  const LOTS = [];
  [4, 12, 19, 26].forEach((y, r) => [11, 23, 35].forEach((x, c) => LOTS.push({ id: LOTS.length + 1, x, y, lane: LANES[r < 2 ? 0 : 1], stage: 0 })));
  // stage: 0 empty, 1 reserved, 2 foundation, 3 walls + roof, 4 garden being made, 5 moved in
  const STAGE_TH = ['ว่าง', 'จองที่ดินแล้ว', 'ฐานราก', 'ผนัง + หลังคา', 'สวนข้างบ้าน', 'ขึ้นบ้านใหม่'];
  // GDD §4: [icon, name, coins, bricks, vegetables, build hours] — index = stage − 1
  const STAGES = [['🪧', 'จองที่ดิน', LOT_PRICE, 0, 0, 0], ['🧱', 'ฐานราก', 10000, 20, 0, 24], ['🏠', 'ผนัง + หลังคา', 15000, 40, 0, 48],
    ['🌳', 'สวนข้างบ้าน 14 แปลง', 10000, 0, 30, 24], ['🎉', 'ขึ้นบ้านใหม่', 5000, 0, 0, 0]];
  const HELP_H = 2, HELP_CAP = 5, HELP_PAY = 5, FLOOR_N = 3;
  // test mode only: ?vilFast=1 makes one build hour last one second
  const HOUR = () => { if (!window.__TEST__) return 3600e3; const f = Village._dbg.fast || (/[?&]vilFast=1\b/.test(location.search) ? 1000 : 0); return f ? (f === true ? 1000 : +f) : 3600e3; };   // _dbg.fast = ms per hour
  const fmtN = n => Math.round(n).toLocaleString('en-US'), escH = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TOWER = { x: 1, y: 1, w: 8, door: [5, 6] }, BOARD = [8, 12], WELL = [5, 13];

  const town = new Image(), farm = new Image();
  let el = null, cv, ctx, wrapEl, barEl, world = null, wctx, started = false, loaded = 0;
  let base, obj, block, Z = 2, dpr = 1, cam = { x: 0, y: 0 }, hits = [], t = 0, last = 0;
  const me = { x: TOWER.door[0], y: TOWER.door[1] + 1, path: [], dir: 'down', sp: 3.2, t: 0 };
  let O = null, people = [], lotsSig = '', sentSig = '', tags = [], offset = 0, cardEl, cardL = null, busy = false, cardTick = 0;
  let floor = [], floorDay = '', farms = {}, farmsT = 0;
  // everyone's public garden (rooms/_farm), refreshed every minute while the village is open
  function loadFarms() { if (!O || !O.listFarms || Date.now() - farmsT < 60e3) return; farmsT = Date.now();
    O.listFarms().then(F => { const m = {}; for (const r of F || []) if (r && r.k) m[r.k] = r; farms = m; }).catch(() => {}); }
  const gardenPlots = L => L.k === myKey() ? (Prog.get().farm || {}).plots || [] : (farms[L.k] || {}).plots || [];
  // garden size bought in the farm screen → the lot record, so everyone's map shows the right number of beds
  function setGarden(g) { const L = myLot(); if (!O || !L || (L.g | 0) >= g) return; const mk = myKey();
    O.txLot(L.id, cur => cur && cur.k === mk ? { ...cur, g: Math.max(g, cur.g | 0) } : cur ? undefined : null).catch(() => {}); }
  // moved in on another device, or before step 5 existed: make the farm follow the house
  function syncHome() { const L = myLot(), p = Prog.get(); if (!L || L.stage < 5) return;
    const g = Math.max(L.g || 14, (p.vil && p.vil.g) | 0); if (((p.vil || {}).g | 0) < g) { p.vil = p.vil || {}; p.vil.g = g; Prog.put(p); }
    if ((L.g | 0) < g) setGarden(g); }
  function openGarden(L) { if (L.k !== myKey()) window.farmVisit = L.k; if (typeof startGame === 'function') startGame('farm'); }
  const srvNow = () => Date.now() + offset;
  const myLot = () => LOTS.find(L => L.stage && L.k && L.k === myKey());
  const building = L => L.stage >= 2 && L.end > srvNow();
  const pctOf = L => { const h = STAGES[L.stage - 1][5]; return !h || !building(L) ? 1 : Math.max(0, Math.min(1, 1 - (L.end - srvNow()) / (h * HOUR()))); };
  const others = {};                              // sid -> walker of a live coworker in the village
  const key = n => O && O.nameKey ? O.nameKey(n) : (n || '').trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_').slice(0, 24) || '_';
  const myKey = () => key(typeof myName === 'function' ? myName() : '');
  const onlineKeys = () => new Set(people.filter(p => p.v !== 0).map(p => key(p.n)));

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
    for (const L of LOTS) lot(L, gnd, put);
    const inLot = (x, y) => LOTS.some(L => x >= L.x - 1 && x <= L.x + 10 && y >= L.y - 1 && y <= L.y + 3);
    const free = (x, y) => ![43, 25, 40, 41].includes(base[y][x]) && obj[y][x] < 0 && !inLot(x, y);
    const plant = (x, y) => { const r = rnd(); if (r < .45 && y + 1 < R && free(x, y + 1)) { const a = rnd() < .7 ? 4 : 3; put(x, y, a); put(x, y + 1, a + 12); } else put(x, y, r < .7 ? 28 : r < .85 ? 27 : 5); };
    for (let y = 31; y < R; y++) for (let x = 0; x < C; x++) if (free(x, y) && rnd() < (y > 31 ? .8 : .45)) plant(x, y);
    for (let y = 0; y < 31; y++) for (const x of [0, C - 1]) if (free(x, y) && rnd() < .65) plant(x, y);
    for (let x = 10; x < C - 1; x++) if (free(x, 0) && rnd() < .55) plant(x, 0);
    for (let i = 0; i < 46; i++) { const x = 1 + Math.floor(rnd() * (C - 2)), y = 1 + Math.floor(rnd() * 29); if (free(x, y) && free(x, y + 1)) plant(x, y); }
    for (const [x, y] of [[2, 18], [4, 18], [7, 18]]) if (free(x, y)) put(x, y, 1083);
  }
  // a lot by stage (Tiny Town tiles: 96-122 foundation, 44-58 frame, 48-67 roofs, 72-89 walls; farm tiles = 1000+id)
  function lot(L, gnd, put) {
    const X = L.x, Y = L.y, row = (y, a) => a.forEach((tl, i) => tl >= 0 && put(X + i, y, tl));
    L.front = [X + 2, Y + 3]; gnd(X + 2, Y + 3, 43);
    if (!L.stage) { put(X + 2, Y + 1, 83); return; }                                    // empty = a sign
    if (L.stage === 1) { [[12, 13, 13, 14], [24, 25, 25, 26], [36, 37, 37, 38]].forEach((a, j) => a.forEach((tl, i) => gnd(X + i, Y + j, tl))); put(X + 3, Y + 3, 83); return; }
    if (L.stage === 2) { row(Y, [96, 97, 97, 98]); row(Y + 1, [108, 109, 109, 110]); row(Y + 2, [120, 121, 121, 122]); put(X + 4, Y + 2, 57); return; }
    const wall = L.h === 2 ? [76, 88, 89, 79] : [72, 84, 85, 75];
    if (L.stage === 3) { row(Y, [44, 45, 45, 46]); row(Y + 1, [56, -1, -1, 58]); row(Y + 2, wall); put(X + 4, Y + 2, 57); return; }
    row(Y, L.red ? [52, 55, 53, 54] : [48, 51, 49, 50]); row(Y + 1, L.red ? [64, 65, 67, 66] : [60, 61, 63, 62]); row(Y + 2, wall);
    garden(L, gnd); if (L.stage === 4) put(X + 4, Y + 2, 57); else put(X + 4, Y + 3, 1085);
  }
  const gCell = (L, i) => { const per = Math.min(24, L.g || 14) >= 18 ? 6 : 5; return [L.x + 5 + i % per, L.y + Math.floor(i / per)]; };
  function garden(L, gnd) {                       // the beds; the crops on them are drawn live in frame()
    const n = Math.min(24, L.g || 14), per = n >= 18 ? 6 : 5, fx = L.x + 5;
    for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per, k = Math.min(per, n - r * per);
      gnd(fx + c, L.y + r, 1000 + (k === 1 ? 0 : (c === 0 ? 48 : c === k - 1 ? 51 : 49 + (c % 2)) + 12)); block[L.y + r][fx + c] = 1; }
  }
  // rooms/_vil/lots -> houses on the map (repaint only when something changed)
  function applyLots(v) {
    const sig = JSON.stringify(v || {}); if (sig === lotsSig) return; lotsSig = sig;
    for (const L of LOTS) { const d = (v || {})[L.id] || {}; Object.assign(L, { stage: Math.max(0, Math.min(5, d.stage | 0)), k: d.k || '', n: d.n || '', who: d.who || '', g: d.g | 0, h: d.h | 0, end: +d.end || 0, hp: d.hp || null, red: L.id % 2 === 0 }); }
    if (base) { rebuild(); if (loaded >= 2) paintWorld(); }
    syncHome(); renderCard(); renderBar();
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
  function goTo(cell) { if (!cell) return; const p = bfs([Math.round(me.x), Math.round(me.y)], cell); if (p) { me.path = p; send(); } }
  function send(force) {                          // one write per new target cell (or tab shown/hidden)
    if (!O) return; const tg = me.path.length ? me.path[me.path.length - 1] : [Math.round(me.x), Math.round(me.y)];
    const v = document.hidden || !visible() ? 0 : 1, sig = `${tg[0]},${tg[1]},${v}`; if (!force && sig === sentSig) return; sentSig = sig;
    O.setPresence({ vx: tg[0], vy: tg[1], v });
  }
  // live coworkers: walk each one to the cell they last sent
  function syncOthers() {
    const here = people.filter(p => !p.me && p.g === 'village' && p.v !== 0 && p.vx != null);
    for (const id of Object.keys(others)) if (!here.some(p => p.id === id)) delete others[id];
    if (!block) return;
    for (const p of here) {
      const tx = Math.max(0, Math.min(C - 1, p.vx | 0)), ty = Math.max(0, Math.min(R - 1, p.vy | 0));
      let a = others[p.id]; if (!a) a = others[p.id] = { x: tx, y: ty, path: [], dir: 'down', sp: 3.2, t: Math.random() * 3, to: '' };
      a.p = p; const to = tx + ',' + ty;
      if (a.to !== to) { a.to = to; const c = walk(tx, ty) ? [tx, ty] : nearestWalk(tx, ty), path = c && bfs([Math.round(a.x), Math.round(a.y)], c); if (path) a.path = path; else if (c) { a.x = c[0]; a.y = c[1]; a.path = []; } }
    }
  }
  function step(a, dt) {
    if (!a.path.length) return false; const [nx, ny] = a.path[0], dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy), mv = a.sp * dt;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (d <= mv) { a.x = nx; a.y = ny; a.path.shift(); } else { a.x += dx / d * mv; a.y += dy / d * mv; }
    a.t += dt; return true;
  }

  /* ---------- unlock (room 22 AND Lv 12) ---------- */
  function lock() { const p = Prog.get(), w = roomW(p.room || {}); return { w, lv: p.lv || 1, ok: w >= UNLOCK_W && (p.lv || 1) >= UNLOCK_LV }; }
  function renderBar() {
    if (!barEl) return; const L = lock(), ck = b => b ? '✓' : '', B = Prog.bricks(), mL = myLot();
    barEl.innerHTML = `${mL ? '<button class="btn sm" type="button" data-a="home">📍 บ้านฉัน</button>' : ''}<span class="vil-brick" title="อิฐได้จากมินิเกม รอบละ 1–3 ก้อน วันละไม่เกิน ${B.cap} + อิฐบนถนนในหมู่บ้านวันละ ${FLOOR_N} ก้อน">🧱 ${fmtN(B.n)} <small>เกม ${B.today}/${B.cap} · ถนน ${floorGot().length}/${FLOOR_N}</small></span><span class="muted">${mL ? `⭐ บ้านคุณ แปลง ${mL.id} · ${STAGE_TH[mL.stage]}${building(mL) ? ` ${Math.round(pctOf(mL) * 100)}%` : ''}`
      : L.ok ? '✅ ครบเงื่อนไขแล้ว · แตะป้าย 🪧 เพื่อจองที่ดิน'
      : `🔒 สร้างบ้านได้เมื่อมีห้อง ${UNLOCK_W} + Lv ${UNLOCK_LV} · ตอนนี้ ห้อง ${L.w}/${UNLOCK_W} ${ck(L.w >= UNLOCK_W)} · Lv ${L.lv}/${UNLOCK_LV} ${ck(L.lv >= UNLOCK_LV)}`}</span>`;
  }

  /* ---------- bricks on the roads (3 a day, same spots for everyone) ---------- */
  function floorSpots() {
    const d = bkkDay(); if (floorDay === d || !base) return floor; floorDay = d;
    const rnd = rng(+d.replace(/-/g, '') % 2147483646 + 1), cells = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if ([25, 40, 41].includes(base[y][x]) && !block[y][x] && Math.hypot(x - 5, y - 8) > 6) cells.push([x, y]);
    for (let i = 0; i < 5; i++) rnd();
    floor = [];
    while (floor.length < FLOOR_N && cells.length) { const [x, y] = cells.splice(Math.floor(rnd() * cells.length), 1)[0]; if (floor.every(f => Math.hypot(f.x - x, f.y - y) > 8)) floor.push({ x, y, i: floor.length }); }
    return floor;
  }
  const floorGot = () => { const v = Prog.get().vil || {}; return v.fd === bkkDay() ? v.fp || [] : []; };
  function pickFloor(f) {
    const p = Prog.get(), v = p.vil || (p.vil = {}), d = bkkDay();
    if (v.fd !== d) { v.fd = d; v.fp = []; } if (v.fp.includes(f.i)) return;
    v.fp.push(f.i); v.bricks = (v.bricks || 0) + 1; Prog.put(p);
    if (typeof Stats !== 'undefined') Stats.econ('brick_map', 1);
    toast(`🧱 เก็บอิฐบนถนน +1 · วันนี้ ${v.fp.length}/${FLOOR_N}`); renderBar(); renderCard();
  }

  /* ---------- reserve / build / help ---------- */
  const vegKeys = bag => Object.keys(bag || {}).filter(k => typeof CROPS === 'undefined' || CROPS[k.split('.')[0]]);
  function have() { const p = Prog.get(), bag = (p.farm && p.farm.bag) || {}; return { coins: p.coins | 0, bricks: (p.vil && p.vil.bricks) | 0, veg: vegKeys(bag).reduce((a, k) => a + (bag[k] | 0), 0) }; }
  // take the cost (after the transaction committed); vegetables: plain/cheapest ones first
  function pay(c, b, v) {
    const p = Prog.get(); p.coins -= c; p.vil = p.vil || {}; p.vil.bricks = (p.vil.bricks || 0) - b;
    if (v) { const bag = p.farm.bag; let left = v;
      for (const k of vegKeys(bag).sort((a, z) => typeof bagPrice === 'function' ? bagPrice(a) - bagPrice(z) : 0)) { const u = Math.min(left, bag[k]); bag[k] -= u; if (!bag[k]) delete bag[k]; left -= u; if (!left) break; } }
    Prog.put(p);
    if (typeof Stats !== 'undefined') { Stats.econ('out_house', c); if (b) Stats.econ('brick_use', b); if (v) Stats.econ('veg_house', v); }
  }
  const costTxt = s => [s[2] ? `🪙 ${fmtN(s[2])}` : '', s[3] ? `🧱 ${s[3]}` : '', s[4] ? `🥬 ${s[4]}` : ''].filter(Boolean).join(' + ') + (s[5] ? ` · ${s[5]} ชม.` : '');
  function missing(s) {
    const H = have(), m = [];
    if (H.coins < s[2]) m.push(`🪙 ${fmtN(s[2] - H.coins)}`); if (H.bricks < s[3]) m.push(`🧱 ${s[3] - H.bricks}`); if (H.veg < s[4]) m.push(`🥬 ${s[4] - H.veg}`);
    return m;
  }
  const feed = m => { const nm = myName(); if (O && nm) O.pushFeed(m, nm, typeof myAva === 'function' ? myAva() : ''); };
  async function tx(L, fn) {                       // fn(cur) → new value, or undefined to give up; ok = our change was the one written
    if (!O || busy) return false; busy = true; renderCard(); let ok = false;
    try { const r = await O.txLot(L.id, cur => { ok = false; const nv = fn(cur); if (nv && nv !== cur) ok = true; return nv; }); return !!(r && r.committed && ok); }
    catch (e) { return false; } finally { busy = false; }
  }
  async function reserve(L) {
    const mk = myKey(), nm = myName(), s = STAGES[0];
    if (!nm) return toast('ตั้งชื่อเล่นที่แถบบนก่อน แล้วค่อยจองที่ดิน');
    if (!lock().ok || myLot() || L.stage || missing(s).length) return renderCard();
    const ok = await tx(L, cur => cur && cur.k ? undefined : { k: mk, n: nm.slice(0, 20), who: typeof meWho === 'function' ? meWho() : 'adam', stage: 1, end: 0, t: srvNow() });
    if (!ok) { toast('😅 แปลงนี้มีคนจองไปแล้ว ลองแปลงอื่นนะ'); return renderCard(); }
    pay(s[2], 0, 0); const p = Prog.get(); p.vil.lot = L.id; Prog.put(p);
    toast(`🪧 จองแปลง ${L.id} ${L.lane} แล้ว! −${fmtN(s[2])} 🪙`); feed(`🪧 ${nm} จองที่ดินแปลง ${L.id} ใน${L.lane} เตรียมสร้างบ้าน!`);
    renderCard(); renderBar();
  }
  async function next(L) {
    const mk = myKey(), st = L.stage, s = STAGES[st];
    if (!s || L.k !== mk || building(L) || missing(s).length) return renderCard();
    const ok = await tx(L, cur => {
      if (!cur) return null;                       // not loaded yet: Firebase retries with the server value
      if (cur.k !== mk || (cur.stage | 0) !== st || +cur.end > srvNow()) return undefined;
      return { ...cur, stage: st + 1, end: s[5] ? srvNow() + s[5] * HOUR() : 0, hp: null, g: st + 1 >= 4 ? cur.g || 14 : cur.g || 0 };
    });
    if (!ok) { toast('ยังทำขั้นนี้ไม่ได้ ลองใหม่อีกครั้ง'); return renderCard(); }
    pay(s[2], s[3], s[4]);
    if (st + 1 === 5) { const pp = Prog.get(); pp.vil.g = Math.max(14, pp.vil.g | 0); Prog.put(pp);   // the farm moves to the house garden
      toast('🎉 ขึ้นบ้านใหม่! ผักย้ายมาสวนครบ'); feed(`🎉 ${myName()} ขึ้นบ้านใหม่ที่${L.lane} แปลง ${L.id}! แวะไปเยี่ยมกันได้`); }
    else toast(`${s[0]} เริ่ม${s[1]} · เสร็จใน ${s[5]} ชม. · ชวนเพื่อนมาช่วยให้เร็วขึ้น`);
    renderCard(); renderBar();
  }
  const helpers = L => (L.hp && L.hp.d === bkkDay() && L.hp.by) || {};
  async function help(L) {
    const mk = myKey(), nm = myName(), day = bkkDay();
    if (!nm) return toast('ตั้งชื่อเล่นที่แถบบนก่อน แล้วค่อยช่วยเพื่อน');
    if (!building(L) || L.k === mk) return renderCard();
    const ok = await tx(L, cur => {
      if (!cur) return null;
      const now = srvNow(); if (!(+cur.end > now) || cur.k === mk) return undefined;
      const by = cur.hp && cur.hp.d === day && cur.hp.by || {}; if (by[mk] || Object.keys(by).length >= HELP_CAP) return undefined;
      return { ...cur, end: Math.max(now, +cur.end - HELP_H * HOUR()), hp: { d: day, by: { ...by, [mk]: 1 } } };
    });
    if (!ok) { toast('วันนี้ช่วยบ้านนี้ไม่ได้แล้ว (ช่วยแล้ว หรือครบ 5 คน)'); return renderCard(); }
    Prog.give(HELP_PAY, 0, 'vhelp'); if (typeof Awards !== 'undefined') Awards.add('help', 1);
    toast(`🔨 ช่วย${L.n}สร้างบ้าน −${HELP_H} ชม. · +${HELP_PAY} 🪙`); renderCard();
  }

  /* ---------- lot card ---------- */
  const leftTxt = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? `${h} ชม. ${m % 60} นาที` : `${m} นาที`; };
  function openCard(L) { cardL = L; renderCard(); }
  function closeCard() { cardL = null; if (cardEl) cardEl.hidden = true; }
  function renderCard() {
    if (!cardEl) return; if (!cardL) { cardEl.hidden = true; return; }
    const L = cardL, mk = myKey(), mine = L.stage && L.k === mk, mL = myLot(), dis = busy ? ' disabled' : '';
    let h = `<button class="x" type="button" data-a="close" aria-label="ปิด">✕</button>`;
    if (!L.stage) {
      const lk = lock(), s = STAGES[0], miss = missing(s);
      h += `<h4>🪧 แปลง ${L.id} · ${L.lane}</h4><p class="muted">ที่ดินว่าง · สร้างบ้าน 5 ขั้น รวม 🪙 50,000 + 🧱 60 + 🥬 30</p>`;
      if (mL) h += `<p>คุณมีบ้านที่แปลง ${mL.id} แล้ว (1 คน 1 หลัง)</p>`;
      else if (!lk.ok) h += `<p>🔒 จองได้เมื่อมีห้อง ${UNLOCK_W} + Lv ${UNLOCK_LV}<br>ตอนนี้ ห้อง ${lk.w}/${UNLOCK_W} ${lk.w >= UNLOCK_W ? '✓' : ''} · Lv ${lk.lv}/${UNLOCK_LV} ${lk.lv >= UNLOCK_LV ? '✓' : ''}</p>`;
      else h += `<button class="btn primary" type="button" data-a="reserve"${miss.length || busy ? ' disabled' : ''}>🪧 จองที่ดินนี้ · ${costTxt(s)}</button>${miss.length ? `<p class="vil-need">ขาดอีก ${miss.join(' · ')}</p>` : ''}`;
    } else {
      const hp = helpers(L), nh = Object.keys(hp).length;
      h += `<h4>${mine ? '⭐ บ้านคุณ' : `🏠 บ้าน${escH(L.n)}`} · แปลง ${L.id}</h4><p class="muted">${L.lane}${L.stage === 5 ? ' · ย้ายเข้าแล้ว 🎉' : ''}</p>`;
      h += STAGES.map((s, i) => { const k = i + 1, cur = k === L.stage, done = k < L.stage || (cur && !building(L));
        return `<div class="vil-stg${done ? ' done' : cur ? ' cur' : ''}"><span>${s[0]}</span><span>${s[1]}${cur && building(L) ? `<div class="vil-pb"><i style="width:${Math.round(pctOf(L) * 100)}%"></i></div><small>เหลือ ${leftTxt(L.end - srvNow())} · เพื่อนช่วยวันนี้ ${nh}/${HELP_CAP}</small>`
          : mine && !done ? `<br><small>${costTxt(s)}</small>` : ''}</span><span>${done ? '✔' : cur ? '⏳' : '🔒'}</span></div>`; }).join('');
      if (mine) {
        const s = STAGES[L.stage];
        if (building(L)) h += `<p class="muted">ไม่มีปุ่มเร่ง · ชวนเพื่อนมาแตะ "ช่วยสร้าง" ได้วันละ ${HELP_CAP} คน คนละ −${HELP_H} ชม.</p>`;
        else if (s) { const miss = missing(s); h += `<button class="btn primary" type="button" data-a="next"${miss.length || busy ? ' disabled' : ''}>${s[0]} เริ่ม${s[1]} · ${costTxt(s)}</button>${miss.length ? `<p class="vil-need">ขาดอีก ${miss.join(' · ')}${s[3] ? ' · อิฐได้จากมินิเกมและบนถนน' : ''}${s[4] ? ' · ผักได้จากฟาร์ม' : ''}</p>` : ''}`; }
        else h += `<p>🌱 สวนข้างบ้าน ${Math.max(L.g || 14, Farm.home ? Farm.home() : 0)} แปลง · ฟาร์มของคุณอยู่ที่นี่แล้ว</p><button class="btn primary" type="button" data-a="garden">🌱 ไปที่สวน</button>`;
      } else if (L.stage === 5) {
        const fr = farms[L.k], gp = (fr && fr.plots || []).filter(x => x && x.c).length;
        h += `<p>🌱 สวนข้างบ้าน ${L.g || 14} แปลง${fr ? ` · ปลูกอยู่ ${gp}` : ''}</p><button class="btn primary" type="button" data-a="garden">🌱 ไปดูสวน · รดน้ำช่วย</button>`;
      } else if (building(L)) {
        const can = !hp[mk] && nh < HELP_CAP;
        h += `<button class="btn primary" type="button" data-a="help"${can && !busy ? '' : ' disabled'}>🔨 ช่วยสร้าง −${HELP_H} ชม. · +${HELP_PAY} 🪙</button>${hp[mk] ? '<p class="muted">วันนี้คุณช่วยบ้านนี้แล้ว ขอบคุณ 💛</p>' : nh >= HELP_CAP ? `<p class="muted">วันนี้มีคนช่วยครบ ${HELP_CAP} คนแล้ว</p>` : ''}`;
      }
    }
    cardEl.innerHTML = h; cardEl.hidden = false;
  }
  function cardAct(a) {
    if (a === 'close') return closeCard();
    const L = cardL; if (!L) return;
    if (a === 'reserve') reserve(L); else if (a === 'next') next(L); else if (a === 'help') help(L); else if (a === 'garden') openGarden(L);
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
    tags.push([px, py - 25 * S(), `⭐ ${nm}`, { fs: 11, bg: '#ffe0ea', line: '#d14d72' }]);
  }
  function drawOther(a) {
    const p = a.p, who = typeof MI_PEOPLE !== 'undefined' && MI_PEOPLE.includes(p.a) ? p.a : 'adam', an = a.path.length ? 'run' : 'idle_anim', k = S() * .75;
    const px = sx((a.x + .5) * T), py = sy((a.y + 1) * T - 1);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(px, sy((a.y + 1) * T - 2), 6 * S(), 2.2 * S(), 0, 0, 7); ctx.fill();
    drawChar(ctx, who, an, a.dir, a.t + t, px, py, k);
    if (typeof drawAcc === 'function') for (const sl of ['f', 'h']) if (p[sl]) drawAcc(ctx, p[sl], who, an, a.dir, a.t + t, px, py, k);
    tags.push([px, py - 25 * S(), `🟢 ${p.n || '?'}${p.lv ? ` Lv${p.lv}` : ''}`, { fs: 10, bg: '#e8ffe0', line: '#3a9b3a', hit: { person: p } }]);
  }
  function drawTags() {                           // lowest on screen last; nudge a tag up if it would cover one already drawn
    const done = []; tags.sort((a, b) => a[1] - b[1]);
    for (const [x, y0, txt, o] of tags) { ctx.font = `600 ${o.fs * dpr}px Kanit, sans-serif`; const w = ctx.measureText(txt).width + 16 * dpr, h = (o.fs + 9) * dpr; let y = y0;
      for (let k = 0; k < 4; k++) { const hit = done.find(r => Math.abs(r[0] - x) < (r[2] + w) / 2 && Math.abs(r[1] - y) < h); if (!hit) break; y = hit[1] - h - 2 * dpr; }
      done.push([x, y, w]); pill(x, y, txt, o); }
    tags = [];
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
    if (!world || !visible()) return; t += dt;
    if (cv.width !== Math.round(wrapEl.clientWidth * dpr)) resize();
    step(me, dt); for (const a of Object.values(others)) step(a, dt);
    const tg = camTarget(); cam.x += (tg.x - cam.x) * Math.min(1, dt * 8); cam.y += (tg.y - cam.y) * Math.min(1, dt * 8);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#5a9b3a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(world, cam.x, cam.y, cv.width / S(), cv.height / S(), 0, 0, cv.width, cv.height);
    hits = [];
    pill(sx((TOWER.x + 4) * T), sy(TOWER.y * T) - 4 * dpr, '🏢 ตึกออฟฟิศ', { bg: '#e8f0ff', hit: 'tower' });
    pill(sx((BOARD[0] + .5) * T), sy(BOARD[1] * T) - 2 * dpr, '📌 บอร์ด', { fs: 11, hit: 'board' });
    const onK = onlineKeys(), mk = myKey();
    for (const L of LOTS) {
      const x = sx((L.x + 2.5) * T), y = sy(L.y * T) - 4 * dpr;
      if (!L.stage) pill(x, y, `🪧 แปลง ${L.id} · 🪙 ${LOT_PRICE.toLocaleString('en-US')}`, { bg: '#fff8d6', hit: L });
      else { const b = building(L), pc = b ? ` ${Math.round(pctOf(L) * 100)}%` : '';
        if (L.k && L.k === mk) pill(x, y, `⭐ บ้านคุณ · ${STAGE_TH[L.stage]}${pc}`, { bg: '#ffe0ea', line: '#d14d72', hit: L });
        else pill(x, y, `${onK.has(L.k) ? '🟢 ' : ''}${L.n || '?'} · ${L.stage === 5 ? 'บ้าน' : STAGE_TH[L.stage] + pc}${b && !helpers(L)[mk] && Object.keys(helpers(L)).length < HELP_CAP ? ' · 🔨' : ''}`, { bg: L.stage === 5 ? '#fff' : b ? '#ffd84d' : '#f3f3f3', hit: L }); }
    }
    // real crops in the house gardens (moved-in houses only)
    loadFarms(); ctx.imageSmoothingEnabled = false;
    if (typeof Farm !== 'undefined' && Farm.plotImg) { const now = Date.now(), ts = T * S();
      for (const L of LOTS) { if (L.stage !== 5) continue; const pls = gardenPlots(L), n = Math.min(24, L.g || 14);
        for (let i = 0; i < n; i++) { const im = Farm.plotImg(pls[i], now); if (!im) continue; const [cx, cy] = gCell(L, i), x0 = sx(cx * T), y0 = sy(cy * T);
          if (x0 < -ts || y0 < -ts || x0 > cv.width || y0 > cv.height) continue;
          const k = ts * .9 / Math.max(im.width, im.height); ctx.drawImage(im, Math.round(x0 + ts / 2 - im.width * k / 2), Math.round(y0 + ts * .95 - im.height * k), Math.round(im.width * k), Math.round(im.height * k)); } } }
    // bricks lying on the roads today
    const got = floorGot(), bob = Math.sin(t * 3);
    for (const f of floorSpots()) { if (got.includes(f.i)) continue;
      if (Math.abs(f.x - me.x) < .6 && Math.abs(f.y - me.y) < .6) { pickFloor(f); continue; }
      ctx.font = `${11 * S()}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧱', sx((f.x + .5) * T), sy((f.y + .5) * T) - bob * S()); }
    if (cardL && (cardTick += dt) > 1) { cardTick = 0; if (building(cardL)) renderCard(); }
    // people front to back; names are collected and drawn last so nobody walking in front hides a name
    [...Object.values(others), me].sort((a, b) => a.y - b.y).forEach(a => a === me ? drawMe() : drawOther(a));
    drawTags();
  }
  const visible = () => el && el.isConnected && !el.hidden && !document.getElementById('hub').hidden;

  /* ---------- input ---------- */
  function tap(e) {
    const b = cv.getBoundingClientRect(), px = (e.clientX - b.left) * dpr, py = (e.clientY - b.top) * dpr;
    const h = hits.slice().reverse().find(r => px >= r.l && px <= r.l + r.w && py >= r.t && py <= r.t + r.h);
    if (h) return act(h.hit);
    const wx = Math.floor((px / S() + cam.x) / T), wy = Math.floor((py / S() + cam.y) / T);
    const L = LOTS.find(L => wx >= L.x && wx <= L.x + (L.stage >= 4 ? 10 : 3) && wy >= L.y && wy <= L.y + 3); if (L) return act(L);   // tapping a house or its garden
    goTo(nearestWalk(wx, wy));
  }
  function act(g) {
    if (g === 'tower') { goTo([TOWER.door[0], TOWER.door[1] + 1]); typeof Tower !== 'undefined' && Tower.setView('tower'); return; }
    if (g === 'board') { goTo(nearestWalk(BOARD[0], BOARD[1] + 1)); toast('📌 บอร์ดงานส่งของ · เร็ว ๆ นี้'); return; }
    if (g && g.person) { const p = g.person, a = others[p.id]; if (a) goTo(nearestWalk(Math.round(a.x) + 1, Math.round(a.y))); toast(`👋 ${p.n || '?'}${p.lv ? ` · Lv ${p.lv}` : ''} อยู่ในหมู่บ้าน`); return; }
    if (g && g.id) { goTo([g.front[0], g.front[1] + 1]); openCard(g); }
  }

  /* ---------- DOM ---------- */
  function build() {
    el = document.createElement('section'); el.className = 'village'; el.id = 'village'; el.hidden = true;
    el.innerHTML = `<div class="vil-wrap"><canvas aria-label="แผนที่หมู่บ้าน"></canvas><div class="vil-card" role="dialog" aria-label="ที่ดินและบ้าน" hidden></div></div><div class="vil-bar"></div>`;
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d'); wrapEl = el.querySelector('.vil-wrap'); barEl = el.querySelector('.vil-bar'); cardEl = el.querySelector('.vil-card');
    cardEl.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) cardAct(b.dataset.a); });
    barEl.addEventListener('click', e => { if (e.target.closest('[data-a=home]')) { const L = myLot(); if (L) act(L); } });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') closeCard(); });
    cv.addEventListener('click', tap);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => send(true));
  }
  function start() {
    if (started) return; started = true; rebuild();
    const go = () => { if (++loaded < 2) return; paintWorld(); resize(); cam = camTarget(); };
    town.onload = farm.onload = go; town.src = 'assets/village/tinytown.png'; farm.src = 'assets/village/tinyfarm.png';
    loadOnline().then(M => { O = M; send(true); M.watchOffset(v => offset = v || 0); M.watchOnline(l => { people = l; syncOthers(); }); if (M.watchLots) M.watchLots(applyLots); }).catch(() => {});
    requestAnimationFrame(frame);
  }
  return {
    on,
    mount(slot) { if (!slot) return; if (!on()) { slot.remove(); return; } if (!el) build(); slot.replaceWith(el); renderBar(); },
    show() { if (!el) return; start(); renderBar(); requestAnimationFrame(() => { resize(); if (world) cam = camTarget(); send(true); }); },
    setGarden,
    _dbg: { me, LOTS, others, get farms() { return farms; }, syncHome, gCell, get hits() { return hits; }, get ready() { return !!world; }, act, lock, goTo, fast: false, floorSpots, reserve, next, help, myLot, get busy() { return busy; } },
  };
})();
