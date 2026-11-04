// Cloud save (guest account → Google), anonymous usage stats and the weekly office awards.
// Classic script loaded after office.js and tower.js; uses the hub globals (store, toast, Prog, myName, loadOnline, esc, fmt,
// copyText, renderHub) at run time.
'use strict';

/* ---------- cloud save: every hra_* key goes to the player's account (rooms/_usave/{uid}); newest copy wins on load ---------- */
// Signing in with Google is the save: any device signed in to the same Google account gets the same character.
// Until then the player is a guest account when guest sign-in is on (same uid after linking Google, nothing moves),
// or just this browser when it is off. Saves from the earlier nickname + PIN version (rooms/_save/{name}) can still be
// loaded, and a device that was already PIN-linked keeps syncing that save quietly until it signs in with Google.
const Cloud = {
  SKIP: ['cloud', 'owner', 'shared', 'hubView', 'mOpen', 'aid', 'awSeen', 'pinSeen', 'muted'],
  acct: null, booted: false, reloading: false,
  hash: s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); },
  link: () => store.get('cloud', null),   // the old PIN link {k,h}
  signed: () => !!(Cloud.acct && !Cloud.acct.guest),
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
      Cloud.acct = A;
      if (!A) return Cloud.bootPin(O);
      // shared computer: the last person's sign-in ended with the browser, so their progress must not carry over
      const owner = store.get('owner', '');
      if (store.get('shared', false) && owner && owner !== A.uid) { Cloud.wipe(); Cloud.reload(); return; }
      return Cloud.sync(O, A);
    })).catch(() => {}).then(() => { if (Cloud.reloading) return; Cloud.booted = true; Cloud.paint(); });
  },
  bootPin(O) {
    const L = Cloud.link(), nm = myName(); if (!L || !nm || O.nameKey(nm) !== L.k) return;
    return O.getCloud(L.k).then(r => {
      if (!r) return Cloud.push();
      if (r.h !== L.h) { store.set('cloud', null); return; }
      const mine = store.get('progT', 0);
      if ((r.lt || 0) > mine + 1000) { Cloud.restore(r.d); Cloud.reload('☁️ โหลดความคืบหน้าล่าสุดจากคลาวด์แล้ว'); }
      else if ((r.lt || 0) < mine) return Cloud.push();
    });
  },
  nudge: () => !Cloud.signed() && Prog.get().lv >= 2,
  title: () => Cloud.signed() ? 'เซฟอยู่กับบัญชี Google' : 'เซฟด้วยบัญชี Google',
  paint() { const b = document.getElementById('cloudBtn'); if (!b) return; b.classList.toggle('dot', Cloud.nudge()); b.title = Cloud.title(); },
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
    Stats.open('cloud');
    const A = Cloud.acct, { B, close } = Cloud.sheet('☁️ เซฟของคุณ');
    if (!Cloud.signed()) {
      B.innerHTML = `<p>เข้าด้วยบัญชี Google แล้วตัวละครจะเซฟไว้กับบัญชีให้อัตโนมัติ เปิดเครื่องไหนก็ได้ตัวเดิม</p>
        ${Cloud.inApp() ? `<p class="cloud-warn">เปิดจากไลน์อยู่ ล็อกอิน Google ในไลน์ไม่ได้ กด ⋮ มุมขวาบน แล้วเลือก “เปิดในเบราว์เซอร์” ก่อน</p>
          <div class="row"><button class="btn" type="button" data-a="copy">คัดลอกลิงก์</button></div>`
        : `<div class="row"><button class="btn primary" type="button" data-a="g">เข้าด้วย Google</button></div>
          <p class="muted cloud-note">${A ? 'ตอนนี้เซฟอยู่แค่ในเบราว์เซอร์นี้' : 'ตอนนี้ความคืบหน้าอยู่แค่ในเครื่องนี้'} · ในเกมยังโชว์แค่ชื่อเล่น ไม่โชว์อีเมล</p>`}
        <button class="linkbtn" type="button" data-a="pin">เคยตั้ง PIN ไว้ในเวอร์ชันก่อน? โหลดตัวเดิม</button>`;
      const g = B.querySelector('[data-a=g]'); if (g) g.onclick = () => { close(); Cloud.google(); };
      const c = B.querySelector('[data-a=copy]'); if (c) c.onclick = async () => toast(await copyText(shareURL()) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่ได้');
      B.querySelector('[data-a=pin]').onclick = () => { close(); Cloud.oldSave(); };
    } else {
      B.innerHTML = `<p>✅ เซฟอยู่กับบัญชี Google เข้าเครื่องไหนก็ได้ตัวเดิม<br><small class="muted">${esc(A.email)}</small></p>
        <label class="cloud-chk"><input type="checkbox" data-a="sh"${store.get('shared', false) ? ' checked' : ''}> เครื่องนี้ใช้ร่วมกับคนอื่น (ออกจากระบบเองเมื่อปิดเบราว์เซอร์)</label>
        <button class="linkbtn" type="button" data-a="out">ออกจากระบบ</button>`;
      B.querySelector('[data-a=sh]').onchange = e => { const on = e.target.checked; store.set('shared', on);
        loadOnline().then(O => O.setShared(on)).then(() => toast(on ? 'ปิดเบราว์เซอร์แล้วจะออกจากระบบให้เอง' : 'เครื่องนี้จะจำการล็อกอินไว้')).catch(() => {}); };
      B.querySelector('[data-a=out]').onclick = () => {
        B.innerHTML = `<p>ออกจากระบบแล้วเครื่องนี้จะเริ่มใหม่ ตัวละครของคุณยังอยู่กับบัญชี Google</p>
          <div class="row"><button class="btn primary" type="button" data-a="ok">ออกจากระบบ</button></div>`;
        B.querySelector('[data-a=ok]').onclick = () => Cloud.push().then(() => loadOnline()).then(O => O.logout())
          .then(() => { Cloud.wipe(); Cloud.reload('ออกจากระบบแล้ว'); }).catch(() => toast('ออกจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง'));
      };
    }
  },
  google() {
    if (Cloud.inApp()) return Cloud.open();
    return loadOnline().then(O => O.google().then(({ acct, switched }) => {
      Cloud.acct = acct; store.set('cloud', null);   // the account takes over from the old PIN link
      if (!switched) { Cloud.push(); Cloud.paint(); toast('เซฟกับ Google แล้ว เข้าเครื่องอื่นด้วย Google ได้ตัวเดิม'); return; }
      Cloud.booted = false;
      return Cloud.sync(O, acct).then(() => { if (Cloud.reloading) return; Cloud.booted = true; renderHub(); toast('เข้าด้วย Google แล้ว'); });
    })).catch(e => { const c = (e && e.code) || '';
      if (/popup-closed|cancelled-popup/.test(c)) return;
      toast(c === 'auth/popup-blocked' ? 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน ลองกดอีกครั้ง' : `ล็อกอิน Google ไม่สำเร็จ${c ? ` (${c})` : ''} ลองใหม่อีกครั้ง`); });
  },
  // bring a save from the earlier nickname + PIN version onto this device; signing in with Google afterwards keeps it
  oldSave() {
    const nm = myName();
    if (!nm) { toast('ตั้งชื่อเล่นให้ตรงกับที่เคยตั้ง PIN ไว้ก่อน'); const i = document.getElementById('nameIn'); if (i) i.focus(); return; }
    const { B } = Cloud.sheet('☁️ โหลดเซฟเก่า (PIN)');
    const when = t => t ? new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    loadOnline().then(O => { const k = O.nameKey(nm);
      return O.getCloud(k).then(r => {
        if (!r) { B.innerHTML = `<p>ไม่พบเซฟเก่าของชื่อ <b>${esc(nm)}</b></p><p class="muted cloud-note">เปลี่ยนชื่อเล่นที่หน้าแรกให้ตรงกับที่เคยตั้ง PIN ไว้ แล้วลองใหม่</p>`; return; }
        B.innerHTML = `<p>พบเซฟของ <b>${esc(r.n || nm)}</b> · Lv ${r.lv | 0} · 🪙 ${fmt(r.c | 0)}<br><small class="muted">เซฟเมื่อ ${when(r.t)}</small></p>
          <input class="pin" inputmode="numeric" maxlength="4" placeholder="••••" aria-label="PIN 4 หลัก" autocomplete="off">
          <div class="row"><button class="btn primary" type="button" data-a="go">โหลดตัวเดิม</button></div>
          <p class="muted cloud-note">โหลดแล้วกด ☁️ เข้าด้วย Google เพื่อเซฟตัวนี้ไว้กับบัญชี</p>`;
        const i = B.querySelector('.pin'), go = B.querySelector('[data-a=go]');
        i.focus(); i.onkeydown = e => { if (e.key === 'Enter') go.click(); };
        go.onclick = () => { const pin = (i.value || '').trim();
          if (!/^\d{4}$/.test(pin)) { toast('PIN ต้องเป็นตัวเลข 4 หลัก'); return; }
          if (Cloud.hash(pin + k) !== r.h) { toast('PIN ไม่ตรง'); return; }
          const load = () => { Cloud.restore(r.d); store.set('progT', Date.now()); Cloud.reload('☁️ โหลดเซฟแล้ว'); };   // progT = now: beats the account copy
          const p = Prog.get(); if (p.lv <= 1 && p.xp === 0) return load();
          B.innerHTML = `<p>เครื่องนี้ก็มีตัวละครอยู่ (Lv ${p.lv} · 🪙 ${fmt(p.coins)}) โหลดเซฟเก่าทับเลยไหม?</p>
            <div class="row"><button class="btn primary" type="button" data-a="ld">โหลดเซฟเก่า (Lv ${r.lv | 0})</button></div>`;
          B.querySelector('[data-a=ld]').onclick = load; };
      });
    }).catch(() => { B.innerHTML = '<p class="muted">ต่อคลาวด์ไม่ได้ (เน็ตหลุด?) ลองใหม่อีกครั้ง</p>'; });
  },
};

/* ---------- anonymous stats: a random id per browser (never the name); game starts + finished plays, feature opens ---------- */
const Stats = {
  aid() { let a = store.get('aid', ''); if (!a) { a = Math.random().toString(36).slice(2, 10); store.set('aid', a); } return a; },
  hit(kind, id) { loadOnline().then(O => O.stat(kind, id, Stats.aid())).catch(() => {}); },
  open(feature) { Stats.hit('o', feature); },
  // economy: in_<source> / out_<sink> coins and event counts (plant, harvest, h_<crop>, ...), summed locally and sent every few seconds
  _e: {},
  econ(k, n = 1) { if (!n) return; Stats._e[k] = (Stats._e[k] || 0) + n; clearTimeout(Stats._et); Stats._et = setTimeout(Stats.flush, 3000); },
  flush() { clearTimeout(Stats._et); const e = Stats._e; Stats._e = {}; const ks = Object.keys(e); if (!ks.length) return;
    loadOnline().then(O => ks.forEach(k => O.stat('e', k, null, e[k]))).catch(() => {}); },
  // one balance per browser per day, for "how rich / what level are people" (no names)
  snap() { const p = Prog.get(), bag = (p.farm && p.farm.bag) || {}; Stats.hit('w', { l: p.lv | 0, c: Math.max(0, p.coins | 0), b: Object.values(bag).reduce((a, v) => a + (+v || 0), 0) }); },
  boot() { Stats.hit('u', Stats.aid()); Stats.snap(); addEventListener('pagehide', Stats.flush); document.addEventListener('visibilitychange', () => { if (document.hidden) Stats.flush(); }); },
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
