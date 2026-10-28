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
   Shared look + juice (used by every solo game, incl. the older ones in index.html)
   One art style: 2dPig Pixel Office sprites drawn at whole-number scale on an office backdrop,
   plus small pixel icons drawn from strings (PXA) where the pack has none.
================================================================= */
const PAL = { ink: '#2b2140', wall: '#fdf3e6', wall2: '#f6e2cb', paper: '#fffdf6', floor: '#c98b5e', floor2: '#b77a50', floorLine: '#8f5f3e',
  pink: '#ff5c8a', yel: '#ffd23f', blue: '#3a86ff', green: '#21c07a', red: '#e23030', orange: '#ff9f1c', muted: '#7a6f8c' };
const PIX_SZ = {bin_blue:[9,14],bin_green:[9,14],bin_red:[9,14],binder_blue:[11,8],binder_green:[11,8],binder_red:[11,8],boss:[13,21],box:[11,8],cabinet:[24,31],cactus:[9,14],calendar:[17,11],chair:[11,22],chair_blue:[11,22],chair_green:[11,22],chair_grey:[11,22],chair_red:[11,22],chair_white:[11,22],chair_yellow:[11,22],clock:[19,6],coffee:[15,19],cooler:[9,17],desk_l:[40,16],desk_s:[26,16],desktop:[7,11],disk:[8,7],door:[16,31],drawer:[26,20],fax:[15,19],flag:[15,19],flag_in:[12,9],flag_uk:[12,9],flag_us:[12,9],goal:[16,31],laptop:[26,26],memo:[6,9],mug:[8,7],p_cat:[16,13],p_dog:[24,11],p_office:[15,23],p_tech:[19,24],p_whealth:[17,23],p_woffice:[17,23],paper:[6,8],pc:[7,11],pic1:[6,8],pic2:[6,8],pic3:[11,8],plant:[14,19],postbox:[9,17],printer:[9,9],robot:[24,11],shelf:[73,24],snack:[24,31],sofa:[33,15],sofa2:[33,16],sofa_blue:[33,16],sofa_green:[33,16],sofa_grey:[33,15],sofa_orange:[33,16],stamp:[11,8],trash:[9,14],vending:[24,34],whitebox:[10,6],window:[26,21],window2:[26,21]};

// sprite at its own pixel size x k, anchored bottom-centre at (cx, by); sx/sy squash, rot in radians
function drawPixAt(ctx, n, cx, by, k, o = {}) {
  const im = typeof n === 'string' ? pix(n) : n;
  const w = (im.naturalWidth || im.width) * k, h = (im.naturalHeight || im.height) * k; if (!w || (im.complete === false)) return;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(cx, by); if (o.rot) ctx.rotate(o.rot);
  ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
// tiny pixel icons from string art: each char is a palette key, '.' = transparent
const PXA_PAL = { k: '#2b2140', w: '#ffffff', y: '#ffd23f', o: '#c77d0a', r: '#ff4d6d', R: '#b3203a', b: '#4cc3ff', B: '#2266cc', l: '#bfe9ff',
  g: '#21c07a', G: '#14804f', c: '#6b3e26', C: '#a5683f', m: '#fffdf6', t: '#e0913b', p: '#ff5c8a', s: '#d9dde3', S: '#8a93a3', v: '#8338ec' };
const PXA_ART = {
  coin: ['..kkkk..', '.koooook', 'koyyyyok', 'koywyyok', 'koywyyok', 'koyyyyok', '.koooook', '..kkkk..'],
  heart: ['.kk.kk.', 'krrkrrk', 'krwrrRk', 'krrrrRk', '.krrRk.', '..kRk..', '...k...'],
  gem: ['.kkkkk.', 'kblwbBk', 'kbbbbBk', '.kbbBk.', '..kBk..', '...k...'],
  plane: ['kk...........', 'kwkk.........', '.kwwwkk......', '..kwwwwwkkk..', '..kwwwwwwwwkk', '.kssSkkkkkkk.', 'kSk.k........'],
  spark: ['..w..', '..y..', 'wyyyw', '..y..', '..w..'],
  ball: ['..kkk..', '.kmmsk.', 'kmsmmsk', 'kmmmsmk', 'ksmmmmk', '.kmsmk.', '..kkk..'],
  shot: ['...k....', '..kck...', '..kck...', '.kccck..', 'kcccCck.', 'kccccck.', '.kccck..', '..kkk...'],
  milk: ['..kkk...', '..kwk...', '.kwwwk..', 'kwwwwwk.', 'kwbbbwk.', 'kwbwbwk.', 'kwwwwwk.', 'kkkkkkk.'],
  ice: ['.kkkkkk.', 'kwwwwwlk', 'kwllllbk', 'kwllllbk', 'kwllllbk', 'klbbbbbk', '.kkkkkk.'],
  choco: ['kkkkkkk', 'kCckCck', 'kcckcck', 'kkkkkkk', 'kCckCck', 'kcckcck', 'kkkkkkk'],
  water: ['...k....', '..kbk...', '..kbk...', '.kbbbk..', 'kbbwbbk.', 'kbbbbbk.', '.kbbbk..', '..kkk...'],
  tea: ['...k....', '..ktk...', '..ktk...', '.ktttk..', 'kttytkk.', 'ktttttk.', '.ktttk..', '..kkk...'],
  moon: ['..kkk..', '.kyyk..', 'kyyk...', 'kyyk...', 'kyyyk..', '.kyyyk.', '..kkk..'],
  rocket: ['...k...', '..kwk..', '..kwk..', '.kwbwk.', '.kwwwk.', '.kwwwk.', 'kpkwkpk', 'kp.k.pk', '...y...', '..yry..'],
  ufo: ['...kkk...', '..klllk..', '.kkkkkkk.', 'kssSsSssk', '.kkkkkkk.', '..y.y.y..'],
  cloud: ['....kkkk.......', '...kwwwwk.kkk..', '.kkwwwwwwkwwwk.', 'kwwwwwwwwwwwwwk', 'kwwwwwwwwwwwlwk', '.kkkkkkkkkkkkk.'],
  fan: ['.kkkkk.', 'klbklbk', 'kbkskbk', 'klkskbk', '.kkkkk.', '...k...', '...k...', '.kkkkk.'],
};
const PXA = {};
function pxa(key) {
  if (PXA[key]) return PXA[key];
  const rows = PXA_ART[key], c = document.createElement('canvas'); c.width = Math.max(...rows.map(r => r.length)); c.height = rows.length;
  const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PXA_PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  return (PXA[key] = c);
}
// the same icons as <img> for the DOM (buttons, legends)
const PXA_URL = {};
function pxaURL(key, k = 4) {
  if (PXA_URL[key + k]) return PXA_URL[key + k];
  const s = pxa(key), c = document.createElement('canvas'); c.width = s.width * k; c.height = s.height * k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, c.width, c.height);
  return (PXA_URL[key + k] = c.toDataURL());
}
const pxImg = (key, size = 22) => `<img class="pxi" alt="" src="${pxaURL(key)}" height="${size}">`;
const pixImg = (n, size = 26) => `<img class="pxi" alt="" src="assets/pixel/${n}.png" height="${size}">`;
// office backdrop: wallpaper stripes, windows, skirting board, plank floor (scroll/wallScroll move them for runners)
function officeBG(ctx, W, H, floorY, { scroll = 0, wallScroll = 0, windows = [], plank = 18 } = {}) {
  ctx.fillStyle = PAL.wall; ctx.fillRect(0, 0, W, floorY);
  ctx.fillStyle = 'rgba(232,207,174,.35)'; for (let x = -(((wallScroll % 48) + 48) % 48); x < W; x += 48) ctx.fillRect(x, 0, 20, floorY);
  const span = W + 200;
  for (const [n, x, y, k] of windows) { const wx = (((x - wallScroll) % span) + span) % span - 100; drawPixAt(ctx, n, wx, y + PIX_SZ[n][1] * k, k); }
  ctx.fillStyle = '#e8cfae'; ctx.fillRect(0, floorY - 10, W, 10); ctx.fillStyle = PAL.ink; ctx.fillRect(0, floorY - 2, W, 2);
  ctx.fillStyle = PAL.floor; ctx.fillRect(0, floorY, W, H - floorY);
  ctx.fillStyle = PAL.floorLine;
  for (let y = floorY + plank, row = 0; y < H + plank; y += plank, row++) {
    ctx.fillRect(0, y, W, 2); const off = (row % 2 ? 60 : 0) - (((scroll % 120) + 120) % 120);
    for (let x = off; x < W; x += 120) ctx.fillRect(x, y - plank + 2, 2, plank - 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, floorY, W, 4);
}
// particles, pop-up text, screen shake, hit-stop and flashes for canvas games.
// loop: const d = fx.step(dt) (0 while hit-stopped) · draw: fx.pre(ctx) ... fx.post(ctx, W, H)
function makeFX() {
  const P = [], T = []; let shT = 0, shA = 0, stop = 0, flT = 0, flMax = 1, flC = '#fff';
  return {
    burst(x, y, o = {}) {
      const n = o.n || 12;
      for (let i = 0; i < n; i++) {
        const a = (o.dir ?? -Math.PI / 2) + (rnd() - .5) * (o.spread ?? Math.PI * 2), sp = (o.speed || 220) * (.35 + rnd() * .8);
        P.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.grav ?? 500, t: 0, life: (o.life || .7) * (.6 + rnd() * .7),
          s: (o.size || 5) * (.6 + rnd() * .8), c: pick(rnd, o.colors || ['#fff']), shape: o.shape || 'sq', rot: rnd() * 6, vr: (rnd() - .5) * 14, drag: o.drag ?? 1.2 });
      }
    },
    text(x, y, s, o = {}) { T.push({ x, y, s, c: o.color || PAL.pink, size: o.size || 26, t: 0, life: o.life || .9, rise: o.rise ?? 44 }); },
    shake(a = 6, t = .25) { shA = Math.max(shT > 0 ? shA : 0, a); shT = Math.max(shT, t); },
    hitstop(t = .06) { stop = Math.max(stop, t); },
    flash(c = '#fff', t = .18) { flC = c; flT = flMax = t; },
    step(dt) {
      shT = Math.max(0, shT - dt); flT = Math.max(0, flT - dt);
      for (const p of P) { p.t += dt; p.vy += p.g * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      for (let i = P.length - 1; i >= 0; i--) if (P[i].t >= P[i].life) P.splice(i, 1);
      for (const t of T) t.t += dt; for (let i = T.length - 1; i >= 0; i--) if (T[i].t >= T[i].life) T.splice(i, 1);
      if (stop > 0) { stop -= dt; return 0; } return dt;
    },
    pre(ctx) { ctx.save(); if (shT > 0) { const a = shA * Math.min(1, shT * 5); ctx.translate((rnd() - .5) * 2 * a, (rnd() - .5) * 2 * a); } },
    post(ctx, W, H) {
      for (const p of P) {
        const a = 1 - p.t / p.life; ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.c;
        if (p.shape === 'paper') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s, -p.s * .7, p.s * 2, p.s * 1.4); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1; ctx.strokeRect(-p.s, -p.s * .7, p.s * 2, p.s * 1.4); ctx.restore(); }
        else if (p.shape === 'star') { const s = p.s * a; ctx.fillRect(p.x - s, p.y - s / 3, s * 2, s * 2 / 3); ctx.fillRect(p.x - s / 3, p.y - s, s * 2 / 3, s * 2); }
        else if (p.shape === 'puff') { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + p.t / p.life), 0, 7); ctx.fill(); }
        else { const s = Math.ceil(p.s); ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
      }
      ctx.globalAlpha = 1;
      for (const t of T) {
        const k = t.t / t.life, sc = k < .12 ? .4 + k / .12 * .9 : k < .25 ? 1.3 - (k - .12) / .13 * .3 : 1;
        ctx.save(); ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1; ctx.translate(t.x, t.y - t.rise * Math.min(1, k * 1.6)); ctx.scale(sc, sc);
        ctx.font = `800 ${t.size}px Kanit, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, t.size / 5); ctx.strokeStyle = PAL.ink; ctx.strokeText(t.s, 0, 0); ctx.fillStyle = t.c; ctx.fillText(t.s, 0, 0); ctx.restore();
      }
      if (flT > 0) { ctx.globalAlpha = flT / flMax * .55; ctx.fillStyle = flC; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalAlpha = 1; }
      ctx.restore();
    },
  };
}
const CONFETTI = [PAL.pink, PAL.yel, PAL.blue, PAL.green, PAL.orange, '#fff'];
// DOM juice for the non-canvas games: particles, shake and flash on any positioned element
function domBurst(host, x, y, o = {}) {
  const n = o.n || 10;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), a = rnd() * Math.PI * 2, d = (o.dist || 60) * (.4 + rnd() * .8), sz = (o.size || 8) * (.6 + rnd() * .8);
    s.className = 'jp'; s.style.cssText = `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${pick(rnd, o.colors || CONFETTI)}`;
    host.appendChild(s);
    s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px)) rotate(${rnd() * 360}deg) scale(.4)`, opacity: 0 }],
      { duration: 500 + rnd() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => s.remove();
  }
}
function domShake(el, a = 8) {
  el.animate([{ transform: 'none' }, { transform: `translate(${-a}px,${a / 3}px)` }, { transform: `translate(${a}px,${-a / 3}px)` }, { transform: `translate(${-a / 2}px,0)` }, { transform: 'none' }], { duration: 280 });
}
function domFlash(el, color = 'rgba(255,77,77,.35)') {
  const f = document.createElement('i'); f.className = 'jflash'; f.style.background = color; el.appendChild(f);
  f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => f.remove();
}

/* =================================================================
   Printer Tetris — paper of different sizes falls into the output tray
================================================================= */
function tetrisGame(root, api) {
  const COLS = 10, ROWS = 20, C = 26, W = 400, H = ROWS * C + 12, BX = 6, BY = 6;
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
  const { ctx } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let bag = [], cur = null, next = null, score = 0, lines = 0, level = 1, fall = 0, lock = 0, running = false, over = false, flash = [], flashT = 0, trail = null, nextPop = 0;
  const draw7 = () => { if (!bag.length) bag = Object.keys(SHAPES).sort(() => rnd() - .5); return bag.pop(); };
  const make = t => ({ t, m: SHAPES[t].m.map(r => r.slice()), x: t === 'O' ? 4 : 3, y: t === 'I' ? -1 : 0 });
  const fits = (m, x, y) => m.every((r, j) => r.every((v, i) => !v || (x + i >= 0 && x + i < COLS && y + j < ROWS && (y + j < 0 || !grid[y + j][x + i]))));
  const rot = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
  const cellsOf = p => p.m.flatMap((r, j) => r.map((v, i) => v ? [p.x + i, p.y + j] : null).filter(Boolean));
  function spawn() { cur = next ? make(next) : make(draw7()); next = draw7(); nextPop = 1; if (!fits(cur.m, cur.x, cur.y)) gameOver(); }
  function hud() { q('sc').textContent = fmt(score); q('ln').textContent = lines; q('lv').textContent = level; }
  function place(hardDrop) {
    const cells = cellsOf(cur);
    cells.forEach(([x, y]) => { if (y >= 0) grid[y][x] = cur.t; });
    // landing dust under the piece
    for (const [x, y] of cells) if (y + 1 >= ROWS || grid[y + 1]?.[x]) fx.burst(BX + x * C + C / 2, BY + (y + 1) * C, { n: 3, colors: ['#d9dde3', '#fff'], speed: 70, grav: -40, size: 5, shape: 'puff', life: .35, spread: Math.PI, dir: -Math.PI / 2 });
    if (hardDrop) fx.shake(3, .12);
    const full = []; grid.forEach((r, j) => { if (r.every(Boolean)) full.push(j); });
    if (full.length) {
      flash = full; flashT = .22; api.sfx(full.length >= 4 ? 'level' : 'good');
      const pts = [0, 100, 300, 500, 800][full.length] * level, lv0 = level;
      score += pts; lines += full.length; level = 1 + Math.floor(lines / 10);
      for (const j of full) for (let i = 0; i < COLS; i += 2) fx.burst(BX + i * C + C, BY + j * C + C / 2, { n: 3, colors: ['#fffdf6', '#fffdf6', SHAPES[grid[j][i]].c], speed: 260, grav: 700, size: 6, shape: 'paper', life: .9 });
      const cy = BY + full[0] * C;
      if (full.length >= 4) { fx.text(BX + COLS * C / 2, cy, 'PRINTER TETRIS!', { color: PAL.yel, size: 26, life: 1.3 }); fx.flash(PAL.yel, .25); fx.hitstop(.09); fx.shake(9, .35); }
      else { fx.text(BX + COLS * C / 2, cy, `+${fmt(pts)}`, { color: '#fff', size: 22 + full.length * 3 }); fx.shake(2 + full.length * 2, .2); }
      if (level > lv0) fx.text(BX + COLS * C / 2, H / 2, `⚡ เลเวล ${level}!`, { color: PAL.pink, size: 30, life: 1.4, rise: 20 });
    } else api.sfx('tick');
    if (cur.y < 0) return gameOver();
    cur = null; hud();
  }
  function clearFlash() { for (const j of flash) { grid.splice(j, 1); grid.unshift(Array(COLS).fill(null)); } flash = []; spawn(); }
  function gameOver() { if (over) return; over = true; running = false; fx.shake(8, .4); fx.flash(PAL.red, .3); api.after(.8, () => api.end(score, `${lines} แถว · เลเวล ${level}`, false, { lines, level })); }
  const move = dx => { if (cur && fits(cur.m, cur.x + dx, cur.y)) { cur.x += dx; lock = 0; } };
  const turn = () => { if (!cur) return; const m = rot(cur.m); for (const k of [0, -1, 1, -2, 2]) if (fits(m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; lock = 0; return; } };
  const soft = () => { if (cur && fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; fall = 0; } };
  const hard = () => {
    if (!cur) return; const y0 = cur.y; while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 2; }
    trail = { cells: cellsOf(cur).map(([x]) => x), y0, y1: cur.y, t: .15 };
    place(true); if (!flash.length && !over) spawn();
  };
  const act = f => () => { if (running && !api.paused && !flash.length) f(); };
  api.onKey(e => { const k = e.key; const map = { ArrowLeft: () => move(-1), a: () => move(-1), ArrowRight: () => move(1), d: () => move(1), ArrowUp: turn, w: turn, x: turn, ArrowDown: soft, s: soft, ' ': hard };
    if (map[k]) { e.preventDefault(); act(map[k])(); } });
  g2pad(root, [['◀', act(() => move(-1))], ['⟳', act(turn)], ['▶', act(() => move(1))], ['▼', act(soft)], ['⤓ ทิ้ง', act(hard)]]);
  // one sheet of paper: white page, coloured header strip, ruled lines
  function cell(x, y, t, alpha = 1) {
    const s = SHAPES[t]; ctx.globalAlpha = alpha;
    ctx.fillStyle = PAL.ink; ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    ctx.fillStyle = PAL.paper; ctx.fillRect(x + 3, y + 3, C - 6, C - 6);
    ctx.fillStyle = s.c; ctx.fillRect(x + 3, y + 3, C - 6, 5);
    ctx.fillStyle = 'rgba(43,33,64,.2)'; ctx.fillRect(x + 6, y + 12, C - 12, 2); ctx.fillRect(x + 6, y + 17, C - 16, 2);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x + 3, y + 8, 2, C - 11);
    ctx.globalAlpha = 1;
  }
  function draw() {
    fx.pre(ctx);
    officeBG(ctx, W, H, H - 46, { windows: [['window', 340, 160, 3]] });
    drawPixAt(ctx, 'plant', 372, H - 40, 3);
    // printer body around the tray
    ctx.fillStyle = PAL.ink; ctx.fillRect(BX - 6, BY - 6, COLS * C + 12, ROWS * C + 12);
    ctx.fillStyle = '#d9dde3'; ctx.fillRect(BX - 4, BY - 4, COLS * C + 8, ROWS * C + 8);
    ctx.fillStyle = '#3d3a4f'; ctx.fillRect(BX, BY, COLS * C, ROWS * C);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 1; i < COLS; i++) ctx.fillRect(BX + i * C, BY, 1, ROWS * C);
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { const t = grid[j][i]; if (t) cell(BX + i * C, BY + j * C, t); }
    for (const j of flash) { ctx.globalAlpha = Math.min(1, flashT * 6); ctx.fillStyle = '#fff'; ctx.fillRect(BX, BY + j * C, COLS * C, C); ctx.globalAlpha = 1; }
    if (trail) { ctx.fillStyle = `rgba(255,255,255,${trail.t * 1.6})`; for (const x of new Set(trail.cells)) ctx.fillRect(BX + x * C + 4, BY + Math.max(0, trail.y0) * C, C - 8, (trail.y1 - Math.max(0, trail.y0)) * C); }
    if (cur) {
      let gy = cur.y; while (fits(cur.m, cur.x, gy + 1)) gy++;
      cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && gy + j >= 0) cell(BX + (cur.x + i) * C, BY + (gy + j) * C, cur.t, .22); }));
      cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && cur.y + j >= 0) cell(BX + (cur.x + i) * C, BY + (cur.y + j) * C, cur.t); }));
    }
    const px = COLS * C + 16;
    txt(ctx, 'ชิ้นต่อไป', px + 60, 24, 15, PAL.ink, 'center', 700);
    rrect(ctx, px, 40, 120, 100, 10, '#fff', PAL.ink);
    if (next) {
      const m = SHAPES[next].m, n = m.length, s = 22 * (1 + nextPop * .25), ox = px + 60 - n * s / 2, oy = 90 - n * s / 2;
      m.forEach((r, j) => r.forEach((v, i) => { if (v) { ctx.save(); ctx.translate(ox + i * s, oy + j * s); ctx.scale(s / C, s / C); cell(0, 0, next); ctx.restore(); } }));
      txt(ctx, SHAPES[next].n, px + 60, 154, 13, PAL.muted);
    }
    drawPixAt(ctx, 'printer', px + 60, 262, 7, { sy: 1 + Math.sin(performance.now() / 90) * (running ? .02 : 0) });
    txt(ctx, 'เคลียร์ 4 แถวพร้อมกัน', px + 60, 285, 12, PAL.ink); txt(ctx, '= 800 × เลเวล', px + 60, 302, 12, PAL.pink, 'center', 700);
    fx.post(ctx, W, H);
  }
  api.loop(dt => {
    const d = fx.step(dt); nextPop = Math.max(0, nextPop - dt * 5); if (trail && (trail.t -= dt) <= 0) trail = null;
    if (running && d) {
      if (flash.length) { flashT -= d; if (flashT <= 0) clearFlash(); }
      else if (cur) {
        fall += d; const speed = Math.max(.07, .8 - (level - 1) * .07);
        if (fits(cur.m, cur.x, cur.y + 1)) { lock = 0; if (fall >= speed) { cur.y++; fall = 0; } }
        else { lock += d; if (lock > .45) { lock = 0; place(false); if (!flash.length && !over) spawn(); } }
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
  const { cv, ctx } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let docs = [], speed = 150, gap = 0, made = 0, lives = 3, score = 0, combo = 0, maxc = 0, perfect = 0, running = false, over = false, press = 0, beltOff = 0;
  function hud() { q('hp').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives); q('sc').textContent = fmt(score); q('cb').textContent = combo >= 3 ? `🔥 คอมโบ ${combo}` : ''; }
  function spawn() { made++; const draft = made > 8 && rnd() < .2; docs.push({ x: -80, name: pick(rnd, DOCS), draft, stamped: false, done: false, mark: '', sq: 0 }); }
  function lose(msg) {
    lives--; combo = 0; api.sfx('bad'); fx.text(SX, 130, msg, { color: PAL.red, size: 22, life: 1.1 }); fx.shake(8, .3); fx.flash(PAL.red, .25); hud();
    if (lives <= 0 && !over) { over = true; running = false; api.after(.8, () => api.end(score, `Perfect ${perfect} · คอมโบ ${maxc}`, false, { perfect, combo: maxc, docs: made })); }
  }
  function stamp() {
    if (!running || api.paused || press > 0) return; press = .18; api.sfx('stamp');
    let best = null, bd = 1e9; for (const d of docs) { if (d.stamped) continue; const dd = Math.abs(d.x - SX); if (dd < bd) { bd = dd; best = d; } }
    if (!best || bd > 60) { combo = 0; fx.text(SX, 130, 'ปั๊มพลาด!', { color: '#d9d2e6', size: 22 }); fx.shake(2, .1); hud(); return; }
    best.stamped = true; best.sq = 1;
    if (best.draft) { best.mark = 'void'; return lose('❌ เอกสารร่าง ห้ามปั๊ม!'); }
    const [label, pts] = bd < 10 ? ['PERFECT', 30] : bd < 26 ? ['GOOD', 20] : ['OK', 10];
    if (label === 'PERFECT') perfect++;
    combo++; maxc = Math.max(maxc, combo);
    score += Math.round(pts * (1 + Math.floor(combo / 10) * .5)); best.mark = 'ok';
    // ink splatter where the stamp hit, harder feedback the closer it was
    fx.burst(best.x, BELT_Y - 29, { n: label === 'PERFECT' ? 16 : 9, colors: [PAL.red, '#ff6b6b', '#b3203a'], speed: 200, grav: 300, size: 4, life: .45 });
    if (label === 'PERFECT') { fx.shake(7, .18); fx.hitstop(.07); fx.burst(best.x, BELT_Y - 60, { n: 10, colors: [PAL.yel, '#fff'], speed: 260, grav: 0, size: 7, shape: 'star', life: .5 }); api.sfx('good'); }
    else fx.shake(label === 'GOOD' ? 4 : 2, .12);
    fx.text(SX, 125, label, { color: label === 'PERFECT' ? PAL.pink : label === 'GOOD' ? PAL.orange : PAL.green, size: label === 'PERFECT' ? 34 : 26 });
    if (combo > 0 && combo % 10 === 0) { fx.text(SX, 80, `🔥 คอมโบ ${combo}!`, { color: PAL.yel, size: 30, life: 1.2 }); fx.burst(SX, 90, { n: 24, colors: CONFETTI, speed: 320, grav: 500, size: 6, shape: 'paper', life: 1 }); }
    hud();
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); stamp(); });
  api.onKey(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stamp(); } });
  function doc(d) {
    const x = d.x - 50, y = BELT_Y - 118, sq = d.sq;
    ctx.save(); ctx.translate(d.x, BELT_Y); ctx.scale(1 + sq * .08, 1 - sq * .12); ctx.rotate(Math.sin(d.x / 60) * .03); ctx.translate(-d.x, -BELT_Y);
    ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.fillRect(x + 6, y + 6, 100, 116);
    rrect(ctx, x, y, 100, 116, 4, d.draft ? '#e9e4ef' : PAL.paper, PAL.ink);
    txt(ctx, d.name, d.x, y + 16, 13, PAL.ink);
    ctx.fillStyle = 'rgba(43,33,64,.2)'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 12, y + 30 + i * 10, 76 - (i % 2) * 18, 3);
    if (d.draft) { txt(ctx, 'ร่าง', d.x, y + 82, 18, PAL.red, 'center', 800); txt(ctx, 'ห้ามปั๊ม', d.x, y + 100, 11, PAL.red); }
    else { ctx.setLineDash([4, 3]); ctx.strokeStyle = PAL.blue; ctx.lineWidth = 2; ctx.strokeRect(d.x - 26, y + 74, 52, 30); ctx.setLineDash([]); }
    if (d.mark === 'ok') { ctx.save(); ctx.translate(d.x, y + 89); ctx.rotate(-.2); ctx.strokeStyle = PAL.red; ctx.lineWidth = 3; ctx.strokeRect(-36, -14, 72, 28); txt(ctx, 'APPROVED', 0, 1, 13, PAL.red, 'center', 800); ctx.restore(); }
    if (d.mark === 'void') { ctx.strokeStyle = PAL.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 10, y + 10); ctx.lineTo(x + 90, y + 106); ctx.moveTo(x + 90, y + 10); ctx.lineTo(x + 10, y + 106); ctx.stroke(); }
    ctx.restore();
  }
  function draw() {
    fx.pre(ctx);
    officeBG(ctx, W, H, BELT_Y + 42, { windows: [['window', 112, 20, 4], ['window2', 612, 20, 4]] });
    drawPixAt(ctx, 'plant', 672, BELT_Y + 2, 3); drawPixAt(ctx, 'clock', SX + 170, 40, 3);
    // conveyor: dark belt with moving pixel treads and rollers
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, BELT_Y - 2, W, 40);
    ctx.fillStyle = '#4a4458'; ctx.fillRect(0, BELT_Y, W, 30);
    ctx.fillStyle = '#6b6478'; for (let x = -40 + beltOff % 40; x < W; x += 40) ctx.fillRect(x, BELT_Y + 6, 20, 4);
    ctx.fillStyle = '#8a93a3'; for (let x = 20; x < W; x += 80) ctx.fillRect(x, BELT_Y + 30, 16, 8);
    // target zone
    ctx.fillStyle = 'rgba(255,92,138,.14)'; ctx.fillRect(SX - 26, BELT_Y - 118, 52, 118);
    ctx.fillStyle = 'rgba(255,92,138,.5)'; ctx.fillRect(SX - 26, BELT_Y - 2, 52, 3);
    for (const d of docs) doc(d);
    // stamp arm with a squash when it lands
    const k = press > 0 ? 1 - Math.abs(press - .09) / .09 : 0, down = k * 40;
    ctx.fillStyle = '#8d5a3b'; ctx.fillRect(SX - 6, 0, 12, 40 + down);
    ctx.save(); ctx.translate(SX, 72 + down); ctx.scale(1 + k * .15, 1 - k * .12);
    rrect(ctx, -34, -36, 68, 30, 8, PAL.red, PAL.ink); rrect(ctx, -40, -10, 80, 10, 3, PAL.ink);
    txt(ctx, 'APPROVED', 0, -21, 11, '#fff', 'center', 800); ctx.restore();
    txt(ctx, `ความเร็วสายพาน ${Math.round(speed)}`, 12, H - 14, 12, '#fff3e0', 'left');
    fx.post(ctx, W, H);
  }
  api.loop(dt => {
    const d = fx.step(dt);
    if (running && d) {
      speed = Math.min(520, 150 + made * 7); gap -= d * speed; beltOff += d * speed;
      if (gap <= 0) { spawn(); gap = 170 + rnd() * 140; }
      for (const o of docs) { o.x += speed * d; if (!o.done && o.x > SX + 60) { o.done = true; if (!o.stamped && !o.draft) lose('⏰ หลุดไปไม่ได้ปั๊ม!'); } }
      docs = docs.filter(o => o.x < W + 80);
    }
    for (const o of docs) o.sq = Math.max(0, o.sq - dt * 5);
    press = Math.max(0, press - dt);
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
  const W = 760, H = 420, TOTAL = 90, COUNTER = 262;
  // [key, label, liquid colour in the cup]
  const ING = [['shot', 'ช็อต', '#6b3e26'], ['milk', 'นม', '#fffdf6'], ['ice', 'น้ำแข็ง', '#bfe9ff'], ['choco', 'ช็อกโกแลต', '#7a4a2a'], ['water', 'น้ำ', '#9fdcff'], ['tea', 'ชา', '#e0913b']];
  const MENU = [{ n: 'อเมริกาโน่', r: ['shot', 'water'] }, { n: 'ลาเต้', r: ['shot', 'milk'] }, { n: 'ลาเต้เย็น', r: ['shot', 'milk', 'ice'] },
    { n: 'มอคค่า', r: ['shot', 'milk', 'choco'] }, { n: 'โกโก้เย็น', r: ['choco', 'milk', 'ice'] }, { n: 'ชาเย็น', r: ['tea', 'milk', 'ice'] },
    { n: 'ชาร้อน', r: ['tea', 'water'] }, { n: 'เอสเพรสโซ่', r: ['shot'] }];
  const FACES = ['p_office', 'p_woffice', 'p_whealth', 'p_tech', 'p_cat', 'p_dog'];
  root.innerHTML = `<div class="hud"><div class="timer" data-k="tm"><div data-k="bar"></div></div><span>⏱ <b data-k="t">${TOTAL}</b></span><span>⭐ <b data-k="sc">0</b></span><span data-k="hp"></span></div>`;
  const { cv, ctx, at } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let slots = [null, null, null], leaving = [], cup = [], time = TOTAL, el = 0, score = 0, served = 0, hearts = 3, next = 1, running = false, over = false, wob = 0, t = 0;
  const SLOT_X = [140, 380, 620], CUP_X = W / 2;
  const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const ingOf = k => ING.find(z => z[0] === k);
  function hud() { q('t').textContent = Math.ceil(time); q('sc').textContent = fmt(score); q('bar').style.width = time / TOTAL * 100 + '%'; q('tm').classList.toggle('low', time < 15);
    q('hp').textContent = '❤️'.repeat(hearts) + '🖤'.repeat(3 - hearts); }
  function end() { if (over) return; over = true; running = false; api.end(score, `เสิร์ฟ ${served} แก้ว`, false, { served }); }
  function spawn() { const free = slots.map((s, i) => s ? -1 : i).filter(i => i >= 0); if (!free.length) return;
    const i = pick(rnd, free), m = pick(rnd, el < 25 ? MENU.slice(0, 5) : MENU), pat = Math.max(11, 20 - el * .09);
    slots[i] = { m, face: pick(rnd, FACES), pat, max: pat, in: 0 }; }
  function add(k) {
    if (!running || api.paused) return; if (cup.length >= 4) { fx.text(CUP_X, 270, 'แก้วเต็มแล้ว!', { color: PAL.orange, size: 20 }); fx.shake(2, .1); return; }
    cup.push(k); wob = 1; api.sfx('tick');
    fx.burst(CUP_X, 400 - cup.length * 22, { n: 8, colors: [ingOf(k)[2], '#fff'], speed: 160, grav: 600, size: 4, life: .5, spread: 1.6 });
  }
  function serve(i) {
    if (!running || api.paused || !cup.length) return;
    if (i == null) i = slots.findIndex(s => s && same(s.m.r, cup));
    const s = slots[i];
    if (!s || !same(s.m.r, cup)) {
      api.sfx('bad'); score = Math.max(0, score - 10); fx.text(CUP_X, 250, '❌ ไม่ตรงออเดอร์ −10', { color: PAL.red, size: 22 }); fx.shake(6, .25); fx.flash(PAL.red, .2);
      if (s) s.pat -= 3; cup = []; hud(); return;
    }
    const tip = Math.round(s.pat / s.max * 20), pts = 30 + s.m.r.length * 5 + tip; score += pts; served++; api.sfx('good');
    const x = SLOT_X[i];
    fx.burst(x, 170, { n: 22, colors: CONFETTI, speed: 300, grav: 500, size: 6, shape: 'paper', life: .9 });
    fx.burst(x, 150, { n: 6, colors: [PAL.yel], speed: 200, grav: 0, size: 7, shape: 'star', life: .5 });
    fx.text(x, 120, `+${pts}`, { color: PAL.yel, size: 30 }); if (tip >= 15) fx.text(x, 80, 'ทิปเพียบ! 💸', { color: PAL.green, size: 18 });
    leaving.push({ x, face: s.face, t: 0, happy: true }); slots[i] = null; cup = []; hud();
  }
  const clear = () => { if (cup.length) fx.burst(CUP_X, 360, { n: 10, colors: cup.map(k => ingOf(k)[2]), speed: 120, grav: 700, size: 4, life: .5 }); cup = []; };
  api.onKey(e => { const n = +e.key; if (n >= 1 && n <= ING.length) { e.preventDefault(); add(ING[n - 1][0]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); serve(null); } else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clear(); } });
  cv.addEventListener('pointerdown', e => { const p = at(e); const i = SLOT_X.findIndex(x => Math.abs(p.x - x) < 90 && p.y < 260); if (i >= 0 && slots[i]) serve(i); });
  g2pad(root, [...ING.map(([k, n]) => [`${pxImg(k, 22)}<small> ${n}</small>`, () => add(k)]), ['🗑️ เท', clear], ['🛎️ เสิร์ฟ', () => serve(null)]]);
  const person = (face, x, by, o) => drawPixAt(ctx, face, x, by, face === 'p_dog' || face === 'p_cat' ? 4 : 4.4, o);
  function draw() {
    fx.pre(ctx);
    officeBG(ctx, W, H, COUNTER, { windows: [['window', 58, 14, 3], ['window2', 702, 14, 3]] });
    drawPixAt(ctx, 'vending', 260, COUNTER, 3); drawPixAt(ctx, 'plant', 500, COUNTER, 3);
    slots.forEach((s, i) => {
      if (!s) return; const x = SLOT_X[i], f = s.pat / s.max, hop = (1 - s.in) * 60, angry = f < .3;
      const jit = angry ? (rnd() - .5) * 4 : 0, bob = Math.sin(t * 4 + i) * .025;
      person(s.face, x + jit, 238 + hop, { sy: 1 + bob, sx: 1 - bob });
      ctx.save(); ctx.translate(x, 60); const bs = s.in < 1 ? .6 + s.in * .4 : 1; ctx.scale(bs, bs);
      rrect(ctx, -92, -42, 184, 86, 14, '#fff', PAL.ink);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-10, 43); ctx.lineTo(0, 56); ctx.lineTo(10, 43); ctx.fill();
      txt(ctx, s.m.n, 0, -22, 16, PAL.ink, 'center', 700);
      const n = s.m.r.length; s.m.r.forEach((k, j) => drawPixAt(ctx, pxa(k), (j - (n - 1) / 2) * 38, 20, 3.4));
      rrect(ctx, -70, 26, 140, 9, 4, '#eee'); rrect(ctx, -70, 26, Math.max(4, 140 * f), 9, 4, angry ? (Math.floor(t * 8) % 2 ? PAL.red : '#ff9b9b') : PAL.green);
      ctx.restore();
      if (angry) txt(ctx, '💢', x + 44, 140, 22);
    });
    for (const l of leaving) person(l.face, l.x + l.t * 160, 238 - Math.abs(Math.sin(l.t * 14)) * 16, { alpha: 1 - l.t, flip: true });
    // counter + machines
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, COUNTER - 2, W, 24); ctx.fillStyle = '#d9a066'; ctx.fillRect(0, COUNTER, W, 18);
    ctx.fillStyle = '#9b6a45'; ctx.fillRect(0, COUNTER + 22, W, H - COUNTER - 22);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < W; x += 64) ctx.fillRect(x, COUNTER + 22, 2, H);
    drawPixAt(ctx, 'desktop', 70, 392, 7); drawPixAt(ctx, 'fax', 690, 396, 5);
    // the cup: liquid layers stack up, wobble when something is added
    const cx = CUP_X, top = 300, bot = 402, cw = 84, sq = Math.sin(wob * 20) * wob * .06;
    ctx.save(); ctx.translate(cx, bot); ctx.scale(1 + sq, 1 - sq); ctx.translate(-cx, -bot);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cx - cw / 2, top, cw, bot - top);
    let ly = bot - 4; const lh = 22;
    cup.forEach((k, j) => {
      const c = ingOf(k)[2], wave = j === cup.length - 1 ? Math.sin(t * 12) * 2 * wob : 0;
      ctx.fillStyle = c; ctx.fillRect(cx - cw / 2 + 4, ly - lh + wave, cw - 8, lh - wave);
      if (k === 'ice') { ctx.fillStyle = '#fff'; ctx.fillRect(cx - 24, ly - 16, 12, 10); ctx.fillRect(cx + 6, ly - 18, 12, 10); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1; ctx.strokeRect(cx - 24, ly - 16, 12, 10); ctx.strokeRect(cx + 6, ly - 18, 12, 10); }
      ly -= lh;
    });
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3; ctx.strokeRect(cx - cw / 2, top, cw, bot - top);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(cx - cw / 2 + 6, top + 8, 5, bot - top - 16);
    ctx.restore();
    if (!cup.length) txt(ctx, 'แก้วว่าง', cx, 352, 13, PAL.muted);
    fx.post(ctx, W, H);
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt; wob = Math.max(0, wob - dt * 2.5);
    for (const s of slots) if (s) s.in = Math.min(1, s.in + dt * 4);
    for (const l of leaving) l.t += dt * 1.6; leaving = leaving.filter(l => l.t < 1);
    if (running && d) {
      el += d; time -= d; next -= d;
      if (next <= 0) { spawn(); next = Math.max(2.2, 5.5 - el * .04); }
      slots.forEach((s, i) => { if (s) { s.pat -= d; if (s.pat <= 0) { leaving.push({ x: SLOT_X[i], face: s.face, t: 0 }); slots[i] = null; hearts--; api.sfx('bad');
        fx.text(SLOT_X[i], 150, '😤 รอไม่ไหว!', { color: PAL.red, size: 22 }); fx.shake(6, .25); } } });
      if (time <= 0 || hearts <= 0) { time = Math.max(0, time); hud(); end(); } else hud();
    }
    draw();
  });
  hud(); draw();
  api.intro({ how: `<p>☕ พักเที่ยงคิวยาว! ผสมเครื่องดื่มตามที่ลูกค้าสั่งในบับเบิล แล้วเสิร์ฟให้ทันก่อนหลอดความอดทนหมด</p>
      <p>⌨️ ปุ่ม <b>1–6</b> ใส่วัตถุดิบ (${ING.map(([k]) => pxImg(k, 18)).join(' ')}) · <b>Enter</b> เสิร์ฟ · <b>Backspace</b> เทแก้วทิ้ง — หรือแตะปุ่มใต้จอ / แตะลูกค้า</p>
      <p>⭐ เสิร์ฟไวได้ทิปเยอะ · ลูกค้าเดินหนี 3 คน หรือหมดเวลา ${TOTAL} วิ = จบ</p>`,
    buttons: [{ label: '☕ เปิดร้าน!', primary: true, go() { running = true; spawn(); } }] });
}

/* =================================================================
   Paper Toss — flick a paper ball into the bin, mind the fan
================================================================= */
function tossGame(root, api) {
  const W = 720, H = 420, G = 900, FLOOR = 372, THROWS = 10, R = 11, START = { x: 100, y: 300 };
  root.innerHTML = `<div class="hud"><span>🗑️ ลงถัง <b data-k="mk">0</b>/<b data-k="th">0</b></span><span>⭐ <b data-k="sc">0</b></span><span data-k="st" class="muted"></span><span class="muted g2tip">ลากลูกบอลถอยหลังแล้วปล่อย · หรือ ←→ เล็ง + กด Space ค้างเพื่อออกแรง</span></div>`;
  const { cv, ctx, at } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let ball = null, drag = null, wind = 0, throws = 0, made = 0, score = 0, streak = 0, running = false, over = false, binX = 520, aim = -.9, power = 0, charging = false, t = 0, rimHit = false;
  let fanA = 0, binSq = 0, throwSq = 0, trail = [], streaks = [];
  const BIN_K = 6, BIN_W = 9 * BIN_K, BIN_H = 14 * BIN_K;
  function newThrow() { wind = throws < 2 ? 0 : (rnd() * 2 - 1) * Math.min(1, .3 + throws * .1); ball = { x: START.x, y: START.y, vx: 0, vy: 0, fly: false, rot: 0 }; rimHit = false; trail = []; }
  function hud() { q('mk').textContent = made; q('th').textContent = throws; q('sc').textContent = fmt(score); q('st').textContent = streak >= 2 ? `🔥 ติดกัน ${streak}` : ''; }
  function launch(vx, vy) { if (!running || !ball || ball.fly || api.paused) return; ball.vx = vx; ball.vy = vy; ball.fly = true; throws++; throwSq = 1; api.sfx('tick'); hud(); }
  function result(ok, swish) {
    const top = FLOOR - BIN_H;
    if (ok) {
      made++; streak++; const p = 100 + (swish ? 50 : 0) + (streak - 1) * 25; score += p; binSq = 1;
      fx.burst(binX, top, { n: swish ? 30 : 18, colors: CONFETTI, speed: 320, grav: 600, size: 6, shape: 'paper', life: 1, dir: -Math.PI / 2, spread: 1.6 });
      if (swish) { fx.flash(PAL.yel, .22); fx.hitstop(.08); fx.shake(7, .25); fx.burst(binX, top - 10, { n: 10, colors: [PAL.yel, '#fff'], speed: 240, grav: 0, size: 8, shape: 'star', life: .6 }); }
      else fx.shake(4, .15);
      fx.text(binX, top - 30, swish ? `SWISH! +${p}` : `ลงถัง +${p}`, { color: swish ? PAL.yel : PAL.green, size: swish ? 32 : 26, life: 1.1 });
      if (streak >= 3) fx.text(W / 2, 110, `🔥 ติดกัน ${streak}!`, { color: PAL.orange, size: 24, life: 1.1 });
      api.sfx(swish ? 'level' : 'good');
    } else {
      streak = 0; fx.text(ball.x < 0 || ball.x > W ? W / 2 : ball.x, FLOOR - 40, 'พลาด!', { color: '#d9d2e6', size: 24 }); api.sfx('bad'); fx.shake(3, .12);
      if (ball.y >= FLOOR - R - 2) fx.burst(ball.x, FLOOR, { n: 8, colors: ['#fffdf6', '#d9dde3'], speed: 140, grav: 500, size: 4, life: .4, spread: Math.PI, dir: -Math.PI / 2 });
    }
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
    fx.pre(ctx);
    officeBG(ctx, W, H, FLOOR, { windows: [['window', 285, 30, 4]] });
    drawPixAt(ctx, 'cabinet', 672, FLOOR, 4); drawPixAt(ctx, 'plant', 210, FLOOR, 3); drawPixAt(ctx, 'calendar', 610, 120, 3);
    // wind: streaks drift across the room, the fan spins with the strength
    ctx.fillStyle = 'rgba(58,134,255,.28)'; for (const s of streaks) ctx.fillRect(s.x, s.y, s.l, 2);
    const fx0 = 440, fy = 50; ctx.fillStyle = PAL.ink; ctx.fillRect(fx0 - 3, fy, 6, 26); ctx.fillRect(fx0 - 16, fy + 24, 32, 6);
    ctx.save(); ctx.translate(fx0, fy); ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke();
    ctx.rotate(fanA); ctx.fillStyle = '#4cc3ff'; for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(0, -10, 6, 10, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.restore();
    const wl = Math.round(Math.abs(wind) * 5); txt(ctx, wind === 0 ? 'ลม: นิ่ง' : `ลม: ${wind > 0 ? '→'.repeat(wl || 1) : '←'.repeat(wl || 1)}`, 472, 50, 16, PAL.blue, 'left', 700);
    // bin (pixel sprite) with a happy squash when something lands in it
    drawPixAt(ctx, 'bin_blue', binX, FLOOR, BIN_K, { sx: 1 + binSq * .15, sy: 1 - binSq * .15 });
    // thrower at a desk
    drawPixAt(ctx, 'p_office', 64, FLOOR - 4, 3.4, { sx: 1 + throwSq * .12, sy: 1 - throwSq * .1 });
    drawPixAt(ctx, 'desk_s', 112, FLOOR, 3);
    // aim guide
    if (ball && !ball.fly) {
      let vx, vy; if (drag) { const dx = START.x - drag.x, dy = START.y - drag.y, l = Math.min(150, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); vx = Math.cos(a) * l * 5.2; vy = Math.sin(a) * l * 5.2; }
      else { const l = 30 + (charging ? power : .5) * 120; vx = Math.cos(aim) * l * 5.2; vy = Math.sin(aim) * l * 5.2; }
      ctx.fillStyle = 'rgba(43,33,64,.35)'; let x = ball.x, y = ball.y, wx = vx, wy = vy;
      for (let i = 0; i < 9; i++) { for (let k = 0; k < 4; k++) { wx += wind * 220 * .02; wy += G * .02; x += wx * .02; y += wy * .02; } ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); }
      if (charging) { rrect(ctx, 30, 200, 14, 100, 4, '#fff', PAL.ink); rrect(ctx, 31, 299 - power * 98, 12, power * 98, 3, power > .85 ? PAL.red : PAL.pink); }
    }
    for (const [i, p] of trail.entries()) { ctx.globalAlpha = i / trail.length * .4; ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8); } ctx.globalAlpha = 1;
    if (ball) { const j = charging ? (rnd() - .5) * power * 4 : 0; drawPixAt(ctx, pxa('ball'), ball.x + j, ball.y + 10.5, 3, { rot: ball.rot }); }
    fx.post(ctx, W, H);
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt;
    fanA += dt * (1 + Math.abs(wind) * 18) * Math.sign(wind || 1); binSq = Math.max(0, binSq - dt * 4); throwSq = Math.max(0, throwSq - dt * 5);
    if (Math.abs(wind) > .05 && rnd() < Math.abs(wind) * dt * 30) streaks.push({ x: wind > 0 ? -60 : W, y: 90 + rnd() * 230, l: 30 + rnd() * 50 });
    for (const s of streaks) s.x += wind * 420 * dt; streaks = streaks.filter(s => s.x > -80 && s.x < W + 10);
    if (running && throws >= 5) binX = 520 + Math.sin(t * .9) * 90;   // the bin starts moving halfway through
    if (charging) power = Math.min(1, power + dt * .8);
    if (ball && ball.fly && d) {
      trail.push({ x: ball.x, y: ball.y }); if (trail.length > 8) trail.shift(); ball.rot += ball.vx * d / R;
      for (let k = 0; k < 4; k++) {
        const s = d / 4, py = ball.y;
        ball.vx += wind * 220 * s; ball.vy += G * s; ball.x += ball.vx * s; ball.y += ball.vy * s;
        const bx = binX - BIN_W / 2, top = FLOOR - BIN_H;
        for (const rx of [bx, bx + BIN_W]) { const dx = ball.x - rx, dy = ball.y - top, dd = Math.hypot(dx, dy);
          if (dd < R + 3) { rimHit = true; const nx = dx / dd, ny = dy / dd, dot = ball.vx * nx + ball.vy * ny; if (dot < 0) { ball.vx -= 1.6 * dot * nx; ball.vy -= 1.6 * dot * ny; } ball.x = rx + nx * (R + 3); ball.y = top + ny * (R + 3);
            api.sfx('tick'); fx.burst(rx, top, { n: 5, colors: [PAL.yel, '#fff'], speed: 160, grav: 0, size: 4, life: .25 }); fx.shake(2, .08); } }
        if (py < top && ball.y >= top && ball.vy > 0 && ball.x > bx + 4 && ball.x < bx + BIN_W - 4) { result(true, !rimHit); break; }
        if (ball.y > FLOOR - R || ball.x > W + 40 || ball.x < -40) { result(false); break; }
      }
    }
    draw();
  });
  hud(); draw();
  api.intro({ how: `<p>🗑️ ปากระดาษก้อนลงถังให้ได้มากที่สุดใน ${THROWS} ลูก</p>
      <p>🖱️ <b>ลากลูกบอลถอยหลัง</b> เหมือนหนังสติ๊กแล้วปล่อย · หรือ <b>← →</b> เล็ง แล้ว <b>กด Space ค้าง</b> เพื่อออกแรง</p>
      <p>🌬️ ดูลมจากพัดลมด้านบนด้วย · ลงถังไม่โดนขอบ = <b>SWISH</b> +50 · ครึ่งหลังถังจะเลื่อนไปมา</p>`,
    buttons: [{ label: '🗑️ เริ่มปา!', primary: true, go() { running = true; newThrow(); } }] });
  return { destroy() { removeEventListener('keyup', up); } };
}
