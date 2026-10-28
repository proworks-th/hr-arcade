// Extra solo games for the hub (general office theme). Classic script loaded before the hub script;
// at run time it uses the hub's globals: fmt, rnd, pick, toast. Each game is mount(root, api) like the others.
'use strict';
const PIX = {};
function pix(n) { if (!PIX[n]) { const i = new Image(); i.src = 'assets/pixel/' + n + '.png'; PIX[n] = i; } return PIX[n]; }
function drawPix(ctx, n, x, y, w, h, flip) {
  const im = pix(n); if (!im.complete || !im.naturalWidth) return;
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); ctx.restore(); } else ctx.drawImage(im, x, y, w, h);
}
// canvas with a fixed logical size, scaled to the screen by CSS (.g2box)
function g2canvas(root, W, H) {
  const box = document.createElement('div'); box.className = 'g2box'; root.appendChild(box);
  const cv = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; box.appendChild(cv);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // pointer position in logical canvas units
  const at = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  return { cv, ctx, at };
}
function g2pad(root, buttons) {
  const bar = document.createElement('div'); bar.className = 'g2pad';
  for (const [label, fn] of buttons) { const b = document.createElement('button'); b.className = 'btn'; b.innerHTML = label;
    b.addEventListener('pointerdown', e => { e.preventDefault(); fn(); }); bar.appendChild(b); }
  root.appendChild(bar); return bar;
}
function txt(ctx, s, x, y, size = 16, col = '#2b2140', align = 'center', weight = 600) {
  ctx.font = `${weight} ${size}px Kanit, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function rrect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/* =================================================================
   Printer Tetris — paper of different sizes falls into the output tray
================================================================= */
function tetrisGame(root, api) {
  const COLS = 10, ROWS = 20, C = 26, W = 400, H = ROWS * C + 12;
  const SHAPES = {
    I: { c: '#3a86ff', n: 'กระดาษยาว', m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { c: '#ffd23f', n: 'กองโน้ต', m: [[1, 1], [1, 1]] },
    T: { c: '#8338ec', n: 'แฟ้ม', m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { c: '#21c07a', n: 'ใบเสร็จ', m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { c: '#ff4d4d', n: 'ซองจดหมาย', m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { c: '#ff9f1c', n: 'สมุดโน้ต', m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { c: '#00b4d8', n: 'สติกเกอร์', m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  };
  root.innerHTML = `<div class="hud"><span>🖨️ คะแนน <b data-k="sc">0</b></span><span>📄 แถว <b data-k="ln">0</b></span><span>⚡ เลเวล <b data-k="lv">1</b></span>
    <span class="muted g2tip">← → ย้าย · ↑ หมุน · ↓ เร่ง · Space ทิ้งลงทันที</span></div>`;
  const { ctx } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let bag = [], cur = null, next = null, score = 0, lines = 0, level = 1, fall = 0, lock = 0, running = false, over = false, flash = [], flashT = 0;
  const draw7 = () => { if (!bag.length) bag = Object.keys(SHAPES).sort(() => rnd() - .5); return bag.pop(); };
  const make = t => ({ t, m: SHAPES[t].m.map(r => r.slice()), x: t === 'O' ? 4 : 3, y: t === 'I' ? -1 : 0 });
  const fits = (m, x, y) => m.every((r, j) => r.every((v, i) => !v || (x + i >= 0 && x + i < COLS && y + j < ROWS && (y + j < 0 || !grid[y + j][x + i]))));
  const rot = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
  function spawn() { cur = next ? make(next) : make(draw7()); next = draw7(); if (!fits(cur.m, cur.x, cur.y)) gameOver(); }
  function hud() { q('sc').textContent = fmt(score); q('ln').textContent = lines; q('lv').textContent = level; }
  function place() {
    cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && cur.y + j >= 0) grid[cur.y + j][cur.x + i] = cur.t; }));
    const full = []; grid.forEach((r, j) => { if (r.every(Boolean)) full.push(j); });
    if (full.length) { flash = full; flashT = .18; api.sfx(full.length >= 4 ? 'level' : 'good');
      score += [0, 100, 300, 500, 800][full.length] * level; lines += full.length; level = 1 + Math.floor(lines / 10); }
    else api.sfx('tick');
    if (cur.y < 0) return gameOver();
    cur = null; hud();
  }
  function clearFlash() { for (const j of flash) { grid.splice(j, 1); grid.unshift(Array(COLS).fill(null)); } flash = []; spawn(); }
  function gameOver() { if (over) return; over = true; running = false; api.after(.6, () => api.end(score, `${lines} แถว · เลเวล ${level}`, false, { lines, level })); }
  const move = dx => { if (cur && fits(cur.m, cur.x + dx, cur.y)) { cur.x += dx; lock = 0; } };
  const turn = () => { if (!cur) return; const m = rot(cur.m); for (const k of [0, -1, 1, -2, 2]) if (fits(m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; lock = 0; return; } };
  const soft = () => { if (cur && fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; fall = 0; } };
  const hard = () => { if (!cur) return; while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 2; } place(); if (!flash.length && !over) spawn(); };
  const act = f => () => { if (running && !api.paused && !flash.length) f(); };
  api.onKey(e => { const k = e.key; const map = { ArrowLeft: () => move(-1), a: () => move(-1), ArrowRight: () => move(1), d: () => move(1), ArrowUp: turn, w: turn, x: turn, ArrowDown: soft, s: soft, ' ': hard };
    if (map[k]) { e.preventDefault(); act(map[k])(); } });
  g2pad(root, [['◀', act(() => move(-1))], ['⟳', act(turn)], ['▶', act(() => move(1))], ['▼', act(soft)], ['⤓ ทิ้ง', act(hard)]]);
  function cell(x, y, t, alpha = 1) {
    const s = SHAPES[t]; ctx.globalAlpha = alpha;
    rrect(ctx, x + 1, y + 1, C - 2, C - 2, 3, '#fffdf6', '#2b2140');
    ctx.fillStyle = s.c; ctx.fillRect(x + 2, y + 2, C - 4, 6);
    ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.fillRect(x + 6, y + 12, C - 12, 2); ctx.fillRect(x + 6, y + 17, C - 16, 2);
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.fillStyle = '#4a4458'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2f2a3b'; ctx.fillRect(6, 6, COLS * C, ROWS * C);
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { const t = grid[j][i]; if (t) cell(6 + i * C, 6 + j * C, t, flash.includes(j) ? .4 + .6 * Math.abs(Math.sin(flashT * 40)) : 1); }
    if (cur) {
      let gy = cur.y; while (fits(cur.m, cur.x, gy + 1)) gy++;
      cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && gy + j >= 0) cell(6 + (cur.x + i) * C, 6 + (gy + j) * C, cur.t, .22); }));
      cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && cur.y + j >= 0) cell(6 + (cur.x + i) * C, 6 + (cur.y + j) * C, cur.t); }));
    }
    const px = COLS * C + 16;
    txt(ctx, 'ชิ้นต่อไป', px + 60, 24, 15, '#fff');
    rrect(ctx, px, 40, 120, 100, 10, '#2f2a3b');
    if (next) { const m = SHAPES[next].m, n = m.length, s = 22, ox = px + 60 - n * s / 2, oy = 90 - n * s / 2;
      m.forEach((r, j) => r.forEach((v, i) => { if (v) { ctx.save(); ctx.translate(ox + i * s, oy + j * s); ctx.scale(s / C, s / C); cell(0, 0, next); ctx.restore(); } }));
      txt(ctx, SHAPES[next].n, px + 60, 154, 13, '#ddd'); }
    drawPix(ctx, 'printer', px + 24, 190, 72, 72);
    txt(ctx, 'เคลียร์ 4 แถวพร้อมกัน', px + 60, 285, 12, '#ddd'); txt(ctx, '= 800 × เลเวล', px + 60, 302, 12, '#ffd23f');
  }
  api.loop(dt => {
    if (running) {
      if (flash.length) { flashT -= dt; if (flashT <= 0) clearFlash(); }
      else if (cur) {
        fall += dt; const speed = Math.max(.07, .8 - (level - 1) * .07);
        if (fits(cur.m, cur.x, cur.y + 1)) { lock = 0; if (fall >= speed) { cur.y++; fall = 0; } }
        else { lock += dt; if (lock > .45) { lock = 0; place(); if (!flash.length && !over) spawn(); } }
      }
    }
    draw();
  });
  hud(); draw();
  api.intro({ how: `<p>🖨️ เครื่องพิมพ์พ่นกระดาษออกมาไม่หยุด! จัดให้เรียงเต็มแถวในถาด แถวที่เต็มจะหายไป</p>
      <p>⌨️ <b>← →</b> ย้าย · <b>↑</b> หมุน · <b>↓</b> เร่งลง · <b>Space</b> ทิ้งลงทันที (มือถือใช้ปุ่มใต้จอ)</p>
      <p>⚡ ทุก 10 แถวขึ้นเลเวล กระดาษตกเร็วขึ้น · กองล้นถึงด้านบน = จบเกม</p>`,
    buttons: [{ label: '🖨️ เริ่มพิมพ์!', primary: true, go() { running = true; spawn(); } }] });
}

/* =================================================================
   Stamp Rush — stamp APPROVED on documents riding the conveyor
================================================================= */
function stampGame(root, api) {
  const W = 720, H = 360, SX = 360, BELT_Y = 230;
  const DOCS = ['รายงาน', 'ใบเสนอราคา', 'บันทึกประชุม', 'สัญญา', 'แผนงาน', 'ใบแจ้งหนี้', 'โปรเจกต์', 'งบประมาณ'];
  root.innerHTML = `<div class="hud"><span data-k="hp"></span><span>⭐ <b data-k="sc">0</b></span><span data-k="cb" class="muted"></span><span class="muted g2tip">Space / แตะจอ = ปั๊ม</span></div>`;
  const { cv, ctx } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`);
  let docs = [], speed = 150, gap = 0, made = 0, lives = 3, score = 0, combo = 0, maxc = 0, perfect = 0, running = false, over = false, press = 0, pop = null;
  function hud() { q('hp').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives); q('sc').textContent = fmt(score); q('cb').textContent = combo >= 3 ? `🔥 คอมโบ ${combo}` : ''; }
  function spawn() { made++; const draft = made > 8 && rnd() < .2; docs.push({ x: -80, name: pick(rnd, DOCS), draft, stamped: false, done: false, mark: '' }); }
  function lose(msg) { lives--; combo = 0; api.sfx('bad'); pop = { t: 1, text: msg, col: '#e23030' }; hud(); if (lives <= 0 && !over) { over = true; running = false; api.after(.8, () => api.end(score, `Perfect ${perfect} · คอมโบ ${maxc}`, false, { perfect, combo: maxc, docs: made })); } }
  function stamp() {
    if (!running || api.paused || press > 0) return; press = .18; api.sfx('stamp');
    let best = null, bd = 1e9; for (const d of docs) { if (d.stamped) continue; const dd = Math.abs(d.x - SX); if (dd < bd) { bd = dd; best = d; } }
    if (!best || bd > 60) { combo = 0; pop = { t: .6, text: 'ปั๊มพลาด!', col: '#7a6f8c' }; hud(); return; }
    best.stamped = true;
    if (best.draft) { best.mark = 'void'; return lose('❌ เอกสารร่าง ห้ามปั๊ม!'); }
    const [label, pts] = bd < 10 ? ['PERFECT', 30] : bd < 26 ? ['GOOD', 20] : ['OK', 10];
    if (label === 'PERFECT') perfect++;
    combo++; maxc = Math.max(maxc, combo);
    score += Math.round(pts * (1 + Math.floor(combo / 10) * .5)); best.mark = 'ok';
    pop = { t: .7, text: label, col: label === 'PERFECT' ? '#ff5c8a' : label === 'GOOD' ? '#ff9f1c' : '#21c07a' };
    if (label === 'PERFECT') api.sfx('good'); hud();
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); stamp(); });
  api.onKey(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stamp(); } });
  function doc(d) {
    const x = d.x - 50, y = BELT_Y - 118;
    ctx.save(); ctx.translate(d.x, BELT_Y - 60); ctx.rotate(Math.sin(d.x / 60) * .03); ctx.translate(-d.x, -(BELT_Y - 60));
    rrect(ctx, x, y, 100, 116, 6, d.draft ? '#e9e4ef' : '#fffdf6', '#2b2140');
    txt(ctx, d.name, d.x, y + 16, 13, '#2b2140');
    ctx.fillStyle = 'rgba(43,33,64,.2)'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 12, y + 30 + i * 10, 76 - (i % 2) * 18, 3);
    if (d.draft) { txt(ctx, 'ร่าง', d.x, y + 82, 18, '#e23030', 'center', 800); txt(ctx, 'ห้ามปั๊ม', d.x, y + 100, 11, '#e23030'); }
    else { ctx.setLineDash([4, 3]); ctx.strokeStyle = '#3a86ff'; ctx.lineWidth = 2; ctx.strokeRect(d.x - 26, y + 74, 52, 30); ctx.setLineDash([]); }
    if (d.mark === 'ok') { ctx.save(); ctx.translate(d.x, y + 89); ctx.rotate(-.2); ctx.strokeStyle = '#e23030'; ctx.lineWidth = 3; ctx.strokeRect(-36, -14, 72, 28); txt(ctx, 'APPROVED', 0, 1, 13, '#e23030', 'center', 800); ctx.restore(); }
    if (d.mark === 'void') { ctx.strokeStyle = '#e23030'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 10, y + 10); ctx.lineTo(x + 90, y + 106); ctx.moveTo(x + 90, y + 10); ctx.lineTo(x + 10, y + 106); ctx.stroke(); }
    ctx.restore();
  }
  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fdf3e6'); g.addColorStop(1, '#f6e2cb'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawPix(ctx, 'window', 60, 20, 104, 84); drawPix(ctx, 'window2', 560, 20, 104, 84); drawPix(ctx, 'plant', 650, 150, 42, 56);
    // conveyor
    ctx.fillStyle = '#4a4458'; ctx.fillRect(0, BELT_Y, W, 34); ctx.fillStyle = '#6b6478';
    const off = (performance.now() / 1000 * speed) % 40; for (let x = -40 + off; x < W; x += 40) ctx.fillRect(x, BELT_Y + 6, 20, 4);
    ctx.fillStyle = '#2b2140'; ctx.fillRect(0, BELT_Y + 34, W, 8);
    // target zone
    ctx.fillStyle = 'rgba(255,92,138,.15)'; ctx.fillRect(SX - 26, BELT_Y - 118, 52, 118);
    for (const d of docs) doc(d);
    // stamp arm
    const down = press > 0 ? (1 - Math.abs(press - .09) / .09) * 40 : 0;
    ctx.fillStyle = '#8d5a3b'; ctx.fillRect(SX - 6, 0, 12, 40 + down);
    rrect(ctx, SX - 34, 36 + down, 68, 30, 8, '#e23030', '#2b2140'); rrect(ctx, SX - 40, 62 + down, 80, 10, 3, '#2b2140');
    txt(ctx, 'APPROVED', SX, 51 + down, 11, '#fff', 'center', 800);
    if (pop) { ctx.globalAlpha = Math.min(1, pop.t * 2); txt(ctx, pop.text, SX, 120 - (1 - pop.t) * 20, 26, pop.col, 'center', 800); ctx.globalAlpha = 1; }
    txt(ctx, `ความเร็วสายพาน ${Math.round(speed)}`, 12, H - 14, 12, '#7a6f8c', 'left');
  }
  api.loop(dt => {
    if (running) {
      speed = Math.min(520, 150 + made * 7); gap -= dt * speed;
      if (gap <= 0) { spawn(); gap = 170 + rnd() * 140; }
      for (const d of docs) { d.x += speed * dt; if (!d.done && d.x > SX + 60) { d.done = true; if (!d.stamped && !d.draft) lose('⏰ หลุดไปไม่ได้ปั๊ม!'); } }
      docs = docs.filter(d => d.x < W + 80);
    }
    press = Math.max(0, press - dt); if (pop) { pop.t -= dt; if (pop.t <= 0) pop = null; }
    draw();
  });
  hud(); draw();
  api.intro({ how: `<p>🏢 เอกสารวิ่งมาบนสายพาน — กด <b>Space</b> หรือแตะจอ ตอนกรอบสีฟ้าอยู่ใต้ตราปั๊ม</p>
      <p>🎯 ตรงกลางเป๊ะ = <b>PERFECT</b> · ยิ่งคอมโบยาวคะแนนยิ่งคูณ</p><p>⚠️ เอกสาร <b>"ร่าง"</b> ห้ามปั๊ม · ปล่อยเอกสารปกติหลุดไป = เสียหัวใจ ❤️</p>`,
    buttons: [{ label: '🔏 เริ่มปั๊ม!', primary: true, go() { running = true; } }] });
}

/* =================================================================
   Lunch Barista — mix the drink each customer ordered before they lose patience
================================================================= */
function baristaGame(root, api) {
  const W = 760, H = 420, TOTAL = 90;
  const ING = [['shot', '☕', 'ช็อต'], ['milk', '🥛', 'นม'], ['ice', '🧊', 'น้ำแข็ง'], ['choco', '🍫', 'ช็อกโกแลต'], ['water', '💧', 'น้ำ'], ['tea', '🍵', 'ชา']];
  const MENU = [{ n: 'อเมริกาโน่', r: ['shot', 'water'] }, { n: 'ลาเต้', r: ['shot', 'milk'] }, { n: 'ลาเต้เย็น', r: ['shot', 'milk', 'ice'] },
    { n: 'มอคค่า', r: ['shot', 'milk', 'choco'] }, { n: 'โกโก้เย็น', r: ['choco', 'milk', 'ice'] }, { n: 'ชาเย็น', r: ['tea', 'milk', 'ice'] },
    { n: 'ชาร้อน', r: ['tea', 'water'] }, { n: 'เอสเพรสโซ่', r: ['shot'] }];
  const FACES = ['p_office', 'p_woffice', 'p_whealth', 'p_tech', 'p_cat', 'p_dog'];
  root.innerHTML = `<div class="hud"><div class="timer" data-k="tm"><div data-k="bar"></div></div><span>⏱ <b data-k="t">${TOTAL}</b></span><span>⭐ <b data-k="sc">0</b></span><span data-k="hp"></span></div>`;
  const { cv, ctx, at } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`);
  let slots = [null, null, null], cup = [], time = TOTAL, el = 0, score = 0, served = 0, hearts = 3, next = 1, running = false, over = false, msg = null;
  const SLOT_X = [140, 380, 620];
  const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  function hud() { q('t').textContent = Math.ceil(time); q('sc').textContent = fmt(score); q('bar').style.width = time / TOTAL * 100 + '%'; q('tm').classList.toggle('low', time < 15);
    q('hp').textContent = '❤️'.repeat(hearts) + '🖤'.repeat(3 - hearts); }
  function end() { if (over) return; over = true; running = false; api.end(score, `เสิร์ฟ ${served} แก้ว`, false, { served }); }
  function spawn() { const free = slots.map((s, i) => s ? -1 : i).filter(i => i >= 0); if (!free.length) return;
    const i = pick(rnd, free), m = pick(rnd, el < 25 ? MENU.slice(0, 5) : MENU), pat = Math.max(11, 20 - el * .09);
    slots[i] = { m, face: pick(rnd, FACES), pat, max: pat, mood: 0 }; }
  function add(k) { if (!running || api.paused) return; if (cup.length >= 4) { msg = { t: 1, s: 'แก้วเต็มแล้ว!' }; return; } cup.push(k); api.sfx('tick'); }
  function serve(i) {
    if (!running || api.paused || !cup.length) return;
    if (i == null) i = slots.findIndex(s => s && same(s.m.r, cup));
    const s = slots[i];
    if (!s || !same(s.m.r, cup)) { api.sfx('bad'); score = Math.max(0, score - 10); msg = { t: 1.2, s: '❌ ไม่ตรงออเดอร์ −10' }; if (s) s.pat -= 3; cup = []; hud(); return; }
    const tip = Math.round(s.pat / s.max * 20); score += 30 + s.m.r.length * 5 + tip; served++; api.sfx('good');
    msg = { t: 1, s: `✅ ${s.m.n} +${30 + s.m.r.length * 5 + tip}` }; slots[i] = null; cup = []; hud();
  }
  const clear = () => { cup = []; };
  api.onKey(e => { const n = +e.key; if (n >= 1 && n <= ING.length) { e.preventDefault(); add(ING[n - 1][0]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); serve(null); } else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clear(); } });
  cv.addEventListener('pointerdown', e => { const p = at(e); const i = SLOT_X.findIndex(x => Math.abs(p.x - x) < 90 && p.y < 260); if (i >= 0 && slots[i]) serve(i); });
  g2pad(root, [...ING.map(([k, e, n], i) => [`${e}<small> ${n}</small>`, () => add(k)]), ['🗑️ เท', clear], ['🛎️ เสิร์ฟ', () => serve(null)]]);
  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fdf3e6'); g.addColorStop(1, '#f3dcc0'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawPix(ctx, 'window', 20, 14, 90, 72); drawPix(ctx, 'window2', 650, 14, 90, 72);
    slots.forEach((s, i) => { if (!s) return; const x = SLOT_X[i], f = s.pat / s.max;
      drawPix(ctx, s.face, x - 36, 120, 72, s.face === 'p_cat' || s.face === 'p_dog' ? 60 : 108);
      rrect(ctx, x - 92, 18, 184, 86, 14, '#fff', '#2b2140');
      txt(ctx, s.m.n, x, 38, 16);
      txt(ctx, s.m.r.map(k => ING.find(z => z[0] === k)[1]).join(' '), x, 66, 24, '#000');
      rrect(ctx, x - 70, 86, 140, 9, 4, '#eee'); rrect(ctx, x - 70, 86, 140 * f, 9, 4, f < .3 ? '#ff4d4d' : '#21c07a');
      if (f < .3) txt(ctx, '😤', x + 50, 130, 22); });
    // counter + machine
    ctx.fillStyle = '#c98b5e'; ctx.fillRect(0, 262, W, 20); ctx.fillStyle = '#9b6a45'; ctx.fillRect(0, 282, W, H - 282);
    drawPix(ctx, 'desktop', 40, 300, 56, 88); drawPix(ctx, 'coffee', 664, 296, 60, 96);
    // cup
    rrect(ctx, W / 2 - 46, 296, 92, 104, 12, 'rgba(255,255,255,.85)', '#2b2140');
    cup.forEach((k, i) => txt(ctx, ING.find(z => z[0] === k)[1], W / 2, 380 - i * 24, 22, '#000'));
    if (!cup.length) txt(ctx, 'แก้วว่าง', W / 2, 350, 13, '#7a6f8c');
    if (msg) { ctx.globalAlpha = Math.min(1, msg.t * 2); txt(ctx, msg.s, W / 2, 240, 20, '#2b2140', 'center', 800); ctx.globalAlpha = 1; }
  }
  api.loop(dt => {
    if (running) {
      el += dt; time -= dt; next -= dt;
      if (next <= 0) { spawn(); next = Math.max(2.2, 5.5 - el * .04); }
      slots.forEach((s, i) => { if (s) { s.pat -= dt; if (s.pat <= 0) { slots[i] = null; hearts--; api.sfx('bad'); msg = { t: 1.2, s: '😤 ลูกค้ารอไม่ไหว เดินหนี!' }; } } });
      if (time <= 0 || hearts <= 0) { time = Math.max(0, time); hud(); end(); } else hud();
    }
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    draw();
  });
  hud(); draw();
  api.intro({ how: `<p>☕ พักเที่ยงคิวยาว! ผสมเครื่องดื่มตามที่ลูกค้าสั่งในบับเบิล แล้วเสิร์ฟให้ทันก่อนหลอดความอดทนหมด</p>
      <p>⌨️ ปุ่ม <b>1–6</b> ใส่วัตถุดิบ (☕ 🥛 🧊 🍫 💧 🍵) · <b>Enter</b> เสิร์ฟ · <b>Backspace</b> เทแก้วทิ้ง — หรือแตะปุ่มใต้จอ / แตะลูกค้า</p>
      <p>⭐ เสิร์ฟไวได้ทิปเยอะ · ลูกค้าเดินหนี 3 คน หรือหมดเวลา ${TOTAL} วิ = จบ</p>`,
    buttons: [{ label: '☕ เปิดร้าน!', primary: true, go() { running = true; spawn(); } }] });
}

/* =================================================================
   Paper Toss — flick a paper ball into the bin, mind the fan
================================================================= */
function tossGame(root, api) {
  const W = 720, H = 420, G = 900, FLOOR = 372, THROWS = 10, R = 11, START = { x: 100, y: 300 };
  root.innerHTML = `<div class="hud"><span>🗑️ ลงถัง <b data-k="mk">0</b>/<b data-k="th">0</b></span><span>⭐ <b data-k="sc">0</b></span><span data-k="st" class="muted"></span><span class="muted g2tip">ลากลูกบอลถอยหลังแล้วปล่อย · หรือ ←→ เล็ง + กด Space ค้างเพื่อออกแรง</span></div>`;
  const { cv, ctx, at } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`);
  let ball = null, drag = null, wind = 0, throws = 0, made = 0, score = 0, streak = 0, running = false, over = false, msg = null, binX = 520, aim = -.9, power = 0, charging = false, t = 0, rimHit = false;
  const BIN_W = 64, BIN_H = 78;
  function newThrow() { wind = throws < 2 ? 0 : (rnd() * 2 - 1) * Math.min(1, .3 + throws * .1); ball = { x: START.x, y: START.y, vx: 0, vy: 0, fly: false }; rimHit = false; }
  function hud() { q('mk').textContent = made; q('th').textContent = throws; q('sc').textContent = fmt(score); q('st').textContent = streak >= 2 ? `🔥 ติดกัน ${streak}` : ''; }
  function launch(vx, vy) { if (!running || !ball || ball.fly || api.paused) return; ball.vx = vx; ball.vy = vy; ball.fly = true; throws++; api.sfx('tick'); hud(); }
  function result(ok, swish) {
    if (ok) { made++; streak++; const p = 100 + (swish ? 50 : 0) + (streak - 1) * 25; score += p; msg = { t: 1.3, s: swish ? `🎯 SWISH! +${p}` : `✅ ลงถัง +${p}` }; api.sfx(swish ? 'level' : 'good'); }
    else { streak = 0; msg = { t: 1.1, s: '😅 พลาด!' }; api.sfx('bad'); }
    hud(); ball = null;
    if (throws >= THROWS) { over = true; running = false; api.after(1.2, () => api.end(score, `ลงถัง ${made}/${THROWS}`, false, { made })); } else api.after(.9, newThrow);
  }
  cv.addEventListener('pointerdown', e => { if (!ball || ball.fly) return; const p = at(e); if (Math.hypot(p.x - ball.x, p.y - ball.y) < 60) { drag = p; cv.setPointerCapture(e.pointerId); } });
  cv.addEventListener('pointermove', e => { if (drag) drag = at(e); });
  const release = () => { if (!drag || !ball) { drag = null; return; } const dx = START.x - drag.x, dy = START.y - drag.y, l = Math.min(150, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); drag = null;
    if (l > 15) launch(Math.cos(a) * l * 5.2, Math.sin(a) * l * 5.2); };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', () => { drag = null; });
  api.onKey(e => { if (e.key === 'ArrowLeft') { aim = Math.max(-1.45, aim - .05); e.preventDefault(); } else if (e.key === 'ArrowRight') { aim = Math.min(-.2, aim + .05); e.preventDefault(); }
    else if (e.key === ' ' && !e.repeat && ball && !ball.fly) { charging = true; power = 0; e.preventDefault(); } });
  const up = e => { if (e.key !== ' ' || !charging) return; charging = false; const l = 30 + power * 120; launch(Math.cos(aim) * l * 5.2, Math.sin(aim) * l * 5.2); };
  addEventListener('keyup', up);
  function draw() {
    ctx.fillStyle = '#fdf3e6'; ctx.fillRect(0, 0, W, H);
    drawPix(ctx, 'window', 230, 30, 110, 88); drawPix(ctx, 'cabinet', 640, 240, 64, 132); drawPix(ctx, 'plant', 20, 300, 48, 72);
    ctx.fillStyle = '#c98b5e'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    // fan + wind
    txt(ctx, '🌀', 440, 46, 26, '#000');
    const wl = Math.round(Math.abs(wind) * 5); txt(ctx, wind === 0 ? 'ลม: นิ่ง' : `ลม: ${wind > 0 ? '→'.repeat(wl || 1) : '←'.repeat(wl || 1)}`, 470, 46, 16, '#3a86ff', 'left');
    // bin
    const bx = binX - BIN_W / 2, by = FLOOR - BIN_H;
    ctx.fillStyle = '#5b6b7a'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + BIN_W, by); ctx.lineTo(bx + BIN_W - 8, FLOOR); ctx.lineTo(bx + 8, FLOOR); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#2b2140'; ctx.fillRect(bx - 4, by - 4, BIN_W + 8, 6);
    // thrower desk
    rrect(ctx, 40, 316, 120, 14, 4, '#d9a066', '#2b2140'); drawPix(ctx, 'p_office', 50, 238, 46, 78);
    // aim guide
    if (ball && !ball.fly) {
      let vx, vy; if (drag) { const dx = START.x - drag.x, dy = START.y - drag.y, l = Math.min(150, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); vx = Math.cos(a) * l * 5.2; vy = Math.sin(a) * l * 5.2; }
      else { const l = 30 + (charging ? power : .5) * 120; vx = Math.cos(aim) * l * 5.2; vy = Math.sin(aim) * l * 5.2; }
      ctx.fillStyle = 'rgba(43,33,64,.35)'; let x = ball.x, y = ball.y, wx = vx, wy = vy;
      for (let i = 0; i < 9; i++) { for (let k = 0; k < 4; k++) { wx += wind * 220 * .02; wy += G * .02; x += wx * .02; y += wy * .02; } ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
      if (charging) { rrect(ctx, 30, 200, 14, 100, 4, '#fff', '#2b2140'); rrect(ctx, 31, 299 - power * 98, 12, power * 98, 3, '#ff5c8a'); }
    }
    if (ball) { ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ball.x - 6, ball.y - 3); ctx.lineTo(ball.x + 5, ball.y + 2); ctx.moveTo(ball.x - 2, ball.y + 6); ctx.lineTo(ball.x + 3, ball.y - 6); ctx.stroke(); }
    if (msg) { ctx.globalAlpha = Math.min(1, msg.t * 2); txt(ctx, msg.s, W / 2, 150, 28, '#ff5c8a', 'center', 800); ctx.globalAlpha = 1; }
  }
  api.loop(dt => {
    t += dt;
    if (running && throws >= 5) binX = 520 + Math.sin(t * .9) * 90;   // the bin starts moving halfway through
    if (charging) power = Math.min(1, power + dt * .8);
    if (ball && ball.fly) {
      for (let k = 0; k < 4; k++) {
        const s = dt / 4, py = ball.y;
        ball.vx += wind * 220 * s; ball.vy += G * s; ball.x += ball.vx * s; ball.y += ball.vy * s;
        const bx = binX - BIN_W / 2, top = FLOOR - BIN_H;
        for (const rx of [bx, bx + BIN_W]) { const dx = ball.x - rx, dy = ball.y - top, d = Math.hypot(dx, dy);
          if (d < R + 3) { rimHit = true; const nx = dx / d, ny = dy / d, dot = ball.vx * nx + ball.vy * ny; if (dot < 0) { ball.vx -= 1.6 * dot * nx; ball.vy -= 1.6 * dot * ny; } ball.x = rx + nx * (R + 3); ball.y = top + ny * (R + 3); api.sfx('tick'); } }
        if (py < top && ball.y >= top && ball.vy > 0 && ball.x > bx + 4 && ball.x < bx + BIN_W - 4) { result(true, !rimHit); break; }
        if (ball.y > FLOOR - R || ball.x > W + 40 || ball.x < -40) { result(false); break; }
      }
    }
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    draw();
  });
  hud(); draw();
  api.intro({ how: `<p>🗑️ ปากระดาษก้อนลงถังให้ได้มากที่สุดใน ${THROWS} ลูก</p>
      <p>🖱️ <b>ลากลูกบอลถอยหลัง</b> เหมือนหนังสติ๊กแล้วปล่อย · หรือ <b>← →</b> เล็ง แล้ว <b>กด Space ค้าง</b> เพื่อออกแรง</p>
      <p>🌬️ ดูลมจากพัดลมด้านบนด้วย · ลงถังไม่โดนขอบ = <b>SWISH</b> +50 · ครึ่งหลังถังจะเลื่อนไปมา</p>`,
    buttons: [{ label: '🗑️ เริ่มปา!', primary: true, go() { running = true; newThrow(); } }] });
  return { destroy() { removeEventListener('keyup', up); } };
}
