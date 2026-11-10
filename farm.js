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
// [Thai name, grow minutes, seed price, sell price, level, art]. Sell prices were cut on 5 Nov 2026 (the farm out-earned the games);
// harvest XP still uses the old margins (CROP_XP) so levelling speed did not change.
const CROPS = {
  bok: ['ผักบุ้ง', 3, 4, 5, 1, ['g...g...g', 'gg.gGg.gg', '.gGgGgGg.', '.gGgGgGg.', '..gGGGg..', '..GgGgG..', '..GgGgG..', '...GGG...']],
  let: ['ผักสลัด', 10, 8, 11, 1, ['...ggg...', '.ggwgwgg.', 'gGgggggGg', 'ggGgwgGgg', 'gGgggggGg', '.gGgGgGg.', '..ggggg..']],
  car: ['แครอท', 20, 12, 17, 2, ['..g.g.g..', '..gGgGg..', '...gGg...', '...kGk...', '..ktttk..', '..ktttk..', '...kttk..', '...ktk...', '....k....']],
  tom: ['มะเขือเทศ', 40, 18, 25, 3, ['..gGgGg..', '.gGrrGgg.', 'gGrwrRgGg', 'gGrrRGrrg', '.gGRgGrwr', '.gGgGgrrR', '..gGGGg..', '...GGG...']],
  chi: ['พริก', 60, 22, 32, 5, ['...gGg...', '.ggGgGgg.', 'gGrgGgRgg', 'gGRgGgrGg', '.grGgGrg.', '.gRgGgRg.', '..gGGGg..', '...GGG...']],
  cor: ['ข้าวโพด', 90, 28, 40, 7, ['....g.....', '...ggk....', '..gGkyk...', '..gkyyyk..', '.gGkyoyk..', 'gGgkyyyk.g', '.g.kyoykgG', '...gkyyGg.', '....gGGg..', '.....GG...']],
  pum: ['ฟักทอง', 120, 35, 48, 9, ['....Gc....', '...gGc....', '.kkkkkkkk.', 'ktottottok', 'kttottotok', 'kttottotok', 'ktottottok', '.kkkkkkkk.']],
  wat: ['แตงโม', 180, 45, 64, 12, ['.....gG....', '..kkkkkkk..', '.kgGgGgGgk.', 'kgGgGgGgGgk', 'kGgGgGgGgGk', 'kgGgGgGgGgk', '.kGgGgGgGk.', '..kkkkkkk..']],
  // signature fruits: everyone is dealt one (from their name); only its owner can plant it
  mgo: ['มะม่วง', 60, 20, 30, 1, ['....Gg...', '...kkkk..', '..kyyyok.', '.kyyyyyok', '.kyyytyok', '.kyyttook', '..kyttok.', '...kkkk..']],
  mgs: ['มังคุด', 60, 20, 30, 1, ['...gGg...', '..gGkGg..', '.kkvvvkk.', 'kvvvvvvvk', 'kvwvvvvvk', 'kvvvvvvvk', '.kvvvvvk.', '..kkkkk..']],
  lyc: ['ลิ้นจี่', 60, 20, 30, 1, ['...Gg....', '..kkkk...', '.krRrRk..', 'kRrRrRrk.', 'krRrRrRk.', 'kRrRrRrk.', '.krRrRk..', '..kkkk...']],
  ram: ['เงาะ', 60, 20, 30, 1, ['.r.r.r.r.', 'r.kkkkk.r', '.krrrrrk.', 'rkrwrrrkr', '.krrrrrk.', 'rkrrrrRkr', '.kkrrrkk.', 'r..kkk..r']],
  coc: ['มะพร้าว', 60, 20, 30, 1, ['..kkkkk..', '.kcCcCck.', 'kcCcCcCck', 'kCcCcCcCk', 'kcCcCckck', '.kcCckck.', '..kkkkk..']],
  dur: ['ทุเรียน', 60, 20, 30, 1, ['....c....', '..kykyk..', '.kygyyyk.', 'kyygyGyyk', 'kgyyGyygk', 'kyyGyyGyk', '.kGyygyk.', '..kkkkk..']],
};
const SIG = ['mgo', 'mgs', 'lyc', 'ram', 'coc', 'dur'], VEG = Object.keys(CROPS).filter(id => !SIG.includes(id));
for (const [id, c] of Object.entries(CROPS)) PXA_ART['crop_' + id] = c[5];
Object.assign(PXA_ART, {
  crop_seed: ['..........', '...c..c...', '..cCccCc..', '.cCCCCCCc.'],
  crop_sprout: ['.gg...gg.', 'gggg.gggg', '.gGGgGGg.', '...GgG...', '....G....', '....G....'],
  crop_grow: ['..g..g..g..', '.ggg.g.ggg.', 'ggGggGggGgg', '.gGgGgGgGg.', '..gGGGGGg..', '...gGGGg...', '....GGG....', '....G.G....'],
  can: ['.....kk...', '....kbbk..', 'kkkkkbbk..', 'kbbbbbbbkk', 'kbbbbbbbk.', 'kbBbbbbbk.', 'kbbbbbbbk.', '.kkkkkkk..'],
});
const CROP_XP = {bok:2,let:4,car:6,tom:10,chi:13,cor:18,pum:23,wat:33,mgo:13,mgs:13,lyc:13,ram:13,coc:13,dur:13};
const WATER_CUT = .15, WATER_MAX = 3, FRIEND_WATER_DAY = 20, GIFT_DAY = 10, SPRINKLER = [300, 3], CANTEEN_BONUS = 1.2, CANTEEN_REWARD = 40, CANTEEN_CD = 30 * 60e3;
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

/* ---------- market (ตลาด): prices change every 2 h, worked out from the clock like the weather (same on every screen, nothing stored) ---------- */
// base = CROPS sell price; short swings + a slow trend, kept inside 55–200%. The canteen and village deliveries keep the base price.
const MKT_PERIOD = 2 * 3600e3, MKT_BAND = [.5, 2], MKT_MAX = 5, MKT_HRS = [1, 4, 12, 24];
// every order has a timer: players pick 1/4/12/24 h (d), vendors stay 40–120 min; when it runs out the order vanishes from the stall
// and whatever it still held goes back to its owner
const mktEnd = o => o.npc ? o.to : (o.t || Date.now()) + Math.min(24, o.d || 24) * 3600e3;
const h01 = s => (hashStr(s) % 100000) / 100000;
const mNoise = (id, x, sc) => { const a = Math.floor(x / sc), fr = x / sc - a, k = fr * fr * (3 - 2 * fr); return (h01(`mk:${id}:${sc}:${a}`) * (1 - k) + h01(`mk:${id}:${sc}:${a + 1}`) * k) * 2 - 1; };
const mktMult = (id, P) => Math.max(.55, Math.min(2, 1 + .42 * mNoise(id, P, 1) + .3 * mNoise(id, P, 6) + .12 * mNoise(id, P, 24)));
const mktPer = (t = Date.now()) => Math.floor(t / MKT_PERIOD);
const mktAt = (id, P = mktPer()) => Math.max(1, Math.round(CROPS[id][3] * mktMult(id, P)));
const mktMood = (id, P = mktPer()) => { const m = mktMult(id, P); return m >= 1.5 ? 'hot' : m <= .72 ? 'cold' : ''; };
const mktBand = id => { const m = mktAt(id); return [Math.ceil(m * MKT_BAND[0]), Math.floor(m * MKT_BAND[1])]; };
// what the market pays for a basket item now (mutations multiply the market price)
const mktPrice = key => { const [id, m] = key.split('.'); return Math.max(1, Math.round(mktAt(id) * (m ? MUT[m][1] : 1))); };
const moodTag = (id, long) => { const md = mktMood(id); return md === 'hot' ? `<em class="mk-tag hot">🔥${long ? ' ราคาดี' : ''}</em>` : md === 'cold' ? `<em class="mk-tag cold">❄️${long ? ' ราคาตก' : ''}</em>` : ''; };
// NPC vendors (พ่อค้าแม่ค้า): buy 85–112% of market, sell 115–140%, and a lot never outlives its 2 h price round (so no free loop between
// vendors); 4 slots per crop per round, each opens at a random minute for 40–120 minutes, all from the clock,
// so every screen sees the same ones; how many were already taken is shared in rooms/_mkt/bt/{id}. Fixed names, never coworkers'.
const NPC = ['ป้าแดง', 'ลุงชม', 'เจ๊หมวย', 'น้าสมศรี', 'พี่ต้อม', 'ยายบุญ'];
function npcSlots(id, P) {
  const out = [], m = mktAt(id, P), big = Math.max(1, Math.round(40 / CROPS[id][3]));     // cheap crops come in bigger lots
  for (let k = 0; k < 4; k++) { const r = i => h01(`npc:${id}:${P}:${k}:${i}`), s = r(0) < .5 ? 's' : 'b', from = P * MKT_PERIOD + Math.floor(r(1) * (MKT_PERIOD - 40 * 60e3));
    out.push({ id: `${P}_${id}_${k}`, npc: 1, s, c: id, q: Math.max(1, Math.round((1 + r(2) * 5) * big)), from, to: Math.min((P + 1) * MKT_PERIOD, from + (40 + Math.floor(r(3) * 80)) * 60e3),
      p: s === 's' ? Math.max(2, Math.ceil(m * (1.15 + r(4) * .25))) : Math.max(1, Math.floor(m * (.85 + r(4) * .27))), n: NPC[Math.floor(r(5) * NPC.length)], t: from }); }
  return out;
}
// vendors open at time t (or any time in [t0, t1]) with what is left after taken counts bt
// time left on an order: "55 น." / "1 ชม. 0 น."
const hm = ms => { const m = Math.max(1, Math.ceil(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} น.` : `${m} น.`; };
const npcOpen = (id, bt, t0, t1 = t0) => { const out = []; for (let P = mktPer(t0) - 1; P <= mktPer(t1); P++) for (const o of npcSlots(id, P)) {
  const l = o.q - ((bt || {})[o.id] | 0); if (l > 0 && o.from <= t1 && o.to > t0) out.push({ ...o, l }); } return out; };

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

// canteen: 3 shared orders at once. Each one, once filled, is replaced by a new order 30 minutes later (rounds r = 0, 1, 2…);
// the crop of round r comes from a hash so everyone sees the same order. Everyone who helped fill one gets CANTEEN_REWARD.
const CANT_SLOTS = [[['bok', 'let', 'car'], 30], [['tom', 'chi'], 12], [['cor', 'pum', 'wat'], 5]];
const canteenQuest = (wk, s, r) => { const [a, n] = CANT_SLOTS[s]; return [a[hashStr(`cant:${wk}:${s}:${r}`) % a.length], n]; };
const cantSlot = (cant, s) => { const q = (cant && cant.q && cant.q[s]) || {}; return { r: q.r || 0, got: q.got || 0, done: q.done || 0, by: q.by || {}, prev: q.prev || null }; };
// what players see now: a filled order whose 30 minutes are up shows as the next one (the DB moves on at the next delivery)
const cantView = (q, now) => q.done && now >= q.done + CANTEEN_CD ? { r: q.r + 1, got: 0, done: 0, by: {}, prev: { r: q.r, by: q.by } } : q;

const Farm = {
  BALCONY_H: 24,
  plotsFor,
  get() { const p = Prog.get(); return p.farm || { plots: [], book: {}, fw: {}, bag: {} }; },
  // village v2.0 step 5: after the move-in party the farm is the house garden (14, then 18/24 plots); same plots array,
  // so crops, timers, friends' water (rooms/_farmw/{me}/{i}), basket, book and sprinkler all carry over as they are
  GARDEN_UP: [[18, 10000, 0], [24, 20000, 40]],                   // [plots, coins, bricks] (GDD §5)
  home(p = Prog.get()) { return p.vil && p.vil.g ? Math.min(24, p.vil.g | 0) : 0; },   // garden size, 0 = still on the rooftop
  // the public copy (rooms/_farm) from outside the farm screen, e.g. right after the farm moves to the village (y = moved)
  pub() { const nm = typeof myName === 'function' ? myName() : '', p = Prog.get(); if (!nm) return;
    loadOnline().then(O => O.saveFarm(nm, { who: p.who, n: Farm.n(), plots: Farm.get().plots, y: Farm.home() ? 1 : 0 })).catch(() => {}); },
  n(f = Farm.get(), p = Prog.get()) { return Farm.home(p) || Math.max(plotsFor(roomW(p.room)), Math.min(10, f.n || 0)); },
  // the sprite for one plot (the village draws real crops in the house gardens)
  plotImg(pl, now = Date.now()) { if (!pl || !CROPS[pl.c]) return null; const g = growMs(pl), e = now - pl.t, st = e >= g ? 3 : e < g * .15 ? 0 : e < g * .5 ? 1 : 2;
    return st === 3 ? cropImg(pl.c, MUT_AT(pl)) : pxa(['crop_seed', 'crop_sprout', 'crop_grow'][st]); },
  // how many of my crops are ripe right now (fw = friends' water counts last seen)
  ready(f = Farm.get(), now = Date.now()) { return f.plots.filter((pl, i) => pl && CROPS[pl.c] && now >= ripeAt(pl, (f.fw || {})[i] || 0)).length; },
  weatherNow: () => wxWindow(Date.now()),
  WEATHER,
  // the strip of pots under an apartment in the office tower (tower.js): railing + one pot per plot, fitted to width w
  drawBalcony(ctx, row, x, y, w, now = Date.now(), t = 0) {
    const n = row ? Math.min(10, row.n || 4) : 4, plots = row ? row.plots || [] : [], H = Farm.BALCONY_H;
    ctx.fillStyle = '#8a93a3'; ctx.fillRect(x, y + H - 6, w, 6); ctx.fillStyle = '#6b7385'; ctx.fillRect(x, y + H - 2, w, 2);
    if (row && (row.y || row.n > 10)) {                          // moved to the village (from จองที่ดิน on): the rooftop farm is closed
      ctx.fillStyle = '#fff8e6'; ctx.strokeStyle = '#6b3e26'; ctx.lineWidth = 1.5; const sw = Math.min(w - 8, 150);
      ctx.fillRect(x + w / 2 - sw / 2, y + H - 22, sw, 15); ctx.strokeRect(x + w / 2 - sw / 2, y + H - 22, sw, 15);
      ctx.fillStyle = '#6b3e26'; ctx.font = '600 10px Kanit, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏡 ย้ายไปบ้านในหมู่บ้านแล้ว', x + w / 2, y + H - 14, sw - 6); return; }
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
  // plots of a friend's garden I can still water (row from listFarms, waters = their rooms/_farmw branch)
  waterable(row, waters, me, now = Date.now()) {
    const out = []; if (!row) return out;
    (row.plots || []).forEach((pl, i) => { if (!pl || !CROPS[pl.c]) return;
      const by = (waters || {})[i] || {}, fw = Object.values(by).filter(v => v && v.s === pl.t).length;
      if (by[me] && by[me].s === pl.t) return;
      if ((pl.w ? 1 : 0) + fw >= WATER_MAX || now >= ripeAt(pl, fw)) return;
      out.push(i); });
    return out;
  },
  // water every plot I still can in one go (the tower's knock card) → { n, coins }; same rules and rewards as in the farm
  waterAll(O, row, waters, nm) {
    const me = keyOf(nm), ids = Farm.waterable(row, waters, me);
    if (!ids.length) return Promise.resolve({ n: 0, coins: 0 });
    return Promise.all(ids.map(i => O.water(row.k, i, nm, row.plots[i].t).then(() => {
      ((waters[i] = waters[i] || {}))[me] = { n: nm, s: row.plots[i].t }; return i; }))).then(done => {
      const d = store.get('farmWD', { d: '', n: 0 }), day = new Date().toDateString(); if (d.d !== day) { d.d = day; d.n = 0; }
      const paid = Math.max(0, Math.min(done.length, FRIEND_WATER_DAY - d.n)); d.n += paid; store.set('farmWD', d);
      Awards.add('help', done.length); if (typeof Stats !== 'undefined') for (const _ of done) Stats.econ('water');
      if (paid) Prog.give(paid * 2, paid, 'help');
      return { n: done.length, coins: paid * 2 };
    });
  },
  // coins still payable for friend water today
  waterCoinsLeft() { const d = store.get('farmWD', { d: '', n: 0 }); return 2 * Math.max(0, FRIEND_WATER_DAY - (d.d === new Date().toDateString() ? d.n : 0)); },
  balconyInfo(row, now = Date.now()) {
    if (!row) return '🌱 ยังไม่ได้ปลูกผัก';
    const pl = (row.plots || []).filter(p => p && CROPS[p.c]), ripe = pl.filter(p => now >= ripeAt(p, 0)).length;
    return `🌱 ${row.nm} · ปลูก ${pl.length}/${row.n || 4}${ripe ? ` · สุก ${ripe}` : ''}${pl.length - ripe ? ` · รดน้ำได้ ${pl.length - ripe}` : ''} · ผลไม้ประจำตัว ${CROPS[sigOf(row.k)][0]}`;
  },
};
// the mutation a crop gets: the weather at the moment it ripens
const MUT_AT = (pl, fw = 0) => WEATHER[weatherAt(ripeAt(pl, fw))][3];

function farmMount(root, api) {
  root.innerHTML = `<div class="hud office-hud farm-hud"><span data-k="title"></span><button class="farm-wx" data-k="wx" type="button"></button><span class="farm-coins" data-k="coinBox">🪙 <b data-k="coins">0</b></span></div>
    <div class="office farm"><div class="office-room"><div class="office-tools" data-k="tools"></div></div>
    <div class="box office-side"><div class="rk-tabs" data-k="tabs"></div><div class="office-list" data-k="list"></div></div></div>`;
  Stats.hit('f');
  const W = 640, H = 360, box = root.querySelector('.office-room'), { cv, ctx, at } = g2canvas(box, W, H);
  box.insertBefore(cv.parentNode, box.firstChild);
  const q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX(), nm = myName(), myKey = keyOf(nm), mySig = sigOf(myKey);
  let p = Prog.get(), f = p.farm || (p.farm = { plots: [], book: {}, fw: {}, bag: {} }), tab = 'seed', seed = store.get('farmSeed', 'bok'), hover = -1, t = 0;
  f.bag = f.bag || {}; f.book = f.book || {}; f.fw = f.fw || {}; f.plots = f.plots || [];
  let visit = null, myWaters = {}, O = null, offW = null, offC = null, friends = null, cant = null, giftTo = store.get('giftTo', '');
  // market: resting orders + NPC vendor taken counts (both live), the stall being looked at and its form
  let mkt = null, bt = {}, offM = null, offN = null, offMC = null, mSel = store.get('mktSel', 'wat'), mSide = 's', mQ = 1, mP = 0, mD = store.get('mktD', 4), mBusy = false, mPer = mktPer();
  if (!CROPS[mSel]) mSel = 'wat';
  const okSeed = id => CROPS[id] && (SIG.includes(id) ? id === mySig : p.lv >= CROPS[id][4]);
  if (!okSeed(seed)) seed = 'bok';
  const me = { x: 320, tx: 320, dir: 'down', who: p.who || 'adam', act: 0 };
  const wk = () => { const d = new Date(Date.now() + 7 * 3600e3), mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5); return `${mon.getUTCFullYear()}${String(mon.getUTCMonth() + 1).padStart(2, '0')}${String(mon.getUTCDate()).padStart(2, '0')}`; };

  /* ---------- layout: rooftop = 2 beds of up to 5 plots; house garden = rows of 8 (2 rows up to 16, 3 rows up to 24) ---------- */
  const plots = () => visit ? visit.plots : f.plots;
  const nMine = () => Farm.n(f, Prog.get());
  const nPlots = () => visit ? Math.min(24, visit.n || 4) : nMine();
  function layout() {
    const n = nPlots() + (!visit && nextUp() ? 1 : 0);
    if (n <= 10) return { cols: 5, PW: 104, PH: 64, G: 8, X0: (W - (104 * 5 + 8 * 4)) / 2, ROWY: [196, 306], AISLE: 228 };
    const b = { cols: 8, PW: 64, G: 6, X0: (W - 40 - (64 * 8 + 6 * 7)) / 2 };
    return n <= 16 ? { ...b, PH: 60, ROWY: [196, 306], AISLE: 228 } : { ...b, PH: 46, ROWY: [196, 270, 344], AISLE: 204 };
  }
  let LY = null;                                  // set every frame (layout() needs nextUp, defined below)
  const plotRect = i => (LY = LY || layout(), { x: LY.X0 + (i % LY.cols) * (LY.PW + LY.G), y: LY.ROWY[Math.floor(i / LY.cols)] - LY.PH, w: LY.PW, h: LY.PH });
  const fwOf = i => visit ? Object.keys((visit.w || {})[i] || {}).filter(k => visit.w[i][k].s === (visit.plots[i] || {}).t).length : fwMine(i);
  const fwMine = i => { const pl = f.plots[i]; if (!pl) return 0; return Object.values(myWaters[i] || {}).filter(v => v.s === pl.t).length; };
  const stage = (pl, fw, now) => { const g = growMs(pl, fw), e = now - pl.t; return e >= g ? 3 : e < g * .15 ? 0 : e < g * .5 ? 1 : 2; };
  const bagN = () => Object.values(f.bag).reduce((a, n) => a + n, 0);
  const bagValue = () => Object.entries(f.bag).reduce((a, [k, n]) => a + mktPrice(k) * n, 0);
  // the next room size up and how many plots it brings
  const nextRoom = () => ROOM_SIZES.find(z => z[0] > roomW(Prog.get().room));
  // the next way to get more plots: a bigger room (rooftop) or a bigger house garden (after move-in)
  // in the village the garden reaches 14 through the house's garden stage; 18 / 24 are bought here after that
  const nextGarden = () => Farm.home() >= 14 ? Farm.GARDEN_UP.find(u => u[0] > Farm.home()) : null;
  const nextUp = () => Farm.home() ? nextGarden() : nextRoom();

  /* ---------- saving: local progress + the public copy friends read ---------- */
  function save() { const pp = Prog.get(); pp.farm = f; Prog.put(pp); p = pp; publish(); }
  let pubT = 0;
  function publish() {
    clearTimeout(pubT); if (!nm) return;
    pubT = setTimeout(() => loadOnline().then(O => O.saveFarm(nm, { who: p.who, n: nMine(), plots: f.plots, y: Farm.home() ? 1 : 0 })).catch(() => {}), 800);
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
    offM = O.watchMkt(v => { if (dead) return; mkt = v || {}; mktHouse(); if (tab === 'mkt' || tab === 'stall') list(); });
    offN = O.watchNpc(v => { if (dead) return; bt = v || {}; mktHouse(); if (tab === 'mkt' || tab === 'stall') list(); });
    if (nm) offMC = O.watchMktClaims(myKey, ids => { if (!dead) ids.forEach(takeClaim); });
    if (Math.random() < .1) O.pruneNpc(mktPer() - 14).catch(() => {});
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
    p.coins -= c[2]; store.set('prog', p); typeof Stats !== 'undefined' && Stats.econ('out_seed', c[2]); typeof Stats !== 'undefined' && Stats.econ('plant');
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
    const pl = f.plots[i], c = CROPS[pl.c], m = MUT_AT(pl, fwMine(i)), key = pl.c + (m ? '.' + m : ''), xp = CROP_XP[pl.c] || Math.round((c[3] - c[2]) / 3) + 1;
    const b = f.book[pl.c] || (f.book[pl.c] = [0, 0]); b[0]++; if (m) { b[1] = (b[1] || 0) + 1; (b[3] = b[3] || {})[m] = 1; }
    f.bag[key] = (f.bag[key] || 0) + 1; Awards.add('farm', 1);
    if (typeof Stats !== 'undefined') { Stats.econ('harvest'); Stats.econ('h_' + pl.c); if (m) Stats.econ('mutant'); }
    f.plots[i] = null; delete f.fw[i];
    clearW(i);
    const pp = Prog.get(); pp.farm = f; store.set('prog', pp);
    Prog.give(0, xp); p = Prog.get();
    if (!quiet) { walkTo(i); api.sfx(m ? 'level' : 'good'); }
    pop(i, m ? `${WEATHER[weatherAt(ripeAt(pl, fwMine(i)))][1]} ${bagName(key)}!` : `+1 ${c[0]}`, m ? PAL.orange : PAL.ink);
    const r = plotRect(i); fx.burst(r.x + r.w / 2, r.y + 24, { n: m ? 30 : 12, colors: m ? CONFETTI : ['#21c07a', '#ffd23f', '#fff'] });
    if (m && m !== 'w' && nm) loadOnline().then(O => O.pushFeed(`${m === 'r' ? '🌈' : '✨'} ${nm} ได้${bagName(key)}จาก${Farm.home() ? 'สวนข้างบ้าน' : 'ฟาร์มดาดฟ้า'}!`, nm, myAva())).catch(() => {});
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
  // sell exactly what was picked: { key: qty } (the basket never sells by itself any more)
  function sell(picks) { fresh(); let c = 0, n = 0;
    for (const [k, q] of Object.entries(picks || {})) { const cnt = Math.min(q | 0, f.bag[k] || 0); if (cnt <= 0) continue; c += mktPrice(k) * cnt; n += cnt; f.bag[k] -= cnt; if (!f.bag[k]) delete f.bag[k]; }
    if (!n) return 0; save(); typeof Stats !== 'undefined' && Stats.econ('sold', n); Prog.give(c, 0, 'sell'); api.sfx('good'); fly(c); toast(`💰 ขาย ${n} ชิ้น +${fmt(c)} 🪙`); render(); return c; }
  /* ---------- market: orders hold what they offer (crops for a sell, coins for a buy) until filled or cancelled ---------- */
  const isMine = o => o.k === myKey && !o.npc;
  const live = (o, now = Date.now()) => o.l > 0 && now < mktEnd(o);
  const allOrders = () => Object.entries(mkt || {}).map(([id, o]) => ({ ...o, id })).filter(o => o && CROPS[o.c] && o.l > 0);
  const mineOpen = () => allOrders().filter(isMine);
  const ordersOf = id => { const now = Date.now(); return [...allOrders().filter(o => o.c === id && live(o, now)), ...npcOpen(id, bt, now)]; };
  const whoOf = o => o.npc ? `🧺 ${o.n}` : isMine(o) ? 'คุณ' : esc(o.n || '?');
  function addCoins(n) { fresh(); const pp = Prog.get(); pp.coins += n; pp.farm = f; Prog.put(pp); p = pp; }
  function addCrop(id, n) { fresh(); f.bag[id] = (f.bag[id] || 0) + n; save(); }
  const stat = (k, n) => { if (n > 0 && typeof Stats !== 'undefined') Stats.econ(k, n); };
  // a sell order fills against the best buy orders at or above its price (a buy, the cheapest sells at or below), oldest first,
  // always at the resting order's price; a buyer who offered more gets the difference back; whatever is left rests at the stall
  async function mktPlace(side, id, qn, pr) {
    if (mBusy) return 0; qn |= 0; const [lo, hi] = mktBand(id); pr = Math.max(lo, Math.min(hi, pr | 0));
    if (!O || !nm) { toast('ตลาดต้องต่อเน็ตและตั้งชื่อก่อน'); return 0; }
    if (qn < 1) return 0;
    if (mineOpen().length >= MKT_MAX) { toast(`ตั้งได้ครั้งละ ${MKT_MAX} คำสั่ง ยกเลิกหรือรอให้มีคนจับคู่ก่อน`); return 0; }
    fresh(); p = Prog.get();
    if (side === 's' ? (f.bag[id] | 0) < qn : p.coins < qn * pr) { toast(side === 's' ? `${CROPS[id][0]}ในตะกร้าไม่พอ` : 'เหรียญไม่พอ'); return 0; }
    mBusy = true;
    if (side === 's') { f.bag[id] -= qn; if (!f.bag[id]) delete f.bag[id]; save(); } else addCoins(-qn * pr);
    const opp = ordersOf(id).filter(o => o.s !== side && !isMine(o) && (side === 's' ? o.p >= pr : o.p <= pr))
      .sort((a, b) => (side === 's' ? b.p - a.p : a.p - b.p) || (a.t || 0) - (b.t || 0));
    let left = qn, got = 0, cP = 0, cN = 0; const who = [];
    for (const o of opp) { if (!left) break;
      let u = 0; try { u = o.npc ? await O.npcTake(o.id, left, o.q) : await O.mktTake(o.id, left, myKey, false); } catch (e) { u = 0; }
      if (!u) continue; left -= u; got += u; who.push(o.npc ? o.n : o.n || '?');
      if (o.npc) cN += u * o.p; else { cP += u * o.p; O.mktClaim(o.k, { s: o.s, c: id, u, p: o.p, n: nm }).catch(() => {}); } }
    let rest = 0;
    if (left) { try { await O.mktPut({ s: side, c: id, q: left, p: pr, k: myKey, n: nm, d: mD }); rest = left; } catch (e) { rest = 0; } }
    const back = left - rest;                                       // could not be put up: give it back
    if (side === 's') { if (back) addCrop(id, back); if (cP) Prog.give(cP, 0, 'mkt'); if (cN) Prog.give(cN, 0, 'npc'); }
    else { if (got) addCrop(id, got); const refund = got * pr - cP - cN + back * pr; if (refund) addCoins(refund); stat('out_mkt', cP); stat('out_npc', cN); }
    mBusy = false;
    if (got) { api.sfx('good'); if (side === 's') fly(cP + cN);
      toast(`✅ ${side === 's' ? `ขาย${CROPS[id][0]} ${got} ชิ้น +${fmt(cP + cN)} 🪙` : `ซื้อ${CROPS[id][0]} ${got} ชิ้น −${fmt(cP + cN)} 🪙`} · กับ ${[...new Set(who)].join(', ')}${rest ? ` · อีก ${rest} ชิ้นวางที่แผง` : ''}`); }
    else if (rest) { api.sfx('tick'); toast(`🏪 วางที่แผงแล้ว ${rest} ชิ้น @${pr} 🪙 · มีคนจับคู่เมื่อไหร่ได้ทันที`); }
    render(); return got;
  }
  async function mktCancel(oid, why) {
    const o = (mkt || {})[oid]; if (!o || !O || mBusy || o.k !== myKey) return; mBusy = true;
    let u = 0; try { u = await O.mktTake(oid, o.l, myKey, true); } catch (e) { u = 0; }
    if (u) { if (o.s === 's') addCrop(o.c, u); else addCoins(u * o.p);
      toast(`${why ? '⌛ หมดเวลาแล้ว ' : '↩️ ยกเลิกแล้ว '}ได้${o.s === 's' ? `${CROPS[o.c][0]} ${u} ชิ้น` : `เหรียญ ${fmt(u * o.p)} 🪙`}คืน`); }
    mBusy = false; render();
  }
  // a fill owed to me from someone who took my resting order
  const claiming = new Set();
  async function takeClaim(cid) {
    if (claiming.has(cid)) return; claiming.add(cid);
    let v = null; try { v = await O.takeMktClaim(myKey, cid); } catch (e) { v = null; }
    if (dead || !v || !CROPS[v.c]) return;
    if (v.s === 's') { Prog.give(v.u * v.p, 0, 'mkt'); fly(v.u * v.p); toast(`✅ ${v.n} ซื้อ${CROPS[v.c][0]}ของคุณ ${v.u} ชิ้น +${fmt(v.u * v.p)} 🪙`); }
    else { addCrop(v.c, v.u); stat('out_mkt', v.u * v.p); toast(`✅ ได้${CROPS[v.c][0]} ${v.u} ชิ้นจาก ${v.n}`); }
    api.sfx('good'); render();
  }
  // housekeeping for my orders: 24 h old → back to me; NPC vendors that crossed my price while it rested (even while I was away) fill it
  let mhT = 0, mhRun = false;
  async function mktHouse() {
    mhT = Date.now(); if (!mkt || !O || !nm || mBusy || mhRun || dead) return; const now = mhT; mhRun = true;
    try {
    for (const o of mineOpen()) {
      if (now >= mktEnd(o)) { await mktCancel(o.id, 1); continue; }
      const vs = npcOpen(o.c, bt, o.t || now, Math.min(now, mktEnd(o))).filter(v => v.s !== o.s && (o.s === 's' ? v.p >= o.p : v.p <= o.p) && v.to > (o.t || now)).sort((a, b) => a.from - b.from);
      let l = o.l;
      for (const v of vs) { if (!l || mBusy) break; mBusy = true;
        let u = 0; try { u = await O.npcTake(v.id, Math.min(l, v.l), v.q); if (u) u = await O.mktTake(o.id, u, myKey, true); } catch (e) { u = 0; }
        mBusy = false; if (!u) continue; l -= u;
        if (o.s === 's') { Prog.give(u * o.p, 0, 'npc'); toast(`✅ 🧺 ${v.n} ซื้อ${CROPS[o.c][0]}ของคุณ ${u} ชิ้น +${fmt(u * o.p)} 🪙`); }
        else { addCrop(o.c, u); stat('out_npc', u * o.p); toast(`✅ ได้${CROPS[o.c][0]} ${u} ชิ้นจาก 🧺 ${v.n}`); }
        api.sfx('good'); render(); }
    }
    } finally { mhRun = false; }
  }
  // sell a plain crop straight to the market at today's price (same as the basket)
  function sellNow(id, n) { return sell({ [id]: n }); }
  const spark = (id, w, h, n = 12) => { const P = mktPer(), pts = []; for (let i = n; i >= 0; i--) pts.push(mktAt(id, P - i));
    const lo = Math.min(...pts), hi = Math.max(...pts), y = v => hi === lo ? h / 2 : h - 4 - (v - lo) / (hi - lo) * (h - 8), x = i => 3 + i / n * (w - 6);
    return { pts, lo, hi, x, y, d: pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') }; };
  const chg = id => { const a = mktAt(id), b = mktAt(id, mktPer() - 1); return Math.round((a - b) / b * 100); };
  const leftOf = o => hm(mktEnd(o) - Date.now());
  function buySprinkler() { fresh(); p = Prog.get(); const [price, lv] = SPRINKLER;
    if (p.lv < lv) { toast(`ปลดล็อกสปริงเกอร์ที่ Lv ${lv}`); return; }
    if (p.coins < price) { toast(`เหรียญไม่พอ ขาดอีก 🪙 ${fmt(price - p.coins)}`); return; }
    p.coins -= price; store.set('prog', p); typeof Stats !== 'undefined' && Stats.econ('out_sprinkler', price); f.spr = 1; api.sfx('level'); toast('💧 ติดสปริงเกอร์แล้ว ผักที่ปลูกใหม่ได้น้ำเองทุกต้น'); save(); render(); }
  function growRoom() { if (Farm.home()) { tab = 'seed'; list(); return; } window.officeTab = 'style'; startGame('office'); window.officeTab = null; }
  function growGarden() {
    const up = nextGarden(); if (!up) return; const pp = Prog.get(), v = pp.vil || {};
    if (pp.coins < up[1] || (v.bricks | 0) < up[2]) { toast(`ขยายสวนเป็น ${up[0]} แปลง ใช้ 🪙 ${fmt(up[1])}${up[2] ? ` + 🧱 ${up[2]}` : ''} · ยังไม่พอ`); return; }
    pp.coins -= up[1]; v.bricks = (v.bricks | 0) - up[2]; v.g = up[0]; pp.vil = v; pp.farm = f; Prog.put(pp); p = pp;
    if (typeof Stats !== 'undefined') { Stats.econ('out_garden', up[1]); if (up[2]) Stats.econ('brick_use', up[2]); }
    if (typeof Village !== 'undefined' && Village.setGarden) Village.setGarden(up[0]);
    api.sfx('good'); toast(`🌱 สวนข้างบ้าน ${up[0]} แปลงแล้ว!`); publish(); render();
  }

  // canteen: deliver basket items toward this week's shared order (pays a bit more than selling)
  // rounds of each order I helped fill and have not been paid for yet → [[slot, round]]
  function cantClaims(now = Date.now()) {
    const out = [];
    for (let s = 0; s < CANT_SLOTS.length; s++) { const q = cantView(cantSlot(cant, s), now);
      for (const x of [q.done ? q : null, q.prev]) if (x && x.by && x.by[myKey] && !store.get(`cantq_${wk()}_${s}_${x.r}`, false)) out.push([s, x.r]); }
    return out;
  }
  function deliver(s) {
    if (!O) return; if (!nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อน'); return; }
    fresh(); const q = cantView(cantSlot(cant, s), Date.now()); if (q.done) return;
    const [id, goal] = canteenQuest(wk(), s, q.r);
    const keys = Object.keys(f.bag).filter(k => k.split('.')[0] === id).sort((a, b) => bagPrice(a) - bagPrice(b));   // plain ones first
    const have = keys.reduce((a, k) => a + f.bag[k], 0); if (!have) return;
    O.deliverQ(wk(), s, q.r, have, goal, nm, Date.now(), CANTEEN_CD).then(took => {
      if (!took) { toast('ออเดอร์นี้ครบแล้ว หรือเปลี่ยนเป็นออเดอร์ใหม่แล้ว 🍱'); return; }
      fresh(); let left = took, c = 0;
      for (const k of keys) { const u = Math.min(left, f.bag[k] || 0); f.bag[k] -= u; if (!f.bag[k]) delete f.bag[k]; c += Math.round(bagPrice(k) * CANTEEN_BONUS) * u; left -= u; if (!left) break; }
      save(); typeof Stats !== 'undefined' && Stats.econ('canteen_n', took); Prog.give(c, 0, 'canteen'); api.sfx('good'); fly(c); toast(`🍱 ส่ง${CROPS[id][0]} ${took} ชิ้น +${fmt(c)} 🪙`); render();
    }).catch(() => toast('ส่งไม่สำเร็จ (เน็ตหลุด?)'));
  }
  function claimCanteen(s, r) {
    const k = `cantq_${wk()}_${s}_${r}`; if (store.get(k, false)) return; store.set(k, true);
    Prog.give(CANTEEN_REWARD, 7, 'canteen'); api.sfx('level'); fly(CANTEEN_REWARD); toast(`🎉 ออเดอร์ครบ! รางวัลคนช่วยส่ง +${CANTEEN_REWARD} 🪙`); list(); hud();
  }
  // basket picks (what will be sold, per key) and what the village still needs (kept back by "เลือกทั้งหมด")
  let pick = {}, pickAll = false, warned = false;
  function keepFor() {
    const nd = typeof Village !== 'undefined' && Village.needs ? Village.needs() : null, job = {}, house = {};
    if (!nd) return { job, house, nd }; const left = { ...f.bag }, cheap = ks => ks.sort((a, b) => bagPrice(a) - bagPrice(b));
    // same order the village takes them: a delivery uses the cheapest of that crop, a house stage the cheapest vegetables overall
    for (const [c, q0] of Object.entries(nd.job)) { let q = q0;
      for (const k of cheap(Object.keys(left).filter(k => k.split('.')[0] === c))) { const u = Math.min(q, left[k]); if (!u) continue; job[k] = (job[k] || 0) + u; left[k] -= u; q -= u; if (!q) break; } }
    let v = nd.house ? nd.house.veg : 0;
    for (const k of cheap(Object.keys(left).filter(k => CROPS[k.split('.')[0]]))) { if (!v) break; const u = Math.min(v, left[k]); if (!u) continue; house[k] = (house[k] || 0) + u; left[k] -= u; v -= u; }
    return { job, house, nd };
  }
  // gifts: one item to a friend, claimed when they next open the farm
  function gift(key) {
    if (!O || !nm) { toast('ตั้งชื่อเล่นที่หน้าแรกก่อน'); return; }
    const to = (friends || []).find(r => r.k === giftTo); if (!to) { toast('เลือกเพื่อนที่จะส่งให้ก่อน'); return; }
    const d = store.get('giftD', { d: '', n: 0 }), day = new Date().toDateString(); if (d.d !== day) { d.d = day; d.n = 0; }
    if (d.n >= GIFT_DAY) { toast(`วันนี้ส่งครบ ${GIFT_DAY} ชิ้นแล้ว พรุ่งนี้ส่งใหม่ได้`); return; }
    fresh(); if (!f.bag[key]) return;
    f.bag[key]--; if (!f.bag[key]) delete f.bag[key]; save();
    O.sendGift(to.k, nm, key).then(() => { d.n++; typeof Stats !== 'undefined' && Stats.econ('gift'); Awards.add('help', 1); store.set('giftD', d); api.sfx('good'); toast(`🎁 ส่ง${bagName(key)}ให้ ${to.nm} แล้ว`); render(); })
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
      Awards.add('help', 1); typeof Stats !== 'undefined' && Stats.econ('water');
      if (d.n < FRIEND_WATER_DAY) { d.n++; store.set('farmWD', d); Prog.give(2, 1, 'help'); pop(i, '💧 +2 🪙', PAL.blue); } else pop(i, '💧 ขอบคุณ!', PAL.blue);
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
    q('title').innerHTML = visit ? `สวนของ <b>${esc(visit.nm)}</b>` : Farm.home() ? `<b>🏡 สวนข้างบ้าน</b>` : `<b>🌱 ฟาร์มดาดฟ้า</b>`;
    q('coins').textContent = fmt(p.coins);
  }
  function wxHud(now) {
    const w = wxWindow(now), W0 = WEATHER[w.id], nx = nextSpecial(now);
    const s = w.id !== 'clear' ? `${W0[1]} <b>${W0[0]}</b> ${Math.ceil((w.to - now) / 60e3)} น.` : `${W0[1]} ${nx ? `ถัดไป ${WEATHER[nx.id][1]} ${hhmm(nx.from)}` : W0[0]}`;
    const el = q('wx'); if (el.innerHTML !== s) { el.innerHTML = s; el.classList.toggle('on', w.id !== 'clear');
      el.title = w.id !== 'clear' ? `${W0[0]}ถึง ${hhmm(w.to)} · ผักที่สุกช่วงนี้กลายเป็น${MUT[W0[3]][0]} ขายได้ ×${W0[4]}`
        : `ตอนนี้${W0[0]}${nx ? ` · ${WEATHER[nx.id][0]} ${hhmm(nx.from)}–${hhmm(nx.to)} ผักที่สุกช่วงนั้นขายได้ ×${WEATHER[nx.id][4]}` : ''}`; }
  }
  function tools() {
    const el = q('tools');
    if (visit) { el.innerHTML = `<span class="muted">แตะต้นที่ยังไม่สุกเพื่อรดน้ำ ช่วยเพื่อนให้โตเร็วขึ้น 15%</span><button class="btn" data-a="back">← กลับสวนฉัน</button>`;
      el.querySelector('[data-a=back]').onclick = back; return; }
    const s = smart(Date.now()); toolSig = s.html;
    el.innerHTML = s.fn ? `<button class="btn primary farm-cta" data-a="go">${s.html}</button>` : `<span class="farm-idle">${s.html}</span>`;
    if (s.fn) el.querySelector('[data-a=go]').onclick = s.fn;
  }
  // the one thing worth doing next (harvest, replant, sell, water) — or a quiet countdown when there is nothing to do
  let toolSig = '';
  function smart(now) {
    const ripe = Farm.ready(f, now), empty = Array.from({ length: nMine() }, (_, i) => !f.plots[i]).filter(Boolean).length, bn = bagN(),
      dry = f.plots.filter((pl, i) => pl && !pl.w && fwMine(i) < WATER_MAX && now < ripeAt(pl, fwMine(i))).length;
    if (ripe) return { html: `🧺 เก็บทั้งหมด ${ripe}`, fn: harvestAll };
    if (empty && Prog.get().coins >= CROPS[seed][2]) return { html: `${pxImg('crop_' + seed, 20)} ปลูก${CROPS[seed][0]} ${empty} แปลง`, fn: plantAll };
    if (dry && !f.spr) return { html: `💧 รดน้ำ ${dry} ต้น`, fn: waterAll };
    const next = f.plots.map((pl, i) => pl ? ripeAt(pl, fwMine(i)) : Infinity).reduce((a, b) => Math.min(a, b), Infinity);
    return { html: next < Infinity ? `ผักต้นถัดไปสุกใน ${mmss(next - now)} · ไปเล่นเกมก่อนก็ได้` : 'เลือกเมล็ดทางขวา แล้วแตะแปลงเพื่อปลูก' };
  }
  const IDS_HOT = () => Object.keys(CROPS).some(id => mktMood(id) === 'hot' && (f.bag[id] | 0) > 0);
  function list() {
    const T = q('tabs'), L = q('list'), bn = bagN();
    const top = { cant: 'bag', book: 'seed', stall: 'mkt' }[tab] || tab, backTo = to => `<button class="linkbtn farm-back" data-t="${to}">← กลับ</button>`;
    T.innerHTML = [['seed', 'ปลูก'], ['bag', `ตะกร้า${bn ? ` <i class="tab-n">${bn}</i>` : ''}`], ['mkt', `ตลาด${IDS_HOT() ? ' 🔥' : ''}`], ['friends', 'เพื่อน']]
      .map(([k, n]) => `<button class="btn${top === k ? ' on' : ''}" data-t="${k}">${n}</button>`).join('');
    T.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; list(); });
    L.onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; api.sfx('tick'); list(); } };
    if (tab === 'seed') {
      const nr = nextRoom(), seedBtn = id => { const c = CROPS[id], lock = !okSeed(id);
        return `<button class="shop-it${seed === id ? ' on' : ''}${lock ? ' lock' : ''}" data-seed="${id}" ${lock ? 'disabled' : ''} title="${c[0]}">${pxImg('crop_' + id, 30)}<b>${c[0]}</b>
          <small>${lock ? `🔒 Lv ${c[4]}` : cropTime(id)}</small><small>${lock ? '' : `${c[2]} → ${c[3]} 🪙`}</small></button>`; };
      L.innerHTML = `<div class="shop-grid">${VEG.map(seedBtn).join('')}</div>
        <h4 class="sz-h">⭐ ผลไม้ประจำตัวคุณ <small class="muted">ปลูกได้คนเดียวในออฟฟิศ เพื่อนอยากได้ต้องขอคุณ</small></h4>
        <div class="shop-grid">${seedBtn(mySig)}</div>
        <h4 class="sz-h">อุปกรณ์</h4>
        <div class="farm-gear">
          ${Farm.home() ? (ng => `<div><b>🏡 สวนข้างบ้าน ${nMine()} แปลง</b><small class="muted">${ng ? `ขยายเป็น ${ng[0]} แปลง` : Farm.home() < 14 ? 'ได้ 14 แปลงเมื่อบ้านถึงขั้นขยายสวน (ในหมู่บ้าน)' : 'สวนใหญ่สุดแล้ว ครบ 24 แปลง'}</small></div>
          ${ng ? `<button class="btn sm" data-a="garden">🪙 ${fmt(ng[1])}${ng[2] ? ` + 🧱 ${ng[2]}` : ''}</button>` : ''}`)(nextGarden())
          : `<div><b>🌱 แปลงผัก ${nMine()} แปลง</b><small class="muted">${nr ? `ขยายห้องเป็น ${nr[0]} ช่อง ได้ ${plotsFor(nr[0])} แปลง` : 'ห้องใหญ่สุดแล้ว ได้ครบ 10 แปลง'}</small></div>
          ${nr ? '<button class="btn sm" data-a="room">📐 ขยายห้อง</button>' : ''}`}
          <div><b>💧 สปริงเกอร์</b><small class="muted">${f.spr ? 'ติดแล้ว ผักที่ปลูกใหม่ได้น้ำเอง' : 'รดน้ำให้ทุกต้นที่ปลูกใหม่ ไม่ต้องกดเอง'}</small></div>
          ${f.spr ? '<span class="muted">✓</span>' : `<button class="btn sm" data-a="spr" ${p.lv < SPRINKLER[1] ? 'disabled' : ''}>${p.lv < SPRINKLER[1] ? `🔒 Lv ${SPRINKLER[1]}` : `🪙 ${SPRINKLER[0]}`}</button>`}
        </div>
        <button class="farm-card" data-t="book"><span>📖 <b>สมุดผัก</b> <small class="muted">${Object.keys(f.book).filter(id => CROPS[id]).length}/${Object.keys(CROPS).length} อย่าง</small></span><i>›</i></button>`;
      L.querySelectorAll('[data-seed]').forEach(b => b.onclick = () => { seed = b.dataset.seed; store.set('farmSeed', seed); api.sfx('tick'); tools(); list(); });
      const rb = L.querySelector('[data-a=room]'); if (rb) rb.onclick = growRoom;
      const gb = L.querySelector('[data-a=garden]'); if (gb) gb.onclick = growGarden;
      const sb = L.querySelector('[data-a=spr]'); if (sb) sb.onclick = buySprinkler;
    } else if (tab === 'bag') {
      const keys = Object.keys(f.bag).filter(k => CROPS[k.split('.')[0]]).sort((a, b) => bagPrice(b) - bagPrice(a));
      const now = Date.now(), qs = CANT_SLOTS.map((_, s) => cantView(cantSlot(cant, s), now)), open = qs.filter(q => !q.done).length, cl = cantClaims(now).length;
      const cg = qs.reduce((a, q, s) => a + (q.done ? 0 : q.got), 0), ct = qs.reduce((a, q, s) => a + (q.done ? 0 : canteenQuest(wk(), s, q.r)[1]), 0) || 1;
      const card = `<button class="farm-card" data-t="cant"><span>🍱 <b>ออเดอร์โรงอาหาร</b> <small class="muted">${cl ? `🎁 มีรางวัลรอรับ ${cl}` : open ? `รอส่ง ${open} ออเดอร์` : 'ครบหมดแล้ว รอออเดอร์ใหม่'}</small><span class="xpbar"><i style="width:${cg / ct * 100}%"></i></span></span><i>›</i></button>`;
      if (!keys.length) { L.innerHTML = card + '<p class="muted farm-empty">ตะกร้าว่าง · ผักที่เก็บจะมาอยู่ที่นี่</p>'; return; }
      for (const k of Object.keys(pick)) { pick[k] = Math.max(0, Math.min(pick[k] | 0, f.bag[k] | 0)); if (!pick[k]) delete pick[k]; }
      const K = keepFor(), keepN = k => (K.job[k] | 0) + (K.house[k] | 0), nd = K.nd, jobs = nd ? Object.entries(nd.job) : [];
      const tot = keys.reduce((a, k) => a + (pick[k] | 0), 0), val = keys.reduce((a, k) => a + (pick[k] | 0) * mktPrice(k), 0);
      const over = keys.filter(k => (pick[k] | 0) > f.bag[k] - keepN(k)), warn = warned && over.length;
      const need = jobs.length || (nd && nd.house) ? `<p class="bag-need">ยังต้องใช้ในหมู่บ้าน: ${[...jobs.map(([c, q]) => `📦 ${CROPS[c][0]} ${q}`),
        nd.house ? `🏠 ${nd.house.stage} ใช้ผัก ${nd.house.veg} ชิ้น` : ''].filter(Boolean).join(' · ')}</p>` : '';
      L.innerHTML = card + `<div class="gift-to">🎁 ส่งให้ <select data-k="giftTo"><option value="">เลือกเพื่อน…</option></select></div>${need}
        <ul class="farm-ls farm-bag">${keys.map(k => { const n = f.bag[k], pk = pick[k] | 0;
          return `<li class="${pk ? 'pick' : ''}">${cropURL(k, 26)}<span class="bag-n"><b>${bagName(k)} <i>×${n}</i></b><small>ชิ้นละ ${mktPrice(k)} 🪙${moodTag(k.split('.')[0])}${K.job[k] ? ` <em class="bag-tag">📦 ส่งของใช้ ${K.job[k]}</em>` : ''}${K.house[k] ? ` <em class="bag-tag h">🏠 สร้างบ้าน ${K.house[k]}</em>` : ''}</small></span>
          <span class="bag-q"><button class="btn sm" data-qm="${k}" ${pk ? '' : 'disabled'} aria-label="ลด${bagName(k)}">−</button><b>${pk}</b><button class="btn sm" data-qp="${k}" ${pk < n ? '' : 'disabled'} aria-label="เพิ่ม${bagName(k)}">+</button><button class="btn sm bag-all" data-qa="${k}">${pk === n ? 'ล้าง' : 'ทั้งหมด'}</button></span>
          <button class="btn sm" data-gift="${k}" title="ส่งให้เพื่อน 1 ชิ้น">🎁</button></li>`; }).join('')}</ul>
        <div class="bag-bar"><button class="btn sm" data-qb="all">${pickAll ? 'เลือกหมดจริง ๆ' : 'เลือกทั้งหมด'}</button><button class="btn sm" data-qb="clear" ${tot ? '' : 'disabled'}>ล้าง</button>
          <button class="btn bag-sell${warn ? ' warn' : ''}" data-qb="sell" ${tot ? '' : 'disabled'}>${warn ? '⚠️ ขายอยู่ดี' : '💰 ขาย'} ${tot} ชิ้น +${fmt(val)}</button>
          ${warn ? `<p class="bag-warn">${over.map(bagName).join(', ')} ยังต้องใช้ส่งของ/สร้างบ้าน · ขายไปก็ได้ แต่ต้องปลูกใหม่นะ</p>` : ''}</div>`;
      L.querySelectorAll('[data-qp],[data-qm],[data-qa],[data-qb]').forEach(b => b.onclick = () => { const d = b.dataset; api.sfx('tick');
        if (d.qp) pick[d.qp] = Math.min(f.bag[d.qp] | 0, (pick[d.qp] | 0) + 1);
        else if (d.qm) pick[d.qm] = Math.max(0, (pick[d.qm] | 0) - 1);
        else if (d.qa) pick[d.qa] = (pick[d.qa] | 0) === (f.bag[d.qa] | 0) ? 0 : f.bag[d.qa] | 0;
        else if (d.qb === 'all') { for (const k of keys) pick[k] = pickAll ? f.bag[k] : Math.max(0, f.bag[k] - keepN(k)); pickAll = !pickAll; if (pickAll) toast('เลือกทั้งหมด เว้นของที่ยังต้องใช้ในหมู่บ้านไว้'); }
        else if (d.qb === 'clear') { pick = {}; pickAll = false; }
        else if (d.qb === 'sell') { if (over.length && !warned) { warned = true; list(); return; } const pk = pick; pick = {}; pickAll = false; warned = false; sell(pk); return; }
        if (d.qb !== 'all') pickAll = false; warned = false; list(); });
      L.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => gift(b.dataset.gift));
      const sel = L.querySelector('[data-k=giftTo]'); sel.onchange = () => { giftTo = sel.value; store.set('giftTo', giftTo); };
      (friends ? Promise.resolve(friends) : loadFriends()).then(fr => { if (!sel.isConnected) return;
        sel.innerHTML = '<option value="">เลือกเพื่อน…</option>' + fr.map(r => `<option value="${esc(r.k)}"${r.k === giftTo ? ' selected' : ''}>${esc(r.nm)} (ผลไม้ประจำตัว: ${CROPS[sigOf(r.k)][0]})</option>`).join(''); }).catch(() => {});
    } else if (tab === 'mkt') {
      const now = Date.now(), nx = (mktPer() + 1) * MKT_PERIOD - now, mine = mineOpen().sort((a, b) => (a.t || 0) - (b.t || 0));
      const ids = Object.keys(CROPS).filter(id => !SIG.includes(id) || id === mySig || (f.bag[id] | 0) || ordersOf(id).some(o => !o.npc));
      L.innerHTML = `<p class="muted farm-tip">ราคาตลาดเปลี่ยนทุก 2 ชม. (รอบหน้าอีก ${Math.floor(nx / 3600e3)} ชม. ${Math.ceil(nx % 3600e3 / 60e3)} น.) · ขายในตะกร้าได้ราคาตลาดตอนนี้ · แตะผักเพื่อตั้งขาย/รับซื้อกับเพื่อนและ 🧺 แม่ค้า</p>
        ${mkt === null && !O ? '<p class="muted">กำลังต่อตลาด…</p>' : ''}
        ${mine.length ? `<h4 class="sz-h">คำสั่งของฉัน <small class="muted">${mine.length}/${MKT_MAX}</small></h4><ul class="farm-ls mk-mine">${mine.map(o => `<li>${cropURL(o.c, 22)}<span class="bag-n"><b>${o.s === 's' ? '🔴 ขาย' : '🟢 รับซื้อ'}${CROPS[o.c][0]} ${o.l}/${o.q}</b><small>@${o.p} 🪙 · ⏳ หมดเวลาใน <b data-mend="${mktEnd(o)}">${leftOf(o)}</b></small></span><button class="btn sm" data-mx="${o.id}">ยกเลิก</button></li>`).join('')}</ul>` : ''}
        <ul class="farm-ls mk-board">${ids.map(id => { const pr = mktAt(id), c = chg(id), sp = spark(id, 64, 26), os = ordersOf(id), na = os.filter(o => o.s === 's').length, nb = os.filter(o => o.s === 'b').length, have = f.bag[id] | 0;
          return `<li><button class="mk-row" data-mc="${id}">${pxImg('crop_' + id, 24)}<span class="mk-nm"><b>${CROPS[id][0]}${moodTag(id)}</b><small>${have ? `มี ${have} · ` : ''}ขาย ${na} · ซื้อ ${nb}</small></span>
            <span class="mk-pr"><b>${pr} 🪙</b><small class="${c > 0 ? 'up' : c < 0 ? 'dn' : ''}">${c > 0 ? '▲' : c < 0 ? '▼' : '•'} ${Math.abs(c)}%</small></span>
            <svg class="mk-spark" viewBox="0 0 64 26" aria-hidden="true"><path d="${sp.d}" fill="none" stroke="${c >= 0 ? '#1f9d55' : '#d1453b'}" stroke-width="2"/></svg></button></li>`; }).join('')}</ul>`;
      L.querySelectorAll('[data-mc]').forEach(b => b.onclick = () => { mSel = b.dataset.mc; store.set('mktSel', mSel); mSide = (f.bag[mSel] | 0) ? 's' : 'b'; mQ = 1; mP = mktAt(mSel); tab = 'stall'; api.sfx('tick'); list();
        const bx = T.closest('.box'); if (bx) { bx.scrollTop = 0; L.scrollTop = 0; if (T.getBoundingClientRect().top < 0) T.scrollIntoView({ block: 'center' }); } });
      L.querySelectorAll('[data-mx]').forEach(b => b.onclick = () => mktCancel(b.dataset.mx));
    } else if (tab === 'stall') {
      const id = mSel, mp = mktAt(id), [lo, hi] = mktBand(id), os = ordersOf(id), have = f.bag[id] | 0; p = Prog.get();
      const asks = os.filter(o => o.s === 's').sort((a, b) => a.p - b.p || (a.t || 0) - (b.t || 0)), bids = os.filter(o => o.s === 'b').sort((a, b) => b.p - a.p || (a.t || 0) - (b.t || 0));
      mP = Math.max(lo, Math.min(hi, mP || mp)); const maxQ = mSide === 's' ? have : Math.max(1, Math.floor(p.coins / mP)); mQ = Math.max(1, Math.min(mQ, maxQ || 1));
      const opp = (mSide === 's' ? bids.filter(o => o.p >= mP) : asks.filter(o => o.p <= mP)).filter(o => !isMine(o)); let m = 0, mv = 0;
      for (const o of opp) { const u = Math.min(mQ - m, o.l); m += u; mv += u * o.p; if (m >= mQ) break; }
      const can = mSide === 's' ? have >= mQ && have > 0 : p.coins >= mQ * mP, full = mineOpen().length >= MKT_MAX, off = !O || !nm;
      const CW = 320, CH = 110, sp = spark(id, CW, CH), base = CROPS[id][3], by = Math.max(4, Math.min(CH - 4, sp.y(base)));
      const row = o => `<li class="${isMine(o) ? 'mine' : o.npc ? 'npc' : ''}"><b>${o.p} 🪙</b><span>×${o.l}</span><span class="who">${whoOf(o)}</span><span class="mk-t" data-mend="${mktEnd(o)}" title="หมดเวลาใน">⏳${leftOf(o)}</span></li>`;
      L.innerHTML = backTo('mkt') + `<h4 class="sz-h mk-h">${pxImg('crop_' + id, 24)} แผง${CROPS[id][0]} ${moodTag(id, 1)}<small class="muted">ราคาตลาด <b>${mp} 🪙</b> · ราคากลาง ${base}</small></h4>
        <div class="mk-chart"><svg viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none" aria-label="ราคา 24 ชั่วโมง"><line x1="0" x2="${CW}" y1="${by}" y2="${by}" stroke="#d9c9ae" stroke-dasharray="4 4"/>
          <path d="${sp.d}" fill="none" stroke="#ff6b93" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>
          <div class="mk-ax"><span>24 ชม.ก่อน</span><span>สูง ${sp.hi} · ต่ำ ${sp.lo}</span><span>ตอนนี้</span></div></div>
        <div class="mk-book"><div><h5>🔴 ตั้งขาย <small class="muted">ถูกสุดก่อน</small></h5><ul class="mk-ob">${asks.slice(0, 5).map(row).join('') || '<li class="muted">ยังไม่มี</li>'}</ul></div>
          <div><h5>🟢 รับซื้อ <small class="muted">แพงสุดก่อน</small></h5><ul class="mk-ob">${bids.slice(0, 5).map(row).join('') || '<li class="muted">ยังไม่มี</li>'}</ul></div></div>
        <div class="mk-form">
          <div class="mk-seg"><button class="btn sm${mSide === 's' ? ' on' : ''}" data-ms="s">🔴 ตั้งขาย (มี ${have})</button><button class="btn sm${mSide === 'b' ? ' on' : ''}" data-ms="b">🟢 ตั้งรับซื้อ</button></div>
          <div class="mk-line"><span>จำนวน</span><span class="bag-q"><button class="btn sm" data-mq="-1" ${mQ > 1 ? '' : 'disabled'} aria-label="ลดจำนวน">−</button><b>${mQ}</b><button class="btn sm" data-mq="1" ${mQ < maxQ ? '' : 'disabled'} aria-label="เพิ่มจำนวน">+</button>${mSide === 's' && have > 1 ? '<button class="btn sm" data-mq="max">ทั้งหมด</button>' : ''}</span></div>
          <div class="mk-line"><span>ราคา/ชิ้น</span><span class="bag-q"><button class="btn sm" data-mp="-5" ${mP > lo ? '' : 'disabled'}>−5</button><button class="btn sm" data-mp="-1" ${mP > lo ? '' : 'disabled'} aria-label="ลดราคา">−</button><b>${mP}</b><button class="btn sm" data-mp="1" ${mP < hi ? '' : 'disabled'} aria-label="เพิ่มราคา">+</button><button class="btn sm" data-mp="5" ${mP < hi ? '' : 'disabled'}>+5</button><button class="btn sm" data-mp="mkt">ตลาด</button></span></div>
          <div class="mk-line"><span>ตั้งไว้นาน</span><span class="bag-q">${MKT_HRS.map(h => `<button class="btn sm${mD === h ? ' on' : ''}" data-md="${h}">${h} ชม.</button>`).join('')}</span></div>
          <p class="mk-hint${!can || full || off ? ' warn' : ''}">${off ? 'ตลาดต้องต่อเน็ตและตั้งชื่อก่อน' : full ? `ตั้งได้ครั้งละ ${MKT_MAX} คำสั่ง · ยกเลิกหรือรอให้มีคนจับคู่ก่อน` : !can ? (mSide === 's' ? `ไม่มี${CROPS[id][0]}ในตะกร้า (ผักกลายพันธุ์ขายที่ตะกร้า)` : 'เหรียญไม่พอ')
            : m ? `⚡ จับคู่ได้ทันที ${m} ชิ้น (${fmt(mv)} 🪙)${m < mQ ? ` · อีก ${mQ - m} ชิ้นวางรอที่แผง` : ''}` : `วางรอที่แผง · ${mSide === 's' ? 'ผักออกจากตะกร้าไปวางไว้' : 'เหรียญถูกกันไว้'} ยกเลิกได้ ครบ ${mD} ชม. แล้วคำสั่งหายไป ได้ของคืนเอง`}
            <br><small class="muted">ตั้งราคาได้ ${lo}–${hi} 🪙 (50–200% ของราคาตลาด)</small></p>
          <div class="mk-go"><button class="btn primary" data-mg ${can && !full && !off ? '' : 'disabled'}>${mSide === 's' ? '🔴 ตั้งขาย' : '🟢 ตั้งรับซื้อ'} ${mQ} × ${mP} = ${fmt(mQ * mP)} 🪙</button>
            ${mSide === 's' && have ? `<button class="btn" data-mn>💰 ขายให้ตลาดเลย ${Math.min(mQ, have)} × ${mp}</button>` : ''}</div>
        </div>`;
      L.querySelectorAll('[data-ms],[data-mq],[data-mp],[data-md]').forEach(b => b.onclick = () => { const d = b.dataset; api.sfx('tick');
        if (d.md) { mD = +d.md; store.set('mktD', mD); }
        else if (d.ms) { mSide = d.ms; mQ = 1; mP = mp; }
        else if (d.mq) mQ = d.mq === 'max' ? have : mQ + +d.mq;
        else if (d.mp) mP = d.mp === 'mkt' ? mp : mP + +d.mp;
        list(); });
      const g = L.querySelector('[data-mg]'); if (g) g.onclick = () => { g.disabled = true; mktPlace(mSide, id, mQ, mP).then(() => { mQ = 1; if (tab === 'stall') list(); }); };
      const nb = L.querySelector('[data-mn]'); if (nb) nb.onclick = () => { sellNow(id, Math.min(mQ, have)); mQ = 1; list(); };
    } else if (tab === 'cant') {
      const now = Date.now(), by = Object.values((cant && cant.by) || {}).sort((a, b) => b.p - a.p), claims = cantClaims(now);
      L.innerHTML = backTo('bag') + `<p class="muted farm-tip">ออเดอร์ของทั้งออฟฟิศ ช่วยกันส่งให้ครบ · ส่งได้ราคาดีกว่าขาย 20% · ครบแต่ละออเดอร์ คนที่ช่วยส่งได้ ${CANTEEN_REWARD} 🪙 · แล้วออเดอร์ใหม่มาใน 30 นาที</p>
        <ul class="farm-ls cant">${CANT_SLOTS.map((_, s) => { const q = cantView(cantSlot(cant, s), now), [id, n] = canteenQuest(wk(), s, q.r);
          const have = Object.entries(f.bag).filter(([k]) => k.split('.')[0] === id).reduce((a, [, c]) => a + c, 0), v = Math.min(n, q.got);
          if (q.done) return `<li class="cool">${pxImg('crop_' + id, 26)}<div class="cant-m"><b>${CROPS[id][0]}</b> <span class="ok">✓ ครบ ${n}</span><small class="muted">ออเดอร์ใหม่ใน <b data-cd="${q.done + CANTEEN_CD}">${mmss(q.done + CANTEEN_CD - now)}</b></small></div></li>`;
          return `<li>${pxImg('crop_' + id, 26)}<div class="cant-m"><b>${CROPS[id][0]}</b> <span class="muted">${v}/${n}</span><span class="xpbar"><i style="width:${v / n * 100}%"></i></span></div>
            <button class="btn sm" data-dl="${s}" ${have ? '' : 'disabled'}>${have ? `ส่ง ${Math.min(have, n - v)}` : 'ไม่มีในตะกร้า'}</button></li>`; }).join('')}</ul>
        ${claims.length ? `<button class="btn primary farm-plot" data-a="claim">🎉 รับรางวัลออเดอร์ที่ช่วยส่ง ${claims.length} ออเดอร์ (+${CANTEEN_REWARD * claims.length} 🪙)</button>` : ''}
        ${by.length ? `<h4 class="sz-h">คนที่ช่วยส่ง สัปดาห์นี้</h4><ol class="off-top">${by.slice(0, 5).map(r => `<li${keyOf(r.n) === myKey ? ' class="me"' : ''}><b>${esc(r.n)}</b> <span>${r.p} ชิ้น</span></li>`).join('')}</ol>` : ''}`;
      L.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => deliver(+b.dataset.dl));
      const cb = L.querySelector('[data-a=claim]'); if (cb) cb.onclick = () => cantClaims().forEach(([s, r]) => claimCanteen(s, r));
    } else if (tab === 'book') {
      const own = id => f.book[id] && (f.book[id][0] || f.book[id][2]), row = id => { const b = f.book[id], c = CROPS[id], muts = Object.keys((b && b[3]) || {});
        return `<li class="${own(id) ? '' : 'none'}">${own(id) ? pxImg('crop_' + id, 24) : '❔'} <b>${own(id) ? c[0] : '???'}</b> <span class="muted">${own(id) ? `เก็บ ${fmt(b[0] || 0)}${b[2] ? ` · ได้จากเพื่อน ${b[2]}` : ''}` : SIG.includes(id) ? 'ขอจากเพื่อน' : `Lv ${c[4]}`}</span>${muts.map(m => ` <i class="mut mut-${m}">${MUT[m][0]}</i>`).join('')}</li>`; };
      L.innerHTML = backTo('seed') + `<p class="muted farm-tip">ผัก ${VEG.filter(own).length}/${VEG.length} · ผลไม้ประจำตัว ${SIG.filter(own).length}/${SIG.length} · ผักที่สุกตอนฝนตก แดดทอง หรือรุ้ง จะกลายพันธุ์</p>
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
  function plotAt(e) { const { x, y } = at(e); LY = LY || layout(); for (let i = 0; i < LY.cols * LY.ROWY.length; i++) { const r = plotRect(i); if (x >= r.x && x < r.x + r.w && y >= r.y - 40 && y < r.y + r.h) return i; } return -1; }
  cv.addEventListener('pointermove', e => { const P = at(e); hover = onBasket(P.x, P.y) ? 99 : plotAt(e); if (hover === 99) { cv.style.cursor = 'pointer'; return; } cv.style.cursor = hover >= 0 && (hover < nPlots() || (!visit && hover === nPlots())) ? 'pointer' : 'default'; });
  cv.addEventListener('pointerleave', () => { hover = -1; });
  cv.addEventListener('pointerdown', e => {
    const P = at(e); if (onBasket(P.x, P.y)) { tab = 'bag'; api.sfx('tick'); list(); return; }
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
    const yard = visit ? !!visit.y || (visit.n | 0) > 10 : Farm.home() > 0;      // a house garden in the village, not the rooftop
    if (yard) {
      ctx.fillStyle = night ? '#2f5a3a' : wx === 'rain' ? '#6f9a74' : '#7cc46a';
      for (let x = -10; x < W; x += 34) { ctx.beginPath(); ctx.arc(x + 17, 104, 22, Math.PI, 0); ctx.fill(); } ctx.fillRect(0, 100, W, 22);
      ctx.fillStyle = '#c8955a'; ctx.fillRect(0, 106, W, 4); ctx.fillRect(0, 116, W, 4);
      ctx.fillStyle = '#e3b57a'; for (let x = 6; x < W; x += 22) ctx.fillRect(x, 96, 8, 26);
      ctx.fillStyle = wx === 'rain' ? '#9cc48a' : '#b5dc8f'; ctx.fillRect(0, 122, W, H - 122);
      ctx.fillStyle = 'rgba(80,140,60,.25)'; for (let i = 0; i < 90; i++) ctx.fillRect((i * 131) % W, 126 + (i * 71) % (H - 130), 3, 5);
      ctx.fillStyle = 'rgba(43,33,64,.15)'; ctx.fillRect(0, 122, W, 4);
      if (!(LY && LY.ROWY.length > 2)) for (const [n, x] of [['plant_small', 70], ['crate', 180], ['plant_pot', 470], ['fruit_veg', 570]]) drawPixAt(ctx, n, x, H - 4, 2);
      return;
    }
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
      const nr = nextUp(), small = r.w < 90;
      ctx.setLineDash([6, 5]); rrect(ctx, r.x + 4, r.y + 14, r.w - 8, r.h - 14, 8, hover === i ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.5)', '#b0a48f'); ctx.setLineDash([]);
      if (nr) { txt(ctx, small ? (Farm.home() ? '🌱 ขยาย' : '📐 ขยาย') : Farm.home() ? '🌱 ขยายสวน' : '📐 ขยายห้อง', r.x + r.w / 2, r.y + r.h / 2 + 2, small ? 11 : 12, '#7a6f8c', 'center', 700);
        txt(ctx, `${Farm.home() ? nr[0] : plotsFor(nr[0])} แปลง`, r.x + r.w / 2, r.y + r.h / 2 + 17, 11, '#7a6f8c'); }
      return;
    }
    rrect(ctx, r.x, r.y + 12, r.w, r.h - 12, 6, '#a5683f', '#6b3e26');
    rrect(ctx, r.x + 6, r.y + 18, r.w - 12, Math.max(10, r.h - 30), 4, pl && (pl.w || fwOf(i)) ? '#5a3a22' : '#7a5034');
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
  const BK = { x: 616, y: 222 };
  function basket() {
    const n = bagN(), h = hover === 99, { x, y } = BK;
    ctx.strokeStyle = '#6b3e26'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 2, 13, Math.PI, 0); ctx.stroke();
    const top = Object.keys(f.bag).filter(k => CROPS[k.split('.')[0]]).sort((a, b) => bagPrice(b) - bagPrice(a))[0];
    if (top) { const [id, m] = top.split('.'), im = cropImg(id, m); ctx.drawImage(im, Math.round(x - im.width), Math.round(y + 2 - im.height * 2), im.width * 2, im.height * 2); }
    rrect(ctx, x - 18, y - 2, 36, 20, 6, h ? '#e0a96a' : '#c98d52', '#6b3e26');
    ctx.fillStyle = '#a5683f'; for (let k = -12; k <= 12; k += 8) ctx.fillRect(x + k, y + 2, 2, 12);
    if (n) { rrect(ctx, x + 6, y - 30, 24, 16, 8, '#ff5c8a', PAL.ink); txt(ctx, String(n), x + 18, y - 22, 11, '#fff', 'center', 700); }
  }
  const onBasket = (x, y) => !visit && Math.abs(x - BK.x) < 24 && y > BK.y - 32 && y < BK.y + 22;
  // page position of a canvas point (coins fly from there to the HUD)
  const pagePt = (x, y) => { const R = cv.getBoundingClientRect(); return [R.left + x / W * R.width, R.top + y / H * R.height]; };
  const fly = (n, x = BK.x, y = BK.y) => { if (n > 0 && typeof flyCoins === 'function') flyCoins(...pagePt(x, y), q('coinBox'), n); };
  function info(now) {
    let s = '';
    if (hover >= 0 && hover < nPlots()) { const pl = plots()[hover];
      if (!pl) s = visit ? 'แปลงว่าง' : `แตะเพื่อปลูก${CROPS[seed][0]} (${CROPS[seed][2]} 🪙)`;
      else { const fw = fwOf(hover), left = ripeAt(pl, fw) - now, by = visit ? null : Object.values(myWaters[hover] || {}).filter(v => v.s === pl.t).map(v => v.n), wxR = WEATHER[weatherAt(ripeAt(pl, fw))];
        s = `${CROPS[pl.c][0]} · ${left <= 0 ? (visit ? 'สุกแล้ว' : 'แตะเพื่อเก็บ') : `สุก ${hhmm(ripeAt(pl, fw))}${wxR[3] ? ` ตอน${wxR[0]} → ${MUT[wxR[3]][0]}` : ''}`}${(pl.w ? 1 : 0) + fw ? ` · 💧×${Math.min(WATER_MAX, (pl.w ? 1 : 0) + fw)}` : left > 0 && !visit ? ' · แตะเพื่อรดน้ำ' : ''}${by && by.length ? ` (${by.join(', ')} รดให้)` : ''}`; } }
    else if (hover === nPlots() && !visit && nextUp()) s = Farm.home() ? 'ขยายสวนข้างบ้าน (ดูราคาที่แถบร้านค้า)' : 'ขยายห้องในออฟฟิศของฉัน แปลงผักเพิ่มตาม';
    else if (hover === 99) s = bagN() ? `ตะกร้า ${bagN()} ชิ้น · มูลค่า ${fmt(bagValue())} 🪙` : 'ตะกร้าว่าง';
    else if (visit) s = `แตะต้นที่ยังไม่สุก รดน้ำช่วย ${visit.nm} ให้โตเร็วขึ้น 15%`;
    return s;
  }
  function tip(s) {
    ctx.font = '600 13px Kanit, sans-serif'; const w = ctx.measureText(s).width + 24, x = W / 2 - w / 2, y = LY && LY.ROWY.length > 2 ? 4 : H - 30;
    rrect(ctx, x, y, w, 24, 12, 'rgba(43,33,64,.86)'); txt(ctx, s, W / 2, y + 12, 13, '#fff');
  }
  let cdT = 0;
  const off = api.loop(dt => {
    t += dt; const d = fx.step(dt), now = Date.now(), wx = wxWindow(now).id;
    if (Math.abs(me.tx - me.x) > 1) { me.x += Math.sign(me.tx - me.x) * Math.min(160 * d, Math.abs(me.tx - me.x)); me.dir = me.tx > me.x ? 'right' : 'left'; } else me.dir = 'down';
    LY = layout(); fx.pre(ctx); scene(wx);
    for (let i = 0; i < LY.cols; i++) bed(i, now);
    const moving = Math.abs(me.tx - me.x) > 1, anim = moving ? 'run' : 'idle_anim';
    const AY = LY.AISLE + 14;
    drawChar(ctx, me.who, anim, me.dir, t, me.x, AY, 2);
    if (!visit) { drawAcc(ctx, Wardrobe.eq('f'), me.who, anim, me.dir, t, me.x, AY, 2); drawAcc(ctx, Wardrobe.eq('h'), me.who, anim, me.dir, t, me.x, AY, 2); }
    if (me.act > 0) { me.act -= dt; ctx.drawImage(pxa('can'), me.x + 10, LY.AISLE - 40, 30, 24); }
    for (let i = LY.cols; i < LY.cols * LY.ROWY.length; i++) bed(i, now);
    if (!visit) basket();
    weatherFX(wx);
    fx.post(ctx, W, H);
    const hs = info(now); if (hs) tip(hs);
    wxHud(now);
    // keep the smart button current (crops ripen, the countdown ticks)
    if (!visit && smart(now).html !== toolSig) tools();
    if (mktPer(now) !== mPer) { mPer = mktPer(now); if (tab === 'mkt' || tab === 'stall' || tab === 'bag') list(); }
    if (now - mhT > 20e3) mktHouse();
    if ((tab === 'mkt' || tab === 'stall') && now - cdT > 1000) { cdT = now; let up = false;
      document.querySelectorAll('.farm [data-mend]').forEach(e => { const ms = +e.dataset.mend - now; if (ms <= 0) up = true; else { const v = hm(ms); const t = e.classList.contains('mk-t') ? '⏳' + v : v; if (e.textContent !== t) e.textContent = t; } });
      if (up) { list(); mktHouse(); } }
    if (tab === 'cant' && now - cdT > 500) { cdT = now; let up = false;     // canteen countdowns; a finished one brings the next order
      document.querySelectorAll('.farm [data-cd]').forEach(e => { const ms = +e.dataset.cd - now; if (ms <= 0) up = true; else e.textContent = mmss(ms); });
      if (up) list(); }
  });
  render();
  if (/[?&]test=1/.test(location.search)) window.__farm = { get f() { return f; }, harvestAll, sell, keepFor, smart, harvest, fwMine, ripeAt, mktPlace, mktCancel, mktHouse, mineOpen, ordersOf, get mkt() { return mkt; }, get bt() { return bt; }, setTab(t, c) { tab = t; if (c) mSel = c; list(); } };
  return { destroy() { dead = true; off(); offW && offW(); offC && offC(); offM && offM(); offN && offN(); offMC && offMC(); clearTimeout(pubT); publish(); } };
}
