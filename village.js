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
// Starter house (10 Nov): the farm moves to the lot at จองที่ดิน (prog.vil.g = rooftop size, 10), stage 2 is a small cottage you
//   live in once built (movedIn), stage 3 grows it into the big house, stage 4 finishes the garden at 14 plots. Lot fields
//   rc/wc/xs = roof colour, wall, front extras (first choice free, then PAINT / ITEM coins). Earlier note:
// Step 5 = the farm moves in: at the move-in party prog.vil.g = 14 and Farm.n() becomes the house garden (farm.js);
//   the same plots array, so every crop and friends' water carries over. The map draws the real crops in each garden
//   (rooms/_farm rows, mine from local progress); tapping a house garden opens that farm.
// Step 6 = pets: a cat for 6,000 (bar button 🐾). Food 150 / 400 keeps it fed for a day: it follows you, the first meal
//   of the day it brings 50 🪙, premium adds a party hat, a trick and digs up a vegetable. Hungry = it naps at home
//   (your house, or the tower door) — it never runs away, gets sick or dies. Dye 300, rename free.
//   prog.vil.pet = {n, coat, fed: ms, prem, fd: day}; others see it through presence (pe) and the lot record (pet).
// Step 7 = walking extras: the 📌 board lists 3 delivery jobs a day (same for everyone, seeded by the date): take N of a
//   crop to a neighbour (an NPC on the plaza or a coworker's moved-in house) for the canteen price +30% (sell ×1.2 ×1.3),
//   paid by the system so the owner owes nothing. Each player does each job once a day (prog.vil.jd/jp).
//   The roads also hold 4 small pickups a day next to the 3 bricks (2 × 15 🪙, 1 vegetable, 1 🍀 40 🪙; prog.vil.fp).
// The tab is open to everyone since 9 Nov 2026 (owner); ?village=0 hides it in that browser, ?village=1 shows it again.
// Step 8 (11 Nov 2026) = the cozy village: village-world.js (generated from _test/village-cozy-big.html) draws the 72×48 map,
//   enterable rooms, NPCs with friendship, rides, the community farm and night light; this file keeps every live system
//   (lots + transactions, presence, bricks, pets, jobs, pickups, gardens) and hands them to it through HOOKS. If the engine
//   can't start, the old Kenney map below is used. Lots 5 and 8 sit east of the park in the new map (49,20 / 49,27).
// Art: Kenney Tiny Town + Tiny Farm (CC0, assets/village/). Classic script after solo-games.js / office.js / tower.js
// (uses drawChar, drawAcc, meWho, myName, Prog, roomW, store, toast at run time).
'use strict';
const Village = (() => {
  const T = 16; let C = 48, R = 34;              // tile px, map columns, rows (the cozy engine's grid once it runs)
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
  const STAGE_TH = ['ว่าง', 'จองที่ดินแล้ว', 'บ้านหลังแรก', 'บ้านหลังใหญ่', 'สวน 14 แปลง', 'ขึ้นบ้านใหม่'];
  // GDD §4: [icon, name, coins, bricks, vegetables, build hours] — index = stage − 1
  const STAGES = [['🪧', 'จองที่ดิน', LOT_PRICE, 0, 0, 0], ['🏡', 'บ้านหลังแรก', 5000, 8, 0, 12], ['🏠', 'ต่อเติมบ้านหลังใหญ่', 20000, 40, 0, 48],   // 10 Nov: move in sooner (was 10,000 + 🧱 20, 24 h), same 55,000 in total
    ['🌳', 'ขยายสวนเป็น 14 แปลง', 10000, 0, 30, 24], ['🎉', 'ขึ้นบ้านใหม่', 5000, 0, 0, 0]];
  // house colours: roof keys tint the blue-grey shingles (red = the sheet's own red tiles); painted walls tint the wood planks
  const ROOFS = { blue: ['ฟ้าเทา', '#8796ad'], red: ['แดงอิฐ', '#c8553d'], green: ['เขียว', '#5f9e4f'], purple: ['ม่วง', '#8b6bbf'],
    brown: ['น้ำตาล', '#8a5a3c'], pink: ['ชมพู', '#e98bab'], teal: ['เขียวน้ำทะเล', '#3f9e9b'], navy: ['กรมท่า', '#3d4f8a'] };
  const WALLS = { wood: ['ไม้', '#c98b54'], stone: ['หิน', '#aab3c0'], white: ['ขาว', '#efe7da'], yellow: ['เหลือง', '#f2cf63'], mint: ['มิ้นต์', '#a9dcc4'], peach: ['พีช', '#f4b38c'] };
  const XTRA = { t: ['🌳', 'ต้นไม้'], p: ['🏺', 'โอ่ง'], m: ['🪧', 'ป้ายชื่อ'], f: ['🪵', 'รั้ว'], o: ['🌼', 'ดอกไม้'] };
  const PAINT = 300, ITEM = 200, RK = Object.keys(ROOFS), WK = Object.keys(WALLS);
  const roofOf = L => ROOFS[L.rc] ? L.rc : L.id % 2 === 0 ? 'red' : 'blue', wallOf = L => WALLS[L.wc] ? L.wc : L.h === 2 ? 'stone' : 'wood';
  const HELP_H = 2, HELP_CAP = 5, HELP_PAY = 5, FLOOR_N = 3;
  // pets (GDD §7). Elthen's cat sheet: 32x32 cells, rows = animations, faces right; coats = recoloured greys
  const PET_PRICE = 6000, FOOD = { b: [150, 'อาหารธรรมดา', '🍖'], p: [400, 'อาหารพรีเมียม', '🥩'] }, DYE = 300, PET_FIND = 50, MEAL = 24 * 3600e3;
  const COATS = { white: ['ขาว', '#e0e0e0', '#b5b5b5', '#2f2f2e'], orange: ['ส้ม', '#f4a640', '#d9772b', '#3a2416'], grey: ['เทา', '#9aa3ad', '#717b86', '#262a30'],
    black: ['ดำ', '#3d3a44', '#29262e', '#111013'], cream: ['ครีม', '#f3dfb8', '#d8bb8a', '#4a3524'], choc: ['ช็อกโกแลต', '#8a5a3c', '#663f28', '#24150d'], pink: ['ชมพูพาสเทล', '#ffc4d6', '#f293b2', '#4a2633'], mint: ['มิ้นต์', '#b8ecd6', '#82cdb0', '#1f3d33'] };
  const CATROW = { idle: [0, 4, 4], clean: [2, 4, 6], run: [4, 8, 14], sleep: [6, 4, 2.5], paw: [7, 6, 9], jump: [8, 7, 10], walk: [9, 8, 10] };   // row, frames, fps
  const PETS = new Image(), coatCache = {}, PETC = { pet: 1 };      // PETC = the pet card
  // test mode only: ?vilFast=1 makes one build hour last one second
  const HOUR = () => { if (!window.__TEST__) return 3600e3; const f = Village._dbg.fast || (/[?&]vilFast=1\b/.test(location.search) ? 1000 : 0); return f ? (f === true ? 1000 : +f) : 3600e3; };   // _dbg.fast = ms per hour
  const fmtN = n => Math.round(n).toLocaleString('en-US'), escH = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TOWER = { x: 1, y: 1, w: 8, door: [5, 6] }, BOARD = [8, 12], WELL = [5, 13];
  // step 7: delivery jobs + road pickups
  const NPCS = [{ n: 'ป้าแม่ครัว', who: 'amelia', at: [2, 12] }, { n: 'ลุงยาม', who: 'bob', at: [7, 15] }, { n: 'น้องฝึกงาน', who: 'alex', at: [3, 16] }];
  const JOB_N = 3, JOB_CROPS = ['let', 'car', 'tom', 'chi', 'cor'], DELIVER = 1.2 * 1.3;
  const WHY = ['จะทำส้มตำเลี้ยงเพื่อน', 'ทำสลัดไปกินที่ออฟฟิศ', 'ต้มแกงจืดให้ที่บ้าน', 'เตรียมข้าวกล่องพรุ่งนี้', 'ทำกับข้าวใส่บาตร', 'ทำน้ำพริกฝากเพื่อน'];
  // road extras after the 3 bricks (index FLOOR_N + n): [emoji, name, coins] — 'veg' = one vegetable instead of coins
  const EXTRA = [['🪙', 'เหรียญ', 15], ['🪙', 'เหรียญ', 15], ['🥕', 'veg', 0], ['🍀', 'ใบโคลเวอร์สี่แฉก', 40]];
  const BOARDC = { board: 1 }, NPCC = NPCS.map((N, i) => ({ npc: i }));

  const town = new Image(), farm = new Image();
  let el = null, cv, ctx, wrapEl, barEl, world = null, wctx, started = false, loaded = 0, bsT = 0, bsSig = '';
  let base, obj, block, Z = 2, dpr = 1, cam = { x: 0, y: 0 }, hits = [], t = 0, last = 0;
  const me = { x: TOWER.door[0], y: TOWER.door[1] + 1, path: [], dir: 'down', sp: 3.2, t: 0 };
  let O = null, people = [], lotsSig = '', sentSig = '', tags = [], offset = 0, cardEl, cardL = null, busy = false, cardTick = 0;
  let floor = [], floorDay = '', farms = {}, farmsT = 0;
  let W = null, ov = null, ovx = null, worldEl = null, tickAt = {};   // the cozy engine (village-world.js) and its overlay canvas
  /* ---------- pet ---------- */
  const myPet = () => (Prog.get().vil || {}).pet || null;
  const petFed = pt => !!pt && Date.now() < (pt.fed || 0);
  const coatOk = c => COATS[c] ? c : 'orange';
  const pm = { x: 0, y: 0, face: 1, moving: false, act: null, actT: 0, init: false };   // where my cat is on the map
  function coatSheet(k) {
    k = coatOk(k); if (coatCache[k]) return coatCache[k];
    const c = document.createElement('canvas'); c.width = PETS.width; c.height = PETS.height; const g = c.getContext('2d'); g.drawImage(PETS, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data, hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), [, b, s, o] = COATS[k], B = hex(b), Sd = hex(s), Ou = hex(o);
    for (let i = 0; i < px.length; i += 4) { if (!px[i + 3]) continue; const v = px[i]; const m = v === 224 && px[i + 1] === 224 ? B : v === 181 && px[i + 1] === 181 ? Sd : v === 47 && px[i + 1] === 47 ? Ou : null; if (m) { px[i] = m[0]; px[i + 1] = m[1]; px[i + 2] = m[2]; } }
    g.putImageData(d, 0, 0); return coatCache[k] = c;
  }
  const homeOf = L => L && movedIn(L) ? [L.front[0] + 1, L.front[1]] : [TOWER.door[0] + 1, TOWER.door[1] + 1];
  // a cat walks after its owner while fed, otherwise back to its home spot
  function follow(pt, owner, fed, home, dt) {
    const tx = fed ? owner.x + (owner.dir === 'right' ? -1.1 : owner.dir === 'left' ? 1.1 : .95) : home[0], ty = fed ? owner.y + .15 : home[1];
    if (!pt.init) { pt.x = tx; pt.y = ty; pt.init = true; }
    const dx = tx - pt.x, dy = ty - pt.y, d = Math.hypot(dx, dy);
    if (d > 14) { pt.x = tx; pt.y = ty; pt.moving = false; return; }
    if (d > .15) { const mv = Math.min(d, (fed ? Math.max(owner.sp || 3.2, 3) * 1.15 : 1.5) * dt * (d > 3 ? 2 : 1)); pt.x += dx / d * mv; pt.y += dy / d * mv; if (Math.abs(dx) > .05) pt.face = dx > 0 ? 1 : -1; }
    pt.moving = d > .15;
  }
  function drawCat(pt, coat, prem, asleep, tag) {
    if (!PETS.complete || !PETS.width) return;
    let a = asleep ? 'sleep' : pt.moving ? 'run' : (Math.floor((t + (pt.x | 0)) / 7) % 3 === 2 ? 'clean' : 'idle');
    if (pt.act) { const r = CATROW[pt.act]; if ((t - pt.actT) * r[2] < r[1] * (pt.act === 'jump' ? 2 : 1)) a = pt.act; else pt.act = null; }
    const [row, n, fps] = CATROW[a], fr = Math.floor((pt.act ? t - pt.actT : t) * fps) % n;
    const s = S() * .9, cw = 32 * s, x = sx((pt.x + .5) * T) - cw / 2, y = sy((pt.y + 1) * T) - cw;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x + cw / 2, y + 31.5 * s, 6 * s, 1.6 * s, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (pt.face < 0) { ctx.translate(x + cw, 0); ctx.scale(-1, 1); ctx.drawImage(coatSheet(coat), fr * 32, row * 32, 32, 32, 0, y, cw, cw); } else ctx.drawImage(coatSheet(coat), fr * 32, row * 32, 32, 32, x, y, cw, cw);
    ctx.restore();
    if (!asleep && a !== 'jump') { const hx = x + (pt.face > 0 ? 19 : 13) * s, hy = y + (a === 'run' || a === 'walk' ? 21 : 20) * s;   // collar; party hat with premium food
      ctx.fillStyle = '#e63946'; ctx.fillRect(hx - (pt.face > 0 ? 3 : 0) * s, hy + 4 * s, 3 * s, 1 * s); ctx.fillStyle = '#ffd84d'; ctx.fillRect(hx - (pt.face > 0 ? 2 : -1) * s, hy + 5 * s, 1 * s, 1 * s);
      if (prem) { ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.moveTo(hx - 2.5 * s, hy); ctx.lineTo(hx + 2.5 * s, hy); ctx.lineTo(hx, hy - 6 * s); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(hx - 1.5 * s, hy - 3 * s, 3 * s, 1 * s); ctx.fillStyle = '#ffd84d'; ctx.fillRect(hx - s, hy - 7 * s, 2 * s, 2 * s); } }
    if (tag) { const top = y + 19 * s - (prem && !asleep ? 8 : 2) * s; tags.push([x + cw / 2, top, tag[0], { fs: 10, bg: tag[1], hit: tag[2] }]);
      if (tag[2]) hits.push({ l: x + 4 * s, t: y + 12 * s, w: 24 * s, h: 20 * s, hit: tag[2] }); }
  }
  const catIcon = c => coatOk(c) === 'black' ? '🐈‍⬛' : '🐱';
  // what other players see: presence pe = [coat, name, fed 0/1, premium 0/1]; the lot record keeps {c, n} for the cat napping at home
  const petPres = () => { const pt = myPet(); return pt ? [coatOk(pt.coat), String(pt.n || '').slice(0, 12), petFed(pt) ? 1 : 0, petFed(pt) && pt.prem ? 1 : 0] : 0; };
  function petToLot() { const pt = myPet(), L = myLot(); if (!O || !L || !pt) return; const mk = myKey(), v = { c: coatOk(pt.coat), n: String(pt.n || '').slice(0, 12) };
    if (L.pet && L.pet.c === v.c && L.pet.n === v.n) return;
    O.txLot(L.id, cur => cur && cur.k === mk ? { ...cur, pet: v } : cur ? undefined : null).catch(() => {}); }
  function petSave(pt, m) { const p = Prog.get(); p.vil = p.vil || {}; p.vil.pet = pt; Prog.put(p); if (m) toast(m); send(true); petToLot(); renderBar(); renderCard(); }
  function adopt() {
    const p = Prog.get(); if (myPet()) return;
    if ((p.coins | 0) < PET_PRICE) return toast(`ต้องมี 🪙 ${fmtN(PET_PRICE)} ขาดอีก ${fmtN(PET_PRICE - (p.coins | 0))}`);
    p.coins -= PET_PRICE; p.vil = p.vil || {}; p.vil.pet = { n: 'เหมียว', coat: 'orange', fed: Date.now() + MEAL, prem: 0, fd: '' }; Prog.put(p);   // the first day's food comes with it
    if (typeof Stats !== 'undefined') Stats.econ('out_pet', PET_PRICE);
    pm.init = false; pm.act = 'jump'; pm.actT = t; petSave(p.vil.pet, `🐱 รับเลี้ยงเหมียวแล้ว! −${fmtN(PET_PRICE)} 🪙 · ตั้งชื่อได้เลย`);
    const nm = myName(); feed(`🐱 ${nm} รับเลี้ยงแมวตัวใหม่!`);
  }
  function feedPet(k) {
    const pt = myPet(), f = FOOD[k], p = Prog.get(); if (!pt || !f) return;
    if ((pt.fed || 0) - Date.now() > MEAL / 2) return toast(`${pt.n} ยังอิ่มอยู่ ค่อยให้อาหารอีกทีตอนเหลือไม่ถึงครึ่ง`);
    if ((p.coins | 0) < f[0]) return toast('เหรียญไม่พอ');
    p.coins -= f[0]; pt.fed = Date.now() + MEAL; pt.prem = k === 'p' ? 1 : 0;
    let m = `${f[2]} ${pt.n} อิ่มแล้ว −${f[0]} 🪙`; const d = bkkDay(), extra = [];
    if (pt.fd !== d) { pt.fd = d; p.coins += PET_FIND; extra.push(`คาบเหรียญมาให้ +${PET_FIND} 🪙`); if (typeof Stats !== 'undefined') Stats.econ('in_petfind', PET_FIND); }
    if (k === 'p' && typeof CROPS !== 'undefined') { const pool = ['car', 'tom', 'chi', 'cor'].filter(id => CROPS[id]), id = pool[Math.floor(Math.random() * pool.length)];
      if (id) { p.farm = p.farm || { plots: [], book: {}, fw: {}, bag: {} }; p.farm.bag = p.farm.bag || {}; p.farm.bag[id] = (p.farm.bag[id] || 0) + 1; extra.push(`ขุดเจอ${CROPS[id][0]} 1 ลูก`); } }
    p.vil.pet = pt; Prog.put(p); if (typeof Stats !== 'undefined') Stats.econ('out_petfood', f[0]);
    pm.act = k === 'p' ? 'jump' : 'paw'; pm.actT = t; petSave(pt, m + (extra.length ? ' · ' + extra.join(' · ') : ''));
  }
  function renamePet() {
    const pt = myPet(), inp = cardEl && cardEl.querySelector('#vilPetName'); if (!pt || !inp) return;
    const v = inp.value.replace(/[<>&"]/g, '').trim().slice(0, 12); if (!v) return toast('ใส่ชื่อก่อนนะ');
    if (v === pt.n) return; pt.n = v; petSave(pt, `✏️ ตอนนี้ชื่อ ${v} แล้ว`);
  }
  function dyePet(k) {
    const pt = myPet(), p = Prog.get(); if (!pt || !COATS[k] || k === pt.coat) return;
    if ((p.coins | 0) < DYE) return toast('เหรียญไม่พอ');
    p.coins -= DYE; pt.coat = k; p.vil.pet = pt; Prog.put(p); if (typeof Stats !== 'undefined') Stats.econ('out_dye', DYE);
    pm.act = 'paw'; pm.actT = t; petSave(pt, `🎨 ย้อมเป็นสี${COATS[k][0]}แล้ว −${DYE} 🪙`);
  }
  function petCard() {
    const pt = myPet(), coins = Prog.get().coins | 0; let h = `<button class="x" type="button" data-a="close" aria-label="ปิด">✕</button>`;
    if (!pt) {
      h += `<h4>🐾 รับเลี้ยงแมว</h4><p class="muted">เดินตามคุณในหมู่บ้าน · มื้อแรกของวันคาบเหรียญมาให้ ${PET_FIND} 🪙<br>หิวแล้วแค่นอนรอที่บ้าน ไม่หนี ไม่ป่วย ไม่ตาย</p>
        <button class="btn primary" type="button" data-a="adopt"${coins < PET_PRICE ? ' disabled' : ''}>🐱 รับเลี้ยง · 🪙 ${fmtN(PET_PRICE)} (มีอาหารวันแรกให้)</button>${coins < PET_PRICE ? `<p class="vil-need">ขาดอีก 🪙 ${fmtN(PET_PRICE - coins)}</p>` : ''}`;
    } else {
      const fed = petFed(pt), left = Math.max(0, (pt.fed || 0) - Date.now()), full = Math.round(left / MEAL * 100), canEat = left <= MEAL / 2;
      h += `<h4>${catIcon(pt.coat)} ${escH(pt.n)}</h4><p class="muted">${fed ? 'เดินตามคุณอยู่' : 'หิว เลยนอนรอที่บ้าน 💤'}${fed && pt.prem ? ' · 🎉 ใส่หมวกปาร์ตี้' : ''}</p>
        <div class="vil-pb"><i style="width:${full}%;background:#ffb703"></i></div><small class="muted">อิ่ม ${full}%${fed ? ` · อยู่ได้อีก ${leftTxt(left)}` : ''} · 1 มื้ออยู่ได้ 1 วัน</small>
        ${Object.entries(FOOD).map(([k, f]) => `<button class="btn${k === 'b' ? ' primary' : ''}" type="button" data-a="feed" data-k="${k}"${!canEat || coins < f[0] ? ' disabled' : ''}>${f[2]} ${f[1]} · 🪙 ${f[0]}</button>`).join('')}
        <p class="muted" style="font-size:12px">${canEat ? '' : 'ยังอิ่มอยู่ ให้อาหารได้อีกตอนเหลือไม่ถึงครึ่ง · '}พรีเมียม: หมวกปาร์ตี้ + ตีลังกา + ขุดเจอผักให้ 1 ลูก${pt.fd === bkkDay() ? ' · วันนี้คาบเหรียญมาให้แล้ว' : ` · มื้อแรกของวัน +${PET_FIND} 🪙`}</p>
        <div class="vil-name"><input id="vilPetName" maxlength="12" value="${escH(pt.n)}" aria-label="ชื่อสัตว์เลี้ยง"><button class="btn" type="button" data-a="rename">ตั้งชื่อ</button></div>
        <div class="vil-coats">${Object.entries(COATS).map(([k, c]) => `<button class="vil-coat${k === coatOk(pt.coat) ? ' on' : ''}" type="button" data-a="coat" data-k="${k}" title="${c[0]}" aria-label="สี${c[0]}" style="background:linear-gradient(135deg,${c[1]} 55%,${c[2]} 55%);border-color:${c[3]}"${k !== coatOk(pt.coat) && coins < DYE ? ' disabled' : ''}></button>`).join('')}</div>
        <small class="muted">สีขน${COATS[coatOk(pt.coat)][0]} · ย้อมสีใหม่ ${DYE} 🪙 · เปลี่ยนชื่อฟรี</small>`;
    }
    cardEl.innerHTML = h; cardEl.hidden = false;
  }
  // everyone's public garden (rooms/_farm), refreshed every minute while the village is open
  function loadFarms() { if (!O || !O.listFarms || Date.now() - farmsT < 60e3) return; farmsT = Date.now();
    O.listFarms().then(F => { const m = {}; for (const r of F || []) if (r && r.k) m[r.k] = r; farms = m; }).catch(() => {}); }
  const gardenPlots = L => L.k === myKey() ? (Prog.get().farm || {}).plots || [] : (farms[L.k] || {}).plots || [];
  // garden size bought in the farm screen → the lot record, so everyone's map shows the right number of beds
  function setGarden(g) { const L = myLot(); if (!O || !L || (L.g | 0) >= g) return; const mk = myKey();
    O.txLot(L.id, cur => cur && cur.k === mk ? { ...cur, g: Math.max(g, cur.g | 0) } : cur ? undefined : null).catch(() => {}); }
  // the farm lives on the lot from จองที่ดิน on (rooftop size, 10); the garden stage makes it 14; 18/24 are bought in the farm.
  // Also fixes saves from another device or from before this rule (lots reserved earlier, finished garden stages)
  const gDone = L => L.stage >= 5 || (L.stage === 4 && !building(L));
  const gSize = L => Math.min(24, Math.max(L.g | 0, gDone(L) ? 14 : 10));
  function syncHome() { const L = myLot(), p = Prog.get(); if (!L) return;
    const roof = typeof Farm !== 'undefined' && Farm.n ? Farm.n() : 10, g = Math.min(24, Math.max(gDone(L) ? 14 : 0, L.g | 0, (p.vil && p.vil.g) | 0, roof));
    if (((p.vil || {}).g | 0) < g) { p.vil = p.vil || {}; p.vil.g = g; Prog.put(p); if (typeof Farm !== 'undefined' && Farm.pub) Farm.pub(); }
    if ((L.g | 0) < g) setGarden(g); }
  function openGarden(L) { if (L.k !== myKey()) window.farmVisit = L.k; if (typeof startGame === 'function') startGame('farm'); }
  const srvNow = () => Date.now() + offset;
  const myLots = () => LOTS.filter(L => L.stage && L.k && L.k === myKey());
  const myLot = () => myLots().sort((a, b) => b.mv - a.mv)[0];   // after a move the newest (mv) is home, even before the old lot is freed
  const building = L => L.stage >= 2 && L.end > srvNow();
  const movedIn = L => L.stage > 2 || (L.stage === 2 && !building(L));   // the starter house is built
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
    for (const N of NPCS) block[N.at[1]][N.at[0]] = 1;           // neighbours stand on the plaza
  }
  // a lot by stage (Tiny Town tiles: 96-122 foundation, 44-58 frame, 48-67 roofs, 72-89 walls; farm tiles = 1000+id;
  // 100000 + combo * 1000 + id = a town tile from the sheet tinted for that roof/wall combo, see tinted())
  function lot(L, gnd, put) {
    const X = L.x, Y = L.y, rk = roofOf(L), wk = wallOf(L), cb = RK.indexOf(rk) * 8 + WK.indexOf(wk), tt = id => 100000 + cb * 1000 + id;
    const row = (y, a, x0 = X) => a.forEach((tl, i) => tl >= 0 && put(x0 + i, y, tt(tl)));
    const xs = String(L.xs || ''), has = c => xs.includes(c), stone = wk === 'stone', red = rk === 'red';
    L.front = [X + 2, Y + 3]; gnd(X + 2, Y + 3, 43);
    if (!L.stage) { put(X + 2, Y + 1, 83); return; }                                    // empty = a sign
    garden(L, gnd);                                                                    // the farm is here from จองที่ดิน on
    const b = building(L);
    if (L.stage === 1) { [[12, 13, 13, 14], [24, 25, 25, 26], [36, 37, 37, 38]].forEach((a, j) => a.forEach((tl, i) => gnd(X + i, Y + j, tl))); put(X + 3, Y + 3, 83); return; }
    if (L.stage === 2 && b) { row(Y, [96, 97, 97, 98]); row(Y + 1, [108, 109, 109, 110]); row(Y + 2, [120, 121, 121, 122]); put(X + 4, Y + 2, 57); return; }
    const sRoof = red ? [52, 54] : [48, 50], sWall = stone ? [88, 89] : [84, 85], wall = stone ? [76, 88, 89, 79] : [72, 84, 85, 75];
    if (L.stage === 2) {                                                               // the starter cottage + its front extras
      row(Y + 1, sRoof, X + 1); row(Y + 2, sWall, X + 1);
      if (has('o')) { gnd(X + 3, Y + 1, 2); gnd(X, Y, 2); gnd(X + 3, Y, 2); }
      if (has('t')) put(X, Y + 1, 28); if (has('m')) put(X, Y + 2, 83); if (has('p')) put(X + 3, Y + 2, 107);
      if (has('f')) { put(X, Y + 3, 80); put(X + 1, Y + 3, 82); }
      return; }
    if (L.stage === 3 && b) { row(Y, [44, 45, 45, 46]); row(Y + 1, [56, -1, -1, 58]); row(Y + 1, sRoof, X + 1); row(Y + 2, wall); put(X + 4, Y + 2, 57); return; }   // scaffold round the cottage
    row(Y, red ? [52, 55, 53, 54] : [48, 51, 49, 50]); row(Y + 1, red ? [64, 65, 67, 66] : [60, 61, 63, 62]); row(Y + 2, wall);
    if (has('o')) { gnd(X, Y + 3, 2); gnd(X + 1, Y + 3, 2); }
    if (has('f')) { put(X, Y + 3, 80); put(X + 1, Y + 3, 82); }
    if (has('t')) put(X + 4, Y, 28); if (has('m')) put(X + 4, Y + 1, 83);
    if (L.stage === 4 && b) put(X + 4, Y + 2, 57); else if (has('p')) put(X + 4, Y + 2, 107);
    if (L.stage === 5) put(X + 4, Y + 3, 1085);
  }
  const gCell = (L, i) => { const per = gSize(L) >= 18 ? 6 : 5; return [L.x + 5 + i % per, L.y + Math.floor(i / per)]; };
  function garden(L, gnd) {                       // the beds; the crops on them are drawn live in frame()
    const n = gSize(L), per = n >= 18 ? 6 : 5, fx = L.x + 5;
    for (let i = 0; i < n; i++) { const r = Math.floor(i / per), c = i % per, k = Math.min(per, n - r * per);
      gnd(fx + c, L.y + r, 1000 + (k === 1 ? 0 : (c === 0 ? 48 : c === k - 1 ? 51 : 49 + (c % 2)) + 12)); block[L.y + r][fx + c] = 1; }
  }
  // rooms/_vil/lots -> houses on the map (repaint only when something changed)
  function applyLots(v) {
    const sig = JSON.stringify(v || {}); if (sig === lotsSig) return; lotsSig = sig; lotRaw = v || {};
    for (const L of LOTS) { const d = (v || {})[L.id] || {}; Object.assign(L, { stage: Math.max(0, Math.min(5, d.stage | 0)), k: d.k || '', n: d.n || '', who: d.who || '', g: d.g | 0, h: d.h | 0, end: +d.end || 0, hp: d.hp || null, pet: d.pet && d.pet.c ? d.pet : null, rc: d.rc || '', wc: d.wc || '', xs: typeof d.xs === 'string' ? d.xs.slice(0, 8) : '', cz: d.cz | 0, mv: +d.mv || 0 }); }
    healMove();
    if (W) relotW(); else if (base) { rebuild(); if (loaded >= 2) paintWorld(); }
    syncHome(); renderCard(); renderBar();
  }
  // town sheet recoloured for one roof/wall combo (cb = roof index * 8 + wall index), made once per combo in use
  const tintCache = {};
  function tinted(cb) {
    if (tintCache[cb]) return tintCache[cb];
    const c = document.createElement('canvas'); c.width = town.width; c.height = town.height; const g = c.getContext('2d'); g.drawImage(town, 0, 0);
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), rk = RK[Math.floor(cb / 8)], wk = WK[cb % 8];
    const tint = (tiles, col, test) => { const [tr, tg, tb] = hex(col);
      for (const t of tiles) { const x0 = t % 12 * T, y0 = Math.floor(t / 12) * T, d = g.getImageData(x0, y0, T, T), p = d.data;
        for (let i = 0; i < p.length; i += 4) { const r = p[i], gg = p[i + 1], b = p[i + 2]; if (!p[i + 3] || !test(r, gg, b)) continue;
          const f = .45 + (r + gg + b) / 765 * .85; p[i] = Math.min(255, tr * f); p[i + 1] = Math.min(255, tg * f); p[i + 2] = Math.min(255, tb * f); }
        g.putImageData(d, x0, y0); } };
    if (rk !== 'blue' && rk !== 'red') tint([48, 49, 50, 51, 60, 61, 62, 63], ROOFS[rk][1], (r, gg, b) => b > r + 8 && r + gg + b > 150);   // shingles, not the outline
    if (wk !== 'wood' && wk !== 'stone') tint([72, 73, 74, 75, 84, 85, 86, 87], WALLS[wk][1], (r, gg, b) => r > b + 40 && r + gg + b > 330);  // planks, not doors
    return tintCache[cb] = c;
  }
  const tile = (g, tl, x, y) => { if (tl >= 100000) { const n = tl % 1000; g.drawImage(tinted(Math.floor(tl / 1000) - 100), (n % 12) * T, Math.floor(n / 12) * T, T, T, x * T, y * T, T, T); return; }
    const s = tl >= 1000 ? farm : town, n = tl % 1000; g.drawImage(s, (n % 12) * T, Math.floor(n / 12) * T, T, T, x * T, y * T, T, T); };
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
  function goTo(cell) { if (!cell) return; if (W) { W.travel(cell); send(); return; } const p = bfs([Math.round(me.x), Math.round(me.y)], cell); if (p) { me.path = p; send(); } }
  // keyboard: arrows / WASD walk one cell at a time while held (presence is written when you stop, or every 1.5 s)
  const KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }, held = [];
  let keyWalk = false, keySendT = 0;
  const typing = e => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };
  function onKey(e) {
    if (W) return;                                // the engine walks smoothly with its own keys
    const k = KEYS[e.key] ? e.key : KEYS[e.key && e.key.toLowerCase()] ? e.key.toLowerCase() : null;
    if (!k || e.ctrlKey || e.metaKey || e.altKey || typing(e) || !visible()) return;
    e.preventDefault(); const i = held.indexOf(k);
    if (e.type === 'keydown') { if (i < 0) held.push(k); if (me.path.length > 1) me.path.length = 1; }   // stop a tap-walk after the current step
    else if (i >= 0) held.splice(i, 1);
  }
  function keyStep(dt) {
    if (!held.length) { if (keyWalk && !me.path.length) { keyWalk = false; send(); } return; }
    keyWalk = true; if ((keySendT -= dt) < 0) { keySendT = 1.5; send(); }
    if (me.path.length) return;
    const [dx, dy] = KEYS[held[held.length - 1]], nx = Math.round(me.x) + dx, ny = Math.round(me.y) + dy;
    if (walk(nx, ny)) me.path = [[nx, ny]]; else me.dir = dx ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  function send(force) {                          // one write per new target cell (or tab shown/hidden)
    if (!O) return; const tg = me.path.length ? me.path[me.path.length - 1] : [Math.round(me.x), Math.round(me.y)];
    const v = document.hidden || !visible() ? 0 : 1, pe = petPres(), sig = `${tg[0]},${tg[1]},${v},${pe}`; if (!force && sig === sentSig) return; sentSig = sig;
    O.setPresence({ vx: tg[0], vy: tg[1], v, pe });
  }
  // live coworkers: walk each one to the cell they last sent
  // 🕹️ ตึกเกม: the solo games are machines inside; a coworker playing one keeps standing at it (presence g = game id, vx/vy = the machine)
  const arcGames = () => typeof GAMES === 'undefined' ? [] : GAMES.filter(g => !g.online && g.mount);
  const arcIds = () => new Set(arcGames().map(g => g.id));
  const inArc = p => { const r = W && W.arcade && W.arcade.room(); return !!r && p.vx >= r.x0 && p.vx < r.x0 + r.w && p.vy >= r.y0 && p.vy < r.y0 + r.h; };
  const arcTop = {};                               // today's #1 per game, refreshed while the hall is open
  function arcRank(id) { const c = arcTop[id]; if (c && Date.now() - c.t < 90e3) return c.top; arcTop[id] = { t: Date.now(), top: c ? c.top : null };
    if (typeof loadRank === 'function') loadRank().then(R => R.board(id, 'd')).then(rows => { arcTop[id].top = rows && rows[0] || null; }).catch(() => {}); return arcTop[id].top; }
  function arcPlay(id) { if (typeof Tower !== 'undefined') store.set('hubView', 'village'); if (typeof startGame === 'function') startGame(id); }
  function syncOthers() {
    const ids = arcIds(), here = people.filter(p => !p.me && p.vx != null && ((p.g === 'village' && p.v !== 0) || (ids.has(p.g) && inArc(p))));
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
    const full = document.getElementById('hub')?.classList.contains('vil-full'), jd = jobsDone().length;
    barEl.innerHTML = `<button class="btn sm" type="button" data-a="full" aria-pressed="${!!full}" aria-label="${full ? 'ย่อแผนที่' : 'ขยายแผนที่เต็มจอ'}">${full ? '🗗' : '⛶'}<span class="bl"> ${full ? 'ย่อ' : 'เต็มจอ'}</span></button>${mL ? '<button class="btn sm" type="button" data-a="home" aria-label="บ้านฉัน">📍<span class="bl"> บ้านฉัน</span></button>' : ''}<button class="btn sm" type="button" data-a="pet">${(pt => pt ? `${catIcon(pt.coat)}<span class="bl"> ${escH(pt.n)}</span>${petFed(pt) ? '' : ' 💤'}` : '🐾<span class="bl"> สัตว์เลี้ยง</span>')(myPet())}</button><span class="vil-brick" title="อิฐได้จากมินิเกม รอบละ 1–3 ก้อน วันละไม่เกิน ${B.cap} + อิฐบนถนนในหมู่บ้านวันละ ${FLOOR_N} ก้อน">🧱 ${fmtN(B.n)} <small>เกม ${B.today}/${B.cap} · ถนน ${bricksGot()}/${FLOOR_N}</small></span><button class="btn sm vil-bd" type="button" data-a="board" aria-label="งานส่งของ ${jd}/${JOB_N}">📦<span class="bl"> ส่งของ</span> <b class="${jd < JOB_N ? 'vil-n' : ''}">${jd}/${JOB_N}</b></button><span class="muted">${mL ? `⭐ บ้านคุณ แปลง ${mL.id} · ${STAGE_TH[mL.stage]}${building(mL) ? ` ${Math.round(pctOf(mL) * 100)}%` : ''}`
      : L.ok ? '✅ ครบเงื่อนไขแล้ว · แตะป้าย 🪧 เพื่อจองที่ดิน'
      : `🔒 สร้างบ้านได้เมื่อมีห้อง ${UNLOCK_W} + Lv ${UNLOCK_LV} · ตอนนี้ ห้อง ${L.w}/${UNLOCK_W} ${ck(L.w >= UNLOCK_W)} · Lv ${L.lv}/${UNLOCK_LV} ${ck(L.lv >= UNLOCK_LV)}`}</span>`;
  }

  /* ---------- bricks on the roads (3 a day, same spots for everyone) ---------- */
  function floorSpots() {
    const d = bkkDay(); if (floorDay === d || !(base || W)) return floor; floorDay = d;
    const rnd = rng(+d.replace(/-/g, '') % 2147483646 + 1), cells = [];
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if ((W ? x < 72 && W.G[y][x] === 0 && !(W.block[y + 1] || [])[x] : [25, 40, 41].includes(base[y][x])) && !block[y][x] && Math.hypot(x - 5, y - 8) > 6) cells.push([x, y]);
    for (let i = 0; i < 5; i++) rnd();
    floor = [];
    while (floor.length < FLOOR_N + EXTRA.length && cells.length) { const [x, y] = cells.splice(Math.floor(rnd() * cells.length), 1)[0]; if (floor.every(f => Math.hypot(f.x - x, f.y - y) > (floor.length < FLOOR_N ? 8 : 4))) floor.push({ x, y, i: floor.length }); }
    return floor;
  }
  const floorGot = () => { const v = Prog.get().vil || {}; return v.fd === bkkDay() ? v.fp || [] : []; };
  const bricksGot = () => floorGot().filter(i => i < FLOOR_N).length;
  const floorIcon = f => f.i < FLOOR_N ? '🧱' : EXTRA[f.i - FLOOR_N][0];
  function pickFloor(f) {
    const p = Prog.get(), v = p.vil || (p.vil = {}), d = bkkDay();
    if (v.fd !== d) { v.fd = d; v.fp = []; } if (v.fp.includes(f.i)) return;
    v.fp.push(f.i);
    if (f.i < FLOOR_N) { v.bricks = (v.bricks || 0) + 1; Prog.put(p); if (typeof Stats !== 'undefined') Stats.econ('brick_map', 1);
      toast(`🧱 เก็บอิฐบนถนน +1 · วันนี้ ${bricksGot()}/${FLOOR_N}`); }
    else { const x = EXTRA[f.i - FLOOR_N];
      if (x[1] === 'veg') { const pool = ['car', 'tom', 'let'].filter(cropOk), id = pool[(f.x + f.y) % pool.length] || 'car';
        p.farm = p.farm || { plots: [], book: {}, fw: {}, bag: {} }; p.farm.bag = p.farm.bag || {}; p.farm.bag[id] = (p.farm.bag[id] || 0) + 1; Prog.put(p);
        if (typeof Stats !== 'undefined') Stats.econ('pickup_veg', 1);
        toast(`${cropEmo(id)} เจอ${cropName(id)}บนถนน +1 · เข้าตะกร้าแล้ว`); }
      else { Prog.put(p); Prog.give(x[2], 0, 'pickup'); toast(`${x[0]} เก็บ${x[1]}บนถนน +${x[2]} 🪙`); } }
    renderBar(); renderCard();
  }

  /* ---------- deliveries (board jobs, same for everyone that day) ---------- */
  const cropOk = id => typeof CROPS !== 'undefined' && !!CROPS[id];
  const cropName = id => cropOk(id) ? CROPS[id][0] : id;
  const cropEmo = id => ({ bok: '🥬', let: '🥗', car: '🥕', tom: '🍅', chi: '🌶️', cor: '🌽', pum: '🎃', wat: '🍉' })[id] || '🥬';
  const unitPay = id => cropOk(id) ? Math.round(CROPS[id][3] * DELIVER) : 0;
  // who can receive: the NPCs on the plaza + every moved-in house (lots in id order, so everyone gets the same list)
  function jobs() {
    const d = bkkDay(), rnd = rng(+d.replace(/-/g, '') % 2147483646 + 7), houses = LOTS.filter(L => L.k && movedIn(L)), mk = myKey(), out = [], N = NPCS.length + houses.length, used = new Set();
    for (let i = 0; i < 3; i++) rnd();
    for (let j = 0; j < JOB_N; j++) {
      const c = JOB_CROPS[Math.floor(rnd() * JOB_CROPS.length)], q = 3 + Math.floor(rnd() * 4), why = WHY[Math.floor(rnd() * WHY.length)];
      let ri = Math.floor(rnd() * N); while (used.has(ri) && used.size < N) ri = (ri + 1) % N; used.add(ri);
      let to = ri < NPCS.length ? { npc: ri } : { L: houses[ri - NPCS.length] };
      if (to.L && to.L.k === mk) to = { npc: j % NPCS.length };          // never a job to your own house
      out.push({ j, c, q, why, to, pay: q * unitPay(c), name: to.L ? to.L.n || '?' : NPCS[to.npc].n });
    }
    return out;
  }
  const jobsDone = () => { const v = Prog.get().vil || {}; return v.jd === bkkDay() ? v.jp || [] : []; };
  const jobsFor = g => jobs().filter(J => !jobsDone().includes(J.j) && (g.npc != null ? J.to.npc === g.npc : J.to.L === g));
  function haveCrop(id) { const bag = (Prog.get().farm || {}).bag || {}; return Object.keys(bag).filter(k => k.split('.')[0] === id).reduce((a, k) => a + (bag[k] | 0), 0); }
  function deliver(j) {
    const J = jobs().find(x => x.j === j); if (!J || jobsDone().includes(j)) return renderCard();
    if (haveCrop(J.c) < J.q) return toast(`มี${cropName(J.c)} ${haveCrop(J.c)}/${J.q} · ปลูกเพิ่มที่สวน แล้วค่อยมาส่งนะ`);
    const p = Prog.get(), bag = p.farm.bag, v = p.vil || (p.vil = {}); let left = J.q;
    for (const k of Object.keys(bag).filter(k => k.split('.')[0] === J.c).sort((a, z) => (typeof bagPrice === 'function' ? bagPrice(a) - bagPrice(z) : 0))) {
      const u = Math.min(left, bag[k] | 0); bag[k] -= u; if (!bag[k]) delete bag[k]; left -= u; if (!left) break; }
    if (v.jd !== bkkDay()) { v.jd = bkkDay(); v.jp = []; } v.jp.push(j); Prog.put(p);
    Prog.give(J.pay, 10, 'delivery'); if (typeof Stats !== 'undefined') Stats.econ('delivery', 1);
    toast(`📦 ส่งให้${J.name}แล้ว +${fmtN(J.pay)} 🪙 ❤️`);
    renderBar(); renderCard();
  }
  const jobRow = (J, here) => { const done = jobsDone().includes(J.j), n = haveCrop(J.c), ok = n >= J.q;
    return `<div class="vil-stg${done ? ' done' : ''}"><span>${cropEmo(J.c)}</span><span>${cropName(J.c)} ${J.q} → ${escH(J.name)}<br><small>${J.why} · ${done ? 'ส่งแล้ว ขอบคุณน้า ❤️' : `มี ${Math.min(n, 999)}/${J.q}`}</small></span><span>${done ? '✔'
      : here ? `<button class="btn sm${ok ? ' primary' : ''}" type="button" data-a="deliver" data-k="${J.j}"${ok ? '' : ' disabled'}>📦 ส่ง +${fmtN(J.pay)}</button>`
      : `<button class="btn sm" type="button" data-a="goto" data-k="${J.j}">ไปส่ง → +${fmtN(J.pay)}</button>`}</span></div>`; };
  function boardCard() {
    const L = jobs(), nd = jobsDone().length;
    return `<h4>📌 บอร์ดประกาศ · งานส่งของวันนี้</h4><p class="muted">ได้มากกว่าส่งโรงอาหาร 30% · เจ้าของบ้านไม่เสียอะไร · ส่งแล้ว ${nd}/${JOB_N}</p>${L.map(J => jobRow(J, false)).join('')}
      <p class="muted" style="font-size:12px">งานใหม่ทุกวัน เหมือนกันทุกคน · ใช้ผักในตะกร้า (ผักธรรมดาก่อนผักกลายพันธุ์)</p>`;
  }
  function npcCard(i) {
    const N = NPCS[i], L = jobsFor({ npc: i });
    return `<h4>👋 ${N.n}</h4>${L.length ? `<p class="muted">รอของจากคุณอยู่</p>${L.map(J => jobRow(J, true)).join('')}` : '<p class="muted">สวัสดีจ้า วันนี้ไม่มีอะไรฝาก · ดูงานส่งของได้ที่ 📌 บอร์ด</p>'}`;
  }

  // what the farm basket should keep: today's open deliveries (crop -> qty) and the vegetables the next house stage takes.
  // The lots only load once the village has been opened, so the house part is cached for the farm screen.
  function needs() {
    if (!on()) return null; const job = {}, done = jobsDone();
    for (const J of jobs()) if (!done.includes(J.j)) job[J.c] = (job[J.c] || 0) + J.q;
    const L = myLot(), lot = (Prog.get().vil || {}).lot; let house = null;
    if (L) { const s = STAGES[L.stage]; house = s && s[4] ? { veg: s[4], stage: s[0] + ' ' + s[1] } : null; try { localStorage.setItem('vilNeed', JSON.stringify({ lot: L.id, house })); } catch (e) {} }
    else if (lot) { try { const c = JSON.parse(localStorage.getItem('vilNeed') || 'null'); if (c && c.lot === lot) house = c.house; } catch (e) {} }
    return { job, house };
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
    if (H.coins < s[2]) m.push(`🪙 ${fmtN(s[2] - H.coins)}`); if (H.bricks < s[3]) m.push(`🧱 ${s[3] - H.bricks} (มี ${H.bricks}/${s[3]})`); if (H.veg < s[4]) m.push(`🥬 ${s[4] - H.veg} (มี ${H.veg}/${s[4]})`);
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
    const gN = Math.min(24, Math.max(10, typeof Farm !== 'undefined' && Farm.n ? Farm.n() : 10));   // the rooftop farm moves here now
    const ok = await tx(L, cur => cur && cur.k ? undefined : { k: mk, n: nm.slice(0, 20), who: typeof meWho === 'function' ? meWho() : 'adam', stage: 1, end: 0, t: srvNow(), g: gN });
    if (!ok) { toast('😅 แปลงนี้มีคนจองไปแล้ว ลองแปลงอื่นนะ'); return renderCard(); }
    pay(s[2], 0, 0); const p = Prog.get(); p.vil.lot = L.id; p.vil.g = Math.max(gN, p.vil.g | 0); Prog.put(p); if (typeof Farm !== 'undefined' && Farm.pub) Farm.pub();
    toast(`🪧 จองแปลง ${L.id} แล้ว! 🌱 ฟาร์มย้ายมาข้างที่ดินแล้ว −${fmtN(s[2])} 🪙`); feed(`🪧 ${nm} จองที่ดินแปลง ${L.id} ใน${L.lane} เตรียมสร้างบ้าน!`);
    renderCard(); renderBar();
  }
  async function next(L) {
    const mk = myKey(), st = L.stage, s = STAGES[st];
    if (!s || L.k !== mk || building(L) || missing(s).length) return renderCard();
    const ok = await tx(L, cur => {
      if (!cur) return null;                       // not loaded yet: Firebase retries with the server value
      if (cur.k !== mk || (cur.stage | 0) !== st || +cur.end > srvNow()) return undefined;
      return { ...cur, stage: st + 1, end: s[5] ? srvNow() + s[5] * HOUR() : 0, hp: null, g: cur.g || 10 };
    });
    if (!ok) { toast('ยังทำขั้นนี้ไม่ได้ ลองใหม่อีกครั้ง'); return renderCard(); }
    pay(s[2], s[3], s[4]);
    if (st + 1 === 5) { syncHome();
      toast('🎉 ขึ้นบ้านใหม่!'); feed(`🎉 ${myName()} ขึ้นบ้านใหม่ที่${L.lane} แปลง ${L.id}! แวะไปเยี่ยมกันได้`); }
    else toast(`${s[0]} เริ่ม${s[1]} · เสร็จใน ${s[5]} ชม.${st + 1 === 2 ? ' แล้วย้ายเข้าได้เลย' : ''} · ชวนเพื่อนมาช่วยให้เร็วขึ้น`);
    renderCard(); renderBar();
  }
  // colours + front extras: the first choice is free (cz = 0), then a repaint PAINT and each extra added ITEM; removing is free
  function decorCost(L, rc, wc, xs) { const add = [...xs].filter(c => !String(L.xs || '').includes(c)).length;
    return (L.cz && (rc !== roofOf(L) || wc !== wallOf(L)) ? PAINT : 0) + (L.cz ? add * ITEM : 0); }
  async function decorate(L, ch) {
    const mk = myKey(); if (!L || L.k !== mk || !movedIn(L) || busy) return;
    let rc = roofOf(L), wc = wallOf(L), xs = String(L.xs || '');
    if (ch.r && ROOFS[ch.r]) rc = ch.r; if (ch.w && WALLS[ch.w]) wc = ch.w;
    if (ch.x && XTRA[ch.x]) xs = xs.includes(ch.x) ? xs.replace(ch.x, '') : xs + ch.x;
    xs = Object.keys(XTRA).filter(c => xs.includes(c)).join('');
    if (rc === roofOf(L) && wc === wallOf(L) && xs === (L.xs || '')) return;
    const cost = decorCost(L, rc, wc, xs); if (cost > (Prog.get().coins | 0)) { toast(`🪙 ไม่พอ ต้องใช้ ${cost}`); return; }
    const ok = await tx(L, cur => !cur ? null : cur.k !== mk ? undefined : { ...cur, rc, wc, xs, cz: 1 });
    if (!ok) { toast('ยังแต่งบ้านไม่ได้ ลองใหม่อีกครั้ง'); return renderCard(); }
    if (cost) { const p = Prog.get(); p.coins -= cost; Prog.put(p); if (typeof Stats !== 'undefined') Stats.econ('out_hdecor', cost); }
    toast(`🎨 แต่งบ้านแล้ว${cost ? ` −${cost} 🪙` : ' (ครั้งแรกฟรี)'}`); renderBar();
  }
  function decorBox(L) {
    const rc = roofOf(L), wc = wallOf(L), xs = String(L.xs || ''), coins = Prog.get().coins | 0, dis = busy ? ' disabled' : '';
    const pr = L.cz ? PAINT : 0, it = L.cz ? ITEM : 0;
    return `<div class="vil-deco"><b>🎨 แต่งบ้าน</b> <small class="muted">${L.cz ? `เปลี่ยนสี ${PAINT} 🪙 · ของแต่งชิ้นละ ${ITEM} 🪙 · เอาออกฟรี` : 'เลือกครั้งแรกฟรี!'}</small>
      <div class="vil-coats">${RK.map(k => `<button class="vil-coat${k === rc ? ' on' : ''}" type="button" data-a="roof" data-k="${k}" title="หลังคา${ROOFS[k][0]}" aria-label="หลังคาสี${ROOFS[k][0]}" style="background:${ROOFS[k][1]};border-color:#3a2a20"${k !== rc && coins < pr ? ' disabled' : dis}></button>`).join('')}</div>
      <div class="vil-chips">${WK.map(k => `<button class="vil-chip${k === wc ? ' on' : ''}" type="button" data-a="wall" data-k="${k}"${k !== wc && coins < pr ? ' disabled' : dis}><i style="background:${WALLS[k][1]}"></i>${WALLS[k][0]}</button>`).join('')}</div>
      <div class="vil-chips">${Object.entries(XTRA).map(([k, v]) => `<button class="vil-chip${xs.includes(k) ? ' on' : ''}" type="button" data-a="xtra" data-k="${k}"${!xs.includes(k) && coins < it ? ' disabled' : dis}>${v[0]} ${v[1]}</button>`).join('')}</div></div>`;
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

  /* ---------- moving house (11 Nov 2026): tap an empty 🪧 lot → "ย้ายบ้านมาที่นี่" shows what moves (preview), a second tap moves it.
     The whole lot record moves (stage, colours, extras, garden size, pet); the old lot becomes free. First move free, then MOVE_FEE,
     at most once every 7 days (prog.vil.mvN / mvT). Two writes: claim the new lot (only if still empty), then free the old one;
     if the second write fails, healMove() frees the older lot on the next lots update (the newer one has the bigger mv). ---------- */
  const MOVE_FEE = 5000, MOVE_GAP = 7 * 864e5;
  let moveArm = 0, moving = false, lotRaw = {}, healing = '';
  function moveInfo() { const v = Prog.get().vil || {}, n = v.mvN | 0; return { n, fee: n ? MOVE_FEE : 0, wait: n ? Math.max(0, (+v.mvT || 0) + MOVE_GAP - Date.now()) : 0 }; }
  function moveBox(mL, L) {
    const m = moveInfo(), coins = Prog.get().coins | 0, arm = moveArm === L.id, poor = coins < m.fee;
    if (building(mL)) return `<p class="muted">🚚 ย้ายบ้านมาที่นี่ได้เมื่อสร้างขั้นนี้เสร็จ</p>`;
    if (m.wait) return `<p class="muted">🚚 ย้ายบ้านได้สัปดาห์ละครั้ง · อีก ${Math.ceil(m.wait / 864e5)} วัน</p>`;
    return (arm ? `<p>🚚 ย้ายบ้านจากแปลง ${mL.id} มาแปลง ${L.id}<br><small class="muted">ย้ายไปด้วย: ${STAGE_TH[mL.stage]} · สีและของแต่ง · สวน ${gSize(mL)} แปลงกับผักที่ปลูกอยู่${mL.pet ? ' · น้องแมว' : ''}<br>แปลง ${mL.id} จะว่างให้คนอื่นจองได้</small></p>` : '')
      + `<button class="btn${arm ? ' primary' : ''}" type="button" data-a="move"${poor || busy ? ' disabled' : ''}>🚚 ${arm ? 'ยืนยันย้ายบ้าน' : 'ย้ายบ้านมาที่นี่'} · ${m.fee ? `🪙 ${fmtN(m.fee)}` : 'ครั้งแรกฟรี'}</button>`
      + (poor ? `<p class="vil-need">ขาดอีก 🪙 ${fmtN(m.fee - coins)}</p>` : `<p class="muted">ย้ายได้สัปดาห์ละครั้ง${m.n ? '' : ' · ครั้งต่อไป 🪙 ' + fmtN(MOVE_FEE)}</p>`);
  }
  async function moveHouse(L) {
    const mk = myKey(), old = myLot(), m = moveInfo(), rec = old && lotRaw[old.id];
    if (!old || !rec || rec.k !== mk || L.stage || building(old) || m.wait || (Prog.get().coins | 0) < m.fee || !O || busy) { moveArm = 0; return renderCard(); }
    if (moveArm !== L.id) { moveArm = L.id; return renderCard(); }             // first tap: the preview
    moveArm = 0; moving = true;
    try {
      const ok = await tx(L, cur => cur && cur.k ? undefined : { ...rec, end: 0, hp: null, mv: srvNow() });
      if (!ok) { toast('😅 แปลงนี้มีคนจองไปแล้ว ลองแปลงอื่นนะ'); return renderCard(); }
      const p = Prog.get(); p.coins -= m.fee; p.vil = p.vil || {}; p.vil.lot = L.id; p.vil.mvN = m.n + 1; p.vil.mvT = Date.now(); Prog.put(p);
      if (m.fee && typeof Stats !== 'undefined') Stats.econ('out_hmove', m.fee);
      try { await O.txLot(old.id, cur => cur && cur.k === mk ? null : undefined); } catch (e) { /* healMove frees it later */ }
      toast(`🚚 ย้ายบ้านมาแปลง ${L.id} แล้ว!${m.fee ? ` −${fmtN(m.fee)} 🪙` : ' (ครั้งแรกฟรี)'}`); feed(`🚚 ${myName()} ย้ายบ้านไปแปลง ${L.id} ใน${L.lane}`);
    } finally { moving = false; }
    renderBar(); openCard(L);
  }
  // two lots with my name (a move whose second write failed): free the older one, never one with the same mv
  function healMove() {
    const mine = myLots(); if (mine.length < 2 || !O || moving) return; const keep = myLot(), mk = myKey(), sig = mine.map(L => L.id).join();
    if (healing === sig) return; healing = sig;
    for (const L of mine) if (L !== keep && L.mv < keep.mv) O.txLot(L.id, cur => cur && cur.k === mk && (+cur.mv || 0) < keep.mv ? null : undefined).catch(() => {});
  }

  /* ---------- lot card ---------- */
  const leftTxt = ms => { const m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return h ? `${h} ชม. ${m % 60} นาที` : `${m} นาที`; };
  function openCard(L) { if (W) W.closeCard(); if (cardL !== L) moveArm = 0; cardL = L; renderCard(); }
  function closeCard() { cardL = null; if (cardEl) cardEl.hidden = true; }
  function renderCard() {
    if (!cardEl) return; if (!cardL) { cardEl.hidden = true; return; }
    if (cardL === PETC) { const f = document.activeElement; if (f && f.id === 'vilPetName' && cardEl.contains(f)) return; return petCard(); }   // never wipe a name being typed
    const X = `<button class="x" type="button" data-a="close" aria-label="ปิด">✕</button>`;
    if (cardL === BOARDC) { cardEl.innerHTML = X + boardCard(); cardEl.hidden = false; return; }
    if (cardL.npc != null) { cardEl.innerHTML = X + npcCard(cardL.npc); cardEl.hidden = false; return; }
    const L = cardL, mk = myKey(), mine = L.stage && L.k === mk, mL = myLot(), dis = busy ? ' disabled' : '';
    let h = X;
    if (!L.stage) {
      const lk = lock(), s = STAGES[0], miss = missing(s);
      h += `<h4>🪧 แปลง ${L.id} · ${L.lane}</h4><p class="muted">ที่ดินว่าง · จองแล้วฟาร์มย้ายมาข้างที่ดินทันที · บ้านหลังแรกย้ายเข้าได้เลย · ครบ 5 ขั้น 🪙 50,000 + 🧱 60 + 🥬 30</p>`;
      if (mL) h += `<p>คุณมีบ้านที่แปลง ${mL.id} แล้ว (1 คน 1 หลัง)</p>` + moveBox(mL, L);
      else if (!lk.ok) h += `<p>🔒 จองได้เมื่อมีห้อง ${UNLOCK_W} + Lv ${UNLOCK_LV}<br>ตอนนี้ ห้อง ${lk.w}/${UNLOCK_W} ${lk.w >= UNLOCK_W ? '✓' : ''} · Lv ${lk.lv}/${UNLOCK_LV} ${lk.lv >= UNLOCK_LV ? '✓' : ''}</p>`;
      else h += `<button class="btn primary" type="button" data-a="reserve"${miss.length || busy ? ' disabled' : ''}>🪧 จองที่ดินนี้ · ${costTxt(s)}</button>${miss.length ? `<p class="vil-need">ขาดอีก ${miss.join(' · ')}</p>` : ''}`;
    } else {
      const hp = helpers(L), nh = Object.keys(hp).length;
      const door = W && W.hasRoom(L.id), dl = mine ? 'เข้าบ้าน' : 'แวะเยี่ยมบ้าน';   // the door sits next to ✕ so the card stays as short as before
      if (door) h += `<button class="x" type="button" data-a="enter" style="right:44px" title="${dl}" aria-label="${dl}">🚪</button>`;
      h += `<h4${door ? ' style="margin-right:82px"' : ''}>${mine ? '⭐ บ้านคุณ' : `🏠 บ้าน${escH(L.n)}`} · แปลง ${L.id}</h4><p class="muted">${L.lane}${movedIn(L) ? ' · ย้ายเข้าแล้ว 🎉' : ''}${door ? ` · 🚪 ${dl}ได้` : ''}</p>`;
      h += STAGES.map((s, i) => { const k = i + 1, cur = k === L.stage, done = k < L.stage || (cur && !building(L));
        return `<div class="vil-stg${done ? ' done' : cur ? ' cur' : ''}"><span>${s[0]}</span><span>${s[1]}${cur && building(L) ? `<div class="vil-pb"><i style="width:${Math.round(pctOf(L) * 100)}%"></i></div><small>เหลือ ${leftTxt(L.end - srvNow())} · เพื่อนช่วยวันนี้ ${nh}/${HELP_CAP}</small>`
          : mine && !done ? `<br><small>${costTxt(s)}</small>` : ''}</span><span>${done ? '✔' : cur ? '⏳' : '🔒'}</span></div>`; }).join('');
      if (mine) {
        const s = STAGES[L.stage];
        if (building(L)) h += `<p class="muted">ไม่มีปุ่มเร่ง · ชวนเพื่อนมาแตะ "ช่วยสร้าง" ได้วันละ ${HELP_CAP} คน คนละ −${HELP_H} ชม.</p>`;
        else if (s) { const miss = missing(s); h += `<button class="btn primary" type="button" data-a="next"${miss.length || busy ? ' disabled' : ''}>${s[0]} เริ่ม${s[1]} · ${costTxt(s)}</button>${miss.length ? `<p class="vil-need">ขาดอีก ${miss.join(' · ')}${s[3] && have().bricks < s[3] ? '<br>🧱 เล่นมินิเกมไหนก็ได้ ได้อิฐเกมละ 1–3 ก้อน (วันละ 12) + เก็บบนถนนวันละ 3' : ''}${s[4] ? ' · ผักได้จากฟาร์ม' : ''}</p>` : ''}`; }
        h += `<p>🌱 ฟาร์มของคุณ ${Math.max(gSize(L), Farm.home ? Farm.home() : 0)} แปลง อยู่ข้างบ้านแล้ว</p><button class="btn${s && !building(L) ? '' : ' primary'}" type="button" data-a="garden">🌱 ไปที่สวน</button>`;
        if (movedIn(L)) h += decorBox(L);
        if (!building(L)) h += `<button class="btn" type="button" data-a="movehint"${busy ? ' disabled' : ''}>🚚 ย้ายบ้าน${moveInfo().n ? '' : ' · ครั้งแรกฟรี'}</button>`;
      } else if (movedIn(L) && !building(L)) {
        const fr = farms[L.k], gp = (fr && fr.plots || []).filter(x => x && x.c).length;
        const jl = jobsFor(L); if (jl.length) h += `<p class="muted">📦 รอของจากคุณ</p>${jl.map(J => jobRow(J, true)).join('')}`;
        h += `<p>🌱 สวนข้างบ้าน ${gSize(L)} แปลง${fr ? ` · ปลูกอยู่ ${gp}` : ''}</p><button class="btn${jl.length ? '' : ' primary'}" type="button" data-a="garden">🌱 ไปดูสวน · รดน้ำช่วย</button>`;
      } else if (building(L)) {
        const can = !hp[mk] && nh < HELP_CAP;
        h += `<button class="btn primary" type="button" data-a="help"${can && !busy ? '' : ' disabled'}>🔨 ช่วยสร้าง −${HELP_H} ชม. · +${HELP_PAY} 🪙</button>${hp[mk] ? '<p class="muted">วันนี้คุณช่วยบ้านนี้แล้ว ขอบคุณ 💛</p>' : nh >= HELP_CAP ? `<p class="muted">วันนี้มีคนช่วยครบ ${HELP_CAP} คนแล้ว</p>` : ''}`;
        h += `<button class="btn" type="button" data-a="garden">🌱 ดูสวน ${gSize(L)} แปลง · รดน้ำช่วย</button>`;
      } else h += `<button class="btn" type="button" data-a="garden">🌱 ดูสวน ${gSize(L)} แปลง · รดน้ำช่วย</button>`;
    }
    cardEl.innerHTML = h; cardEl.hidden = false;
  }
  function cardAct(a, b) {
    if (a === 'close') return closeCard();
    if (a === 'adopt') return adopt(); if (a === 'feed') return feedPet(b && b.dataset.k); if (a === 'rename') return renamePet(); if (a === 'coat') return dyePet(b && b.dataset.k);
    if (a === 'deliver') return deliver(+(b && b.dataset.k));
    if (a === 'roof' || a === 'wall' || a === 'xtra') return decorate(cardL, { [a[0]]: b && b.dataset.k });
    if (a === 'goto') { const J = jobs().find(x => x.j === +(b && b.dataset.k)); if (!J) return;
      if (W && J.to.npc != null && W.NPCS[J.to.npc]) { const P = W.NPCS[J.to.npc].P; goTo(nearestWalk(Math.floor(P.px / T) + 1, Math.floor(P.py / T))); openCard(NPCC[J.to.npc]); return; }   // straight to the deliver button
      act(J.to.L || NPCC[J.to.npc]); return; }
    const L = cardL; if (!L) return;
    if (a === 'enter') { closeCard(); if (W) W.enterLot(L.id); return; }
    if (a === 'movehint') { closeCard(); return toast('🚚 แตะป้าย 🪧 ที่ดินว่างที่อยากย้ายไป แล้วกด "ย้ายบ้านมาที่นี่"'); }
    if (a === 'move') return moveHouse(L);
    if (a === 'reserve') reserve(L); else if (a === 'next') next(L); else if (a === 'help') help(L); else if (a === 'garden') openGarden(L);
  }

  /* ---------- drawing ---------- */
  const S = () => Z * dpr, sx = wx => (wx - cam.x) * S(), sy = wy => (wy - cam.y) * S();
  function resize() {
    if (!cv || !el) return; dpr = Math.min(2, window.devicePixelRatio || 1);
    // full-screen map: the page is locked in village view, so fill everything below the tabs and above the bar
    if (!el.hidden) wrapEl.style.height = Math.max(280, innerHeight - (wrapEl.getBoundingClientRect().top + scrollY) - barEl.offsetHeight - 22) + 'px';
    const r = wrapEl.getBoundingClientRect(); if (!r.width) return;
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
    const p = a.p, who = typeof MI_PEOPLE !== 'undefined' && MI_PEOPLE.includes(p.a) ? p.a : 'adam', an = a.path.length ? 'run' : 'idle_anim', k = W ? 1 : S() * .75;
    const px = sx((a.x + .5) * T), py = sy((a.y + 1) * T - 1);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(px, sy((a.y + 1) * T - 2), 6 * S(), 2.2 * S(), 0, 0, 7); ctx.fill();
    drawChar(ctx, who, an, a.dir, a.t + t, px, py, k);
    if (typeof drawAcc === 'function') for (const sl of ['f', 'h']) if (p[sl]) drawAcc(ctx, p[sl], who, an, a.dir, a.t + t, px, py, k);
    if (p.g !== 'village' && !a.path.length) a.dir = 'up';          // playing a machine in the arcade: face the screen
    tags.push([px, py - (W ? 33 : 25 * S()), p.g !== 'village' ? `🎮 ${p.n || '?'} กำลังเล่น` : `🟢 ${p.n || '?'}${p.lv ? ` Lv${p.lv}` : ''}`, p.g !== 'village' ? { fs: 10, bg: '#fff3c4', line: '#c99a1a', hit: { person: p } } : { fs: 10, bg: '#e8ffe0', line: '#3a9b3a', hit: { person: p } }]);
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
    if ((bsT -= dt) < 0) { bsT = 2; const bs = LOTS.map(L => building(L) ? 1 : 0).join(''); if (bs !== bsSig) { const first = !bsSig; bsSig = bs; if (!first) { rebuild(); paintWorld(); syncHome(); renderCard(); renderBar(); } } }
    keyStep(dt); step(me, dt); for (const a of Object.values(others)) step(a, dt);
    const tg = camTarget(); cam.x += (tg.x - cam.x) * Math.min(1, dt * 8); cam.y += (tg.y - cam.y) * Math.min(1, dt * 8);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#5a9b3a'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(world, cam.x, cam.y, cv.width / S(), cv.height / S(), 0, 0, cv.width, cv.height);
    hits = [];
    pill(sx((TOWER.x + 4) * T), sy(TOWER.y * T) - 4 * dpr, '🏢 ตึกออฟฟิศ', { bg: '#e8f0ff', hit: 'tower' });
    const open = jobs().filter(J => !jobsDone().includes(J.j)), jobK = new Set(open.map(J => J.to.L ? 'L' + J.to.L.id : 'N' + J.to.npc));
    pill(sx((BOARD[0] + .5) * T), sy(BOARD[1] * T) - 2 * dpr, open.length ? `📌 งานส่งของ ${open.length}` : '📌 บอร์ด', { fs: 11, bg: open.length ? '#fff3c4' : '#fff', hit: 'board' });
    const onK = onlineKeys(), mk = myKey();
    for (const L of LOTS) {
      const x = sx((L.x + 2.5) * T), y = sy(L.y * T) - 4 * dpr;
      if (!L.stage) pill(x, y, `🪧 แปลง ${L.id} · 🪙 ${LOT_PRICE.toLocaleString('en-US')}`, { bg: '#fff8d6', hit: L });
      else { const b = building(L), pc = b ? ` ${Math.round(pctOf(L) * 100)}%` : '';
        if (L.k && L.k === mk) pill(x, y, `⭐ บ้านคุณ · ${STAGE_TH[L.stage]}${pc}`, { bg: '#ffe0ea', line: '#d14d72', hit: L });
        else pill(x, y, `${onK.has(L.k) ? '🟢 ' : ''}${L.n || '?'} · ${movedIn(L) && !b ? 'บ้าน' : STAGE_TH[L.stage] + pc}${b && !helpers(L)[mk] && Object.keys(helpers(L)).length < HELP_CAP ? ' · 🔨' : ''}${jobK.has('L' + L.id) ? ' · 📦' : ''}`, { bg: movedIn(L) && !b ? '#fff' : b ? '#ffd84d' : '#f3f3f3', hit: L }); }
    }
    // real crops in every garden (the farm is on the lot from จองที่ดิน)
    loadFarms(); ctx.imageSmoothingEnabled = false;
    if (typeof Farm !== 'undefined' && Farm.plotImg) { const now = Date.now(), ts = T * S();
      for (const L of LOTS) { if (!L.stage || !L.k) continue; const pls = gardenPlots(L), n = gSize(L);
        for (let i = 0; i < n; i++) { const im = Farm.plotImg(pls[i], now); if (!im) continue; const [cx, cy] = gCell(L, i), x0 = sx(cx * T), y0 = sy(cy * T);
          if (x0 < -ts || y0 < -ts || x0 > cv.width || y0 > cv.height) continue;
          const k = ts * .9 / Math.max(im.width, im.height); ctx.drawImage(im, Math.round(x0 + ts / 2 - im.width * k / 2), Math.round(y0 + ts * .95 - im.height * k), Math.round(im.width * k), Math.round(im.height * k)); } } }
    // bricks lying on the roads today
    const got = floorGot(), bob = Math.sin(t * 3);
    for (const f of floorSpots()) { if (got.includes(f.i)) continue;
      if (Math.abs(f.x - me.x) < .6 && Math.abs(f.y - me.y) < .6) { pickFloor(f); continue; }
      ctx.font = `${11 * S()}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(floorIcon(f), sx((f.x + .5) * T), sy((f.y + .5) * T) - bob * S()); }
    if (cardL && (cardTick += dt) > 1) { cardTick = 0; if (building(cardL)) renderCard(); }
    // pets: mine follows me (or naps at home); a coworker's follows them while fed; cats of people not here nap at their house
    const pt = myPet(), list = [...Object.values(others).map(a => ({ y: a.y, d: () => drawOther(a) })), { y: me.y, d: drawMe }], away = new Set();
    if (pt) { const fed = petFed(pt); follow(pm, me, fed, homeOf(myLot()), dt);
      if (fed !== pm.wasFed) { pm.wasFed = fed; renderBar(); send(true); if (cardL === PETC) renderCard(); }   // got hungry while you were here
      list.push({ y: pm.y - .01, d: () => drawCat(pm, pt.coat, fed && pt.prem, !fed && !pm.moving, [fed ? `${catIcon(pt.coat)} ${pt.n}` : `💤 ${pt.n} หิวแล้ว`, fed ? '#fff3c4' : '#eee', 'pet']) }); }
    for (const a of Object.values(others)) { const pe = a.p.pe; if (!Array.isArray(pe)) continue; const fed = !!pe[2];
      if (!fed) continue; away.add(a.p.k || key(a.p.n)); const c = a.cat || (a.cat = { x: 0, y: 0, face: 1, moving: false, init: false });
      follow(c, a, true, null, dt); list.push({ y: c.y - .01, d: () => drawCat(c, pe[0], !!pe[3], false, null) }); }
    for (const L of LOTS) { if (L.stage !== 5 || !L.pet || L.k === mk || away.has(L.k)) continue; const h = homeOf(L), c = L.cat || (L.cat = { x: h[0], y: h[1], face: -1, moving: false, init: true });
      list.push({ y: c.y - .01, d: () => drawCat(c, L.pet.c, false, true, null) }); }
    NPCS.forEach((N, i) => list.push({ y: N.at[1], d: () => { const px = sx((N.at[0] + .5) * T), py = sy((N.at[1] + 1) * T - 1), k = S() * .75;
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(px, py - 1, 6 * S(), 2.2 * S(), 0, 0, 7); ctx.fill();
      drawChar(ctx, N.who, 'idle_anim', 'down', t + i, px, py, k);
      tags.push([px, py - 25 * S(), `${jobK.has('N' + i) ? '📦 ' : ''}${N.n}`, { fs: 10, bg: jobK.has('N' + i) ? '#fff3c4' : '#f3f3f3', hit: NPCC[i] }]); } }));
    // people front to back; names are collected and drawn last so nobody walking in front hides a name
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    drawTags();
  }
  const visible = () => el && el.isConnected && !el.hidden && !document.getElementById('hub').hidden;

  /* ---------- input ---------- */
  function tap(e) {
    const b = cv.getBoundingClientRect(), px = (e.clientX - b.left) * dpr, py = (e.clientY - b.top) * dpr;
    const h = hits.slice().reverse().find(r => px >= r.l && px <= r.l + r.w && py >= r.t && py <= r.t + r.h);
    if (h) return act(h.hit);
    const wx = Math.floor((px / S() + cam.x) / T), wy = Math.floor((py / S() + cam.y) / T);
    const L = LOTS.find(L => wx >= L.x && wx <= L.x + (L.stage ? 10 : 3) && wy >= L.y && wy <= L.y + 3); if (L) return act(L);   // tapping a house or its garden
    goTo(nearestWalk(wx, wy));
  }
  function act(g) {
    if (g === 'tower') { goTo([TOWER.door[0], TOWER.door[1] + 1]); typeof Tower !== 'undefined' && Tower.setView('tower'); return; }
    if (g === 'pet') { openCard(PETC); return; }
    if (g && g.arc != null && W) { W.arcade.walk(g.arc || ''); return; }
    if (g && g.arank) { if (typeof showRanking === 'function') showRanking(); return; }
    if (g === 'board') { goTo(nearestWalk(BOARD[0], BOARD[1] + 1)); openCard(BOARDC); return; }
    if (g && g.npc != null && W) { W.talk(g.npc); return; }
    if (g && g.npc != null) { const [nx, ny] = NPCS[g.npc].at; goTo(nearestWalk(nx + 1, ny)); openCard(NPCC[g.npc]); return; }
    if (g && g.person) { const p = g.person, a = others[p.id]; if (a) goTo(nearestWalk(Math.round(a.x) + 1, Math.round(a.y))); toast(`👋 ${p.n || '?'}${p.lv ? ` · Lv ${p.lv}` : ''} อยู่ในหมู่บ้าน`); return; }
    if (g && g.id) { goTo([g.front[0], g.front[1] + 1]); openCard(g); }
  }

  /* ---------- DOM ---------- */
  function setFull(on) {
    const hub = document.getElementById('hub'); if (!hub) return;
    on = on === undefined ? !hub.classList.contains('vil-full') : !!on; hub.classList.toggle('vil-full', on);
    try { localStorage.setItem('vilFull', on ? '1' : ''); } catch (e) { /* private window */ }
    renderBar(); resize(); requestAnimationFrame(resize);
  }
  // phones: a card is a bottom sheet; drag it down from its top to close
  function sheetSwipe(c, close) {
    let y0 = null, dy = 0;
    c.addEventListener('touchstart', e => { y0 = c.scrollTop <= 0 && e.touches.length === 1 && innerWidth < 720 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    c.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) c.style.transform = `translateY(${dy}px)`; else { y0 = null; c.style.transform = ''; } }, { passive: true });
    c.addEventListener('touchend', () => { if (y0 != null && dy > 90) close(); c.style.transform = ''; y0 = null; });
  }
  function build() {
    el = document.createElement('section'); el.className = 'village'; el.id = 'village'; el.hidden = true;
    el.innerHTML = `<div class="vil-wrap"><canvas aria-label="แผนที่หมู่บ้าน"></canvas><div class="vil-card" role="dialog" aria-label="ที่ดินและบ้าน" hidden></div></div><div class="vil-bar"></div>`;
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d'); wrapEl = el.querySelector('.vil-wrap'); barEl = el.querySelector('.vil-bar'); cardEl = el.querySelector('.vil-card');
    cardEl.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) cardAct(b.dataset.a, b); });
    cardEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'vilPetName') renamePet(); });
    barEl.addEventListener('click', e => { if (e.target.closest('[data-a=home]')) { const L = myLot(); if (L) act(L); } if (e.target.closest('[data-a=pet]')) act('pet'); if (e.target.closest('[data-a=board]')) act('board'); if (e.target.closest('[data-a=full]')) setFull(); });
    sheetSwipe(cardEl, closeCard);
    try { if (localStorage.getItem('vilFull')) document.getElementById('hub')?.classList.add('vil-full'); } catch (e) { /* private window */ }
    el.addEventListener('keydown', e => { if (e.key === 'Escape') closeCard(); });
    cv.addEventListener('click', tap);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { held.length = 0; send(true); });
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', () => { held.length = 0; });
  }

  /* ---------- the cozy engine (village-world.js) ---------- */
  function relotW() { for (const L of LOTS) L.front = [L.x + 2, L.y + 3]; W.relots(); block = W.block; }
  const inScene = (x, y, sc) => W.sceneOf([Math.round(x), Math.round(y)]) === sc;
  function liveTick(dt) {
    if (!W) return; t += dt; const rt = performance.now(), every = (k, ms) => rt - (tickAt[k] || 0) >= ms && (tickAt[k] = rt);   // real-time timers: slow frames don't delay them
    if (every('bs', 1000)) { const bs = LOTS.map(L => building(L) ? 1 : 0).join(''); if (bs !== bsSig) { const first = !bsSig; bsSig = bs; if (!first) { relotW(); syncHome(); renderCard(); renderBar(); } } }
    for (const a of Object.values(others)) step(a, dt);
    if (every('send', 500)) send();
    if (every('hud', 1000)) W.hud();                 // the engine's coin line follows the arcade coins       // presence: the cell you walk to (keys: where you are), deduped
    loadFarms();
    if (!W.scene()) { const got = floorGot(); for (const f of floorSpots()) if (!got.includes(f.i) && Math.abs(f.x - me.x) < .6 && Math.abs(f.y - me.y) < .6) pickFloor(f); }
    if (cardL && every('card', 1000)) { const b = building(cardL); if (b || cardL._b) renderCard(); cardL._b = b; }   // once more when a build finishes
    const pt = myPet(); if (pt) { const fed = petFed(pt); follow(pm, me, fed, homeOf(myLot()), dt);
      if (fed !== pm.wasFed) { pm.wasFed = fed; renderBar(); send(true); if (cardL === PETC) renderCard(); } }
    for (const a of Object.values(others)) { const pe = a.p.pe; if (!Array.isArray(pe) || !pe[2]) continue; const c = a.cat || (a.cat = { x: 0, y: 0, face: 1, moving: false, init: false }); follow(c, a, true, null, dt); }
  }
  // drawn by the engine in world px, sorted with its own people and objects (S() = 1, no camera: the engine moved the canvas)
  function liveDraw(sc) {
    if (!W) return []; ctx = W.ctx; Z = 1; dpr = 1; cam = { x: 0, y: 0 }; tags = []; hits = [];
    const out = [], pt = myPet(), mk = myKey(), away = new Set();
    for (const a of Object.values(others)) if (inScene(a.x, a.y, sc)) out.push({ y: a.y * T + 12, d: () => drawOther(a) });
    if (pt && inScene(pm.x, pm.y, sc)) { const fed = petFed(pt);
      out.push({ y: pm.y * T + 11, d: () => drawCat(pm, pt.coat, fed && pt.prem, !fed && !pm.moving, [fed ? `${catIcon(pt.coat)} ${pt.n}` : `💤 ${pt.n} หิวแล้ว`, fed ? '#fff3c4' : '#eee', 'pet']) }); }
    for (const a of Object.values(others)) { const pe = a.p.pe; if (!Array.isArray(pe) || !pe[2] || !a.cat) continue; away.add(a.p.k || key(a.p.n));
      if (inScene(a.cat.x, a.cat.y, sc)) out.push({ y: a.cat.y * T + 11, d: () => drawCat(a.cat, pe[0], !!pe[3], false, null) }); }
    if (!sc) for (const L of LOTS) { if (L.stage !== 5 || !L.pet || L.k === mk || away.has(L.k)) continue; const h = homeOf(L), c = L.cat || (L.cat = { x: h[0], y: h[1], face: -1, moving: false, init: true });
      out.push({ y: c.y * T + 11, d: () => drawCat(c, L.pet.c, false, true, null) }); }
    return out;
  }
  // after the engine drew the world: name tags, lot / tower / board pills and the road pickups on the overlay canvas (screen px × dpr)
  function liveOverlay(ox, oy, sc, scn) {
    if (!W) return; const wt = tags, wh = hits; dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(wrapEl.clientWidth * dpr), h = Math.round(wrapEl.clientHeight * dpr); if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }
    ctx = ovx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
    Z = sc; cam = { x: ox, y: oy };                 // now sx / sy / S() map world px to overlay px
    hits = wh.map(r => ({ l: sx(r.l), t: sy(r.t), w: r.w * S(), h: r.h * S(), hit: r.hit })); tags = wt.map(([x, y, s, o]) => [sx(x), sy(y), s, o]);
    if (!scn) {
      pill(sx((TOWER.x + 4) * T), sy(TOWER.y * T) - 4 * dpr, '🏢 ตึกออฟฟิศ', { bg: '#e8f0ff', hit: 'tower' });
      const open = jobs().filter(J => !jobsDone().includes(J.j)), jobK = new Set(open.map(J => J.to.L ? 'L' + J.to.L.id : 'N' + J.to.npc));
      pill(sx((BOARD[0] + .5) * T), sy(BOARD[1] * T) - 14 * dpr, open.length ? `📌 งานส่งของ ${open.length}` : '📌 บอร์ด', { fs: 11, bg: open.length ? '#fff3c4' : '#fff', hit: 'board' });
      const onK = onlineKeys(), mk = myKey();
      for (const L of LOTS) { const x = sx((L.x + 2.5) * T), y = sy(W.lotTop(L.id)) - 2 * dpr;
        if (x < -200 || x > w + 200 || y < -40 || y > h + 60) continue;
        if (!L.stage) pill(x, y, `🪧 แปลง ${L.id} · 🪙 ${LOT_PRICE.toLocaleString('en-US')}`, { bg: '#fff8d6', hit: L });
        else { const b = building(L), pc = b ? ` ${Math.round(pctOf(L) * 100)}%` : '';
          if (L.k && L.k === mk) pill(x, y, `⭐ บ้านคุณ · ${STAGE_TH[L.stage]}${pc}`, { bg: '#ffe0ea', line: '#d14d72', hit: L });
          else pill(x, y, `${onK.has(L.k) ? '🟢 ' : ''}${L.n || '?'} · ${movedIn(L) && !b ? 'บ้าน' : STAGE_TH[L.stage] + pc}${b && !helpers(L)[mk] && Object.keys(helpers(L)).length < HELP_CAP ? ' · 🔨' : ''}${jobK.has('L' + L.id) ? ' · 📦' : ''}`, { bg: movedIn(L) && !b ? '#fff' : b ? '#ffd84d' : '#f3f3f3', hit: L }); } }
      const got = floorGot(), bob = Math.sin(t * 3);
      ctx.font = `${11 * S()}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const f of floorSpots()) if (!got.includes(f.i)) ctx.fillText(floorIcon(f), sx((f.x + .5) * T), sy((f.y + .5) * T) - bob * S());    }
    if (scn && scn.mach) {                         // the hall is the leaderboard: today's #1 on every machine, ⭐ = today's ×2 game
      const G = arcGames(), ft = typeof featuredId === 'function' ? featuredId() : '';
      for (const M of scn.mach) { const g = G.find(x => x.id === M.id); if (!g) continue; const top = arcRank(M.id);
        const nm = top ? String(top.n || '?') : '', sc = top ? Number(top.s) : 0;
        pill(sx((M.x + .5) * T), sy(M.y * T - 12), `${g.emoji}${M.id === ft ? ' ×2' : ''}${top ? ` 👑${nm.length > 6 ? nm.slice(0, 6) + '…' : nm} ${sc >= 1e4 ? Math.round(sc / 1e3) + 'k' : sc.toLocaleString('en-US')}` : ''}`,
          { fs: 9, bg: M.id === ft ? '#fff3c4' : '#fff', line: M.id === ft ? '#c99a1a' : '#3a2a20', hit: { arc: M.id } }); }
      pill(sx((scn.board[0] + .5) * T), sy(scn.board[1] * T - 12), '🏆 อันดับ', { fs: 10, bg: '#ffe0ea', hit: { arank: 1 } });
    }
    drawTags();
  }
  const HOOKS = {
    lots: () => LOTS.map(L => { const o = { id: L.id, x: L.x, y: L.y, stage: L.stage, owner: L.n || '', rc: roofOf(L), wc: wallOf(L), xs: String(L.xs || ''), building: L.stage ? building(L) : false,
      gN: L.stage && L.k ? gSize(L) : 0, mine: !!(L.stage && L.k && L.k === myKey()), live: L, crop: 'bok' };
      Object.defineProperty(o, 'pct', { get: () => L.stage ? pctOf(L) : 1 }); return o; }),
    gCell: (L, i) => gCell(L, i),
    drawCrop(g, L, i, x, y) { if (!L.k || typeof Farm === 'undefined' || !Farm.plotImg) return; const im = Farm.plotImg(gardenPlots(L)[i], Date.now()); if (!im) return;
      const k = Math.min(1, T * .9 / Math.max(im.width, im.height)); g.drawImage(im, Math.round(x + T / 2 - im.width * k / 2), Math.round(y + T * .95 - im.height * k), Math.round(im.width * k), Math.round(im.height * k)); },
    name: () => (typeof myName === 'function' && myName()) || 'คุณ',
    coins: () => Prog.get().coins | 0,
    setCoins(v) { const p = Prog.get(); p.coins = Math.max(0, Math.round(v)); Prog.put(p); renderBar(); },
    rides: () => ({ ...((Prog.get().vil || {}).rides || {}) }),
    rideBought(k) { const p = Prog.get(); p.vil = p.vil || {}; p.vil.rides = { ...(p.vil.rides || {}), [k]: 1 }; Prog.put(p); if (typeof Stats !== 'undefined') Stats.econ('out_ride', 1); },
    day: () => bkkDay(), week: () => Math.floor((Date.now() + 7 * 3600e3) / (7 * 864e5)),
    drawMe(g, P, rd, lift) { const who = typeof meWho === 'function' ? meWho() : 'adam', an = P.moving && !rd ? 'run' : 'idle_anim', cx = Math.round(P.px), by = Math.round(P.py) + 3 - lift;
      g.save(); if (rd) { g.beginPath(); g.rect(cx - 10, by - 34, 20, 28); g.clip(); }
      drawChar(g, who, an, P.dir, P.t, cx, by, 1);
      if (typeof drawAcc === 'function' && typeof Wardrobe !== 'undefined') for (const sl of ['f', 'h']) drawAcc(g, Wardrobe.eq(sl), who, an, P.dir, P.t, cx, by, 1);
      g.restore(); },
    tick: liveTick, draw: liveDraw, overlay: liveOverlay,
    games: () => arcGames().map(g => ({ id: g.id, emoji: g.emoji, title: g.title, color: g.color })),
    featured: () => typeof featuredId === 'function' ? featuredId() : '',
    play: id => arcPlay(id), arcadeRank: () => act({ arank: 1 }),
    tap(x, y) { const px = x * dpr, py = y * dpr, h = hits.slice().reverse().find(r => px >= r.l && px <= r.l + r.w && py >= r.t && py <= r.t + r.h); if (!h) return false; act(h.hit); return true; },
    visible: () => visible(), typing: e => typing(e),
    lot: L => act(L), tower: () => act('tower'), board: () => act('board'),
    jobsFor: i => jobsFor({ npc: i }).length, jobs: i => openCard(NPCC[i]),
    home() { const L = myLot(); if (L) act(L); else toast('ยังไม่มีบ้าน · แตะป้าย 🪧 ที่ดินว่างเพื่อจอง'); },
    cardOpened() { if (cardL) closeCard(); },
    // community farm online (online.js rooms/_vil/cfarm + corder); the engine's bag / chest / hearts live in prog.vil.cozy
    farmKey: () => myKey(), farmOff: () => offset,
    farmLive(plots, order) { farmCbs = [plots, order]; hookFarm(); },
    farmTx: (id, fn) => O && O.txCPlot ? O.txCPlot(id, fn) : Promise.resolve({ committed: false }),
    orderTx: fn => O && O.txCOrder ? O.txCOrder(fn) : Promise.resolve({ committed: false }),
    cozy: () => (Prog.get().vil || {}).cozy || '',
    setCozy(v) { const p = Prog.get(); p.vil = p.vil || {}; p.vil.cozy = v; Prog.put(p); },
  };
  let farmCbs = null, farmOn = false;
  function hookFarm() { if (!O || !farmCbs || farmOn || !O.watchCFarm) return; farmOn = true; O.watchCFarm(farmCbs[0]); O.watchCOrder(farmCbs[1]); }
  const MOVED = { 5: [49, 20], 8: [49, 27] }, OLDXY = {};
  async function startWorld() {
    if (typeof VillageWorld === 'undefined') throw new Error('village-world.js missing');
    for (const L of LOTS) if (MOVED[L.id]) { OLDXY[L.id] = [L.x, L.y]; [L.x, L.y] = MOVED[L.id]; }
    worldEl = document.createElement('div'); worldEl.className = 'vil-world'; wrapEl.insertBefore(worldEl, cardEl);
    const w = await VillageWorld.start(worldEl, HOOKS), P = w.me;
    Object.defineProperties(me, {                    // the live code keeps reading me.x / me.y in cells; the engine owns the walker
      x: { get: () => (P.px - 8) / T, set: v => { P.px = v * T + 8; P.path = []; }, configurable: true },
      y: { get: () => (P.py - 12) / T, set: v => { P.py = v * T + 12; P.path = []; }, configurable: true },
      path: { get: () => P.path, set: v => { P.path = v; }, configurable: true },
      dir: { get: () => P.dir, set: v => { P.dir = v; }, configurable: true },
      sp: { get: () => P.speed / T, set() {}, configurable: true },
      t: { get: () => P.t, set() {}, configurable: true } });
    W = w; C = W.C; R = W.R; ov = W.ov; ovx = ov.getContext('2d'); cv.style.display = 'none';
    relotW(); pm.init = false; floorDay = '';
    for (const id of Object.keys(others)) delete others[id]; syncOthers(); send(true);
  }
  function startOld() {
    W = null; if (worldEl) { worldEl.remove(); worldEl = null; } cv.style.display = ''; C = 48; R = 34;
    for (const L of LOTS) if (OLDXY[L.id]) [L.x, L.y] = OLDXY[L.id];
    rebuild(); const go = () => { if (++loaded < 2) return; paintWorld(); resize(); cam = camTarget(); };
    town.onload = farm.onload = go; town.src = 'assets/village/tinytown.png'; farm.src = 'assets/village/tinyfarm.png';
    requestAnimationFrame(frame);
  }
  function start() {
    if (started) return; started = true; PETS.src = 'assets/pixel/elthen_cat.png';
    startWorld().catch(e => { console.warn('village engine fallback', e); startOld(); });
    loadOnline().then(M => { O = M; send(true); M.watchOffset(v => offset = v || 0); M.watchOnline(l => { people = l; syncOthers(); }); if (M.watchLots) M.watchLots(applyLots); hookFarm(); }).catch(() => {});
  }
  return {
    on,
    mount(slot) { if (!slot) return; if (!on()) { slot.remove(); return; } if (!el) build(); slot.replaceWith(el); renderBar(); },
    show() { if (!el) return; start(); renderBar(); requestAnimationFrame(() => { resize(); if (world) cam = camTarget(); send(true); }); },
    setGarden, needs,
    // walk into 🕹️ ตึกเกม (to a machine when id is given); waits for the engine to load the first time
    arcade(id, n = 0) { if (W && W.arcade) return void W.arcade.walk(id || ''); if (n < 60) setTimeout(() => Village.arcade(id, n + 1), 150); },
    _dbg: { me, LOTS, others, pm, adopt, feedPet, dyePet, renamePet, myPet, moveHouse, moveInfo, get farms() { return farms; }, syncHome, gCell, get hits() { return hits; }, get ready() { return !!(world || W); }, get W() { return W; }, act, lock, goTo, fast: false, floorSpots, reserve, jobs, jobsDone, deliver, haveCrop, NPCS, BOARDC, next, help, myLot, get busy() { return busy; }, decorate, movedIn, get held() { return W ? W.held : held; }, gSize, tinted, roofOf, wallOf },
  };
})();
