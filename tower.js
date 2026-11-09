// "ตึกออฟฟิศ" — the home page's second view: one pixel tower holding everyone's decorated room.
//  - every coworker with a profile (rooms/_prof) gets an apartment; higher level = higher floor, a bigger room = a wider apartment
//  - people online right now walk around inside their room (lights on at night), the lobby shows who is in ห้องรวม
//  - the office level adds shared floors on top (canteen, library, …) and a crane builds the next one
//  - ลิฟต์ (left panel) = floor menu with what waits on each floor; door signs are HTML over the canvas so names stay readable;
//    tapping a room opens a knock-on-door card (water / like / enter) without leaving the building
// Classic script after office.js / wardrobe.js / hubroom.js (uses drawRoom, roomW, drawChar, drawAcc, txt, rrect, HubRoom).
'use strict';
const Tower = (() => {
  const CW = 16, FH = 144, PLATE = 20, SLAB = 12, FLOOR = FH + PLATE + SLAB, IW = 800, SIDE = 26, BW = IW + SIDE * 2, W = 960, BX = (W - BW) / 2;
  const ROOF = 150, LOBBY = 180, GROUND = 46, TOPM = 20, GAP = 8;
  // shared floors the office unlocks: [office level, name, room drawn with the office kit (50 columns = the full width)]
  const SPECIAL = [
    [2, '🍱 โรงอาหาร', { wall: 'wall_yellow', floor: 'floor_grey', items: [['table_wood', 4, 6], ['table_wood', 12, 6], ['table_wood', 20, 6], ['fridge_wide', 30, 3], ['cans', 34, 3], ['shop_shelf', 38, 3], ['cabinet_plates', 44, 3], ['window_big', 8, 0], ['window_big', 24, 0], ['pic_fish', 16, 0], ['plant_pot', 47, 8], ['fruit_basket', 28, 8], ['pizza', 8, 8]] }],
    [4, '📚 ห้องสมุด', { wall: 'wall_wood', floor: 'floor_carpet', items: [['bookshelf', 2, 3], ['bookshelf', 5, 3], ['bookshelf', 8, 3], ['bookshelf', 40, 3], ['bookshelf', 43, 3], ['desk_book', 16, 6], ['desk_book', 24, 6], ['chair_back', 17, 7], ['chair_back', 25, 7], ['armchair_wood', 32, 6], ['lamp_beige', 34, 6], ['globe', 30, 6], ['world_map', 20, 0], ['plant_pot', 47, 8], ['rug_green', 31, 7]] }],
    [6, '🎤 คาราโอเกะ', { wall: 'wall_pink', floor: 'floor_dwood', items: [['tv', 22, 0], ['sofa_red', 14, 7], ['sofa_red', 28, 7], ['sofa_white', 21, 8], ['floorlamp_red', 10, 5], ['floorlamp_blue', 36, 5], ['rug_lblue', 22, 6], ['pic_monster', 6, 0], ['pic_robot', 40, 0], ['cake_straw', 25, 6], ['cans', 44, 4]] }],
    [8, '🌿 สวนลอยฟ้า', { wall: 'wall_mint', floor: 'floor_teal', items: [['palm', 3, 6], ['tree', 9, 7], ['palm', 16, 5], ['bench_pink', 22, 7], ['bench_cream', 28, 7], ['tree', 35, 6], ['palm', 41, 7], ['plant_pot', 47, 8], ['shelf_plant', 12, 3], ['shelf_plant', 32, 3], ['window_slide', 24, 0], ['fruit_grape', 26, 8]] }],
    [10, '🎮 ห้องเกม', { wall: 'wall_grey', floor: 'floor_rwood', items: [['pc_desk', 4, 5], ['pc_desk', 10, 5], ['pc_desk', 16, 5], ['chair_red', 5, 6], ['chair_red', 11, 6], ['chair_red', 17, 6], ['tv', 28, 0], ['sofa_grey', 26, 7], ['blackboard', 40, 0], ['globe_gold', 36, 7], ['floorlamp_white', 44, 6], ['rug_blue', 28, 6]] }],
  ];
  let el = null, cv, ctx, wrap, O = null, profiles = null, people = [], t = 0, last = 0, started = false, zoom = 1, H = 600, regions = [], hover = null, loadedAt = 0, farms = {}, waters = {};
  let clipN = 0, signsEl, elevEl, cardEl, signs = [], floorsY = [], signSig = '', elevSig = '', card = null, rooms = [];
  const NEW_MS = 2 * 864e5;
  const cache = {};                               // room thumbnails: key → { c: canvas, sig, ok }
  const lc = s => String(s || '').trim().toLowerCase();
  // farm balcony under each apartment (farm.js may load later, so read its height lazily)
  const BAL = () => typeof Farm !== 'undefined' && Farm.BALCONY_H || 24, AFLOOR = () => FLOOR + BAL();
  const key = n => O && O.nameKey ? O.nameKey(n) : (n || '').trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_').slice(0, 24) || '_';
  const visible = () => el && el.isConnected && !el.hidden && !document.getElementById('hub').hidden;

  /* ---------- layout ---------- */
  function layout() {
    const off = typeof HubRoom !== 'undefined' && HubRoom.officeNow ? HubRoom.officeNow() : { lv: 1, pts: 0, from: 0, to: 500 };
    const L = (profiles || []).slice().sort((a, b) => (b.lv | 0) - (a.lv | 0) || (b.t || 0) - (a.t || 0));
    // pack apartments into floors, highest levels first (they get the top)
    const floors = []; let cur = [], used = 0;
    for (const r of L) { const w = Math.min(22, Math.max(12, r.room.w | 0 || 12)) * CW; if (cur.length && used + w > IW) { floors.push(cur); cur = []; used = 0; } cur.push({ r, w }); used += w + GAP; }
    if (cur.length) floors.push(cur);
    if (!floors.length) floors.push([]);
    const specials = SPECIAL.filter(s => off.lv >= s[0]), next = SPECIAL.find(s => off.lv < s[0]);
    return { off, floors, specials: specials.slice().reverse(), next };
  }
  function size(Lo) { return TOPM + ROOF + Lo.specials.length * FLOOR + Lo.floors.length * AFLOOR() + LOBBY + GROUND; }

  /* ---------- room thumbnails (drawn once with the office kit, redrawn until every sprite has loaded) ---------- */
  function thumb(key, room, cols) {
    const sig = JSON.stringify([room.wall, room.floor, room.items, cols]);
    let c = cache[key];
    if (c && c.sig === sig && c.ok) return c.c;
    if (c && c.sig === sig && performance.now() - c.at < 500) return c.c;
    if (!c || c.sig !== sig) c = cache[key] = { c: document.createElement('canvas'), sig, ok: false, at: 0 };
    c.c.width = cols * 32; c.c.height = 288; c.at = performance.now();
    const x = c.c.getContext('2d'); x.clearRect(0, 0, c.c.width, 288);
    drawRoom(x, { ...room, w: cols });
    c.ok = [room.wall, room.floor, ...room.items.map(i => i[0]).filter(n => !drawnItem(n))].every(n => { const im = pix(n); return im.complete && im.naturalWidth; });
    return c.c;
  }

  /* ---------- drawing ---------- */
  const hour = () => new Date().getHours() + new Date().getMinutes() / 60;
  const night = () => { const h = hour(); return h < 6 || h >= 18.5; };
  function sky() {
    const h = hour(), g = ctx.createLinearGradient(0, 0, 0, H);
    if (h >= 6 && h < 16.5) { g.addColorStop(0, '#7cc4ff'); g.addColorStop(1, '#d9f0ff'); }
    else if (h >= 16.5 && h < 18.5) { g.addColorStop(0, '#ff9a6b'); g.addColorStop(.6, '#ffd59a'); g.addColorStop(1, '#ffe9c7'); }
    else { g.addColorStop(0, '#141b3d'); g.addColorStop(1, '#2d3466'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (night()) { ctx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { const x = (i * 97) % W, y = (i * 53) % (H * .7); ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t + i)); ctx.fillRect(x, y, 2, 2); } ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6cf'; ctx.beginPath(); ctx.arc(W - 70, 70, 22, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = h >= 16.5 ? '#ffcf5c' : '#fff3a6'; ctx.beginPath(); ctx.arc(70, 70, 26, 0, 7); ctx.fill(); }
    // clouds drifting by
    ctx.fillStyle = night() ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.85)';
    for (let i = 0; i < 6; i++) { const x = ((i * 190 + t * (8 + i * 2)) % (W + 200)) - 100, y = 40 + (i * 137) % Math.max(100, H - 300);
      ctx.beginPath(); ctx.ellipse(x, y, 40, 12, 0, 0, 7); ctx.ellipse(x + 26, y - 8, 26, 12, 0, 0, 7); ctx.ellipse(x - 24, y - 4, 22, 10, 0, 0, 7); ctx.fill(); }
  }
  function brick(x, y, w, h) {                    // facade strip
    ctx.fillStyle = '#c98f6b'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(90,50,30,.18)'; for (let yy = y + 6; yy < y + h; yy += 8) { ctx.fillRect(x, yy, w, 1); for (let xx = x + ((yy / 8) % 2 ? 0 : 7); xx < x + w; xx += 14) ctx.fillRect(xx, yy - 7, 1, 7); }
  }
  function roof(y, Lo) {
    const { off, next } = Lo;
    // parapet + water tank + flag
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(BX - 6, y + ROOF - 16, BW + 12, 16); ctx.fillStyle = '#6d4c41'; ctx.fillRect(BX - 6, y + ROOF - 16, BW + 12, 3);
    ctx.fillStyle = '#9aa3b5'; ctx.fillRect(BX + 30, y + ROOF - 66, 46, 50); ctx.fillStyle = '#7a8396'; ctx.fillRect(BX + 30, y + ROOF - 70, 46, 6); ctx.fillRect(BX + 36, y + ROOF - 16, 4, 0);
    ctx.fillStyle = '#5a4636'; ctx.fillRect(BX + 100, y + ROOF - 96, 3, 80); ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.moveTo(BX + 103, y + ROOF - 96); ctx.lineTo(BX + 103 + 26 + Math.sin(t * 4) * 3, y + ROOF - 88); ctx.lineTo(BX + 103, y + ROOF - 80); ctx.fill();
    // sign board
    const sx = W / 2 - 80, sy = y + ROOF - 70; rrect(ctx, sx - 170, sy - 28, 340, 48, 10, '#2b2140', '#ffd23f');
    ctx.save(); if (night()) { ctx.shadowColor = '#ff5c8a'; ctx.shadowBlur = 12; } txt(ctx, `🏢 ห้องพักสมอง · ออฟฟิศ Lv ${off.lv}`, sx, sy - 4, 20, night() ? '#ffd1e0' : '#ffd23f', 'center', 800); ctx.restore();
    ctx.fillStyle = '#2b2140'; ctx.fillRect(sx - 120, sy + 20, 4, 30); ctx.fillRect(sx + 116, sy + 20, 4, 30);
    // ฟาร์มดาดฟ้า: my own beds along the parapet
    if (typeof Farm !== 'undefined') { const f = Farm.get(), n = Farm.n(f), gx = BX + 130, gw = 330, gy = y + ROOF - 16 - Farm.BALCONY_H, rp = Farm.ready(f);
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(gx - 4, gy + 6, gw + 8, Farm.BALCONY_H - 6);
      Farm.drawBalcony(ctx, { n, plots: f.plots || [] }, gx, gy, gw, Date.now(), t);
      regions.push({ x: gx - 4, y: gy - 20, w: gw + 8, h: Farm.BALCONY_H + 20, kind: 'garden', tip: `🌱 ฟาร์มดาดฟ้าของคุณ${rp ? ` · สุกแล้ว ${rp} ต้น` : ''} — กดเพื่อไปฟาร์ม` });
      signs.push({ x: gx + 60, y: y + ROOF - 8, w: gw - 120, cls: 'roof-s', act: 'garden', html: `🌱 ฟาร์มของฉัน${rp ? ` <em>🧺 สุก ${rp}</em>` : ''}` }); }
    // crane building the next shared floor
    const cx = BX + BW - 90, base = y + ROOF - 16, pc = Math.max(0, Math.min(1, (off.pts - off.from) / Math.max(1, off.to - off.from)));
    ctx.fillStyle = '#ffb000'; for (let yy = base - 120; yy < base; yy += 12) { ctx.fillRect(cx, yy, 3, 12); ctx.fillRect(cx + 12, yy, 3, 12); ctx.fillRect(cx, yy, 15, 2); }
    ctx.fillRect(cx - 120, base - 124, 170, 5); ctx.fillStyle = '#2b2140'; ctx.fillRect(cx + 34, base - 122, 14, 12);
    const hx = cx - 90 + Math.sin(t * .6) * 12, hy = base - 70 + Math.sin(t * 1.3) * 4; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, base - 119); ctx.lineTo(hx, hy); ctx.stroke();
    drawPixAt(ctx, 'crate', hx, hy + 22, 1.6);
    if (next) { rrect(ctx, cx - 210, base - 44, 150, 30, 8, 'rgba(255,255,255,.92)', '#2b2140'); txt(ctx, `🏗️ ${next[1]}`, cx - 135, base - 34, 11, '#2b2140', 'center', 700);
      rrect(ctx, cx - 200, base - 26, 130, 7, 3, '#e6dccb'); rrect(ctx, cx - 200, base - 26, 130 * pc, 7, 3, '#21c07a');
      regions.push({ x: cx - 210, y: base - 124, w: 270, h: 110, kind: 'crane', tip: `กำลังสร้าง ${next[1]} · ${Math.round(pc * 100)}% (ถึงออฟฟิศ Lv ${next[0]})` }); }
  }
  function floorFrame(y, fh = FLOOR) {
    brick(BX, y, SIDE, fh); brick(BX + BW - SIDE, y, SIDE, fh);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(BX, y + fh - SLAB, BW, SLAB); ctx.fillStyle = '#6d4c41'; ctx.fillRect(BX, y + fh - SLAB, BW, 2);
  }
  function special(y, s) {
    floorFrame(y); floorsY.push({ y, h: FLOOR, b: 'S', name: s[1], s: [] }); const c = thumb('sp' + s[0], s[2], 50);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(c, BX + SIDE, y, IW, FH);
    if (night()) { ctx.fillStyle = 'rgba(255,214,120,.10)'; ctx.fillRect(BX + SIDE, y, IW, FH); }
    ctx.fillStyle = '#2b2140'; ctx.fillRect(BX + SIDE, y + FH, IW, PLATE); txt(ctx, `${s[1]} · ชั้นส่วนกลาง (ได้ตอนออฟฟิศ Lv ${s[0]})`, W / 2, y + FH + PLATE / 2, 12, '#ffd23f', 'center', 700);
    regions.push({ x: BX + SIDE, y, w: IW, h: FH + PLATE, kind: 'special', tip: `${s[1]} — ชั้นส่วนกลางของทุกคน ปลดล็อกจากออฟฟิศเลเวล` });
  }
  function apartments(y, row, fi, last) {
    const bh = BAL(), now = Date.now(); floorFrame(y, AFLOOR()); const fl = { y, h: AFLOOR(), b: fi, s: [] }; floorsY.push(fl);
    ctx.fillStyle = '#efe4d2'; ctx.fillRect(BX + SIDE, y, IW, FH + PLATE + bh);  // corridor wall behind / between the units
    const me = lc(myName()), on = {}; for (const p of people) on[lc(p.n)] = p;
    let x = BX + SIDE;
    row.forEach(({ r, w }, i) => {
      const cols = w / CW, c = thumb('p' + r.k, r.room, cols), p = on[lc(r.n)], mine = lc(r.n) === me;
      ctx.imageSmoothingEnabled = false; ctx.drawImage(c, x, y, w, FH);
      if (night() && !p) { ctx.fillStyle = 'rgba(12,14,40,.58)'; ctx.fillRect(x, y, w, FH); }
      else if (p) { ctx.fillStyle = 'rgba(255,224,130,.10)'; ctx.fillRect(x, y, w, FH); }
      // the owner walks around while they are online
      if (p) { const ph = t * .45 + i * 1.7, s = Math.sin(ph), vx = Math.cos(ph), px = x + 20 + (s * .5 + .5) * (w - 40), py = y + FH - 14, who = MI_PEOPLE.includes(p.a) ? p.a : (MI_PEOPLE.includes(r.who) ? r.who : 'adam');
        const an = Math.abs(vx) > .25 ? 'run' : 'idle_anim', dr = an === 'run' ? (vx > 0 ? 'right' : 'left') : 'down';
        drawChar(ctx, who, an, dr, t + i, px, py, 1.5); for (const sl of ['f', 'h']) drawAcc(ctx, p[sl], who, an, dr, t + i, px, py, 1.5);
        if (p.g && p.g !== 'hub') { rrect(ctx, px - 14, py - 64, 28, 18, 6, '#fff', '#2b2140'); txt(ctx, '🎮', px, py - 55, 11); } }
      const sel = card && card.r.k === r.k; ctx.strokeStyle = sel ? '#ff5c8a' : mine ? '#ffd23f' : '#5d4037'; ctx.lineWidth = sel || mine ? 4 : 2; ctx.strokeRect(x + 1, y + 1, w - 2, FH - 2);
      // name plate
      ctx.fillStyle = mine ? '#ffd23f' : '#2b2140'; ctx.fillRect(x, y + FH, w, PLATE);
      const bdg = r.b && typeof badgeEmoji === 'function' ? badgeEmoji(r.b) + ' ' : '', aw = typeof Awards !== 'undefined' ? Awards.badge(r.k) : '';
      const fk = r.k || key(r.n), nw = mine || typeof Farm === 'undefined' ? 0 : Farm.waterable(farms[fk], waters[fk], key(myName()), now).length, isNew = !mine && r.rt && now - r.rt < NEW_MS;
      const info = { r, fk, p, mine, nw, isNew, x, y, w }; rooms.push(info); fl.s.push(info);
      regions.push({ x, y, w, h: FH + PLATE, kind: 'room', r, tip: `${r.n} · Lv ${r.lv | 0} ${r.ti || ''}${p ? ' · ออนไลน์อยู่' : ''}${aw ? ' · 🏅 ' + Awards.tip(r.k) : ''} — กดเพื่อเคาะประตู` });
      signs.push({ x: x + 4, y: y + FH - 6, w: w - 8, cls: 'door-s' + (mine ? ' mine' : '') + (sel ? ' sel' : ''), act: 'room:' + r.k,
        html: `${p ? '<i class="on" title="ออนไลน์"></i>' : ''}<b>${mine ? '⭐ ' : ''}${bdg}${esc(r.n)}${mine ? ' (คุณ)' : ''}</b><small>${p && p.g && p.g !== 'hub' ? '🎮 เล่นอยู่' : 'Lv ' + (r.lv | 0)}</small>`
          + `<span class="stk">${isNew ? '<em class="new">ใหม่!</em>' : ''}${nw ? `<em class="wat">💧${nw}</em>` : ''}${aw ? `<em>🏅${aw}</em>` : ''}</span>` });
      // farm balcony hangs under the name plate, exactly the apartment's width; no farm row yet = empty pots
      if (typeof Farm !== 'undefined') { const fr = farms[fk] || null, by = y + FH + PLATE;
        Farm.drawBalcony(ctx, fr, x, by, w, now, t);
        regions.push({ x, y: by, w, h: bh, kind: 'balcony', r, k: fk, tip: `${r.n} · ${Farm.balconyInfo(fr, now)} — กดเพื่อไปที่ฟาร์ม` }); }
      x += w + GAP;
    });
    // the rest of the floor: the bottom floor keeps one vacant unit for newcomers, every other gap becomes a shared corner
    const left = BX + SIDE + IW - x; if (left > 60) {
      if (last && (left >= 12 * CW || !row.length)) { const vw = row.length ? Math.min(left, 12 * CW) : left; vacant(x, y, vw, row.length); x += vw + GAP; }
      const rest = BX + SIDE + IW - x; if (rest > 60) nook(x, y, rest, fi);
    }
  }
  function vacant(x, y, w, any) {
    ctx.fillStyle = '#d9cdbb'; ctx.fillRect(x, y, w, FH); ctx.strokeStyle = '#b9ab95'; ctx.setLineDash([6, 5]); ctx.strokeRect(x + 4, y + 4, w - 8, FH - 8); ctx.setLineDash([]);
    txt(ctx, any ? 'ห้องว่าง · รอเพื่อนใหม่' : 'ยังไม่มีใครย้ายเข้า — ตั้งชื่อเล่นแล้วเล่นสักเกม', x + w / 2, y + FH / 2, 12, '#8a7c66', 'center', 600);
  }
  // shared corners (drawn with the office kit) fill the space the apartments leave on a floor
  const NOOKS = [
    ['☕ มุมพักดื่มน้ำ', 'wall_yellow', 'floor_wood', [['fridge_wide', 3], ['cans', 6], ['plant_pot', 8], ['cabinet_plates', 3]], ['pic_fish', 0]],
    ['🛋️ มุมโซฟา', 'wall_pink', 'floor_carpet', [['sofa_red', 7], ['floorlamp_white', 5], ['plant_pot', 8], ['shelf_plant', 3]], ['window_big', 0]],
    ['📚 มุมอ่านหนังสือ', 'wall_wood', 'floor_dwood', [['bookshelf', 3], ['armchair_wood', 6], ['lamp_beige', 6], ['plant_pot', 8]], ['window_big', 0]],
    ['🌿 มุมต้นไม้', 'wall_mint', 'floor_teal', [['shelf_plant', 3], ['bench_cream', 7], ['plant_pot', 8], ['plant_pot', 8]], ['window_big', 0]],
  ];
  function nook(x, y, w, fi) {
    const cols = Math.floor(w / CW), N = NOOKS[fi % NOOKS.length], items = [];
    let cx = 1; const [wn, wy] = N[4], ww = cellsW(wn); if (ww + 2 <= cols) items.push([wn, Math.floor((cols - ww) / 2), wy]);
    for (const [n, iy] of N[3]) { const iw = cellsW(n); if (cx + iw > cols - 1) break; items.push([n, cx, iy]); cx += iw + 1; }
    const c = thumb('nook' + fi + ':' + cols, { wall: N[1], floor: N[2], items }, cols);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(c, x, y, cols * CW, FH);
    if (night()) { ctx.fillStyle = 'rgba(12,14,40,.45)'; ctx.fillRect(x, y, cols * CW, FH); }
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cols * CW - 2, FH - 2);
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(x, y + FH, cols * CW, PLATE); txt(ctx, N[0], x + cols * CW / 2, y + FH + PLATE / 2, 11, '#ffe9c7', 'center', 700);
    // planter box where the apartments have their farm balcony
    const by = y + FH + PLATE, bh = BAL(); ctx.fillStyle = '#8a93a3'; ctx.fillRect(x, by + bh - 6, cols * CW, 6); ctx.fillStyle = '#a5683f'; ctx.fillRect(x + 4, by + bh - 16, cols * CW - 8, 10);
    ctx.fillStyle = '#3f9e4a'; for (let px = x + 8; px < x + cols * CW - 8; px += 10) { ctx.beginPath(); ctx.arc(px, by + bh - 17, 6, Math.PI, 0); ctx.fill(); }
    regions.push({ x, y, w: cols * CW, h: FH + PLATE, kind: 'nook', tip: `${N[0]} — มุมส่วนกลางของชั้นนี้ ใช้ร่วมกันทุกห้อง` });
  }
  function lobby(y, n) {
    brick(BX, y, BW, LOBBY);
    // glass front with reflections, a double door and the sign
    const gx = BX + 40, gw = BW - 80, gy = y + 46, gh = LOBBY - 60;
    ctx.fillStyle = night() ? '#ffe7a8' : '#bfe6ff'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); const x0 = gx + 40 + i * 140; ctx.moveTo(x0, gy); ctx.lineTo(x0 + 30, gy); ctx.lineTo(x0 - 10, gy + gh); ctx.lineTo(x0 - 40, gy + gh); ctx.fill(); }
    ctx.fillStyle = '#5d4037'; for (let x = gx; x <= gx + gw; x += gw / 6) ctx.fillRect(x - 2, gy, 4, gh); ctx.fillRect(gx, gy - 4, gw, 6);
    const dx = W / 2; ctx.fillStyle = '#3a2a20'; ctx.fillRect(dx - 44, gy + 20, 88, gh - 20); ctx.fillStyle = night() ? '#ffd27a' : '#e2f3ff'; ctx.fillRect(dx - 40, gy + 24, 38, gh - 24); ctx.fillRect(dx + 2, gy + 24, 38, gh - 24);
    // people hanging out in ห้องรวม, drawn in front of the glass
    const inHub = people.filter(p => p.g === 'hub').slice(0, 10);
    inHub.forEach((p, i) => { const ph = t * .3 + i * 2.3, px = gx + 60 + ((Math.sin(ph) * .5 + .5) * (gw - 120) + i * 67) % (gw - 120), who = MI_PEOPLE.includes(p.a) ? p.a : 'adam', dr = Math.cos(ph) > 0 ? 'right' : 'left';
      drawChar(ctx, who, 'run', dr, t + i, px, y + LOBBY - 6, 2); for (const sl of ['f', 'h']) drawAcc(ctx, p[sl], who, 'run', dr, t + i, px, y + LOBBY - 6, 2); });
    regions.push({ x: BX, y, w: BW, h: LOBBY, kind: 'lobby', tip: 'ห้องรวม — กดเพื่อเข้าไปเดินเล่นและคุยกับเพื่อน' });
    floorsY.push({ y, h: LOBBY, b: 'G', name: 'ล็อบบี้', s: [] });
    // 📌 notice board (weekly awards + news) on the left, 🛎️ counter (missions / pass) on the right
    const bx = gx + 24, by = gy + 16, bw = 190, bh = 80;
    rrect(ctx, bx - 5, by - 5, bw + 10, bh + 10, 6, '#6d4c41'); ctx.fillStyle = '#d9a86c'; ctx.fillRect(bx, by, bw, bh);
    [['#fff8c4', 12, 8, -.06], ['#ffd6e4', 74, 14, .05], ['#cdeeff', 136, 6, -.03], ['#d8f7d0', 40, 44, .04], ['#fff', 110, 46, -.05]].forEach(([c, ox, oy, a]) => {
      ctx.save(); ctx.translate(bx + ox + 22, by + oy + 14); ctx.rotate(a); ctx.fillStyle = c; ctx.fillRect(-22, -14, 44, 28); ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let l = -6; l <= 6; l += 6) ctx.fillRect(-15, l, 30, 2);
      ctx.fillStyle = '#ff5c8a'; ctx.beginPath(); ctx.arc(0, -12, 3, 0, 7); ctx.fill(); ctx.restore(); });
    regions.push({ x: bx - 5, y: by - 5, w: bw + 10, h: bh + 30, kind: 'board', tip: '📌 บอร์ดประกาศ — รางวัลออฟฟิศประจำสัปดาห์และความเคลื่อนไหว' });
    signs.push({ x: bx, y: by + bh + 2, w: bw, cls: 'lob-s', act: 'board', html: '📌 บอร์ดประกาศ' });
    const kx = gx + gw - 224, ky = y + LOBBY - 56, kw = 200;
    ctx.fillStyle = '#8d5a3b'; ctx.fillRect(kx, ky, kw, 50); ctx.fillStyle = '#b07a4f'; ctx.fillRect(kx - 6, ky - 8, kw + 12, 10); ctx.fillStyle = '#6d4c41'; ctx.fillRect(kx, ky + 44, kw, 6);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(kx + kw - 34, ky - 8, 9, Math.PI, 0); ctx.fill(); ctx.fillRect(kx + kw - 45, ky - 9, 22, 3); ctx.fillRect(kx + kw - 35, ky - 21, 2, 4);
    regions.push({ x: kx - 6, y: ky - 28, w: kw + 12, h: 80, kind: 'counter', tip: '🛎️ เคาน์เตอร์ — ภารกิจวันนี้และ Season Pass' });
    signs.push({ x: kx + 10, y: ky + 12, w: kw - 20, cls: 'lob-s', act: 'counter', html: '🛎️ ภารกิจ · Pass' });
    signs.push({ x: dx - 140, y: y + 24, w: 280, cls: 'lob-s door', act: 'lobby', html: `🎉 ห้องรวม · ${n ? `<b>${n}</b> คนอยู่ตอนนี้` : 'ยังว่างอยู่'} · เข้าไปเลย` });
  }
  function draw() {
    const Lo = layout(), h = size(Lo); if (h !== H) { H = h; fit(); }
    regions = []; signs = []; floorsY = []; rooms = []; ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    sky();
    let y = TOPM; roof(y, Lo); y += ROOF;
    for (const s of Lo.specials) { special(y, s); y += FLOOR; }
    Lo.floors.forEach((row, i) => { apartments(y, row, i, i === Lo.floors.length - 1); y += AFLOOR(); });
    lobby(y, people.filter(p => p.g === 'hub').length); y += LOBBY;
    ctx.fillStyle = night() ? '#2f4a2a' : '#7cc46a'; ctx.fillRect(0, y, W, GROUND); ctx.fillStyle = '#6b6f7a'; ctx.fillRect(0, y + 14, W, 18);
    ctx.fillStyle = '#fff'; for (let x = (t * 20) % 60 - 60; x < W; x += 60) ctx.fillRect(x, y + 22, 30, 2);
    if (profiles == null) { rrect(ctx, W / 2 - 110, H / 2 - 20, 220, 40, 10, '#fff', '#2b2140'); txt(ctx, '⏳ กำลังโหลดตึก…', W / 2, H / 2, 15); }
    if (hover) { const r = regions.find(g => g.kind === hover.kind && (g.r ? g.r === hover.r : true)); if (r) { ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 3; ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); } }
    paintSigns(); paintElev(Lo);
  }

  /* ---------- HTML layers: door signs over the canvas + the elevator panel (rebuilt only when something changed) ---------- */
  const pc = (v, of) => (v / of * 100).toFixed(3) + '%';
  function paintSigns() {
    const sig = H + '|' + signs.map(g => g.cls + g.html + g.x + ',' + g.y).join('|'); if (sig === signSig) return; signSig = sig;
    requestAnimationFrame(clipSigns);
    signsEl.innerHTML = signs.map((g, i) => `<button type="button" class="${g.cls}" data-s="${i}" style="left:${pc(g.x, W)};top:${pc(g.y, H)};width:${pc(g.w, W)}"><span class="ds">${g.html}</span></button>`).join('');
  }
  function elevRows(Lo) {
    const rows = [], f = typeof Farm !== 'undefined' ? Farm.get() : null, rp = f ? Farm.ready(f) : 0, hub = people.filter(p => p.g === 'hub').length;
    rows.push({ b: 'R', name: 'ดาดฟ้า · ฟาร์ม', y: 0, bd: [rp ? `🧺${rp}` : ''] });
    let n = Lo.specials.length + Lo.floors.length + 1;
    for (const fl of floorsY) {
      if (fl.b === 'G') { rows.push({ b: 'G', name: 'ล็อบบี้', y: fl.y, bd: [hub ? `🟢${hub}` : ''] }); continue; }
      const lab = fl.b === 'S' ? fl.name : fl.s.length ? fl.s.slice(0, 2).map(r => r.mine ? 'คุณ' : r.r.n).join(' · ') + (fl.s.length > 2 ? ' ·…' : '') : 'ห้องว่าง';
      const w = fl.s.reduce((a, r) => a + r.nw, 0), nw = fl.s.filter(r => r.isNew).length, onl = fl.s.filter(r => r.p).length;
      rows.push({ b: String(n--), name: lab, y: fl.y, mine: fl.s.some(r => r.mine), bd: [w ? `💧${w}` : '', nw ? `✨${nw}` : '', onl ? `🟢${onl}` : ''] });
    }
    return rows;
  }
  function paintElev(Lo) {
    const rows = elevRows(Lo), wr = rooms.filter(r => r.nw > 0).length, news = rooms.filter(r => r.isNew).length;
    const sig = JSON.stringify(rows) + wr + ',' + news; if (sig === elevSig) return; elevSig = sig;
    elevEl.querySelector('.elev-fl').innerHTML = rows.map(r => `<button type="button" class="fb${r.mine ? ' mine' : ''}" data-y="${r.y}"><b>${r.b}</b><span>${esc(r.name)}</span><small>${r.bd.filter(Boolean).join(' ')}</small></button>`).join('');
    const w = elevEl.querySelector('[data-go=water]'), n = elevEl.querySelector('[data-go=new]');
    w.disabled = !wr; w.innerHTML = wr ? `💧 ไปห้องที่รอรดน้ำ <b>${wr}</b>` : '💧 รดน้ำครบทุกห้องแล้ว';
    n.disabled = !news; n.innerHTML = news ? `✨ ห้องแต่งใหม่ <b>${news}</b>` : '✨ ยังไม่มีห้องแต่งใหม่';
    curFloor();
  }
  // light up the floor in the middle of the view
  function curFloor() {
    if (!elevEl || !cv) return; const k = cv.getBoundingClientRect().height / H || 1, mid = (wrap.scrollTop + wrap.clientHeight / 2) / k;
    const bs = [...elevEl.querySelectorAll('.fb')]; let cur = 0; bs.forEach((b, i) => { if (+b.dataset.y <= mid) cur = i; });
    bs.forEach((b, i) => b.classList.toggle('on', i === cur));
    clipSigns();
  }
  // signs scrolled out of the building's window are hidden (they are clipped anyway; keeps them out of tab order and hit tests)
  function clipSigns() {
    if (!signsEl) return; const R = wrap.getBoundingClientRect(), C = signsEl.getBoundingClientRect();
    // from the layout numbers, not the button's own box (a hidden button measures 0×0)
    for (const b of signsEl.children) { const y = C.top + parseFloat(b.style.top) / 100 * C.height, x = C.left + parseFloat(b.style.left) / 100 * C.width, w = parseFloat(b.style.width) / 100 * C.width;
      const out = y + 12 < R.top + 4 || y - 12 > R.bottom - 4 || x + w < R.left + 4 || x > R.right - 4;
      if (b.hidden !== out) b.hidden = out; }
  }
  const kOf = () => cv.getBoundingClientRect().height / H;
  function goY(y) { wrap.scrollTo({ top: Math.max(0, y * kOf() - 8), behavior: 'smooth' }); }
  function goRoom(info) { const k = kOf(); wrap.scrollTo({ top: Math.max(0, info.y * k - 40), left: Math.max(0, info.x * k - 120), behavior: 'smooth' }); openCard(info.r); }
  // the next room in the building (top → bottom, wrapping) that passes the test, after the open card's room
  function nextRoom(test) {
    const L = rooms.filter(test); if (!L.length) return null;
    const i = card ? rooms.findIndex(r => r.r.k === card.r.k) : -1;
    return L.find(r => rooms.indexOf(r) > i) || L[0];
  }

  /* ---------- knock-on-door card: water / like / enter without leaving the building ---------- */
  const infoOf = k => rooms.find(r => r.r.k === k);
  function openCard(r) { card = { r, done: 0, coins: 0 }; renderCard(); typeof Stats !== 'undefined' && Stats.open && Stats.open('knock'); }
  function closeCard() { card = null; cardEl.hidden = true; }
  function renderCard() {
    if (!card) { cardEl.hidden = true; return; }
    const i = infoOf(card.r.k) || { r: card.r, nw: 0, p: null, mine: lc(card.r.n) === lc(myName()), fk: card.r.k }, r = i.r, fr = farms[i.fk] || null;
    const coins = Math.min(typeof Farm !== 'undefined' ? Farm.waterCoinsLeft() : 0, i.nw * 2), nxt = nextRoom(x => x.nw > 0 && x.r.k !== r.k);
    const like = '<button class="btn" data-a="like" aria-label="ถูกใจห้องนี้" title="ถูกใจห้องนี้">❤️</button>';
    let acts;
    if (i.mine) acts = `<button class="btn primary" data-a="enter">🏠 แต่งห้องฉัน</button><button class="btn" data-a="farm">🌱 ไปฟาร์ม</button>`;
    else if (i.nw) acts = `<button class="btn primary" data-a="water">💧 รดน้ำ ${i.nw} ต้น${coins ? ` +${coins} 🪙` : ''}</button>${like}<button class="btn" data-a="enter">เข้าห้อง</button>`;
    else if (card.done && nxt) acts = `<button class="btn primary" data-a="next" title="ไปห้องถัดไปที่รอรดน้ำ">🛗 ห้องถัดไป 💧</button>${like}<button class="btn" data-a="enter">เข้าห้อง</button>`;
    else acts = `<button class="btn primary" data-a="enter">เข้าห้อง</button>${like}${nxt ? '<button class="btn" data-a="next">🛗 ห้องที่รอรดน้ำ</button>' : ''}`;
    const aw = typeof Awards !== 'undefined' ? Awards.tip(r.k) : '';
    const farmTxt = card.done ? `💧 รดน้ำให้แล้ว ${card.done} ต้น${card.coins ? ` · +${card.coins} 🪙` : ''} — ผักของ ${esc(r.n)} โตเร็วขึ้น`
      : i.mine ? '' : fr ? esc(Farm.balconyInfo(fr).replace(/^🌱 [^·]*· /, '🌱 ')) + (i.nw ? '' : ' · 💧 ไม่มีต้นที่รอรดน้ำ') : '🌱 ยังไม่ได้ปลูกผัก';
    cardEl.innerHTML = `<div class="knock-h"><b>${i.p ? '<i class="on"></i>' : ''}${i.mine ? '⭐ ' : ''}${esc(r.n)}${i.mine ? ' (คุณ)' : ''}</b><button class="x" type="button" data-a="x" aria-label="ปิด">✕</button></div>
      <small class="muted">Lv ${r.lv | 0}${r.ti ? ' · ' + esc(r.ti) : ''}${i.p ? ' · ออนไลน์อยู่' : ''}${aw ? ' · 🏅 ' + esc(aw) : ''}</small>
      <canvas class="knock-room" width="${(r.room.w | 0 || 12) * 32}" height="288"></canvas>
      ${farmTxt ? `<p class="knock-f">${farmTxt}</p>` : ''}<div class="knock-a">${acts}</div>`;
    cardEl.hidden = false;
    const c = cache['p' + r.k], kc = cardEl.querySelector('canvas'); if (c && c.c.width) { kc.width = c.c.width; kc.getContext('2d').drawImage(c.c, 0, 0); }
  }
  function cardAct(a) {
    if (!card) return; const r = card.r, i = infoOf(r.k);
    if (a === 'x') closeCard();
    else if (a === 'enter') { closeCard(); if (lc(r.n) !== lc(myName())) { window.officeVisit = r; window.officeTab = 'friends'; } startGame('office'); window.officeTab = null; }
    else if (a === 'farm') { closeCard(); startGame('farm'); }
    else if (a === 'next') { const n = nextRoom(x => x.nw > 0 && x.r.k !== r.k); if (n) goRoom(n); }
    else if (a === 'like') {
      const nm = myName(); if (!nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อนนะ'); return; }
      loadOnline().then(M => M.likeMonth(r.k, nm).then(() => M.like(r.k, nm))).then(first => {
        if (first && typeof Awards !== 'undefined') Awards.add('like', 1, r.n); if (first && typeof Season !== 'undefined') Season.add('like');
        toast(first ? `❤️ ถูกใจห้องของ ${r.n} แล้ว` : `❤️ ถูกใจห้องของ ${r.n} ไปแล้ว`); }).catch(() => {});
      typeof SFX !== 'undefined' && SFX.good();
    }
    else if (a === 'water') {
      const nm = myName(); if (!nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อน ถึงจะรดน้ำให้เพื่อนได้'); return; }
      if (!O || !i || !farms[i.fk]) return;
      const btn = cardEl.querySelector('[data-a=water]'); if (btn) btn.disabled = true;
      Farm.waterAll(O, farms[i.fk], waters[i.fk] || (waters[i.fk] = {}), nm).then(res => {
        typeof SFX !== 'undefined' && SFX.good();
        const mc = document.querySelector('#hub .me-coins');
        if (res.coins && btn && typeof flyCoins === 'function') { const b = btn.getBoundingClientRect(); flyCoins(b.left + b.width / 2, b.top, mc, res.coins); }
        if (mc) mc.textContent = '🪙 ' + fmt(Prog.get().coins);
        if (card && card.r.k === r.k) { card.done = res.n; card.coins = res.coins; } draw(); renderCard();
      }).catch(() => { toast('รดน้ำไม่สำเร็จ (เน็ตหลุด?)'); if (btn) btn.disabled = false; });
    }
  }
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  function fit() { cv.width = W * dpr(); cv.height = H * dpr(); cv.style.aspectRatio = W / H; cv.parentNode.style.width = (zoom * 100) + '%'; }

  /* ---------- DOM + input ---------- */
  function build() {
    el = document.createElement('section'); el.className = 'tower'; el.id = 'tower';
    el.innerHTML = `<div class="tw"><nav class="elev" aria-label="ลิฟต์"><b class="elev-t">🛗 ลิฟต์</b><div class="elev-fl"></div>
        <div class="elev-sc"><button class="btn sm" type="button" data-me>📍 ห้องฉัน</button><button class="btn sm" type="button" data-go="water" disabled>💧</button><button class="btn sm" type="button" data-go="new" disabled>✨</button></div></nav>
      <div class="tower-wrap"><div class="tower-in"><canvas></canvas><div class="tower-signs"></div></div><div class="tower-tip" hidden></div></div>
      <div class="knock" role="dialog" aria-label="เคาะประตูห้อง" hidden></div></div>
      <div class="tower-bar"><span class="muted">ยิ่งเลเวลสูงยิ่งได้อยู่ชั้นบน · ไฟเปิด = ออนไลน์อยู่ · กดห้องเพื่อเคาะประตู</span>
        <span class="tower-zoom"><button class="btn sm" data-z="-1" aria-label="ซูมออก">－</button><button class="btn sm" data-z="1" aria-label="ซูมเข้า">＋</button></span></div>`;
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d'); wrap = el.querySelector('.tower-wrap');
    signsEl = el.querySelector('.tower-signs'); elevEl = el.querySelector('.elev'); cardEl = el.querySelector('.knock');
    signsEl.addEventListener('click', e => { const b = e.target.closest('[data-s]'), g = b && signs[+b.dataset.s]; if (!g) return;
      if (g.act.startsWith('room:')) { const i = infoOf(g.act.slice(5)); if (i) openCard(i.r); } else click({ kind: g.act }); });
    elevEl.querySelector('.elev-fl').addEventListener('click', e => { const b = e.target.closest('[data-y]'); if (b) goY(+b.dataset.y); });
    elevEl.querySelector('[data-go=water]').onclick = () => { const n = nextRoom(x => x.nw > 0 && (!card || x.r.k !== card.r.k)); if (n) goRoom(n); };
    elevEl.querySelector('[data-go=new]').onclick = () => { const n = nextRoom(x => x.isNew && (!card || x.r.k !== card.r.k)); if (n) goRoom(n); };
    cardEl.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) cardAct(b.dataset.a); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape' && card) closeCard(); });
    wrap.addEventListener('scroll', curFloor, { passive: true });
    const tip = el.querySelector('.tower-tip');
    const at = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * W / b.width, y: (e.clientY - b.top) * H / b.height }; };
    const hit = e => { const p = at(e); for (let i = regions.length - 1; i >= 0; i--) { const g = regions[i]; if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) return g; } return null; };
    cv.addEventListener('pointermove', e => { hover = hit(e); if (hover) { tip.hidden = false; tip.textContent = hover.tip; const w = wrap.getBoundingClientRect(); tip.style.left = Math.min(w.width - 240, e.clientX - w.left + wrap.scrollLeft + 12) + 'px'; tip.style.top = (e.clientY - w.top + wrap.scrollTop + 14) + 'px'; } else tip.hidden = true; cv.style.cursor = hover ? 'pointer' : 'default'; });
    cv.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
    cv.addEventListener('click', e => { const g = hit(e); if (g) click(g); else if (card) closeCard(); });
    function click(g) {
      if (g.kind === 'room') openCard(g.r);
      else if (g.kind === 'balcony') { if (g.k !== key(myName())) window.farmVisit = g.k; startGame('farm'); }
      else if (g.kind === 'garden') startGame('farm');
      else if (g.kind === 'lobby') setView('room');
      else if (g.kind === 'board') { const s = document.querySelector('#hub .awards'); s && s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else if (g.kind === 'counter') { const b = document.getElementById('mBtn'); if (b) { if (b.getAttribute('aria-expanded') !== 'true') b.click(); (document.getElementById('mBtn') || b).scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
      else if (g.kind === 'crane' && typeof HubRoom !== 'undefined') HubRoom.officePanel();
      else toast(g.tip);
    }
    el.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { zoom = Math.max(1, Math.min(2.5, zoom + +b.dataset.z * .5)); fit(); });
    el.querySelector('[data-me]').onclick = () => scrollToMe(true);
  }
  function scrollToMe(say) {
    const g = regions.find(r => r.kind === 'room' && lc(r.r.n) === lc(myName()));
    if (!g) { if (say) toast('ยังไม่มีห้องในตึก — ตั้งชื่อเล่นที่แถบบนแล้วเล่นสักเกม ห้องจะย้ายเข้ามาเอง'); return; }
    const k = cv.getBoundingClientRect().height / H; wrap.scrollTo({ top: g.y * k - 80, left: Math.max(0, g.x * k - 120), behavior: say ? 'smooth' : 'auto' });
  }
  function load() {
    loadOnline().then(M => M.listProfiles(80)).then(L => { profiles = L; loadedAt = performance.now(); }).catch(() => { profiles = profiles || []; });
    // farms come separately so a farm error never blocks the building
    loadOnline().then(M => M.listFarms ? M.listFarms() : []).then(F => { const m = {}; for (const f of F || []) if (f && f.k) m[f.k] = f; farms = m; }).catch(() => {});
    loadOnline().then(M => M.allWaters ? M.allWaters() : {}).then(w => { waters = w || {}; }).catch(() => {});
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; if (!visible()) return; t += dt; draw();
    if ((clipN = (clipN + 1) % 15) === 0) clipSigns();   // the canvas can resize without a scroll event
    if (loadedAt && performance.now() - loadedAt > 300) { loadedAt = 0; scrollToMe(false); curFloor(); }
  }
  function start() {
    if (started) return; started = true; load(); setInterval(() => visible() && load(), 60000);
    loadOnline().then(M => { O = M; M.watchOnline(l => people = l); }).catch(() => {});
    requestAnimationFrame(frame);
  }
  // home page view switch: ห้องรวม (walk + chat), ตึก (everyone's rooms) or หมู่บ้าน (village.js, hidden until release)
  function setView(v) {
    const vilOn = typeof Village !== 'undefined' && Village.on(); if (v === 'village' && !vilOn) v = 'room';  // village tab is hidden until release
    store.set('hubView', v); const room = document.getElementById('room'), vil = document.getElementById('village');
    if (room) room.hidden = v !== 'room'; if (el) el.hidden = v !== 'tower'; if (vil) vil.hidden = v !== 'village';
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'tower') { start(); load(); }
    if (v === 'village') Village.show();
  }
  return {
    mount(slot) { const first = !el; if (!el) build(); slot.replaceWith(el); if (first && innerWidth < 720) zoom = 2; fit(); setView(store.get('hubView', 'room')); },
    setView, refresh: load,
    _dbg: { draw, get regions() { return regions; }, get rooms() { return rooms; }, openCard, set t(v) { t = v; } },
  };
})();
