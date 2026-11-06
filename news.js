/* "มีอะไรใหม่" — patch notes shown once on entry after each update.
   To post an update: add an entry at the TOP with the next id, bump news.js?v=N in index.html.
   Keep it short and in players' words (3–5 lines), not code words. */
const NEWS = [
  { id: 2, d: '5–6 พ.ย. 2026', items: [
    ['🛋️', '<b>เฟอร์นิเจอร์ใหม่ 12 ชิ้น</b> บีนแบ็ก ตุ๊กตาหมี ตู้กดน้ำ ตู้ยา รถเข็น เก้าอี้ล้อเลื่อน ตู้เกมอาร์เคด และอีกเพียบ'],
    ['🎨', '<b>เปลี่ยนสีได้แล้ว</b> 12 สี ครั้งละ 🪙 10 — โซฟา เก้าอี้ เบาะ พรม และของชุดใหม่ กดที่ของในห้อง · หมวกกับของบนหน้า กดในตู้เสื้อผ้า · ลองสีตอนยังไม่ซื้อได้ฟรี'],
    ['🔎', '<b>ร้านค้าแยกหมวดแล้ว</b> กดเลือก ที่นั่ง โต๊ะ ตู้ ต้นไม้ โคมไฟ ติดผนัง หรือ ✨ ใหม่'],
    ['👒', '<b>เครื่องประดับใหม่</b> หมวกสาน โบว์ หน้ากากอนามัย หมวกพยาบาล'],
    ['🌱', '<b>ปรับราคาขายผักลง</b> (ประมาณครึ่งหนึ่ง) ให้ฟาร์มกับเกมได้เหรียญใกล้กัน · ทุกพืชยังได้กำไร · XP เท่าเดิม'],
    ['🔧', 'แก้บั๊ก: กดใส่หมวก/ของบนหน้าแล้วไม่ติด'],
  ] },
  { id: 1, d: '4 พ.ย. 2026', items: [
    ['🎫', '<b>Season Pass</b> เล่นเกมสะสมขั้นรายเดือน ได้ของประจำฤดูไปแต่งห้อง'],
    ['🏆', '<b>ถ้วยรายเดือน</b> ท็อป 3 ของแต่ละเกมได้ถ้วยไปวางในห้อง'],
    ['📝', '<b>แปะโน้ตในห้องเพื่อน</b> และดูได้ว่าใครแวะมาเยี่ยม'],
    ['☁️', '<b>เข้าด้วย Google</b> เล่นต่อได้ทุกเครื่อง ของไม่หาย'],
  ] },
];

const News = (() => {
  const latest = NEWS[0].id, seen = () => store.get('newsSeen', 0);
  const dot = () => { const b = document.getElementById('newsBtn'); b && b.classList.toggle('dot', seen() < latest); };
  function open() {
    store.set('newsSeen', latest); dot();
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin news"><h2>📰 มีอะไรใหม่</h2>${NEWS.map((n, i) => `
      <section class="${i ? 'old' : ''}"><h3>${n.d}${i ? '' : ' <span class="new">ใหม่</span>'}</h3>
      <ul>${n.items.map(([e, t]) => `<li><span class="e">${e}</span><span>${t}</span></li>`).join('')}</ul></section>`).join('')}
      <div class="row"><button class="btn primary">โอเค</button></div></div>`;
    ov.onclick = e => { if (e.target === ov || e.target.closest('button')) ov.remove(); };
    document.body.appendChild(ov);
  }
  // first-time players get onboarding instead; they start with everything "seen"
  function boot() {
    if (!store.get('name', '').trim() && !store.get('onboarded', false)) store.set('newsSeen', latest);
    dot();
    if (window.__TEST__ && !/[?&]news/.test(location.search)) return;
    if (seen() < latest) setTimeout(() => document.querySelector('.overlay') || open(), 800);
  }
  return { open, boot, latest };
})();
