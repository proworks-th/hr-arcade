// "ตู้กาชาปอง" — spend coins on capsules: badges shown next to your name (room, online list, coworkers row)
// and furniture for "ออฟฟิศของฉัน" (the gold set only comes from here). In-game coins only — no real money.
// Rates 70 / 25 / 5 · a 10-pull holds at least one rare · the 30th pull without a legend is a legend ·
// duplicate badges become stamps (แสตมป์) that buy any badge. One free pull per day.
// Classic script after office.js (uses Prog, SHOP_KIND, drawPixAt via icon(), domBurst, store, toast, fmt).
'use strict';
const GACHA_PRICE = 100, GACHA_10 = 900, PITY = 30;
const RAR = { c: { th: 'ธรรมดา', col: '#9aa3b5', p: .70, stamp: 1, cost: 6 }, r: { th: 'หายาก', col: '#3a86ff', p: .25, stamp: 3, cost: 18 }, l: { th: 'ตำนาน', col: '#ffb000', p: .05, stamp: 10, cost: 45 } };
// [id, rarity, kind (b badge · f furniture · a accessory from wardrobe.js), label]
const GACHA_POOL = [
  ['coffee', 'c', 'b', '☕ สายกาแฟ'], ['clip', 'c', 'b', '📎 มนุษย์คลิปหนีบ'], ['lunch', 'c', 'b', '🍱 นักล่ามื้อเที่ยง'], ['plant', 'c', 'b', '🌱 คนรักต้นไม้'], ['print', 'c', 'b', '🖨️ เพื่อนเครื่องปริ้น'], ['nap', 'c', 'b', '😴 นักงีบมืออาชีพ'],
  ['cushion_blue', 'c', 'f'], ['cushion_yellow', 'c', 'f'], ['plant_small', 'c', 'f'], ['cake_straw', 'c', 'f'], ['pizza', 'c', 'f'], ['fruit_basket', 'c', 'f'], ['beanie', 'c', 'a'], ['sprout', 'c', 'a'],
  ['flash', 'r', 'b', '⚡ สายด่วนพิเศษ'], ['dj', 'r', 'b', '🎧 DJ ออฟฟิศ'], ['hero', 'r', 'b', '🦸 ฮีโร่ปิดงาน'], ['brain', 'r', 'b', '🧠 สมองเพชร'],
  ['palm', 'r', 'f'], ['floorlamp_blue', 'r', 'f'], ['sofa_white', 'r', 'f'], ['tv', 'r', 'w'], ['pic_aqua', 'r', 'w'], ['bunny', 'r', 'a'],
  ['vip', 'l', 'b', '👑 VIP'], ['rainbow', 'l', 'b', '🌈 ตำนานพักเที่ยง'], ['diamond', 'l', 'b', '💎 เพชรแห่งแผนก'],
  ['globe_gold', 'l', 'f'], ['jar_gold', 'l', 'f'], ['mirror_gold', 'l', 'w'], ['tiara', 'l', 'a'],
];
const GACHA_ONLY = new Set(['globe_gold', 'jar_gold', 'mirror_gold']);
const BADGES = Object.fromEntries(GACHA_POOL.filter(x => x[2] === 'b').map(x => [x[0], x]));
const badgeTxt = id => (BADGES[id] || [])[3] || '';
const badgeEmoji = id => (badgeTxt(id).split(' ')[0]) || '';

const Gacha = (() => {
  const state = p => (p.gacha = Object.assign({ pity: 0, badges: {}, eq: '', stamps: 0, free: '' }, p.gacha || {}));
  const freeToday = p => state(p).free !== thaiDay();
  function roll(p, forceRare) {
    const g = state(p); g.pity++;
    let r = Math.random(), rar = r < RAR.l.p ? 'l' : r < RAR.l.p + RAR.r.p ? 'r' : 'c';
    if (g.pity >= PITY) rar = 'l'; else if (forceRare && rar === 'c') rar = 'r';
    if (rar === 'l') g.pity = 0;
    const L = GACHA_POOL.filter(x => x[1] === rar), it = L[Math.floor(Math.random() * L.length)], [id, , kind] = it;
    let dup = false;
    if (kind === 'b') { dup = !!g.badges[id]; g.badges[id] = (g.badges[id] || 0) + 1; if (dup) g.stamps += RAR[rar].stamp; else if (!g.eq) g.eq = id; }
    else if (kind === 'a') { p.acc = Object.assign({ h: '', f: '', own: {} }, p.acc || {}); dup = !!p.acc.own[id]; p.acc.own[id] = 1; if (dup) g.stamps += RAR[rar].stamp; else if (!p.acc.h) p.acc.h = id; }
    else p.inv[id] = (p.inv[id] || 0) + 1;
    return { it, rar, dup };
  }
  function pull(n, free) {
    const p = Prog.get(), cost = free ? 0 : n === 10 ? GACHA_10 : GACHA_PRICE * n;
    if (p.coins < cost) { toast('เหรียญไม่พอ — ไปเล่นเกมหาเหรียญก่อน 🪙'); return null; }
    p.coins -= cost; if (free) state(p).free = thaiDay();
    const out = []; for (let i = 0; i < n; i++) out.push(roll(p, n === 10 && i === n - 1 && !out.some(o => o.rar !== 'c')));
    Prog.put(p);
    const leg = out.find(o => o.rar === 'l'), nm = myName();
    if (leg && nm) loadOnline().then(O => O.pushFeed(`🎰 ${nm} หมุนกาชาได้ของระดับตำนาน: ${label(leg.it)}!`, nm, meWho())).catch(() => {});
    return out;
  }
  const FURN_TH = { cushion_blue: 'เบาะสีฟ้า', cushion_yellow: 'เบาะสีเหลือง', plant_small: 'ต้นไม้จิ๋ว', cake_straw: 'เค้กสตรอว์เบอร์รี', pizza: 'พิซซ่า', fruit_basket: 'ตะกร้าผลไม้',
    palm: 'ต้นปาล์ม', floorlamp_blue: 'โคมไฟตั้งพื้นสีฟ้า', sofa_white: 'โซฟาขาว', tv: 'ทีวีจอแบน', pic_aqua: 'ภาพตู้ปลา', globe_gold: 'ลูกโลกทองคำ', jar_gold: 'โถทองคำ', mirror_gold: 'กระจกทองคำ' };
  const label = it => it[2] === 'b' ? it[3] : it[2] === 'a' ? '👒 ' + ACC[it[0]][1] : (FURN_TH[it[0]] || it[0]);
  const plain = it => it[2] === 'b' ? it[3].split(' ').slice(1).join(' ') : it[2] === 'a' ? ACC[it[0]][1] : label(it);
  const art = (it, big) => it[2] === 'b' ? `<span class="gb-emo${big ? ' big' : ''}">${badgeEmoji(it[0])}</span>` : it[2] === 'a' ? `<img class="pxi" src="${Wardrobe.icon(it[0])}" alt="" style="height:${big ? 40 : 22}px">` : `<img class="pxi" src="assets/mi/${it[0]}.png" alt="" style="height:${big ? 56 : 30}px">`;

  function open() {
    typeof Stats !== 'undefined' && Stats.open('gacha');
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin gacha"><h2>🎰 ตู้กาชาปอง</h2><div class="rk-tabs" data-k="tabs"></div><div data-k="body"></div><div class="row"><button class="btn" data-x>ปิด</button></div></div>`;
    ov.onclick = e => { if (e.target === ov || e.target.closest('[data-x]')) { ov.remove(); if (typeof renderHub === 'function' && !document.getElementById('hub').hidden) renderHub(); } };
    document.body.appendChild(ov);
    let tab = 'machine';
    const q = k => ov.querySelector(`[data-k=${k}]`);
    function tabs() { q('tabs').innerHTML = [['machine', '🎰 ตู้'], ['book', '📒 สมุดสะสม']].map(([k, v]) => `<button class="btn sm${k === tab ? ' on' : ''}" data-t="${k}">${v}</button>`).join('');
      q('tabs').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); }); }
    function draw() {
      tabs(); const p = Prog.get(), g = state(p), B = q('body');
      if (tab === 'machine') {
        const fr = freeToday(p);
        B.innerHTML = `<div class="gm"><div class="gm-dome">${'<i></i>'.repeat(9)}</div><div class="gm-body"><span class="gm-slot"></span><span class="gm-knob" data-k="knob"></span></div><div class="gm-cap" data-k="cap" hidden></div></div>
          <p class="muted" style="margin:6px 0">🪙 ${fmt(p.coins)} · ตำนาน ${Math.round(RAR.l.p * 100)}% · การันตีตำนานในอีก <b>${PITY - g.pity}</b> ครั้ง</p>
          <div class="row" style="flex-wrap:wrap">${fr ? '<button class="btn primary" data-pull="free">🎁 หมุนฟรีวันนี้</button>' : ''}
            <button class="btn${fr ? '' : ' primary'}" data-pull="1">หมุน 1 ครั้ง · 🪙${GACHA_PRICE}</button><button class="btn" data-pull="10">หมุน 10 ครั้ง · 🪙${GACHA_10} <small>(หายาก+ อย่างน้อย 1)</small></button></div>
          <div class="g-res" data-k="res"></div>`;
        B.querySelectorAll('[data-pull]').forEach(b => b.onclick = () => {
          const k = b.dataset.pull, res = pull(k === '10' ? 10 : 1, k === 'free'); if (!res) return;
          B.querySelectorAll('[data-pull]').forEach(x => x.disabled = true);
          const knob = q('knob'), cap = q('cap'), best = res.reduce((a, o) => o.rar === 'l' || (o.rar === 'r' && a !== 'l') ? o.rar : a, 'c');
          knob.classList.add('turn'); typeof SFX !== 'undefined' && SFX.good && SFX.good();
          setTimeout(() => { cap.hidden = false; cap.style.setProperty('--c', RAR[best].col); cap.className = 'gm-cap drop'; }, 500);
          setTimeout(() => { cap.className = 'gm-cap open'; show(res); if (best === 'l') { const R = B.getBoundingClientRect(); domBurst(B, R.width / 2, 120, { n: 50, dist: 240, size: 10, colors: ['#ffd23f', '#ff5c8a', '#fff'] }); SFX.level && SFX.level(); } }, 1300);
          setTimeout(draw, res.length > 1 ? 4800 : 2900);
        });
      } else {
        const owned = GACHA_POOL.filter(x => x[2] === 'b' ? g.badges[x[0]] : x[2] === 'a' ? p.acc && p.acc.own && p.acc.own[x[0]] : (p.inv[x[0]] || p.room.items.some(it => it[0] === x[0])));
        B.innerHTML = `<p>สะสมแล้ว <b>${owned.length}/${GACHA_POOL.length}</b> (${Math.round(owned.length / GACHA_POOL.length * 100)}%) · แสตมป์ <b>${g.stamps}</b> 🎫</p>
          <p class="muted" style="font-size:13px;margin:0 0 6px">แตะป้ายที่มีเพื่อติดข้างชื่อ · ป้ายที่ยังไม่มี แลกด้วยแสตมป์ได้</p>
          <div class="g-book">${GACHA_POOL.map(x => { const has = owned.includes(x), b = x[2] === 'b', on = b && g.eq === x[0];
            return `<button class="g-it r-${x[1]}${has ? '' : ' no'}${on ? ' on' : ''}" ${b ? `data-b="${x[0]}"` : 'disabled'} title="${label(x)}">${art(x)}<small>${has ? plain(x) : b ? `🎫 ${RAR[x[1]].cost}` : '???'}</small></button>`; }).join('')}</div>`;
        B.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const p2 = Prog.get(), g2 = state(p2), id = b.dataset.b, rar = BADGES[id][1];
          if (g2.badges[id]) g2.eq = g2.eq === id ? '' : id;
          else if (g2.stamps >= RAR[rar].cost) { g2.stamps -= RAR[rar].cost; g2.badges[id] = 1; g2.eq = id; toast(`🎫 แลกป้าย ${badgeTxt(id)} แล้ว`); }
          else { toast(`แสตมป์ไม่พอ (ต้องใช้ ${RAR[rar].cost})`); return; }
          Prog.put(p2); if (typeof presence === 'function') presence(); draw(); });
      }
    }
    function show(res) {
      q('res').innerHTML = res.map((o, i) => `<div class="g-card r-${o.rar}" style="animation-delay:${i * .18}s">${art(o.it, res.length === 1)}<b>${plain(o.it)}</b><small style="color:${RAR[o.rar].col}">${RAR[o.rar].th}${o.dup ? ` · ซ้ำ +${RAR[o.rar].stamp}🎫` : ''}</small></div>`).join('');
    }
    draw();
  }
  return { open, freeToday: () => freeToday(Prog.get()), eq: () => state(Prog.get()).eq };
})();
