// Cloud save (guest account → Google), anonymous usage stats and the weekly office awards.
// Classic script loaded after office.js and tower.js; uses the hub globals (store, toast, Prog, myName, loadOnline, esc, fmt,
// copyText, renderHub) at run time.
'use strict';

/* ---------- cloud save: every hra_* key goes to the player's account (rooms/_usave/{uid}); newest copy wins on load ---------- */
// Everyone is a guest account from the first visit, so saving needs no setup; linking Google lets another device sign in
// to the same save. Saves from the earlier nickname + PIN version (rooms/_save/{name}) can still be loaded.
// While guest sign-in is off in the Firebase console, acct stays null and the PIN save keeps working as before.
const Cloud = {
  SKIP: ['cloud', 'owner', 'shared', 'hubView', 'mOpen', 'aid', 'awSeen', 'pinSeen', 'muted'],
  acct: null, booted: false, reloading: false,
  hash: s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); },
  link: () => store.get('cloud', null),   // the old PIN link {k,h}
  dump() {
    const d = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('hra_') && !Cloud.SKIP.includes(k.slice(4))) d[k.slice(4)] = localStorage.getItem(k); }
    return d;
  },
  restore(d) {
    Object.keys(localStorage).filter(k => k.startsWith('hra_') && !Cloud.SKIP.includes(k.slice(4))).forEach(k => localStorage.removeItem(k));
    Object.entries(d || {}).forEach(([k, v]) => { try { localStorage.setItem('hra_' + k, v); } catch (e) {} });
  },
  // everything except device settings, so the next person on a shared computer starts clean
  wipe() { Object.keys(localStorage).filter(k => k.startsWith('hra_') && !['muted', 'aid'].includes(k.slice(4))).forEach(k => localStorage.removeItem(k)); },
  empty: () => { const p = store.get('prog', null); return !p || (p.lv <= 1 && !p.xp); },
  inApp: () => /\bLine\/|FBAN|FBAV|Instagram/i.test(navigator.userAgent),
  reload(msg) { Cloud.reloading = true; if (msg) toast(msg); setTimeout(() => location.reload(), 800); },
  // called on every Prog.put: remember when this device last changed, upload a few seconds later
  // (start-up writes before boot() has compared with the cloud don't count, or they would beat a newer save from another device)
  touch() { if (!Cloud.booted) return; store.set('progT', Date.now()); clearTimeout(Cloud._t); if (Cloud.acct || Cloud.link()) Cloud._t = setTimeout(Cloud.push, 4000); },
  push() {
    clearTimeout(Cloud._t);
    const A = Cloud.acct, L = Cloud.link(), nm = myName(), p = Prog.get();
    const v = { d: Cloud.dump(), lt: store.get('progT', 0), lv: p.lv, c: p.coins, n: (nm || '').trim().slice(0, 20) };
    return loadOnline().then(O => {
      if (A) return O.saveUser(A.uid, v);
      if (L && nm && O.nameKey(nm) === L.k) return O.saveCloud(L.k, { h: L.h, ...v });
    }).catch(() => {});
  },
  // make this device match account A: its own data → newest copy wins; nobody's or another account's data → adopt, upload or ask
  sync(O, A) {
    return O.getUser(A.uid).then(r => {
      const owner = store.get('owner', ''), mine = store.get('progT', 0);
      if (!r) { store.set('owner', A.uid); return Cloud.push(); }
      if (owner === A.uid) {
        if ((r.lt || 0) > mine + 1000) { Cloud.restore(r.d); Cloud.reload('☁️ โหลดความคืบหน้าล่าสุดจากคลาวด์แล้ว'); }
        else if ((r.lt || 0) < mine) return Cloud.push();
        return;
      }
      if (Cloud.empty()) { Cloud.restore(r.d); store.set('owner', A.uid); Cloud.reload('☁️ โหลดตัวละครของคุณแล้ว'); return; }
      return Cloud.choose(r, A);
    });
  },
  choose(r, A) {
    return new Promise(done => {
      const p = Prog.get(), { B, close } = Cloud.sheet('เลือกตัวละคร', true);
      B.innerHTML = `<p>บัญชีนี้มีตัวละคร <b>${esc(r.n || 'ไม่มีชื่อ')}</b> (Lv ${r.lv | 0}) อยู่แล้ว แต่เครื่องนี้เล่นอีกตัวอยู่ (${esc(myName() || 'ไม่มีชื่อ')}, Lv ${p.lv}) จะใช้ตัวไหน?</p>
        <div class="row"><button class="btn primary" type="button" data-a="ld">ใช้ตัวในบัญชี (Lv ${r.lv | 0})</button></div>
        <button class="linkbtn" type="button" data-a="kp">ใช้ตัวในเครื่องนี้ (Lv ${p.lv}) แทนตัวในบัญชี</button>`;
      B.querySelector('[data-a=ld]').onclick = () => { Cloud.restore(r.d); store.set('owner', A.uid); Cloud.reload('☁️ โหลดตัวละครของคุณแล้ว'); };
      B.querySelector('[data-a=kp]').onclick = () => { store.set('owner', A.uid); store.set('progT', Date.now()); Cloud.push().then(() => { close(); done(); }); };
    });
  },
  boot() {
    loadOnline().then(O => O.account().then(A => {
      Cloud.acct = A; Cloud.err = A ? '' : O.authErr();
      if (!A) return Cloud.bootPin(O);
      // shared computer: the last person's sign-in ended with the browser, so their progress must not carry over
      const owner = store.get('owner', '');
      if (store.get('shared', false) && owner && owner !== A.uid) { Cloud.wipe(); Cloud.reload(); return; }
      return Cloud.sync(O, A);
    })).catch(() => {}).then(() => { if (Cloud.reloading) return; Cloud.booted = true; Cloud.paint(); Cloud.checkName(); });
  },
  bootPin(O) {
    const L = Cloud.link(), nm = myName(); if (!L || !nm || O.nameKey(nm) !== L.k) return;
    return O.getCloud(L.k).then(r => {
      if (!r) return Cloud.push();
      if (r.h !== L.h) { store.set('cloud', null); toast('☁️ PIN ของเซฟถูกเปลี่ยนจากเครื่องอื่น กด ☁️ เพื่อเชื่อมใหม่'); return; }
      const mine = store.get('progT', 0);
      if ((r.lt || 0) > mine + 1000) { Cloud.restore(r.d); Cloud.reload('☁️ โหลดความคืบหน้าล่าสุดจากคลาวด์แล้ว'); }
      else if ((r.lt || 0) < mine) return Cloud.push();
    });
  },
  nudge: () => (Cloud.acct ? Cloud.acct.guest : !Cloud.link()) && Prog.get().lv >= 2,
  title: () => Cloud.acct ? (Cloud.acct.guest ? 'เซฟอยู่ในเบราว์เซอร์นี้ · เชื่อม Google เพื่อเล่นได้ทุกเครื่อง' : 'เชื่อมกับ Google แล้ว') : Cloud.link() ? 'เซฟอัตโนมัติอยู่' : 'เซฟความคืบหน้าขึ้นคลาวด์',
  paint() { const b = document.getElementById('cloudBtn'); if (!b) return; b.classList.toggle('dot', Cloud.nudge()); b.title = Cloud.title(); },
  // new device, same nickname: offer the old PIN save right on the hub
  checkName() {
    const nm = myName(), box = document.querySelector('[data-k=calert]'); if (!box) return;
    box.innerHTML = '';
    if (!nm || Cloud.link() || (Cloud.acct && !Cloud.acct.guest)) return;
    loadOnline().then(O => { const k = O.nameKey(nm); if (store.get('pinSeen', '') === k) return;
      return O.getCloud(k).then(r => { if (!r || myName() !== nm || !box.isConnected) return;
        box.innerHTML = `<div class="alert"><span>☁️ พบเซฟเก่าของ <b>${esc(r.n || nm)}</b> (Lv ${r.lv | 0}) ถ้าเป็นของคุณ ใส่ PIN เพื่อโหลดตัวเดิม</span>
          <span class="alert-a"><button class="btn sm primary" type="button" data-a="pin">ใส่ PIN</button><button class="linkbtn" type="button" data-a="no">ไม่ใช่ของฉัน</button></span></div>`;
        box.querySelector('[data-a=pin]').onclick = () => Cloud.pinPanel(true);
        box.querySelector('[data-a=no]').onclick = () => { store.set('pinSeen', k); box.innerHTML = ''; };
      }); }).catch(() => {});
  },
  sheet(title, noClose) {
    const ov = document.createElement('div'); ov.className = 'overlay cloud-ov';
    ov.innerHTML = `<div class="panel popin cloud"><h2>${title}</h2><div data-k="body"><p class="muted">กำลังเช็ก…</p></div>
      ${noClose ? '' : '<div class="res-links"><button class="linkbtn" type="button" data-a="x">ปิด</button></div>'}</div>`;
    const close = () => ov.remove(), B = ov.querySelector('[data-k=body]');
    if (!noClose) { ov.querySelector('[data-a=x]').onclick = close; ov.onclick = e => { if (e.target === ov) close(); }; }
    document.body.appendChild(ov);
    return { ov, B, close };
  },
  open() {
    if (!Cloud.acct) return Cloud.pinPanel();
    const A = Cloud.acct, { B, close } = Cloud.sheet('☁️ เซฟของคุณ');
    if (A.guest) {
      B.innerHTML = `<p>ตอนนี้เล่นแบบ guest เซฟขึ้นคลาวด์ให้อัตโนมัติ แต่ใช้ได้แค่ในเบราว์เซอร์นี้</p>
        ${Cloud.inApp() ? `<p class="cloud-warn">เปิดจากไลน์อยู่ ล็อกอิน Google ในไลน์ไม่ได้ กด ⋮ มุมขวาบน แล้วเลือก “เปิดในเบราว์เซอร์” ก่อน</p>
          <div class="row"><button class="btn" type="button" data-a="copy">คัดลอกลิงก์</button></div>`
        : `<div class="row"><button class="btn primary" type="button" data-a="g">เชื่อมบัญชี Google</button></div>
          <p class="muted cloud-note">เชื่อมแล้วเข้าเครื่องไหนก็ได้ตัวเดิม ในเกมยังโชว์แค่ชื่อเล่น</p>`}
        <button class="linkbtn" type="button" data-a="pin">มีเซฟเก่าที่ตั้ง PIN ไว้</button>`;
      const g = B.querySelector('[data-a=g]'); if (g) g.onclick = () => { close(); Cloud.google(); };
      const c = B.querySelector('[data-a=copy]'); if (c) c.onclick = async () => toast(await copyText(shareURL()) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่ได้');
      B.querySelector('[data-a=pin]').onclick = () => { close(); Cloud.pinPanel(true); };
    } else {
      B.innerHTML = `<p>เชื่อมกับ Google แล้ว เข้าเครื่องไหนก็ได้ตัวเดิม<br><small class="muted">${esc(A.email)}</small></p>
        <label class="cloud-chk"><input type="checkbox" data-a="sh"${store.get('shared', false) ? ' checked' : ''}> เครื่องนี้ใช้ร่วมกับคนอื่น (ออกจากระบบเองเมื่อปิดเบราว์เซอร์)</label>
        <button class="linkbtn" type="button" data-a="out">ออกจากระบบ</button>`;
      B.querySelector('[data-a=sh]').onchange = e => { const on = e.target.checked; store.set('shared', on);
        loadOnline().then(O => O.setShared(on)).then(() => toast(on ? 'ปิดเบราว์เซอร์แล้วจะออกจากระบบให้เอง' : 'เครื่องนี้จะจำการล็อกอินไว้')).catch(() => {}); };
      B.querySelector('[data-a=out]').onclick = () => {
        B.innerHTML = `<p>ออกจากระบบแล้วเครื่องนี้จะเริ่มเป็น guest ใหม่ ตัวละครของคุณยังอยู่กับบัญชี Google</p>
          <div class="row"><button class="btn primary" type="button" data-a="ok">ออกจากระบบ</button></div>`;
        B.querySelector('[data-a=ok]').onclick = () => Cloud.push().then(() => loadOnline()).then(O => O.logout())
          .then(() => { Cloud.wipe(); Cloud.reload('ออกจากระบบแล้ว'); }).catch(() => toast('ออกจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง'));
      };
    }
  },
  google() {
    if (Cloud.inApp()) return Cloud.open();
    return loadOnline().then(O => O.google().then(({ acct, switched }) => {
      Cloud.acct = acct;
      if (!switched) { Cloud.push(); Cloud.paint(); Cloud.checkName(); toast('เชื่อม Google แล้ว เข้าเครื่องอื่นด้วย Google ได้ตัวเดิม'); return; }
      Cloud.booted = false;
      return Cloud.sync(O, acct).then(() => { if (Cloud.reloading) return; Cloud.booted = true; renderHub(); toast('เข้าด้วย Google แล้ว'); });
    })).catch(e => { const c = (e && e.code) || '';
      if (/popup-closed|cancelled-popup/.test(c)) return;
      toast(c === 'auth/popup-blocked' ? 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน ลองกดอีกครั้ง' : 'ล็อกอิน Google ไม่สำเร็จ ลองใหม่อีกครั้ง'); });
  },
  // the earlier nickname + PIN save. loadOnly: just bring an old save onto this device (accounts on)
  pinPanel(loadOnly) {
    const nm = myName();
    if (!nm) { toast('ตั้งชื่อเล่นก่อน แล้วค่อยเซฟขึ้นคลาวด์'); const i = document.getElementById('nameIn'); if (i) i.focus(); return; }
    const { B, close } = Cloud.sheet(loadOnly ? '☁️ โหลดเซฟเก่า (PIN)' : '☁️ เซฟขึ้นคลาวด์');
    const when = t => t ? new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const pinBox = (btn, note) => `<input class="pin" inputmode="numeric" maxlength="4" placeholder="••••" aria-label="PIN 4 หลัก" autocomplete="off">
      <div class="row"><button class="btn primary" type="button" data-a="go">${btn}</button></div><p class="muted cloud-note">${note}</p>`;
    const readPin = () => { const v = (B.querySelector('.pin').value || '').trim(); if (!/^\d{4}$/.test(v)) { toast('PIN ต้องเป็นตัวเลข 4 หลัก'); return null; } return v; };
    loadOnline().then(O => { const k = O.nameKey(nm), L = Cloud.link();
      return O.getCloud(k).then(r => {
        if (loadOnly && !r) {
          B.innerHTML = `<p>ไม่พบเซฟเก่าของชื่อ <b>${esc(nm)}</b></p><p class="muted cloud-note">เปลี่ยนชื่อเล่นที่หน้าแรกให้ตรงกับที่เคยตั้ง PIN ไว้ แล้วลองใหม่</p>`;
        } else if (!loadOnly && L && L.k === k && r && r.h === L.h) {
          B.innerHTML = `<p>✅ เซฟอัตโนมัติอยู่กับชื่อ <b>${esc(nm)}</b><br><small class="muted">ล่าสุด ${when(r.t)}</small></p>
            <p class="muted cloud-note">ย้ายไปเครื่องใหม่: เปิดเว็บนี้ ตั้งชื่อเล่น “${esc(nm)}” แล้วกด ☁️ ใส่ PIN เดิม</p>
            <button class="linkbtn" type="button" data-a="un">เลิกเซฟจากเครื่องนี้</button>`;
          B.querySelector('[data-a=un]').onclick = () => { store.set('cloud', null); toast('เลิกเชื่อมแล้ว (เซฟบนคลาวด์ยังอยู่)'); close(); renderHub(); };
        } else if (!r) {
          B.innerHTML = `<p>ตั้ง PIN 4 หลัก แล้วความคืบหน้าจะเซฟไว้กับชื่อ <b>${esc(nm)}</b> — ล้างเบราว์เซอร์หรือเปลี่ยนเครื่องก็โหลดคืนได้</p>
            ${pinBox('☁️ เริ่มเซฟ', 'PIN แค่กันคนอื่นโหลดเซฟของคุณโดยบังเอิญ ไม่ใช่รหัสผ่านจริง อย่าใช้ PIN เดียวกับบัตร ATM')}`;
          B.querySelector('[data-a=go]').onclick = () => { const pin = readPin(); if (!pin) return;
            store.set('cloud', { k, h: Cloud.hash(pin + k) }); if (!store.get('progT', 0)) store.set('progT', Date.now());
            Cloud.push().then(() => { toast('☁️ เซฟขึ้นคลาวด์แล้ว จากนี้เซฟให้อัตโนมัติ'); close(); renderHub(); }); };
        } else {
          const p = Prog.get();
          B.innerHTML = `<p>พบเซฟของ <b>${esc(r.n || nm)}</b> · Lv ${r.lv | 0} · 🪙 ${fmt(r.c | 0)}<br><small class="muted">เซฟเมื่อ ${when(r.t)}</small></p>
            ${pinBox(loadOnly ? 'โหลดตัวเดิม' : 'ใส่ PIN เพื่อเชื่อม', 'ถ้าไม่ใช่เซฟของคุณ (ชื่อซ้ำกับเพื่อน) เปลี่ยนชื่อเล่นที่หน้าแรกก่อนนะ')}`;
          B.querySelector('[data-a=go]').onclick = () => { const pin = readPin(); if (!pin) return;
            const h = Cloud.hash(pin + k); if (h !== r.h) { toast('PIN ไม่ตรง'); return; }
            // progT = now, so this copy also beats the account's cloud copy after the reload
            const load = () => { Cloud.restore(r.d); store.set('progT', Date.now()); store.set('pinSeen', k); if (!Cloud.acct) store.set('cloud', { k, h }); Cloud.reload('☁️ โหลดเซฟแล้ว'); };
            const keep = () => { if (Cloud.acct) { store.set('pinSeen', k); Cloud.checkName(); close(); return; } store.set('cloud', { k, h }); store.set('progT', Date.now()); Cloud.push().then(() => { toast('☁️ เซฟของเครื่องนี้ขึ้นคลาวด์แทนแล้ว'); close(); renderHub(); }); };
            if (p.lv <= 1 && p.xp === 0) return load();
            B.innerHTML = `<p>เครื่องนี้ก็มีความคืบหน้าอยู่ (Lv ${p.lv} · 🪙 ${fmt(p.coins)}) จะใช้อันไหน?</p>
              <div class="row"><button class="btn primary" type="button" data-a="ld">☁️ ใช้เซฟคลาวด์ (Lv ${r.lv | 0})</button></div>
              <button class="linkbtn" type="button" data-a="kp">${Cloud.acct ? 'ไม่โหลด ใช้ตัวในเครื่องนี้ต่อ' : 'ใช้ของเครื่องนี้ทับ'} (Lv ${p.lv})</button>`;
            B.querySelector('[data-a=ld]').onclick = load; B.querySelector('[data-a=kp]').onclick = keep; };
        }
        const i = B.querySelector('.pin'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter') B.querySelector('[data-a=go]').click(); }; }
      });
    }).catch(() => { B.innerHTML = '<p class="muted">ต่อคลาวด์ไม่ได้ (เน็ตหลุด?) ลองใหม่อีกครั้ง</p>'; })
      .then(() => { if (!Cloud.err || !B.isConnected) return;   // why the Google account option is missing
        B.insertAdjacentHTML('beforeend', `<p class="muted cloud-note">ระบบบัญชี Google ยังใช้ไม่ได้ (${esc(Cloud.err)}) <button class="linkbtn" type="button" data-a="retry">ลองใหม่</button></p>`);
        B.querySelector('[data-a=retry]').onclick = () => { close(); Cloud.booted = false; Cloud.boot(); setTimeout(() => Cloud.open(), 1500); }; });
  },
};

/* ---------- anonymous stats: a random id per browser (never the name), plays per game, farm visits ---------- */
const Stats = {
  aid() { let a = store.get('aid', ''); if (!a) { a = Math.random().toString(36).slice(2, 10); store.set('aid', a); } return a; },
  hit(kind, id) { loadOnline().then(O => O.stat(kind, id)).catch(() => {}); },
  boot() { Stats.hit('u', Stats.aid()); },
};

/* ---------- weekly office awards: several small categories so different people win; results flip every Monday ---------- */
const AWARDS = [ // [id, emoji, title, unit]
  ['farm', '🌱', 'ชาวสวนแห่งสัปดาห์', 'ผลผลิต'],
  ['like', '👍', 'ห้องยอดไลก์', 'ไลก์ใหม่'],
  ['help', '💧', 'เพื่อนใจดี', 'ครั้งที่ช่วยเพื่อน'],
  ['rec', '🏆', 'เจ้าสถิติ', 'เกมที่ได้ที่ 1'],
  ['coin', '🪙', 'นักล่าเหรียญ', 'เหรียญ'],
  ['cant', '🍱', 'ฮีโร่โรงอาหาร', 'ชิ้นที่ส่ง'],
];
const Awards = {
  pend: {}, last: {}, data: null, at: 0,
  // batched: a harvest-all or a long game turns into one write per category
  add(cat, n = 1, who) {
    who = who || myName(); if (!who || !(n > 0)) return;
    const k = cat + '\n' + who; Awards.pend[k] = (Awards.pend[k] || 0) + n;
    clearTimeout(Awards._t); Awards._t = setTimeout(Awards.flush, 2500);
  },
  flush() {
    const p = Awards.pend; Awards.pend = {};
    loadOnline().then(O => Object.entries(p).forEach(([k, n]) => { const [c, w] = k.split('\n'); O.wkAdd(c, w, n); })).catch(() => {});
  },
  weeks: O => ({ now: O.buckets().w, prev: O.buckets(Date.now() - 7 * 864e5).w }),
  // winners = everyone tied for the top of a category last week
  winners: rows => (rows || []).filter(r => r.v === (rows[0] || {}).v),
  load(force) {
    if (Awards.data && !force && Date.now() - Awards.at < 120000) return Awards.data;
    Awards.at = Date.now();
    return Awards.data = loadOnline().then(O => { const w = Awards.weeks(O);
      return Promise.all([O.weekAwards(w.now), O.weekAwards(w.prev)]).then(([now, prev]) => {
        const last = {};
        AWARDS.forEach(([id, em, ti]) => Awards.winners(prev[id]).forEach(r => (last[r.k] = last[r.k] || []).push([em, ti])));
        Awards.last = last;
        if (Object.keys(last).length) O.wkAnnounce(w.prev).then(ok => { if (!ok) return;
          const s = AWARDS.map(([id, em]) => { const ws = Awards.winners(prev[id]); return ws.length ? `${em} ${ws.map(r => r.n).join(', ')}` : ''; }).filter(Boolean).join(' · ');
          O.pushFeed(`🏆 รางวัลออฟฟิศสัปดาห์ที่แล้ว: ${s}`); }).catch(() => {});
        return { now, prev };
      }); }).catch(() => { Awards.data = null; return { now: {}, prev: {} }; });
  },
  // tower name plates: last week's category emojis for this person (max 2 so the plate still fits)
  badge: k => (Awards.last[k] || []).slice(0, 2).map(a => a[0]).join(''),
  tip: k => (Awards.last[k] || []).map(a => a[1]).join(', '),
  mount(el) {
    if (!el) return;
    Promise.resolve(Awards.load()).then(({ now, prev }) => {
      if (!el.isConnected) return;
      const nm = myName(), me = nm ? nm.trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_').slice(0, 24) : '', won = [];
      el.innerHTML = AWARDS.map(([id, em, ti, unit]) => {
        const ws = Awards.winners(prev[id]), cur = (now[id] || [])[0], mine = (now[id] || []).find(r => r.k === me), iwon = ws.some(r => r.k === me);
        if (iwon) won.push(`${em} ${ti}`);
        return `<div class="aw${iwon ? ' won' : ''}"><span class="aw-em">${em}</span><span class="aw-t"><b>${ti}</b>
          ${ws.length ? `<small>🏅 ${ws.map(r => esc(r.n)).join(', ')} <i>(${fmt(ws[0].v)} ${unit})</i></small>` : ''}
          <small class="aw-now">${cur ? `สัปดาห์นี้ ${esc(cur.n)} นำ ${fmt(cur.v)}` : 'ยังว่าง เป็นคนแรกเลย'}${mine && mine !== cur ? ` · คุณ ${fmt(mine.v)}` : ''}</small></span></div>`;
      }).join('');
      const sh = document.getElementById('awShare'); if (!sh) return;
      sh.hidden = !won.length;
      sh.onclick = async () => toast(await copyText(`🏆 HR Arcade — รางวัลออฟฟิศสัปดาห์ที่แล้ว\n${nm} ได้ ${won.join(' · ')}\nมาแข่งกันสัปดาห์นี้ 👉 ${shareURL()}`) ? 'คัดลอกแล้ว ไปวางในไลน์ได้เลย 📋' : 'คัดลอกไม่ได้ 😢');
    });
  },
};
