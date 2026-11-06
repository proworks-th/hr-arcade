/* =================================================================
   Prism Foundry (โรงหลอมปริซึม) — hex sort puzzle. Rules live in prism-core.js, levels in prism-levels.js.
   Classic script loaded after solo-games.js; uses its canvas kit (g2canvas, g2pad, makeFX, officeBG, txt, rrect)
   and the hub's globals (store, rnd, pick). Mount: prismGame(root, api).
================================================================= */
'use strict';
function prismGame(root, api) {
  const PC = window.PrismCore, LV = window.PRISM_LEVELS, CAP = PC.CAP;
  const W = 760, H = 470, TOP = 66;
  root.innerHTML = `<div class="hud"><span>⚡ ด่าน <b data-k="lv">1</b> · <span data-k="nm"></span></span><span>ตา <b data-k="mv">0</b> · เป้า <b data-k="par">0</b></span><span data-k="stars"></span><span class="muted g2tip" data-k="tip"></span></div>`;
  const { cv, ctx, at } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  const pad = g2pad(root, [['↩️ ย้อน', () => undo()], ['🔄 เริ่มใหม่', () => restart()], ['💡 ใบ้ <small data-k="hs">(ได้สูงสุด ⭐⭐)</small>', () => hint()], ['🗺️ เลือกด่าน', () => picker()]]);
  const prog = () => store.get('prism', { s: {} }), unlocked = () => { const s = prog().s; let n = 1; while (s[n] && n < LV.length) n++; return n; };

  let lv = 0, def = null, geo = null, st0 = null, st = null, disp = null, path = [], hist = [], lit = {}, totals = {};
  let sel = -1, steps = [], step = null, hintMv = null, hintUsed = false, plan = null, won = false, t = 0, playing = false, msg = null;
  let R = 50, P = [], resBox = [], shown = {};

  /* ---------- solver in a worker (falls back to a small search on the main thread) ---------- */
  let worker = null, reqId = 0; const waiting = {};
  try { worker = new Worker('prism-worker.js?v=3'); worker.onmessage = e => { const f = waiting[e.data.id]; delete waiting[e.data.id]; f && f(e.data.res); }; } catch (e) { worker = null; }
  function think() {
    const k = PC.key(st), me = { k, res: undefined }; plan = me;
    const done = res => { if (plan !== me) return; me.res = res; if (me.wantHint) showHint(); };
    if (worker) { const id = ++reqId; waiting[id] = done; worker.postMessage({ id, lv, def, st }); }
    else setTimeout(() => { const r = PC.solve(geo, st, 20000); done(r === 'limit' ? PC.solveAny(geo, st, 60000) : r); }, 0);
  }

  /* ---------- level setup ---------- */
  function layout() {
    const xs = [], ys = []; for (const [qq, r] of geo.pos) { xs.push(Math.sqrt(3) * (qq + r / 2)); ys.push(1.5 * r); }
    const right = geo.nRes ? 140 : 0, bw = W - 60 - right, bh = H - TOP - 50;
    const spanX = Math.max(...xs) - Math.min(...xs) + 2, spanY = Math.max(...ys) - Math.min(...ys) + 2.2;
    R = Math.min(62, bw / spanX, bh / spanY);
    const ox = 30 + bw / 2 - (Math.max(...xs) + Math.min(...xs)) / 2 * R, oy = TOP + 18 + bh / 2 - (Math.max(...ys) + Math.min(...ys)) / 2 * R;
    P = xs.map((x, i) => ({ x: ox + x * R, y: oy + ys[i] * R }));
    resBox = []; const rh = 40 + geo.resCap * 26, gap = 18, tot = geo.nRes * rh + (geo.nRes - 1) * gap;
    for (let i = 0; i < geo.nRes; i++) resBox.push({ x: W - 120, y: TOP + 20 + (H - TOP - 40 - tot) / 2 + i * (rh + gap), w: 92, h: rh });
  }
  function startLevel(n, resume = true) {
    lv = n; def = LV[n - 1]; ({ geo, st: st0 } = PC.load(def)); layout();
    totals = {}; for (const s of st0.s) for (const c of s) totals[c] = (totals[c] || 0) + 1;
    st = PC.clone(st0); path = []; hist = []; lit = {}; sel = -1; steps = []; step = null; hintMv = null; hintUsed = false; won = false; msg = null;
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
  const starsFor = mv => { const p = def.par, s = mv <= p ? 3 : mv <= p + Math.max(2, Math.ceil(p / 2)) ? 2 : 1; return hintUsed ? Math.min(2, s) : s; };
  function hud() {
    q('lv').textContent = lv; q('nm').textContent = def.name; q('mv').textContent = path.length; q('par').textContent = def.par;
    q('stars').textContent = '⭐'.repeat(starsFor(Math.max(path.length, 0))); q('tip').textContent = def.tip;
    const hs = root.querySelector('[data-k=hs]'); if (hs) hs.textContent = hintUsed ? '' : '(ได้สูงสุด ⭐⭐)';
  }

  /* ---------- input ---------- */
  const WHY = { far: 'ไกลไป · ย้ายได้แค่ช่องติดกัน หรือใส่ที่พัก', color: 'สีบนสุดไม่ตรงกัน', full: 'เต็มแล้ว', lock: 'ล็อกอยู่ · ชาร์จช่องข้างๆ เพื่อเปิด' };
  function hit(p) {
    for (let i = 0; i < geo.nRes; i++) { const b = resBox[i]; if (p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) return geo.nBoard + i; }
    let best = -1, bd = R * .92; P.forEach((c, i) => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const where = i => i < geo.nBoard ? P[i] : { x: resBox[i - geo.nBoard].x + 46, y: resBox[i - geo.nBoard].y + resBox[i - geo.nBoard].h / 2 };
  function tap(i) {
    if (!playing || won || step || api.paused) return;
    if (i < 0) { sel = -1; return; }
    if (sel < 0) {
      if (st.l[i]) { say(i, WHY.lock); api.sfx('bad'); return; }
      if (!st.s[i]) return;
      sel = i; api.sfx('tick'); return;
    }
    if (i === sel) { sel = -1; return; }
    const w = PC.why(geo, st, sel, i);
    if (!w) { move(sel, i); return; }
    // not a legal target: say why, and pick it up instead when it has something to move
    say(i, WHY[w] || ''); api.sfx('bad'); fx.shake(3, .12);
    sel = st.s[i] && !st.l[i] ? i : -1;
  }
  function say(i, s) { if (!s) return; const p = where(i); fx.text(Math.min(W - 160, Math.max(160, p.x)), p.y - R * .9, s, { color: '#fff', size: 17, life: 1.4, rise: 20 }); }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); tap(hit(at(e))); });
  api.onKey(e => {
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { undo(); e.preventDefault(); }
    else if (e.key === 'r' || e.key === 'R') restart(); else if (e.key === 'h' || e.key === 'H') hint();
  });

  /* ---------- actions ---------- */
  function move(a, b) {
    const before = PC.clone(st), r = commit(a, b);
    sel = -1; hintMv = null; msg = null;
    disp = before; disp.s[a] = disp.s[a].slice(0, disp.s[a].length - r.n);
    steps = [{ kind: 'fly', a, b, c: r.color, n: r.n, dur: .22 }, ...r.waves.map((w, k) => ({ kind: 'wave', w, k, dur: .42 }))];
    api.sfx('tick'); hud();
    if (PC.done(st)) store.set('prism_cur', null); else think();
  }
  function undo() {
    if (!playing || won || step || !hist.length) return;
    const h = hist.pop(); path.pop(); st = h.st; lit = h.lit; shown = { ...lit }; disp = PC.clone(st); sel = -1; hintMv = null;
    store.set('prism_cur', { lv, p: path }); api.sfx('tick'); hud(); think();
  }
  function restart() {
    if (!playing || won || step) return;
    const keepHint = hintUsed; store.set('prism_cur', null); startLevel(lv, false); hintUsed = keepHint; hud(); api.sfx('tick');
  }
  function hint() {
    if (!playing || won || step) return;
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
    const mv = path.length, stars = starsFor(mv), pr = prog(), prev = pr.s[lv] || 0, fresh = stars > prev;
    if (stars > prev) { pr.s[lv] = stars; store.set('prism', pr); }
    fx.flash('#fff', .3); api.sfx('level');
    for (let k = 0; k < 4; k++) fx.burst(W / 2 + (k - 1.5) * 140, H / 2, { n: 22, colors: CONFETTI, speed: 360, grav: 500, size: 6, shape: 'paper', life: 1.2 });
    fx.text(W / 2, H / 2 - 20, '⭐'.repeat(stars) + ' ชาร์จครบ!', { color: PAL.yel, size: 38, life: 1.6, rise: 30 });
    // first clear / more stars = full points; replaying a level you already beat pays a little (no farming level 1)
    const score = fresh ? 60 + lv * 30 + stars * 30 : 10 + lv * 3;
    api.after(1.5, () => api.end(score, `ด่าน ${lv} · ${'⭐'.repeat(stars)} · ${mv} ตา${fresh ? '' : ' · เล่นซ้ำ'}`, false, { level: lv, stars, moves: mv }));
  }

  /* ---------- level picker ---------- */
  function picker() {
    if (step) return;
    const s = prog().s, un = unlocked(), ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin pz-pick"><h2>🗺️ เลือกด่าน</h2><div class="pz-grid">${LV.map((d, i) => { const n = i + 1, ok = n <= un;
      return `<button class="btn${n === lv ? ' on' : ''}" data-n="${n}" ${ok ? '' : 'disabled'}><b>${ok ? n : '🔒'}</b><small>${ok ? d.name : 'ผ่านด่านก่อนหน้า'}</small><i>${s[n] ? '⭐'.repeat(s[n]) : ok ? '·' : ''}</i></button>`; }).join('')}</div>
      <div class="row"><button class="btn" data-k="x">ปิด</button></div></div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.querySelector('[data-k=x]').onclick = () => { ov.remove(); if (!playing && !won) startLevel(Math.min(un, LV.length)); };
    ov.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { ov.remove(); startLevel(+b.dataset.n); });
    root.appendChild(ov);
  }

  /* ---------- drawing ---------- */
  function hexPath(x, y, r, sy = 1, flat = false) {
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + (flat ? 0 : Math.PI / 6); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * sy; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath();
  }
  function sym(kind, x, y, s) {
    ctx.beginPath();
    if (kind === 'circle') ctx.arc(x, y, s, 0, 7);
    else if (kind === 'tri') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * .8); ctx.lineTo(x - s, y + s * .8); ctx.closePath(); }
    else if (kind === 'square') ctx.rect(x - s * .8, y - s * .8, s * 1.6, s * 1.6);
    else if (kind === 'diamond') { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.1); ctx.lineTo(x - s, y); ctx.closePath(); }
    else { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * .45 : s * 1.1; k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(43,33,64,.55)'; ctx.stroke();
  }
  // one energy disc: flat hex with a darker side, symbol on top (colour is never the only cue)
  function chip(c, x, y, cr, alpha = 1, glow = 0) {
    const C = PC.COLORS[c], th = cr * .3, sq = .5; ctx.globalAlpha = alpha;
    const pts = yy => [0, 1, 2, 3].map(k => [x + Math.cos(Math.PI / 3 * k) * cr, yy + Math.sin(Math.PI / 3 * k) * cr * sq]);
    const a = pts(y), b = pts(y + th);
    ctx.beginPath(); a.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); for (let k = 3; k >= 0; k--) ctx.lineTo(b[k][0], b[k][1]); ctx.closePath();
    ctx.fillStyle = C.d; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
    hexPath(x, y, cr, sq, true); ctx.fillStyle = glow ? '#fff' : C.c; ctx.fill(); ctx.stroke();
    if (glow) { ctx.globalAlpha = alpha * (1 - glow); hexPath(x, y, cr, sq, true); ctx.fillStyle = C.c; ctx.fill(); ctx.globalAlpha = alpha; }
    sym(C.sym, x, y, cr * .2);
    if (cr > 20) { ctx.globalAlpha = alpha * .9; sym(C.sym, x, y + cr * sq * .866 + th * .5, cr * .09); }
    ctx.globalAlpha = 1;
  }
  const chipGap = () => R * .2;
  function stackAt(s, x, baseY, cr, o = {}) {
    for (let k = 0; k < s.length; k++) {
      const lift = o.lift && k >= s.length - o.lift ? 10 + Math.sin(t * 6) * 3 : 0;
      chip(s[k], x, baseY - k * chipGap() - lift, cr, o.alpha ?? 1, o.glow || 0);
    }
  }
  function padlock(x, y, s) {
    ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.beginPath(); ctx.arc(x, y - s * .35, s * .45, Math.PI, 0); ctx.stroke();
    rrect(ctx, x - s * .7, y - s * .35, s * 1.4, s, 4, '#ffd23f', PAL.ink); ctx.fillStyle = PAL.ink; ctx.fillRect(x - 2, y - s * .05, 4, s * .4);
  }
  function crystal(x, y, c, on, pulse) {
    const C = PC.COLORS[c], s = 11 + pulse * 4;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s, y - s * .2); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s, y - s * .2); ctx.closePath();
    ctx.fillStyle = on ? C.c : 'rgba(255,255,255,.7)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = on ? PAL.ink : 'rgba(43,33,64,.35)'; ctx.stroke();
    if (on) { ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x - s * .35, y - s * .2); ctx.lineTo(x, y + s * 1.3); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill(); }
  }
  let litPulse = {};
  function draw() {
    fx.pre(ctx);
    officeBG(ctx, W, H, H - 34, { wall: 'wall_grey', calm: .78 });
    if (!def) { fx.post(ctx, W, H); return; }
    // crystals to power: one per 4 units of each colour
    const cols = Object.keys(totals), nCr = cols.reduce((a, c) => a + totals[c] / CAP, 0);
    rrect(ctx, W / 2 - nCr * 18 - 70, 10, nCr * 36 + 140, 46, 14, 'rgba(255,255,255,.85)', PAL.ink);
    txt(ctx, 'คริสตัล', W / 2 - nCr * 18 - 36, 33, 15, PAL.muted, 'center', 700);
    let cx = W / 2 - nCr * 18 + 18 + 20;
    for (const c of cols) for (let k = 0; k < totals[c] / CAP; k++) { crystal(cx, 33, c, k < (shown[c] || 0), litPulse[c + k] || 0); cx += 36; }
    // board
    const cr = R * .6;
    for (let i = 0; i < geo.nBoard; i++) {
      const p = P[i], lockd = disp.l[i], isSel = i === sel, legal = sel >= 0 && !PC.why(geo, st, sel, i);
      const isHint = hintMv && (hintMv[0] === i || hintMv[1] === i);
      hexPath(p.x, p.y, R * .96); ctx.fillStyle = lockd ? '#cfc8dc' : isSel ? '#fff3c4' : '#fffdf6'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke();
      hexPath(p.x, p.y + 4, R * .82, .9); ctx.fillStyle = lockd ? 'rgba(43,33,64,.08)' : 'rgba(201,139,94,.12)'; ctx.fill();
      if (legal) { ctx.save(); ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 30; hexPath(p.x, p.y, R * .8); ctx.lineWidth = 3; ctx.strokeStyle = PAL.green; ctx.stroke(); ctx.restore(); }
      if (isHint) { hexPath(p.x, p.y, R * (1.02 + Math.sin(t * 8) * .04)); ctx.lineWidth = 5; ctx.strokeStyle = PAL.yel; ctx.stroke(); }
      const glow = step && step.kind === 'wave' && step.w.charged.includes(i) ? Math.min(1, step.t / step.dur * 1.6) : 0;
      stackAt(disp.s[i], p.x, p.y + R * .32, cr, { alpha: lockd ? .45 : 1, lift: isSel ? PC.run(st.s[i]) : 0, glow });
      if (legal && !lockd) { // ghost of what would land here
        const n = Math.min(PC.run(st.s[sel]), PC.cap(geo, i) - st.s[i].length), c = PC.top(st.s[sel]);
        for (let k = 0; k < n; k++) chip(c, p.x, p.y + R * .32 - (st.s[i].length + k) * chipGap(), cr, .35);
      }
      if (lockd) padlock(p.x, p.y - R * .1, R * .32);
    }
    // reservoirs
    for (let j = 0; j < geo.nRes; j++) {
      const b = resBox[j], i = geo.nBoard + j, isSel = i === sel, legal = sel >= 0 && !PC.why(geo, st, sel, i), isHint = hintMv && (hintMv[0] === i || hintMv[1] === i);
      rrect(ctx, b.x, b.y, b.w, b.h, 16, isSel ? '#fff3c4' : 'rgba(255,255,255,.92)', PAL.ink);
      txt(ctx, 'ที่พัก', b.x + b.w / 2, b.y + 14, 13, PAL.muted, 'center', 700);
      for (let k = 0; k < geo.resCap; k++) { ctx.fillStyle = 'rgba(43,33,64,.07)'; ctx.fillRect(b.x + 14, b.y + b.h - 22 - k * 26, b.w - 28, 4); }
      if (legal) { ctx.save(); ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 30; ctx.lineWidth = 3; ctx.strokeStyle = PAL.green; ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10); ctx.restore(); }
      if (isHint) { ctx.lineWidth = 5; ctx.strokeStyle = PAL.yel; ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); }
      const s = disp.s[i], rc = 26;
      for (let k = 0; k < s.length; k++) { const lift = isSel && k >= s.length - PC.run(st.s[i]) ? 8 + Math.sin(t * 6) * 3 : 0; chip(s[k], b.x + b.w / 2, b.y + b.h - 28 - k * rc - lift, 30); }
      if (legal) { const n = Math.min(PC.run(st.s[sel]), geo.resCap - st.s[i].length), c = PC.top(st.s[sel]); for (let k = 0; k < n; k++) chip(c, b.x + b.w / 2, b.y + b.h - 28 - (st.s[i].length + k) * rc, 30, .35); }
    }
    // hint arrow
    if (hintMv) { const a = where(hintMv[0]), b = where(hintMv[1]); ctx.save(); ctx.globalAlpha = .6 + Math.sin(t * 8) * .3; ctx.lineWidth = 6; ctx.strokeStyle = PAL.yel; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y - R * .9); ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - R * 1.6, b.x, b.y - R * .9); ctx.stroke(); ctx.restore(); }
    // flying units
    if (step && step.kind === 'fly') {
      const k = Math.min(1, step.t / step.dur), e = 1 - (1 - k) * (1 - k), A = where(step.a), B = where(step.b);
      const x = A.x + (B.x - A.x) * e, y = A.y - R * .4 + (B.y - A.y) * e - Math.sin(k * Math.PI) * R * .9;
      for (let n = 0; n < step.n; n++) chip(step.c, x, y - n * chipGap(), step.b >= geo.nBoard ? 30 : cr);
    }
    if (msg) { rrect(ctx, W / 2 - 250, H - 52, 500, 38, 12, 'rgba(255,255,255,.95)', PAL.ink); txt(ctx, msg.s, W / 2, H - 33, 16, PAL.ink, 'center', 700); }
    else if (plan && plan.res === null && !won && !step) { rrect(ctx, W / 2 - 230, H - 52, 460, 38, 12, '#ffe0e6', PAL.ink); txt(ctx, 'ทางตันแล้ว 😅 กด ↩️ ย้อน หรือ 🔄 เริ่มใหม่', W / 2, H - 33, 16, PAL.red, 'center', 700); }
    fx.post(ctx, W, H);
  }
  // turn each finished step into the display state, with juice that shows cause → effect
  function finish(s) {
    if (s.kind === 'fly') { disp.s[s.b] += s.c.repeat(s.n); api.sfx('tick'); return; }
    const w = s.w;
    for (const i of w.charged) {
      const p = P[i], c = w.color[i]; disp.s[i] = '';
      fx.burst(p.x, p.y, { n: 18, colors: [PC.COLORS[c].c, '#fff'], speed: 300, grav: 200, size: 7, shape: 'star', life: .7 });
      shown[c] = (shown[c] || 0) + 1; litPulse[c + (shown[c] - 1)] = 1;
    }
    for (const i of w.freed) { disp.l[i] = false; const p = P[i]; fx.burst(p.x, p.y, { n: 12, colors: ['#ffd23f', '#cfc8dc', '#fff'], speed: 240, grav: 600, size: 5, life: .6 }); }
    const p0 = P[w.charged[0]];
    fx.text(p0.x, p0.y - R * .6, s.k ? `ต่อเนื่อง ×${s.k + 1}!` : '⚡ ชาร์จ!', { color: s.k ? PAL.orange : PAL.yel, size: s.k ? 30 : 26 });
    fx.shake(4 + s.k * 2, .2); fx.hitstop(.05); api.sfx(s.k ? 'level' : 'good');
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt;
    for (const k in litPulse) litPulse[k] = Math.max(0, litPulse[k] - dt * 2);
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    if (d) {
      if (!step && steps.length) { step = steps.shift(); step.t = 0; }
      if (step) { step.t += d; if (step.t >= step.dur) { finish(step); step = null; if (!steps.length) { disp = PC.clone(st); shown = { ...lit }; if (PC.done(st) && !won) win(); } } }
    }
    draw();
  });

  const un = unlocked(), next = Math.min(un, LV.length), cur = store.get('prism_cur', null);
  def = null; draw();
  api.intro({ how: `<p>⚡ ย้าย<b>พลังสีบนสุด</b>ไปช่องที่ติดกัน · รวมสีเดียวกันให้ครบ <b>4 ชั้น</b> = ชาร์จคริสตัล · ชาร์จหมดทุกสี = ผ่านด่าน</p>
      <p>📦 <b>ที่พัก</b>รับพลังจากช่องไหนก็ได้ แต่มีที่น้อย · 🔒 ช่องล็อกเปิดเมื่อมีการชาร์จข้างๆ</p>
      <p>⏳ ไม่มีจับเวลา คิดได้เต็มที่ · ↩️ ย้อนได้ไม่จำกัด · ทำได้ภายใน<b>เป้าจำนวนตา</b> = ⭐⭐⭐ · ใช้คำใบ้ได้สูงสุด ⭐⭐</p>`,
    buttons: [{ label: cur && cur.lv ? `▶ เล่นต่อ ด่าน ${cur.lv}` : `▶ ด่าน ${next}`, primary: true, go() { startLevel(cur && cur.lv ? cur.lv : next); } },
      { label: '🗺️ เลือกด่าน', go() { picker(); } }] });
  if (window.__TEST__) window.__prism = { tap, hint, undo, restart, startLevel, get st() { return st; }, get geo() { return geo; }, get plan() { return plan; }, get hintMv() { return hintMv; }, get busy() { return !!step || steps.length > 0; }, get won() { return won; } };
  return { destroy() { worker && worker.terminate(); } };
}
