// "ฟาร์มดาดฟ้า" — a small rooftop garden: plant, wait (3 min – 3 h of real time), harvest for coins + XP.
// Built to never feel like a chore (owner's rule): nothing wilts or dies, ripe crops wait forever, watering is optional
// (it only speeds things up) and there are no reminders. Friends can water your plants (−15% grow time each, ≤3 per crop).
// State lives in Prog ('prog'.farm); the public part is mirrored to rooms/_farm/{nameKey}, friends' water to rooms/_farmw/{owner}/{plot}.
// Classic script after office.js (uses Prog, PXA_ART, pxa, pxImg, drawChar, drawAcc, makeFX, txt, rrect, g2canvas, store, toast).
'use strict';
// id → [Thai name, grow minutes, seed price, sell price, level, ripe art]
const CROPS = {
  bok: ['ผักบุ้ง', 3, 4, 6, 1, ['g...g...g', 'gg.gGg.gg', '.gGgGgGg.', '.gGgGgGg.', '..gGGGg..', '..GgGgG..', '..GgGgG..', '...GGG...']],
  let: ['ผักสลัด', 10, 8, 18, 1, ['...ggg...', '.ggwgwgg.', 'gGgggggGg', 'ggGgwgGgg', 'gGgggggGg', '.gGgGgGg.', '..ggggg..']],
  car: ['แครอท', 20, 12, 28, 2, ['..g.g.g..', '..gGgGg..', '...gGg...', '...kGk...', '..ktttk..', '..ktttk..', '...kttk..', '...ktk...', '....k....']],
  tom: ['มะเขือเทศ', 40, 18, 44, 3, ['..gGgGg..', '.gGrrGgg.', 'gGrwrRgGg', 'gGrrRGrrg', '.gGRgGrwr', '.gGgGgrrR', '..gGGGg..', '...GGG...']],
  chi: ['พริก', 60, 22, 58, 5, ['...gGg...', '.ggGgGgg.', 'gGrgGgRgg', 'gGRgGgrGg', '.grGgGrg.', '.gRgGgRg.', '..gGGGg..', '...GGG...']],
  cor: ['ข้าวโพด', 90, 28, 78, 7, ['....g.....', '...ggk....', '..gGkyk...', '..gkyyyk..', '.gGkyoyk..', 'gGgkyyyk.g', '.g.kyoykgG', '...gkyyGg.', '....gGGg..', '.....GG...']],
  pum: ['ฟักทอง', 120, 35, 100, 9, ['....Gc....', '...gGc....', '.kkkkkkkk.', 'ktottottok', 'kttottotok', 'kttottotok', 'ktottottok', '.kkkkkkkk.']],
  wat: ['แตงโม', 180, 45, 140, 12, ['.....gG....', '..kkkkkkk..', '.kgGgGgGgk.', 'kgGgGgGgGgk', 'kGgGgGgGgGk', 'kgGgGgGgGgk', '.kGgGgGgGk.', '..kkkkkkk..']],
};
for (const [id, c] of Object.entries(CROPS)) PXA_ART['crop_' + id] = c[5];
Object.assign(PXA_ART, {
  crop_seed: ['..........', '...c..c...', '..cCccCc..', '.cCCCCCCc.'],
  crop_sprout: ['.gg...gg.', 'gggg.gggg', '.gGGgGGg.', '...GgG...', '....G....', '....G....'],
  crop_grow: ['..g..g..g..', '.ggg.g.ggg.', 'ggGggGggGgg', '.gGgGgGgGg.', '..gGGGGGg..', '...gGGGg...', '....GGG....', '....G.G....'],
  can: ['.....kk...', '....kbbk..', 'kkkkkbbk..', 'kbbbbbbbkk', 'kbbbbbbbk.', 'kbBbbbbbk.', 'kbbbbbbbk.', '.kkkkkkk..'],
});
// plot n (0-based): [price, level] — 4 to start, the rest bought one by one
const PLOTS = [[0, 1], [0, 1], [0, 1], [0, 1], [80, 2], [150, 3], [250, 5], [400, 7], [600, 9], [900, 12]];
const WATER_CUT = .15, WATER_MAX = 3, GOLD_P = .06, FRIEND_WATER_DAY = 20;
const growMs = (plot, fw = 0) => CROPS[plot.c][1] * 60e3 * (1 - WATER_CUT * Math.min(WATER_MAX, (plot.w ? 1 : 0) + fw));
const ripeAt = (plot, fw) => plot.t + growMs(plot, fw);
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h} ชม. ${m} น.` : m >= 1 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s} วิ`; };
const cropTime = id => { const m = CROPS[id][1]; return m >= 60 ? `${m / 60} ชม.` : `${m} นาที`; };

const Farm = {
  get() { const p = Prog.get(); return p.farm || { n: 4, plots: [], book: {}, fw: {} }; },
  // how many of my crops are ripe right now (fw = friends' water counts last seen)
  ready(f = Farm.get(), now = Date.now()) { return f.plots.filter((pl, i) => pl && now >= ripeAt(pl, (f.fw || {})[i] || 0)).length; },
};

function farmMount(root, api) {
  root.innerHTML = `<div class="hud office-hud"><span data-k="title"></span><span class="muted" data-k="info"></span><span style="margin-left:auto">🪙 <b data-k="coins">0</b></span></div>
    <div class="office farm"><div class="office-room"><div class="office-tools" data-k="tools"></div></div>
    <div class="box office-side"><div class="rk-tabs" data-k="tabs"></div><div class="office-list" data-k="list"></div></div></div>`;
  const W = 640, H = 360, box = root.querySelector('.office-room'), { cv, ctx, at } = g2canvas(box, W, H);
  box.insertBefore(cv.parentNode, box.firstChild);
  const q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX(), nm = myName(), myKey = (nm || '').trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_').slice(0, 24);
  let p = Prog.get(), f = p.farm || (p.farm = { n: 4, plots: [], book: {}, fw: {} }), tab = 'seed', seed = store.get('farmSeed', 'bok'), hover = -1, t = 0;
  let visit = null, myWaters = {}, O = null, offW = null, friends = null;
  if (!CROPS[seed] || p.lv < CROPS[seed][4]) seed = 'bok';
  const me = { x: 320, tx: 320, dir: 'down', who: p.who || 'adam', act: 0 };

  /* ---------- layout: 2 raised beds of up to 5 plots ---------- */
  const PW = 104, PH = 64, GAPX = 8, X0 = (W - (PW * 5 + GAPX * 4)) / 2, ROWY = [196, 306], AISLE = 228;
  const plotRect = i => ({ x: X0 + (i % 5) * (PW + GAPX), y: ROWY[Math.floor(i / 5)] - PH, w: PW, h: PH });
  const plots = () => visit ? visit.plots : f.plots;
  const nPlots = () => visit ? visit.n : f.n;
  const fwOf = i => visit ? Object.keys((visit.w || {})[i] || {}).filter(k => visit.w[i][k].s === (visit.plots[i] || {}).t).length : fwMine(i);
  const fwMine = i => { const pl = f.plots[i]; if (!pl) return 0; return Object.values(myWaters[i] || {}).filter(v => v.s === pl.t).length; };
  const stage = (pl, fw, now) => { const g = growMs(pl, fw), e = now - pl.t; return e >= g ? 3 : e < g * .15 ? 0 : e < g * .5 ? 1 : 2; };

  /* ---------- saving: local progress + the public copy friends read ---------- */
  function save() { const pp = Prog.get(); pp.farm = f; Prog.put(pp); p = pp; publish(); }
  let pubT = 0;
  function publish() {
    clearTimeout(pubT); if (!nm) return;
    pubT = setTimeout(() => loadOnline().then(O => O.saveFarm(nm, { who: p.who, n: f.n, plots: f.plots })).catch(() => {}), 800);
  }
  let dead = false;
  loadOnline().then(o => { if (dead) return; O = o; if (nm) offW = O.watchWaters(myKey, w => {
    if (dead) { offW && offW(); return; }
    fresh();
    const seen = store.get('farmSeenW', []), news = [];
    myWaters = w || {};
    f.fw = {}; f.plots.forEach((pl, i) => { if (pl) f.fw[i] = fwMine(i); });
    for (const [i, by] of Object.entries(myWaters)) for (const [k, v] of Object.entries(by || {})) { const id = `${i}:${k}:${v.s}`; if (!seen.includes(id) && f.plots[i] && f.plots[i].t === v.s) { news.push(v.n); seen.push(id); } }
    if (news.length) { toast(`💧 ${[...new Set(news)].join(', ')} มารดน้ำผักให้คุณ`); store.set('farmSeenW', seen.slice(-80)); }
    const pp = Prog.get(); pp.farm = f; store.set('prog', pp);
  }); }).catch(() => {});

  /* ---------- actions ---------- */
  // another tab (or an earlier visit) may have changed the farm since: always act on the stored copy
  function fresh() { const s2 = Prog.get().farm; if (s2) { s2.fw = f.fw || {}; f = s2; } }
  function walkTo(i) { const r = plotRect(i); me.tx = r.x + r.w / 2; me.act = .5; }
  function pop(i, s, col) { const r = plotRect(i); fx.text(r.x + r.w / 2, r.y - 4, s, { color: col, size: 20 }); }
  function plant(i, id = seed, quiet) {
    const c = CROPS[id]; p = Prog.get();
    if (p.lv < c[4]) { toast(`🔒 ${c[0]} ปลดล็อกที่ Lv ${c[4]}`); return false; }
    if (p.coins < c[2]) { if (!quiet) toast(`เหรียญไม่พอซื้อเมล็ด${c[0]} (🪙 ${c[2]})`); return false; }
    p.coins -= c[2]; store.set('prog', p);
    f.plots[i] = { c: id, t: Date.now(), w: 0 }; delete f.fw[i];
    if (O && nm) O.clearWaters(myKey, i);
    if (!quiet) { walkTo(i); api.sfx('tick'); pop(i, `🌱 −${c[2]}`, PAL.green); }
    return true;
  }
  function water(i) {
    const pl = f.plots[i]; if (!pl || pl.w) return false;
    if (fwMine(i) >= WATER_MAX) return false;
    pl.w = 1; walkTo(i); api.sfx('tick'); splash(i); pop(i, '💧 โตเร็วขึ้น', PAL.blue); return true;
  }
  function splash(i) { const r = plotRect(i); fx.burst(r.x + r.w / 2, r.y + 20, { n: 14, colors: ['#4cc3ff', '#bfe9ff', '#fff'], speed: 140, size: 4 }); }
  function harvest(i, quiet) {
    const pl = f.plots[i], c = CROPS[pl.c], gold = Math.random() < GOLD_P, sell = c[3] * (gold ? 3 : 1), xp = Math.round((c[3] - c[2]) / 3) + 1;
    const b = f.book[pl.c] || (f.book[pl.c] = [0, 0]); b[0]++; if (gold) b[1]++;
    f.plots[i] = null; delete f.fw[i];
    if (O && nm) O.clearWaters(myKey, i);
    const pp = Prog.get(); pp.farm = f; store.set('prog', pp);
    Prog.give(sell, xp); p = Prog.get();
    if (!quiet) { walkTo(i); api.sfx(gold ? 'level' : 'good'); }
    pop(i, `${gold ? '✨ทอง ' : ''}+${sell} 🪙`, gold ? PAL.orange : PAL.ink);
    const r = plotRect(i); fx.burst(r.x + r.w / 2, r.y + 24, { n: gold ? 30 : 12, colors: gold ? CONFETTI : ['#21c07a', '#ffd23f', '#fff'] });
    if (gold && c[1] >= 60 && nm) loadOnline().then(O => O.pushFeed(`✨ ${nm} เก็บ${c[0]}ทองคำได้จากฟาร์มดาดฟ้า!`, nm, myAva())).catch(() => {});
    return sell;
  }
  function harvestAll() { fresh(); const now = Date.now(); let n = 0, s = 0;
    f.plots.forEach((pl, i) => { if (pl && now >= ripeAt(pl, fwMine(i))) { s += harvest(i, true); n++; } });
    if (n) { api.sfx('good'); toast(`🧺 เก็บ ${n} แปลง +${fmt(s)} 🪙`); save(); render(); } }
  function plantAll() { fresh(); let n = 0;
    for (let i = 0; i < f.n; i++) if (!f.plots[i] && plant(i, seed, true)) n++;
    if (n) { api.sfx('tick'); toast(`🌱 ปลูก${CROPS[seed][0]} ${n} แปลง (−${CROPS[seed][2] * n} 🪙)`); save(); render(); }
    else toast(p.coins < CROPS[seed][2] ? 'เหรียญไม่พอซื้อเมล็ด' : 'ไม่มีแปลงว่าง'); }
  function waterAll() { fresh(); let n = 0; f.plots.forEach((pl, i) => { if (pl && !pl.w && fwMine(i) < WATER_MAX && Date.now() < ripeAt(pl, fwMine(i)) && water(i)) n++; });
    if (n) { save(); render(); } }
  function buyPlot() { fresh(); const [price, lv] = PLOTS[f.n] || []; p = Prog.get();
    if (price == null) return; if (p.lv < lv) { toast(`🔒 แปลงถัดไปปลดล็อกที่ Lv ${lv}`); return; }
    if (p.coins < price) { toast(`เหรียญไม่พอ ขาดอีก 🪙 ${fmt(price - p.coins)}`); return; }
    p.coins -= price; store.set('prog', p); f.n++; api.sfx('level'); toast(`🧱 ได้แปลงใหม่! ตอนนี้มี ${f.n} แปลง`); save(); render(); }
  // friends: water their growing crops (one 💧 per crop per person, small thank-you coins for the waterer)
  function waterFriend(i) {
    const pl = visit.plots[i]; if (!pl || !O) return;
    if (!nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อน ถึงจะรดน้ำให้เพื่อนได้'); return; }
    const by = (visit.w || {})[i] || {}, mine = by[myKey] && by[myKey].s === pl.t;
    if (mine) { toast('รดต้นนี้ไปแล้ว 💧'); return; }
    if ((pl.w ? 1 : 0) + fwOf(i) >= WATER_MAX) { toast('ต้นนี้ได้น้ำครบแล้ว 💧'); return; }
    if (Date.now() >= ripeAt(pl, fwOf(i))) { toast(`${CROPS[pl.c][0]}สุกแล้ว รอ ${visit.nm} มาเก็บ 🧺`); return; }
    visit.w = visit.w || {}; (visit.w[i] = visit.w[i] || {})[myKey] = { n: nm, s: pl.t };
    walkTo(i); api.sfx('tick'); splash(i);
    O.water(visit.k, i, nm, pl.t).then(() => {
      const d = store.get('farmWD', { d: '', n: 0 }), day = new Date().toDateString(); if (d.d !== day) { d.d = day; d.n = 0; }
      if (d.n < FRIEND_WATER_DAY) { d.n++; store.set('farmWD', d); Prog.give(2, 1); pop(i, '💧 +2 🪙', PAL.blue); } else pop(i, '💧 ขอบคุณ!', PAL.blue);
      render();
    }).catch(() => { delete visit.w[i][myKey]; toast('รดน้ำไม่สำเร็จ (เน็ตหลุด?)'); });
  }
  function openFriend(fr) { visit = { ...fr, plots: (fr.plots || []).map(x => x && CROPS[x.c] ? x : null), w: {} }; tab = 'friends'; me.who = fr.who || 'adam'; me.x = me.tx = 320;
    O.getWaters(fr.k).then(w => { if (visit && visit.k === fr.k) { visit.w = w || {}; render(); } }).catch(() => {}); render(); }
  function back() { visit = null; me.who = p.who || 'adam'; render(); }

  /* ---------- side panel + tools ---------- */
  function render() { hud(); tools(); list(); }
  function hud() {
    p = Prog.get();
    q('title').innerHTML = visit ? `👀 สวนของ <b>${esc(visit.nm)}</b>` : `<b>🌱 ฟาร์มดาดฟ้า</b>`;
    q('coins').textContent = fmt(p.coins);
  }
  function tools() {
    const el = q('tools');
    if (visit) { el.innerHTML = `<span class="muted">แตะต้นที่ยังไม่สุกเพื่อ <b>💧 รดน้ำ</b> ช่วยให้โตเร็วขึ้น 15%</span><button class="btn" data-a="back">🌱 กลับสวนฉัน</button>`;
      el.querySelector('[data-a=back]').onclick = back; return; }
    const now = Date.now(), ripe = Farm.ready(f, now), empty = Array.from({ length: f.n }, (_, i) => !f.plots[i]).filter(Boolean).length,
      dry = f.plots.filter((pl, i) => pl && !pl.w && fwMine(i) < WATER_MAX && now < ripeAt(pl, fwMine(i))).length;
    el.innerHTML = `<button class="btn${ripe ? ' primary' : ''}" data-a="all" ${ripe ? '' : 'disabled'}>🧺 เก็บทั้งหมด${ripe ? ` (${ripe})` : ''}</button>
      <button class="btn" data-a="plant" ${empty ? '' : 'disabled'}>${pxImg('crop_' + seed, 18)} ปลูกที่ว่าง${empty ? ` (${empty})` : ''}</button>
      <button class="btn" data-a="water" ${dry ? '' : 'disabled'}>💧 รดน้ำ${dry ? ` (${dry})` : ''}</button>`;
    el.querySelector('[data-a=all]').onclick = harvestAll; el.querySelector('[data-a=plant]').onclick = plantAll; el.querySelector('[data-a=water]').onclick = waterAll;
  }
  function list() {
    const T = q('tabs'), L = q('list');
    T.innerHTML = [['seed', '🌱 เมล็ด'], ['book', '📖 สมุดผัก'], ['friends', '👥 สวนเพื่อน']].map(([k, n]) => `<button class="btn${tab === k ? ' on' : ''}" data-t="${k}">${n}</button>`).join('');
    T.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; list(); });
    if (tab === 'seed') {
      const nx = PLOTS[f.n];
      L.innerHTML = `<p class="muted farm-tip">เลือกเมล็ด แล้วแตะแปลงว่าง · ผักไม่มีวันเหี่ยว สุกแล้วรอได้ตลอด ว่างเมื่อไหร่ค่อยมาเก็บ</p>
        <div class="shop-grid">${Object.entries(CROPS).map(([id, c]) => { const lock = p.lv < c[4];
          return `<button class="shop-it${seed === id ? ' on' : ''}${lock ? ' lock' : ''}" data-seed="${id}" ${lock ? 'disabled' : ''} title="${c[0]}">${pxImg('crop_' + id, 30)}<b>${c[0]}</b>
            <small>${lock ? `🔒 Lv ${c[4]}` : `⏱ ${cropTime(id)}`}</small><small>${lock ? '' : `🪙 ${c[2]} → ${c[3]}`}</small></button>`; }).join('')}</div>
        ${nx ? `<button class="btn farm-plot" data-a="buyplot" ${p.lv < nx[1] ? 'disabled' : ''}>🧱 ซื้อแปลงที่ ${f.n + 1} · ${p.lv < nx[1] ? `🔒 Lv ${nx[1]}` : `🪙 ${fmt(nx[0])}`}</button>` : '<p class="muted">มีครบ 10 แปลงแล้ว 🎉</p>'}`;
      L.querySelectorAll('[data-seed]').forEach(b => b.onclick = () => { seed = b.dataset.seed; store.set('farmSeed', seed); api.sfx('tick'); tools(); list(); });
      const bp = L.querySelector('[data-a=buyplot]'); if (bp) bp.onclick = buyPlot;
    } else if (tab === 'book') {
      const ids = Object.keys(CROPS), got = ids.filter(id => f.book[id]).length;
      L.innerHTML = `<p class="muted farm-tip">เก็บแล้ว ${got}/${ids.length} ชนิด · ✨ ผักทอง ${GOLD_P * 100}% ขายได้ ×3</p><ul class="off-list farm-book">${ids.map(id => { const b = f.book[id], c = CROPS[id];
        return `<li class="${b ? '' : 'none'}">${b ? pxImg('crop_' + id, 26) : '❔'} <b>${b ? c[0] : '???'}</b> <span class="muted">${b ? `เก็บ ${fmt(b[0])} ครั้ง` : `ปลดล็อก Lv ${c[4]}`}</span>${b && b[1] ? ` <i class="gold">✨ ${b[1]}</i>` : ''}</li>`; }).join('')}</ul>`;
    } else {
      L.innerHTML = '<p class="muted">⏳ กำลังโหลดสวนเพื่อน…</p>';
      loadOnline().then(O => O.listFarms()).then(rows => { friends = rows.filter(r => r.k !== myKey); if (tab !== 'friends') return; const now = Date.now();
        L.innerHTML = friends.length ? `<p class="muted farm-tip">รดน้ำให้เพื่อน = เพื่อนได้ผักเร็วขึ้น คุณได้ 🪙 2 (วันละ ${FRIEND_WATER_DAY} ครั้ง)</p><ul class="off-list">${friends.map((r, j) => {
          const pl = (r.plots || []).filter(x => x && CROPS[x.c]), grow = pl.filter(x => now < ripeAt(x, 0)).length;
          return `<li><button class="linkbtn" data-fr="${j}">${pxImg('crop_' + (pl[0] ? pl[0].c : 'seed'), 22)} <b>${esc(r.nm)}</b></button> <span class="muted">${pl.length ? `ปลูกอยู่ ${pl.length} แปลง${grow ? ` · 💧 รดได้ ${grow}` : ''}` : 'สวนว่าง'}</span></li>`; }).join('')}</ul>`
          : '<p class="muted">ยังไม่มีเพื่อนปลูกผัก ชวนกันมาปลูกนะ 🌱</p>';
        L.querySelectorAll('[data-fr]').forEach(b => b.onclick = () => openFriend(friends[+b.dataset.fr]));
      }).catch(() => { L.innerHTML = '<p class="muted">โหลดสวนเพื่อนไม่ได้ (เน็ตหลุด?)</p>'; });
    }
  }

  /* ---------- input ---------- */
  function plotAt(e) { const { x, y } = at(e); for (let i = 0; i < 10; i++) { const r = plotRect(i); if (x >= r.x && x < r.x + r.w && y >= r.y - 40 && y < r.y + r.h) return i; } return -1; }
  cv.addEventListener('pointermove', e => { hover = plotAt(e); cv.style.cursor = hover >= 0 && hover < nPlots() ? 'pointer' : 'default'; });
  cv.addEventListener('pointerleave', () => { hover = -1; });
  cv.addEventListener('pointerdown', e => {
    const i = plotAt(e); if (i < 0) return;
    if (i >= nPlots()) { if (!visit && i === f.n) buyPlot(); return; }
    if (visit) { waterFriend(i); return; }
    fresh();
    const pl = f.plots[i], now = Date.now();
    if (!pl) { if (plant(i)) { save(); render(); } return; }
    if (now >= ripeAt(pl, fwMine(i))) { harvest(i); save(); render(); return; }
    if (!pl.w && fwMine(i) < WATER_MAX) { water(i); save(); render(); return; }
    toast(`${CROPS[pl.c][0]} อีก ${mmss(ripeAt(pl, fwMine(i)) - now)} สุก`);
  });

  /* ---------- drawing ---------- */
  const clouds = [[60, 30, .6], [300, 54, .4], [520, 22, .5]];
  function scene() {
    const h = new Date().getHours(), g = ctx.createLinearGradient(0, 0, 0, 120);
    if (h >= 6 && h < 17) { g.addColorStop(0, '#8fd0ff'); g.addColorStop(1, '#dff3ff'); } else if (h >= 17 && h < 19) { g.addColorStop(0, '#ffab7a'); g.addColorStop(1, '#ffe2b8'); }
    else { g.addColorStop(0, '#26306a'); g.addColorStop(1, '#4b5594'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 120);
    ctx.imageSmoothingEnabled = false;
    for (const c of clouds) { const x = ((c[0] + t * 8 * c[2]) % (W + 80)) - 60; ctx.globalAlpha = .9; ctx.drawImage(pxa('cloud'), x, c[1], 60, 24); ctx.globalAlpha = 1; }
    // far city
    ctx.fillStyle = h >= 19 || h < 6 ? '#3a4278' : '#b9d6ea';
    [[0, 70, 50], [46, 54, 40], [84, 80, 60], [150, 46, 44], [200, 66, 70], [276, 40, 36], [318, 74, 54], [380, 58, 62], [448, 82, 40], [494, 50, 56], [556, 70, 48], [600, 60, 40]].forEach(([x, hh, w]) => ctx.fillRect(x, 120 - hh, w, hh));
    // parapet + rooftop floor
    ctx.fillStyle = '#c96f4a'; ctx.fillRect(0, 100, W, 22); ctx.fillStyle = '#a95a3a'; for (let y = 104; y < 122; y += 8) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = '#e9e4da'; ctx.fillRect(0, 122, W, H - 122);
    ctx.fillStyle = '#d8d2c6'; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 122, 2, H - 122); for (let y = 122; y < H; y += 40) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = 'rgba(43,33,64,.15)'; ctx.fillRect(0, 122, W, 4);
    // a few rooftop props along the front edge
    for (const [n, x] of [['plant_small', 70], ['crate', 180], ['bench_cream', 320], ['plant_pot', 470], ['fruit_veg', 570]]) drawPixAt(ctx, n, x, H - 4, 2);
  }
  function bed(i, now) {
    const r = plotRect(i), open = i < nPlots(), pl = open ? plots()[i] : null;
    if (!open) {
      if (visit || i !== f.n) return;
      ctx.setLineDash([6, 5]); rrect(ctx, r.x + 4, r.y + 14, r.w - 8, r.h - 14, 8, 'rgba(255,255,255,.5)', '#b0a48f'); ctx.setLineDash([]);
      const nx = PLOTS[i]; txt(ctx, p.lv < nx[1] ? `🔒 Lv ${nx[1]}` : `＋ 🪙 ${fmt(nx[0])}`, r.x + r.w / 2, r.y + 42, 13, '#7a6f8c'); return;
    }
    // wooden box + soil
    rrect(ctx, r.x, r.y + 12, r.w, r.h - 12, 6, '#a5683f', '#6b3e26');
    rrect(ctx, r.x + 6, r.y + 18, r.w - 12, r.h - 30, 4, pl && pl.w || (pl && fwOf(i)) ? '#5a3a22' : '#7a5034');
    ctx.fillStyle = '#6b3e26'; ctx.fillRect(r.x + 4, r.y + r.h - 10, r.w - 8, 2);
    if (hover === i) rrect(ctx, r.x - 3, r.y + 9, r.w + 6, r.h - 6, 8, null, PAL.yel);
    if (!pl) { if (!visit) { ctx.globalAlpha = hover === i ? .7 : .25; ctx.drawImage(pxa('crop_' + seed), r.x + r.w / 2 - 18, r.y + 2, 36, 32); ctx.globalAlpha = 1; } return; }
    const fw = fwOf(i), st = stage(pl, fw, now), key = st === 3 ? 'crop_' + pl.c : ['crop_seed', 'crop_sprout', 'crop_grow'][st];
    const im = pxa(key), k = st === 3 ? 4 : 3, bob = st === 3 ? Math.round(Math.sin(t * 4 + i) * 1.5) : 0;
    ctx.drawImage(im, Math.round(r.x + r.w / 2 - im.width * k / 2), Math.round(r.y + 34 - im.height * k + bob), im.width * k, im.height * k);
    // drops for each 💧 it got
    const drops = Math.min(WATER_MAX, (pl.w ? 1 : 0) + fw); for (let d = 0; d < drops; d++) ctx.drawImage(pxa('water'), r.x + 8 + d * 12, r.y + r.h - 22, 8, 8);
    if (st === 3) { const s = Math.sin(t * 5 + i); ctx.globalAlpha = .5 + .5 * s; ctx.drawImage(pxa('spark'), r.x + r.w - 22, r.y - 6 + s * 2, 10, 10); ctx.globalAlpha = 1;
      rrect(ctx, r.x + r.w / 2 - 34, r.y - 30, 68, 20, 10, PAL.yel, PAL.ink); txt(ctx, visit ? 'สุกแล้ว' : 'เก็บได้!', r.x + r.w / 2, r.y - 20, 12, PAL.ink, 'center', 700); }
    else { const left = ripeAt(pl, fw) - now, frac = 1 - left / growMs(pl, fw);
      rrect(ctx, r.x + 14, r.y - 24, r.w - 28, 16, 8, 'rgba(255,255,255,.92)', '#b0a48f');
      ctx.fillStyle = '#9ee6b8'; ctx.fillRect(r.x + 16, r.y - 22, (r.w - 32) * Math.max(0, Math.min(1, frac)), 12);
      txt(ctx, mmss(left), r.x + r.w / 2, r.y - 16, 11, PAL.ink, 'center', 700); }
  }
  function info(now) {
    const el = q('info'); if (!el) return; let s = '';
    if (hover >= 0 && hover < nPlots()) { const pl = plots()[hover];
      if (!pl) s = visit ? 'แปลงว่าง' : `แตะเพื่อปลูก${CROPS[seed][0]} (🪙 ${CROPS[seed][2]})`;
      else { const fw = fwOf(hover), left = ripeAt(pl, fw) - now, by = visit ? null : Object.values(myWaters[hover] || {}).filter(v => v.s === pl.t).map(v => v.n);
        s = `${CROPS[pl.c][0]} · ${left <= 0 ? (visit ? 'สุกแล้ว' : 'แตะเพื่อเก็บ 🧺') : `อีก ${mmss(left)}`}${(pl.w ? 1 : 0) + fw ? ` · 💧×${(pl.w ? 1 : 0) + fw}` : left > 0 && !visit ? ' · แตะเพื่อรดน้ำ' : ''}${by && by.length ? ` (เพื่อน: ${by.join(', ')})` : ''}`; } }
    else if (!visit) { const ripe = Farm.ready(f, now); s = ripe ? `🧺 พร้อมเก็บ ${ripe} แปลง` : f.plots.some(Boolean) ? 'ผักกำลังโต ไปเล่นเกมก่อนก็ได้ 😉' : 'เลือกเมล็ดแล้วแตะแปลงเพื่อปลูก'; }
    if (el.textContent !== s) el.textContent = s;
  }
  let sig = '';
  const off = api.loop(dt => {
    t += dt; const d = fx.step(dt), now = Date.now();
    if (Math.abs(me.tx - me.x) > 1) { me.x += Math.sign(me.tx - me.x) * Math.min(160 * d, Math.abs(me.tx - me.x)); me.dir = me.tx > me.x ? 'right' : 'left'; } else me.dir = 'down';
    fx.pre(ctx); scene();
    for (let i = 0; i < 5; i++) bed(i, now);
    const moving = Math.abs(me.tx - me.x) > 1, anim = moving ? 'run' : 'idle_anim';
    drawChar(ctx, me.who, anim, me.dir, t, me.x, AISLE + 14, 2);
    if (!visit) { drawAcc(ctx, Wardrobe.eq('f'), me.who, anim, me.dir, t, me.x, AISLE + 14, 2); drawAcc(ctx, Wardrobe.eq('h'), me.who, anim, me.dir, t, me.x, AISLE + 14, 2); }
    if (me.act > 0) { me.act -= dt; ctx.drawImage(pxa('can'), me.x + 10, AISLE - 40, 30, 24); }
    for (let i = 5; i < 10; i++) bed(i, now);
    fx.post(ctx, W, H);
    info(now);
    // refresh the buttons when a crop ripens
    const s = visit ? 'v' : `${Farm.ready(f, now)}`; if (s !== sig) { sig = s; if (!visit) tools(); }
  });
  render();
  return { destroy() { dead = true; off(); offW && offW(); clearTimeout(pubT); publish(); } };
}
