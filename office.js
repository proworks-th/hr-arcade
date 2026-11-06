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
  put(p) { store.set('prog', p); Prog.sync(); if (typeof Cloud !== 'undefined') Cloud.touch(); },
  title: lv => TITLES.reduce((t, [l, n]) => lv >= l ? n : t, TITLES[0][1]),
  // add coins and XP; returns what happened so the caller can show it
  give(coins, xp, src = 'other') {
    const p = Prog.get(), before = { lv: p.lv, xp: p.xp }, ups = [];
    p.coins += coins; p.xp += xp;
    while (p.xp >= needXP(p.lv)) { p.xp -= needXP(p.lv); p.lv++; p.coins += 30; ups.push(p.lv); }
    if (ups.length) p.lvT = Date.now();          // the shared room celebrates this when you walk back in
    Prog.put(p);
    if (typeof Stats !== 'undefined') { if (coins > 0) Stats.econ('in_' + src, coins); if (ups.length) { Stats.econ('in_level', 30 * ups.length); Stats.econ('lvup', ups.length); Stats.snap(); } }
    if (coins > 0) { Prog.office(coins); if (typeof Awards !== 'undefined') Awards.add('coin', coins); }
    if (ups.length) {
      const lv = ups[ups.length - 1], nm = myName();
      toast(`🎉 เลื่อนขั้น! Lv ${lv} · ${Prog.title(lv)} (+${30 * ups.length} 🪙)`);
      if (typeof presence === 'function') presence();
      if (nm) loadOnline().then(O => O.pushFeed(`🎉 ${nm} เลื่อนขั้นเป็น Lv ${lv} · ${Prog.title(lv)}`, nm, myAva())).catch(() => {});
    }
    return { coins, xp, ups, before, after: { lv: p.lv, xp: p.xp } };
  },
  award(game, score, mult = 1) { const c = Math.max(2, Math.min(60, Math.round(score / (PROG_NORM[game] || 20)))); return Prog.give(c * mult, c * 3 + 10, game); },
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
      loadOnline().then(O => O.saveProfile(nm, { lv: p.lv, ti: Prog.title(p.lv), who: p.who, room: { ...p.room, cs: caseCups(p) }, b: (p.gacha && p.gacha.eq) || '', h: typeof Wardrobe !== 'undefined' ? Wardrobe.eq('h') : '', f: typeof Wardrobe !== 'undefined' ? Wardrobe.eq('f') : '' })).catch(() => {}); }, 1500);
  },
};

/* ---------- shop catalogue: [sprite, kind (f floor · r rug · w wall), price, level] ---------- */
const SHOP = [
  ['plant_small', 'f', 20, 1], ['plant_pot', 'f', 35, 1], ['tree', 'f', 60, 2], ['palm', 'f', 90, 3],
  ['chair_red', 'f', 25, 1], ['chair_white', 'f', 25, 1], ['chair_dark', 'f', 25, 1], ['chair_beige', 'f', 25, 1], ['chair_grey', 'f', 25, 1], ['chair_school', 'f', 20, 1], ['chair_green', 'f', 30, 2], ['armchair_wood', 'f', 50, 2], ['armchair_dark', 'f', 50, 2],
  ['pc_desk', 'f', 80, 1], ['desk_drawer', 'f', 40, 1], ['desk_book', 'f', 60, 1], ['desk_pair', 'f', 70, 2], ['books_desk', 'f', 45, 2], ['dresser', 'f', 70, 3], ['table_wood', 'f', 90, 3], ['table_light', 'f', 90, 3],
  ['sofa_grey', 'f', 120, 1], ['sofa_white', 'f', 120, 2], ['bench_pink', 'f', 70, 2], ['bench_cream', 'f', 70, 2], ['sofa_brown', 'f', 140, 3], ['sofa_red', 'f', 160, 4],
  ['lamp_red', 'f', 30, 1], ['lamp_blue', 'f', 30, 1], ['lamp_beige', 'f', 30, 2], ['lamp_white', 'f', 30, 2], ['floorlamp_red', 'f', 50, 1], ['floorlamp_blue', 'f', 50, 1], ['floorlamp_white', 'f', 50, 2], ['floorlamp_beige', 'f', 50, 2],
  ['cupcase', 'f', 150, 1], ['locker', 'f', 60, 1], ['shelf_white', 'f', 90, 2], ['cabinet_glass', 'f', 110, 2], ['cabinet_wood', 'f', 110, 2], ['bookshelf', 'f', 160, 3], ['fridge', 'f', 120, 3], ['shelf_plant', 'f', 90, 3],
  ['cabinet_plates', 'f', 120, 4], ['wardrobe', 'f', 140, 4], ['filing', 'f', 130, 4], ['wardrobe_glass', 'f', 150, 5], ['shop_shelf', 'f', 180, 5], ['vanity', 'f', 150, 5], ['fridge_wide', 'f', 220, 6],
  ['crate', 'f', 15, 1], ['box_wood', 'f', 15, 1], ['broom', 'f', 10, 1], ['cushion_blue', 'f', 15, 1], ['cushion_yellow', 'f', 15, 1], ['jar', 'f', 25, 1], ['fruit_basket', 'f', 30, 1], ['cake_straw', 'f', 20, 1], ['globe', 'f', 40, 1],
  ['jar_pot', 'f', 30, 2], ['fruit_bowl', 'f', 30, 2], ['fruit_grape', 'f', 35, 2], ['fruit_veg', 'f', 30, 2], ['globe_blue', 'f', 60, 2], ['cans', 'f', 40, 2], ['pizza', 'f', 25, 2], ['jar_white', 'f', 40, 3], ['jar_gold', 'f', 60, 4], ['globe_gold', 'f', 150, 7],
  ['dx_cactus', 'f', 30, 1], ['dx_teddy', 'f', 45, 2], ['dx_beanbag', 'f', 70, 2], ['dx_cooler', 'f', 90, 3],
  ['dx_bamboo', 'f', 35, 1], ['dx_rollchair', 'f', 45, 2], ['dx_cart', 'f', 70, 3], ['dx_medcab', 'f', 100, 4], ['dx_arcade', 'f', 300, 6],
  ['rug_blue', 'r', 60, 1], ['rug_green', 'r', 60, 2], ['rug_lblue', 'r', 70, 3],
  ['window_small', 'w', 30, 1], ['window_frost', 'w', 50, 1], ['window_grey', 'w', 60, 1], ['window_red', 'w', 60, 2], ['window_big', 'w', 90, 2], ['window_slide', 'w', 120, 4],
  ['pic_bird', 'w', 25, 1], ['pic_flower', 'w', 25, 1], ['pic_hill', 'w', 25, 1], ['pic_fish', 'w', 30, 1], ['pic_fishblue', 'w', 30, 1], ['pic_aqua', 'w', 30, 1], ['pic_cat', 'w', 40, 1], ['noticeboard', 'w', 40, 1], ['board_calendar', 'w', 40, 1], ['dx_clock', 'w', 35, 1], ['dx_firstaid', 'w', 40, 2], ['dx_award', 'w', 60, 3],
  ['pic_fire', 'w', 25, 2], ['pic_forest', 'w', 35, 2], ['pic_long', 'w', 30, 2], ['pic_sunset', 'w', 50, 2], ['pic_land', 'w', 50, 2], ['door', 'w', 80, 2],
  ['pic_monster', 'w', 45, 3], ['pic_robot', 'w', 45, 3], ['mirror_gold', 'w', 70, 3], ['blackboard', 'w', 90, 3], ['world_map', 'w', 100, 4], ['tv', 'w', 160, 4], ['door_double', 'w', 140, 5],
];
const STYLES = [['wall_mint', 0, 1], ['wall_yellow', 50, 1], ['wall_pink', 80, 2], ['wall_grey', 80, 2], ['wall_beige', 80, 3], ['wall_wood', 150, 4], ['wall_dwood', 150, 5], ['wall_red', 200, 6],
  ['floor_wood', 0, 1], ['floor_grey', 60, 1], ['floor_herring', 80, 2], ['floor_teal', 80, 2], ['floor_yellow', 80, 3], ['floor_carpet', 100, 3], ['floor_brick', 120, 4], ['floor_dwood', 120, 4], ['floor_rwood', 150, 5]];
const SHOP_KIND = Object.fromEntries(SHOP.map(s => [s[0], s[1]]));
// shop filter chips: [id, label]; catOf() sorts every catalogue item into one of them
const SHOP_CATS = [['all', 'ทั้งหมด'], ['new', '✨ ใหม่'], ['seat', '🪑 ที่นั่ง'], ['desk', '🖥️ โต๊ะ'], ['store', '🗄️ ตู้/ชั้น'], ['plant', '🌿 ต้นไม้'], ['light', '💡 โคมไฟ'], ['deco', '🧸 ของแต่ง'], ['wall', '🖼️ ติดผนัง']];
const SHOP_NEW = n => n.startsWith('dx_');
function catOf(n, k) {
  if (k === 'w') return 'wall';
  if (/^(chair|armchair|sofa|bench|cushion)_|^dx_(beanbag|rollchair|bamboo)$/.test(n)) return 'seat';
  if (/^(pc_desk|desk_|books_desk|table_|dresser|vanity)/.test(n)) return 'desk';
  if (/^(cupcase|locker|shelf_|cabinet_|bookshelf|fridge|wardrobe|filing|shop_shelf|crate|box_wood)|^dx_(medcab|cooler|cart)$/.test(n)) return 'store';
  if (/^(plant_|tree|palm)|^dx_cactus$/.test(n)) return 'plant';
  if (/^(lamp|floorlamp)_/.test(n)) return 'light';
  return 'deco';
}

/* ---------- the room: 12 x 9 cells, rows 0-1 are the wall ---------- */
const RC = 32, RCOLS = 12, RROWS = 9, RTOP = 2;
// room sizes you can expand to: [columns, price, level]
const ROOM_SIZES = [[12, 0, 1], [15, 300, 3], [18, 700, 6], [22, 1500, 10]];
const roomW = room => room.w || RCOLS;
const cellsW = n => Math.max(1, Math.ceil((MI_SZ[n] || [16])[0] / 16));
function roomFits(room, n, x, y, skip) {
  const k = SHOP_KIND[n] || 'f', w = cellsW(n);
  if (x < 0 || x + w > roomW(room)) return false;
  if (k === 'w' ? y >= RTOP : (y < RTOP || y >= RROWS)) return false;
  return !room.items.some((it, i) => { if (i === skip) return false; const k2 = SHOP_KIND[it[0]] || 'f';
    if ((k === 'w') !== (k2 === 'w') || (k === 'r') !== (k2 === 'r')) return false;   // rugs only collide with rugs, wall with wall
    if (k !== 'w' && it[2] !== y) return false;
    return x < it[1] + cellsW(it[0]) && it[1] < x + w; });
}
/* ---------- season trophies: top 3 of a game's monthly board become room items "cup<rank>.<game>.<yyyymm>" ---------- */
const CUP_FIRST = '202611';                      // the first season (monthly boards started in Nov 2026)
const CUP_COL = { 1: ['#ffd23f', '#c77d0a'], 2: ['#e6e9ee', '#8a93a3'], 3: ['#e0913b', '#8a5228'], 4: ['#7ee0c3', '#1f9d8a'] };   // 4 = season pass cup
// ribbon colour per month, so each season's cups look different on the shelf
const CUP_RIB = ['#3a86ff', '#e63972', '#1f9d63', '#f07b16', '#c99700', '#1597c4', '#7b3fe4', '#0f8f8f', '#9c5a2e', '#b5179e', '#d62828', '#23408e'];
const CUP_ART = ['..kkkkkkkk..', 'kkkAwAAABkkk', 'k.kAwAAABk.k', 'k.kAwAAABk.k', '.kkAAAAABkk.', '...kAAABk...', '....kABk....', '....kABk....', '...kkkkkk...'];
// 3x5 pixel digits for the season plaque ("11.69" = Nov 2569)
const CUP_DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const cupOf = n => { const m = /^cup([1-4])\.([a-z0-9]+)\.(\d{6})$/.exec(n || ''); return m ? { r: +m[1], g: m[2], s: m[3] } : null; };
const seasonName = s => `${TH_MON[+s.slice(4, 6) - 1]} ${(+s.slice(0, 4) + 543) % 100}`;
const _cups = {};
function cupImg(n, k = 1) {
  const key = n + '@' + k; if (_cups[key]) return _cups[key];
  const c = cupOf(n), [A, B] = CUP_COL[c.r], P = CUP_RIB[+c.s.slice(4, 6) - 1], pal = { k: '#2b2140', w: '#ffffff', A, B };
  const W = 21, H = CUP_ART.length + 8, cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k; const g = cv.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x * k, y * k, k, k); };
  CUP_ART.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px(x + 4, y, pal[ch]); }));
  // plaque in the month colour with "MM.YY" (Thai year), so every season's cup is different
  const T = CUP_ART.length; g.fillStyle = pal.k; g.fillRect(0, T * k, W * k, 8 * k); g.fillStyle = P; g.fillRect(k, (T + 1) * k, (W - 2) * k, 6 * k);
  const ink = pal.w;
  const txt = c.s.slice(4, 6) + '.' + String((+c.s.slice(0, 4) + 543) % 100).padStart(2, '0'); let x = 2;
  for (const ch of txt) { if (ch === '.') { px(x, T + 6, ink); x += 2; continue; } [...CUP_DIG[+ch]].forEach((b, i) => { if (b === '1') px(x + i % 3, T + 2 + (i / 3 | 0), ink); }); x += 4; }
  return (_cups[key] = cv);
}
// ตู้โชว์ถ้วย: drawn here (no sprite in the pack); shows the owner's 6 best cups, filled in automatically
const MINI_CUP = ['kkkkkk', 'kAwABk', '.kABk.', '..kk..', '.kPPk.', '.kkkk.'];
const CASE_PAL = { k: '#3a3a50', t: '#e4c181', T: '#cfa06c', b: '#c78c59', B: '#a85f46', i: '#6b5052', s: '#e0b870', g: '#a79796' };
if (typeof MI_SZ !== 'undefined') MI_SZ.cupcase = [26, 30];
function caseCups(p) {
  const all = [...Object.keys(p.inv || {}).filter(n => p.inv[n] > 0), ...(p.room.items || []).map(it => it[0])].filter(cupOf);
  return [...new Set(all)].sort((a, b) => cupOf(a).r - cupOf(b).r || cupOf(b).s.localeCompare(cupOf(a).s)).slice(0, 6);
}
const _cases = {};
function caseImg(cs = [], k = 1) {
  const key = cs.join() + '@' + k; if (_cases[key]) return _cases[key];
  const W = 26, H = 30, cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k; const g = cv.getContext('2d');
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * k, y * k, w * k, h * k); };
  R(0, 0, W, H, CASE_PAL.k); R(1, 1, W - 2, 3, CASE_PAL.t); R(1, 4, W - 2, 1, CASE_PAL.T);           // top board
  R(1, 5, W - 2, H - 6, CASE_PAL.b); R(1, 5, 1, H - 6, CASE_PAL.B); R(W - 2, 5, 1, H - 6, CASE_PAL.B); // sides
  R(3, 6, W - 6, 8, CASE_PAL.i); R(3, 17, W - 6, 8, CASE_PAL.i);                                      // two compartments
  R(2, 14, W - 4, 2, CASE_PAL.s); R(2, 25, W - 4, 2, CASE_PAL.s); R(2, 16, W - 4, 1, CASE_PAL.B);      // shelves
  R(3, 6, 1, 3, '#8a7476'); R(3, 17, 1, 3, '#8a7476');                                                 // glass glint
  R(2, H - 2, 3, 1, CASE_PAL.k); R(W - 5, H - 2, 3, 1, CASE_PAL.k);
  cs.slice(0, 6).forEach((n, i) => { const c = cupOf(n); if (!c) return; const [A, B] = CUP_COL[c.r], pal = { k: '#2b2140', w: '#fff', A, B, P: CUP_RIB[+c.s.slice(4, 6) - 1] };
    const ox = 3 + (i % 3) * 7 + 1, oy = i < 3 ? 8 : 19;
    MINI_CUP.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') R(ox + x, oy + y, 1, 1, pal[ch]); })); });
  return (_cases[key] = cv);
}
const drawnItem = n => n === 'cupcase' || !!cupOf(n) || (typeof SX !== 'undefined' && !!SX[n]);
const itemCanvas = (n, k = 1, cs = [], c = 0) => n === 'cupcase' ? caseImg(cs, k) : SX[n] ? sxImg(n, k, c) : cupImg(n, k);
const itemImg = (n, room, c = 0) => drawnItem(n) ? itemCanvas(n, 1, (room && room.cs) || [], c) : n;
const dyeable = n => typeof SX_DYE !== 'undefined' && !!SX_DYE[n];
function itemLabel(n) {
  if (typeof SX !== 'undefined' && SX[n]) return SX[n][0] + (n.startsWith('sx_') ? ' (ของรางวัล Season Pass)' : '');
  if (n === 'cupcase') return '🏆 ตู้โชว์ถ้วย (โชว์ถ้วยดีที่สุด 6 ใบของคุณเอง)';
  const c = cupOf(n); if (!c) return n;
  if (c.g === 'pass' || c.g === 'office') return `🎫 ถ้วย Season Pass · ${seasonName(c.s)}`;
  if (c.g === 'season') return `${['', '🏆 ถ้วยทอง', '🏆 ถ้วยเงิน', '🏆 ถ้วยทองแดง'][c.r]} ภารกิจฤดูกาล · ${seasonName(c.s)}`;
  const G = typeof GAMES !== 'undefined' && GAMES.find(x => x.id === c.g);
  return `${['', '🥇', '🥈', '🥉'][c.r]} ${G ? G.title : c.g} · ฤดูกาล ${seasonName(c.s)}`;
}
// on opening the site: hand out cups for finished seasons I placed top 3 in (each season checked once)
function claimCups() {
  const nm = myName(); if (!nm) return;
  loadOnline().then(async O => {
    const done = store.get('cupsDone', []), cur = O.buckets().m, todo = [];
    let s = cur; for (let i = 0; i < 3; i++) { const y = +s.slice(0, 4), m = +s.slice(4, 6); s = m === 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, '0')}`; if (s >= CUP_FIRST && !done.includes(s)) todo.push(s); }
    let last = null;
    for (const ss of todo.reverse()) {
      const rec = await O.closeSeason(ss).catch(() => null);
      if (rec) postRecap(O, ss, rec);
      const won = await O.trophies(O.nameKey(nm), ss);
      const p = Prog.get(); won.forEach(w => { const n = `cup${w.r}.${w.g}.${ss}`; p.inv[n] = (p.inv[n] || 0) + 1; });
      if (won.length) Prog.put(p);
      store.set('cupsDone', store.get('cupsDone', []).concat(ss));
      last = { ss, won };
      if (won.length && typeof Stats !== 'undefined') Stats.econ('cup', won.length);
      if (won.length) O.pushFeed(`🏆 ${nm} ได้ถ้วยฤดูกาล ${seasonName(ss)}: ${won.map(w => itemLabel(`cup${w.r}.${w.g}.${ss}`).split(' · ')[0]).join(', ')}`, nm, myAva());
    }
    if (last) Fame.recap(last);
  }).catch(() => {});
}

/* ---------- season pass: personal, resets each month. Points = finished games + party rounds + 3 per season challenge.
   Each tier gives its item right away (decorations + clothing, themed per month; top tier = the pass cup) ---------- */
const PASS = [5, 15, 30, 45];   // points needed per tier
const PASS_SET = { '11': ['sx_krathong', 'acc:lotus', 'sx_lantern'], '12': ['sx_snowman', 'acc:santa', 'sx_xtree'] };
const PASS_ANY = ['jar_gold', 'mirror_gold', 'globe_gold'];   // months without a theme yet
const passPrize = (ss, i) => i >= 3 ? `cup4.pass.${ss}` : (PASS_SET[ss.slice(4, 6)] || PASS_ANY)[i];
const prizeName = n => n.startsWith('acc:') ? (typeof ACC !== 'undefined' && ACC[n.slice(4)] ? '👕 ' + ACC[n.slice(4)][1] : n) : SX[n] ? SX[n][0] : itemLabel(n).split(' · ')[0];
const prizeIcon = n => n.startsWith('acc:') ? (typeof Wardrobe !== 'undefined' ? Wardrobe.icon(n.slice(4)) : '') : drawnItem(n) ? itemCanvas(n, 4).toDataURL() : `assets/mi/${n}.png`;
// seasonal decorations (SX_PAL, SX) come from season-art.js
for (const [n, [, k, rows]] of Object.entries(SX)) { SHOP_KIND[n] = k; if (typeof MI_SZ !== 'undefined') MI_SZ[n] = [Math.max(...rows.map(r => r.length)), rows.length]; }
const _sx = {};
function sxImg(n, k = 1, c = 0) {
  if (!SX_DYE[n] || !DYE[c]) c = 0;
  const key = n + '@' + k + '@' + c; if (_sx[key]) return _sx[key];
  const pal = dyePal(SX_PAL, SX_DYE[n], c);
  const rows = SX[n][2], cv = document.createElement('canvas'); cv.width = Math.max(...rows.map(r => r.length)) * k; cv.height = rows.length * k; const g = cv.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x * k, y * k, k, k); } }));
  return (_sx[key] = cv);
}
const prevSeason = s => { const y = +s.slice(0, 4), m = +s.slice(4, 6); return m === 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, '0')}`; };
const Pass = {
  pts: s => (s.c.g || 0) + (s.c.party || 0) + 3 * Season.done(s),
  next: p => PASS.findIndex(need => p < need),
  // give every tier reached and not yet given (called from Season.add after the counters change)
  check(s) {
    const p = Pass.pts(s), got = s.pass || (s.pass = []), fresh = PASS.map((need, i) => i).filter(i => p >= PASS[i] && !got.includes(i));
    if (!fresh.length) return;
    const q = Prog.get(); fresh.forEach(i => { got.push(i); const n = passPrize(s.s, i); if (!n.startsWith('acc:')) q.inv[n] = (q.inv[n] || 0) + 1; });
    Prog.put(q); store.set('season', s);
    fresh.forEach(i => { const n = passPrize(s.s, i); if (n.startsWith('acc:') && typeof Wardrobe !== 'undefined' && ACC[n.slice(4)]) Wardrobe.give(n.slice(4)); });
    if (typeof Stats !== 'undefined') Stats.econ('pass', fresh.length);
    setTimeout(() => toast(`🎫 Season Pass ขั้น ${fresh[fresh.length - 1] + 1}: ได้ ${fresh.map(i => prizeName(passPrize(s.s, i))).join(', ')}!`), 2400);
    const me = myName(); if (me && fresh.includes(PASS.length - 1)) loadOnline().then(O => O.pushFeed(`🎫 ${me} ผ่าน Season Pass ${seasonName(s.s)} ครบทุกขั้น!`, me, myAva())).catch(() => {});
    const el = document.getElementById('ladBtn'); if (el) Pass.chip(el);
  },
  // office-wide count of finished games per person (for the "who played most" list and the hall of fame)
  add() { loadOnline().then(O => { O.ladderAdd(myName(), typeof Stats !== 'undefined' ? Stats.aid() : ''); }).catch(() => {}); },
  chip(el) { if (!el) return; const s = Season.get(); el.innerHTML = `🎫<span class="sea-l"> Pass</span> <b>${(s.pass || []).length}/${PASS.length}</b>`; },
  open() {
    const s = Season.get(), p = Pass.pts(s), got = s.pass || [], top = PASS[PASS.length - 1], nx = Pass.next(p);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin season"><h2>🎫 Season Pass ${seasonName(s.s)}</h2>
      <p class="muted">เล่นจบ 1 เกม / ปาร์ตี้ 1 รอบ = 1 แต้ม · ภารกิจฤดูกาลสำเร็จ 1 อัน = 3 แต้ม · ถึงขั้นไหนได้ของทันที</p>
      <div class="lad-bar"><i style="width:${Math.min(100, p / top * 100)}%"></i>${PASS.map(need => `<span class="lad-tick${p >= need ? ' on' : ''}" style="left:${need / top * 100}%"><b>${need}</b></span>`).join('')}</div>
      <p class="sea-next">คุณมี ${p} แต้ม${nx >= 0 ? ` · อีก ${PASS[nx] - p} แต้มถึงขั้น ${nx + 1}` : ' · ผ่านครบทุกขั้นแล้ว! 🎉'}</p>
      <ul class="sea-list lad-list">${PASS.map((need, i) => { const n = passPrize(s.s, i), ok = got.includes(i);
        return `<li class="${ok ? 'done' : ''}"><img class="pxi lad-ic" src="${prizeIcon(n)}" alt=""><span class="tx"><b>ขั้น ${i + 1} · ${need} แต้ม</b><br><small>${esc(prizeName(n))}</small></span><small>${ok ? '✅ ได้แล้ว' : `${p}/${need}`}</small></li>`; }).join('')}</ul>
      <h4 class="sz-h">💪 คนขยันเดือนนี้</h4><ol class="rk-list" data-k="top"><li class="muted">⏳ กำลังโหลด…</li></ol>
      <p class="muted" style="font-size:12px">ของแต่ละเดือนไม่ซ้ำกัน หมดเดือนแล้วไม่มีอีก · ของแต่งอยู่ใน "ของของฉัน" · ชุดอยู่ใน "แต่งตัว"</p>
      <div class="row"><button class="btn" data-k="sea">🏆 ภารกิจ</button><button class="btn" data-k="fame">📜 หอเกียรติยศ</button><button class="btn primary" data-k="close">ปิด</button></div></div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); }; ov.querySelector('[data-k=close]').onclick = () => ov.remove();
    ov.querySelector('[data-k=sea]').onclick = () => { ov.remove(); Season.open(); }; ov.querySelector('[data-k=fame]').onclick = () => { ov.remove(); Fame.open(); };
    document.body.appendChild(ov); if (typeof Stats !== 'undefined') Stats.open('pass');
    loadOnline().then(O => O.ladder()).then(L => { const el = ov.querySelector('[data-k=top]');
      el.innerHTML = L.rows.filter(r => r.n).slice(0, 8).map((r, i) => `<li><span class="pos">${['🥇', '🥈', '🥉'][i] || '#' + (i + 1)}</span><span class="nm">${esc(r.n)}</span><span class="sc">${r.g} เกม</span></li>`).join('') || '<li class="muted">ยังไม่มีใคร — เริ่มเลย!</li>'; })
      .catch(() => { ov.querySelector('[data-k=top]').innerHTML = '<li class="muted">โหลดไม่ได้ (เน็ตหลุด?)</li>'; });
  },
};

/* ---------- hall of fame + season recap: one record per finished month at rooms/_fame/<yyyymm> ---------- */
function postRecap(O, ss, rec) {
  O.pushFeed(`📜 จบฤดูกาล ${seasonName(ss)}: ออฟฟิศเล่นรวม ${fmt(rec.lad.t)} เกม${rec.room ? ` · 🏠 ห้องยอดเยี่ยม: ${rec.room.n}` : ''}`);
  const ch = Object.entries(rec.champ || {}).map(([g, c]) => `${c.n} (${(GAMES.find(x => x.id === g) || { title: g }).title})`);
  if (ch.length) O.pushFeed(`👑 แชมป์ ${seasonName(ss)}: ${ch.join(', ')}`);
}
const Fame = {
  _f: {},
  of(ss) { return Fame._f[ss] || (Fame._f[ss] = loadOnline().then(O => O.fame(ss)).catch(() => null)); },
  // chips for a room owner: champion titles + room of the month, from last month's record
  async badges(O, k) {
    const ss = prevSeason(O.buckets().m); if (ss < CUP_FIRST) return [];
    const f = await Fame.of(ss); if (!f) return [];
    const out = Object.entries(f.champ || {}).filter(([, c]) => c.k === k).map(([g]) => `👑 แชมป์${(GAMES.find(x => x.id === g) || { title: g }).title} ${seasonName(ss)}`);
    if (f.room && f.room.k === k) out.unshift(`🏠 ห้องยอดเยี่ยม ${seasonName(ss)}`);
    return out;
  },
  block(ss, f) {
    const gn = g => { const G = GAMES.find(x => x.id === g); return G ? `${G.emoji} ${G.title}` : g; };
    return `<div class="fame-s"><h3>${seasonName(ss)}</h3>
      <p>🎮 ออฟฟิศเล่นรวม <b>${fmt((f.lad || {}).t || 0)}</b> เกม${(f.lad && f.lad.top || []).length ? ` · 💪 ${f.lad.top.map(x => `${esc(x.n)} ${x.g}`).join(', ')}` : ''}</p>
      ${f.room ? `<p>🏠 ห้องยอดเยี่ยม: <b>${esc(f.room.n)}</b> <small>(👍 ${f.room.c})</small></p>` : ''}
      <div class="fame-ch">${Object.entries(f.champ || {}).map(([g, c]) => `<span class="soc-chip cup">👑 ${esc(c.n)} <small>${gn(g)}</small></span>`).join('') || '<span class="muted">ไม่มีแชมป์</span>'}</div></div>`;
  },
  open() {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin season"><h2>📜 หอเกียรติยศ</h2><div data-k="b"><p class="muted">⏳ กำลังโหลด…</p></div><div class="row"><button class="btn primary" data-k="close">ปิด</button></div></div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); }; ov.querySelector('[data-k=close]').onclick = () => ov.remove();
    document.body.appendChild(ov); if (typeof Stats !== 'undefined') Stats.open('fame');
    loadOnline().then(O => Promise.all([O.fameAll(), O.likeBoard(), O.listProfiles(60)])).then(([all, lk, profs]) => {
      const nm = k => (profs.find(p => p.k === k) || {}).n || k;
      const live = lk.slice(0, 3).map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(nm(r.k))} (👍 ${r.c})`).join(' · ');
      const past = Object.keys(all).sort().reverse().map(ss => Fame.block(ss, all[ss])).join('');
      ov.querySelector('[data-k=b]').innerHTML = `<div class="fame-s now"><h3>ลุ้นห้องยอดเยี่ยมเดือนนี้</h3><p>${live || '<span class="muted">ยังไม่มีใครได้ไลก์เดือนนี้ — ไปกด 👍 ให้ห้องเพื่อนได้ที่ตึกออฟฟิศ</span>'}</p></div>`
        + (past || '<p class="muted">ยังไม่มีฤดูกาลที่จบ — ฤดูกาลแรกจบวันที่ 1 ธ.ค.</p>');
    }).catch(() => { ov.querySelector('[data-k=b]').innerHTML = '<p class="muted">โหลดไม่ได้ (เน็ตหลุด?)</p>'; });
  },
  // shown once when a season you took part in ends: your rewards + the office's results
  recap(r) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    const mine = r.won.map(w => `cup${w.r}.${w.g}.${r.ss}`);
    ov.innerHTML = `<div class="panel popin season recap"><h2>📜 จบฤดูกาล ${seasonName(r.ss)}</h2>
      ${mine.length ? `<div class="sea-tiers recap-got">${mine.map(n => `<div class="sea-tier got"><img class="pxi" src="${prizeIcon(n)}" alt=""><small>${esc(prizeName(n))}</small></div>`).join('')}</div><p class="sea-next">ถ้วยอยู่ใน "ของของฉัน" ไปวางในห้องได้เลย</p>` : ''}
      <p>🎫 Season Pass ${seasonName(Season.now())} เริ่มใหม่แล้ว มีของแต่งชุดใหม่รออยู่</p>
      <div data-k="f"></div>
      <div class="row"><button class="btn" data-k="fame">📜 หอเกียรติยศ</button><button class="btn primary" data-k="close">เยี่ยม!</button></div></div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); }; ov.querySelector('[data-k=close]').onclick = () => ov.remove();
    ov.querySelector('[data-k=fame]').onclick = () => { ov.remove(); Fame.open(); };
    document.body.appendChild(ov);
    if (mine.length) { const pn = ov.querySelector('.panel'), R = pn.getBoundingClientRect(); if (typeof domBurst === 'function') domBurst(pn, R.width / 2, 60, { n: 40, dist: 200, size: 9 }); }
    Fame._f[r.ss] = null; Fame.of(r.ss).then(f => { const el = ov.querySelector('[data-k=f]'); if (f && el) el.innerHTML = Fame.block(r.ss, f).replace(/<h3>.*?<\/h3>/, ''); });
  },
};

/* ---------- season challenges (POE-style): same list for everyone each month; 4 / 8 / 12 done = bronze / silver / gold cup ---------- */
const SEASON_CH = [ // [id, emoji, text, goal, count(c)]  c = this month's counters
  ['g5', '🎮', 'เล่นเกมเดี่ยวครบ 5 เกมต่างกัน', 5, c => (c.games || []).length],
  ['g10', '🕹️', 'เล่นเกมเดี่ยวครบ 10 เกมต่างกัน', 10, c => (c.games || []).length],
  ['r30', '🔁', 'เล่นจบ 30 รอบ', 30, c => c.g || 0],
  ['r100', '💯', 'เล่นจบ 100 รอบ', 100, c => c.g || 0],
  ['best', '📈', 'ทำสถิติใหม่ของตัวเอง 5 ครั้ง', 5, c => c.best || 0],
  ['feat', '⭐', 'เล่นเกมแนะนำวันนี้ 7 ครั้ง', 7, c => c.feat || 0],
  ['mis', '🎯', 'ทำภารกิจรายวันสำเร็จ 15 อัน', 15, c => c.mission || 0],
  ['str', '🔥', 'ทำภารกิจครบทั้งวัน 5 วัน', 5, c => c.streak || 0],
  ['party', '🎉', 'เล่นปาร์ตี้ในห้องรวม 3 รอบ', 3, c => c.party || 0],
  ['vis', '👀', 'แวะเยี่ยมห้องเพื่อน 10 ครั้ง', 10, c => c.visit || 0],
  ['stk', '💌', 'แปะสติกเกอร์ให้ห้องเพื่อน 5 ครั้ง', 5, c => c.sticker || 0],
  ['like', '👍', 'ส่งกำลังใจให้ห้องเพื่อน 3 ห้อง', 3, c => c.like || 0],
  ['deco', '🪑', 'ซื้อของแต่งห้อง 3 ชิ้น', 3, c => c.deco || 0],
  ['lv', '⬆️', 'เลื่อนขั้น 2 ครั้ง', 2, c => c.lvup || 0],
  ['farm', '🥕', 'เก็บผักในฟาร์ม 30 ต้น', 30, c => c.harvest || 0],
  ['help', '💧', 'รดน้ำหรือส่งของขวัญให้เพื่อน 5 ครั้ง', 5, c => (c.water || 0) + (c.gift || 0)],
];
const SEASON_TIER = [[4, 3], [8, 2], [12, 1]];   // [challenges done, cup rank]
const SEASON_KEYS = ['harvest', 'water', 'gift', 'lvup', 'mission', 'streak', 'visit', 'sticker'];   // Stats.econ keys that count
const Season = {
  now: () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7).replace('-', ''),
  get() { const s = store.get('season', null), m = Season.now(); return s && s.s === m ? s : { s: m, c: {}, got: [] }; },
  ids: s => SEASON_CH.filter(([, , , goal, f]) => f(s.c) >= goal).map(x => x[0]),
  done: s => Season.ids(s).length,
  add(k, n = 1, gid) {
    const s = Season.get(), before = Season.ids(s);
    if (k === 'g' && gid && !(typeof GAMES !== 'undefined' && (GAMES.find(x => x.id === gid) || {}).online)) { const L = s.c.games || (s.c.games = []); if (!L.includes(gid)) L.push(gid); }
    s.c[k] = (s.c[k] || 0) + n;
    const nowIds = Season.ids(s), after = nowIds.length;
    SEASON_CH.filter(x => nowIds.includes(x[0]) && !before.includes(x[0])).forEach(([, em, t]) => toast(`🏆 ภารกิจฤดูกาลสำเร็จ: ${em} ${t} (${after}/${SEASON_CH.length})`));
    const won = SEASON_TIER.filter(([need, r]) => after >= need && !s.got.includes(r));
    store.set('season', s);
    Pass.check(s);
    if (won.length) {
      const p = Prog.get(); won.forEach(([, r]) => { s.got.push(r); const nm = `cup${r}.season.${s.s}`; p.inv[nm] = (p.inv[nm] || 0) + 1; });
      Prog.put(p); store.set('season', s);
      if (typeof Stats !== 'undefined') Stats.econ('scup', won.length);
      const lab = won.map(([, r]) => ['', 'ถ้วยทอง', 'ถ้วยเงิน', 'ถ้วยทองแดง'][r]).join(', ');
      setTimeout(() => toast(`🏆 ได้${lab} ${seasonName(s.s)}! ไปวางในห้องได้`), 1200);
      const me = myName(); if (me) loadOnline().then(O => O.pushFeed(`🏆 ${me} ได้${lab}ภารกิจฤดูกาล ${seasonName(s.s)}`, me, myAva())).catch(() => {});
    }
  },
  econ(k, n) { if (SEASON_KEYS.includes(k)) Season.add(k, n); },
  open() {
    const s = Season.get(), d = Season.done(s), nx = SEASON_TIER.find(([need]) => d < need);
    const [y, m] = [+s.s.slice(0, 4), +s.s.slice(4, 6)], left = Math.ceil((Date.UTC(m === 12 ? y + 1 : y, m % 12, 1) - 7 * 3600e3 - Date.now()) / 864e5);
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin season"><h2>🏆 ภารกิจฤดูกาล ${seasonName(s.s)}</h2>
      <p class="muted">ทำได้ ${d}/${SEASON_CH.length} · เหลืออีก ${left} วัน · ไม่ต้องทำครบทุกอัน เลือกที่ชอบได้เลย</p>
      <div class="sea-tiers">${SEASON_TIER.map(([need, r]) => `<div class="sea-tier${s.got.includes(r) ? ' got' : ''}"><img class="pxi" src="${cupImg(`cup${r}.season.${s.s}`, 4).toDataURL()}" alt=""><b>${need} อัน</b><small>${s.got.includes(r) ? 'ได้แล้ว ✅' : ['', 'ถ้วยทอง', 'ถ้วยเงิน', 'ถ้วยทองแดง'][r]}</small></div>`).join('')}</div>
      ${nx ? `<p class="sea-next">อีก ${nx[0] - d} อัน ได้${['', 'ถ้วยทอง', 'ถ้วยเงิน', 'ถ้วยทองแดง'][nx[1]]}</p>` : '<p class="sea-next">ได้ครบทั้ง 3 ใบแล้ว เก่งมาก! 🎉</p>'}
      <ul class="sea-list">${SEASON_CH.map(([, em, t, goal, f]) => { const v = Math.min(goal, f(s.c)), ok = v >= goal;
        return `<li class="${ok ? 'done' : ''}"><span class="em">${ok ? '✅' : em}</span><span class="tx">${t}<i class="sea-bar"><i style="width:${v / goal * 100}%"></i></i></span><small>${v}/${goal}</small></li>`; }).join('')}</ul>
      <p class="muted" style="font-size:12px">ติดท็อป 3 อันดับเดือนนี้ของเกมไหน ก็ได้ถ้วยเกมนั้นเพิ่มตอนสิ้นเดือน · ถ้วยเก่าเก็บไว้ในห้องได้ตลอด</p>
      <div class="row"><button class="btn" data-k="lad">🎫 Season Pass</button><button class="btn" data-k="fame">📜 หอเกียรติยศ</button><button class="btn primary" data-k="close">ปิด</button></div></div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); }; ov.querySelector('[data-k=close]').onclick = () => ov.remove();
    ov.querySelector('[data-k=lad]').onclick = () => { ov.remove(); Pass.open(); }; ov.querySelector('[data-k=fame]').onclick = () => { ov.remove(); Fame.open(); };
    document.body.appendChild(ov); if (typeof Stats !== 'undefined') Stats.open('season');
  },
};

// draws a room (yours or a coworker's); extra = things to depth-sort in (avatar, ghost)
function drawRoom(ctx, room, extra = [], t = 0, pops = {}, tryFrom = Infinity) {
  officeBG(ctx, roomW(room) * RC, RROWS * RC, RTOP * RC, { wall: room.wall, floor: room.floor, k: 2, calm: .1 });
  const list = [];
  room.items.forEach((it, i) => {
    const [n, x, y, f, dc] = it, k = SHOP_KIND[n] || 'f', cx = (x + cellsW(n) / 2) * RC, pop = pops[i] || 0, o = { flip: !!f, sx: 1 + pop * .25, sy: 1 - pop * .2, alpha: i >= tryFrom ? .78 : null };
    const im = itemImg(n, room, dc);
    if (k === 'w') drawPixAt(ctx, im, cx, RTOP * RC - 6, 2, o);
    else if (k === 'r') drawPixAt(ctx, im, cx, (y + 1) * RC, 2, o);
    else list.push({ y: y + 1, d: () => drawPixAt(ctx, im, cx, (y + 1) * RC, 2, o) });
  });
  list.push(...extra);
  list.sort((a, b) => a.y - b.y).forEach(o => o.d());
}
// a small wandering avatar for a room
function roomWalker(who) {
  const a = { who, x: 6, y: 7, tx: 6, ty: 7, wait: 1, dir: 'down' };
  a.step = (room, dt) => {
    if (a.wait > 0) { a.wait -= dt; if (a.wait <= 0) { for (let i = 0; i < 30; i++) { const x = Math.floor(rnd() * roomW(room)), y = RTOP + 1 + Math.floor(rnd() * (RROWS - RTOP - 1));
      if (!room.items.some(it => (SHOP_KIND[it[0]] || 'f') === 'f' && it[2] === y && x >= it[1] && x < it[1] + cellsW(it[0]))) { a.tx = x; a.ty = y; break; } } } return; }
    const dx = a.tx - a.x, dy = a.ty - a.y, sp = 2.2 * dt;
    if (Math.abs(dx) > .02) { a.x += Math.sign(dx) * Math.min(sp, Math.abs(dx)); a.dir = dx > 0 ? 'right' : 'left'; }
    else if (Math.abs(dy) > .02) { a.y += Math.sign(dy) * Math.min(sp, Math.abs(dy)); a.dir = dy > 0 ? 'down' : 'up'; }
    else { a.wait = 1.5 + rnd() * 3; a.dir = 'down'; }
  };
  a.item = (t) => ({ y: a.y + 1 + .01, d: c => drawChar(a.ctx, a.who, a.wait > 0 ? 'idle_anim' : 'run', a.dir, t, (a.x + .5) * RC, (a.y + 1) * RC, 2) });
  return a;
}

// sticker notes a visitor can leave on a coworker's room (fixed words, so nothing needs moderating)
const STICKERS = [['cute', '😍', 'ห้องน่ารัก'], ['fire', '🔥', 'สุดยอด'], ['coffee', '☕', 'ขอมานั่งด้วย'], ['plant', '🌿', 'ต้นไม้สวย'], ['lol', '😂', 'ฮามาก'], ['clap', '👏', 'ปรบมือให้'], ['work', '💼', 'ตั้งใจทำงานนะ']];
const stickerOf = id => STICKERS.find(s => s[0] === id);

// on opening the site: who dropped by my room since I last looked (once per new batch)
function roomNews() {
  const nm = myName(); if (!nm) return;
  loadOnline().then(O => O.roomVisits(O.nameKey(nm))).then(v => {
    const seen = store.get('visSeen', 0), fresh = v.all.filter(x => (x.t || 0) > seen && x.n !== nm.trim().slice(0, 20));
    if (!fresh.length) return;
    const who = [...new Set(fresh.map(x => x.k))].length, notes = fresh.filter(x => x.s).length;
    store.set('visSeen', Date.now());
    toast(`🏠 เพื่อนแวะมาเยี่ยมห้อง ${who} คน${notes ? ` · โน้ต ${notes} อัน` : ''}`);
  }).catch(() => {});
}

/* ---------- the "ออฟฟิศของฉัน" screen ---------- */
function officeMount(root, api) {
  root.innerHTML = `<div class="hud office-hud"><span data-k="lv"></span><span class="xpbar" title="XP"><i data-k="xp"></i></span><span data-k="xpt" class="muted"></span><span>🪙 <b data-k="coins">0</b></span>
    <span data-k="who" class="office-who"></span></div>
    <div class="office"><div class="office-room"><div class="office-tools" data-k="tools"></div><div class="room-social" data-k="social"></div></div>
    <div class="box office-side"><div class="rk-tabs" data-k="tabs"></div><div class="office-list" data-k="list"></div></div></div>`;
  const roomBox = root.querySelector('.office-room'), { cv, ctx } = g2canvas(roomBox, RCOLS * RC, RROWS * RC);
  // the canvas follows the width of the room on screen (yours, a tried-on expansion, or a coworker's)
  let RW = RCOLS;
  function fitCanvas(w) { RW = w; const dpr = Math.min(2, devicePixelRatio || 1); cv.width = w * RC * dpr; cv.style.setProperty('--ar', w / RROWS); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const at = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * RW * RC / b.width, y: (e.clientY - b.top) * RROWS * RC / b.height }; };
  roomBox.insertBefore(cv.parentNode, roomBox.firstChild);
  const q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let p = Prog.get(), tab = window.officeTab || 'shop', placing = null, moving = -1, sel = -1, hover = null, visit = window.officeVisit || null, t = 0, pops = {}; window.officeVisit = null;
  // try-before-you-buy: shop items are placed as see-through "cart" items, wall/floor styles are tried on; nothing is paid until ซื้อทั้งหมด
  let trial = [], tryStyle = {}, tryW = 0, selT = -1, movingT = -1, placingTrial = false;
  const priceOf = n => (SHOP.find(s => s[0] === n) || [, , 0])[2], stylePrice = n => (STYLES.find(s => s[0] === n) || [, 0])[1];
  const sizePrice = w => (ROOM_SIZES.find(z => z[0] === w) || [, 0])[1];
  const cartCost = () => trial.reduce((a, it) => a + priceOf(it[0]), 0) + Object.values(tryStyle).reduce((a, n) => a + stylePrice(n), 0) + (tryW ? sizePrice(tryW) : 0);
  const cartN = () => trial.length + Object.keys(tryStyle).length + (tryW ? 1 : 0);
  const allItems = () => p.room.items.concat(trial);
  const skipIdx = () => moving >= 0 ? moving : movingT >= 0 ? p.room.items.length + movingT : undefined;
  const walker = roomWalker(p.who); walker.ctx = ctx;
  const view = () => visit ? visit.room : { ...p.room, cs: caseCups(p), wall: tryStyle.wall || p.room.wall, floor: tryStyle.floor || p.room.floor, w: tryW || roomW(p.room) };
  function save() { Prog.put(p); }
  function hud() {
    p = Prog.get(); const lvTxt = `Lv ${p.lv} · ${Prog.title(p.lv)}`;
    q('lv').innerHTML = visit ? `👀 ห้องของ <b>${esc(visit.n)}</b> · Lv ${visit.lv} ${esc(visit.ti || '')}` : `<b>${lvTxt}</b>`;
    q('xp').style.width = (p.xp / needXP(p.lv) * 100) + '%'; q('xpt').textContent = `${p.xp}/${needXP(p.lv)} XP`; q('coins').textContent = fmt(p.coins);
    q('who').innerHTML = visit ? '' : MI_PEOPLE.map(w => `<button class="btn sm${w === p.who ? ' on' : ''}" data-who="${w}" title="ตัวละคร"><img class="pxi" src="assets/mi/${w}_down.png" height="24" alt="${w}"></button>`).join('');
    q('who').querySelectorAll('[data-who]').forEach(b => b.onclick = () => { p.who = b.dataset.who; walker.who = p.who; save(); hud(); });
  }
  // visitors, trophies and sticker notes for the room on screen (refetched only when the room changes)
  let socialKey = null, myStick = null;
  function social(force) {
    const el = q('social'); if (!el) return;
    loadOnline().then(O => {
      const nm = myName(), mine = nm ? O.nameKey(nm) : '', k = visit ? visit.k : mine;
      if (!k) { el.innerHTML = '<p class="muted">ตั้งชื่อเล่นที่หน้าแรก ห้องของคุณจะขึ้นให้เพื่อนมาเยี่ยมได้</p>'; socialKey = null; return; }
      if (k === socialKey && !force) return; socialKey = k;
      const own = k === mine;
      if (!own && visit) { O.visitRoom(k, nm, typeof Stats !== 'undefined' ? Stats.aid() : '').catch(() => {}); if (typeof Stats !== 'undefined') Stats.econ('visit'); }
      el.innerHTML = '<p class="muted">⏳</p>';
      return Promise.all([O.roomVisits(k, own), O.trophies(k)]).then(async ([v, tr]) => {
        if (socialKey !== k) return;
        if (own) store.set('visSeen', Date.now());
        myStick = nm && !own ? ((v.notes.find(x => x.k === O.nameKey(nm)) || {}).s || null) : null;
        const gname = g => { const G = typeof GAMES !== 'undefined' && GAMES.find(x => x.id === g); return G ? `${G.emoji} ${G.title}` : g; };
        const medal = ['', '🥇', '🥈', '🥉'];
        const season = seasonName(O.buckets().m);
        const cups = tr.length ? `<span class="muted">ลุ้นถ้วย ${season}:</span>` + tr.slice(0, 6).map(c => `<span class="soc-chip cup">${medal[c.r]} ${esc(gname(c.g))}</span>`).join('')
          : own ? `<span class="muted">ติดท็อป 3 เกมไหนก็ได้ในเดือนนี้ = ได้ถ้วยเพิ่ม</span>` : '';
        const fb = (await Fame.badges(O, k)).map(t => `<span class="soc-chip cup">${esc(t)}</span>`).join('');
        const sea = own ? `<button class="btn sm sea-btn" data-sea>🏆 ภารกิจฤดูกาล ${season} <b>${Season.done(Season.get())}/${SEASON_CH.length}</b></button>` : '';
        const notes = v.notes.slice(0, 8).map(x => { const s = stickerOf(x.s); return s ? `<span class="soc-chip note">${s[1]} ${s[2]} <small>· ${esc(x.n || '?')}</small></span>` : ''; }).join('');
        const pick = !own && visit ? (nm ? `<div class="stick-row"><span class="muted">ทิ้งโน้ตไว้:</span>${STICKERS.map(([id, e, t]) => `<button class="btn sm${id === myStick ? ' on' : ''}" data-st="${id}" title="${t}">${e} ${t}</button>`).join('')}</div>`
          : '<p class="muted">ตั้งชื่อเล่นที่หน้าแรกก่อน ถึงจะทิ้งโน้ตให้เพื่อนได้</p>') : '';
        el.innerHTML = `<div class="soc-line">${sea}${fb}<span class="soc-chip">👀 เยี่ยมชมวันนี้ <b>${v.today}</b> · 7 วัน <b>${v.week}</b></span>${cups}</div>
          ${notes ? `<div class="soc-line">${notes}</div>` : own ? '<p class="muted">ยังไม่มีใครทิ้งโน้ต · ชวนเพื่อนมาดูห้องได้จากตึกออฟฟิศ</p>' : ''}${pick}`;
        const sb = el.querySelector('[data-sea]'); if (sb) sb.onclick = () => Season.open();
        el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
          const id = b.dataset.st; O.stickRoom(k, nm, id).then(() => { if (typeof Stats !== 'undefined') Stats.econ('sticker'); api.sfx('good');
            fx.burst(RW * RC / 2, RROWS * RC / 2, { n: 16, colors: [PAL.pink, PAL.yel, '#fff'], speed: 220, grav: -60, size: 6, shape: 'star', life: .9 });
            toast(`${stickerOf(id)[1]} ทิ้งโน้ตให้ ${visit ? visit.n : ''} แล้ว`); social(true); }).catch(() => toast('ส่งไม่สำเร็จ (เน็ตหลุด?)')); });
      });
    }).catch(() => { el.innerHTML = ''; });
  }
  function tools() {
    social();
    const el = q('tools');
    if (visit) { el.innerHTML = `<button class="btn primary" data-a="like">👍 ถูกใจห้องนี้ <span data-k="likes"></span></button><button class="btn" data-a="back">🏠 กลับห้องฉัน</button>`;
      el.querySelector('[data-a=back]').onclick = () => { visit = null; tab = 'friends'; hud(); tools(); list(); };
      el.querySelector('[data-a=like]').onclick = like; loadOnline().then(O => O.likeCount(visit.k)).then(n => { const s = q('likes'); if (s) s.textContent = `(${n})`; }).catch(() => {}); return; }
    if (placing) { el.innerHTML = `<span class="muted">${placingTrial && movingT < 0 ? `แตะช่องในห้องเพื่อ<b>ลองวาง</b> ${icon(placing, 22)} — ยังไม่เสียเงิน` : `แตะช่องในห้องเพื่อวาง ${icon(placing, 22)}`}</span><button class="btn sm" data-a="cancel">ยกเลิก</button>`;
      el.querySelector('[data-a=cancel]').onclick = () => { cancelPlace(); }; return; }
    if (selT >= 0) { const it = trial[selT]; el.innerHTML = `${icon(it[0], 22, it[4])} <span>ในตะกร้า · 🪙 ${priceOf(it[0])}</span><button class="btn sm" data-a="flip">↔ กลับด้าน</button><button class="btn sm" data-a="move">✥ ย้าย</button><button class="btn sm" data-a="rm">🗑️ เอาออก</button><button class="btn sm" data-a="x">✖</button>${swatches(it)}`;
      dyeWire(el, it, false);
      el.querySelector('[data-a=flip]').onclick = () => { it[3] = it[3] ? 0 : 1; };
      el.querySelector('[data-a=move]').onclick = () => { movingT = selT; placing = it[0]; placingTrial = true; selT = -1; tools(); };
      el.querySelector('[data-a=rm]').onclick = () => { trial.splice(selT, 1); selT = -1; tools(); list(); };
      el.querySelector('[data-a=x]').onclick = () => { selT = -1; tools(); }; return; }
    if (sel >= 0) { el.innerHTML = `<b>${esc(itemLabel(p.room.items[sel][0]))}</b><button class="btn sm" data-a="flip">↔ กลับด้าน</button><button class="btn sm" data-a="move">✥ ย้าย</button><button class="btn sm" data-a="store">📦 เก็บ</button><button class="btn sm" data-a="x">✖</button>${swatches(p.room.items[sel])}`;
      dyeWire(el, p.room.items[sel], true, sel);
      el.querySelector('[data-a=flip]').onclick = () => { const it = p.room.items[sel]; it[3] = it[3] ? 0 : 1; pops[sel] = 1; save(); };
      el.querySelector('[data-a=move]').onclick = () => { moving = sel; placing = p.room.items[sel][0]; sel = -1; tools(); };
      el.querySelector('[data-a=store]').onclick = () => { const [n] = p.room.items.splice(sel, 1)[0]; p.inv[n] = (p.inv[n] || 0) + 1; sel = -1; save(); tools(); list(); };
      el.querySelector('[data-a=x]').onclick = () => { sel = -1; tools(); }; return; }
    if (cartN()) { const c = cartCost(), short = c - p.coins;
      el.innerHTML = `<span class="cart">🛒 ลองไว้ <b>${cartN()}</b> ชิ้น · รวม <b>🪙 ${fmt(c)}</b>${short > 0 ? ` <small class="bad">ขาดอีก ${fmt(short)}</small>` : ''}</span><button class="btn sm primary" data-a="buy">✅ ซื้อทั้งหมด</button><button class="btn sm" data-a="clear">🗑️ ล้างตะกร้า</button>`;
      el.querySelector('[data-a=buy]').onclick = buyCart;
      el.querySelector('[data-a=clear]').onclick = () => { trial = []; tryStyle = {}; tryW = 0; selT = -1; tools(); list(); }; return; }
    el.innerHTML = '<span class="muted">กดของในร้านเพื่อ<b>ลองวาง</b>ในห้องก่อน ถูกใจแล้วค่อยกดซื้อ · แตะของในห้องเพื่อย้าย / กลับด้าน / เก็บ</span>';
  }
  // 🎨 colour row under the tools for dyeable drawn items; it[4] = DYE index (0 = original)
  function swatches(it) {
    if (!dyeable(it[0])) return '';
    return `<div class="dye-row" role="group" aria-label="เปลี่ยนสี"><span>🎨${DYE_COST ? ` <small>🪙 ${DYE_COST}</small>` : ''}</span>${DYE.map((d, c) => `<button class="dye${(it[4] || 0) === c ? ' on' : ''}" data-dye="${c}" title="${d ? d[0] : 'สีเดิม'}" aria-label="${d ? d[0] : 'สีเดิม'}" style="background:${d ? d[2] : 'conic-gradient(#fc5c46 0 25%,#f8d239 0 50%,#61af5f 0 75%,#447bce 0)'}"></button>`).join('')}</div>`;
  }
  function dyeWire(el, it, real, i) {
    // hud() reloads p from storage, so a real item is looked up at click time and saved before the HUD refresh
    el.querySelectorAll('[data-dye]').forEach(b => b.onclick = () => { const c = +b.dataset.dye, t = real ? p.room.items[i] : it; if (!t || (t[4] || 0) === c) return;
      if (real && DYE_COST) { if (p.coins < DYE_COST) { toast(`เหรียญไม่พอ — เปลี่ยนสีใช้ 🪙 ${DYE_COST}`); return; } p.coins -= DYE_COST; typeof Stats !== 'undefined' && Stats.econ('out_dye', DYE_COST); }
      if (c) t[4] = c; else t.length = Math.min(t.length, 4);
      if (real) { pops[i] = 1; save(); hud(); } tools(); });
  }
  function buyCart() {
    const c = cartCost(); if (c > p.coins) { toast(`เหรียญไม่พอ ขาดอีก 🪙 ${fmt(c - p.coins)} — เอาบางชิ้นออก หรือไปเล่นเกมก่อน`); domShake(q('tools'), 5); return; }
    p = Prog.get(); p.coins -= c; typeof Stats !== 'undefined' && Stats.econ('out_furniture', c); Season.add('deco', trial.length); p.room.items.push(...trial.map(it => it.slice()));
    for (const [slot, n] of Object.entries(tryStyle)) { if (!p.styles.includes(n)) p.styles.push(n); p.room[slot] = n; }
    if (tryW) p.room.w = tryW;
    trial.forEach((it, i) => pops[p.room.items.length - trial.length + i] = 1);
    fx.burst(RW * RC / 2, RROWS * RC / 2, { n: 30, colors: CONFETTI, speed: 280, grav: 400, size: 5, shape: 'paper', life: .9 }); api.sfx('good');
    toast(`🛍️ ซื้อแล้ว ${cartN()} ชิ้น (−${fmt(c)} 🪙)`); trial = []; tryStyle = {}; tryW = 0; selT = -1; save(); hud(); tools(); list();
  }
  function cancelPlace() { if (placing && moving < 0 && !placingTrial) p.inv[placing] = (p.inv[placing] || 0) + 1; placing = null; moving = -1; movingT = -1; placingTrial = false; save(); tools(); list(); }
  function startPlace(n) { if (p.inv[n] > 0) { p.inv[n]--; if (!p.inv[n]) delete p.inv[n]; } placing = n; moving = -1; movingT = -1; placingTrial = false; sel = -1; selT = -1; save(); tools(); list(); }
  function startTry(n) { placing = n; placingTrial = true; moving = -1; movingT = -1; sel = -1; selT = -1; tools(); }
  const icon = (n, h = 34, c = 0) => drawnItem(n) ? `<img class="pxi" src="${itemCanvas(n, 4, caseCups(p), c).toDataURL()}" alt="" title="${esc(itemLabel(n))}" style="max-height:${h}px">`
    : `<img class="pxi" src="assets/mi/${n}.png" alt="" style="max-height:${h}px;max-width:${h * 1.6}px">`;
  function list() {
    const tabs = [['shop', '🛒 ร้านค้า'], ['inv', '📦 ของของฉัน'], ['style', '🎨 ห้อง/ผนัง'], ['friends', '👥 ห้องเพื่อน']];
    q('tabs').innerHTML = tabs.map(([k, v]) => `<button class="btn sm${k === tab ? ' on' : ''}" data-t="${k}">${v}</button>`).join('');
    q('tabs').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; list(); });
    const L = q('list');
    if (tab === 'shop') {
      const cat = store.get('shopCat', 'all'), pick = s => cat === 'all' || (cat === 'new' ? SHOP_NEW(s[0]) : catOf(s[0], s[1]) === cat);
      L.innerHTML = `<div class="shop-cats">${SHOP_CATS.map(([c, v]) => `<button class="btn sm${c === cat ? ' on' : ''}" data-cat="${c}">${v}</button>`).join('')}</div>
        <div class="shop-grid">${SHOP.filter(s => (typeof GACHA_ONLY === 'undefined' || !GACHA_ONLY.has(s[0])) && pick(s)).map(([n, k, price, lv]) => { const lock = p.lv < lv, poor = p.coins < price;
        return `<button class="shop-it${lock ? ' lock' : ''}" data-buy="${n}" ${lock ? 'disabled' : ''}>${icon(n)}<small>${lock ? `🔒 Lv ${lv}` : `🪙 ${price}`}</small>${p.inv[n] ? `<i class="cnt">${p.inv[n]}</i>` : ''}${trial.some(it => it[0] === n) ? '<i class="incart">🛒</i>' : ''}</button>`; }).join('')}</div>`;
      L.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { startTry(b.dataset.buy); api.sfx('tick'); });
      L.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { store.set('shopCat', b.dataset.cat); list(); });
    } else if (tab === 'inv') {
      const own = Object.entries(p.inv).filter(([, c]) => c > 0);
      L.innerHTML = own.length ? `<div class="shop-grid">${own.map(([n, c]) => `<button class="shop-it" data-place="${n}">${icon(n)}<small>วาง</small><i class="cnt">${c}</i></button>`).join('')}</div>`
        : '<p class="muted">ยังไม่มีของในกระเป๋า — ซื้อจากร้านค้า หรือกด 📦 เก็บ ของที่อยู่ในห้อง</p>';
      L.querySelectorAll('[data-place]').forEach(b => b.onclick = () => startPlace(b.dataset.place));
    } else if (tab === 'style') {
      const curW = roomW(p.room);
      L.innerHTML = `<h4 class="sz-h">📐 ขยายห้อง <small class="muted">ตอนนี้กว้าง ${curW} ช่อง</small></h4><div class="sz-row">${ROOM_SIZES.filter(z => z[0] > curW).map(([w, price, lv]) => { const lock = p.lv < lv, tr = tryW === w;
        return `<button class="shop-it sz${tr ? ' on' : ''}${lock ? ' lock' : ''}" data-size="${w}" ${lock ? 'disabled' : ''}><b>↔ ${w} ช่อง</b><small class="muted">🌱 ${typeof Farm !== 'undefined' ? Farm.plotsFor(w) : ''} แปลงผัก</small><small>${lock ? `🔒 Lv ${lv}` : tr ? `🛒 ลองอยู่ · 🪙 ${fmt(price)}` : `👀 🪙 ${fmt(price)}`}</small></button>`; }).join('') || '<span class="muted">ห้องใหญ่สุดแล้ว 🎉</span>'}</div>
        <h4 class="sz-h">🎨 ผนัง / พื้น</h4><div class="shop-grid">${STYLES.map(([n, price, lv]) => { const own = p.styles.includes(n), lock = p.lv < lv, on = p.room.wall === n || p.room.floor === n;
        const tr = tryStyle.wall === n || tryStyle.floor === n;
        return `<button class="shop-it style${on || tr ? ' on' : ''}${lock && !own ? ' lock' : ''}" data-style="${n}" ${lock && !own ? 'disabled' : ''}><span class="sw" style="background-image:url(assets/mi/${n}.png)"></span><small>${tr ? `🛒 ลองอยู่ · 🪙 ${price}` : on ? '✓ ใช้อยู่' : own ? 'ใช้' : lock ? `🔒 Lv ${lv}` : `👀 🪙 ${price}`}</small></button>`; }).join('')}</div>`;
      L.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { const w = +b.dataset.size; tryW = tryW === w ? 0 : w; api.sfx('tick'); tools(); list(); });
      L.querySelectorAll('[data-style]').forEach(b => b.onclick = () => {
        const [n, price] = STYLES.find(s => s[0] === b.dataset.style);
        const slot = n.startsWith('wall') ? 'wall' : 'floor';
        if (!p.styles.includes(n)) { if (tryStyle[slot] === n) delete tryStyle[slot]; else tryStyle[slot] = n; api.sfx('tick'); tools(); list(); return; }
        delete tryStyle[slot]; p.room[slot] = n; fx.burst(RW * RC / 2, n.startsWith('wall') ? RC : RROWS * RC / 2, { n: 24, colors: CONFETTI, speed: 260, grav: 400, size: 5, shape: 'paper', life: .8 });
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
    loadOnline().then(O => O.likeMonth(visit.k, nm).then(() => O.like(visit.k, nm)).then(first => { if (first && typeof Awards !== 'undefined') Awards.add('like', 1, visit.n); if (first) Season.add('like'); return O.likeCount(visit.k); })).then(n => { const s = q('likes'); if (s) s.textContent = `(${n})`; toast('👍 ส่งกำลังใจแล้ว!'); }).catch(() => {});
    for (let i = 0; i < 6; i++) fx.burst(RW * RC / 2, RROWS * RC / 2, { n: 3, colors: [PAL.pink, '#fff'], speed: 220, grav: -60, size: 7, shape: 'star', life: 1 });
    api.sfx('good');
  }
  const cellAt = e => { const m = at(e); return { x: Math.floor(m.x / RC), y: Math.floor(m.y / RC) }; };
  cv.addEventListener('pointermove', e => { hover = cellAt(e); });
  cv.addEventListener('pointerleave', () => { hover = null; });
  cv.addEventListener('pointerdown', e => {
    if (visit) { const c = cellAt(e), it = [...visit.room.items].reverse().find(([n, x, y]) => drawnItem(n) && c.x >= x && c.x < x + cellsW(n) && c.y >= y - 1 && c.y <= y);
      if (it) toast(it[0] === 'cupcase' ? ((visit.room.cs || []).map(n => itemLabel(n).split(' · ')[0]).join(' · ') || 'ตู้ยังว่างอยู่') : itemLabel(it[0])); return; }
    const c = cellAt(e); hover = c;
    if (placing) {
      const k = SHOP_KIND[placing] || 'f', w = cellsW(placing), x = Math.max(0, Math.min(RW - w, c.x - Math.floor((w - 1) / 2))), y = k === 'w' ? 0 : c.y;
      if (!roomFits({ w: view().w, items: allItems() }, placing, x, y, skipIdx())) { fx.shake(3, .12); api.sfx('bad'); return; }
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
    const room = view(), extra = []; if (roomW(room) !== RW) fitCanvas(roomW(room));
    fx.pre(ctx);
    if (!visit) extra.push(walker.item(t));
    if (placing && hover) {
      const k = SHOP_KIND[placing] || 'f', w = cellsW(placing), x = Math.max(0, Math.min(RW - w, hover.x - Math.floor((w - 1) / 2))), y = k === 'w' ? 0 : hover.y, ok = roomFits({ w: view().w, items: allItems() }, placing, x, y, skipIdx());
      extra.push({ y: (k === 'w' ? 0 : y + 1) + .02, d: () => {
        ctx.fillStyle = ok ? 'rgba(33,192,122,.35)' : 'rgba(226,48,48,.35)'; ctx.fillRect(x * RC, (k === 'w' ? 0 : y) * RC, w * RC, (k === 'w' ? RTOP : 1) * RC);
        drawPixAt(ctx, itemImg(placing, view(), moving >= 0 ? p.room.items[moving][4] : movingT >= 0 ? trial[movingT][4] : 0), (x + w / 2) * RC, k === 'w' ? RTOP * RC - 6 : (y + 1) * RC, 2, { alpha: .75 }); } });
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
    fx.post(ctx, RW * RC, RROWS * RC);
  }
  api.loop(dt => { const d = fx.step(dt); t += dt; for (const i in pops) { pops[i] -= dt * 4; if (pops[i] <= 0) delete pops[i]; } if (!visit) walker.step(p.room, d); draw(); });
  // likes on my room turn into coins (5 each), claimed when I open the office
  const nm = myName();
  if (nm) loadOnline().then(O => O.likeCount(O.nameKey(nm))).then(n => { const pp = Prog.get(), fresh = n - (pp.likesClaimed || 0);
    if (fresh > 0) { pp.likesClaimed = n; store.set('prog', pp); Prog.give(5 * fresh, 0, 'like'); toast(`👍 มีคนถูกใจห้องคุณ ${fresh} ครั้ง! +${5 * fresh} 🪙`); hud(); list(); } }).catch(() => {});
  Prog.sync(); hud(); tools(); list();
  return { destroy() { if (cartN()) toast('🛒 ของที่ลองไว้ยังไม่ได้ซื้อ — ตะกร้าถูกล้างแล้ว'); Prog.sync(); } };
}
