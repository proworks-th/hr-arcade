// "ฟาร์มดาดฟ้า" — a small rooftop garden: plant, wait (3 min – 3 h of real time), harvest into the basket, then sell,
// send to the canteen's weekly order or gift to a friend.
// Owner's rule: it must never feel like a chore — nothing wilts or dies, ripe crops wait forever, watering is optional
// and there are no reminders. Everything social is a bonus on top.
//  - plots come with the room: expanding your room (office.js ROOM_SIZES) gives more plots
//  - office weather (same for everyone, from the clock): a crop that ripens during rain / golden sun / rainbow mutates and sells for more
//  - canteen board: one shared order per week, everyone chips in, contributors share the reward
//  - every person has one signature fruit only they can grow; others get it as a gift
// State lives in Prog ('prog'.farm); public copy rooms/_farm/{key}, friends' water rooms/_farmw, gifts rooms/_gift, canteen rooms/_canteen.
// Classic script after office.js (uses Prog, roomW, PXA_ART, pxa, pxImg, drawChar, drawAcc, makeFX, txt, rrect, g2canvas, store, toast).
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
  // signature fruits: everyone is dealt one (from their name); only its owner can plant it
  mgo: ['มะม่วง', 60, 20, 55, 1, ['....Gg...', '...kkkk..', '..kyyyok.', '.kyyyyyok', '.kyyytyok', '.kyyttook', '..kyttok.', '...kkkk..']],
  mgs: ['มังคุด', 60, 20, 55, 1, ['...gGg...', '..gGkGg..', '.kkvvvkk.', 'kvvvvvvvk', 'kvwvvvvvk', 'kvvvvvvvk', '.kvvvvvk.', '..kkkkk..']],
  lyc: ['ลิ้นจี่', 60, 20, 55, 1, ['...Gg....', '..kkkk...', '.krRrRk..', 'kRrRrRrk.', 'krRrRrRk.', 'kRrRrRrk.', '.krRrRk..', '..kkkk...']],
  ram: ['เงาะ', 60, 20, 55, 1, ['.r.r.r.r.', 'r.kkkkk.r', '.krrrrrk.', 'rkrwrrrkr', '.krrrrrk.', 'rkrrrrRkr', '.kkrrrkk.', 'r..kkk..r']],
  coc: ['มะพร้าว', 60, 20, 55, 1, ['..kkkkk..', '.kcCcCck.', 'kcCcCcCck', 'kCcCcCcCk', 'kcCcCckck', '.kcCckck.', '..kkkkk..']],
  dur: ['ทุเรียน', 60, 20, 55, 1, ['....c....', '..kykyk..', '.kygyyyk.', 'kyygyGyyk', 'kgyyGyygk', 'kyyGyyGyk', '.kGyygyk.', '..kkkkk..']],
};
const SIG = ['mgo', 'mgs', 'lyc', 'ram', 'coc', 'dur'], VEG = Object.keys(CROPS).filter(id => !SIG.includes(id));
for (const [id, c] of Object.entries(CROPS)) PXA_ART['crop_' + id] = c[5];
Object.assign(PXA_ART, {
  crop_seed: ['..........', '...c..c...', '..cCccCc..', '.cCCCCCCc.'],
  crop_sprout: ['.gg...gg.', 'gggg.gggg', '.gGGgGGg.', '...GgG...', '....G....', '....G....'],
  crop_grow: ['..g..g..g..', '.ggg.g.ggg.', 'ggGggGggGgg', '.gGgGgGgGg.', '..gGGGGGg..', '...gGGGg...', '....GGG....', '....G.G....'],
  can: ['.....kk...', '....kbbk..', 'kkkkkbbk..', 'kbbbbbbbkk', 'kbbbbbbbk.', 'kbBbbbbbk.', 'kbbbbbbbk.', '.kkkkkkk..'],
});
const WATER_CUT = .15, WATER_MAX = 3, FRIEND_WATER_DAY = 20, GIFT_DAY = 10, SPRINKLER = [300, 3], CANTEEN_BONUS = 1.2, CANTEEN_REWARD = 150;
// plots per room width (office.js ROOM_SIZES)
const PLOTS_FOR = { 12: 4, 15: 6, 18: 8, 22: 10 };
const plotsFor = w => PLOTS_FOR[w] || 4;
const growMs = (plot, fw = 0) => CROPS[plot.c][1] * 60e3 * (1 - WATER_CUT * Math.min(WATER_MAX, (plot.w ? 1 : 0) + fw));
const ripeAt = (plot, fw) => plot.t + growMs(plot, fw);
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h} ชม. ${m} น.` : m >= 1 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s} วิ`; };
const cropTime = id => { const m = CROPS[id][1]; return m >= 60 ? `${m / 60} ชม.` : `${m} นาที`; };
const hashStr = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const keyOf = n => (n || '').trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_').slice(0, 24) || '_';
const sigOf = k => SIG[hashStr('sig:' + k) % SIG.length];

/* ---------- office weather: 30-minute windows, the same on every screen (derived from the clock, nothing stored) ---------- */
// id → [Thai name, emoji, chance, mutation (basket suffix), sell multiplier]
const WEATHER = { clear: ['ฟ้าใส', '⛅', 0, '', 1], rain: ['ฝนตก', '🌧️', .22, 'w', 1.5], sun: ['แดดทอง', '☀️', .10, 'g', 3], rainbow: ['รุ้งกินน้ำ', '🌈', .04, 'r', 5] };
const MUT = { w: ['ฉ่ำ', 1.5], g: ['ทอง', 3], r: ['สายรุ้ง', 5] };
const WX_MS = 30 * 60e3;
function weatherAt(ts) {
  const r = (hashStr('wx:' + Math.floor(ts / WX_MS)) % 1000) / 1000; let acc = 0;
  for (const id of ['rainbow', 'sun', 'rain']) { acc += WEATHER[id][2]; if (r < acc) return id; }
  return 'clear';
}
const wxWindow = ts => { const s = Math.floor(ts / WX_MS) * WX_MS; return { from: s, to: s + WX_MS, id: weatherAt(ts) }; };
const nextSpecial = ts => { for (let i = 1; i <= 16; i++) { const w = wxWindow(ts + i * WX_MS); if (w.id !== 'clear') return w; } return null; };
const hhmm = ts => { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
// basket key: crop id + optional mutation ("tom" / "tom.g")
const bagName = key => { const [id, m] = key.split('.'); return CROPS[id][0] + (m ? MUT[m][0] : ''); };
const bagPrice = key => { const [id, m] = key.split('.'); return Math.round(CROPS[id][3] * (m ? MUT[m][1] : 1)); };

// mutated crop art: tinted copies of the pixel art (gold / rainbow / dewy)
const MUT_IMG = {};
function cropImg(id, m) {
  const base = pxa('crop_' + id); if (!m) return base;
  const k = id + '.' + m; if (MUT_IMG[k]) return MUT_IMG[k];
  const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; const g = c.getContext('2d');
  g.drawImage(base, 0, 0); g.globalCompositeOperation = 'source-atop';
  if (m === 'g') { g.fillStyle = 'rgba(255,200,40,.55)'; g.fillRect(0, 0, c.width, c.height); }
  else if (m === 'r') { const gr = g.createLinearGradient(0, 0, c.width, c.height); ['#ff5c8a', '#ffd23f', '#21c07a', '#4cc3ff', '#8338ec'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col)); g.globalAlpha = .55; g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); }
  else { g.fillStyle = 'rgba(120,200,255,.35)'; g.fillRect(0, 0, c.width, c.height); g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(1, 1, 1, 1); g.fillRect(c.width - 3, 3, 1, 1); }
  return (MUT_IMG[k] = c);
}
const cropURL = (key, size = 24) => { const [id, m] = key.split('.'), im = cropImg(id, m), c = document.createElement('canvas'), k = 3;
  c.width = im.width * k; c.height = im.height * k; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, c.width, c.height);
  return `<img class="pxi" alt="" src="${c.toDataURL()}" height="${size}">`; };

// canteen: one shared order per week, picked from the week key so everyone sees the same board
function canteenGoal(wk) {
  const h = hashStr('cant:' + wk), pick = (a, s) => a[(h >>> s) % a.length];
  return [[pick(['bok', 'let', 'car'], 0), 80], [pick(['tom', 'chi'], 5), 30], [pick(['cor', 'pum', 'wat'], 9), 12]];
}

const Farm = {
  BALCONY_H: 24,
  plotsFor,
  get() { const p = Prog.get(); return p.farm || { plots: [], book: {}, fw: {}, bag: {} }; },
  n(f = Farm.get(), p = Prog.get()) { return Math.max(plotsFor(roomW(p.room)), Math.min(10, f.n || 0)); },
  // how many of my crops are ripe right now (fw = friends' water counts last seen)
  ready(f = Farm.get(), now = Date.now()) { return f.plots.filter((pl, i) => pl && CROPS[pl.c] && now >= ripeAt(pl, (f.fw || {})[i] || 0)).length; },
  weatherNow: () => wxWindow(Date.now()),
  WEATHER,
  // the strip of pots under an apartment in the office tower (tower.js): railing + one pot per plot, fitted to width w
  drawBalcony(ctx, row, x, y, w, now = Date.now(), t = 0) {
    const n = row ? Math.min(10, row.n || 4) : 4, plots = row ? row.plots || [] : [], H = Farm.BALCONY_H;
    ctx.fillStyle = '#8a93a3'; ctx.fillRect(x, y + H - 6, w, 6); ctx.fillStyle = '#6b7385'; ctx.fillRect(x, y + H - 2, w, 2);
    const step = w / n;
    for (let i = 0; i < n; i++) {
      const cx = Math.round(x + step * (i + .5)), pl = plots[i] && CROPS[plots[i].c] ? plots[i] : null;
      ctx.fillStyle = '#a5683f'; ctx.fillRect(cx - 6, y + H - 13, 12, 7); ctx.fillStyle = '#6b3e26'; ctx.fillRect(cx - 7, y + H - 14, 14, 2);
      if (!pl) continue;
      const g = growMs(pl), e = now - pl.t, st = e >= g ? 3 : e < g * .15 ? 0 : e < g * .5 ? 1 : 2;
      const im = st === 3 ? cropImg(pl.c, MUT_AT(pl)) : pxa(['crop_seed', 'crop_sprout', 'crop_grow'][st]), k = st === 3 ? 1.5 : 1;
      const bob = st === 3 ? Math.round(Math.sin(t * 4 + i)) : 0;
      ctx.imageSmoothingEnabled = false; ctx.drawImage(im, Math.round(cx - im.width * k / 2), Math.round(y + H - 14 - im.height * k + bob), im.width * k, im.height * k);
    }
    ctx.fillStyle = '#d9dde3'; ctx.fillRect(x, y + H - 9, w, 1);                 // rail
    for (let px = x + 2; px < x + w; px += 12) ctx.fillRect(px, y + H - 9, 1, 3);
  },
  balconyInfo(row, now = Date.now()) {
    if (!row) return '🌱 ยังไม่ได้ปลูกผัก';
    const pl = (row.plots || []).filter(p => p && CROPS[p.c]), ripe = pl.filter(p => now >= ripeAt(p, 0)).length;
    return `🌱 ${row.nm} · ปลูก ${pl.length}/${row.n || 4}${ripe ? ` · สุก ${ripe}` : ''}${pl.length - ripe ? ` · รดน้ำได้ ${pl.length - ripe}` : ''} · ผลไม้ประจำตัว ${CROPS[sigOf(row.k)][0]}`;
  },
};
// the mutation a crop gets: the weather at the moment it ripens
const MUT_AT = (pl, fw = 0) => WEATHER[weatherAt(ripeAt(pl, fw))][3];

function farmMount(root, api) {
  root.innerHTML = `<div class="hud office-hud"><span data-k="title"></span><span class="farm-wx" data-k="wx"></span><span class="muted farm-info" data-k="info"></span><span class="farm-coins">🪙 <b data-k="coins">0</b></span></div>
    <div class="office farm"><div class="office-room"><div class="office-tools" data-k="tools"></div></div>
    <div class="box office-side"><div class="rk-tabs" data-k="tabs"></div><div class="office-list" data-k="list"></div></div></div>`;
  const W = 640, H = 360, box = root.querySelector('.office-room'), { cv, ctx, at } = g2canvas(box, W, H);
  box.insertBefore(cv.parentNode, box.firstChild);
  const q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX(), nm = myName(), myKey = keyOf(nm), mySig = sigOf(myKey);
  let p = Prog.get(), f = p.farm || (p.farm = { plots: [], book: {}, fw: {}, bag: {} }), tab = 'seed', seed = store.get('farmSeed', 'bok'), hover = -1, t = 0;
  f.bag = f.bag || {}; f.book = f.book || {}; f.fw = f.fw || {}; f.plots = f.plots || [];
  let visit = null, myWaters = {}, O = null, offW = null, offC = null, friends = null, cant = null, giftTo = store.get('giftTo', '');
  const okSeed = id => CROPS[id] && (SIG.includes(id) ? id === mySig : p.lv >= CROPS[id][4]);
  if (!okSeed(seed)) seed = 'bok';
  const me = { x: 320, tx: 320, dir: 'down', who: p.who || 'adam', act: 0 };
  const wk = () => { const d = new Date(Date.now() + 7 * 3600e3), mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5); return `${mon.getUTCFullYear()}${String(mon.getUTCMonth() + 1).padStart(2, '0')}${String(mon.getUTCDate()).padStart(2, '0')}`; };

  /* ---------- layout: 2 raised beds of up to 5 plots ---------- */
  const PW = 104, PH = 64, GAPX = 8, X0 = (W - (PW * 5 + GAPX * 4)) / 2, ROWY = [196, 306], AISLE = 228;
  const plotRect = i => ({ x: X0 + (i % 5) * (PW + GAPX), y: ROWY[Math.floor(i / 5)] - PH, w: PW, h: PH });
  const plots = () => visit ? visit.plots : f.plots;
  const nMine = () => Farm.n(f, Prog.get());
  const nPlots = () => visit ? Math.min(10, visit.n || 4) : nMine();
  const fwOf = i => visit ? Object.keys((visit.w || {})[i] || {}).filter(k => visit.w[i][k].s === (visit.plots[i] || {}).t).length : fwMine(i);
  const fwMine = i => { const pl = f.plots[i]; if (!pl) return 0; return Object.values(myWaters[i] || {}).filter(v => v.s === pl.t).length; };
  const stage = (pl, fw, now) => { const g = growMs(pl, fw), e = now - pl.t; return e >= g ? 3 : e < g * .15 ? 0 : e < g * .5 ? 1 : 2; };
  const bagN = () => Object.values(f.bag).reduce((a, n) => a + n, 0);
  const bagValue = () => Object.entries(f.bag).reduce((a, [k, n]) => a + bagPrice(k) * n, 0);
  // the next room size up and how many plots it brings
  const nextRoom = () => ROOM_SIZES.find(z => z[0] > roomW(Prog.get().room));

  /* ---------- saving: local progress + the public copy friends read ---------- */
  function save() { const pp = Prog.get(); pp.farm = f; Prog.put(pp); p = pp; publish(); }
  let pubT = 0;
  function publish() {
    clearTimeout(pubT); if (!nm) return;
    pubT = setTimeout(() => loadOnline().then(O => O.saveFarm(nm, { who: p.who, n: nMine(), plots: f.plots })).catch(() => {}), 800);
  }
  let dead = false;
  loadOnline().then(o => { if (dead) return; O = o;
    if (nm) {
      offW = O.watchWaters(myKey, w => {
        if (dead) { offW && offW(); return; }
        fresh();
        const seen = store.get('farmSeenW', []), news = [];
        myWaters = w || {};
        f.fw = {}; f.plots.forEach((pl, i) => { if (pl) f.fw[i] = fwMine(i); });
        for (const [i, by] of Object.entries(myWaters)) for (const [k, v] of Object.entries(by || {})) { const id = `${i}:${k}:${v.s}`; if (!seen.includes(id) && f.plots[i] && f.plots[i].t === v.s) { news.push(v.n); seen.push(id); } }
        if (news.length) { toast(`💧 ${[...new Set(news)].join(', ')} มารดน้ำผักให้คุณ`); store.set('farmSeenW', seen.slice(-80)); }
        const pp = Prog.get(); pp.farm = f; store.set('prog', pp);
      });
      // gifts waiting for me go into the basket
      O.takeGifts(myKey).then(gs => { if (dead || !gs.length) return; fresh();
        for (const g of gs) if (CROPS[g.c.split('.')[0]]) { f.bag[g.c] = (f.bag[g.c] || 0) + 1; const id = g.c.split('.')[0]; const b = f.book[id] || (f.book[id] = [0, 0]); b[2] = (b[2] || 0) + 1; }
        save(); api.sfx('good');
        const by = {}; gs.forEach(g => (by[g.f] = by[g.f] || []).push(bagName(g.c)));
        toast('🎁 ' + Object.entries(by).map(([n, a]) => `${n} ส่ง${a.join(', ')}ให้คุณ`).join(' · ')); render(); }).catch(() => {});
    }
    offC = O.watchCanteen(wk(), v => { if (dead) return; cant = v; if (tab === 'cant') list(); });
    // opened from a balcony in the office tower
    const fv = window.farmVisit; window.farmVisit = null;
    if (fv) O.listFarms().then(rows => { const r = rows.find(x => x.k === fv); if (r && !dead) openFriend(r); }).catch(() => {});
  }).catch(() => {});

  /* ---------- actions ---------- */
  // another tab (or an earlier visit) may have changed the farm since: always act on the stored copy
  function fresh() { const s2 = Prog.get().farm; if (s2) { s2.fw = f.fw || {}; s2.bag = s2.bag || {}; s2.book = s2.book || {}; f = s2; } }
  // the water watcher fires as soon as this lands and reloads the stored farm, so clear only after the caller has saved
  function clearW(i) { if (O && nm) setTimeout(() => O.clearWaters(myKey, i), 0); }
  function walkTo(i) { const r = plotRect(i); me.tx = r.x + r.w / 2; me.act = .5; }
  function pop(i, s, col) { const r = plotRect(i); fx.text(r.x + r.w / 2, r.y - 4, s, { color: col, size: 20 }); }
  function plant(i, id = seed, quiet) {
    const c = CROPS[id]; p = Prog.get();
    if (!okSeed(id)) { toast(SIG.includes(id) ? `${c[0]}เป็นผลไม้ประจำตัวของคนอื่น` : `ปลดล็อก${c[0]}ที่ Lv ${c[4]}`); return false; }
    if (p.coins < c[2]) { if (!quiet) toast(`เหรียญไม่พอซื้อเมล็ด${c[0]} (🪙 ${c[2]})`); return false; }
    p.coins -= c[2]; store.set('prog', p);
    f.plots[i] = { c: id, t: Date.now(), w: f.spr ? 1 : 0 }; delete f.fw[i];
    clearW(i);
    if (!quiet) { walkTo(i); api.sfx('tick'); pop(i, `−${c[2]} 🪙`, PAL.green); }
    return true;
  }
  function water(i) {
    const pl = f.plots[i]; if (!pl || pl.w || fwMine(i) >= WATER_MAX) return false;
    pl.w = 1; walkTo(i); api.sfx('tick'); splash(i); pop(i, '💧 เร็วขึ้น 15%', PAL.blue); return true;
  }
  function splash(i) { const r = plotRect(i); fx.burst(r.x + r.w / 2, r.y + 20, { n: 14, colors: ['#4cc3ff', '#bfe9ff', '#fff'], speed: 140, size: 4 }); }
  // harvest goes into the basket (XP now, coins when sold or delivered)
  function harvest(i, quiet) {
    const pl = f.plots[i], c = CROPS[pl.c], m = MUT_AT(pl, fwMine(i)), key = pl.c + (m ? '.' + m : ''), xp = Math.round((c[3] - c[2]) / 3) + 1;
    const b = f.book[pl.c] || (f.book[pl.c] = [0, 0]); b[0]++; if (m) { b[1] = (b[1] || 0) + 1; (b[3] = b[3] || {})[m] = 1; }
    f.bag[key] = (f.bag[key] || 0) + 1;
    f.plots[i] = null; delete f.fw[i];
    clearW(i);
    const pp = Prog.get(); pp.farm = f; store.set('prog', pp);
    Prog.give(0, xp); p = Prog.get();
    if (!quiet) { walkTo(i); api.sfx(m ? 'level' : 'good'); }
    pop(i, m ? `${WEATHER[weatherAt(ripeAt(pl, fwMine(i)))][1]} ${bagName(key)}!` : `+1 ${c[0]}`, m ? PAL.orange : PAL.ink);
    const r = plotRect(i); fx.burst(r.x + r.w / 2, r.y + 24, { n: m ? 30 : 12, colors: m ? CONFETTI : ['#21c07a', '#ffd23f', '#fff'] });
    if (m && m !== 'w' && nm) loadOnline().then(O => O.pushFeed(`${m === 'r' ? '🌈' : '✨'} ${nm} ได้${bagName(key)}จากฟาร์มดาดฟ้า!`, nm, myAva())).catch(() => {});
    return key;
  }
  function harvestAll() { fresh(); const now = Date.now(); let n = 0;
    f.plots.forEach((pl, i) => { if (pl && now >= ripeAt(pl, fwMine(i))) { harvest(i, true); n++; } });
    if (n) { api.sfx('good'); toast(`🧺 เก็บใส่ตะกร้า ${n} อย่าง`); save(); render(); } }
  function plantAll() { fresh(); let n = 0;
    for (let i = 0; i < nMine(); i++) if (!f.plots[i] && plant(i, seed, true)) n++;
    if (n) { api.sfx('tick'); toast(`ปลูก${CROPS[seed][0]} ${n} แปลง (−${CROPS[seed][2] * n} 🪙)`); save(); render(); }
    else toast(p.coins < CROPS[seed][2] ? 'เหรียญไม่พอซื้อเมล็ด' : 'ไม่มีแปลงว่าง'); }
  function waterAll() { fresh(); let n = 0; f.plots.forEach((pl, i) => { if (pl && !pl.w && fwMine(i) < WATER_MAX && Date.now() < ripeAt(pl, fwMine(i)) && water(i)) n++; });
    if (n) { save(); render(); } }
  function sell(key, all) { fresh(); const keys = key ? [key] : Object.keys(f.bag); let c = 0, n = 0;
    for (const k of keys) { const cnt = all || !key ? f.bag[k] || 0 : Math.min(1, f.bag[k] || 0); if (!cnt) continue; c += bagPrice(k) * cnt; n += cnt; f.bag[k] -= cnt; if (!f.bag[k]) delete f.bag[k]; }
    if (!n) return; save(); Prog.give(c, 0); api.sfx('good'); toast(`💰 ขาย ${n} ชิ้น +${fmt(c)} 🪙`); render(); }
  function buySprinkler() { fresh(); p = Prog.get(); const [price, lv] = SPRINKLER;
    if (p.lv < lv) { toast(`ปลดล็อกสปริงเกอร์ที่ Lv ${lv}`); return; }
    if (p.coins < price) { toast(`เหรียญไม่พอ ขาดอีก 🪙 ${fmt(price - p.coins)}`); return; }
    p.coins -= price; store.set('prog', p); f.spr = 1; api.sfx('level'); toast('💧 ติดสปริงเกอร์แล้ว ผักที่ปลูกใหม่ได้น้ำเองทุกต้น'); save(); render(); }
  function growRoom() { window.officeTab = 'style'; startGame('office'); window.officeTab = null; }

  // canteen: deliver basket items toward this week's shared order (pays a bit more than selling)
  function deliver(id) {
    if (!O) return; if (!nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อน'); return; }
    fresh(); const goal = canteenGoal(wk()).find(g => g[0] === id); if (!goal) return;
    const keys = Object.keys(f.bag).filter(k => k.split('.')[0] === id).sort((a, b) => bagPrice(a) - bagPrice(b));   // plain ones first
    const have = keys.reduce((a, k) => a + f.bag[k], 0); if (!have) return;
    O.deliver(wk(), id, have, goal[1], nm).then(took => {
      if (!took) { toast('ครบแล้ว ขอบคุณที่ช่วย 🍱'); return; }
      fresh(); let left = took, c = 0;
      for (const k of keys) { const u = Math.min(left, f.bag[k] || 0); f.bag[k] -= u; if (!f.bag[k]) delete f.bag[k]; c += Math.round(bagPrice(k) * CANTEEN_BONUS) * u; left -= u; if (!left) break; }
      save(); Prog.give(c, 0); api.sfx('good'); toast(`🍱 ส่ง${CROPS[id][0]} ${took} ชิ้น +${fmt(c)} 🪙`); render();
    }).catch(() => toast('ส่งไม่สำเร็จ (เน็ตหลุด?)'));
  }
  function claimCanteen() {
    const k = 'cant_' + wk(); if (store.get(k, false)) return; store.set(k, true);
    Prog.give(CANTEEN_REWARD, 20); api.sfx('level'); toast(`🎉 รางวัลโรงอาหารสัปดาห์นี้ +${CANTEEN_REWARD} 🪙`); list(); hud();
  }
  // gifts: one item to a friend, claimed when they next open the farm
  function gift(key) {
    if (!O || !nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อน'); return; }
    const to = (friends || []).find(r => r.k === giftTo); if (!to) { toast('เลือกเพื่อนที่จะส่งให้ก่อน'); return; }
    const d = store.get('giftD', { d: '', n: 0 }), day = new Date().toDateString(); if (d.d !== day) { d.d = day; d.n = 0; }
    if (d.n >= GIFT_DAY) { toast(`วันนี้ส่งครบ ${GIFT_DAY} ชิ้นแล้ว พรุ่งนี้ส่งใหม่ได้`); return; }
    fresh(); if (!f.bag[key]) return;
    f.bag[key]--; if (!f.bag[key]) delete f.bag[key]; save();
    O.sendGift(to.k, nm, key).then(() => { d.n++; store.set('giftD', d); api.sfx('good'); toast(`🎁 ส่ง${bagName(key)}ให้ ${to.nm} แล้ว`); render(); })
      .catch(() => { fresh(); f.bag[key] = (f.bag[key] || 0) + 1; save(); toast('ส่งไม่สำเร็จ (เน็ตหลุด?)'); render(); });
  }
  // friends: water their growing crops (one 💧 per crop per person, small thank-you coins for the waterer)
  function waterFriend(i) {
    const pl = visit.plots[i]; if (!pl || !O) return;
    if (!nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อน ถึงจะรดน้ำให้เพื่อนได้'); return; }
    const by = (visit.w || {})[i] || {}, mine = by[myKey] && by[myKey].s === pl.t;
    if (mine) { toast('รดต้นนี้ไปแล้ว 💧'); return; }
    if ((pl.w ? 1 : 0) + fwOf(i) >= WATER_MAX) { toast('ต้นนี้ได้น้ำครบแล้ว 💧'); return; }
    if (Date.now() >= ripeAt(pl, fwOf(i))) { toast(`${CROPS[pl.c][0]}สุกแล้ว รอ ${visit.nm} มาเก็บ`); return; }
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
  function loadFriends() { return loadOnline().then(O => O.listFarms()).then(rows => (friends = rows.filter(r => r.k !== myKey))); }

  /* ---------- HUD, tools and side panel ---------- */
  function render() { hud(); tools(); list(); }
  function hud() {
    p = Prog.get();
    q('title').innerHTML = visit ? `สวนของ <b>${esc(visit.nm)}</b>` : `<b>🌱 ฟาร์มดาดฟ้า</b>`;
    q('coins').textContent = fmt(p.coins);
  }
  function wxHud(now) {
    const w = wxWindow(now), W0 = WEATHER[w.id], nx = nextSpecial(now);
    const s = w.id !== 'clear' ? `${W0[1]} <b>${W0[0]}</b> อีก ${Math.ceil((w.to - now) / 60e3)} น. · ผักที่สุกตอนนี้กลายเป็น<b>${MUT[W0[3]][0]}</b> ×${W0[4]}`
      : `${W0[1]} ${W0[0]}${nx ? ` · ถัดไป ${WEATHER[nx.id][1]} ${WEATHER[nx.id][0]} ${hhmm(nx.from)}` : ''}`;
    const el = q('wx'); if (el.innerHTML !== s) { el.innerHTML = s; el.classList.toggle('on', w.id !== 'clear'); }
  }
  function tools() {
    const el = q('tools');
    if (visit) { el.innerHTML = `<span class="muted">แตะต้นที่ยังไม่สุกเพื่อรดน้ำ ช่วยเพื่อนให้โตเร็วขึ้น 15%</span><button class="btn" data-a="back">← กลับสวนฉัน</button>`;
      el.querySelector('[data-a=back]').onclick = back; return; }
    const now = Date.now(), ripe = Farm.ready(f, now), empty = Array.from({ length: nMine() }, (_, i) => !f.plots[i]).filter(Boolean).length,
      dry = f.plots.filter((pl, i) => pl && !pl.w && fwMine(i) < WATER_MAX && now < ripeAt(pl, fwMine(i))).length, bn = bagN();
    el.innerHTML = `<button class="btn${ripe ? ' primary' : ''}" data-a="all" ${ripe ? '' : 'disabled'}>🧺 เก็บ${ripe ? ` ${ripe}` : ''}</button>
      <button class="btn" data-a="plant" ${empty ? '' : 'disabled'}>${pxImg('crop_' + seed, 18)} ปลูกที่ว่าง${empty ? ` ${empty}` : ''}</button>
      ${f.spr ? '' : `<button class="btn" data-a="water" ${dry ? '' : 'disabled'}>💧 รดน้ำ${dry ? ` ${dry}` : ''}</button>`}
      <button class="btn${bn && !ripe ? ' primary' : ''}" data-a="sell" ${bn ? '' : 'disabled'}>💰 ขายหมด${bn ? ` +${fmt(bagValue())}` : ''}</button>`;
    el.querySelector('[data-a=all]').onclick = harvestAll; el.querySelector('[data-a=plant]').onclick = plantAll;
    const wb = el.querySelector('[data-a=water]'); if (wb) wb.onclick = waterAll; el.querySelector('[data-a=sell]').onclick = () => sell();
  }
  function list() {
    const T = q('tabs'), L = q('list'), bn = bagN();
    T.innerHTML = [['seed', 'ปลูก'], ['bag', `ตะกร้า${bn ? ` <i class="tab-n">${bn}</i>` : ''}`], ['cant', '🍱 โรงอาหาร'], ['friends', 'เพื่อน'], ['book', 'สมุด']]
      .map(([k, n]) => `<button class="btn${tab === k ? ' on' : ''}" data-t="${k}">${n}</button>`).join('');
    T.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; list(); });
    if (tab === 'seed') {
      const nr = nextRoom(), seedBtn = id => { const c = CROPS[id], lock = !okSeed(id);
        return `<button class="shop-it${seed === id ? ' on' : ''}${lock ? ' lock' : ''}" data-seed="${id}" ${lock ? 'disabled' : ''} title="${c[0]}">${pxImg('crop_' + id, 30)}<b>${c[0]}</b>
          <small>${lock ? `🔒 Lv ${c[4]}` : cropTime(id)}</small><small>${lock ? '' : `${c[2]} → ${c[3]} 🪙`}</small></button>`; };
      L.innerHTML = `<div class="shop-grid">${VEG.map(seedBtn).join('')}</div>
        <h4 class="sz-h">⭐ ผลไม้ประจำตัวคุณ <small class="muted">ปลูกได้คนเดียวในออฟฟิศ เพื่อนอยากได้ต้องขอคุณ</small></h4>
        <div class="shop-grid">${seedBtn(mySig)}</div>
        <h4 class="sz-h">อุปกรณ์</h4>
        <div class="farm-gear">
          <div><b>🌱 แปลงผัก ${nMine()} แปลง</b><small class="muted">${nr ? `ขยายห้องเป็น ${nr[0]} ช่อง ได้ ${plotsFor(nr[0])} แปลง` : 'ห้องใหญ่สุดแล้ว ได้ครบ 10 แปลง'}</small></div>
          ${nr ? '<button class="btn sm" data-a="room">📐 ขยายห้อง</button>' : ''}
          <div><b>💧 สปริงเกอร์</b><small class="muted">${f.spr ? 'ติดแล้ว ผักที่ปลูกใหม่ได้น้ำเอง' : 'รดน้ำให้ทุกต้นที่ปลูกใหม่ ไม่ต้องกดเอง'}</small></div>
          ${f.spr ? '<span class="muted">✓</span>' : `<button class="btn sm" data-a="spr" ${p.lv < SPRINKLER[1] ? 'disabled' : ''}>${p.lv < SPRINKLER[1] ? `🔒 Lv ${SPRINKLER[1]}` : `🪙 ${SPRINKLER[0]}`}</button>`}
        </div>`;
      L.querySelectorAll('[data-seed]').forEach(b => b.onclick = () => { seed = b.dataset.seed; store.set('farmSeed', seed); api.sfx('tick'); tools(); list(); });
      const rb = L.querySelector('[data-a=room]'); if (rb) rb.onclick = growRoom;
      const sb = L.querySelector('[data-a=spr]'); if (sb) sb.onclick = buySprinkler;
    } else if (tab === 'bag') {
      const keys = Object.keys(f.bag).filter(k => CROPS[k.split('.')[0]]).sort((a, b) => bagPrice(b) - bagPrice(a));
      if (!keys.length) { L.innerHTML = '<p class="muted farm-empty">ตะกร้าว่าง · ผักที่เก็บจะมาอยู่ที่นี่ ขาย ส่งโรงอาหาร หรือส่งให้เพื่อนก็ได้</p>'; return; }
      L.innerHTML = `<div class="gift-to">🎁 ส่งให้ <select data-k="giftTo"><option value="">เลือกเพื่อน…</option></select></div>
        <ul class="farm-ls farm-bag">${keys.map(k => `<li>${cropURL(k, 26)}<span class="bag-n"><b>${bagName(k)} <i>×${f.bag[k]}</i></b><small>ชิ้นละ ${bagPrice(k)} 🪙</small></span>
          <button class="btn sm" data-sell="${k}">ขาย</button><button class="btn sm" data-gift="${k}" title="ส่งให้เพื่อน 1 ชิ้น">🎁</button></li>`).join('')}</ul>`;
      L.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => sell(b.dataset.sell, true));
      L.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => gift(b.dataset.gift));
      const sel = L.querySelector('[data-k=giftTo]'); sel.onchange = () => { giftTo = sel.value; store.set('giftTo', giftTo); };
      (friends ? Promise.resolve(friends) : loadFriends()).then(fr => { if (!sel.isConnected) return;
        sel.innerHTML = '<option value="">เลือกเพื่อน…</option>' + fr.map(r => `<option value="${esc(r.k)}"${r.k === giftTo ? ' selected' : ''}>${esc(r.nm)} (ผลไม้ประจำตัว: ${CROPS[sigOf(r.k)][0]})</option>`).join(''); }).catch(() => {});
    } else if (tab === 'cant') {
      const g = canteenGoal(wk()), got = (cant && cant.got) || {}, done = g.every(([id, n]) => (got[id] || 0) >= n), by = Object.values((cant && cant.by) || {}).sort((a, b) => b.p - a.p);
      const mine = cant && cant.by && cant.by[myKey], claimed = store.get('cant_' + wk(), false);
      L.innerHTML = `<p class="muted farm-tip">ออเดอร์ของทั้งออฟฟิศ สัปดาห์นี้ ช่วยกันส่งให้ครบ · ส่งได้ราคาดีกว่าขาย 20% · ครบแล้วคนที่ช่วยได้ ${CANTEEN_REWARD} 🪙</p>
        <ul class="farm-ls cant">${g.map(([id, n]) => { const have = Object.entries(f.bag).filter(([k]) => k.split('.')[0] === id).reduce((a, [, c]) => a + c, 0), v = Math.min(n, got[id] || 0);
          return `<li>${pxImg('crop_' + id, 26)}<div class="cant-m"><b>${CROPS[id][0]}</b> <span class="muted">${v}/${n}</span><span class="xpbar"><i style="width:${v / n * 100}%"></i></span></div>
            ${v >= n ? '<span class="ok">✓</span>' : `<button class="btn sm" data-dl="${id}" ${have ? '' : 'disabled'}>${have ? `ส่ง ${have}` : 'ไม่มีในตะกร้า'}</button>`}</li>`; }).join('')}</ul>
        ${done ? (mine ? (claimed ? '<p class="muted">รับรางวัลสัปดาห์นี้แล้ว ✓</p>' : `<button class="btn primary farm-plot" data-a="claim">🎉 ครบแล้ว! รับ ${CANTEEN_REWARD} 🪙</button>`) : '<p class="muted">ออเดอร์ครบแล้ว สัปดาห์หน้ามาช่วยกันใหม่นะ</p>') : ''}
        ${by.length ? `<h4 class="sz-h">คนที่ช่วยส่ง</h4><ol class="off-top">${by.slice(0, 5).map(r => `<li${keyOf(r.n) === myKey ? ' class="me"' : ''}><b>${esc(r.n)}</b> <span>${r.p} ชิ้น</span></li>`).join('')}</ol>` : ''}`;
      L.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => deliver(b.dataset.dl));
      const cb = L.querySelector('[data-a=claim]'); if (cb) cb.onclick = claimCanteen;
    } else if (tab === 'book') {
      const own = id => f.book[id] && (f.book[id][0] || f.book[id][2]), row = id => { const b = f.book[id], c = CROPS[id], muts = Object.keys((b && b[3]) || {});
        return `<li class="${own(id) ? '' : 'none'}">${own(id) ? pxImg('crop_' + id, 24) : '❔'} <b>${own(id) ? c[0] : '???'}</b> <span class="muted">${own(id) ? `เก็บ ${fmt(b[0] || 0)}${b[2] ? ` · ได้จากเพื่อน ${b[2]}` : ''}` : SIG.includes(id) ? 'ขอจากเพื่อน' : `Lv ${c[4]}`}</span>${muts.map(m => ` <i class="mut mut-${m}">${MUT[m][0]}</i>`).join('')}</li>`; };
      L.innerHTML = `<p class="muted farm-tip">ผัก ${VEG.filter(own).length}/${VEG.length} · ผลไม้ประจำตัว ${SIG.filter(own).length}/${SIG.length} · ผักที่สุกตอนฝนตก แดดทอง หรือรุ้ง จะกลายพันธุ์</p>
        <ul class="farm-ls farm-book">${VEG.map(row).join('')}</ul><h4 class="sz-h">⭐ ผลไม้ประจำตัว</h4><ul class="farm-ls farm-book">${SIG.map(row).join('')}</ul>`;
    } else {
      L.innerHTML = '<p class="muted">กำลังโหลดสวนเพื่อน…</p>';
      loadFriends().then(fr => { if (tab !== 'friends') return; const now = Date.now();
        L.innerHTML = fr.length ? `<p class="muted farm-tip">รดน้ำให้เพื่อน เพื่อนได้ผักเร็วขึ้น คุณได้ 2 🪙 (วันละ ${FRIEND_WATER_DAY} ครั้ง)</p><ul class="farm-ls">${fr.map((r, j) => {
          const pl = (r.plots || []).filter(x => x && CROPS[x.c]), grow = pl.filter(x => now < ripeAt(x, 0)).length, sg = sigOf(r.k);
          return `<li><button class="linkbtn" data-fr="${j}"><b>${esc(r.nm)}</b></button> <span class="muted">${pl.length ? `ปลูก ${pl.length}${grow ? ` · รดได้ ${grow}` : ''}` : 'สวนว่าง'}</span> <span class="fr-sig" title="ผลไม้ประจำตัว">${pxImg('crop_' + sg, 18)} ${CROPS[sg][0]}</span></li>`; }).join('')}</ul>`
          : '<p class="muted">ยังไม่มีเพื่อนปลูกผัก ชวนกันมาปลูกนะ</p>';
        L.querySelectorAll('[data-fr]').forEach(b => b.onclick = () => openFriend(fr[+b.dataset.fr]));
      }).catch(() => { L.innerHTML = '<p class="muted">โหลดสวนเพื่อนไม่ได้ (เน็ตหลุด?)</p>'; });
    }
  }

  /* ---------- input ---------- */
  function plotAt(e) { const { x, y } = at(e); for (let i = 0; i < 10; i++) { const r = plotRect(i); if (x >= r.x && x < r.x + r.w && y >= r.y - 40 && y < r.y + r.h) return i; } return -1; }
  cv.addEventListener('pointermove', e => { hover = plotAt(e); cv.style.cursor = hover >= 0 && (hover < nPlots() || (!visit && hover === nPlots())) ? 'pointer' : 'default'; });
  cv.addEventListener('pointerleave', () => { hover = -1; });
  cv.addEventListener('pointerdown', e => {
    const i = plotAt(e); if (i < 0) return;
    if (i >= nPlots()) { if (!visit && i === nPlots()) growRoom(); return; }
    if (visit) { waterFriend(i); return; }
    fresh();
    const pl = f.plots[i], now = Date.now();
    if (!pl) { if (plant(i)) { save(); render(); } return; }
    if (now >= ripeAt(pl, fwMine(i))) { harvest(i); save(); render(); return; }
    if (!pl.w && fwMine(i) < WATER_MAX) { water(i); save(); render(); return; }
    toast(`${CROPS[pl.c][0]} อีก ${mmss(ripeAt(pl, fwMine(i)) - now)}`);
  });

  /* ---------- drawing ---------- */
  const clouds = [[60, 30, .6], [300, 54, .4], [520, 22, .5]], rain = Array.from({ length: 70 }, (_, i) => [(i * 89) % W, (i * 47) % H, 260 + (i % 5) * 30]);
  function scene(wx) {
    const h = new Date().getHours(), g = ctx.createLinearGradient(0, 0, 0, 120), dusk = h >= 17 && h < 19, night = h >= 19 || h < 6;
    if (wx === 'rain') { g.addColorStop(0, '#8d9bb0'); g.addColorStop(1, '#c9d2de'); }
    else if (night) { g.addColorStop(0, '#26306a'); g.addColorStop(1, '#4b5594'); }
    else if (dusk) { g.addColorStop(0, '#ffab7a'); g.addColorStop(1, '#ffe2b8'); }
    else if (wx === 'sun') { g.addColorStop(0, '#ffd56b'); g.addColorStop(1, '#fff3cf'); }
    else { g.addColorStop(0, '#8fd0ff'); g.addColorStop(1, '#dff3ff'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 120);
    if (wx === 'rainbow') { ['#ff5c8a', '#ff9f1c', '#ffd23f', '#21c07a', '#4cc3ff', '#8338ec'].forEach((c, i) => { ctx.strokeStyle = c; ctx.globalAlpha = .55; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(W / 2, 150, 150 - i * 5, Math.PI, 0); ctx.stroke(); }); ctx.globalAlpha = 1; }
    ctx.imageSmoothingEnabled = false;
    for (const c of clouds) { const x = ((c[0] + t * 8 * c[2]) % (W + 80)) - 60; ctx.globalAlpha = wx === 'rain' ? 1 : .9; ctx.drawImage(pxa('cloud'), x, c[1], 60, 24); ctx.globalAlpha = 1; }
    ctx.fillStyle = night ? '#3a4278' : wx === 'rain' ? '#9aa6b8' : '#b9d6ea';
    [[0, 70, 50], [46, 54, 40], [84, 80, 60], [150, 46, 44], [200, 66, 70], [276, 40, 36], [318, 74, 54], [380, 58, 62], [448, 82, 40], [494, 50, 56], [556, 70, 48], [600, 60, 40]].forEach(([x, hh, w]) => ctx.fillRect(x, 120 - hh, w, hh));
    ctx.fillStyle = '#c96f4a'; ctx.fillRect(0, 100, W, 22); ctx.fillStyle = '#a95a3a'; for (let y = 104; y < 122; y += 8) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = wx === 'rain' ? '#dcd8cf' : '#e9e4da'; ctx.fillRect(0, 122, W, H - 122);
    ctx.fillStyle = '#d8d2c6'; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 122, 2, H - 122); for (let y = 122; y < H; y += 40) ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = 'rgba(43,33,64,.15)'; ctx.fillRect(0, 122, W, 4);
    for (const [n, x] of [['plant_small', 70], ['crate', 180], ['bench_cream', 320], ['plant_pot', 470], ['fruit_veg', 570]]) drawPixAt(ctx, n, x, H - 4, 2);
  }
  function weatherFX(wx) {
    if (wx === 'rain') { ctx.strokeStyle = 'rgba(90,140,200,.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (const r of rain) { const y = (r[1] + t * r[2]) % H, x = (r[0] - t * 30 + W * 4) % W; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); } ctx.stroke(); }
    else if (wx === 'sun') { ctx.fillStyle = 'rgba(255,214,90,.12)'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 8; i++) { const a = (Math.sin(t * 2 + i * 1.7) + 1) / 2; ctx.globalAlpha = a; ctx.drawImage(pxa('spark'), (i * 83 + 40) % W, 140 + (i * 37) % 200, 8, 8); } ctx.globalAlpha = 1; }
  }
  function bed(i, now) {
    const r = plotRect(i), open = i < nPlots(), pl = open ? plots()[i] : null;
    if (!open) {
      if (visit || i !== nPlots()) return;
      const nr = nextRoom();
      ctx.setLineDash([6, 5]); rrect(ctx, r.x + 4, r.y + 14, r.w - 8, r.h - 14, 8, hover === i ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.5)', '#b0a48f'); ctx.setLineDash([]);
      if (nr) { txt(ctx, `📐 ขยายห้อง`, r.x + r.w / 2, r.y + 34, 12, '#7a6f8c', 'center', 700); txt(ctx, `ได้ ${plotsFor(nr[0])} แปลง`, r.x + r.w / 2, r.y + 50, 11, '#7a6f8c'); }
      return;
    }
    rrect(ctx, r.x, r.y + 12, r.w, r.h - 12, 6, '#a5683f', '#6b3e26');
    rrect(ctx, r.x + 6, r.y + 18, r.w - 12, r.h - 30, 4, pl && (pl.w || fwOf(i)) ? '#5a3a22' : '#7a5034');
    ctx.fillStyle = '#6b3e26'; ctx.fillRect(r.x + 4, r.y + r.h - 10, r.w - 8, 2);
    if (hover === i) rrect(ctx, r.x - 3, r.y + 9, r.w + 6, r.h - 6, 8, null, PAL.yel);
    if (!pl) { if (!visit && hover === i) { ctx.globalAlpha = .7; ctx.drawImage(pxa('crop_' + seed), r.x + r.w / 2 - 18, r.y + 2, 36, 32); ctx.globalAlpha = 1; } return; }
    const fw = fwOf(i), st = stage(pl, fw, now), m = st === 3 ? MUT_AT(pl, fw) : '';
    const im = st === 3 ? cropImg(pl.c, m) : pxa(['crop_seed', 'crop_sprout', 'crop_grow'][st]), k = st === 3 ? 4 : 3, bob = st === 3 ? Math.round(Math.sin(t * 4 + i) * 1.5) : 0;
    ctx.drawImage(im, Math.round(r.x + r.w / 2 - im.width * k / 2), Math.round(r.y + 34 - im.height * k + bob), im.width * k, im.height * k);
    const drops = Math.min(WATER_MAX, (pl.w ? 1 : 0) + fw); for (let d = 0; d < drops; d++) ctx.drawImage(pxa('water'), r.x + 8 + d * 12, r.y + r.h - 22, 8, 8);
    if (st === 3) { const s = Math.sin(t * 5 + i); ctx.globalAlpha = .5 + .5 * s; ctx.drawImage(pxa('spark'), r.x + r.w - 22, r.y - 6 + s * 2, 10, 10); ctx.globalAlpha = 1;
      const label = m ? MUT[m][0] + '!' : visit ? 'สุกแล้ว' : 'เก็บได้', lw = Math.max(60, label.length * 9);
      rrect(ctx, r.x + r.w / 2 - lw / 2, r.y - 30, lw, 20, 10, m === 'r' ? '#ffd6ec' : m === 'g' ? '#ffe08a' : m === 'w' ? '#bfe9ff' : PAL.yel, PAL.ink); txt(ctx, label, r.x + r.w / 2, r.y - 20, 12, PAL.ink, 'center', 700); }
    else { const left = ripeAt(pl, fw) - now, frac = 1 - left / growMs(pl, fw), wxR = WEATHER[weatherAt(ripeAt(pl, fw))];
      rrect(ctx, r.x + 14, r.y - 24, r.w - 28, 16, 8, 'rgba(255,255,255,.92)', '#b0a48f');
      ctx.fillStyle = '#9ee6b8'; ctx.fillRect(r.x + 16, r.y - 22, (r.w - 32) * Math.max(0, Math.min(1, frac)), 12);
      txt(ctx, mmss(left) + (wxR[3] ? ' ' + wxR[1] : ''), r.x + r.w / 2, r.y - 16, 11, PAL.ink, 'center', 700); }
  }
  function info(now) {
    const el = q('info'); if (!el) return; let s = '';
    if (hover >= 0 && hover < nPlots()) { const pl = plots()[hover];
      if (!pl) s = visit ? 'แปลงว่าง' : `แตะเพื่อปลูก${CROPS[seed][0]} (${CROPS[seed][2]} 🪙)`;
      else { const fw = fwOf(hover), left = ripeAt(pl, fw) - now, by = visit ? null : Object.values(myWaters[hover] || {}).filter(v => v.s === pl.t).map(v => v.n), wxR = WEATHER[weatherAt(ripeAt(pl, fw))];
        s = `${CROPS[pl.c][0]} · ${left <= 0 ? (visit ? 'สุกแล้ว' : 'แตะเพื่อเก็บ') : `สุก ${hhmm(ripeAt(pl, fw))}${wxR[3] ? ` ตอน${wxR[0]} → ${MUT[wxR[3]][0]}` : ''}`}${(pl.w ? 1 : 0) + fw ? ` · 💧×${Math.min(WATER_MAX, (pl.w ? 1 : 0) + fw)}` : left > 0 && !visit ? ' · แตะเพื่อรดน้ำ' : ''}${by && by.length ? ` (${by.join(', ')} รดให้)` : ''}`; } }
    else if (hover === nPlots() && !visit && nextRoom()) s = 'ขยายห้องในออฟฟิศของฉัน แปลงผักเพิ่มตาม';
    else if (!visit) { const ripe = Farm.ready(f, now); s = ripe ? `พร้อมเก็บ ${ripe} แปลง` : f.plots.some(Boolean) ? 'ผักกำลังโต ไปเล่นเกมก่อนก็ได้' : 'เลือกเมล็ดแล้วแตะแปลงเพื่อปลูก'; }
    if (el.textContent !== s) el.textContent = s;
  }
  let sig = '';
  const off = api.loop(dt => {
    t += dt; const d = fx.step(dt), now = Date.now(), wx = wxWindow(now).id;
    if (Math.abs(me.tx - me.x) > 1) { me.x += Math.sign(me.tx - me.x) * Math.min(160 * d, Math.abs(me.tx - me.x)); me.dir = me.tx > me.x ? 'right' : 'left'; } else me.dir = 'down';
    fx.pre(ctx); scene(wx);
    for (let i = 0; i < 5; i++) bed(i, now);
    const moving = Math.abs(me.tx - me.x) > 1, anim = moving ? 'run' : 'idle_anim';
    drawChar(ctx, me.who, anim, me.dir, t, me.x, AISLE + 14, 2);
    if (!visit) { drawAcc(ctx, Wardrobe.eq('f'), me.who, anim, me.dir, t, me.x, AISLE + 14, 2); drawAcc(ctx, Wardrobe.eq('h'), me.who, anim, me.dir, t, me.x, AISLE + 14, 2); }
    if (me.act > 0) { me.act -= dt; ctx.drawImage(pxa('can'), me.x + 10, AISLE - 40, 30, 24); }
    for (let i = 5; i < 10; i++) bed(i, now);
    weatherFX(wx);
    fx.post(ctx, W, H);
    info(now); wxHud(now);
    // refresh the buttons when a crop ripens
    const s = visit ? 'v' : `${Farm.ready(f, now)}`; if (s !== sig) { sig = s; if (!visit) tools(); }
  });
  render();
  if (/[?&]test=1/.test(location.search)) window.__farm = { get f() { return f; }, harvestAll, harvest, fwMine, ripeAt };
  return { destroy() { dead = true; off(); offW && offW(); offC && offC(); clearTimeout(pubT); publish(); } };
}
