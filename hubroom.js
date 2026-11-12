// "ห้องปาร์ตี้" — the hub is a shared pixel office (LimeZu Modern Interiors, same kit as the solo games):
// everyone on the home page walks around, chats in speech bubbles, and party games run on the stage in the middle.
//  - presence (rooms/_hub/on/{sid}) carries each player's target cell; every client walks the others there itself
//  - chat = rooms/_hub/chat · the party game = rooms/_hub/game, owned by the host (earliest visible player in the room)
// Party games follow one rule: 1–2 buttons, everyone plays their own lane at once, nobody is knocked out.
//  🕺 เต้น (arrows + Space on beat 4) · 🪢 ชักเย่อ (mash Space; alone = vs the boss) · 🏃 วิ่งไปตอกบัตร (auto-run, Space = jump)
// Classic script after solo-games.js + office.js; uses their kit and the hub's globals at run time.
'use strict';
const HubRoom = (() => {
  const C = 32, COLS = 22, ROWS = 9, TOP = 2, W = COLS * C, H = ROWS * C;
  const STAGE = { x0: 8, x1: 13, y0: 4, y1: 7 };       // party stage (cells, inclusive)
  const ROOM = { wall: 'wall_yellow', floor: 'floor_wood', items: [
    ['window_big', 1, 0], ['pic_land', 4, 0], ['noticeboard', 6, 0], ['tv', 10, 0], ['world_map', 14, 0], ['window_big', 17, 0], ['board_calendar', 20, 0],
    ['plant_pot', 0, 2], ['sofa_grey', 1, 2], ['floorlamp_red', 4, 2], ['tree', 7, 2], ['tree', 14, 2], ['cabinet_plates', 18, 2], ['fridge', 20, 2], ['fridge', 21, 2],
    ['armchair_wood', 0, 5], ['rug_green', 1, 5], ['bench_pink', 1, 7], ['plant_small', 5, 8],
    ['pc_desk', 16, 4], ['chair_back', 16, 5], ['table_light', 18, 6], ['palm', 21, 8], ['plant_pot', 15, 8],
  ] };
  // office level: everyone's coins fill one shared counter; each level adds furniture to this room for good
  // [points needed in total, what the room gets, items]
  const OFFICE = [
    [0, 'ห้องเริ่มต้น', []],
    [500, '🖼️ รูปติดผนัง', [['pic_cat', 8, 0], ['pic_flower', 13, 0]]],
    [1300, '🌿 มุมต้นไม้', [['shelf_plant', 16, 2], ['plant_pot', 3, 8]]],
    [2500, '🟦 พรมกลางห้อง', [['rug_lblue', 18, 4], ['rug_blue', 2, 3]]],
    [4000, '📚 ชั้นหนังสือ', [['bookshelf', 12, 2]]],
    [6000, '🛋️ โซฟาแดง', [['sofa_red', 3, 5]]],
    [8500, '🪟 หน้าต่างบานใหญ่', [['window_slide', 21, 0]]],
    [11500, '🧊 ตู้เย็นใหญ่ + ขนม', [['fridge_wide', 0, 3], ['cans', 19, 5]]],
    [15000, '🎨 แกลเลอรี', [['pic_sunset', 3, 0], ['pic_robot', 9, 0]]],
    [19000, '🌴 สวนในออฟฟิศ', [['palm', 11, 8], ['tree', 7, 8]]],
    [24000, '🏆 ลูกโลกทองคำ', [['globe_gold', 17, 8]]],
  ];
  function officeLv(pts) {
    let i = 0; while (i + 1 < OFFICE.length && pts >= OFFICE[i + 1][0]) i++;
    const extra = i === OFFICE.length - 1 ? Math.floor((pts - OFFICE[i][0]) / 6000) : 0, base = OFFICE[i][0] + extra * 6000;
    const next = i + 1 < OFFICE.length ? OFFICE[i + 1][0] : base + 6000;
    return { lv: i + 1 + extra, i, pts, from: base, to: next, cur: { n: OFFICE[i][1] }, next: OFFICE[i + 1] ? { n: OFFICE[i + 1][1], items: OFFICE[i + 1][2] } : null };
  }
  // office fund (กองทุนออฟฟิศ): coins people chip in this month; each goal decorates this room until the month ends
  // [coins in the pot this month, what the room gets, items ([n, x, y, lift] — lift = px above a table top)]
  const FUND = [
    [5000, '💡 โคมไฟประดับ', [['floorlamp_blue', 8, 2], ['floorlamp_blue', 11, 2]]],
    [15000, '🍰 โต๊ะขนมเลี้ยงออฟฟิศ', [['table_light', 4, 6], ['cake_straw', 4, 6, 12], ['pizza', 5, 6, 12]]],
    [30000, '🕹️ ตู้เกม + ตู้กดน้ำ', [['dx_arcade', 19, 2], ['dx_cooler', 15, 2]]],
    [50000, '🧸 มุมบีนแบ็ก', [['dx_beanbag', 0, 8], ['dx_teddy', 2, 8]]],
  ];
  const FUND_AMT = [50, 200, 1000];
  const fundI = got => FUND.filter(f => got >= f[0]).length;
  let offPts = 0, offI = 0, fund = { got: 0, by: [] }, fundN = 0;
  const kindOf = n => (typeof SHOP_KIND !== 'undefined' && SHOP_KIND[n]) || (/^(window|pic|notice|tv|world|board|door|mirror|black)/.test(n) ? 'w' : /^rug/.test(n) ? 'r' : 'f');
  const GACHA = { x: 5, y: 2 };                 // the capsule machine (drawn by hand, 2 cells wide)
  const BASE_ITEMS = ROOM.items.slice(), blockedCells = new Set();
  function setItems(i = offI, f = fundN) {     // base room + every unlocked office level's furniture + this month's fund goals
    ROOM.items = BASE_ITEMS.concat(...OFFICE.slice(1, i + 1).map(o => o[2]), ...FUND.slice(0, f).map(o => o[2]));
    blockedCells.clear(); blockedCells.add(GACHA.x + ',' + GACHA.y); blockedCells.add((GACHA.x + 1) + ',' + GACHA.y);
    for (const [n, x, y, lift] of ROOM.items) if (kindOf(n) === 'f' && !lift) for (let k = 0; k < cellsW(n); k++) blockedCells.add((x + k) + ',' + y);
  }
  setItems(0);
  const free = (x, y) => x >= 0 && x < COLS && y >= TOP && y < ROWS && !blockedCells.has(x + ',' + y);
  function path(fx, fy, tx, ty) {               // BFS on the floor grid; [] when unreachable
    fx = Math.round(fx); fy = Math.round(fy); if (!free(tx, ty)) return [];
    const prev = new Map([[fx + ',' + fy, null]]), q = [[fx, fy]];
    while (q.length) { const [x, y] = q.shift(); if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (!prev.has(k) && free(nx, ny)) { prev.set(k, [x, y]); q.push([nx, ny]); } } }
    if (!prev.has(tx + ',' + ty)) return [];
    const out = []; for (let c = [tx, ty]; c && !(c[0] === fx && c[1] === fy); c = prev.get(c[0] + ',' + c[1])) out.unshift(c);
    return out;
  }
  // a walker follows its path cell by cell
  const walker = (x, y) => ({ x, y, path: [], dir: 'down', moving: false });
  function walk(a, dt) {
    a.moving = a.path.length > 0; if (!a.moving) return;
    const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), sp = 3.4 * dt;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (d <= sp) { a.x = tx; a.y = ty; a.path.shift(); } else { a.x += dx / d * sp; a.y += dy / d * sp; }
  }

  /* ---------- state ---------- */
  let el = null, cv, ctx, at, O = null, offset = 0, t = 0, last = 0, started = false;
  const me = walker(10, 8), others = {};       // others[sid] = walker + target
  const cele = {}, fx = [], banner = {};       // level-up celebrations: seen stamps, confetti, banners by sid
  let people = [], chatLog = [], G = { sc: 'lobby' }, music = null, D = null, TG = null, RN = null, sentT = 0, lastRes = 0;
  const now = () => Date.now() + offset;
  const visible = () => el && el.isConnected && !document.getElementById('hub').hidden;
  const myWho = () => (typeof meWho === 'function' ? meWho() : 'adam');
  const inRoom = p => p.g === 'hub';
  function roster() {                            // everyone in the room, by join order (same order on every client)
    const L = people.filter(inRoom);
    if (O && !L.some(p => p.id === O.mySid())) L.push({ id: O ? O.mySid() : 'me', me: true, n: myName() || 'ฉัน', a: myWho(), j: 0 });
    return L.sort((a, b) => (a.j || 0) - (b.j || 0) || (a.id < b.id ? -1 : 1));
  }
  const hostIsMe = () => { const L = roster().filter(p => p.v !== 0); return L.length && L[0].me; };
  function send(extra, force) {                 // presence write (throttled unless forced)
    const t0 = Date.now(); if (!O || (!force && t0 - sentT < 140)) return; sentT = t0;
    O.setPresence({ x: Math.round(me.path.length ? me.path[me.path.length - 1][0] : me.x), y: Math.round(me.path.length ? me.path[me.path.length - 1][1] : me.y), v: document.hidden ? 0 : 1, ...extra });
  }

  /* ---------- DOM ---------- */
  function build() {
    el = document.createElement('section'); el.className = 'room'; el.id = 'room';
    el.innerHTML = `<div class="room-stage"><div class="room-log" data-k="log"></div><div class="room-ov" data-k="ov"></div><div class="room-cnt" data-k="cnt" hidden></div><div class="room-res" data-k="res" hidden></div></div>
      <div class="room-pad" data-k="pad" hidden></div>
      <div class="room-bar"><input data-k="say" maxlength="80" placeholder="พิมพ์คุยกับเพื่อน แล้วกด Enter" aria-label="แชท">
        <span class="room-emo">${['👋', '😂', '👍', '🔥', '☕'].map(e => `<button class="btn sm" data-e="${e}">${e}</button>`).join('')}</span>
        <button class="btn sm primary" data-k="party">🎉 เล่นปาร์ตี้</button><button class="btn sm" data-k="invite" title="คัดลอกลิงก์ชวนเพื่อน">🔗 ชวน</button>
        <button class="btn sm" data-k="back" type="button" ${typeof Village !== 'undefined' && Village.on() ? '' : 'hidden'}>🚪 กลับหมู่บ้าน</button></div>`;
    const stage = el.querySelector('.room-stage'); ({ cv, ctx, at } = g2canvas(stage, W, H)); stage.insertBefore(cv.parentNode, stage.firstChild);
    const q = k => el.querySelector(`[data-k=${k}]`);
    cv.addEventListener('pointerdown', e => {
      const p = at(e), cx = Math.floor(p.x / C), cy = Math.floor(p.y / C);
      if (G.sc !== 'lobby') { if (G.sc === 'race') RN && (RN.jump = true); else if (G.sc === 'tug') tugTap(); return; }
      if (cy < TOP && cx >= 9 && cx <= 12 || cx >= STAGE.x0 && cx <= STAGE.x1 && cy >= STAGE.y0 && cy <= STAGE.y1 && e.detail > 1) return partyPicker();
      if (cy <= GACHA.y && cx >= GACHA.x && cx <= GACHA.x + 1 && typeof Gacha !== 'undefined') return Gacha.open();
      if (cy < TOP && cx >= 6 && cx <= 7 && typeof showRanking === 'function') return showRanking();
      goTo(cx, Math.max(TOP, cy));
    });
    const say = q('say');
    say.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { sayIt(say.value); say.value = ''; } if (e.key === 'Escape') say.blur(); });
    el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => sayIt(b.dataset.e));
    q('party').onclick = partyPicker;
    q('invite').onclick = invite;
    q('back').onclick = () => typeof Tower !== 'undefined' && Tower.setView('village');
    q('pad').addEventListener('pointerdown', e => { const b = e.target.closest('[data-d]'); if (!b) return; e.preventDefault(); padPress(b.dataset.d); });
    addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', () => send({}, true));
  }
  function goTo(x, y) {
    if (!free(x, y)) { // nearest free cell
      let best = null, bd = 99; for (let yy = TOP; yy < ROWS; yy++) for (let xx = 0; xx < COLS; xx++) if (free(xx, yy)) { const d = Math.abs(xx - x) + Math.abs(yy - y); if (d < bd) { bd = d; best = [xx, yy]; } }
      if (!best) return; [x, y] = best; }
    me.path = path(me.x, me.y, x, y); send({}, true);
  }
  function sayIt(m) {
    m = String(m || '').trim(); if (!m || !O) return;
    if (!myName()) { toast('✏️ ตั้งชื่อเล่นก่อนนะ แล้วค่อยคุย'); document.getElementById('nameIn')?.focus(); return; }
    O.chat(m, myName(), myWho()); typeof Stats !== 'undefined' && Stats.open('chat');
  }
  function invite() {
    const txt = `🎉 มาเล่นด้วยกันที่ห้องพักสมอง! ${G.sc !== 'lobby' && G.sc !== 'res' ? '(' + GAME_TH[G.sc] + ' กำลังเล่นอยู่) ' : ''}👉 ${shareURL('&join=room')}`;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('📋 คัดลอกลิงก์แล้ว ไปแปะในไลน์กลุ่มได้เลย')).catch(() => prompt('คัดลอกข้อความนี้', txt));
  }
  function onKey(e) {
    if (!visible() || e.target.closest && e.target.closest('input,textarea') || document.querySelector('.overlay')) return;
    if (G.sc === 'dance' && D) { const k = { ArrowLeft: 'l', ArrowUp: 'u', ArrowRight: 'r', ArrowDown: 'd', a: 'l', w: 'u', d: 'r', s: 'd' }[e.key];
      if (k && !e.repeat) { e.preventDefault(); danceKey(k); return; } if (e.key === ' ' && !e.repeat) { e.preventDefault(); danceSpace(); return; } }
    if (G.sc === 'tug' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) tugTap(); return; }
    if (G.sc === 'race' && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w')) { e.preventDefault(); if (!e.repeat && RN) RN.jump = true; return; }
    if (G.sc !== 'lobby') return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) { e.preventDefault(); const bx = Math.round(me.path.length ? me.path[me.path.length - 1][0] : me.x), by = Math.round(me.path.length ? me.path[me.path.length - 1][1] : me.y);
      if (free(bx + d[0], by + d[1]) && me.path.length < 2) { me.path.push([bx + d[0], by + d[1]]); send({}); } }
    else if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-k=say]').focus(); }
  }

  /* ---------- party games: shared ---------- */
  const GAME_TH = { dance: '🕺 เต้น', tug: '🪢 ชักเย่อ', race: '🏃 วิ่งไปตอกบัตร' };
  const LEAD = 4000, RES_MS = 9000;
  function partyPicker() {
    if (G.sc !== 'lobby') { toast(`${GAME_TH[G.sc] || 'เกม'} กำลังเล่นอยู่ — รอรอบหน้านะ`); return; }
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin"><h2>🎉 เล่นปาร์ตี้</h2><p class="muted">ทุกคนที่อยู่ในห้องปาร์ตี้ตอนนี้ (${roster().length} คน) จะเล่นด้วยกัน</p>
      <div class="pick">
        <div class="pk"><b>🕺 เต้น</b><small>กดลูกศรตาม แล้ว Space ตรงจังหวะ</small><span class="songs" data-k="songs">⏳</span></div>
        <button class="pk" data-g="tug" type="button"><b>🪢 ชักเย่อ</b><small>รัว Space · คนเดียวก็เล่นได้ (สู้หัวหน้า)</small></button>
        <button class="pk" data-g="race" type="button"><b>🏃 วิ่งไปตอกบัตร</b><small>วิ่งเอง กด Space กระโดดข้ามลัง</small></button>
      </div><div class="row"><button class="btn" data-x>ปิด</button></div></div>`;
    ov.onclick = e => { if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); };
    ov.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { ov.remove(); startParty(b.dataset.g); });
    document.body.appendChild(ov);
    loadMusic().then(M => { const s = ov.querySelector('[data-k=songs]'); if (!s) return;
      s.innerHTML = M.SONGS.map((g, i) => `<button class="btn sm" data-song="${i}">${g.level}</button>`).join('');
      s.querySelectorAll('[data-song]').forEach(b => b.onclick = () => { ov.remove(); startParty('dance', +b.dataset.song); }); });
  }
  let MUS = null;
  const loadMusic = () => MUS || (MUS = import('./dance-music.js?v=1').then(M => { music = M.createMusic(); music.muted = store.get('muted', false); return M; }));
  function startParty(kind, song = 0) {
    if (!O) return; if (music) music.unlock();
    const t0 = now(), seed = Math.floor(Math.random() * 1e9);
    O.txGame(cur => { if (cur && cur.sc && cur.sc !== 'lobby' && t0 - (cur.at || 0) < 180000) return; return { sc: kind, at: t0 + LEAD, by: myName() || 'ใครสักคน', seed, song }; })
      .then(r => { if (r.committed) { const nm = myName(); if (nm) O.pushFeed(`🎉 ${nm} เปิด${GAME_TH[kind]}ในห้องปาร์ตี้ มาเล่นด้วยกัน!`, nm, myWho()); } });
  }
  function onGame(st) {
    const prev = G.sc; G = st || { sc: 'lobby' };
    if (G.sc === 'res' && prev !== 'res' && prev !== 'lobby') { const k = { dance: D, tug: TG, race: RN }[prev]; if (k) dispatchEvent(new CustomEvent('hra-party', { detail: { kind: prev === 'race' ? 'chair' : prev } })); }
    if (G.sc === 'dance' && (!D || D.at !== G.at)) loadMusic().then(M => { D = { at: G.at, M, bar: -1, seq: [], idx: 0, judged: true, score: 0, combo: 0, maxc: 0, cnt: { PERFECT: 0, GREAT: 0, COOL: 0, BAD: 0, MISS: 0 }, last: null, wrongT: 0, done: false };
      music.play(songOf(), G.seed | 0, G.at, now); });
    if (G.sc !== 'dance' && music) music.stop();
    if (G.sc === 'tug' && (!TG || TG.at !== G.at)) TG = { at: G.at, taps: 0, last: 0 };
    if (G.sc === 'race' && (!RN || RN.at !== G.at)) RN = { at: G.at, p: -1.5, y: 0, vy: 0, v: 0, stun: 0, boost: 0, fin: 0, jump: false, got: {} };
    if (G.sc === 'lobby') { D = null; TG = null; RN = null; }
    // invite: a game just opened while I'm somewhere else on the site
    if (prev === 'lobby' && G.sc !== 'lobby' && G.sc !== 'res' && !visible() && G.by !== myName()) {
      if (typeof partyInvite === 'function') partyInvite(G, GAME_TH[G.sc]);
    }
    renderPad(); renderRes();
  }
  function renderPad() {
    const pad = el && el.querySelector('[data-k=pad]'); if (!pad) return; const k = G.sc;
    pad.hidden = !['dance', 'tug', 'race'].includes(k); if (pad.dataset.k === k) return; pad.dataset.k = k;
    pad.innerHTML = k === 'dance' ? '<button class="btn" data-d="l">←</button><button class="btn" data-d="u">↑</button><button class="btn" data-d="d">↓</button><button class="btn" data-d="r">→</button><button class="btn primary" data-d="sp">SPACE</button>'
      : k === 'tug' ? '<button class="btn primary wide" data-d="tug">💪 ดึง! <small>(Space)</small></button>' : k === 'race' ? '<button class="btn primary wide" data-d="jump">⤒ กระโดด <small>(Space)</small></button>' : '';
  }
  function padPress(d) { if (d === 'tug') tugTap(); else if (d === 'jump') RN && (RN.jump = true); else if (d === 'sp') danceSpace(); else danceKey(d); }
  function host() {
    if (!hostIsMe() || !O) return; const t0 = now();
    const end = (res, feed) => { const a = G.at, sc = G.sc; O.txGame(cur => { if (!cur || cur.sc !== sc || cur.at !== a) return; return { sc: 'res', g: sc, ...res, at: t0 }; })
      .then(r => { if (r.committed && feed) O.pushFeed(feed, '', ''); }); };
    if (G.sc === 'dance' && D && D.M && t0 > G.at + songOf().bars * barSec(songOf()) * 1000 + 2500) {
      const list = roster().map(p => ({ n: p.n, w: p.a, s: p.me ? D.score : p.da === G.at ? p.ds || 0 : 0, mc: p.me ? D.maxc : p.dmc || 0 })).sort((a, b) => b.s - a.s);
      end({ res: list, song: G.song | 0 }, list[0] && list[0].s > 0 ? `💃 ${list[0].n} ชนะการเต้นในห้องปาร์ตี้ (${list[0].s} คะแนน) จาก ${list.length} คน` : '');
    }
    if (G.sc === 'tug' && t0 > G.at) { const S = tugState(t0); if (Math.abs(S.d) >= TUG_GOAL || t0 > G.at + TUG_MS) { const win = S.d > 0 ? 'A' : S.d < 0 ? 'B' : '';
      const names = (win === 'A' ? S.A : S.B).map(x => x.n).join(', ');
      end({ win, bot: S.bot, res: [...S.A.map(x => ({ ...x, tm: 'A' })), ...S.B.map(x => ({ ...x, tm: 'B' }))] },
        win && !(S.bot && win === 'B') ? (S.bot ? `🪢 ${names} ดึงชักเย่อชนะหัวหน้า!` : `🪢 ทีม ${names} ชนะชักเย่อ`) : ''); } }
    if (G.sc === 'race' && t0 > G.at) { const rows = raceRows(), fins = rows.filter(r => r.fin).map(r => r.fin), first = fins.length ? Math.min(...fins) : 0;
      if (rows.length && (fins.length === rows.length || t0 > G.at + RACE_MAX || (first && t0 > G.at + first + 10000)))
        end({ res: rows.map(r => ({ n: r.n, w: r.w, fin: r.fin, p: Math.round(r.p) })) }, rows[0] && rows[0].fin ? `🏃 ${rows[0].n} วิ่งเข้าเส้นชัยที่ 1 (${(rows[0].fin / 1000).toFixed(1)} วิ) จาก ${rows.length} คน` : ''); }
    if (G.sc === 'res' && t0 > G.at + RES_MS) { const a = G.at; O.txGame(cur => { if (!cur || cur.sc !== 'res' || cur.at !== a) return; return { sc: 'lobby' }; }); }
    if (G.sc !== 'lobby' && G.sc !== 'res' && t0 > (G.at || 0) + 180000) O.txGame(() => ({ sc: 'lobby' }));   // safety net
  }
  function renderRes() {
    const r = el && el.querySelector('[data-k=res]'); if (!r) return;
    if (G.sc !== 'res') { r.hidden = true; return; } if (lastRes === G.at && !r.hidden) return; lastRes = G.at; r.hidden = false;
    const img = w => `<img src="assets/mi/${MI_PEOPLE.includes(w) ? w : 'adam'}_down.png" alt="">`, m = ['🥇', '🥈', '🥉'], L = G.res || [];
    let body = '';
    if (G.g === 'dance') body = `<h2>🕺 เต้น</h2><ol class="rank">${L.map((x, i) => `<li>${img(x.w)}<b>${esc(x.n)}</b><span>${m[i] || '#' + (i + 1)} ${x.s} · คอมโบ ${x.mc}</span></li>`).join('')}</ol>`;
    else if (G.g === 'tug') { const mvp = L.reduce((a, b) => !a || b.tp > a.tp ? b : a, null);
      body = `<h2>🪢 ชักเย่อ</h2><div class="big-res">${!G.win ? '🤝 เสมอ!' : G.bot ? (G.win === 'A' ? '🎉 ชนะหัวหน้า!' : '😅 หัวหน้าชนะ ลองใหม่!') : `🎉 ทีม${G.win === 'A' ? 'ซ้าย 🟦' : 'ขวา 🟥'}ชนะ!`}</div>
        <ol class="rank">${L.map(x => `<li>${img(x.w)}<b>${x.tm === 'A' ? '🟦' : '🟥'} ${esc(x.n)}</b><span>💪 ${x.tp}${x === mvp && L.length > 1 && x.tp ? ' ⭐MVP' : ''}</span></li>`).join('')}</ol>`; }
    else if (G.g === 'race') body = `<h2>🏃 วิ่งไปตอกบัตร</h2><ol class="rank">${L.map((x, i) => `<li>${img(x.w)}<b>${esc(x.n)}</b><span>${x.fin ? `${m[i] || '#' + (i + 1)} ${(x.fin / 1000).toFixed(1)} วิ` : `ยังไม่ถึง (${Math.max(0, Math.round(x.p / RACE_LEN * 100))}%)`}</span></li>`).join('')}</ol>`;
    r.innerHTML = `<div class="panel">${body}<p class="muted">กลับห้องปาร์ตี้ในไม่กี่วินาที</p></div>`;
  }

  /* ---------- 🕺 เต้น (same rules as the old 3D Office Audition) ---------- */
  const ARROW = { l: '←', u: '↑', r: '→', d: '↓' }, OPP = { l: 'r', r: 'l', u: 'd', d: 'u' };
  const JUDGE = [['PERFECT', 60, 100], ['GREAT', 110, 70], ['COOL', 170, 40], ['BAD', 250, 10]], JCOL = { PERFECT: '#ff5c8a', GREAT: '#ff9f1c', COOL: '#21c07a', BAD: '#7a6f8c', MISS: '#e23030' };
  const songOf = () => D && D.M ? D.M.SONGS[G.song | 0] || D.M.SONGS[0] : { bars: 0, bpm: 120 };
  const barSec = s => 240 / s.bpm;
  function drng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function seqFor(bar) {
    const song = songOf(), IB = D.M.INTRO_BARS, r = drng((G.seed | 0) * 7919 + bar * 104729), prog = (bar - IB) / Math.max(1, song.bars - IB - 1), lastBar = bar === song.bars - 1;
    const extra = song.level === 'ยาก' ? 2 : song.level === 'กลาง' ? 1 : 0, n = lastBar ? 8 : Math.min(8, 3 + Math.floor(prog * 3) + extra);
    const rev = song.level === 'ยาก' && prog > .3 ? .25 : song.level === 'กลาง' && prog > .6 ? .12 : 0;
    return Array.from({ length: n }, () => ({ d: 'lurd'[Math.floor(r() * 4)], rev: r() < rev }));
  }
  function judge(name, why = '') {
    const J = JUDGE.find(j => j[0] === name), lastBar = D.bar === songOf().bars - 1; D.judged = true; D.cnt[name]++;
    if (J && name !== 'BAD') { D.combo++; D.maxc = Math.max(D.maxc, D.combo); } else D.combo = 0;
    const pts = J ? Math.round(J[2] * (1 + Math.min(D.combo, 20) * .1) * (1 + D.seq.length / 8) * (lastBar ? 2 : 1)) : 0;
    D.score += pts; D.last = { j: name, t: now(), why }; music.blip(J && name !== 'BAD' ? (name === 'PERFECT' ? 'perfect' : 'ok') : 'bad');
    send({ ds: D.score, dc: D.combo, dmc: D.maxc, da: G.at, dj: name }, true);
  }
  function danceKey(k) { if (!D || D.judged || D.bar < D.M.INTRO_BARS) return; const a = D.seq[D.idx]; if (!a) return;
    if (k === (a.rev ? OPP[a.d] : a.d)) { D.idx++; music.blip('ok'); } else { D.idx = 0; D.wrongT = now(); music.blip('bad'); } }
  function danceSpace() { if (!D || D.judged || D.bar < D.M.INTRO_BARS) return; if (D.idx < D.seq.length) return judge('MISS', 'ลูกศรยังไม่ครบ');
    const st = (now() - G.at) / 1000, err = Math.abs(st - (D.bar * 4 + 3) * barSec(songOf()) / 4) * 1000, j = JUDGE.find(j => err <= j[1]); judge(j ? j[0] : 'MISS', j ? '' : 'ไม่ตรงจังหวะ'); }
  function danceTick() {
    if (!D || !D.M) return; const song = songOf(), bs = barSec(song), st = (now() - G.at) / 1000, bar = Math.floor(st / bs), IB = D.M.INTRO_BARS;
    if (st >= 0) { if (bar >= IB && bar < song.bars && bar !== D.bar) { if (!D.judged && D.bar >= IB) judge('MISS', 'ช้าไป'); D.bar = bar; D.seq = seqFor(bar); D.idx = 0; D.judged = false; }
      if (!D.judged && D.bar >= IB && st > (D.bar * 4 + 3) * bs / 4 + .25) judge('MISS', 'ช้าไป');
      if (st >= song.bars * bs && !D.done) { D.done = true; const nm = myName(); if (nm && D.score > 0) loadOnline().then(R => R.submit('dance', nm, D.score, `Perfect ${D.cnt.PERFECT} · คอมโบ ${D.maxc}`, Prog.get().lv)).catch(() => {}); } }
    const ov = el.querySelector('[data-k=ov]'), ph = st < 0 ? 0 : (st % bs) / bs, inPlay = D.bar >= IB && st < song.bars * bs;
    const arrows = inPlay ? D.seq.map((a, i) => `<span class="ar${i < D.idx ? ' ok' : ''}${a.rev ? ' rev' : ''}">${ARROW[a.d]}</span>`).join('') : `<span class="muted">${st < IB * bs ? 'เตรียมตัว… ♪' : 'จบเพลง!'}</span>`;
    const L = D.last && now() - D.last.t < 900 ? `<div class="judge" style="color:${JCOL[D.last.j]}">${D.last.j}${D.combo > 1 && D.last.j !== 'MISS' && D.last.j !== 'BAD' ? ` <small>x${D.combo}</small>` : ''}${D.last.why ? `<small class="why">${D.last.why}</small>` : ''}</div>` : '';
    ov.innerHTML = `<div class="dpanel">${L}<div class="drow${now() - D.wrongT < 250 ? ' shake' : ''}">${arrows}</div><div class="beat"><i style="left:${ph * 100}%"></i><b style="left:75%"></b></div>
      <div class="dstat">⭐ ${D.score} · คอมโบ ${D.combo} · 🎵 ${song.th} (${song.level})</div></div>`;
    countdown(st, `🎵 กดลูกศรตามให้ครบ แล้วกด Space ตอนเข็มถึงเส้นจังหวะที่ 4`);
  }

  /* ---------- 🪢 ชักเย่อ ---------- */
  const TUG_MS = 30000, TUG_GOAL = 28, botTaps = s => s <= 0 ? 0 : 3.6 * s + .04 * s * s;
  function tugState(t0) {
    const L = roster(), A = [], B = []; L.forEach((p, i) => (i % 2 ? B : A).push({ id: p.id, me: p.me, n: p.n, w: p.a, tp: p.me ? (TG ? TG.taps : 0) : p.ta === G.at ? p.tp || 0 : 0 }));
    const s = (t0 - G.at) / 1000, avg = X => X.length ? X.reduce((a, b) => a + b.tp, 0) / X.length : 0, bot = B.length === 0, b = bot ? botTaps(Math.min(s, TUG_MS / 1000)) : avg(B);
    return { A, B, bot, botN: Math.round(b), d: avg(A) - b, k: Math.max(-1, Math.min(1, (avg(A) - b) / TUG_GOAL)) };
  }
  function tugTap() { const t0 = now(); if (!TG || t0 < G.at || t0 > G.at + TUG_MS || t0 - TG.last < 45) return; TG.taps++; TG.last = t0; music && music.blip('ok'); send({ tp: TG.taps, ta: G.at }); }
  function tugTick(S) {
    const st = (now() - G.at) / 1000, left = Math.max(0, Math.ceil(TUG_MS / 1000 - Math.max(0, st))), mineA = S.A.some(x => x.me);
    el.querySelector('[data-k=ov]').innerHTML = `<div class="dpanel"><div class="tugbar"><span>🟦 ซ้าย</span><div class="tb"><i style="left:${50 - S.k * 50}%"></i></div><span>${S.bot ? 'หัวหน้า 🟥' : 'ขวา 🟥'}</span></div>
      <div class="dstat">คุณอยู่ทีม${mineA ? 'ซ้าย 🟦' : 'ขวา 🟥'} · 💪 ${TG ? TG.taps : 0} ครั้ง · ⏱ ${left} วิ</div></div>`;
    countdown(st, `🪢 รัว Space (หรือปุ่ม 💪 ดึง!) ให้เชือกเข้าฝั่งเรา${S.bot ? ' · คุณสู้กับหัวหน้า!' : ''}`, 'ดึง!');
  }

  /* ---------- 🏃 วิ่งไปตอกบัตร: own lane each, auto-run, jump the boxes, grab the snacks ---------- */
  const RACE_LEN = 150, RACE_MAX = 75000, RUN_V = 6.5, BOOST_V = 9.5;
  const raceObs = () => { const r = drng((G.seed | 0) + 17), o = []; for (let x = 12; x < RACE_LEN - 6; x += 5 + Math.floor(r() * 6)) o.push({ x, k: r() < .35 ? 'snack' : 'box' }); return o; };
  let OBS = null, OBS_AT = 0;
  function raceRows() {
    return roster().map(p => ({ id: p.id, me: p.me, n: p.n, w: p.a, p: p.me ? (RN ? RN.p : 0) : p.ra === G.at ? p.rp || 0 : 0, y: p.me ? (RN ? RN.y : 0) : p.ra === G.at ? p.ry || 0 : 0, fin: p.me ? (RN ? RN.fin : 0) : p.ra === G.at ? p.rf || 0 : 0 }))
      .sort((a, b) => a.fin && b.fin ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : b.p - a.p);
  }
  function raceTick(dt) {
    if (!RN) return; if (OBS_AT !== G.at) { OBS = raceObs(); OBS_AT = G.at; }
    const st = (now() - G.at) / 1000, go = st >= 0 && !RN.fin;
    if (RN.jump && go && RN.y <= 0) { RN.vy = 9; music && music.blip('ok'); } RN.jump = false;
    RN.vy -= 26 * dt; RN.y = Math.max(0, RN.y + RN.vy * dt); if (RN.y === 0) RN.vy = 0;
    RN.stun = Math.max(0, RN.stun - dt); RN.boost = Math.max(0, RN.boost - dt);
    const target = !go ? 0 : RN.stun > 0 ? 1.5 : RN.boost > 0 ? BOOST_V : RUN_V; RN.v += (target - RN.v) * Math.min(1, dt * 4); RN.p += RN.v * dt;
    if (go) OBS.forEach((o, i) => { if (RN.got[i] || Math.abs(RN.p - o.x) > .45) return;
      if (o.k === 'box' && RN.y < .55) { RN.got[i] = 1; RN.stun = .7; RN.v *= .3; music && music.blip('bad'); }
      if (o.k === 'snack' && RN.y >= .9) { RN.got[i] = 1; RN.boost = 1.6; music && music.blip('perfect'); } });
    if (!RN.fin && RN.p >= RACE_LEN) { RN.fin = Math.round(now() - G.at); toast(`🏁 ตอกบัตรทัน! ${(RN.fin / 1000).toFixed(1)} วิ`); }
    send({ rp: +RN.p.toFixed(1), ry: +RN.y.toFixed(2), rf: RN.fin, ra: G.at });
    const rows = raceRows(), i = rows.findIndex(r => r.me);
    el.querySelector('[data-k=ov]').innerHTML = `<div class="kt">🏃 อันดับ ${i + 1}/${rows.length} · ${Math.min(100, Math.max(0, Math.round(RN.p / RACE_LEN * 100)))}% · ⏱ ${Math.max(0, (RN.fin || now() - G.at) / 1000).toFixed(1)}${RN.boost > 0 ? ' · 🍰 BOOST' : ''}</div>`;
    countdown(st, '🏃 วิ่งเอง! กด Space กระโดดข้าม 📦 · กระโดดเก็บ 🍰 = เร่ง');
  }
  function drawRace() {
    const rows = roster(), lanes = Math.max(2, Math.min(6, rows.length)), lh = H / lanes, myP = RN ? RN.p : 0, camX = myP * C - 150;
    const R = raceRows(); const show = R.filter(r => r.me).concat(R.filter(r => !r.me)).slice(0, lanes);
    show.sort((a, b) => rows.findIndex(p => p.id === a.id) - rows.findIndex(p => p.id === b.id));
    ctx.fillStyle = '#efe3cf'; ctx.fillRect(0, 0, W, H);
    show.forEach((r, li) => {
      const y0 = li * lh, gy = y0 + lh - 8, k = Math.min(2, (lh - 14) / 32);
      ctx.fillStyle = li % 2 ? '#e7d6bb' : '#f3e7d3'; ctx.fillRect(0, y0, W, lh);
      ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.fillRect(0, gy, W, 2);
      for (let x = Math.floor(camX / C / 4) * 4; x * C - camX < W; x += 4) { ctx.fillStyle = 'rgba(43,33,64,.08)'; ctx.fillRect(x * C - camX, y0 + 4, 2, lh - 8); }
      const fx = RACE_LEN * C - camX; if (fx < W + 20) for (let j = 0; j < lh / 8; j++) { ctx.fillStyle = j % 2 ? '#fff' : '#2b2140'; ctx.fillRect(fx, y0 + j * 8, 8, 8); ctx.fillStyle = j % 2 ? '#2b2140' : '#fff'; ctx.fillRect(fx + 8, y0 + j * 8, 8, 8); }
      (OBS || []).forEach((o, i) => { const sx = o.x * C - camX; if (sx < -40 || sx > W + 40) return; if (r.me && RN && RN.got[i] && o.k === 'snack') return;
        if (o.k === 'box') drawPixAt(ctx, 'crate', sx, gy, k); else drawPixAt(ctx, 'cake_straw', sx, gy - lh * .5, k * 1.1); });
      const px = r.p * C - camX, py = gy - r.y * C * .9;
      drawChar(ctx, MI_PEOPLE.includes(r.w) ? r.w : 'adam', 'run', 'right', t + li * .1, px, py, k);
      tag(Math.max(30, Math.min(W - 30, px)), py - 32 * k - 4, (r.me ? '★ ' : '') + r.n + (r.fin ? ' 🏁' : ''), r.me);
    });
    ctx.textAlign = 'start';
  }
  function countdown(st, msg, go = 'GO!') {
    const c = el.querySelector('[data-k=cnt]');
    if (st < 0) { c.hidden = false; c.innerHTML = `<b>${Math.ceil(-st)}</b><span>${msg}</span>`; } else if (st < 1) { c.hidden = false; c.innerHTML = `<b>${go}</b>`; } else c.hidden = true;
  }

  /* ---------- drawing the room ---------- */
  function bubble(x, y, text) {
    ctx.font = '600 12px Kanit,"Leelawadee UI",sans-serif'; const w = Math.min(180, ctx.measureText(text).width + 14), h = 20, bx = Math.max(2, Math.min(W - w - 2, x - w / 2)), by = y - h - 6;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, by + h); ctx.lineTo(x, by + h + 5); ctx.lineTo(x + 4, by + h); ctx.fill();
    ctx.fillStyle = '#2b2140'; ctx.textAlign = 'center'; ctx.fillText(text.length > 28 ? text.slice(0, 27) + '…' : text, bx + w / 2, by + 14); ctx.textAlign = 'start';
  }
  function draw() {
    if (G.sc === 'race') return drawRace();
    officeBG(ctx, W, H, TOP * C, { wall: ROOM.wall, floor: ROOM.floor, k: 2, calm: .15 });
    // stage
    ctx.save(); ctx.fillStyle = G.sc === 'lobby' || G.sc === 'res' ? 'rgba(255,92,138,.16)' : `hsla(${(t * 90) % 360},80%,65%,.3)`;
    ctx.strokeStyle = 'rgba(255,92,138,.75)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(STAGE.x0 * C + 2, STAGE.y0 * C + 2, (STAGE.x1 - STAGE.x0 + 1) * C - 4, (STAGE.y1 - STAGE.y0 + 1) * C - 4, 12); ctx.fill(); ctx.stroke(); ctx.restore();
    if (G.sc === 'lobby') { ctx.font = '600 12px Kanit,sans-serif'; ctx.fillStyle = 'rgba(214,51,108,.8)'; ctx.textAlign = 'center'; ctx.fillText('🎉 เวทีปาร์ตี้ · กดปุ่ม 🎉 เล่นปาร์ตี้', (STAGE.x0 + STAGE.x1 + 1) / 2 * C, STAGE.y0 * C + 18); ctx.textAlign = 'start'; }
    const list = [];
    for (const [n, x, y, lift = 0] of ROOM.items) { const k = kindOf(n), cx = (x + cellsW(n) / 2) * C, im = typeof itemImg === 'function' ? itemImg(n) : n;
      if (k === 'w') drawPixAt(ctx, im, cx, TOP * C - 6, 2); else if (k === 'r') drawPixAt(ctx, im, cx, (y + 1) * C, 2); else list.push({ y: y + 1 + (lift ? .01 : 0), d: () => drawPixAt(ctx, im, cx, (y + 1) * C - lift * 2, 2) }); }
    list.push({ y: GACHA.y + 1, d: drawGacha });
    // people: on the stage during a game, otherwise where they walked to
    const L = roster(), chatBy = {}; for (const m of chatLog) if (now() - m.t < 6000) chatBy[m.s] = m.m;
    let slots = null;
    if (G.sc === 'tug') { const S = tugState(now()), off = -S.k * 2.2, cy = (STAGE.y0 + STAGE.y1) / 2 + .6; slots = {};
      S.A.forEach((p, i) => slots[p.id] = { x: 10.5 + off - 1.2 - i * .9, y: cy + (i % 2 ? .25 : -.1), dir: 'right' });
      S.B.forEach((p, i) => slots[p.id] = { x: 10.5 + off + 1.2 + i * .9, y: cy + (i % 2 ? .25 : -.1), dir: 'left' });
      const ry = (cy + 1) * C - 20; list.push({ y: cy + 1.05, d: () => { ctx.strokeStyle = '#a5683f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo((5.5 + off) * C, ry); ctx.lineTo((15.5 + off) * C, ry); ctx.stroke();
        ctx.fillStyle = '#ff4d4d'; ctx.fillRect((11 + off) * C - 3, ry, 6, 12); } });
      if (S.bot) list.push({ y: cy + 1, d: () => { drawChar(ctx, 'bob', 'idle_anim', 'left', t * 2, (10.5 + off + 1.2) * C + C / 2, (cy + 1) * C, 2); tag((10.5 + off + 1.7) * C, (cy + 1) * C - 64, 'หัวหน้า 🤖', false); } });
      tugTick(S); }
    if (G.sc === 'dance') { slots = {}; L.forEach((p, i) => slots[p.id] = { x: STAGE.x0 + .3 + (i % 4) * 1.5 + (Math.floor(i / 4) % 2) * .75, y: STAGE.y0 - .4 + Math.floor(i / 4) * 1.1, dir: 'down', bob: true }); danceTick(); }
    if (G.sc === 'lobby' || G.sc === 'res') el.querySelector('[data-k=ov]').innerHTML = '', el.querySelector('[data-k=cnt]').hidden = true;
    for (const p of L) {
      const a = p.me ? me : others[p.id]; if (!a) continue; const s = slots && slots[p.id];
      const x = s ? s.x : a.x, y = s ? s.y : a.y, who = MI_PEOPLE.includes(p.me ? myWho() : p.a) ? (p.me ? myWho() : p.a) : 'adam';
      const bounce = s && s.bob && D && D.M ? Math.abs(Math.sin((now() - G.at) / 1000 * Math.PI * songOf().bpm / 60)) * 6 : 0;
      const pulling = G.sc === 'tug' && (p.me ? TG && now() - TG.last < 150 : false);
      list.push({ y: y + 1.01, d: () => {
        ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.beginPath(); ctx.ellipse((x + .5) * C, (y + 1) * C - 2, 11, 4, 0, 0, 7); ctx.fill();
        const an = s ? 'idle_anim' : a.moving ? 'run' : 'idle_anim', dr = s ? s.dir : a.dir, tt = t + (p.j || 0) % 7, px = (x + .5) * C + (pulling ? (s.dir === 'right' ? -2 : 2) : 0), py = (y + 1) * C - bounce;
        drawChar(ctx, who, an, dr, tt, px, py, 2);
        for (const sl of ['f', 'h']) drawAcc(ctx, p.me ? Wardrobe.eq(sl) : p[sl], who, an, dr, tt, px, py, 2);
        tag((x + .5) * C, (y + 1) * C - 66 - bounce, (p.me ? '★ ' : '') + ((p.me ? (typeof Gacha !== 'undefined' && badgeEmoji(Gacha.eq())) : p.b && typeof badgeEmoji === 'function' && badgeEmoji(p.b)) || '') + (p.n || '?') + (p.lv && !s ? ` Lv${p.lv}` : ''), p.me);
        const bn = banner[p.id] && banner[p.id].until > now() ? banner[p.id].m : '';
        if (bn && !chatBy[p.id]) { ctx.save(); ctx.globalAlpha = .55 + .45 * Math.sin(t * 6); ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) { const an = t * 3 + i * 1.57; ctx.fillRect(px + Math.cos(an) * 18 - 2, py - 30 + Math.sin(an) * 22 - 2, 4, 4); } ctx.restore(); }
        const said = chatBy[p.id] || bn;
        if (said) bubble((x + .5) * C, (y + 1) * C - 80 - bounce, said);
      } });
    }
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    drawFx();
  }
  // confetti in room pixels
  function burst(x, y, n = 40) { const cols = ['#ffd23f', '#ff5c8a', '#3a86ff', '#21c07a', '#fff'];
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 160; fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, c: cols[i % 5], l: 1.4 + Math.random() }); } }
  function drawFx() { for (const f of fx) { ctx.fillStyle = f.c; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); } }
  function tickFx(dt) { for (const f of fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; f.l -= dt; } for (let i = fx.length - 1; i >= 0; i--) if (fx[i].l <= 0) fx.splice(i, 1); }
  // someone levelled up (presence u = when) → confetti + a banner over their head the first time we see them in the room
  function celebrate(L) {
    for (const p of L) { const u = p.me ? (Prog.get().lvT || 0) : p.u; if (!u || cele[p.id] === u) continue; cele[p.id] = u;
      if (Date.now() - u > 600000) continue;
      const a = p.me ? me : others[p.id]; if (!a) continue; const lv = p.me ? Prog.get().lv : p.lv | 0, nt = Prog.title(lv) !== Prog.title(lv - 1);
      banner[p.id] = { until: now() + 6000, m: nt ? `🎉 ได้ฉายา ${Prog.title(lv)}!` : `🎉 เลื่อนขั้น Lv ${lv}!` };
      burst((a.x + .5) * C, (a.y + .2) * C, nt ? 70 : 40); if (visible() && typeof SFX !== 'undefined' && SFX.level) SFX.level(); } }
  // capsule machine: red body, glass dome of coloured capsules, a sign; sparkles when today's free pull is waiting
  function drawGacha() {
    const x = GACHA.x * C + 8, w = 2 * C - 16, by = (GACHA.y + 1) * C, free = typeof Gacha !== 'undefined' && Gacha.freeToday();
    ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.beginPath(); ctx.ellipse(x + w / 2, by - 2, w / 2, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8384f'; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, by - 34, w, 32, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2140'; ctx.fillRect(x + 8, by - 24, 12, 8); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + w - 13, by - 20, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(220,240,255,.9)'; ctx.beginPath(); ctx.arc(x + w / 2, by - 50, 20, Math.PI, 0); ctx.lineTo(x + w / 2 + 20, by - 34); ctx.lineTo(x + w / 2 - 20, by - 34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ['#ff5c8a', '#3a86ff', '#ffd23f', '#21c07a', '#a06cff', '#ff9f1c'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + w / 2 - 12 + (i % 3) * 12, by - 40 - Math.floor(i / 3) * 10, 5, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#2b2140'; ctx.fillRect(x + w / 2 - 22, by - 74, 44, 4);
    tag(x + w / 2, by - 76, free ? '🎁 กาชาฟรี!' : '🎰 กาชา', free);
    if (free) { ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; ctx.fillRect(x + w / 2 + Math.cos(a) * 26 - 2, by - 50 + Math.sin(a) * 18 - 2, 4, 4); } }
  }
  function tag(x, y, text, mine) {
    ctx.font = '600 11px Kanit,"Leelawadee UI",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
    ctx.strokeText(text, x, y); ctx.fillStyle = mine ? '#d6336c' : '#2b2140'; ctx.fillText(text, x, y); ctx.textAlign = 'start';
  }
  function renderLog() {
    const L = chatLog.filter(m => now() - m.t < 120000).slice(-4), lg = el.querySelector('[data-k=log]');
    const html = L.map(m => `<div><b>${esc(m.n)}</b> ${esc(m.m)}</div>`).join(''); if (lg.innerHTML !== html) lg.innerHTML = html;
  }

  /* ---------- loop + network ---------- */
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; if (!visible()) return; t += dt;
    walk(me, dt);
    for (const p of people) { if (p.me || !inRoom(p)) continue; let o = others[p.id];
      if (!o) { o = others[p.id] = walker(p.x ?? 10, p.y ?? 7); o.tx = p.x; o.ty = p.y; }
      if (p.x != null && (o.tx !== p.x || o.ty !== p.y)) { o.tx = p.x; o.ty = p.y; o.path = path(o.x, o.y, p.x, p.y); if (!o.path.length) { o.x = p.x; o.y = p.y; } }
      walk(o, dt); }
    if (G.sc === 'race') raceTick(dt);
    tickFx(dt); if (G.sc === 'lobby') celebrate(roster());
    draw(); host(); renderLog(); renderRes();
    if (G.sc === 'tug' && TG) send({ tp: TG.taps, ta: G.at });
  }
  function onOffice(pts) {
    const o = officeLv(pts), seen = store.get('offLv', 0); offPts = pts;
    if (o.i !== offI) { offI = o.i; setItems(o.i); }
    if (seen && o.lv > seen) {                    // the office levelled up since we last looked: everyone gets a gift
      const p = Prog.get(); p.coins += 20 * (o.lv - seen); store.set('prog', p); Prog.sync(); typeof Stats !== 'undefined' && Stats.econ('in_office', 20 * (o.lv - seen));
      toast(`🏢 ออฟฟิศเลเวลอัป! Lv ${o.lv} · ห้องปาร์ตี้ได้ ${o.cur.n} (+${20 * (o.lv - seen)} 🪙 ของขวัญทุกคน)`);
      if (visible()) for (let i = 0; i < 5; i++) burst(W * (i + .5) / 5, H * .4, 30);
    }
    store.set('offLv', o.lv); renderOffice();
  }
  function onFund(v) {
    const n = fundI(v.got), was = fundN; fund = v;
    if (n !== fundN) { fundN = n; setItems(); }
    if (n > was && store.get('fundSeen', '') === v.m + ':' + was && visible()) {   // a goal was reached while we watched
      toast(`💰 กองทุนออฟฟิศครบเป้า! ห้องปาร์ตี้ได้ ${FUND[n - 1][1]} ถึงสิ้นเดือน`); for (let i = 0; i < 5; i++) burst(W * (i + .5) / 5, H * .4, 30);
    }
    store.set('fundSeen', v.m + ':' + n); renderOffice();
    const pn = document.querySelector('.office-p[data-tab=fund]'); if (pn) fundTab(pn);
  }
  const itemSrc = n => typeof drawnItem === 'function' && drawnItem(n) ? itemCanvas(n, 2).toDataURL() : `assets/mi/${n}.png`;
  const ico = it => it.filter(x => !x[3]).concat(it.filter(x => x[3])).slice(0, 2).map(([n]) => `<img class="pxi" src="${itemSrc(n)}" alt="" height="26">`).join('');
  const showCoins = () => { const m = document.querySelector('.me-coins'); if (m) m.textContent = `🪙 ${fmt(Prog.get().coins)}`; };
  async function give(n, btn) {
    const nm = myName(); if (!nm) { toast('ตั้งชื่อก่อนนะ (มุมขวาบน)'); return; }
    const p = Prog.get(); if (p.coins < n) { toast(`เหรียญไม่พอ (มี 🪙 ${fmt(p.coins)})`); return; }
    if (!O) { toast('ยังต่อออนไลน์ไม่ได้ ลองใหม่อีกที'); return; }
    p.coins -= n; Prog.put(p); showCoins();
    btn.disabled = true;
    try {
      const r = await O.fundGive(n, nm); if (!r) throw 0;
      typeof Stats !== 'undefined' && Stats.econ('out_fund', n);
      toast(`💰 ขอบคุณที่ลง 🪙 ${fmt(n)} เข้ากองทุนออฟฟิศ!`);
      const a = fundI(r.before), b = fundI(r.after);
      if (b > a) O.pushFeed(`💰 กองทุนออฟฟิศครบเป้า ${FUND[b - 1][1]}! ขอบคุณ ${nm} ที่ช่วยปิดยอด`, nm, myAva());
    } catch (e) { const q = Prog.get(); q.coins += n; Prog.put(q); showCoins(); toast('ลงเหรียญไม่สำเร็จ เหรียญคืนแล้ว'); }
    btn.disabled = false;
  }
  function fundTab(panel) {
    const el = panel.querySelector('[data-k=body]'), got = fund.got, i = fundN, nx = FUND[i], from = i ? FUND[i - 1][0] : 0;
    const pc = nx ? Math.min(100, (got - from) / (nx[0] - from) * 100) : 100, me = (myName() || '').trim().toLowerCase(), coins = Prog.get().coins;
    const mon = typeof seasonName === 'function' && fund.m ? seasonName(fund.m) : 'เดือนนี้';
    el.innerHTML = `<h2>💰 กองทุนออฟฟิศ</h2><p class="muted">ลงเหรียญได้ตามใจ ไม่บังคับ · ครบเป้าแล้วห้องปาร์ตี้ได้ของแต่งถึงสิ้นเดือน · ยอดเริ่มใหม่ทุกต้นเดือน · ท็อป 3 ผู้สนับสนุนได้ถ้วยไปวางในห้อง (ลงรวมอย่างน้อย 🪙 100)</p>
      <div class="fund-sum"><b>${mon}: 🪙 ${fmt(got)}</b><span class="xpbar"><i style="width:${pc}%"></i></span><small>${nx ? `อีก 🪙 ${fmt(nx[0] - got)} → ${nx[1]}` : '🎉 ครบทุกเป้าแล้ว!'}</small></div>
      <ul class="off-list fund-list">${FUND.map((r, k) => `<li class="${k < i ? 'ok' : k === i ? 'nx' : ''}"><span>${ico(r[2])}</span><b>${r[1]}</b><small>${k < i ? '✅ ได้แล้ว' : `🪙 ${fmt(r[0])}`}</small></li>`).join('')}</ul>
      <div class="row fund-give">${FUND_AMT.map(a => `<button type="button" class="btn${a > coins ? '' : ' primary'}" data-give="${a}">ลง 🪙 ${fmt(a)}</button>`).join('')}</div>
      <h3>ผู้สนับสนุนเดือนนี้</h3><ol class="off-top">${fund.by.length ? fund.by.slice(0, 5).map(r => `<li${r.n.trim().toLowerCase() === me ? ' class="me"' : ''}><b>${esc(r.n)}</b> <span>🪙 ${fmt(r.p)}</span></li>`).join('') : '<li class="muted">ยังไม่มีใครลง — เป็นคนแรกเลย!</li>'}</ol>`;
    el.querySelectorAll('[data-give]').forEach(b => b.onclick = () => {     // tap once to arm, again to confirm
      const n = +b.dataset.give;
      if (b.dataset.arm) { delete b.dataset.arm; give(n, b).then(() => panel.isConnected && fundTab(panel)); return; }
      el.querySelectorAll('[data-arm]').forEach(x => { delete x.dataset.arm; x.textContent = `ลง 🪙 ${fmt(+x.dataset.give)}`; });
      b.dataset.arm = 1; b.textContent = `ยืนยันลง 🪙 ${fmt(n)}?`; });
  }
  // the office bar above the room (the hub renders an empty #offBar)
  function renderOffice() {
    const b = document.getElementById('offBar'); if (!b) return; const o = officeLv(offPts), pc = Math.min(100, (offPts - o.from) / (o.to - o.from) * 100);
    b.innerHTML = `🏢 <b>ออฟฟิศ Lv ${o.lv}</b><span class="xpbar"><i style="width:${pc}%"></i></span><small>${fmt(offPts - o.from)}/${fmt(o.to - o.from)}${o.next ? ` · ต่อไป ${o.next.n}` : ''}</small><span class="fund-pill" data-fund>💰 กองทุน 🪙 ${fmt(fund.got)}</span>`;
    b.onclick = e => officePanel(e.target.closest('[data-fund]') ? 'fund' : 'lv');
  }
  function officePanel(tab) {
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="panel popin office-p"><div class="seg off-tabs"><button type="button" data-tab="lv">🏢 เลเวลออฟฟิศ</button><button type="button" data-tab="fund">💰 กองทุนออฟฟิศ</button></div>
      <div data-k="body"></div><div class="row"><button class="btn primary" data-x>ปิด</button></div></div>`;
    const panel = ov.firstElementChild;
    const show = t => { panel.dataset.tab = t; panel.querySelectorAll('.off-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); t === 'fund' ? fundTab(panel) : lvTab(panel); };
    ov.onclick = e => { const b = e.target.closest('.off-tabs [data-tab]'); if (b) show(b.dataset.tab); if (e.target === ov || e.target.closest('[data-x]')) ov.remove(); };
    document.body.appendChild(ov); show(tab === 'fund' ? 'fund' : 'lv');
  }
  function lvTab(panel) {
    const o = officeLv(offPts), el = panel.querySelector('[data-k=body]');
    el.innerHTML = `<h2>🏢 ออฟฟิศ Lv ${o.lv}</h2>
      <p class="muted">ทุกเหรียญที่ใครก็ได้หาได้ จะนับเป็นแต้มออฟฟิศด้วย · ครบเป้าแล้วห้องปาร์ตี้ได้ของใหม่ถาวร และทุกคนได้ของขวัญ 20 🪙</p>
      <ul class="off-list">${OFFICE.slice(1).map((r, i) => `<li class="${i + 1 <= o.i ? 'ok' : i === o.i ? 'nx' : ''}"><span>${ico(r[2])}</span><b>${r[1]}</b><small>${i + 1 <= o.i ? '✅ ได้แล้ว' : `${fmt(r[0])} แต้ม`}</small></li>`).join('')}</ul>
      <h3>คนช่วยเยอะสุด</h3><ol class="off-top" data-k="top"><li class="muted">กำลังโหลด…</li></ol>`;
    O && O.officeBoard().then(L => { const me = (myName() || '').trim().toLowerCase(), el2 = el.querySelector('[data-k=top]'); if (!el2) return;
      el2.innerHTML = L.length ? L.slice(0, 5).map(r => `<li${r.n.trim().toLowerCase() === me ? ' class="me"' : ''}><b>${esc(r.n)}</b> <span>${fmt(r.p)} แต้ม</span></li>`).join('') : '<li class="muted">ยังไม่มีใคร — เล่นเกมสักตาเลย!</li>'; }).catch(() => {});
  }
  function start() {
    if (started) return; started = true;
    // spawn on a free cell near the bottom middle
    for (let i = 0; i < 40; i++) { const x = 5 + Math.floor(Math.random() * 12), y = 7 + Math.floor(Math.random() * 2); if (free(x, y)) { me.x = x; me.y = y; break; } }
    loadOnline().then(M => { O = M; M.watchOffset(v => offset = v); send({}, true);
      M.watchOnline(l => { people = l; for (const id of Object.keys(others)) if (!l.some(p => p.id === id && inRoom(p))) delete others[id]; });
      M.watchChat(l => chatLog = l); M.pruneChat().catch(() => {}); M.watchGame(onGame);
      M.watchOffice(onOffice); M.watchFund(onFund);
    }).catch(() => {});
    requestAnimationFrame(frame);
  }
  return {
    // returns the room element (built once, so the hub can re-render around it)
    mount(slot) { if (!el) build(); slot.replaceWith(el); start(); setTimeout(() => cv.dispatchEvent(new Event('resize')), 0); },
    send: () => send({}, true), picker: () => partyPicker(), get G() { return G; }, invite, officeLv, renderOffice, officePanel, officeNow: () => officeLv(offPts),
    // test hooks
    _dbg: { me, get D() { return D; }, get TG() { return TG; }, get RN() { return RN; }, tug: () => tugTap(), start: startParty, roster, office: onOffice, burst },
  };
})();
