// "ออฟฟิศของฉัน" — progression for the whole arcade: every game pays coins + XP, levels unlock titles and shop items,
// coins buy LimeZu furniture to decorate your own room, and coworkers can visit and like it.
// Classic script loaded after solo-games.js (uses its kit) and before the hub script (whose globals it calls at run time:
// store, toast, myName, myAva, loadOnline, fmt, rnd, pick).
'use strict';

/* ---------- economy ---------- */
// score that pays one coin, per game (a decent run ≈ 20–30 coins)
const PROG_NORM = { spot: 60, run: 20, whack: 16, stack: .8, tetris: 80, stamp: 24, barista: 24, toss: 24, slack: 16, conga: 12 };
// a new title every 2–3 levels; each title level also unlocks an accessory (ACC in wardrobe.js)
const TITLES = [[1, 'เด็กฝึกงาน'], [2, 'พนักงานทดลองงาน'], [4, 'พนักงานใหม่'], [6, 'พนักงานขยัน'], [8, 'มือโปรประจำแผนก'], [10, 'พนักงานดีเด่น'], [12, 'รุ่นพี่ใจดี'],
  [14, 'หัวหน้าทีม'], [17, 'ผู้ช่วยผู้จัดการ'], [20, 'ผู้จัดการ'], [23, 'ผู้อำนวยการฝ่าย'], [26, 'ผู้อำนวยการ'], [30, 'ตำนานออฟฟิศ'], [35, 'เทพเจ้าแห่ง HR'], [40, 'ตำนานห้องพักสมอง']];
// a decent run ≈ 85 XP: Lv 2 after ~2 games, Lv 10 after ~40, Lv 20 after ~110
const needXP = lv => 120 + (lv - 1) * 40;
const STARTER = { wall: 'wall_mint', floor: 'floor_wood', items: [['window_big', 5, 0, 0], ['pc_desk', 2, 4, 0], ['chair_red', 3, 5, 0], ['plant_pot', 10, 3, 0]] };
const Prog = {
  get() {
    const p = store.get('prog', null);
    return p || { xp: 0, lv: 1, coins: 60, inv: {}, styles: ['wall_mint', 'floor_wood'], room: JSON.parse(JSON.stringify(STARTER)), who: 'adam', likesClaimed: 0 };
  },
  put(p) { store.set('prog', p); Prog.sync(); },
  title: lv => TITLES.reduce((t, [l, n]) => lv >= l ? n : t, TITLES[0][1]),
  // add coins and XP; returns what happened so the caller can show it
  give(coins, xp) {
    const p = Prog.get(), before = { lv: p.lv, xp: p.xp }, ups = [];
    p.coins += coins; p.xp += xp;
    while (p.xp >= needXP(p.lv)) { p.xp -= needXP(p.lv); p.lv++; p.coins += 30; ups.push(p.lv); }
    if (ups.length) p.lvT = Date.now();          // the shared room celebrates this when you walk back in
    Prog.put(p);
    if (coins > 0) Prog.office(coins);
    if (ups.length) {
      const lv = ups[ups.length - 1], nm = myName();
      toast(`🎉 เลื่อนขั้น! Lv ${lv} · ${Prog.title(lv)} (+${30 * ups.length} 🪙)`);
      if (typeof presence === 'function') presence();
      if (nm) loadOnline().then(O => O.pushFeed(`🎉 ${nm} เลื่อนขั้นเป็น Lv ${lv} · ${Prog.title(lv)}`, nm, myAva())).catch(() => {});
    }
    return { coins, xp, ups, before, after: { lv: p.lv, xp: p.xp } };
  },
  award(game, score, mult = 1) { const c = Math.max(2, Math.min(60, Math.round(score / (PROG_NORM[game] || 20)))); return Prog.give(c * mult, c * 3 + 10); },
  // every coin earned also counts for the whole office (shared office level → the hub room gets new furniture)
  office(n) {
    const nm = myName(), lvOf = typeof HubRoom !== 'undefined' ? HubRoom.officeLv : null;
    loadOnline().then(O => O.addOffice(n, nm)).then(r => { if (!r || !lvOf) return; const a = lvOf(r.before), b = lvOf(r.after);
      if (b.lv > a.lv) loadOnline().then(O => O.pushFeed(`🏢 ออฟฟิศเลเวลอัปเป็น Lv ${b.lv}! ห้องรวมได้ ${b.cur.n} (${nm || 'ใครสักคน'} เติมแต้มสุดท้าย)`, nm, myAva())); }).catch(() => {});
  },
  // push the public part of the profile (debounced) so coworkers see your level and room
  sync() {
    clearTimeout(Prog._t);
    Prog._t = setTimeout(() => { const nm = myName(); if (!nm) return; const p = Prog.get();
      loadOnline().then(O => O.saveProfile(nm, { lv: p.lv, ti: Prog.title(p.lv), who: p.who, room: p.room, b: (p.gacha && p.gacha.eq) || '' })).catch(() => {}); }, 1500);
  },
};

/* ---------- shop catalogue: [sprite, kind (f floor · r rug · w wall), price, level] ---------- */
const SHOP = [
  ['plant_small', 'f', 20, 1], ['plant_pot', 'f', 35, 1], ['tree', 'f', 60, 2], ['palm', 'f', 90, 3],
  ['chair_red', 'f', 25, 1], ['chair_white', 'f', 25, 1], ['chair_dark', 'f', 25, 1], ['chair_beige', 'f', 25, 1], ['chair_grey', 'f', 25, 1], ['chair_school', 'f', 20, 1], ['chair_green', 'f', 30, 2], ['armchair_wood', 'f', 50, 2], ['armchair_dark', 'f', 50, 2],
  ['pc_desk', 'f', 80, 1], ['desk_drawer', 'f', 40, 1], ['desk_book', 'f', 60, 1], ['desk_pair', 'f', 70, 2], ['books_desk', 'f', 45, 2], ['dresser', 'f', 70, 3], ['table_wood', 'f', 90, 3], ['table_light', 'f', 90, 3],
  ['sofa_grey', 'f', 120, 1], ['sofa_white', 'f', 120, 2], ['bench_pink', 'f', 70, 2], ['bench_cream', 'f', 70, 2], ['sofa_brown', 'f', 140, 3], ['sofa_red', 'f', 160, 4],
  ['lamp_red', 'f', 30, 1], ['lamp_blue', 'f', 30, 1], ['lamp_beige', 'f', 30, 2], ['lamp_white', 'f', 30, 2], ['floorlamp_red', 'f', 50, 1], ['floorlamp_blue', 'f', 50, 1], ['floorlamp_white', 'f', 50, 2], ['floorlamp_beige', 'f', 50, 2],
  ['locker', 'f', 60, 1], ['shelf_white', 'f', 90, 2], ['cabinet_glass', 'f', 110, 2], ['cabinet_wood', 'f', 110, 2], ['bookshelf', 'f', 160, 3], ['fridge', 'f', 120, 3], ['shelf_plant', 'f', 90, 3],
  ['cabinet_plates', 'f', 120, 4], ['wardrobe', 'f', 140, 4], ['filing', 'f', 130, 4], ['wardrobe_glass', 'f', 150, 5], ['shop_shelf', 'f', 180, 5], ['vanity', 'f', 150, 5], ['fridge_wide', 'f', 220, 6],
  ['crate', 'f', 15, 1], ['box_wood', 'f', 15, 1], ['broom', 'f', 10, 1], ['cushion_blue', 'f', 15, 1], ['cushion_yellow', 'f', 15, 1], ['jar', 'f', 25, 1], ['fruit_basket', 'f', 30, 1], ['cake_straw', 'f', 20, 1], ['globe', 'f', 40, 1],
  ['jar_pot', 'f', 30, 2], ['fruit_bowl', 'f', 30, 2], ['fruit_grape', 'f', 35, 2], ['fruit_veg', 'f', 30, 2], ['globe_blue', 'f', 60, 2], ['cans', 'f', 40, 2], ['pizza', 'f', 25, 2], ['jar_white', 'f', 40, 3], ['jar_gold', 'f', 60, 4], ['globe_gold', 'f', 150, 7],
  ['rug_blue', 'r', 60, 1], ['rug_green', 'r', 60, 2], ['rug_lblue', 'r', 70, 3],
  ['window_small', 'w', 30, 1], ['window_frost', 'w', 50, 1], ['window_grey', 'w', 60, 1], ['window_red', 'w', 60, 2], ['window_big', 'w', 90, 2], ['window_slide', 'w', 120, 4],
  ['pic_bird', 'w', 25, 1], ['pic_flower', 'w', 25, 1], ['pic_hill', 'w', 25, 1], ['pic_fish', 'w', 30, 1], ['pic_fishblue', 'w', 30, 1], ['pic_aqua', 'w', 30, 1], ['pic_cat', 'w', 40, 1], ['noticeboard', 'w', 40, 1], ['board_calendar', 'w', 40, 1],
  ['pic_fire', 'w', 25, 2], ['pic_forest', 'w', 35, 2], ['pic_long', 'w', 30, 2], ['pic_sunset', 'w', 50, 2], ['pic_land', 'w', 50, 2], ['door', 'w', 80, 2],
  ['pic_monster', 'w', 45, 3], ['pic_robot', 'w', 45, 3], ['mirror_gold', 'w', 70, 3], ['blackboard', 'w', 90, 3], ['world_map', 'w', 100, 4], ['tv', 'w', 160, 4], ['door_double', 'w', 140, 5],
];
const STYLES = [['wall_mint', 0, 1], ['wall_yellow', 50, 1], ['wall_pink', 80, 2], ['wall_grey', 80, 2], ['wall_beige', 80, 3], ['wall_wood', 150, 4], ['wall_dwood', 150, 5], ['wall_red', 200, 6],
  ['floor_wood', 0, 1], ['floor_grey', 60, 1], ['floor_herring', 80, 2], ['floor_teal', 80, 2], ['floor_yellow', 80, 3], ['floor_carpet', 100, 3], ['floor_brick', 120, 4], ['floor_dwood', 120, 4], ['floor_rwood', 150, 5]];
const SHOP_KIND = Object.fromEntries(SHOP.map(s => [s[0], s[1]]));

/* ---------- the room: 12 x 9 cells, rows 0-1 are the wall ---------- */
const RC = 32, RCOLS = 12, RROWS = 9, RTOP = 2;
const cellsW = n => Math.max(1, Math.ceil((MI_SZ[n] || [16])[0] / 16));
function roomFits(room, n, x, y, skip) {
  const k = SHOP_KIND[n] || 'f', w = cellsW(n);
  if (x < 0 || x + w > RCOLS) return false;
  if (k === 'w' ? y >= RTOP : (y < RTOP || y >= RROWS)) return false;
  return !room.items.some((it, i) => { if (i === skip) return false; const k2 = SHOP_KIND[it[0]] || 'f';
    if ((k === 'w') !== (k2 === 'w') || (k === 'r') !== (k2 === 'r')) return false;   // rugs only collide with rugs, wall with wall
    if (k !== 'w' && it[2] !== y) return false;
    return x < it[1] + cellsW(it[0]) && it[1] < x + w; });
}
// draws a room (yours or a coworker's); extra = things to depth-sort in (avatar, ghost)
function drawRoom(ctx, room, extra = [], t = 0, pops = {}, tryFrom = Infinity) {
  officeBG(ctx, RCOLS * RC, RROWS * RC, RTOP * RC, { wall: room.wall, floor: room.floor, k: 2, calm: .1 });
  const list = [];
  room.items.forEach((it, i) => {
    const [n, x, y, f] = it, k = SHOP_KIND[n] || 'f', cx = (x + cellsW(n) / 2) * RC, pop = pops[i] || 0, o = { flip: !!f, sx: 1 + pop * .25, sy: 1 - pop * .2, alpha: i >= tryFrom ? .78 : null };
    if (k === 'w') drawPixAt(ctx, n, cx, RTOP * RC - 6, 2, o);
    else if (k === 'r') drawPixAt(ctx, n, cx, (y + 1) * RC, 2, o);
    else list.push({ y: y + 1, d: () => drawPixAt(ctx, n, cx, (y + 1) * RC, 2, o) });
  });
  list.push(...extra);
  list.sort((a, b) => a.y - b.y).forEach(o => o.d());
}
// a small wandering avatar for a room
function roomWalker(who) {
  const a = { who, x: 6, y: 7, tx: 6, ty: 7, wait: 1, dir: 'down' };
  a.step = (room, dt) => {
    if (a.wait > 0) { a.wait -= dt; if (a.wait <= 0) { for (let i = 0; i < 30; i++) { const x = Math.floor(rnd() * RCOLS), y = RTOP + 1 + Math.floor(rnd() * (RROWS - RTOP - 1));
      if (!room.items.some(it => (SHOP_KIND[it[0]] || 'f') === 'f' && it[2] === y && x >= it[1] && x < it[1] + cellsW(it[0]))) { a.tx = x; a.ty = y; break; } } } return; }
    const dx = a.tx - a.x, dy = a.ty - a.y, sp = 2.2 * dt;
    if (Math.abs(dx) > .02) { a.x += Math.sign(dx) * Math.min(sp, Math.abs(dx)); a.dir = dx > 0 ? 'right' : 'left'; }
    else if (Math.abs(dy) > .02) { a.y += Math.sign(dy) * Math.min(sp, Math.abs(dy)); a.dir = dy > 0 ? 'down' : 'up'; }
    else { a.wait = 1.5 + rnd() * 3; a.dir = 'down'; }
  };
  a.item = (t) => ({ y: a.y + 1 + .01, d: c => drawChar(a.ctx, a.who, a.wait > 0 ? 'idle_anim' : 'run', a.dir, t, (a.x + .5) * RC, (a.y + 1) * RC, 2) });
  return a;
}

/* ---------- the "ออฟฟิศของฉัน" screen ---------- */
function officeMount(root, api) {
  root.innerHTML = `<div class="hud office-hud"><span data-k="lv"></span><span class="xpbar" title="XP"><i data-k="xp"></i></span><span data-k="xpt" class="muted"></span><span>🪙 <b data-k="coins">0</b></span>
    <span data-k="who" class="office-who"></span></div>
    <div class="office"><div class="office-room"><div class="office-tools" data-k="tools"></div></div>
    <div class="box office-side"><div class="rk-tabs" data-k="tabs"></div><div class="office-list" data-k="list"></div></div></div>`;
  const roomBox = root.querySelector('.office-room'), { cv, ctx, at } = g2canvas(roomBox, RCOLS * RC, RROWS * RC);
  roomBox.insertBefore(cv.parentNode, roomBox.firstChild);
  const q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let p = Prog.get(), tab = window.officeTab || 'shop', placing = null, moving = -1, sel = -1, hover = null, visit = null, t = 0, pops = {};
  // try-before-you-buy: shop items are placed as see-through "cart" items, wall/floor styles are tried on; nothing is paid until ซื้อทั้งหมด
  let trial = [], tryStyle = {}, selT = -1, movingT = -1, placingTrial = false;
  const priceOf = n => (SHOP.find(s => s[0] === n) || [, , 0])[2], stylePrice = n => (STYLES.find(s => s[0] === n) || [, 0])[1];
  const cartCost = () => trial.reduce((a, it) => a + priceOf(it[0]), 0) + Object.values(tryStyle).reduce((a, n) => a + stylePrice(n), 0);
  const cartN = () => trial.length + Object.keys(tryStyle).length;
  const allItems = () => p.room.items.concat(trial);
  const skipIdx = () => moving >= 0 ? moving : movingT >= 0 ? p.room.items.length + movingT : undefined;
  const walker = roomWalker(p.who); walker.ctx = ctx;
  const view = () => visit ? visit.room : { ...p.room, wall: tryStyle.wall || p.room.wall, floor: tryStyle.floor || p.room.floor };
  function save() { Prog.put(p); }
  function hud() {
    p = Prog.get(); const lvTxt = `Lv ${p.lv} · ${Prog.title(p.lv)}`;
    q('lv').innerHTML = visit ? `👀 ห้องของ <b>${esc(visit.n)}</b> · Lv ${visit.lv} ${esc(visit.ti || '')}` : `<b>${lvTxt}</b>`;
    q('xp').style.width = (p.xp / needXP(p.lv) * 100) + '%'; q('xpt').textContent = `${p.xp}/${needXP(p.lv)} XP`; q('coins').textContent = fmt(p.coins);
    q('who').innerHTML = visit ? '' : MI_PEOPLE.map(w => `<button class="btn sm${w === p.who ? ' on' : ''}" data-who="${w}" title="ตัวละคร"><img class="pxi" src="assets/mi/${w}_down.png" height="24" alt="${w}"></button>`).join('');
    q('who').querySelectorAll('[data-who]').forEach(b => b.onclick = () => { p.who = b.dataset.who; walker.who = p.who; save(); hud(); });
  }
  function tools() {
    const el = q('tools');
    if (visit) { el.innerHTML = `<button class="btn primary" data-a="like">👍 ถูกใจห้องนี้ <span data-k="likes"></span></button><button class="btn" data-a="back">🏠 กลับห้องฉัน</button>`;
      el.querySelector('[data-a=back]').onclick = () => { visit = null; tab = 'friends'; hud(); tools(); list(); };
      el.querySelector('[data-a=like]').onclick = like; loadOnline().then(O => O.likeCount(visit.k)).then(n => { const s = q('likes'); if (s) s.textContent = `(${n})`; }).catch(() => {}); return; }
    if (placing) { el.innerHTML = `<span class="muted">${placingTrial && movingT < 0 ? `แตะช่องในห้องเพื่อ<b>ลองวาง</b> ${icon(placing, 22)} — ยังไม่เสียเงิน` : `แตะช่องในห้องเพื่อวาง ${icon(placing, 22)}`}</span><button class="btn sm" data-a="cancel">ยกเลิก</button>`;
      el.querySelector('[data-a=cancel]').onclick = () => { cancelPlace(); }; return; }
    if (selT >= 0) { const it = trial[selT]; el.innerHTML = `${icon(it[0], 22)} <span>ในตะกร้า · 🪙 ${priceOf(it[0])}</span><button class="btn sm" data-a="flip">↔ กลับด้าน</button><button class="btn sm" data-a="move">✥ ย้าย</button><button class="btn sm" data-a="rm">🗑️ เอาออก</button><button class="btn sm" data-a="x">✖</button>`;
      el.querySelector('[data-a=flip]').onclick = () => { it[3] = it[3] ? 0 : 1; };
      el.querySelector('[data-a=move]').onclick = () => { movingT = selT; placing = it[0]; placingTrial = true; selT = -1; tools(); };
      el.querySelector('[data-a=rm]').onclick = () => { trial.splice(selT, 1); selT = -1; tools(); list(); };
      el.querySelector('[data-a=x]').onclick = () => { selT = -1; tools(); }; return; }
    if (sel >= 0) { el.innerHTML = `<b>${p.room.items[sel][0]}</b><button class="btn sm" data-a="flip">↔ กลับด้าน</button><button class="btn sm" data-a="move">✥ ย้าย</button><button class="btn sm" data-a="store">📦 เก็บ</button><button class="btn sm" data-a="x">✖</button>`;
      el.querySelector('[data-a=flip]').onclick = () => { const it = p.room.items[sel]; it[3] = it[3] ? 0 : 1; pops[sel] = 1; save(); };
      el.querySelector('[data-a=move]').onclick = () => { moving = sel; placing = p.room.items[sel][0]; sel = -1; tools(); };
      el.querySelector('[data-a=store]').onclick = () => { const [n] = p.room.items.splice(sel, 1)[0]; p.inv[n] = (p.inv[n] || 0) + 1; sel = -1; save(); tools(); list(); };
      el.querySelector('[data-a=x]').onclick = () => { sel = -1; tools(); }; return; }
    if (cartN()) { const c = cartCost(), short = c - p.coins;
      el.innerHTML = `<span class="cart">🛒 ลองไว้ <b>${cartN()}</b> ชิ้น · รวม <b>🪙 ${fmt(c)}</b>${short > 0 ? ` <small class="bad">ขาดอีก ${fmt(short)}</small>` : ''}</span><button class="btn sm primary" data-a="buy">✅ ซื้อทั้งหมด</button><button class="btn sm" data-a="clear">🗑️ ล้างตะกร้า</button>`;
      el.querySelector('[data-a=buy]').onclick = buyCart;
      el.querySelector('[data-a=clear]').onclick = () => { trial = []; tryStyle = {}; selT = -1; tools(); list(); }; return; }
    el.innerHTML = '<span class="muted">กดของในร้านเพื่อ<b>ลองวาง</b>ในห้องก่อน ถูกใจแล้วค่อยกดซื้อ · แตะของในห้องเพื่อย้าย / กลับด้าน / เก็บ</span>';
  }
  function buyCart() {
    const c = cartCost(); if (c > p.coins) { toast(`เหรียญไม่พอ ขาดอีก 🪙 ${fmt(c - p.coins)} — เอาบางชิ้นออก หรือไปเล่นเกมก่อน`); domShake(q('tools'), 5); return; }
    p = Prog.get(); p.coins -= c; p.room.items.push(...trial.map(it => it.slice()));
    for (const [slot, n] of Object.entries(tryStyle)) { if (!p.styles.includes(n)) p.styles.push(n); p.room[slot] = n; }
    trial.forEach((it, i) => pops[p.room.items.length - trial.length + i] = 1);
    fx.burst(RCOLS * RC / 2, RROWS * RC / 2, { n: 30, colors: CONFETTI, speed: 280, grav: 400, size: 5, shape: 'paper', life: .9 }); api.sfx('good');
    toast(`🛍️ ซื้อแล้ว ${cartN()} ชิ้น (−${fmt(c)} 🪙)`); trial = []; tryStyle = {}; selT = -1; save(); hud(); tools(); list();
  }
  function cancelPlace() { if (placing && moving < 0 && !placingTrial) p.inv[placing] = (p.inv[placing] || 0) + 1; placing = null; moving = -1; movingT = -1; placingTrial = false; save(); tools(); list(); }
  function startPlace(n) { if (p.inv[n] > 0) { p.inv[n]--; if (!p.inv[n]) delete p.inv[n]; } placing = n; moving = -1; movingT = -1; placingTrial = false; sel = -1; selT = -1; save(); tools(); list(); }
  function startTry(n) { placing = n; placingTrial = true; moving = -1; movingT = -1; sel = -1; selT = -1; tools(); }
  const icon = (n, h = 34) => `<img class="pxi" src="assets/mi/${n}.png" alt="" style="max-height:${h}px;max-width:${h * 1.6}px">`;
  function list() {
    const tabs = [['shop', '🛒 ร้านค้า'], ['inv', '📦 ของของฉัน'], ['style', '🎨 ผนัง/พื้น'], ['friends', '👥 ห้องเพื่อน']];
    q('tabs').innerHTML = tabs.map(([k, v]) => `<button class="btn sm${k === tab ? ' on' : ''}" data-t="${k}">${v}</button>`).join('');
    q('tabs').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; list(); });
    const L = q('list');
    if (tab === 'shop') {
      L.innerHTML = `<div class="shop-grid">${SHOP.filter(s => typeof GACHA_ONLY === 'undefined' || !GACHA_ONLY.has(s[0])).map(([n, k, price, lv]) => { const lock = p.lv < lv, poor = p.coins < price;
        return `<button class="shop-it${lock ? ' lock' : ''}" data-buy="${n}" ${lock ? 'disabled' : ''}>${icon(n)}<small>${lock ? `🔒 Lv ${lv}` : `🪙 ${price}`}</small>${p.inv[n] ? `<i class="cnt">${p.inv[n]}</i>` : ''}${trial.some(it => it[0] === n) ? '<i class="incart">🛒</i>' : ''}</button>`; }).join('')}</div>`;
      L.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { startTry(b.dataset.buy); api.sfx('tick'); });
    } else if (tab === 'inv') {
      const own = Object.entries(p.inv).filter(([, c]) => c > 0);
      L.innerHTML = own.length ? `<div class="shop-grid">${own.map(([n, c]) => `<button class="shop-it" data-place="${n}">${icon(n)}<small>วาง</small><i class="cnt">${c}</i></button>`).join('')}</div>`
        : '<p class="muted">ยังไม่มีของในกระเป๋า — ซื้อจากร้านค้า หรือกด 📦 เก็บ ของที่อยู่ในห้อง</p>';
      L.querySelectorAll('[data-place]').forEach(b => b.onclick = () => startPlace(b.dataset.place));
    } else if (tab === 'style') {
      L.innerHTML = `<div class="shop-grid">${STYLES.map(([n, price, lv]) => { const own = p.styles.includes(n), lock = p.lv < lv, on = p.room.wall === n || p.room.floor === n;
        const tr = tryStyle.wall === n || tryStyle.floor === n;
        return `<button class="shop-it style${on || tr ? ' on' : ''}${lock && !own ? ' lock' : ''}" data-style="${n}" ${lock && !own ? 'disabled' : ''}><span class="sw" style="background-image:url(assets/mi/${n}.png)"></span><small>${tr ? `🛒 ลองอยู่ · 🪙 ${price}` : on ? '✓ ใช้อยู่' : own ? 'ใช้' : lock ? `🔒 Lv ${lv}` : `👀 🪙 ${price}`}</small></button>`; }).join('')}</div>`;
      L.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
        const [n, price] = STYLES.find(s => s[0] === b.dataset.style);
        const slot = n.startsWith('wall') ? 'wall' : 'floor';
        if (!p.styles.includes(n)) { if (tryStyle[slot] === n) delete tryStyle[slot]; else tryStyle[slot] = n; api.sfx('tick'); tools(); list(); return; }
        delete tryStyle[slot]; p.room[slot] = n; fx.burst(RCOLS * RC / 2, n.startsWith('wall') ? RC : RROWS * RC / 2, { n: 24, colors: CONFETTI, speed: 260, grav: 400, size: 5, shape: 'paper', life: .8 });
        save(); hud(); list();
      });
    } else {
      L.innerHTML = '<p class="muted">⏳ กำลังโหลดห้องของเพื่อน…</p>';
      loadOnline().then(O => O.listProfiles()).then(rows => {
        const me = myName().trim().toLowerCase();
        L.innerHTML = rows.length ? `<ul class="friend-list">${rows.map((r, i) => `<li><button class="btn" data-v="${i}"><img class="pxi" src="assets/mi/${MI_PEOPLE.includes(r.who) ? r.who : 'adam'}_down.png" height="28" alt="">
          <span><b>${esc(r.n)}</b>${r.n.trim().toLowerCase() === me ? ' (คุณ)' : ''}<small>Lv ${r.lv || 1} · ${esc(r.ti || '')}</small></span></button></li>`).join('')}</ul>`
          : '<p class="muted">ยังไม่มีใครแต่งห้อง — เป็นคนแรกเลย! (ต้องตั้งชื่อเล่นที่หน้าแรกก่อน ห้องถึงจะขึ้นให้เพื่อนเห็น)</p>';
        L.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const r = rows[+b.dataset.v]; visit = r; sel = -1; placing = null; hud(); tools(); });
      }).catch(() => { L.innerHTML = '<p class="muted">โหลดไม่ได้ (เน็ตหลุด?)</p>'; });
    }
  }
  function like() {
    const nm = myName(); if (!nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อนนะ'); return; }
    if (visit.n.trim().toLowerCase() === nm.trim().toLowerCase()) { toast('กดถูกใจห้องตัวเองไม่ได้ 😆'); return; }
    loadOnline().then(O => O.like(visit.k, nm).then(() => O.likeCount(visit.k))).then(n => { const s = q('likes'); if (s) s.textContent = `(${n})`; toast('👍 ส่งกำลังใจแล้ว!'); }).catch(() => {});
    for (let i = 0; i < 6; i++) fx.burst(RCOLS * RC / 2, RROWS * RC / 2, { n: 3, colors: [PAL.pink, '#fff'], speed: 220, grav: -60, size: 7, shape: 'star', life: 1 });
    api.sfx('good');
  }
  const cellAt = e => { const m = at(e); return { x: Math.floor(m.x / RC), y: Math.floor(m.y / RC) }; };
  cv.addEventListener('pointermove', e => { hover = cellAt(e); });
  cv.addEventListener('pointerleave', () => { hover = null; });
  cv.addEventListener('pointerdown', e => {
    if (visit) return; const c = cellAt(e); hover = c;
    if (placing) {
      const k = SHOP_KIND[placing] || 'f', w = cellsW(placing), x = Math.max(0, Math.min(RCOLS - w, c.x - Math.floor((w - 1) / 2))), y = k === 'w' ? 0 : c.y;
      if (!roomFits({ items: allItems() }, placing, x, y, skipIdx())) { fx.shake(3, .12); api.sfx('bad'); return; }
      if (movingT >= 0) { trial[movingT][1] = x; trial[movingT][2] = y; }
      else if (placingTrial) trial.push([placing, x, y, 0]);
      else if (moving >= 0) { p.room.items[moving][1] = x; p.room.items[moving][2] = y; pops[moving] = 1; }
      else { p.room.items.push([placing, x, y, 0]); pops[p.room.items.length - 1] = 1; }
      fx.burst((x + w / 2) * RC, (k === 'w' ? RTOP : y + 1) * RC, { n: 10, colors: ['#fff', '#e8dcc8'], speed: 120, grav: -40, size: 7, shape: 'puff', life: .45, spread: Math.PI, dir: -Math.PI / 2 });
      api.sfx('stamp'); placing = null; moving = -1; movingT = -1; placingTrial = false; save(); tools(); list(); return;
    }
    // pick the front-most item under the pointer
    sel = -1; selT = -1; const A = allItems(), nReal = p.room.items.length;
    for (let i = A.length - 1; i >= 0; i--) { const [n, x, y] = A[i], k = SHOP_KIND[n] || 'f', w = cellsW(n), h = Math.ceil((MI_SZ[n] || [16, 16])[1] / 16);
      const top = k === 'w' ? 0 : y - h + 1, bot = k === 'w' ? RTOP - 1 : y;
      if (c.x >= x && c.x < x + w && c.y >= top && c.y <= bot) { if (i >= nReal) selT = i - nReal; else { sel = i; pops[i] = 1; } break; } }
    tools();
  });
  api.onKey(e => { if (e.key === 'Escape' && placing) cancelPlace(); });
  function draw() {
    fx.pre(ctx);
    const room = view(), extra = [];
    if (!visit) extra.push(walker.item(t));
    if (placing && hover) {
      const k = SHOP_KIND[placing] || 'f', w = cellsW(placing), x = Math.max(0, Math.min(RCOLS - w, hover.x - Math.floor((w - 1) / 2))), y = k === 'w' ? 0 : hover.y, ok = roomFits({ items: allItems() }, placing, x, y, skipIdx());
      extra.push({ y: (k === 'w' ? 0 : y + 1) + .02, d: () => {
        ctx.fillStyle = ok ? 'rgba(33,192,122,.35)' : 'rgba(226,48,48,.35)'; ctx.fillRect(x * RC, (k === 'w' ? 0 : y) * RC, w * RC, (k === 'w' ? RTOP : 1) * RC);
        drawPixAt(ctx, placing, (x + w / 2) * RC, k === 'w' ? RTOP * RC - 6 : (y + 1) * RC, 2, { alpha: .75 }); } });
    }
    const real = visit ? room.items : p.room.items.filter((_, i) => i !== moving), tr = visit ? [] : trial.filter((_, i) => i !== movingT);
    drawRoom(ctx, { ...room, items: real.concat(tr) }, extra, t, pops, real.length);
    // cart items: dashed pink frame + price tag
    tr.forEach(([n, x, y]) => { const k = SHOP_KIND[n] || 'f', w = cellsW(n), h = k === 'w' ? RTOP : Math.max(1, Math.ceil((MI_SZ[n] || [16, 16])[1] / 16)), top = k === 'w' ? 0 : y - h + 1;
      ctx.strokeStyle = PAL.pink; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(x * RC + 2, top * RC + 2, w * RC - 4, h * RC - 4); ctx.setLineDash([]);
      txt(ctx, `🛒${priceOf(n)}`, (x + w / 2) * RC, top * RC + 10, 11, '#d6336c', 'center', 700); });
    if (selT >= 0 && trial[selT]) { const [n, x, y] = trial[selT], k = SHOP_KIND[n] || 'f', w = cellsW(n); ctx.strokeStyle = PAL.yel; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      ctx.strokeRect(x * RC + 2, (k === 'w' ? 0 : y) * RC + 2, w * RC - 4, (k === 'w' ? RTOP : 1) * RC - 4); ctx.setLineDash([]); }
    if (sel >= 0 && !visit) { const [n, x, y] = p.room.items[sel], k = SHOP_KIND[n] || 'f', w = cellsW(n); ctx.strokeStyle = PAL.yel; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      ctx.strokeRect(x * RC + 2, (k === 'w' ? 0 : y) * RC + 2, w * RC - 4, (k === 'w' ? RTOP : 1) * RC - 4); ctx.setLineDash([]); }
    if (visit) { rrect(ctx, 8, 8, 200, 26, 8, 'rgba(255,255,255,.9)', PAL.ink); txt(ctx, `🏠 ห้องของ ${visit.n}`, 108, 21, 13, PAL.ink, 'center', 700); }
    fx.post(ctx, RCOLS * RC, RROWS * RC);
  }
  api.loop(dt => { const d = fx.step(dt); t += dt; for (const i in pops) { pops[i] -= dt * 4; if (pops[i] <= 0) delete pops[i]; } if (!visit) walker.step(p.room, d); draw(); });
  // likes on my room turn into coins (5 each), claimed when I open the office
  const nm = myName();
  if (nm) loadOnline().then(O => O.likeCount(O.nameKey(nm))).then(n => { const pp = Prog.get(), fresh = n - (pp.likesClaimed || 0);
    if (fresh > 0) { pp.likesClaimed = n; store.set('prog', pp); Prog.give(5 * fresh, 0); toast(`👍 มีคนถูกใจห้องคุณ ${fresh} ครั้ง! +${5 * fresh} 🪙`); hud(); list(); } }).catch(() => {});
  Prog.sync(); hud(); tools(); list();
  return { destroy() { if (cartN()) toast('🛒 ของที่ลองไว้ยังไม่ได้ซื้อ — ตะกร้าถูกล้างแล้ว'); Prog.sync(); } };
}
