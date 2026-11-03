// Cloud save (nickname + 4-digit PIN), anonymous usage stats and the weekly office awards.
// Classic script loaded after office.js and tower.js; uses the hub globals (store, toast, Prog, myName, loadOnline, esc, fmt,
// copyText) at run time.
'use strict';

/* ---------- cloud save: every hra_* key is copied to rooms/_save/{name}, newest copy wins on page load ---------- */
// The database is open to anyone, so the PIN only keeps people from loading someone else's save by typing their name.
const Cloud = {
  SKIP: ['cloud', 'hubView', 'mOpen', 'aid', 'awSeen'],
  hash: s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); },
  link: () => store.get('cloud', null),
  dump() {
    const d = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('hra_') && !Cloud.SKIP.includes(k.slice(4))) d[k.slice(4)] = localStorage.getItem(k); }
    return d;
  },
  restore(d) {
    Object.keys(localStorage).filter(k => k.startsWith('hra_') && !Cloud.SKIP.includes(k.slice(4))).forEach(k => localStorage.removeItem(k));
    Object.entries(d || {}).forEach(([k, v]) => { try { localStorage.setItem('hra_' + k, v); } catch (e) {} });
  },
  // called on every Prog.put: remember when this device last changed, upload a few seconds later
  // (start-up writes before boot() has compared with the cloud don't count, or they would beat a newer save from another device)
  touch() { if (!Cloud.booted) return; store.set('progT', Date.now()); clearTimeout(Cloud._t); if (Cloud.link()) Cloud._t = setTimeout(Cloud.push, 4000); },
  push() {
    const L = Cloud.link(), nm = myName(); if (!L || !nm) return Promise.resolve();
    return loadOnline().then(O => { if (O.nameKey(nm) !== L.k) return; const p = Prog.get();
      return O.saveCloud(L.k, { h: L.h, d: Cloud.dump(), lt: store.get('progT', 0), lv: p.lv, c: p.coins, n: nm.trim().slice(0, 20) }); }).catch(() => {});
  },
  // page load: a newer copy from another device replaces this one (then reload so every screen reads it)
  boot() {
    const L = Cloud.link(), nm = myName(), done = () => { Cloud.booted = true; };
    if (!L || !nm) return done();
    loadOnline().then(O => O.nameKey(nm) === L.k ? O.getCloud(L.k) : undefined).then(r => {
      if (r === undefined) return;
      if (!r) return Cloud.push();
      if (r.h !== L.h) { store.set('cloud', null); toast('☁️ PIN ของเซฟถูกเปลี่ยนจากเครื่องอื่น กด ☁️ เพื่อเชื่อมใหม่'); return; }
      const mine = store.get('progT', 0);
      if ((r.lt || 0) > mine + 1000) { Cloud.reloading = true; Cloud.restore(r.d); toast('☁️ โหลดความคืบหน้าล่าสุดจากคลาวด์แล้ว'); setTimeout(() => location.reload(), 900); }
      else { done(); if ((r.lt || 0) < mine) Cloud.push(); }
    }).catch(done).then(() => { if (!Cloud.reloading) done(); });
  },
  nudge: () => !Cloud.link() && Prog.get().lv >= 2,
  open() {
    const nm = myName();
    if (!nm) { toast('ตั้งชื่อเล่นก่อน แล้วค่อยเซฟขึ้นคลาวด์'); const i = document.getElementById('nameIn'); if (i) i.focus(); return; }
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin cloud"><h2>☁️ เซฟขึ้นคลาวด์</h2><div data-k="body"><p class="muted">กำลังเช็ก…</p></div>
      <div class="res-links"><button class="linkbtn" type="button" data-a="x">ปิด</button></div></div>`;
    const close = () => ov.remove(), B = ov.querySelector('[data-k=body]');
    ov.querySelector('[data-a=x]').onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
    document.body.appendChild(ov);
    const when = t => t ? new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const pinBox = (btn, note) => `<input class="pin" inputmode="numeric" maxlength="4" placeholder="••••" aria-label="PIN 4 หลัก" autocomplete="off">
      <div class="row"><button class="btn primary" type="button" data-a="go">${btn}</button></div><p class="muted cloud-note">${note}</p>`;
    const readPin = () => { const v = (B.querySelector('.pin').value || '').trim(); if (!/^\d{4}$/.test(v)) { toast('PIN ต้องเป็นตัวเลข 4 หลัก'); return null; } return v; };
    loadOnline().then(O => { const k = O.nameKey(nm), L = Cloud.link();
      return O.getCloud(k).then(r => {
        if (L && L.k === k && r && r.h === L.h) {
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
            ${pinBox('ใส่ PIN เพื่อเชื่อม', 'ถ้าไม่ใช่เซฟของคุณ (ชื่อซ้ำกับเพื่อน) เปลี่ยนชื่อเล่นที่หน้าแรกก่อนนะ')}`;
          B.querySelector('[data-a=go]').onclick = () => { const pin = readPin(); if (!pin) return;
            const h = Cloud.hash(pin + k); if (h !== r.h) { toast('PIN ไม่ตรง'); return; }
            const load = () => { Cloud.restore(r.d); store.set('cloud', { k, h }); toast('☁️ โหลดเซฟแล้ว'); setTimeout(() => location.reload(), 700); };
            const keep = () => { store.set('cloud', { k, h }); store.set('progT', Date.now()); Cloud.push().then(() => { toast('☁️ เซฟของเครื่องนี้ขึ้นคลาวด์แทนแล้ว'); close(); renderHub(); }); };
            if (p.lv <= 1 && p.xp === 0) return load();
            B.innerHTML = `<p>เครื่องนี้ก็มีความคืบหน้าอยู่ (Lv ${p.lv} · 🪙 ${fmt(p.coins)}) จะใช้อันไหน?</p>
              <div class="row"><button class="btn primary" type="button" data-a="ld">☁️ ใช้เซฟคลาวด์ (Lv ${r.lv | 0})</button></div>
              <button class="linkbtn" type="button" data-a="kp">ใช้ของเครื่องนี้ทับ (Lv ${p.lv})</button>`;
            B.querySelector('[data-a=ld]').onclick = load; B.querySelector('[data-a=kp]').onclick = keep; };
        }
        const i = B.querySelector('.pin'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter') B.querySelector('[data-a=go]').click(); }; }
      });
    }).catch(() => { B.innerHTML = '<p class="muted">ต่อคลาวด์ไม่ได้ (เน็ตหลุด?) ลองใหม่อีกครั้ง</p>'; });
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
      sh.onclick = async () => toast(await copyText(`🏆 HR Arcade — รางวัลออฟฟิศสัปดาห์ที่แล้ว\n${nm} ได้ ${won.join(' · ')}\nมาแข่งกันสัปดาห์นี้ 👉 ${location.href.split(/[?#]/)[0]}`) ? 'คัดลอกแล้ว ไปวางในไลน์ได้เลย 📋' : 'คัดลอกไม่ได้ 😢');
    });
  },
};
