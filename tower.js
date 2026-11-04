// "ตึกออฟฟิศ" — the home page's second view: one pixel tower holding everyone's decorated room.
//  - every coworker with a profile (rooms/_prof) gets an apartment; higher level = higher floor, a bigger room = a wider apartment
//  - people online right now walk around inside their room (lights on at night), the lobby shows who is in ห้องรวม
//  - the office level adds shared floors on top (canteen, library, …) and a crane builds the next one
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
  let el = null, cv, ctx, wrap, O = null, profiles = null, people = [], t = 0, last = 0, started = false, zoom = 1, H = 600, regions = [], hover = null, loadedAt = 0, farms = {};
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
    floorFrame(y); const c = thumb('sp' + s[0], s[2], 50);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(c, BX + SIDE, y, IW, FH);
    if (night()) { ctx.fillStyle = 'rgba(255,214,120,.10)'; ctx.fillRect(BX + SIDE, y, IW, FH); }
    ctx.fillStyle = '#2b2140'; ctx.fillRect(BX + SIDE, y + FH, IW, PLATE); txt(ctx, `${s[1]} · ชั้นส่วนกลาง (ได้ตอนออฟฟิศ Lv ${s[0]})`, W / 2, y + FH + PLATE / 2, 12, '#ffd23f', 'center', 700);
    regions.push({ x: BX + SIDE, y, w: IW, h: FH + PLATE, kind: 'special', tip: `${s[1]} — ชั้นส่วนกลางของทุกคน ปลดล็อกจากออฟฟิศเลเวล` });
  }
  function apartments(y, row, fi) {
    const bh = BAL(), now = Date.now(); floorFrame(y, AFLOOR());
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
      ctx.strokeStyle = mine ? '#ffd23f' : '#5d4037'; ctx.lineWidth = mine ? 4 : 2; ctx.strokeRect(x + 1, y + 1, w - 2, FH - 2);
      // name plate
      ctx.fillStyle = mine ? '#ffd23f' : '#2b2140'; ctx.fillRect(x, y + FH, w, PLATE);
      const bdg = r.b && typeof badgeEmoji === 'function' ? badgeEmoji(r.b) + ' ' : '', aw = typeof Awards !== 'undefined' ? Awards.badge(r.k) : '';
      txt(ctx, `${p ? '🟢 ' : ''}${aw ? '🏅' + aw + ' ' : ''}${bdg}${r.n} · Lv ${r.lv | 0}`, x + w / 2, y + FH + PLATE / 2, 11, mine ? '#2b2140' : '#fff', 'center', 700);
      regions.push({ x, y, w, h: FH + PLATE, kind: 'room', r, tip: `${r.n} · Lv ${r.lv | 0} ${r.ti || ''}${p ? ' · ออนไลน์อยู่' : ''}${aw ? ' · 🏅 ' + Awards.tip(r.k) : ''} — กดเพื่อเข้าไปดูห้อง` });
      // farm balcony hangs under the name plate, exactly the apartment's width; no farm row yet = empty pots
      if (typeof Farm !== 'undefined') { const fk = r.k || key(r.n), fr = farms[fk] || null, by = y + FH + PLATE;
        Farm.drawBalcony(ctx, fr, x, by, w, now, t);
        regions.push({ x, y: by, w, h: bh, kind: 'balcony', r, k: fk, tip: `${r.n} · ${Farm.balconyInfo(fr, now)} — กดเพื่อไปที่ฟาร์ม` }); }
      x += w + GAP;
    });
    // vacant units fill the rest of the floor
    const left = BX + SIDE + IW - x; if (left > 60) { ctx.fillStyle = '#d9cdbb'; ctx.fillRect(x, y, left, FH); ctx.strokeStyle = '#b9ab95'; ctx.setLineDash([6, 5]); ctx.strokeRect(x + 4, y + 4, left - 8, FH - 8); ctx.setLineDash([]);
      txt(ctx, row.length ? 'ห้องว่าง · รอเพื่อนใหม่' : 'ยังไม่มีใครย้ายเข้า — ตั้งชื่อเล่นแล้วเล่นสักเกม', x + left / 2, y + FH / 2, 12, '#8a7c66', 'center', 600); }
  }
  function lobby(y, n) {
    brick(BX, y, BW, LOBBY);
    // glass front with reflections, a double door and the sign
    const gx = BX + 40, gw = BW - 80, gy = y + 46, gh = LOBBY - 60;
    ctx.fillStyle = night() ? '#ffe7a8' : '#bfe6ff'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); const x0 = gx + 40 + i * 140; ctx.moveTo(x0, gy); ctx.lineTo(x0 + 30, gy); ctx.lineTo(x0 - 10, gy + gh); ctx.lineTo(x0 - 40, gy + gh); ctx.fill(); }
    ctx.fillStyle = '#5d4037'; for (let x = gx; x <= gx + gw; x += gw / 6) ctx.fillRect(x - 2, gy, 4, gh); ctx.fillRect(gx, gy - 4, gw, 6);
    const dx = W / 2; ctx.fillStyle = '#3a2a20'; ctx.fillRect(dx - 44, gy + 20, 88, gh - 20); ctx.fillStyle = night() ? '#ffd27a' : '#e2f3ff'; ctx.fillRect(dx - 40, gy + 24, 38, gh - 24); ctx.fillRect(dx + 2, gy + 24, 38, gh - 24);
    rrect(ctx, dx - 150, y + 8, 300, 32, 8, '#ff5c8a', '#2b2140'); txt(ctx, `🎉 ห้องรวม · ${n} คนอยู่ตอนนี้`, dx, y + 24, 15, '#fff', 'center', 800);
    // people hanging out in ห้องรวม, drawn in front of the glass
    const inHub = people.filter(p => p.g === 'hub').slice(0, 10);
    inHub.forEach((p, i) => { const ph = t * .3 + i * 2.3, px = gx + 60 + ((Math.sin(ph) * .5 + .5) * (gw - 120) + i * 67) % (gw - 120), who = MI_PEOPLE.includes(p.a) ? p.a : 'adam', dr = Math.cos(ph) > 0 ? 'right' : 'left';
      drawChar(ctx, who, 'run', dr, t + i, px, y + LOBBY - 6, 2); for (const sl of ['f', 'h']) drawAcc(ctx, p[sl], who, 'run', dr, t + i, px, y + LOBBY - 6, 2); });
    regions.push({ x: BX, y, w: BW, h: LOBBY, kind: 'lobby', tip: 'ห้องรวม — กดเพื่อเข้าไปเดินเล่นและคุยกับเพื่อน' });
  }
  function draw() {
    const Lo = layout(), h = size(Lo); if (h !== H) { H = h; fit(); }
    regions = []; ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    sky();
    let y = TOPM; roof(y, Lo); y += ROOF;
    for (const s of Lo.specials) { special(y, s); y += FLOOR; }
    Lo.floors.forEach((row, i) => { apartments(y, row, i); y += AFLOOR(); });
    lobby(y, people.filter(p => p.g === 'hub').length); y += LOBBY;
    ctx.fillStyle = night() ? '#2f4a2a' : '#7cc46a'; ctx.fillRect(0, y, W, GROUND); ctx.fillStyle = '#6b6f7a'; ctx.fillRect(0, y + 14, W, 18);
    ctx.fillStyle = '#fff'; for (let x = (t * 20) % 60 - 60; x < W; x += 60) ctx.fillRect(x, y + 22, 30, 2);
    if (profiles == null) { rrect(ctx, W / 2 - 110, H / 2 - 20, 220, 40, 10, '#fff', '#2b2140'); txt(ctx, '⏳ กำลังโหลดตึก…', W / 2, H / 2, 15); }
    if (hover) { const r = regions.find(g => g.kind === hover.kind && (g.r ? g.r === hover.r : true)); if (r) { ctx.strokeStyle = '#ff5c8a'; ctx.lineWidth = 3; ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); } }
  }
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  function fit() { cv.width = W * dpr(); cv.height = H * dpr(); cv.style.aspectRatio = W / H; cv.style.width = (zoom * 100) + '%'; }

  /* ---------- DOM + input ---------- */
  function build() {
    el = document.createElement('section'); el.className = 'tower'; el.id = 'tower';
    el.innerHTML = `<div class="tower-wrap"><canvas></canvas><div class="tower-tip" hidden></div></div>
      <div class="tower-bar"><span class="muted">ห้องของทุกคนอยู่ในตึกนี้ · ยิ่งเลเวลสูงยิ่งได้อยู่ชั้นบน · ห้องที่ขยายแล้วจะกว้างขึ้น · กดห้องเพื่อเข้าไปดู</span>
        <span class="tower-zoom"><button class="btn sm" data-z="-1" aria-label="ซูมออก">－</button><button class="btn sm" data-z="1" aria-label="ซูมเข้า">＋</button><button class="btn sm" data-me>📍 ห้องฉัน</button></span></div>`;
    cv = el.querySelector('canvas'); ctx = cv.getContext('2d'); wrap = el.querySelector('.tower-wrap');
    const tip = el.querySelector('.tower-tip');
    const at = e => { const b = cv.getBoundingClientRect(); return { x: (e.clientX - b.left) * W / b.width, y: (e.clientY - b.top) * H / b.height }; };
    const hit = e => { const p = at(e); for (let i = regions.length - 1; i >= 0; i--) { const g = regions[i]; if (p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h) return g; } return null; };
    cv.addEventListener('pointermove', e => { hover = hit(e); if (hover) { tip.hidden = false; tip.textContent = hover.tip; const w = wrap.getBoundingClientRect(); tip.style.left = Math.min(w.width - 240, e.clientX - w.left + wrap.scrollLeft + 12) + 'px'; tip.style.top = (e.clientY - w.top + wrap.scrollTop + 14) + 'px'; } else tip.hidden = true; cv.style.cursor = hover ? 'pointer' : 'default'; });
    cv.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
    cv.addEventListener('click', e => { const g = hit(e); if (!g) return;
      if (g.kind === 'room') { window.officeVisit = g.r; window.officeTab = 'friends'; startGame('office'); window.officeTab = null; }
      else if (g.kind === 'balcony') { if (g.k !== key(myName())) window.farmVisit = g.k; startGame('farm'); }
      else if (g.kind === 'lobby') setView('room');
      else if (g.kind === 'crane' && typeof HubRoom !== 'undefined') HubRoom.officePanel();
      else toast(g.tip); });
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
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; if (!visible()) return; t += dt; draw();
    if (loadedAt && performance.now() - loadedAt > 300) { loadedAt = 0; scrollToMe(false); }
  }
  function start() {
    if (started) return; started = true; load(); setInterval(() => visible() && load(), 60000);
    loadOnline().then(M => { O = M; M.watchOnline(l => people = l); }).catch(() => {});
    requestAnimationFrame(frame);
  }
  // home page view switch: ห้องรวม (walk + chat) or ตึก (everyone's rooms)
  function setView(v) {
    store.set('hubView', v); const room = document.getElementById('room');
    if (room) room.hidden = v !== 'room'; if (el) el.hidden = v !== 'tower';
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'tower') { start(); load(); }
  }
  return {
    mount(slot) { if (!el) build(); slot.replaceWith(el); fit(); setView(store.get('hubView', 'room')); },
    setView, refresh: load,
    _dbg: { draw, get regions() { return regions; }, set t(v) { t = v; } },
  };
})();
