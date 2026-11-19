/* PTR dev panel (19 Nov 2026). Loaded only from the PTR strip ("เครื่องมือทดสอบ"), on hr-arcade-ptr.web.app or on a
   local test server with ?dev=1; the live site never loads it. It changes this browser's PTR save and the PTR database.
   Sections: player · time and date · move around · events. The pretend date needs a reload (index.html swaps Date at load). */
(function () {
  const V = () => (typeof Village !== 'undefined' ? Village : null),   // a top-level const, not on window
        W = () => V() && V()._dbg && V()._dbg.W, Dv = () => V() && V()._dev;
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (e) { return null; } };
  const say = m => (typeof toast === 'function' ? toast(m) : console.log(m));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const realNow = () => Date.now() - (window.__devDT || 0);
  const PLACES = [['ตึกออฟฟิศ', 5, 9], ['สวนกลาง', 28, 17], ['ตลาด', 56, 9], ['สะพานท่าน้ำ', 62, 18], ['ตึกเกม', 64, 33], ['ขอบตะวันออก', 71, 8], ['ขอบใต้', 36, 46]];
  const PRESETS = [['23 พ.ย. 09:00', '2026-11-23T09:00', 'งานเริ่ม'], ['24 พ.ย. 20:00', '2026-11-24T20:00', 'คืนลอยกระทง'], ['28 พ.ย. 00:05', '2026-11-28T00:05', 'งานจบแล้ว']];
  let el = null, timer = 0, armed = '', opener = null;

  const CSS = `.ptr-dev{position:fixed;top:26px;right:0;bottom:0;width:min(340px,94vw);z-index:9998;overflow:auto;background:var(--t-surface,#fffaf0);
    color:var(--t-ink,#3b2316);border-left:2px solid var(--t-ink,#3b2316);box-shadow:-3px 0 0 rgba(0,0,0,.12);padding:10px 12px 24px;font:13px/1.5 var(--t-font,sans-serif)}
  .ptr-dev h2{font-size:15px;margin:0 0 4px;display:flex;justify-content:space-between;align-items:center}
  .ptr-dev h3{font-size:13px;margin:14px 0 6px;padding-top:10px;border-top:1px solid rgba(0,0,0,.12)}
  .ptr-dev .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}
  .ptr-dev .row label{min-width:74px}
  .ptr-dev input,.ptr-dev select{font:inherit;padding:3px 6px;border:1.5px solid var(--t-ink,#3b2316);border-radius:6px;background:#fff;min-width:0}
  .ptr-dev input[type=number]{width:96px}
  .ptr-dev .btn{margin:0}
  .ptr-dev .btn[aria-pressed=true]{background:var(--t-main,#4a7a52);color:var(--t-main-ink,#fff);border-color:var(--t-main,#4a7a52)}
  .ptr-dev .muted{color:rgba(0,0,0,.6);font-size:12px;margin:2px 0}
  .ptr-dev .warn{color:#a33}
  .ptr-dev .grid{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center}`;

  function skillsRows() {
    if (typeof Skills === 'undefined') return '<p class="muted">ไม่มีระบบทักษะ</p>';
    const p = Prog.get(), xp = (p.sk && p.sk.xp) || {};
    return '<div class="grid">' + Object.keys(Skills.DEF).map(id => {
      const t = Skills.TIER_XP.filter(n => (xp[id] || 0) >= n).length, names = Skills.DEF[id][2];
      return `<label for="dvSk_${id}">${Skills.DEF[id][0]}</label><select id="dvSk_${id}" data-sk="${id}">${[0, ...names.map((_, i) => i + 1)].map(i =>
        `<option value="${i}"${i === t ? ' selected' : ''}>${i ? `ขั้น ${i} · ${names[i - 1]}` : 'ยังไม่เริ่ม'}</option>`).join('')}</select>`;
    }).join('') + '</div>';
  }
  function render() {
    const p = Prog.get(), dv = Dv(), mode = dv ? dv.loyModeNow : '', dt = window.__devDT || 0;
    const now = new Date(), nowS = now.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const pad = n => String(n).padStart(2, '0'), local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    el.innerHTML = `<h2><span>เครื่องมือทดสอบ (PTR)</span><button class="btn sm" type="button" data-k="close" aria-label="ปิด">✕</button></h2>
      <p class="muted">มีแค่บนเซิร์ฟเวอร์ทดสอบ เปลี่ยนเซฟและฐานข้อมูลของ PTR เท่านั้น ไม่กระทบเกมจริง</p>

      <h3>ผู้เล่น</h3>
      <div class="row"><label for="dvCoins">เหรียญ</label><input id="dvCoins" type="number" min="0" step="100" value="${p.coins | 0}"><button class="btn sm" type="button" data-k="coins">ตั้ง</button><button class="btn sm" type="button" data-k="coins+">+10,000</button></div>
      <div class="row"><label for="dvLv">เลเวล</label><input id="dvLv" type="number" min="1" max="99" value="${p.lv | 0}"><button class="btn sm" type="button" data-k="lv">ตั้ง</button></div>
      ${skillsRows()}
      <div class="row"><button class="btn sm" type="button" data-k="todayLoy">รีเซ็ตโควตากระทงวันนี้</button><button class="btn sm" type="button" data-k="todaySk">รีเซ็ต XP ทักษะวันนี้</button></div>
      <div class="row"><button class="btn sm${armed === 'wipe' ? ' warn' : ''}" type="button" data-k="wipe">${armed === 'wipe' ? 'กดอีกครั้งเพื่อล้างเซฟ' : 'ล้างเซฟในเครื่องนี้'}</button></div>

      <h3>เวลาและวันที่</h3>
      <div class="row"><span>เวลาหมู่บ้าน</span>${[[6, '06:00'], [12, '12:00'], [18, '18:00'], [21, '21:00']].map(([h, l]) => `<button class="btn sm" type="button" data-h="${h}">${l}</button>`).join('')}<button class="btn sm" type="button" data-k="realClock">เวลาจริง</button></div>
      <p class="muted">${dt ? `วันที่สมมติ: ${nowS} (เลื่อนจากจริง ${fmt(dt / 36e5)} ชม.)` : `วันที่จริง: ${nowS}`}</p>
      <div class="row"><input id="dvDate" type="datetime-local" value="${local}"><button class="btn sm" type="button" data-k="date">ใช้วันที่นี้</button></div>
      <div class="row">${PRESETS.map(([l, v, d]) => `<button class="btn sm" type="button" data-dt="${v}" title="${d}">${l}</button>`).join('')}</div>
      <div class="row"><button class="btn sm" type="button" data-k="day+">ข้ามไปพรุ่งนี้</button><button class="btn sm" type="button" data-k="dateReal"${dt ? '' : ' disabled'}>กลับเวลาจริง</button></div>
      <p class="muted">เปลี่ยนวันที่แล้วหน้าเว็บจะโหลดใหม่เอง · กระทงที่ลอยด้วยเวลาจริงอาจไม่เห็นตอนใช้วันที่สมมติ</p>

      <h3>เดินทาง</h3>
      <div class="row">${PLACES.map(([n], i) => `<button class="btn sm" type="button" data-w="${i}">${n}</button>`).join('')}</div>
      <div class="row"><span>ความเร็วเดิน</span>${[1, 3, 6].map(n => `<button class="btn sm" type="button" data-sp="${n}" aria-pressed="${(window.__devSpeed || 1) === n}">×${n}</button>`).join('')}</div>
      <p class="muted">ตำแหน่งตอนนี้: <b data-pos>–</b></p>

      <h3>อีเวนต์ลอยกระทง</h3>
      ${dv ? `<div class="row"><span>สถานะ</span>${[['on', 'เปิด'], ['off', 'ปิด'], ['date', 'ตามวันที่']].map(([m, l]) => `<button class="btn sm" type="button" data-lm="${m}" aria-pressed="${(mode || 'on') === m}">${l}</button>`).join('')}</div>
      <p class="muted">ตอนนี้: ${dv.loyOn() ? 'เปิดอยู่' : 'ปิดอยู่'} · "ตามวันที่" ใช้ 23–27 พ.ย. จริง ใช้คู่กับวันที่สมมติได้</p>
      <div class="row"><label for="dvLoyN">ยอดลอย (เครื่องนี้)</label><input id="dvLoyN" type="number" min="0" placeholder="ยอดจริง"><button class="btn sm" type="button" data-k="loyN">ตั้ง</button><button class="btn sm" type="button" data-k="loyNx">ใช้ยอดจริง</button></div>
      <p class="muted">ตั้ง 50 เพื่อดูดอกไม้ไฟตอนค่ำ (เห็นแค่เครื่องนี้)</p>
      <div class="row"><button class="btn sm" type="button" data-k="loyFill">ลอยกระทงทดสอบ 10 ใบ</button><button class="btn sm${armed === 'loyClear' ? ' warn' : ''}" type="button" data-k="loyClear">${armed === 'loyClear' ? 'กดอีกครั้งเพื่อเก็บทั้งหมด' : 'เก็บกระทงทั้งหมดในบึง'}</button></div>`
      : '<p class="muted">เปิดหมู่บ้านก่อน แล้วกดเครื่องมือทดสอบอีกครั้ง</p>'}`;
  }
  function nearWalk(x, y) { const w = W(); if (!w) return null;
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && w.walkable(x + dx, y + dy)) return [x + dx, y + dy];
    return null; }
  function setDate(ms) { if (ms) ls('hra_dev_dt', Math.round(ms)); else ls('hra_dev_dt', null); location.reload(); }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const k = b.dataset.k, p = Prog.get(), dv = Dv();
    if (k !== 'wipe' && k !== 'loyClear') armed = '';
    if (k === 'close') return close();
    if (k === 'coins') { p.coins = Math.max(0, +el.querySelector('#dvCoins').value | 0); Prog.put(p); say(`เหรียญ = ${fmt(p.coins)}`); }
    else if (k === 'coins+') { p.coins = (p.coins | 0) + 10000; Prog.put(p); say('+10,000 เหรียญ'); }
    else if (k === 'lv') { p.lv = Math.min(99, Math.max(1, +el.querySelector('#dvLv').value | 0)); p.xp = 0; Prog.put(p); say(`เลเวล = ${p.lv}`); }
    else if (k === 'todayLoy') { if (dv) dv.resetLoyDay(); say('รีเซ็ตโควตากระทงวันนี้แล้ว'); }
    else if (k === 'todaySk') { if (p.sk) { p.sk.today = {}; p.sk.day = ''; Prog.put(p); } say('รีเซ็ต XP ทักษะวันนี้แล้ว'); }
    else if (k === 'wipe') { if (armed !== 'wipe') { armed = 'wipe'; } else { Object.keys(localStorage).filter(x => x.startsWith('hra_') && !x.startsWith('hra_dev')).forEach(x => ls(x, null)); location.reload(); return; } }
    else if (b.dataset.h) { const w = W(); if (w && w.setHour) { w.setHour(+b.dataset.h); say(`เวลาหมู่บ้าน ${b.textContent}`); } }
    else if (k === 'realClock') { const w = W(); if (w && w.realClock) w.realClock(); }
    else if (k === 'date') { const v = el.querySelector('#dvDate').value; const t = Date.parse(v); if (!isFinite(t)) return say('ใส่วันที่ก่อน'); return setDate(t - realNow()); }
    else if (b.dataset.dt) return setDate(Date.parse(b.dataset.dt) - realNow());
    else if (k === 'day+') return setDate((window.__devDT || 0) + 864e5);
    else if (k === 'dateReal') return setDate(0);
    else if (b.dataset.w) { const pl = PLACES[+b.dataset.w], c = nearWalk(pl[1], pl[2]), w = W(); if (!c || !w) return say('เปิดหมู่บ้านก่อน'); w.place(c); say(`วาร์ปไป${pl[0]}`); }
    else if (b.dataset.sp) { window.__devSpeed = +b.dataset.sp; }
    else if (b.dataset.lm && dv) { dv.loyMode(b.dataset.lm); }
    else if (k === 'loyN' && dv) { const v = el.querySelector('#dvLoyN').value; dv.loyN(v === '' ? null : Math.max(0, +v | 0)); say(v === '' ? 'ใช้ยอดจริง' : `ยอดลอย (เครื่องนี้) = ${v}`); }
    else if (k === 'loyNx' && dv) { dv.loyN(null); say('ใช้ยอดจริง'); }
    else if (k === 'loyFill' && dv) { b.disabled = true; dv.loyFill(10).then(n => { say(`ลอยกระทงทดสอบ ${n} ใบแล้ว`); render(); }); return; }
    else if (k === 'loyClear' && dv) { if (armed !== 'loyClear') { armed = 'loyClear'; } else { armed = ''; say(`เก็บกระทง ${dv.loyClear()} ใบแล้ว`); } }
    render();
  }
  function onChange(e) { const s = e.target.closest('select[data-sk]'); if (!s) return; const p = Prog.get(), t = +s.value;
    p.sk = p.sk || { xp: {}, today: {} }; p.sk.xp = p.sk.xp || {}; p.sk.xp[s.dataset.sk] = t ? Skills.TIER_XP[t - 1] : 0; Prog.put(p); say(`${Skills.DEF[s.dataset.sk][0]} ขั้น ${t}`); }
  function tick() { if (!el) return; const w = W(), m = w && w.me, out = el.querySelector('[data-pos]'); if (out) out.textContent = m ? `x ${Math.floor(m.px / 16)}, y ${Math.floor(m.py / 16)}` : '–'; }
  function open(btn) { opener = btn || opener;
    if (!document.getElementById('ptrDevCss')) { const st = document.createElement('style'); st.id = 'ptrDevCss'; st.textContent = CSS; document.head.appendChild(st); }
    el = document.createElement('aside'); el.className = 'ptr-dev'; el.setAttribute('aria-label', 'เครื่องมือทดสอบ'); document.body.appendChild(el);
    el.addEventListener('click', onClick); el.addEventListener('change', onChange); render(); timer = setInterval(tick, 300); tick();
    if (opener) opener.setAttribute('aria-expanded', 'true'); }
  function close() { if (!el) return; clearInterval(timer); el.remove(); el = null; armed = ''; if (opener) { opener.setAttribute('aria-expanded', 'false'); opener.focus(); } }
  window.PtrDev = { toggle(btn) { if (el) close(); else open(btn); }, open, close };
})();
