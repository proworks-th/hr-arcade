/* =================================================================
   Prism Foundry (โรงหลอมปริซึม) — hex sort puzzle. Rules live in prism-core.js, levels in prism-levels.js,
   the daily pool in prism-daily.js. Classic script loaded after solo-games.js; uses its canvas kit
   (g2canvas, g2pad, makeFX, txt, rrect) and the hub's globals (store, rnd, pick, thaiDay). Mount: prismGame(root, api).
   Look: pastel "crystal lab" in the site's sticker style (ink outlines, hard drop shadows).
   Motion: everything eases — chips fly one by one and bounce on landing, charges send an orb to their crystal.
================================================================= */
'use strict';
function prismGame(root, api) {
  const PC = window.PrismCore, LV = window.PRISM_LEVELS, DAY = window.PRISM_DAILY || [], CAP = PC.CAP;
  const W = 760, H = 470, TOP = 66, INK = '#2b2140';
  root.innerHTML = `<div class="hud"><span data-k="lvw">⚡ ด่าน <b data-k="lv">1</b></span><span data-k="nm"></span><span>ตา <b data-k="mv">0</b> · เป้า <b data-k="par">0</b></span><span data-k="stars"></span><span class="muted g2tip" data-k="tip"></span></div>`;
  const { cv, ctx, at } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  g2pad(root, [['↩️ ย้อน', () => undo()], ['🔄 เริ่มใหม่', () => restart()], ['💡 ใบ้ <small data-k="hs"></small>', () => hint()], ['🗺️ เลือกด่าน', () => picker()]]);
  const prog = () => store.get('prism', { s: {} }), unlocked = () => { const s = prog().s; let n = 1; while (s[n] && n < LV.length) n++; return n; };
  // daily puzzle: same pool entry for everyone on the same Thai date
  const today = thaiDay(), dayIdx = Math.floor((Date.parse(today) - Date.parse('2026-01-01')) / 864e5);
  const dailyDef = DAY.length ? { ...DAY[((dayIdx % DAY.length) + DAY.length) % DAY.length], name: 'ด่านประจำวัน', tip: 'ด่านเดียวกันทั้งออฟฟิศ · ใช้ตาน้อยที่สุดได้อันดับสูงสุด' } : null;
  const dayKey = 'd' + today.replace(/-/g, ''), dayRec = () => { const r = store.get('prism_day', null); return r && r.d === today ? r : { d: today, best: 0 }; };

  let lv = 0, def = null, geo = null, st0 = null, st = null, disp = null, path = [], hist = [], lit = {}, totals = {};
  let sel = -1, steps = [], step = null, hintMv = null, hintUsed = false, plan = null, won = false, t = 0, playing = false, msg = null, hover = -1;
  let R = 50, P = [], resBox = [], shown = {};
  // eased per-slot animation values (index = board cell or reservoir)
  let liftV = [], bounce = [], pop = [], orbs = [], rings = [], locksOff = [], litPulse = {};
  const isDaily = () => typeof lv === 'string';

  /* ---------- solver in a worker (falls back to a small search on the main thread) ---------- */
  let worker = null, reqId = 0; const waiting = {};
  try { worker = new Worker('prism-worker.js?v=4'); worker.onmessage = e => { const f = waiting[e.data.id]; delete waiting[e.data.id]; f && f(e.data.res); }; } catch (e) { worker = null; }
  function think() {
    const me = { k: PC.key(st), res: undefined }; plan = me;
    const done = res => { if (plan !== me) return; me.res = res; if (me.wantHint) showHint(); };
    if (worker) { const id = ++reqId; waiting[id] = done; worker.postMessage({ id, lv, def, st }); }
    else setTimeout(() => { const r = PC.solve(geo, st, 20000); done(r === 'limit' ? PC.solveAny(geo, st, 60000) : r); }, 0);
  }

  /* ---------- level setup ---------- */
  function layout() {
    const xs = [], ys = []; for (const [qq, r] of geo.pos) { xs.push(Math.sqrt(3) * (qq + r / 2)); ys.push(1.5 * r); }
    const right = geo.nRes ? 140 : 0, bw = W - 60 - right, bh = H - TOP - 56;
    const spanX = Math.max(...xs) - Math.min(...xs) + 2, spanY = Math.max(...ys) - Math.min(...ys) + 2.2;
    R = Math.min(62, bw / spanX, bh / spanY);
    const ox = 30 + bw / 2 - (Math.max(...xs) + Math.min(...xs)) / 2 * R, oy = TOP + 22 + bh / 2 - (Math.max(...ys) + Math.min(...ys)) / 2 * R;
    P = xs.map((x, i) => ({ x: ox + x * R, y: oy + ys[i] * R }));
    resBox = []; const rh = 44 + geo.resCap * 26, gap = 18, tot = geo.nRes * rh + (geo.nRes - 1) * gap;
    for (let i = 0; i < geo.nRes; i++) resBox.push({ x: W - 122, y: TOP + 16 + (H - TOP - 40 - tot) / 2 + i * (rh + gap), w: 94, h: rh });
  }
  function startLevel(n, resume = true) {
    lv = n; def = n === dayKey ? dailyDef : LV[n - 1]; ({ geo, st: st0 } = PC.load(def)); layout();
    totals = {}; for (const s of st0.s) for (const c of s) totals[c] = (totals[c] || 0) + 1;
    st = PC.clone(st0); path = []; hist = []; lit = {}; sel = -1; steps = []; step = null; hintMv = null; hintUsed = false; won = false; msg = null;
    const N = st.s.length; liftV = Array(N).fill(0); bounce = Array(N).fill(0); pop = Array.from({ length: N }, (_, i) => -i * .045); orbs = []; rings = []; locksOff = [];
    const cur = store.get('prism_cur', null);
    if (resume && cur && cur.lv === n && Array.isArray(cur.p)) for (const [a, b] of cur.p) { if (PC.why(geo, st, a, b)) break; commit(a, b, true); }
    disp = PC.clone(st); shown = { ...lit }; playing = true; hud(); think();
  }
  function commit(a, b, quiet) {
    const r = PC.apply(geo, st, a, b);
    hist.push({ st, lit: { ...lit } }); path.push([a, b]);
    for (const w of r.waves) for (const i of w.charged) lit[w.color[i]] = (lit[w.color[i]] || 0) + 1;
    st = r.st;
    if (!quiet) store.set('prism_cur', { lv, p: path });
    return r;
  }
  // stars: par = ⭐⭐⭐ · a little over = ⭐⭐ · a hint caps at ⭐⭐
  const starsFor = mv => { const p = def.par, s = mv <= p ? 3 : mv <= p + Math.max(1, Math.ceil(p / 4)) ? 2 : 1; return hintUsed ? Math.min(2, s) : s; };
  const dailyScore = mv => Math.max(100, 1000 - Math.max(0, mv - def.par) * 40 - (hintUsed ? 300 : 0));
  function hud() {
    q('lvw').innerHTML = isDaily() ? '📅 <b>ประจำวัน</b>' : `⚡ ด่าน <b>${lv}</b>`; q('nm').textContent = isDaily() ? `เป้า ${def.par} ตา = 1000 แต้ม` : def.name;
    q('mv').textContent = path.length; q('par').textContent = def.par;
    q('stars').textContent = isDaily() ? `${dailyScore(path.length)} แต้ม` : '⭐'.repeat(starsFor(path.length)); q('tip').textContent = def.tip;
    const hs = root.querySelector('[data-k=hs]'); if (hs) hs.textContent = hintUsed ? '' : isDaily() ? '(−300 แต้ม)' : '(ได้สูงสุด ⭐⭐)';
  }

  /* ---------- input ---------- */
  const WHY = { far: 'ไกลไป · ย้ายได้แค่ช่องติดกัน หรือใส่ที่พัก', color: 'สีบนสุดไม่ตรงกัน', full: 'เต็มแล้ว', lock: 'ล็อกอยู่ · ชาร์จช่องข้างๆ เพื่อเปิด' };
  function hit(p) {
    if (!geo) return -1;
    for (let i = 0; i < geo.nRes; i++) { const b = resBox[i]; if (p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) return geo.nBoard + i; }
    let best = -1, bd = R * .92; P.forEach((c, i) => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const isRes = i => i >= geo.nBoard;
  const where = i => !isRes(i) ? P[i] : { x: resBox[i - geo.nBoard].x + resBox[i - geo.nBoard].w / 2, y: resBox[i - geo.nBoard].y + resBox[i - geo.nBoard].h / 2 };
  // where chip number k of slot i sits (centre of its top face) and how big it is
  function slotPos(i, k) {
    if (!isRes(i)) return { x: P[i].x, y: P[i].y + R * .32 - k * R * .2, cr: R * .6 };
    const b = resBox[i - geo.nBoard]; return { x: b.x + b.w / 2, y: b.y + b.h - 30 - k * 26, cr: 30 };
  }
  function tap(i) {
    if (!playing || won || step || steps.length || api.paused) return;
    if (i < 0) { sel = -1; return; }
    if (sel < 0) {
      if (st.l[i]) { say(i, WHY.lock); api.sfx('bad'); bounce[i] = -.6; return; }
      if (!st.s[i]) return;
      sel = i; api.sfx('tick'); return;
    }
    if (i === sel) { sel = -1; return; }
    const w = PC.why(geo, st, sel, i);
    if (!w) { move(sel, i); return; }
    // not a legal target: say why (and wobble it), and pick it up instead when it has something to move
    say(i, WHY[w] || ''); api.sfx('bad'); bounce[i] = -.6;
    sel = st.s[i] && !st.l[i] ? i : -1;
  }
  function say(i, s) { if (!s) return; const p = where(i); fx.text(Math.min(W - 170, Math.max(170, p.x)), p.y - R * .9, s, { color: '#fff', size: 17, life: 1.4, rise: 20 }); }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); tap(hit(at(e))); });
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') hover = hit(at(e)); });
  cv.addEventListener('pointerleave', () => { hover = -1; });
  api.onKey(e => {
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { undo(); e.preventDefault(); }
    else if (e.key === 'r' || e.key === 'R') restart(); else if (e.key === 'h' || e.key === 'H') hint();
  });

  /* ---------- actions ---------- */
  function move(a, b) {
    const before = PC.clone(st), La = before.s[a].length, Lb = before.s[b].length, r = commit(a, b);
    sel = -1; hintMv = null; msg = null;
    disp = before; disp.s[a] = disp.s[a].slice(0, La - r.n);
    const chips = []; for (let j = 0; j < r.n; j++) chips.push({ from: slotPos(a, La - r.n + j), to: slotPos(b, Lb + j), d: j * .055, landed: false });
    steps = [{ kind: 'fly', a, b, c: r.color, chips, dur: .3 + (r.n - 1) * .055 }, ...r.waves.map((w, k) => ({ kind: 'wave', w, k, dur: .62 }))];
    api.sfx('tick'); hud();
    if (PC.done(st)) store.set('prism_cur', null); else think();
  }
  function undo() {
    if (!playing || won || step || steps.length || !hist.length) return;
    const h = hist.pop(); path.pop(); st = h.st; lit = h.lit; shown = { ...lit }; disp = PC.clone(st); sel = -1; hintMv = null; orbs = [];
    store.set('prism_cur', { lv, p: path }); api.sfx('tick'); hud(); think();
  }
  function restart() {
    if (!playing || won || step || steps.length) return;
    const keepHint = hintUsed; store.set('prism_cur', null); startLevel(lv, false); hintUsed = keepHint; hud(); api.sfx('tick');
  }
  function hint() {
    if (!playing || won || step || steps.length) return;
    if (!hintUsed) { hintUsed = true; hud(); }
    if (plan && plan.res !== undefined) showHint(); else { plan && (plan.wantHint = true); msg = { s: '💡 กำลังคิด…', t: 3 }; }
  }
  function showHint() {
    const r = plan.res;
    if (Array.isArray(r) && r.length) { hintMv = r[0]; sel = -1; msg = null; }
    else if (r === null) msg = { s: 'ทางตันแล้ว · กด ↩️ ย้อน หรือ 🔄 เริ่มใหม่', t: 4 };
    else msg = { s: 'ด่านนี้ยากไปสำหรับคำใบ้ ลองย้อนสัก 1–2 ตา', t: 3 };
  }
  function win() {
    won = true; playing = false;
    const mv = path.length;
    for (let k = 0; k < 4; k++) fx.burst(W / 2 + (k - 1.5) * 140, H / 2, { n: 22, colors: CONFETTI, speed: 360, grav: 500, size: 6, shape: 'paper', life: 1.2 });
    api.sfx('level');
    if (isDaily()) {
      // daily: fewest moves wins the ranking; only the first clear of the day pays full coins
      const score = dailyScore(mv), rec = dayRec(), first = !rec.best;
      if (score > rec.best) store.set('prism_day', { d: today, best: score });
      fx.text(W / 2, H / 2 - 20, mv <= def.par ? '👑 เป๊ะเท่าเป้า!' : 'ชาร์จครบ!', { color: PAL.yel, size: 38, life: 1.6, rise: 30 });
      api.after(1.6, () => api.end(score, `${mv} ตา · เป้า ${def.par}${hintUsed ? ' · ใช้คำใบ้' : ''}`, true, { daily: 1, moves: mv, par: def.par, award: first ? score : 20 }));
      return;
    }
    const stars = starsFor(mv), pr = prog(), prev = pr.s[lv] || 0, fresh = stars > prev;
    if (fresh) { pr.s[lv] = stars; store.set('prism', pr); }
    fx.text(W / 2, H / 2 - 20, '⭐'.repeat(stars) + ' ชาร์จครบ!', { color: PAL.yel, size: 38, life: 1.6, rise: 30 });
    // first clear / more stars = full points; replaying a level you already beat pays a little (no farming level 1)
    const score = fresh ? 60 + lv * 30 + stars * 30 : 10 + lv * 3;
    api.after(1.6, () => api.end(score, `ด่าน ${lv} · ${'⭐'.repeat(stars)} · ${mv} ตา${fresh ? '' : ' · เล่นซ้ำ'}`, false, { level: lv, stars, moves: mv }));
  }

  /* ---------- level picker ---------- */
  function picker() {
    if (step || steps.length) return;
    const s = prog().s, un = unlocked(), dr = dayRec(), ov = document.createElement('div'); ov.className = 'overlay';
    const dayBtn = dailyDef ? `<button class="btn pz-day${lv === dayKey ? ' on' : ''}" data-n="${dayKey}"><b>📅</b><small>ด่านประจำวัน</small><i>${dr.best ? 'วันนี้ ' + dr.best + ' แต้ม' : 'ยังไม่เล่น'}</i></button>` : '';
    ov.innerHTML = `<div class="panel popin pz-pick"><h2>🗺️ เลือกด่าน</h2><div class="pz-grid">${dayBtn}${LV.map((d, i) => { const n = i + 1, ok = n <= un;
      return `<button class="btn${n === lv ? ' on' : ''}${n > 12 ? ' pz-hard' : ''}" data-n="${n}" ${ok ? '' : 'disabled'}><b>${ok ? n : '🔒'}</b><small>${ok ? d.name : 'ผ่านด่านก่อนหน้า'}</small><i>${s[n] ? '⭐'.repeat(s[n]) : ok ? '·' : ''}</i></button>`; }).join('')}</div>
      <div class="row"><button class="btn" data-k="x">ปิด</button></div></div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.querySelector('[data-k=x]').onclick = () => { ov.remove(); if (!playing && !won) startLevel(Math.min(un, LV.length)); };
    ov.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { ov.remove(); const n = b.dataset.n; startLevel(n[0] === 'd' ? n : +n); });
    root.appendChild(ov);
  }

  /* ---------- drawing ---------- */
  // static background, drawn once: lavender → mint lab wall with a faint hex lattice and a soft floor glow
  const bg = document.createElement('canvas'); bg.width = W * 2; bg.height = H * 2;
  (() => {
    const g = bg.getContext('2d'); g.scale(2, 2);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#efe6ff'); gr.addColorStop(.6, '#e9f3ff'); gr.addColorStop(1, '#dff5ec'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,100,180,.07)'; g.lineWidth = 1.5;
    const s = 22; for (let y = -s, row = 0; y < H + s; y += s * 1.5, row++) for (let x = (row % 2) * s * .866 - s; x < W + s; x += s * 1.732) {
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; k ? g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s) : g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } g.closePath(); g.stroke(); }
    const rg = g.createRadialGradient(W / 2, H * .62, 20, W / 2, H * .62, W * .55); rg.addColorStop(0, 'rgba(255,255,255,.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  })();
  function hexPath(x, y, r, sy = 1, flat = false) {
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + (flat ? 0 : Math.PI / 6); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * sy; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath();
  }
  function sym(kind, x, y, s, fill = '#fff') {
    ctx.beginPath();
    if (kind === 'circle') ctx.arc(x, y, s, 0, 7);
    else if (kind === 'tri') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * .8); ctx.lineTo(x - s, y + s * .8); ctx.closePath(); }
    else if (kind === 'square') ctx.rect(x - s * .8, y - s * .8, s * 1.6, s * 1.6);
    else if (kind === 'diamond') { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.1); ctx.lineTo(x - s, y); ctx.closePath(); }
    else { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * .45 : s * 1.1; k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(43,33,64,.5)'; ctx.stroke();
  }
  // one energy disc: flat hex, darker side, glossy top, symbol on top + on the side (colour is never the only cue)
  function chip(c, x, y, cr, alpha = 1, glow = 0, sx = 1) {
    const C = PC.COLORS[c], th = cr * .3, sq = .5, w = cr * sx; ctx.globalAlpha = alpha;
    const pts = yy => [0, 1, 2, 3].map(k => [x + Math.cos(Math.PI / 3 * k) * w, yy + Math.sin(Math.PI / 3 * k) * cr * sq]);
    const a = pts(y), b = pts(y + th);
    ctx.beginPath(); a.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); for (let k = 3; k >= 0; k--) ctx.lineTo(b[k][0], b[k][1]); ctx.closePath();
    ctx.fillStyle = C.d; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    const gr = ctx.createLinearGradient(x - w, y - cr * sq, x + w * .6, y + cr * sq); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.25, C.c); gr.addColorStop(1, C.c);
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); ctx.translate(-x, -y); hexPath(x, y, cr, sq, true); ctx.restore();
    ctx.fillStyle = gr; ctx.fill(); ctx.stroke();
    if (glow > 0) { ctx.globalAlpha = alpha * glow; ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); ctx.translate(-x, -y); hexPath(x, y, cr, sq, true); ctx.restore(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = alpha; }
    ctx.globalAlpha = alpha * .55; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x - w * .38, y - cr * sq * .25, w * .2, cr * sq * .16, -.35, 0, 7); ctx.fill(); ctx.globalAlpha = alpha;
    sym(C.sym, x + w * .12, y + cr * sq * .05, cr * .19);
    if (cr > 20) { ctx.globalAlpha = alpha * .85; sym(C.sym, x, y + cr * sq * .866 + th * .5, cr * .085); }
    ctx.globalAlpha = 1;
  }
  function padlock(x, y, s, a = 1) {
    ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(x, y - s * .35, s * .45, Math.PI, 0); ctx.stroke();
    rrect(ctx, x - s * .7, y - s * .35, s * 1.4, s, 5, '#ffd23f', INK); ctx.fillStyle = INK; ctx.fillRect(x - 2, y - s * .05, 4, s * .4); ctx.globalAlpha = 1;
  }
  function crystal(x, y, c, on, pulse) {
    const C = PC.COLORS[c], s = 11 * (1 + pulse * .45);
    if (on && pulse > 0) { const g = ctx.createRadialGradient(x, y, 2, x, y, 30); g.addColorStop(0, C.c); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = pulse; ctx.fillStyle = g; ctx.fillRect(x - 30, y - 30, 60, 60); ctx.globalAlpha = 1; }
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s, y - s * .2); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s, y - s * .2); ctx.closePath();
    ctx.fillStyle = on ? C.c : 'rgba(255,255,255,.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = on ? INK : 'rgba(43,33,64,.3)'; ctx.stroke();
    if (on) { ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x - s * .4, y - s * .2); ctx.lineTo(x, y + s * 1.3); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill(); }
    else sym(C.sym, x, y - s * .1, 3.5, 'rgba(43,33,64,.15)');
  }
  const crystalCols = () => Object.keys(totals);
  function crystalPos(c, k) {
    const cols = crystalCols(), n = cols.reduce((a, x) => a + totals[x] / CAP, 0); let idx = 0;
    for (const x of cols) { if (x === c) { idx += k; break; } idx += totals[x] / CAP; }
    return { x: W / 2 - n * 18 + 18 + 30 + idx * 36, y: 33 };
  }
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  function tile(i, p) {
    const lockd = disp.l[i], isSel = i === sel, legal = sel >= 0 && !PC.why(geo, st, sel, i), hov = i === hover && playing && !lockd;
    const pp = Math.max(0, Math.min(1, pop[i])), sc = pp < 1 ? 1 - Math.pow(1 - pp, 3) * 1 + Math.sin(pp * Math.PI) * .08 : 1;
    const bo = bounce[i], wob = bo < 0 ? Math.sin(t * 40) * -bo * 4 : 0;
    ctx.save(); ctx.translate(p.x + wob, p.y); ctx.scale(sc, sc); ctx.translate(-p.x, -p.y);
    hexPath(p.x, p.y + 6, R * .96); ctx.fillStyle = INK; ctx.fill();
    const g = ctx.createLinearGradient(0, p.y - R, 0, p.y + R);
    if (lockd) { g.addColorStop(0, '#e4ddf2'); g.addColorStop(1, '#c9c0dc'); }
    else if (isSel) { g.addColorStop(0, '#fffbe6'); g.addColorStop(1, '#ffe48a'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, hov ? '#f3eaff' : '#efe9f8'); }
    hexPath(p.x, p.y, R * .96); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    hexPath(p.x, p.y + 4, R * .8, .92); ctx.fillStyle = lockd ? 'rgba(43,33,64,.07)' : 'rgba(150,120,210,.12)'; ctx.fill();
    if (legal) { ctx.save(); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30; hexPath(p.x, p.y, R * .82); ctx.lineWidth = 3; ctx.strokeStyle = PAL.green; ctx.stroke(); ctx.restore(); }
    if (hintMv && (hintMv[0] === i || hintMv[1] === i)) { hexPath(p.x, p.y, R * (1.02 + Math.sin(t * 7) * .035)); ctx.lineWidth = 5; ctx.strokeStyle = PAL.yel; ctx.stroke(); }
    const charging = step && step.kind === 'wave' && !step.fired && step.w.charged.includes(i) ? Math.min(1, step.t / .3) : 0;
    const s = disp.s[i], lift = liftV[i], run = isSel ? PC.run(st.s[i]) : 0, sqz = bo > 0 ? bo : 0;
    for (let k = 0; k < s.length; k++) {
      const sp = slotPos(i, k), up = k >= s.length - run ? lift * (12 + Math.sin(t * 5) * 2.5) : 0;
      chip(s[k], sp.x, sp.y + k * R * .2 * sqz * .5 - up - charging * 10 * (k + 1) / s.length, sp.cr, lockd ? .45 : 1, charging, 1 + sqz * .12);
    }
    if (legal && !lockd) { const n = Math.min(PC.run(st.s[sel]), PC.cap(geo, i) - st.s[i].length), c = PC.top(st.s[sel]); for (let k = 0; k < n; k++) { const sp = slotPos(i, st.s[i].length + k); chip(c, sp.x, sp.y, sp.cr, .32 + Math.sin(t * 5) * .06); } }
    if (lockd) padlock(p.x, p.y - R * .1, R * .32);
    ctx.restore();
  }
  function reservoir(j) {
    const b = resBox[j], i = geo.nBoard + j, isSel = i === sel, legal = sel >= 0 && !PC.why(geo, st, sel, i), hov = i === hover && playing;
    const wob = bounce[i] < 0 ? Math.sin(t * 40) * -bounce[i] * 4 : 0, pp = Math.max(0, Math.min(1, pop[i]));
    ctx.save(); ctx.globalAlpha = pp; ctx.translate(wob, (1 - pp) * 20);
    rrect(ctx, b.x, b.y + 6, b.w, b.h, 18, INK);
    const g = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0); g.addColorStop(0, isSel ? '#fff4c4' : '#ffffff'); g.addColorStop(1, isSel ? '#ffe48a' : hov ? '#efe3ff' : '#e9f4ff');
    rrect(ctx, b.x, b.y, b.w, b.h, 18, g, INK);
    ctx.globalAlpha = pp * .5; ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 10, b.y + 22, 6, b.h - 36); ctx.globalAlpha = pp;
    txt(ctx, 'ที่พัก', b.x + b.w / 2, b.y + 14, 13, PAL.muted, 'center', 700);
    if (legal) { ctx.save(); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 3; ctx.strokeStyle = PAL.green; rrect(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 14, null, PAL.green); ctx.restore(); }
    if (hintMv && (hintMv[0] === i || hintMv[1] === i)) { ctx.lineWidth = 5; ctx.strokeStyle = PAL.yel; ctx.beginPath(); ctx.roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 20); ctx.stroke(); }
    const s = disp.s[i], run = isSel ? PC.run(st.s[i]) : 0;
    for (let k = 0; k < s.length; k++) { const sp = slotPos(i, k), up = k >= s.length - run ? liftV[i] * (10 + Math.sin(t * 5) * 2.5) : 0; chip(s[k], sp.x, sp.y - up, sp.cr, pp); }
    if (legal) { const n = Math.min(PC.run(st.s[sel]), geo.resCap - st.s[i].length), c = PC.top(st.s[sel]); for (let k = 0; k < n; k++) { const sp = slotPos(i, st.s[i].length + k); chip(c, sp.x, sp.y, sp.cr, .32); } }
    ctx.restore();
  }
  function draw() {
    fx.pre(ctx);
    ctx.drawImage(bg, 0, 0, W, H);
    if (!def) { fx.post(ctx, W, H); return; }
    // crystal meter: one crystal per 4 units of a colour; orbs from charges fly into it
    const cols = crystalCols(), nCr = cols.reduce((a, c) => a + totals[c] / CAP, 0), mx = W / 2 - nCr * 18 - 64;
    rrect(ctx, mx, 15, nCr * 36 + 128, 42, 16, INK); rrect(ctx, mx, 10, nCr * 36 + 128, 42, 16, '#ffffff', INK);
    txt(ctx, isDaily() ? '📅 คริสตัล' : 'คริสตัล', mx + 42, 31, 14, PAL.muted, 'center', 700);
    for (const c of cols) for (let k = 0; k < totals[c] / CAP; k++) { const cp = crystalPos(c, k); crystal(cp.x, cp.y - 2, c, k < (shown[c] || 0), litPulse[c + k] || 0); }
    for (let i = 0; i < geo.nBoard; i++) tile(i, P[i]);
    for (let j = 0; j < geo.nRes; j++) reservoir(j);
    // breaking locks fly off
    for (const l of locksOff) { const k = l.t / .6; padlock(l.x + k * 30, l.y - k * 40 + k * k * 60, R * .32 * (1 + k * .3), 1 - k); }
    // shockwave rings + orbs
    for (const r of rings) { const k = r.t / .5; ctx.globalAlpha = (1 - k) * .8; ctx.lineWidth = 6 * (1 - k) + 1; ctx.strokeStyle = PC.COLORS[r.c].c; hexPath(r.x, r.y, R * (.5 + k * 1.3)); ctx.stroke(); ctx.globalAlpha = 1; }
    for (const o of orbs) {
      const k = ease(Math.min(1, o.t / o.dur)), x = o.x + (o.tx - o.x) * k + Math.sin(k * Math.PI) * o.bend, y = o.y + (o.ty - o.y) * k - Math.sin(k * Math.PI) * 50;
      const g = ctx.createRadialGradient(x, y, 1, x, y, 16); g.addColorStop(0, '#fff'); g.addColorStop(.35, PC.COLORS[o.c].c); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
    }
    if (hintMv) { const a = where(hintMv[0]), b = where(hintMv[1]); ctx.save(); ctx.globalAlpha = .55 + Math.sin(t * 7) * .3; ctx.lineWidth = 6; ctx.strokeStyle = PAL.yel; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y - R * .9); ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - R * 1.6, b.x, b.y - R * .9); ctx.stroke(); ctx.restore(); }
    // chips in flight, one after another along an eased arc
    if (step && step.kind === 'fly') for (const ch of step.chips) {
      if (ch.landed) continue;
      const k = Math.max(0, Math.min(1, (step.t - ch.d) / .26)), e = ease(k), d = Math.hypot(ch.to.x - ch.from.x, ch.to.y - ch.from.y);
      const x = ch.from.x + (ch.to.x - ch.from.x) * e, y = ch.from.y + (ch.to.y - ch.from.y) * e - Math.sin(k * Math.PI) * Math.min(90, 30 + d * .35) - (k === 0 ? 12 : 0);
      chip(step.c, x, y, ch.from.cr + (ch.to.cr - ch.from.cr) * e);
    }
    const banner = msg ? [msg.s, '#ffffff', INK] : plan && plan.res === null && !won && !step && !steps.length ? ['ทางตันแล้ว 😅 กด ↩️ ย้อน หรือ 🔄 เริ่มใหม่', '#ffe0e6', PAL.red] : null;
    if (banner) { rrect(ctx, W / 2 - 250, H - 48, 500, 38, 14, INK); rrect(ctx, W / 2 - 250, H - 52, 500, 38, 14, banner[1], INK); txt(ctx, banner[0], W / 2, H - 33, 16, banner[2], 'center', 700); }
    fx.post(ctx, W, H);
  }
  // advance the current step; display state changes at the moment each thing visibly happens
  function update(s, d) {
    s.t += d;
    if (s.kind === 'fly') {
      for (const ch of s.chips) if (!ch.landed && s.t >= ch.d + .26) { ch.landed = true; disp.s[s.b] += s.c; bounce[s.b] = 1; api.sfx('tick'); }
      return s.chips.every(c => c.landed) && s.t >= s.dur;
    }
    if (!s.fired && s.t >= .3) {
      s.fired = true; const w = s.w;
      for (const i of w.charged) {
        const p = P[i], c = w.color[i]; disp.s[i] = '';
        rings.push({ x: p.x, y: p.y, c, t: 0 });
        fx.burst(p.x, p.y, { n: 16, colors: [PC.COLORS[c].c, '#fff'], speed: 260, grav: 120, size: 6, shape: 'star', life: .7 });
        const slot = (shown[c] || 0) + orbs.filter(o => o.c === c).length, cp = crystalPos(c, slot);
        orbs.push({ x: p.x, y: p.y, tx: cp.x, ty: cp.y, c, slot, t: 0, dur: .55, bend: (rnd() - .5) * 80 });
      }
      for (const i of w.freed) { disp.l[i] = false; bounce[i] = 1; locksOff.push({ x: P[i].x, y: P[i].y - R * .1, t: 0 }); }
      const p0 = P[w.charged[0]];
      fx.text(p0.x, p0.y - R * .7, s.k ? `ต่อเนื่อง ×${s.k + 1}!` : '⚡ ชาร์จ!', { color: s.k ? PAL.orange : PAL.yel, size: s.k ? 30 : 26 });
      fx.shake(2 + s.k * 1.5, .16); api.sfx(s.k ? 'level' : 'good');
    }
    return s.t >= s.dur;
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt;
    const k18 = 1 - Math.exp(-dt * 16);
    if (geo) for (let i = 0; i < liftV.length; i++) {
      liftV[i] += ((i === sel ? 1 : 0) - liftV[i]) * k18;
      bounce[i] = bounce[i] > 0 ? Math.max(0, bounce[i] - dt * 4) : Math.min(0, bounce[i] + dt * 2.2);
      if (pop[i] < 1) pop[i] += dt * 3.2;
    }
    for (const k in litPulse) litPulse[k] = Math.max(0, litPulse[k] - dt * 1.6);
    for (const r of rings) r.t += dt; rings = rings.filter(r => r.t < .5);
    for (const l of locksOff) l.t += dt; locksOff = locksOff.filter(l => l.t < .6);
    for (const o of orbs) { o.t += dt; if (o.t >= o.dur && !o.done) { o.done = true; shown[o.c] = (shown[o.c] || 0) + 1; litPulse[o.c + o.slot] = 1; fx.burst(o.tx, o.ty, { n: 10, colors: [PC.COLORS[o.c].c, '#fff'], speed: 140, grav: 0, size: 4, shape: 'star', life: .45 }); } }
    orbs = orbs.filter(o => !o.done);
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    if (d) {
      if (!step && steps.length) { step = steps.shift(); step.t = 0; }
      if (step && update(step, d)) { step = null; if (!steps.length) { disp = PC.clone(st); if (PC.done(st) && !won) api.after(.35, () => { if (!won) win(); }); } }
    }
    if (!step && !steps.length && !orbs.length && st) shown = { ...lit };
    draw();
  });

  const un = unlocked(), next = Math.min(un, LV.length), cur = store.get('prism_cur', null), dr = dayRec();
  const curOk = cur && cur.lv && (typeof cur.lv === 'number' || cur.lv === dayKey);
  def = null; draw();
  const btns = [];
  if (curOk) btns.push({ label: cur.lv === dayKey ? '▶ เล่นต่อ ด่านประจำวัน' : `▶ เล่นต่อ ด่าน ${cur.lv}`, primary: true, go() { startLevel(cur.lv); } });
  const dayBtn = dailyDef && { label: `📅 ด่านประจำวัน${dr.best ? ` <small>(วันนี้ ${dr.best})</small>` : ''}`, go() { startLevel(dayKey, false); } };
  const lvBtn = { label: `▶ ด่าน ${next}`, go() { startLevel(next); } };
  // newcomers learn on the campaign first; after level 6 the daily is the main event
  if (!curOk) { if (dayBtn && un > 6) { dayBtn.primary = true; btns.push(dayBtn, lvBtn); } else { lvBtn.primary = true; btns.push(lvBtn); dayBtn && btns.push(dayBtn); } }
  else { dayBtn && cur.lv !== dayKey && btns.push(dayBtn); }
  btns.push({ label: '🗺️ เลือกด่าน', go() { picker(); } });
  api.intro({ how: `<p>⚡ ย้าย<b>พลังสีบนสุด</b>ไปช่องที่ติดกัน · รวมสีเดียวกันให้ครบ <b>4 ชั้น</b> = ชาร์จคริสตัล · ชาร์จหมดทุกสี = ผ่านด่าน</p>
      <p>📦 <b>ที่พัก</b>รับพลังจากช่องไหนก็ได้ แต่มีที่น้อย · 🔒 ช่องล็อกเปิดเมื่อมีการชาร์จข้างๆ</p>
      <p>📅 <b>ด่านประจำวัน</b> เหมือนกันทั้งออฟฟิศ ใช้ตาน้อยที่สุดได้อันดับ · ด่าน 13 ขึ้นไปคือด่านโหด</p>
      <p>⏳ ไม่จับเวลา · ↩️ ย้อนได้ไม่จำกัด · ทำได้ใน<b>เป้าจำนวนตา</b> = ⭐⭐⭐ · ใช้คำใบ้ได้สูงสุด ⭐⭐</p>`, buttons: btns });
  if (window.__TEST__) window.__prism = { tap, hint, undo, restart, startLevel, dayKey, get st() { return st; }, get geo() { return geo; }, get plan() { return plan; }, get hintMv() { return hintMv; }, get busy() { return !!step || steps.length > 0 || orbs.length > 0; }, get won() { return won; } };
  return { destroy() { worker && worker.terminate(); } };
}
