// "แต่งตัว" — accessories drawn as pixel art on top of the LimeZu characters, so progress shows on you in the shared room.
// Title levels make most of them buyable with coins; a few only come from the capsule machine (gacha.js puts them in its pool).
// Classic script after office.js, before gacha.js (uses PXA_PAL, MI_PEOPLE, drawChar, Prog, store, toast).
'use strict';
// id → [slot (h head · f face), Thai name, unlock level (0 = gacha only), art rows, overlap rows into the head]
const ACC = {
  cap:     ['h', 'หมวกแก๊ป', 2, ['....kkkkk.....', '...krrrrrk....', '..krrrwrrrk...', '..krrrrrrrk...', '.kkRRRRRRRkkk.', '.kRRRRRRRRRRk.', '..kkkkkkkkkk..'], 4],
  flower:  ['h', 'กิ๊บดอกไม้', 4, ['.......kk.kk.', '......kppkppk', '.......kpypk.', '......kppkppk', '.......kk.kk.'], 2, 4],
  glasses: ['f', 'แว่นตา', 6, ['.kkkk..kkkk.', 'klllkkkklllk', 'klwlk..klwlk', '.kkk....kkk.'], 0],
  phones:  ['h', 'หูฟัง', 8, ['...kkkkkkkk...', '..kSSSSSSSSk..', '.kS........Sk.', '.kS........Sk.', 'kBBk......kBBk', 'kBBk......kBBk', 'kBBk......kBBk', '.kk........kk.'], 8],
  party:   ['h', 'หมวกปาร์ตี้', 10, ['.....y.....', '....kyk....', '....kpk....', '...kpypk...', '...kpppk...', '..kpypypk..', '..kpppppk..', '.kkkkkkkkk.'], 2],
  cat:     ['h', 'หูแมว', 12, ['.k..........k.', 'kck........kck', 'kpck......kcpk', 'kkkk......kkkk'], 2],
  shades:  ['f', 'แว่นกันแดด', 14, ['kkkkkkkkkkkk', 'kkwkkkkkwkkk', 'kkkkk..kkkkk', '.kkk....kkk.'], 0],
  chef:    ['h', 'หมวกเชฟ', 17, ['..kkk.kkk..', '.kmmmkmmmk.', 'kmmmmmmmmmk', 'kmmmmmmmmmk', '.kmmmmmmmk.', '.kmmmmmmmk.', '.kSSSSSSSk.', '.kkkkkkkkk.'], 2],
  tophat:  ['h', 'หมวกทรงสูง', 20, ['...kkkkkkk...', '...kkkkkkk...', '...kkkkkkk...', '...kkkkkkk...', '...krrrrrk...', '.kkkkkkkkkkk.'], 2],
  laurel:  ['h', 'มงกุฎใบไม้', 23, ['.g.g......g.g.', 'gGg.g....g.gGg', '.gGg......gGg.', '..gGgg..ggGg..'], 3],
  crown:   ['h', 'มงกุฎทองคำ', 26, ['.y...y...y.', 'kyk.kyk.kyk', 'kyykyyykyyk', 'kyyyyyyyyyk', 'kyrybyryyyk', 'kkkkkkkkkkk'], 2],
  halo:    ['h', 'รัศมีนางฟ้า', 30, ['..kyyyyyyk..', '.ky......yk.', '..kyyyyyyk..'], -4],
  beanie:  ['h', 'หมวกไหมพรม', 0, ['.....kk.....', '....kwwk....', '...kkkkkk...', '..kbbbbbbk..', '.kbbbbbbbbk.', '.kBBBBBBBBk.', '.kkkkkkkkkk.'], 4],
  sprout:  ['h', 'ต้นอ่อนบนหัว', 0, ['.kk..kk.', 'kggkkggk', '.kGkkGk.', '...kk...', '...kk...'], 1],
  bunny:   ['h', 'หูกระต่าย', 0, ['.kk....kk.', 'kmmk..kmmk', 'kmpk..kpmk', 'kmpk..kpmk', 'kmpk..kpmk', 'kmmk..kmmk', '.kmk..kmk.'], 2],
  tiara:   ['h', 'มงกุฎเพชร', 0, ['.....b.....', '....kbk....', '.k.kbwbk.k.', 'kbkkbbbkkbk', 'ksssssssssk', '.kkkkkkkkkk'], 2],
};
const ACC_GACHA = ['beanie', 'sprout', 'bunny', 'tiara'];
// coin price of each level-gated accessory (buyable once your level reaches ACC[id][2]; gacha-only ones have none)
const ACC_PRICE = { cap: 60, flower: 120, glasses: 180, phones: 250, party: 300, cat: 360, shades: 420, chef: 500, tophat: 600, laurel: 750, crown: 1000, halo: 1500 };
// head-top row inside the 16×32 frame (adam is a pixel taller) and the 1-px bob of the idle / run cycles
const HEAD_TOP = { adam: 9 }, BOB_IDLE = [0, 0, 1, 1, 0, 0], BOB_RUN = [0, 1, 0, 0, 1, 0];
// draw one accessory on a character drawn with the same arguments by drawChar
function drawAcc(ctx, id, who, anim, dir, t, cx, by, k) {
  const a = ACC[id]; if (!a || (a[0] === 'f' && dir === 'up')) return;
  const f = Math.floor(t * (anim === 'run' ? 12 : 8)) % 6, bob = anim === 'run' ? (dir === 'down' ? 1 - BOB_RUN[f] : BOB_RUN[f]) : BOB_IDLE[f];
  const top = (HEAD_TOP[who] || 10) + bob, rows = a[3], wpx = rows[0].length;
  let x0 = cx - wpx * k / 2 + (a[5] || 0) * k, y0;
  if (a[0] === 'f') { y0 = by - (32 - top - 6) * k; if (dir === 'left' || dir === 'right') x0 += (dir === 'left' ? -2 : 2) * k; }
  else y0 = by - (32 - top + rows.length - a[4]) * k + (id === 'halo' ? Math.sin(t * 3) * k : 0);
  const flip = dir === 'left' && id === 'cap';
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < wpx; c++) { const ch = rows[r][flip ? wpx - 1 - c : c]; if (ch === '.') continue;
    ctx.fillStyle = PXA_PAL[ch] || '#000'; ctx.fillRect(Math.round(x0 + c * k), Math.round(y0 + r * k), k, k); }
}
const Wardrobe = (() => {
  const icons = {};
  // small PNG of an accessory alone (for lists, the gacha book and the results screen)
  function icon(id, k = 3) {
    const key = id + k; if (icons[key]) return icons[key];
    const rows = ACC[id][3], c = document.createElement('canvas'); c.width = rows[0].length * k; c.height = rows.length * k;
    const x = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = PXA_PAL[ch]; x.fillRect(i * k, y * k, k, k); } }));
    return (icons[key] = c.toDataURL());
  }
  const st = p => (p.acc = Object.assign({ h: '', f: '', own: {} }, p.acc || {}));
  // once: level accessories that used to be free at your level stay yours (they now cost coins)
  function mig() {
    if (store.get('accMig', 0)) return; store.set('accMig', 1);
    const raw = store.get('prog', null); if (!raw) return;
    const p = Prog.get(), a = st(p); let n = 0;
    for (const id in ACC) if (ACC[id][2] && ACC[id][2] <= p.lv && !a.own[id]) { a.own[id] = 1; n++; }
    if (n) Prog.put(p);
  }
  const owns = (p, id) => !!ACC[id] && !!st(p).own[id];
  const price = id => ACC_PRICE[id] || 0;
  // level accessories at or under lv that you can buy but don't own yet
  const buyable = lv => { mig(); const p = Prog.get(); return Object.keys(ACC).filter(id => ACC[id][2] && ACC[id][2] <= lv && !owns(p, id)); };
  function buy(id) {
    mig(); const p = Prog.get(), a = st(p), A = ACC[id], c = price(id);
    if (!A || !c || owns(p, id) || p.lv < A[2] || p.coins < c) return false;
    p.coins -= c; typeof Stats !== 'undefined' && Stats.econ('out_wardrobe', c); a.own[id] = 1; a[A[0]] = id; Prog.put(p);
    if (typeof SFX !== 'undefined' && SFX.level) SFX.level();
    toast(`👕 ซื้อ ${A[1]} แล้ว`); return true;
  }
  const eq = slot => { mig(); const p = Prog.get(), id = st(p)[slot]; return owns(p, id) ? id : ''; };
  // accessories unlocked by reaching levels in (from, to]
  const unlockedBetween = (from, to) => Object.keys(ACC).filter(id => ACC[id][2] > from && ACC[id][2] <= to);
  const nextUnlock = lv => Object.keys(ACC).filter(id => ACC[id][2] > lv).sort((a, b) => ACC[a][2] - ACC[b][2])[0];

  function open() {
    typeof Stats !== 'undefined' && Stats.open('wardrobe');
    mig(); const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin wardrobe"><h2>👕 แต่งตัว</h2><canvas class="wd-prev" width="160" height="150"></canvas>
      <div data-k="body"></div><div class="row"><button class="btn primary" data-x>เสร็จแล้ว</button></div></div>`;
    let raf = 0;
    const close = () => { cancelAnimationFrame(raf); ov.remove(); if (typeof presence === 'function') presence(); if (typeof renderHub === 'function' && !document.getElementById('hub').hidden) renderHub(); };
    ov.onclick = e => { if (e.target === ov || e.target.closest('[data-x]')) close(); };
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), B = ov.querySelector('[data-k=body]');
    let t = 0, last = 0;
    const loop = ts => { raf = requestAnimationFrame(loop); t += Math.min(.05, (ts - last) / 1000 || 0); last = ts;
      const p = Prog.get(), who = p.who || 'adam', dir = ['down', 'right', 'down', 'left'][Math.floor(t / 2) % 4];
      ctx.clearRect(0, 0, 160, 150); ctx.fillStyle = 'rgba(43,33,64,.15)'; ctx.beginPath(); ctx.ellipse(80, 140, 30, 7, 0, 0, 7); ctx.fill();
      drawChar(ctx, who, 'idle_anim', dir, t, 80, 142, 4); for (const s of ['f', 'h']) drawAcc(ctx, eq(s), who, 'idle_anim', dir, t, 80, 142, 4); };
    raf = requestAnimationFrame(loop);
    function draw() {
      const p = Prog.get(), a = st(p);
      const tile = id => { const A = ACC[id], has = owns(p, id), on = a[A[0]] === id, c = price(id), sell = !has && A[2] && p.lv >= A[2];
        if (sell) return `<button class="wd-it buy${p.coins < c ? ' short' : ''}"${p.coins < c ? ' disabled' : ''} data-a="${id}" title="${A[1]}"><img src="${icon(id)}" alt=""><small>${A[1]}</small><small><b>${p.coins < c ? `ขาด ${fmt(c - p.coins)} 🪙` : `🪙 ${fmt(c)} ซื้อ`}</b></small></button>`;
        return `<button class="wd-it${has ? '' : ' no'}${on ? ' on' : ''}" data-a="${id}" title="${A[1]}"><img src="${icon(id)}" alt=""><small>${has ? A[1] : A[2] ? `🔒 Lv ${A[2]}` : '🎰 กาชา'}</small></button>`; };
      const ids = Object.keys(ACC).sort((x, y) => (ACC[x][2] || 99) - (ACC[y][2] || 99));
      B.innerHTML = `<p class="muted" style="margin:6px 0;text-align:center">🪙 ${fmt(p.coins)}</p><h3>ตัวละคร</h3><div class="wd-row">${MI_PEOPLE.map(w => `<button class="wd-who${p.who === w ? ' on' : ''}" data-w="${w}"><img src="assets/mi/${w}_down.png" alt="${w}"></button>`).join('')}</div>
        <h3>บนหัว</h3><div class="wd-grid"><button class="wd-it${a.h ? '' : ' on'}" data-a="" data-s="h"><span>✖</span><small>ไม่ใส่</small></button>${ids.filter(i => ACC[i][0] === 'h').map(tile).join('')}</div>
        <h3>แว่น</h3><div class="wd-grid"><button class="wd-it${a.f ? '' : ' on'}" data-a="" data-s="f"><span>✖</span><small>ไม่ใส่</small></button>${ids.filter(i => ACC[i][0] === 'f').map(tile).join('')}</div>`;
      B.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const p2 = Prog.get(); p2.who = b.dataset.w; Prog.put(p2); draw(); });
      B.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const p2 = Prog.get(), a2 = st(p2), id = b.dataset.a;
        if (!id) { a2[b.dataset.s] = ''; Prog.put(p2); return draw(); }
        if (!owns(p2, id)) { const A = ACC[id];
          if (A[2] && p2.lv >= A[2]) { if (p2.coins < price(id)) toast(`เหรียญไม่พอ — ขาด ${fmt(price(id) - p2.coins)} 🪙`); else if (buy(id)) draw(); return; }
          toast(A[2] ? `🔒 ถึง Lv ${A[2]} แล้วซื้อ ${A[1]} ได้` : `🎰 ${A[1]} มีเฉพาะในตู้กาชา`); return; }
        a2[ACC[id][0]] = a2[ACC[id][0]] === id ? '' : id; Prog.put(p2); draw(); });
    }
    draw();
  }
  return { open, icon, eq, price, buyable, buy, owns: id => { mig(); return owns(Prog.get(), id); }, unlockedBetween, nextUnlock, give(id) { const p = Prog.get(), a = st(p), dup = !!a.own[id]; a.own[id] = 1; if (!a.h && ACC[id][0] === 'h') a.h = id; Prog.put(p); return dup; } };
})();
