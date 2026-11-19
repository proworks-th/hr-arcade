// "ดันเจี้ยนใต้ตึก" — endless daily dungeon for the arcade (Phase 1B of GDD §12 v2; owner decisions 12 Nov 2026:
// endless floors, a new random map every day, no room locks but a floor must be cleared before its door opens,
// floor size set by the floor's purpose, an organised engine that the new map can reuse).
// Files: data.js (every number) · engine.js (grid, flow field, camera, fog, minimap) · gen.js (floors) · this file (play).
// Contract: Dungeon.mount(root, api) like every solo game; api.loop stops while paused or on the boss key (Esc).
'use strict';
const Dungeon = {
  mount(root, api) {
    const T = DD.TILE * DD.SCALE, PL = DD.PLAYER;
    // phones (Phone.touch): the canvas fills its container at 1 logical px = 1 CSS px and the world is drawn at zoom Z,
    // so a portrait screen still shows 7+ tiles each side of the player; desktop keeps the fixed 720×432 view (Z = 1)
    const PH = typeof Phone !== 'undefined' ? Phone : { touch: matchMedia('(pointer:coarse)').matches, left: () => false, scale: () => 1, btn: () => 48, on: () => () => {} };
    const TOUCH = PH.touch;
    const tall = innerHeight > innerWidth * 1.2;
    let W = tall ? 432 : 720, H = tall ? 624 : 432, Z = 1, VW = W, VH = H, dpr = Math.min(2, devicePixelRatio || 1);
    const { cv, ctx, at } = g2canvas(root, W, H), fxS = makeFX(), fxW = makeFX(), who = typeof meWho === 'function' ? meWho() : 'adam';
    const q = new URLSearchParams(location.search), TEST = !!window.__TEST__;   // set by verify/testmode.js with ?test=1 (Firebase → in-memory mocks)
    const day = typeof bkkDay === 'function' ? bkkDay() : new Date().toISOString().slice(0, 10), SEED = (TEST && q.get('seed')) || 'dgn-' + day;   // ?seed= / ?floor= only in test mode (they'd break the leaderboard)
    const sk = typeof Skills !== 'undefined' ? Skills : null;
    const R = Math.random, pickR = a => a[Math.floor(R() * a.length)];
    // lasting dungeon state lives in the player's save (Prog → cloud), so it follows their account:
    // prog.dgn = { codex, best: {d, n}, cp: {d, n} } (daily best and daily checkpoint reset with the date)
    const dg = () => { const p = Prog.get(); p.dgn ||= {}; return p; };
    const store2 = { get: (k, d) => { const v = (Prog.get().dgn || {})[k]; return v === undefined ? d : v; }, set: (k, v) => { const p = dg(); p.dgn[k] = v; Prog.put(p); } };
    const daily = (k, d) => { const v = store2.get(k, null); return v && v.d === day ? v.n : d; }, setDaily = (k, n) => store2.set(k, { d: day, n });


    // ---------- art: Tiny Dungeon tiles cut once, cached as 16 px canvases ----------
    const sheet = new Image(); sheet.src = 'assets/village/kenney-dungeon.png'; const tc = {};
    const tile = id => { if (!sheet.complete || !sheet.naturalWidth) return null; return tc[id] ??= (() => { const c = document.createElement('canvas'); c.width = c.height = 16;
      c.getContext('2d').drawImage(sheet, (id % 12) * 16, (id / 12 | 0) * 16, 16, 16, 0, 0, 16, 16); return c; })(); };
    const dk = (id, x, by, k = DD.SCALE, o) => { const c = tile(id); if (c) drawPixAt(ctx, c, x, by, k, o); };
    const urlC = {}, tileURL = id => urlC[id] || (urlC[id] = (() => { const s = tile(id); if (!s) return ''; const c = document.createElement('canvas'); c.width = c.height = 48; const g2 = c.getContext('2d'); g2.imageSmoothingEnabled = false; g2.drawImage(s, 0, 0, 48, 48); return c.toDataURL(); })()); // cached: the HUD rebuilds after kills
    PXA_ART.d_orb = ['.kkk.', 'kvvvk', 'kvwvk', 'kvvvk', '.kkk.']; PXA_ART.d_bolt = ['.kkk.', 'kbbbk', 'kblbk', 'kbbbk', '.kkk.']; PXA_ART.d_fire = ['.kkk.', 'krrrk', 'kryrk', 'krrrk', '.kkk.'];

    // ---------- run state ----------
    // a run: you only move and dodge; weapons (S.arms) fire by themselves; passives (S.pas) scale them;
    // gems give score (pay) and XP (level-ups). Lasting progression lives in Skills (combat tier) and the armoury (codex).
    const CODEX = 'codex', codex = store2.get(CODEX, null) || { found: {}, evo: {}, best: 0, runs: 0, kills: 0 };
    for (const id of DD.START_ARMS) codex.found[id] = 1;
    const perk = k => sk ? sk.bonus('combat', k) : 0;
    const S = { mode: 'intro', depth: 0, score: 0, kills: 0, by: {}, t: 0, t0: 0, big: false, god: false,
      lv: 1, xp: 0, arms: {}, pas: {}, pending: 0, rerolls: perk('reroll'), fk: 0, target: 0, waveT: 0, bossDown: false, novaN: 0 };
    const P = { x: 0, y: 0, hp: PL.hp + perk('hp'), max: 0, dir: 'up', ax: 0, ay: -1, inv: 0, dash: 0, dashCd: 0, moving: false };
    P.max = P.hp;
    let F, g, flow, mapC, fog, mm, cam, mons = [], shots = [], gems = [], drops = [], chests = [], props = [], spikes = [], altar = null, open = false, left = 0, trans = 0, boss = null, lastCell = '';
    let pshots = [], arcs = [], novas = [], quakes = [], swirls = [], relic = null, bossChest = null;
    const keys = new Set(); let stick = null;

    // derived numbers: passives × combat skill tier, in one place
    const st = () => { const p = id => S.pas[id] || 0;
      return { might: (1 + .1 * p('might')) * (1 + perk('dmg')), haste: 1 - .08 * p('haste'), area: 1 + .1 * p('area'), speed: 1 + .08 * p('speed'),
        magnet: PL.magnet * (1 + .3 * p('magnet')), armor: .1 * p('armor'), crit: PL.crit + .06 * p('crit'), dashCd: PL.dash.cd * (1 - .05 * p('speed')) }; };
    // one weapon's numbers at its current level (or evolved)
    const wp = id => { const A = DD.ARMS[id], a = S.arms[id]; if (a.evo) return { ...A.evo, kind: A.kind, evolved: true };
      const o = { kind: A.kind, tile: A.tile, name: A.name }; for (const k of ['dmg', 'cd', 'reach', 'n', 'r', 'on', 'off', 'pierce']) if (A[k]) o[k] = A[k][a.lv - 1]; return o; };

    // ---------- HUD (DOM above the canvas, rebuilt only when something changes) ----------
    const hud = document.createElement('div'); hud.className = TOUCH ? 'dgn-hud dgn-t' : 'hud dgn-hud'; root.prepend(hud);
    const css = document.createElement('style'); css.textContent = `.dgn-hud{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px}.dgn-hud .bl{display:flex;gap:3px;flex-wrap:wrap}
      .dgn-hud .ic{position:relative;width:26px;height:26px}.dgn-hud .ic img{width:26px;height:26px;image-rendering:pixelated}.dgn-hud .ic b{position:absolute;right:-3px;bottom:-4px;font-size:10px;line-height:1;background:#2b2140;color:#fff;border-radius:6px;padding:1px 3px}
      .dgn-hud .ic.evo b{background:#ff9f1c}.dgn-hud .row2{flex-basis:100%;display:flex;gap:12px;flex-wrap:wrap}.dgn-hud .sp{flex:1}.dgn-hud .q{min-height:44px;font:inherit;font-weight:600;border:2px solid #2b2140;border-radius:10px;background:#fff;padding:0 10px;cursor:pointer}
      .dgn-pick .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}.dgn-pick button.card{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;min-height:150px;font:inherit;border:3px solid #2b2140;border-radius:14px;background:#fffdf6;cursor:pointer;color:#2b2140}
      .dgn-pick button.card:hover,.dgn-pick button.card:focus-visible{background:#ffe9a8}.dgn-pick .card img{width:48px;height:48px;image-rendering:pixelated;flex:none}.dgn-pick .card .tx{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center}
      .dgn-pick .card b{font-size:15px}.dgn-pick .card small{font-size:12px;color:#6b5f7a;line-height:1.35}.dgn-pick .card i{font-style:normal;font-size:11px;color:#8a7f99}.dgn-pick .card.evo{background:#fff3d6;border-color:#c77d0a}
      .dgn-pick .tools{display:flex;justify-content:center;gap:8px;margin-top:10px}.dgn-pick .tools button{min-height:44px;font:inherit;font-weight:600;border:2px solid #2b2140;border-radius:10px;background:#fff;padding:0 14px;cursor:pointer}
      @media (max-width:520px){.dgn-pick .cards{grid-template-columns:1fr}.dgn-pick button.card{flex-direction:row;min-height:64px;text-align:left;gap:10px}.dgn-pick .card .tx{align-items:flex-start;text-align:left}}
      .game-dungeon.dgn-touch{position:relative;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
      .dgn-touch .g2box{position:absolute;inset:0}.dgn-touch .g2box canvas{width:100%;height:100%;aspect-ratio:auto;border:0;border-radius:0;box-shadow:none;background:#0c0812}
      .dgn-t{position:absolute;inset:0;z-index:5;pointer-events:none}.dgn-t>*{pointer-events:auto}
      .dgn-t .dgn-menu{position:absolute;padding:0;font:inherit;font-size:15px;font-weight:700;color:#fff;background:rgba(27,20,32,.78);border:2px solid rgba(255,255,255,.7);border-radius:12px;cursor:pointer;touch-action:manipulation}
      .dgn-t .dgn-menu.on{background:#ffd23f;color:#2b2140;border-color:#2b2140}
      .dgn-sheet{position:fixed;inset:0;z-index:40;background:rgba(12,8,20,.55);display:flex;flex-direction:column;justify-content:flex-end;
        padding:16px calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))}
      .dgn-sheet[hidden]{display:none}.dgn-sheet .pn{background:#fff;border:3px solid #2b2140;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:12px;width:100%;max-width:460px;margin:0 auto}
      .dgn-sheet .pn b{text-align:center;font-size:16px;color:#2b2140}
      .dgn-sheet button{min-height:var(--b,48px);font:inherit;font-size:17px;font-weight:700;color:#2b2140;background:#fff;border:2px solid #2b2140;border-radius:12px;cursor:pointer;touch-action:manipulation}
      .dgn-sheet button.go{background:#ffd23f}.dgn-sheet button.on{background:#ffe9a8}.dgn-sheet button.go.on{background:#f0c020}
      .dgn-pick.dgn-low{place-items:end center;padding-bottom:calc(12px + env(safe-area-inset-bottom))}.dgn-low .panel{padding:14px 14px 16px}.dgn-low h2{margin:0}.dgn-low p.muted{margin:2px 0 0}
      .dgn-low .cards{gap:12px;margin-top:10px}.dgn-low button.card{min-height:calc(60px * var(--s,1));padding:8px 10px}.dgn-low .tools{margin-top:12px}.dgn-low .tools button{min-height:var(--b,48px)}
      .dgn-low button.card.on{background:#ffe9a8}.dgn-low .tools button.on{background:#ffe9a8}`;
    root.appendChild(css);
    const icon = (src, lv, title, evo) => `<span class="ic${evo ? ' evo' : ''}" title="${title}"><img alt="${title}" src="${src}"><b>${evo ? 'EVO' : lv}</b></span>`;
    function setHud() {
      if (TOUCH) { paintHud(); return; }
      const hearts = Array.from({ length: P.max }, (_, i) => `<span style="opacity:${i < P.hp ? 1 : .25}">${pxImg('heart', 18)}</span>`).join('');
      const arms = Object.entries(S.arms).map(([id, a]) => { const A = DD.ARMS[id]; return icon(tileURL(a.evo ? A.evo.tile : A.tile), a.lv, a.evo ? A.evo.name : `${A.name} Lv ${a.lv}`, a.evo); }).join('');
      const pas = Object.entries(S.pas).map(([id, n]) => icon(tileURL(DD.PASSIVES[id].icon), n, `${DD.PASSIVES[id].name} Lv ${n}`)).join('');
      const goal = open ? '<b>ประตูเปิดแล้ว</b>' : F && F.purpose === 'lair' ? 'ปราบบอสเพื่อเปิดประตู' : `ปราบ <b>${Math.min(S.fk, S.target)}/${S.target}</b>`;
      hud.innerHTML = `<span>${hearts}</span><span>ชั้น <b>B${S.depth}</b></span><span>Lv <b>${S.lv}</b></span><span>คะแนน <b>${fmt(S.score)}</b></span><span>${goal}</span>
        <span class="sp"></span><button class="q" type="button">ออกจากดันเจี้ยน</button>${arms || pas ? `<span class="row2"><span class="bl">${arms}</span><span class="bl">${pas}</span></span>` : ''}`;
      hud.querySelector('.q').onclick = () => quit();
    }

    // ---------- floors ----------
    function build(depth) {
      S.depth = depth; F = DGen.floor(SEED, depth); g = F.g; flow = DE.flow(g);
      mapC = DE.paintMap(g, F.theme, tile, DE.rng(SEED + '/paint/' + depth)); fog = DE.fog(g); mm = DE.minimap(g);
      cam = DE.camera(VW, VH, g.w * T, g.h * T, TOUCH);
      P.x = (F.start.x + .5) * T; P.y = (F.start.y + .8) * T; P.inv = 1.2; lastCell = '';
      const sc = DD.scale(depth);
      mons = F.spawns.map(s => { const d = DD.MON[s.kind], hp = d.boss ? DD.bossHp(d.hp, depth) : Math.round(d.hp * sc.hp);
        const m = { kind: s.kind, d, x: (s.x + .5) * T, y: (s.y + .8) * T, hp, max: hp, sp: d.sp * (d.boss ? 1 : sc.sp), state: s.kind === 'mimic' ? 'disguised' : 'sleep',
          t: R() * 6, st: 1 + R() * 2, cd: 1.5 + R(), flash: 0, kb: 0, kx: 0, ky: 0, stun: 0, phase: R() * 3, cell: [s.x, s.y], hitT: {} };
        if (m.state === 'disguised') g.block[s.y * g.w + s.x] = 1; return m; });
      chests = F.chests.filter(c => !c.mimic).map(c => { g.block[c.y * g.w + c.x] = 1; return { cx: c.x, cy: c.y, x: (c.x + .5) * T, y: (c.y + .85) * T }; });
      props = F.props.map(p => ({ id: p.id, x: (p.x + .5) * T, y: (p.y + .85) * T }));
      spikes = F.spikes.map(s => ({ cx: s.x, cy: s.y, x: (s.x + .5) * T, y: (s.y + 1) * T, ph: s.ph * 2.6 }));
      altar = F.altar ? { cx: F.altar.x, cy: F.altar.y, x: (F.altar.x + .5) * T, y: (F.altar.y + .9) * T, used: false } : null;
      shots = []; gems = []; drops = []; pshots = []; arcs = []; novas = []; quakes = []; swirls = []; open = false; boss = null; bossChest = null;
      // the door: lairs open when the boss falls; other floors at a kill target (DD.TARGET; vaults have no waves, so exactly what's placed)
      S.fk = 0; S.bossDown = false; S.target = DD.TARGET(F.spawns.filter(s => s.kind !== 'mimic' && !DD.MON[s.kind].boss).length, F.purpose); S.waveT = DD.WAVE.first;
      // a weapon you haven't found yet waits in a glowing chest near the start, the first time you reach its depth
      relic = null;
      const id = Object.keys(DD.DISCOVER).find(k => !codex.found[k] && depth >= DD.DISCOVER[k]);
      if (id) for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [1, 1], [-1, 1]]) { const x = F.start.x + ox, y = F.start.y + oy;
        if (!DE.solid(g, x, y)) { relic = { id, cx: x, cy: y, x: (x + .5) * T, y: (y + .85) * T }; break; } }
      count(); reveal(true); cam.follow(P.x, P.y - 20, 0); setHud(); checkDoor();   // a vault with nothing placed opens at once
      const sub = F.purpose === 'lair' ? `ระวัง ${DD.MON[DD.bossFor(depth)].name}!` : F.purpose === 'vault' ? 'หาแท่นบูชา เลือกพลังเพิ่ม' : relic ? 'มีหีบเรืองแสงอยู่ใกล้ๆ!' : `ปราบให้ครบ ${S.target} ตัว เพื่อเปิดประตู`;
      banner(`B${depth} · ${F.name}`, sub);
    }
    const count = () => { left = mons.filter(m => m.state !== 'disguised').length; };
    function banner(a, b) { fxS.text(W / 2, H / 2 - 30, a, { color: PAL.yel, size: 30, life: 2, rise: 8 }); if (b) fxS.text(W / 2, H / 2 + 6, b, { color: '#fff', size: 17, life: 2, rise: 8 }); }
    function reveal(force) { const cx = Math.floor(P.x / T), cy = Math.floor((P.y - 8) / T), k = cx + ',' + cy; if (!force && k === lastCell) return; lastCell = k; mm.add(fog.reveal(cx, cy, 5)); }

    // ---------- your weapons ----------
    const targets = () => mons.filter(m => m.state !== 'disguised' && !m.fade && !m.born);
    function nearest(range, skip) { let b = null, bd = range; for (const m of targets()) { if (skip && skip.has(m)) continue; const d = Math.hypot(m.x - P.x, (m.y - m.d.r) - (P.y - 22)); if (d < bd) { bd = d; b = m; } } return b; }
    function hit(m, dmg, sx, sy, kb = 200, stun = 0, critBonus = 0, wid = '') {
      if (m.fade || m.state === 'disguised') return;
      const s = st(), crit = R() < s.crit + critBonus, d = dmg * s.might * (crit ? 2 : 1);
      m.hp -= d; m.flash = .1; if (m.state === 'sleep') wake(m);
      const dx = m.x - sx, dy = m.y - sy, l = Math.hypot(dx, dy) || 1, k = kb * (m.d.boss ? .1 : 1); m.kx = dx / l * k; m.ky = dy / l * k; m.kb = .12;
      if (stun && !m.d.boss) m.stun = Math.max(m.stun, stun);
      if (m.state === 'charge' && !m.d.boss) { m.state = 'walk'; m.st = 1; }
      fxW.text(m.x + (R() - .5) * 16, m.y - m.d.r * 2 - 8, crit ? `${Math.round(d * 10) / 10}!` : String(Math.round(d * 10) / 10), { color: crit ? PAL.yel : '#fff', size: crit ? 20 : 13, life: .5, rise: 22 });
      fxW.burst(m.x, m.y - m.d.r, { n: crit ? 10 : 4, colors: ['#fff', PAL.yel], speed: 180, grav: 200, size: 3, life: .3 });
      if (m.hp <= 0) kill(m);
    }
    // every weapon kind, fired from step(); a = its run state (lv, evo, t = cooldown left, ang for orbit)
    function fireWeapons(dt) {
      const s = st();
      for (const [id, a] of Object.entries(S.arms)) {
        const w = wp(id); a.t = (a.t ?? .3) - dt;
        if (w.kind === 'orbit') {
          a.phase = (a.phase || 0) + dt; const cyc = w.on + w.off, onNow = a.phase % cyc < w.on; a.active = onNow; a.ang = (a.ang || 0) + dt * 3.4;
          if (!onNow) continue; const r = w.r * s.area;
          for (let i = 0; i < w.n; i++) { const an = a.ang + i * 6.283 / w.n, x = P.x + Math.cos(an) * r, y = P.y - 22 + Math.sin(an) * r * .75;
            for (const m of targets()) if ((m.hitT[id] || 0) <= S.t && Math.hypot(m.x - x, (m.y - m.d.r) - y) < m.d.r + 16) { m.hitT[id] = S.t + .45; hit(m, w.dmg, P.x, P.y, 160, 0, 0, id); } }
          continue;
        }
        if (a.t > 0) continue; a.t = w.cd * s.haste;
        if (w.kind === 'arc') {
          const m = nearest((w.reach) * s.area * 1.7); let ang = m ? Math.atan2((m.y - m.d.r) - (P.y - 22), m.x - P.x) : Math.atan2(P.ay, P.ax);
          const reach = w.reach * s.area, span = w.full ? Math.PI : 1.05, swing = an => { arcs.push({ a: an, span, reach, t: 0, dur: .18, full: !!w.full, tile: w.tile });
            for (const mm2 of targets()) { const mx = mm2.x - P.x, my = (mm2.y - mm2.d.r) - (P.y - 22), d = Math.hypot(mx, my); let da = Math.abs(Math.atan2(my, mx) - an); if (da > Math.PI) da = 6.283 - da;
              if (d < reach + mm2.d.r && (w.full || da < span || d < 26)) hit(mm2, w.dmg, P.x, P.y - 22, 260); }
            for (const c of [...chests]) if (Math.hypot(c.x - P.x, c.y - 20 - (P.y - 22)) < reach + 10) openChest(c); };
          swing(ang); if (w.n > 1 && !w.full) api.after(.12, () => S.mode === 'play' && swing(ang + Math.PI));
          if (m) api.sfx('tick');
        } else if (w.kind === 'throw') {
          const used = new Set(); for (let i = 0; i < w.n; i++) { const m = nearest(T * 8, used); if (m) used.add(m);
            const ang = m ? Math.atan2((m.y - m.d.r) - (P.y - 22), m.x - P.x) + (R() - .5) * .08 : Math.atan2(P.ay, P.ax) + (i - (w.n - 1) / 2) * .25;
            pshots.push({ kind: 'knife', x: P.x, y: P.y - 22, vx: Math.cos(ang) * 440, vy: Math.sin(ang) * 440, a: ang, dmg: w.dmg, pierce: w.pierce, hits: new Set(), t: 0, life: 1.1, tile: 103 }); }
        } else if (w.kind === 'bolt') {
          for (let i = 0; i < w.n; i++) { const ang = Math.atan2(P.ay, P.ax) + (i - (w.n - 1) / 2) * .6;
            pshots.push({ kind: 'bolt', x: P.x, y: P.y - 26, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, dmg: w.dmg, pierce: 1, hits: new Set(), t: 0, life: 2.4, home: true, crit: w.crit || 0 }); }
        } else if (w.kind === 'nova') {
          novas.push({ r: 10, max: w.r * s.area, t: 0, dur: .35, hits: new Set(), dmg: w.dmg });
          if (w.heal && ++S.novaN % w.heal === 0) heal(1);
        } else if (w.kind === 'lance') {
          const base = Math.atan2(P.ay, P.ax), dirs = w.n === 1 ? [0] : w.n === 2 ? [0, Math.PI] : w.n === 3 ? [0, Math.PI, Math.PI / 2] : [-.35, -.17, 0, .17, .35];
          for (const o of dirs) { const ang = base + o; pshots.push({ kind: 'lance', x: P.x, y: P.y - 22, vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, a: ang, dmg: w.dmg, pierce: 99, hits: new Set(), t: 0, life: .55, tile: 131 }); }
        } else if (w.kind === 'quake') {
          const used = new Set(); for (let i = 0; i < w.n; i++) { const m = nearest(T * 6, used); if (!m) break; used.add(m); quakes.push({ x: m.x, y: m.y, r: w.r * s.area, t: 0, dmg: w.dmg, done: false }); }
        }
      }
      // weapon effects over time
      for (let i = arcs.length - 1; i >= 0; i--) if ((arcs[i].t += dt) > arcs[i].dur) arcs.splice(i, 1);
      for (let i = novas.length - 1; i >= 0; i--) { const n = novas[i]; n.t += dt; n.r = n.max * Math.min(1, n.t / n.dur);
        for (const m of targets()) if (!n.hits.has(m) && Math.hypot(m.x - P.x, (m.y - m.d.r * .5) - (P.y - 14)) < n.r + m.d.r * .5) { n.hits.add(m); hit(m, n.dmg, P.x, P.y, 320); }
        if (n.t > n.dur + .15) novas.splice(i, 1); }
      for (let i = quakes.length - 1; i >= 0; i--) { const qk = quakes[i]; qk.t += dt;
        if (!qk.done && qk.t > .12) { qk.done = true; fxS.shake(4, .12); fxW.burst(qk.x, qk.y, { n: 18, colors: ['#c77d0a', '#8a5a2b', '#fff'], speed: 220, grav: 300, size: 5, shape: 'puff', life: .45 });
          for (const m of targets()) if (Math.hypot(m.x - qk.x, (m.y - qk.y) * 1.4) < qk.r) hit(m, qk.dmg, qk.x, qk.y, 120, .7); }
        if (qk.t > .5) quakes.splice(i, 1); }
      for (let i = pshots.length - 1; i >= 0; i--) { const o = pshots[i]; o.t += dt;
        if (o.home) { const m = nearest(T * 7, o.hits); if (m) { const dx = m.x - o.x, dy = (m.y - m.d.r) - o.y, l = Math.hypot(dx, dy) || 1, sp = Math.min(380, 200 + o.t * 300); o.vx += (dx / l * sp - o.vx) * Math.min(1, dt * 6); o.vy += (dy / l * sp - o.vy) * Math.min(1, dt * 6); } }
        o.x += o.vx * dt; o.y += o.vy * dt; if (o.vx || o.vy) o.a = Math.atan2(o.vy, o.vx);
        if (o.t > o.life || DE.solid(g, Math.floor(o.x / T), Math.floor((o.y + 10) / T))) { pshots.splice(i, 1); continue; }
        for (const m of targets()) { if (o.hits.has(m)) continue; if (Math.hypot(m.x - o.x, (m.y - m.d.r) - o.y) < m.d.r + 8) { o.hits.add(m); hit(m, o.dmg, o.x - o.vx * .05, o.y - o.vy * .05, 180, 0, o.crit || 0); if (o.hits.size >= o.pierce) { o.t = 99; break; } } }
        // knives and bolts also knock enemy shots out of the air
        for (let j = shots.length - 1; j >= 0; j--) if (Math.hypot(shots[j].x - o.x, shots[j].y - o.y) < 14) { shots.splice(j, 1); S.score += 2; }
        if (o.t === 99) pshots.splice(i, 1); }
    }

    function kill(m) {
      const i = mons.indexOf(m); if (i < 0) return; mons.splice(i, 1);
      S.kills++; S.fk++; S.by[m.kind] = (S.by[m.kind] || 0) + 1; api.sfx('good');
      const pts = Math.round(m.d.pts * (1 + (S.depth - 1) * .12)); spill(m.x, m.y - 10, pts);
      fxW.burst(m.x, m.y - m.d.r, { n: m.d.boss ? 50 : 12, colors: m.kind.includes('slime') ? ['#3fd29b', '#b6f5dc', '#fff'] : ['#8a93a3', '#d9dde3', '#fff'], speed: 240, grav: 300, size: 5, shape: 'puff', life: .55 });
      if (m.d.ai === 'split') for (const k of [-1, 1]) { const x = m.x + k * 22; if (!DE.blocked(g, T, x, m.y, 12)) mons.push(mk('slime', x, m.y, true)); }
      if (m.d.boss) { boss = null; S.bossDown = true; if (S.depth > daily('cp', 0)) setDaily('cp', S.depth); fxS.shake(12, .5); fxS.flash(PAL.yel, .3); for (const k of [-1, 1]) drops.push({ x: m.x + k * 40, y: m.y, t: 0 });
        bossChest = { x: m.x, y: m.y + 10 }; fxS.text(W / 2, L.msgY, 'บอสทิ้งหีบไว้! เดินไปเปิด', { color: PAL.yel, size: 22, life: 2, rise: 6 }); }
      else if (P.hp < P.max && R() < .06) drops.push({ x: m.x, y: m.y, t: 0 });
      count(); checkDoor(); setHudSoon();
    }
    function checkDoor() { if (!open && (F.purpose === 'lair' ? S.bossDown : S.fk >= S.target)) clearFloor(); }
    const mk = (kind, x, y, awake) => { const d = DD.MON[kind], hp = Math.round(d.hp * DD.scale(S.depth).hp);
      return { kind, d, x, y, hp, max: hp, sp: d.sp * DD.scale(S.depth).sp, state: awake ? 'walk' : 'sleep', t: R() * 6, st: .6, cd: 1.5, flash: 0, kb: 0, kx: 0, ky: 0, stun: 0, phase: 0, cell: [Math.floor(x / T), Math.floor((y - 8) / T)], born: .3, hitT: {} }; };
    // gems fly out and get pulled in: score (pay) and XP (level-ups) are collected, not just added
    function spill(x, y, pts) { let big = Math.floor(pts / DD.GEM.big), small = Math.ceil((pts - big * DD.GEM.big) / DD.GEM.small);
      for (const [n, v] of [[big, DD.GEM.big], [small, DD.GEM.small]]) for (let i = 0; i < n; i++) { const a = R() * 6.28, s = 60 + R() * 120; gems.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, v, t: 0 }); } }
    function gainXP(n) { S.xp += n; while (S.xp >= DD.XP.need(S.lv)) { S.xp -= DD.XP.need(S.lv); S.lv++; S.pending++; } if (S.pending && S.mode === 'play') api.after(.05, () => S.pending && S.mode === 'play' && levelPick()); }
    function openChest(c) {
      chests.splice(chests.indexOf(c), 1); g.block[c.cy * g.w + c.cx] = 0; flow.update(-1, -1);
      spill(c.x, c.y - 20, DD.CHEST(S.depth)); api.sfx('level');
      fxW.text(c.x, c.y - 60, 'หีบสมบัติ!', { color: PAL.yel, size: 20 }); fxW.burst(c.x, c.y - 20, { n: 24, colors: [PAL.yel, '#fff', PAL.orange], speed: 260, grav: 400, size: 5, shape: 'star', life: .7 });
      if (R() < .45) drops.push({ x: c.x, y: c.y + 12, t: 0 });
    }
    function wake(m) { if (m.state !== 'sleep') return; m.state = 'walk'; m.st = .4 + R() * .8; fxW.text(m.x, m.y - m.d.r * 2 - 8, '!', { color: PAL.red, size: 20, life: .5, rise: 14 });
      if (m.d.boss) { boss = m; banner(m.d.name, ''); fxS.shake(6, .3); } }
    function wakeMimic(m) { m.state = 'walk'; m.st = .5; g.block[m.cell[1] * g.w + m.cell[0]] = 0; count(); setHud(); api.sfx('bad'); fxS.shake(5, .2);
      fxW.text(m.x, m.y - 60, 'มิมิค!', { color: PAL.red, size: 22 }); }
    function heal(n) { const was = P.hp; P.hp = Math.min(P.max, P.hp + n); if (P.hp > was) { api.sfx('good'); fxW.text(P.x, P.y - 70, '+' + (P.hp - was), { color: PAL.red, size: 20 }); setHud(); } }
    function hurt(n, fx2, fy2) {
      if (P.inv > 0 || S.mode !== 'play' || S.god) return;
      if (R() < st().armor) { P.inv = .5; fxW.text(P.x, P.y - 70, 'กันได้!', { color: '#4cc3ff', size: 18 }); api.sfx('tick'); return; }
      P.hp -= n; P.inv = PL.inv; api.sfx('bad'); fxS.shake(7, .25); fxS.flash(PAL.red, .18);
      const d = Math.hypot(P.x - fx2, P.y - fy2) || 1; DE.move(g, T, P, (P.x - fx2) / d * 26, (P.y - fy2) / d * 26, PL.r);
      setHud(); if (P.hp <= 0) die();
    }
    function dash() {
      if (S.mode !== 'play' || P.dashCd > 0) return;
      P.dash = PL.dash.t; P.dashCd = st().dashCd; P.inv = Math.max(P.inv, PL.dash.inv);
      fxW.burst(P.x, P.y - 6, { n: 8, colors: ['#fff', '#d9dde3'], speed: 120, grav: 0, size: 5, shape: 'puff', life: .35 });
    }
    function clearFloor() {
      open = true; swirls = []; const b = DD.CLEAR(S.depth); S.score += b; api.sfx('level'); bank();
      fxS.text(W / 2, L.msgY, `เคลียร์ชั้น B${S.depth}! +${b}`, { color: PAL.green, size: 24, life: 1.6, rise: 6 });
      fxS.text(W / 2, L.msgY + 28, 'ประตูเปิดแล้ว ตามลูกศรไปได้เลย', { color: '#fff', size: 15, life: 1.6, rise: 6 });
      mm.add(fog.reveal(F.exit.x, F.exit.y + 1, 2)); setHud();
    }

    // ---------- waves: monsters pour out of the fog while the door is shut ----------
    // each one is announced by a purple swirl on the floor for WAVE.warn seconds before it appears (honest warning)
    const pool = () => Object.entries(DD.MON).filter(([, m]) => m.w > 0 && m.from <= S.depth).map(([id, m]) => [id, m.w]);
    function wave() {
      if (mons.length >= DD.WAVE.cap) return; const P2 = pool(), tot = P2.reduce((a, x) => a + x[1], 0), pick = () => { let t = R() * tot; for (const [id, n] of P2) if ((t -= n) < 0) return id; return 'slime'; };
      const [pcx, pcy] = cellOf(P.x, P.y), n = Math.round(DD.WAVE.size(S.depth) * (F.purpose === 'lair' ? .5 : 1));
      for (let k = 0, tries = 0; k < n && tries < 200; tries++) {
        const a = R() * 6.283, r = DD.WAVE.near + R() * (DD.WAVE.far - DD.WAVE.near), cx = Math.round(pcx + Math.cos(a) * r), cy = Math.round(pcy + Math.sin(a) * r);
        if (DE.solid(g, cx, cy) || flow.dist(cx, cy) < 0) continue;
        const kind = pick(), m = DD.MON[kind], grp = m.group ? 2 : 1;
        for (let j = 0; j < grp && k < n; j++, k++) swirls.push({ kind, x: (cx + .5) * T + (j ? 14 : 0), y: (cy + .8) * T, t: DD.WAVE.warn });
      }
    }

    // ---------- level-ups, chests, evolutions ----------
    // options: a new weapon (free slot), a new passive (free slot), or the next level of something you have
    function options() {
      const o = [], nA = Object.keys(S.arms).length, nP = Object.keys(S.pas).length;
      for (const [id, a] of Object.entries(S.arms)) if (!a.evo && a.lv < 5) o.push({ t: 'arm', id, w: 3 });
      for (const [id, n] of Object.entries(S.pas)) if (n < 5) o.push({ t: 'pas', id, w: 2 });
      if (nA < PL.slots) for (const id of Object.keys(DD.ARMS)) if (!S.arms[id] && codex.found[id]) o.push({ t: 'arm', id, w: 2 });
      if (nP < PL.slots) for (const id of Object.keys(DD.PASSIVES)) if (!S.pas[id]) o.push({ t: 'pas', id, w: 1.5 });
      return o;
    }
    const evoReady = () => Object.entries(S.arms).find(([id, a]) => !a.evo && a.lv >= 5 && S.pas[DD.ARMS[id].pair]);
    const num = i => TOUCH ? '' : `${i + 1}. `, pickSub = TOUCH ? 'แตะการ์ดเพื่อเลือก 1 อย่าง' : 'เลือก 1 อย่าง · กด 1 2 3';
    function card(o, i) {
      if (o.t === 'gold') return `<button class="card" type="button" data-i="${i}"><img alt="" src="${pxaURL('coin')}"><span class="tx"><b>${num(i)}ถุงทอง</b><small>คะแนน +${o.v} และฟื้นหัวใจ 1 ดวง</small><i>ทุกอย่างเต็มแล้ว</i></span></button>`;
      if (o.t === 'evo') { const A = DD.ARMS[o.id]; return `<button class="card evo" type="button" data-i="${i}"><img alt="" src="${tileURL(A.evo.tile)}"><span class="tx"><b>${num(i)}${A.evo.name}</b><small>${A.evo.desc}</small><i>วิวัฒนาการจาก${A.name} + ${DD.PASSIVES[A.pair].name}</i></span></button>`; }
      if (o.t === 'arm') { const A = DD.ARMS[o.id], a = S.arms[o.id], nx = a ? a.lv + 1 : 1;
        return `<button class="card" type="button" data-i="${i}"><img alt="" src="${tileURL(A.tile)}"><span class="tx"><b>${num(i)}${A.name}${a ? ` Lv ${nx}` : ' (ใหม่!)'}</b><small>${a ? lvText(o.id, nx) : A.desc}</small><i>อาวุธ · คู่กับ${DD.PASSIVES[A.pair].name}${nx === 5 ? ' → ' + A.evo.name : ''}</i></span></button>`; }
      const Pv = DD.PASSIVES[o.id], n = (S.pas[o.id] || 0) + 1;
      return `<button class="card" type="button" data-i="${i}"><img alt="" src="${tileURL(Pv.icon)}"><span class="tx"><b>${num(i)}${Pv.name} Lv ${n}</b><small>${Pv.desc}</small><i>พลังติดตัว${n === 1 ? ' (ใหม่!)' : ''}</i></span></button>`;
    }
    // what the next level changes, in plain numbers
    function lvText(id, nx) { const A = DD.ARMS[id], k = nx - 1, ch = [];
      for (const [f, lab] of [['dmg', 'แรง'], ['n', 'จำนวน'], ['cd', 'คูลดาวน์'], ['reach', 'ระยะ'], ['r', 'วง'], ['pierce', 'ทะลุ']]) if (A[f] && A[f][k] !== A[f][k - 1]) ch.push(`${lab} ${A[f][k - 1]} → ${A[f][k]}`);
      return ch.join(' · ') || 'เก่งขึ้นเล็กน้อย'; }
    function apply(o) {
      if (o.t === 'gold') { S.score += o.v; heal(1); }
      else if (o.t === 'evo') { S.arms[o.id].evo = true; codex.evo[o.id] = 1; store2.set(CODEX, codex); fxS.flash(PAL.yel, .3); fxS.text(W / 2, L.msgY, `วิวัฒนาการ: ${DD.ARMS[o.id].evo.name}!`, { color: PAL.yel, size: 24, life: 2, rise: 6 }); }
      else if (o.t === 'arm') { const a = S.arms[o.id]; if (a) a.lv++; else S.arms[o.id] = { lv: 1, t: .2 }; }
      else { S.pas[o.id] = (S.pas[o.id] || 0) + 1; if (o.id === 'heart') { P.max++; heal(1); } }
      setHud();
    }
    function chooser(title, sub, opts, done) {
      S.mode = 'pick'; keys.clear(); stick = null;
      const ov = document.createElement('div'); ov.className = TOUCH ? 'overlay dgn-pick dgn-low' : 'overlay dgn-pick';
      const render = () => { ov.innerHTML = `<div class="panel popin"><h2>${title}</h2><p class="muted">${sub}</p><div class="cards">${opts.map(card).join('')}</div>
        ${S.rerolls > 0 && opts[0].t !== 'evo' ? `<div class="tools"><button class="rr" type="button">สุ่มใหม่ (เหลือ ${S.rerolls})${TOUCH ? '' : ' · R'}</button></div>` : ''}</div>`;
        ov.querySelectorAll('.card').forEach(b => { b.onclick = () => choose(+b.dataset.i); press(b); }); const rr = ov.querySelector('.rr'); if (rr) { rr.addEventListener('click', reroll); press(rr); }
        if (!TOUCH) setTimeout(() => ov.querySelector('.card')?.focus(), 30); };
      const choose = i => { const o = opts[i]; if (!o) return; ov.remove(); S.onPick = S.onReroll = null; apply(o); S.mode = 'play'; P.inv = Math.max(P.inv, .6); api.sfx('level'); done && done(); };
      const reroll = () => { if (S.rerolls <= 0) return; S.rerolls--; opts = draw3(); render(); };
      S.onPick = choose; S.onReroll = reroll; render(); root.appendChild(ov);
    }
    function draw3() { const pool2 = options(), out = [];
      while (out.length < 3 && pool2.length) { const tot = pool2.reduce((a, o) => a + o.w, 0); let t = R() * tot, k = 0; for (; k < pool2.length - 1; k++) if ((t -= pool2[k].w) < 0) break; out.push(pool2.splice(k, 1)[0]); }
      return out.length ? out : [{ t: 'gold', v: 50 * S.depth }]; }
    function levelPick() { if (S.mode !== 'play' || !S.pending) return; S.pending--;
      chooser(`เลเวลอัป! Lv ${S.lv - S.pending}`, pickSub, draw3(), () => { if (S.pending) api.after(.15, levelPick); }); }
    // boss chest and vault altar: an evolution if one is ready, otherwise pick 1 of 3
    function chestReward(title) { const e = evoReady();
      if (e) chooser(title, 'อาวุธพร้อมวิวัฒนาการแล้ว!', [{ t: 'evo', id: e[0] }]); else chooser(title, pickSub, draw3()); }
    function takeRelic() {
      const id = relic.id, A = DD.ARMS[id]; relic = null; codex.found[id] = 1; store2.set(CODEX, codex); api.sfx('level'); fxS.flash(PAL.yel, .25);
      fxS.text(W / 2, L.msgY, `ค้นพบ ${A.name}! ปลดล็อกถาวร`, { color: PAL.yel, size: 24, life: 2.2, rise: 6 });
      if (Object.keys(S.arms).length < PL.slots) apply({ t: 'arm', id }); else fxS.text(W / 2, L.msgY + 30, 'ช่องอาวุธเต็ม · จะสุ่มเจอตอนเลเวลอัป', { color: '#fff', size: 15, life: 2, rise: 6 });
    }

    // ---------- ending ----------
    function die() { S.mode = 'over'; fxS.text(W / 2, H / 2, 'หมดแรง! พักก่อนนะ', { color: PAL.red, size: 30, life: 1.4 }); api.after(1.4, () => finish(`หมดแรงที่ B${S.depth}`)); }
    function quit() { if (S.mode !== 'play' && S.mode !== 'pick' && S.mode !== 'menu') return; document.querySelector('.dgn-pick')?.remove(); if (menuSheet) menuSheet.hidden = true; S.big = false; S.mode = 'over'; finish(`ถอยกลับขึ้นมาจาก B${S.depth}`); }
    function finish(msg) {
      // owner's rule: nothing is lost — fainting or leaving both pay out what the run earned, like any arcade game
      if (S.fin) return; S.fin = true; confirmSheet?.remove();
      const best = daily('best', 0), deep = S.depth; if (deep > best) setDaily('best', deep);
      codex.runs++; codex.kills += S.kills; codex.best = Math.max(codex.best, deep); store2.set(CODEX, codex);
      // combat skill XP (lasting perks), then the hub's results card: the ranked number is the deepest floor,
      // the pay comes from the run score (office.js PAY_RULES.dungeon: score ÷ 20 through the soft cap, no ×2, no bricks)
      const xp = sk ? sk.add('combat', 10 + S.kills + deep * 5) : null;
      const arms = Object.entries(S.arms).map(([k, a]) => a.evo ? DD.ARMS[k].evo.name : `${DD.ARMS[k].name} Lv ${a.lv}`).join(', ');
      api.end(deep, `${msg} · คะแนน ${fmt(S.score)} · ปราบ ${S.kills} ตัว${xp ? ` · XP การต่อสู้ ${xp.got ? '+' + xp.got : 'ครบวันนี้'}${xp.up ? ` · ขึ้นขั้น ${xp.up}!` : ''}` : ''}`, false,
        { award: S.score, floor: deep, kills: S.kills, by: S.by, arms: S.arms, pas: S.pas, lv: S.lv, build: arms, xp,
          secs: Math.round((performance.now() - S.t0) / 1000), best: Math.max(best, deep), newBest: deep > best, codex });
    }

    // ---------- a run is never lost (owner, 18 Nov 2026, after jjib's ~1,000,000-point run paid nothing) ----------
    // Bank the run with the hub after every cleared floor, every 15 s and whenever the tab is hidden. If the tab is then
    // killed or reloaded (iPhone Safari does this to background tabs), the hub pays the banked run on the next visit
    // (index.html settleRun) and ranks its floor. A closed tab ends the run; it can't be resumed.
    const live = () => S.depth > 0 && !S.fin && ['play', 'pick', 'menu', 'trans'].includes(S.mode);
    function bank() { if (live()) api.checkpoint(S.depth, `ออกกลางคันที่ B${S.depth} · คะแนน ${fmt(S.score)}`, false, { award: S.score, floor: S.depth, kills: S.kills }); }
    let bankT = 15;
    const onHide = () => { if (document.hidden) bank(); };
    document.addEventListener('visibilitychange', onHide);
    // the hub calls leave() when the game is closed from outside (another screen opened): it pays like ถอยกลับ,
    // with combat XP and the daily best. A fainting run that is still on its 1.4 s "หมดแรง" beat is finished too.
    function leave(msg) {
      if (S.fin || S.depth < 1 || S.mode === 'intro') return;
      document.querySelector('.dgn-pick')?.remove(); if (menuSheet) menuSheet.hidden = true; S.big = false;
      const fainted = S.mode === 'over'; S.mode = 'over'; finish(fainted ? `หมดแรงที่ B${S.depth}` : msg || `ออกจากดันเจี้ยนที่ B${S.depth}`);
    }
    // the hub's 🏠 buttons call confirmLeave(go): ask first, then end the run here so the player sees the result screen and
    // what it paid, instead of being dropped on the hub with nothing
    let confirmSheet = null;
    const coinsNow = () => { const raw = Math.max(2, Math.round(S.score / ((typeof PROG_NORM !== 'undefined' && PROG_NORM.dungeon) || 20)));
      return Math.round(typeof softBase === 'function' ? softBase(raw) : raw); };
    function confirmLeave(go) {
      if (!live()) return go();
      if (confirmSheet) return;
      const was = S.mode; if (was === 'play' || was === 'trans') S.mode = 'menu'; stick = null; keys.clear();
      confirmSheet = document.createElement('div'); confirmSheet.className = 'dgn-sheet dgn-leave';
      confirmSheet.innerHTML = `<div class="pn" role="dialog" aria-label="ออกจากดันเจี้ยน"><b>ออกจากดันเจี้ยน?</b>
        <p class="lv">ลงมาถึง B${S.depth} · คะแนน ${fmt(S.score)}<br>ออกตอนนี้ได้ประมาณ <b>${fmt(coinsNow())} เหรียญ</b> และลงอันดับ</p>
        <button type="button" class="go">เล่นต่อ</button><button type="button" class="q">ออกและรับรางวัล</button></div>`;
      confirmSheet.querySelectorAll('button').forEach(press);
      const back = () => { confirmSheet?.remove(); confirmSheet = null; if (S.mode === 'menu' && (!menuSheet || menuSheet.hidden)) { S.mode = was === 'trans' ? 'trans' : 'play'; P.inv = Math.max(P.inv, .4); } };
      confirmSheet.querySelector('.go').onclick = back;
      confirmSheet.querySelector('.q').onclick = () => { confirmSheet?.remove(); confirmSheet = null; leave(`ถอยกลับขึ้นมาจาก B${S.depth}`); };
      confirmSheet.addEventListener('pointerdown', e => { if (e.target === confirmSheet) back(); });
      root.appendChild(confirmSheet);
      if (!TOUCH) setTimeout(() => confirmSheet?.querySelector('.go')?.focus(), 30);
    }
    css.textContent += `.dgn-leave .pn .lv{margin:0;text-align:center;font-size:15px;line-height:1.5;color:#2b2140}.dgn-leave .pn .lv b{font-size:15px}`;

    // ---------- input: move + dodge only (weapons fire by themselves) ----------
    api.onKey(e => {
      const k = e.key.toLowerCase();
      if (S.mode === 'pick') { if (['1', '2', '3'].includes(k)) S.onPick?.(+k - 1); else if (k === 'r') S.onReroll?.(); return; }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(k)) { e.preventDefault(); keys.add(k); }
      if (k === 'shift' || k === 'k' || k === ' ') { e.preventDefault(); dash(); }
      if (k === 'm' || k === 'tab') { e.preventDefault(); S.big = !S.big; }
    });
    const onUp = e => keys.delete(e.key.toLowerCase()), onBlur = () => { keys.clear(); stick = null; };
    addEventListener('keyup', onUp); addEventListener('blur', onBlur);
    const gone = new MutationObserver(() => { if (!root.isConnected) { removeEventListener('keyup', onUp); removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onHide); unTouch(); gone.disconnect(); if (window.__dgn && window.__dgn.root === root) delete window.__dgn; } });
    gone.observe(document.body, { childList: true, subtree: true });
    const mmRect = () => { const s = mmScale(); return { x: W - g.w * s - 10, y: 16, w: g.w * s, h: g.h * s }; };
    // desktop (mouse): drag anywhere = stick, click the minimap to enlarge it. Touch devices use the layout below.
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!g) return;
      if (TOUCH) return touchDown(e);
      const p = at(e);
      const r2 = mmRect(); if (S.big || (p.x >= r2.x && p.y <= r2.y + r2.h + 4)) { S.big = !S.big; return; }
      stick = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y }; cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => { if (!stick || e.pointerId !== stick.id) return; const p = TOUCH ? at2(e) : at(e); stick.x = p.x; stick.y = p.y;
      // floating stick: the base follows a thumb that slides past the rim, so turning around never needs a re-press
      if (TOUCH) { const dx = p.x - stick.x0, dy = p.y - stick.y0, d = Math.hypot(dx, dy), R2 = L.home.r; if (d > R2) { stick.x0 = p.x - dx / d * R2; stick.y0 = p.y - dy / d * R2; } } });
    const endStick = e => { if (stick && e.pointerId === stick.id) stick = null; };
    cv.addEventListener('pointerup', endStick); cv.addEventListener('pointercancel', endStick);
    if (!TOUCH) g2pad(root, [['หลบ', dash], ['แผนที่', () => { S.big = !S.big; }]]);

    // ---------- touch layout (portrait first): read PRD _test/prd-phone-first.md 7.3 / 7.4 before changing ----------
    // L holds every screen position in canvas px (= CSS px on touch). The hub's own exit button owns the top-left
    // 56×56 inside the safe area, so the HUD starts right of it; the menu (map, leave) is top right; the stick
    // (left half) and dodge (lower right) swap sides with Phone.left(); nothing sits under the home bar.
    const L = { msgY: 92, sl: 0, st: 0, sr: 0, sb: 0, sc: 1, btn: 48, left: false, hudX: 0, hudR: 0, hudH: 0, xpY: 0, bossY: 0,
      edge: { l: 28, t: 28, r: W - 28, b: H - 28 }, dodge: { x: 0, y: 0, r: 0 }, home: { x: 0, y: 0, r: 40 }, menu: { x: 0, y: 0, s: 48 }, row: { x: 0, w: 0, b: 0 } };
    const at2 = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    let menuBtn = null, menuSheet = null, safeProbe = null, hudC = null, rowC = null, rowH = 0, dodgeT = 0, menuShown = null;
    function press(el) { const on = () => el.classList.add('on'), off = () => el.classList.remove('on');
      el.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off); }
    function touchDown(e) {
      const p = at2(e);
      if (S.big) { S.big = false; if (S.mode === 'menu') resume(); return; }
      if (S.mode !== 'play') return;
      const d = L.dodge; if (Math.hypot(p.x - d.x, p.y - d.y) < d.r + 12) { dash(); dodgeT = .16; return; }
      if (stick || (p.x < W / 2) === L.left) return;   // one stick, on its own half only
      stick = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y }; cv.setPointerCapture(e.pointerId);
    }
    function openMenu() { if (S.mode !== 'play') return; S.mode = 'menu'; stick = null; keys.clear(); menuSheet.hidden = false; }
    function resume() { menuSheet.hidden = true; S.big = false; if (S.mode !== 'menu') return; S.mode = 'play'; P.inv = Math.max(P.inv, .4); if (S.pending) api.after(.1, levelPick); }
    if (TOUCH) {
      root.classList.add('dgn-touch');
      menuBtn = document.createElement('button'); menuBtn.type = 'button'; menuBtn.className = 'dgn-menu'; menuBtn.textContent = 'เมนู'; menuBtn.setAttribute('aria-label', 'เมนู: แผนที่ และออกจากดันเจี้ยน');
      menuBtn.onclick = openMenu; press(menuBtn);
      menuSheet = document.createElement('div'); menuSheet.className = 'dgn-sheet'; menuSheet.hidden = true;
      menuSheet.innerHTML = '<div class="pn" role="dialog" aria-label="เมนู"><b>พักเกมอยู่</b><button type="button" class="go">เล่นต่อ</button><button type="button" class="mp">ดูแผนที่</button><button type="button" class="q">ออกจากดันเจี้ยน</button></div>';
      menuSheet.querySelectorAll('button').forEach(press);
      menuSheet.querySelector('.go').onclick = resume; menuSheet.querySelector('.mp').onclick = () => { menuSheet.hidden = true; S.big = true; };
      menuSheet.querySelector('.q').onclick = () => quit(); menuSheet.addEventListener('pointerdown', e => { if (e.target === menuSheet) resume(); });
      hud.append(menuBtn, menuSheet);
      safeProbe = document.createElement('div');
      safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      root.appendChild(safeProbe);
    }
    function layout() {
      if (!TOUCH || !root.isConnected) return;
      const par = root.parentElement, cs = getComputedStyle(par), vh = visualViewport ? visualViewport.height : innerHeight;
      const r0 = root.getBoundingClientRect(), fixed = cs.position === 'fixed' || cs.position === 'absolute';
      // the hub's game mode makes the parent fill the viewport; until then use the room below the page header
      // (hub game mode: #stage is fixed full-screen with safe-area padding and .game is flex:1, so take the root's own box)
      if (fixed && root.style.height) root.style.height = '';
      const h = Math.round(Math.max(320, fixed ? root.getBoundingClientRect().height : vh - (r0.top + scrollY) - 8));
      const w = Math.round(root.clientWidth || r0.width), nd = Math.min(2, devicePixelRatio || 1);
      if (!fixed && root.style.height !== h + 'px') root.style.height = h + 'px';
      if (w !== W || h !== H || nd !== dpr || cv.width !== Math.round(w * nd)) { W = w; H = h; dpr = nd; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      // zoom out until 7+ tiles show each side of the player (15.5 across), never in past the desktop view
      Z = Math.min(1, W / (15.5 * T), H / (9 * T)); VW = W / Z; VH = H / Z;
      const ps = getComputedStyle(safeProbe), rr = cv.getBoundingClientRect();
      L.sl = Math.max(0, parseFloat(ps.paddingLeft) - rr.left); L.st = Math.max(0, parseFloat(ps.paddingTop) - rr.top);
      L.sr = Math.max(0, parseFloat(ps.paddingRight) - (innerWidth - rr.right)); L.sb = Math.max(0, parseFloat(ps.paddingBottom) - (vh - rr.bottom));
      L.sc = PH.scale(); L.btn = PH.btn(); L.left = PH.left();
      root.style.setProperty('--s', L.sc); root.style.setProperty('--b', L.btn + 'px');
      const m = L.menu; m.s = L.btn; m.x = W - L.sr - 8 - m.s; m.y = L.st + Math.max(4, (56 - m.s) / 2);
      Object.assign(menuBtn.style, { left: m.x + 'px', top: m.y + 'px', width: m.s + 'px', height: m.s + 'px' });
      L.hudX = L.sl + 56 + 10; L.hudR = m.x - 10; L.hudH = L.st + 58; L.xpY = L.st + 62; L.bossY = L.st + 96;
      const d = L.dodge; d.r = Math.round(Math.max(L.btn / 2, 44 * L.sc)); d.x = L.left ? L.sl + 20 + d.r : W - L.sr - 20 - d.r; d.y = H - L.sb - 24 - d.r;
      const hm = L.home; hm.r = Math.round(46 * L.sc); hm.x = L.left ? W - L.sr - 24 - hm.r : L.sl + 24 + hm.r; hm.y = H - L.sb - 10 - 2 * 32 - 14 - hm.r;
      const rw = L.row; rw.b = H - L.sb - 10; rw.x = L.left ? d.x + d.r + 12 : L.sl + 12; rw.w = L.left ? W - L.sr - 12 - rw.x : d.x - d.r - 12 - rw.x;
      L.edge.l = L.sl + 22; L.edge.r = W - L.sr - 22; L.edge.t = L.st + 124; L.edge.b = H - L.sb - 22; L.msgY = L.st + 150;
      if (g) { cam = DE.camera(VW, VH, g.w * T, g.h * T, true); cam.follow(P.x, P.y - 20, 0); }
      lgW = -1; paintHud(); draw();
    }
    let relay = 0; const relayout = () => { if (!relay) relay = requestAnimationFrame(() => { relay = 0; layout(); }); };
    let ro = null, offPhone = null;
    if (TOUCH) { addEventListener('resize', relayout); addEventListener('orientationchange', relayout); if (window.visualViewport) visualViewport.addEventListener('resize', relayout);
      if (window.ResizeObserver) { ro = new ResizeObserver(relayout); ro.observe(root.parentElement || root); } offPhone = PH.on(relayout);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => paintHud()); }
    const unTouch = () => { removeEventListener('resize', relayout); removeEventListener('orientationchange', relayout); if (window.visualViewport) visualViewport.removeEventListener('resize', relayout);
      if (ro) ro.disconnect(); if (offPhone) offPhone(); };
    // the HUD is painted once per change into two small canvases and blitted each frame (no per-frame text work)
    const mkC = (c, w, h) => { c ||= document.createElement('canvas'); const cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cw, ch); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false; return [c, x]; };
    function paintHud() {
      if (!TOUCH) return;
      const vis = S.mode === 'play' || S.mode === 'menu' || S.mode === 'pick' || S.mode === 'trans'; if (menuBtn && menuShown !== vis) { menuShown = vis; menuBtn.hidden = !vis; }
      if (!W || !g) return;
      // top band: hearts + score, then floor · level · door goal
      const [c, x] = mkC(hudC, W, L.hudH); hudC = c; const x0 = L.hudX, avail = L.hudR - x0, y1 = L.st + 18, y2 = L.st + 42;
      const goal = open ? 'ประตูเปิดแล้ว' : F.purpose === 'lair' ? 'ปราบบอส' : `ปราบ ${Math.min(S.fk, S.target)}/${S.target}`;
      x.font = '700 15px Kanit, sans-serif'; const wB = x.measureText(`B${S.depth}`).width, wL = x.measureText(`Lv ${S.lv}`).width, wG = x.measureText(goal).width;
      const row2 = wB + wL + wG + 28, many = P.max * 16 > avail * .6, hw = many ? 16 + 44 : P.max * 16;
      x.font = '600 13px Kanit, sans-serif'; const sc = `คะแนน ${fmt(S.score)}`, wS = x.measureText(sc).width, showS = hw + 12 + wS <= avail;
      const bw = Math.min(avail, Math.max(row2, hw + (showS ? 12 + wS : 0))) + 16;
      rrect(x, x0 - 8, L.st + 4, bw, 50, 10, 'rgba(12,8,20,.62)');
      const hp = pxa('heart');
      if (many) { drawPixAt(x, hp, x0 + 7, y1 + 7, 2); txt(x, `${P.hp}/${P.max}`, x0 + 18, y1, 15, '#fff', 'left', 700); }
      else for (let i = 0; i < P.max; i++) drawPixAt(x, hp, x0 + 7 + i * 16, y1 + 7, 2, { alpha: i < P.hp ? 1 : .25 });
      if (showS) txt(x, sc, x0 + hw + 12, y1, 13, 'rgba(255,255,255,.85)', 'left', 600);
      let gx = x0; txt(x, `B${S.depth}`, gx, y2, 15, PAL.yel, 'left', 700); gx += wB + 14;
      txt(x, `Lv ${S.lv}`, gx, y2, 15, '#fff', 'left', 700); gx += wL + 14; txt(x, goal, gx, y2, 15, open ? '#3fd29b' : '#fff', 'left', 700);
      // weapon + passive row above the bottom edge, beside the dodge button
      const ic = 30, gap = 4, A = Object.entries(S.arms), Pz = Object.entries(S.pas), one = (A.length + Pz.length) * (ic + gap) + 8 <= L.row.w;
      rowH = A.length + Pz.length ? (one || !Pz.length || !A.length ? ic : ic * 2 + gap) : 0;
      const [rc, rx] = mkC(rowC, Math.max(1, L.row.w), Math.max(1, rowH)); rowC = rc;
      const cell = (tid, lab, evo, cx, cy) => { rrect(rx, cx, cy, ic, ic, 7, evo ? 'rgba(199,125,10,.85)' : 'rgba(12,8,20,.62)'); const t2 = tile(tid); if (t2) rx.drawImage(t2, cx + 3, cy + 2, 24, 24);
        rx.font = '700 10px Kanit, sans-serif'; const lw = rx.measureText(lab).width + 6; rrect(rx, cx + ic - lw + 2, cy + ic - 11, lw, 12, 5, evo ? '#ff9f1c' : '#2b2140'); txt(rx, lab, cx + ic - lw / 2 + 2, cy + ic - 5, 10, '#fff', 'center', 700); };
      let cx = 0; const yA = rowH - ic, yP = one ? yA : 0;
      for (const [id, a] of A) { const D = DD.ARMS[id]; cell(a.evo ? D.evo.tile : D.tile, a.evo ? 'EVO' : String(a.lv), a.evo, cx, yA); cx += ic + gap; }
      if (!one) cx = 0; else cx += 8;
      for (const [id, n] of Pz) { cell(DD.PASSIVES[id].icon, String(n), false, cx, yP); cx += ic + gap; }
    }
    // an edge marker for each warning the player can't see: spawn swirls (with the time left) and wind-ups (owner rule: warnings are honest)
    let ex = 0, ey = 0, ea = 0, mkN = 0;
    function edgeAt(sx, sy, pad) { const E = L.edge, l = E.l + pad, t = E.t + pad, r = E.r - pad, b = E.b - pad, cx = (l + r) / 2, cy = (t + b) / 2;
      ea = Math.atan2(sy - cy, sx - cx); const c = Math.cos(ea), n = Math.sin(ea), k = Math.min(c ? (r - cx) / Math.abs(c) : 1e9, n ? (b - cy) / Math.abs(n) : 1e9); ex = cx + c * k; ey = cy + n * k; }
    const inView = (sx, sy) => sx > L.edge.l + 2 && sx < L.edge.r - 2 && sy > L.edge.t + 2 && sy < L.edge.b - 2;
    function marker(wx, wy, col, k) {
      const sx = (wx - cam.x) * Z, sy = (wy - cam.y) * Z; if (inView(sx, sy)) return; mkN++;
      edgeAt(sx, sy, 14); ctx.save(); ctx.translate(ex, ey);
      ctx.fillStyle = 'rgba(12,8,20,.8)'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 6.284); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      if (k >= 0) { ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 11, -1.5708, -1.5708 + 6.2832 * k); ctx.stroke(); }
      ctx.fillStyle = col; ctx.globalAlpha = k >= 0 ? 1 : .6 + Math.sin(S.t * 14) * .4; ctx.beginPath(); ctx.arc(0, 0, k >= 0 ? 4 : 6, 0, 6.284); ctx.fill(); ctx.globalAlpha = 1;
      ctx.rotate(ea); ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(16, -7); ctx.lineTo(16, 7); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    function drawMarkers() {
      mkN = 0; if (S.mode !== 'play' && S.mode !== 'menu') return;
      for (let i = 0; i < swirls.length; i++) { const w = swirls[i]; marker(w.x, w.y - 6, '#a05aff', w.t / DD.WAVE.warn); }
      for (let i = 0; i < mons.length; i++) { const m = mons[i]; if (m.state === 'aim' || m.state === 'wind') marker(m.x, m.y - m.d.r, '#ff4d6d', -1); }
    }
    function touchUI() {
      if (hudC) ctx.drawImage(hudC, 0, 0, W, L.hudH);
      // XP bar under the HUD band
      const need = DD.XP.need(S.lv), k = Math.min(1, S.xp / need), xw = L.hudR - L.hudX + 8;
      ctx.fillStyle = 'rgba(12,8,20,.75)'; ctx.fillRect(L.hudX - 8, L.xpY, xw, 7); ctx.fillStyle = '#4cc3ff'; ctx.fillRect(L.hudX - 7, L.xpY + 1, (xw - 2) * k, 5);
      if (rowC && rowH) ctx.drawImage(rowC, L.row.x, L.row.b - rowH, Math.max(1, L.row.w), rowH);
      if (S.mode !== 'play') return;
      // stick: drawn under the thumb; a faint ring shows where it lives until the first few seconds have passed
      const hm = L.home, R2 = hm.r;
      if (stick) { const dx = stick.x - stick.x0, dy = stick.y - stick.y0, d = Math.hypot(dx, dy), q = d > R2 ? R2 / d : 1;
        ctx.fillStyle = 'rgba(12,8,20,.35)'; ctx.beginPath(); ctx.arc(stick.x0, stick.y0, R2, 0, 6.284); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(stick.x0 + dx * q, stick.y0 + dy * q, 20 * L.sc, 0, 6.284); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hm.x, hm.y, R2, 0, 6.284); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(hm.x, hm.y, 20 * L.sc, 0, 6.284); ctx.fill();
        if (S.t < 8) txt(ctx, 'วางนิ้วแล้วลากเพื่อเดิน', L.left ? W - L.sr - 14 : L.sl + 14, hm.y - R2 - 14, 13, 'rgba(255,255,255,.85)', L.left ? 'right' : 'left', 600); }
      // dodge: lights up the moment it's pressed, then shows its cooldown
      const d = L.dodge, s = st(), on = dodgeT > 0;
      ctx.fillStyle = on ? PAL.yel : 'rgba(43,33,64,.72)'; ctx.beginPath(); ctx.arc(d.x, d.y, on ? d.r + 3 : d.r, 0, 6.284); ctx.fill();
      ctx.strokeStyle = on ? '#2b2140' : '#fff'; ctx.lineWidth = 3; ctx.stroke();
      if (P.dashCd > 0 && !on) { ctx.fillStyle = 'rgba(12,8,20,.55)'; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.arc(d.x, d.y, d.r - 2, -1.5708, -1.5708 + 6.2832 * (P.dashCd / s.dashCd)); ctx.fill(); }
      txt(ctx, 'หลบ', d.x, d.y + 1, Math.round(18 * L.sc), on ? '#2b2140' : '#fff', 'center', 800);
    }

    // ---------- simulation ----------
    const dname = (x, y) => Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y < 0 ? 'up' : 'down');
    const cellOf = (x, y) => [Math.floor(x / T), Math.floor((y - 8) / T)];
    function step(dt) {
      S.t += dt;
      // player
      let mx = 0, my = 0;
      if (keys.has('a') || keys.has('arrowleft')) mx--; if (keys.has('d') || keys.has('arrowright')) mx++;
      if (keys.has('w') || keys.has('arrowup')) my--; if (keys.has('s') || keys.has('arrowdown')) my++;
      if (stick) { const sx = stick.x - stick.x0, sy = stick.y - stick.y0, d = Math.hypot(sx, sy), R2 = TOUCH ? L.home.r : 40; if (d > (TOUCH ? 8 * L.sc : 8)) { mx = sx / Math.max(d, R2); my = sy / Math.max(d, R2); } }
      const ml = Math.hypot(mx, my); P.moving = ml > .1;
      if (P.moving) { mx /= Math.max(1, ml); my /= Math.max(1, ml); const n = Math.hypot(mx, my); P.ax = mx / n; P.ay = my / n; P.dir = dname(mx, my); }
      const sp = P.dash > 0 ? PL.dash.sp : PL.sp * st().speed;
      DE.move(g, T, P, (P.dash > 0 ? P.ax : mx) * sp * dt, (P.dash > 0 ? P.ay : my) * sp * dt, PL.r);
      P.dash = Math.max(0, P.dash - dt); P.inv = Math.max(0, P.inv - dt); P.dashCd = Math.max(0, P.dashCd - dt);
      const [pcx, pcy] = cellOf(P.x, P.y); flow.update(pcx, pcy, 160); reveal();
      fireWeapons(dt);
      // waves while the door is shut (none on vault floors); their warnings count down even when you can't see them
      if (!open && F.purpose !== 'vault' && (S.waveT -= dt) <= 0) { S.waveT = DD.WAVE.every(S.depth); wave(); }
      for (let i = swirls.length - 1; i >= 0; i--) { const w = swirls[i]; if ((w.t -= dt) <= 0) { swirls.splice(i, 1); if (!open) mons.push(mk(w.kind, w.x, w.y, true)); count(); } }
      // monsters (only near ones think; far ones wait where they are)
      for (const m of [...mons]) {
        m.t += dt; m.flash = Math.max(0, m.flash - dt); if (m.born) m.born = Math.max(0, m.born - dt);
        const dx = P.x - m.x, dy = P.y - m.y, dist = Math.hypot(dx, dy) || 1;
        if (dist > T * 16 && !m.d.boss) continue;
        const [mcx, mcy] = cellOf(m.x, m.y); m.cell = [mcx, mcy];
        if (m.state === 'sleep') { if (dist < T * 6.5 && DE.los(g, mcx, mcy, pcx, pcy)) wake(m); continue; }
        if (m.state === 'disguised') { if (dist < T * 1.25) wakeMimic(m); continue; }
        if (m.stun > 0) { m.stun -= dt; continue; }
        let vx = 0, vy = 0;
        // where to walk: straight at you if it can see you up close, otherwise downhill on the shared flow field
        const toward = () => { if (dist < T * 3 && DE.los(g, mcx, mcy, pcx, pcy)) return [dx / dist, dy / dist];
          const n = flow.next(mcx, mcy); if (!n) return [dx / dist, dy / dist]; const tx = (n[0] + .5) * T - m.x, ty = (n[1] + .8) * T - m.y, l = Math.hypot(tx, ty) || 1; return [tx / l, ty / l]; };
        const ai = m.d.ai;
        if (m.kb > 0) { m.kb -= dt; vx = m.kx; vy = m.ky; }
        else if (ai === 'chase' || ai === 'split') { const [ux, uy] = toward(); vx = ux * m.sp; vy = uy * m.sp; }
        else if (ai === 'swoop') { const [ux, uy] = toward(), s = Math.sin(m.t * 5) * .9; vx = (ux - uy * s) * m.sp; vy = (uy + ux * s) * m.sp; }
        else if (ai === 'pack' || ai === 'mimic') {
          if (m.state === 'back') { vx = -dx / dist * m.sp * .7; vy = -dy / dist * m.sp * .7; if ((m.st -= dt) <= 0) m.state = 'walk'; }
          else { const [ux, uy] = toward(); vx = ux * m.sp; vy = uy * m.sp; } }
        else if (ai === 'charge') {
          m.st -= dt;
          if (m.state === 'walk') { const [ux, uy] = toward(); vx = ux * m.sp; vy = uy * m.sp; if (m.st <= 0 && dist < T * 5 && DE.los(g, mcx, mcy, pcx, pcy)) { m.state = 'aim'; m.st = .55; m.cx = dx / dist; m.cy = dy / dist; } }
          else if (m.state === 'aim') { if (m.st <= 0) { m.state = 'charge'; m.st = .45; } }
          else { vx = m.cx * 340; vy = m.cy * 340; if (m.st <= 0) { m.state = 'walk'; m.st = 1.4 + R() * 1.2; } }
        } else if (ai === 'shoot') {
          m.cd -= dt; const see = DE.los(g, mcx, mcy, pcx, pcy);
          if (m.state === 'aim') { m.st -= dt; if (m.st <= 0) { m.state = 'walk'; m.cd = 1.6 + R() * .8; shoot(m, 'knife', Math.atan2(P.y - 20 - (m.y - 20), P.x - m.x), 270); } }
          else if (see && dist < T * 6) { const away = dist < T * 2.6 ? -1 : dist > T * 4 ? 1 : 0, s = Math.sin(m.t * 1.3) > 0 ? 1 : -1;
            vx = (dx / dist * away - dy / dist * s * .6) * m.sp; vy = (dy / dist * away + dx / dist * s * .6) * m.sp; if (m.cd <= 0) { m.state = 'aim'; m.st = .5; } }
          else { const [ux, uy] = toward(); vx = ux * m.sp; vy = uy * m.sp; }
        } else if (ai === 'ghost') {
          m.phase += dt; const cyc = m.phase % 3.8; m.fade = cyc > 2.4; vx = dx / dist * m.sp; vy = dy / dist * m.sp;
        } else if (ai === 'brute') {
          m.cd -= dt;
          if (m.state === 'wind') { m.st -= dt; if (m.st <= 0) { m.state = 'walk'; m.cd = 2.4; slam(m, 92, m.d.dmg); } }
          else { const [ux, uy] = toward(); vx = ux * m.sp; vy = uy * m.sp; if (dist < T * 2.1 && m.cd <= 0) { m.state = 'wind'; m.st = .8; } }
        } else if (ai === 'boss') bossAI(m, dt, dist, dx, dy, toward, v => { vx = v[0]; vy = v[1]; });
        if (vx || vy) {
          if (ai === 'ghost') { m.x = Math.max(T, Math.min(g.w * T - T, m.x + vx * dt)); m.y = Math.max(T * 2, Math.min(g.h * T - T, m.y + vy * dt)); }
          else { const hit = DE.move(g, T, m, vx * dt, vy * dt, Math.min(m.d.r, 18)); if (hit && m.state === 'charge') { m.state = 'walk'; m.st = 1; m.stun = .45; fxS.shake(3, .12); } }
        }
        // contact damage
        if (!m.fade && !m.born && m.state !== 'wind' && Math.hypot(P.x - m.x, (P.y - 12) - (m.y - m.d.r * .7)) < m.d.r + PL.r + 2) {
          hurt(m.d.dmg + DD.scale(S.depth).dmg, m.x, m.y); if (ai === 'pack' || ai === 'mimic') { m.state = 'back'; m.st = .5; } }
      }
      // keep monsters from piling onto one spot (only awake, nearby ones)
      const near = mons.filter(m => m.state !== 'sleep' && m.state !== 'disguised' && Math.abs(m.x - P.x) < VW && Math.abs(m.y - P.y) < VH);
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) { const a = near[i], b = near[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.d.r + b.d.r) * .8;
        if (d > 0 && d < min) { const p = (min - d) / 2 / d; if (!a.d.boss) DE.move(g, T, a, -dx * p, -dy * p, 10); if (!b.d.boss) DE.move(g, T, b, dx * p, dy * p, 10); } }
      // shots
      for (let i = shots.length - 1; i >= 0; i--) { const o = shots[i]; o.t += dt; o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.t > 5 || DE.solid(g, Math.floor(o.x / T), Math.floor(o.y / T))) { shots.splice(i, 1); fxW.burst(o.x, o.y, { n: 4, colors: ['#c9a6ff'], speed: 80, grav: 0, size: 3, life: .25 }); continue; }
        if (Math.hypot(o.x - P.x, o.y - (P.y - 20)) < 13) { shots.splice(i, 1); hurt(1, o.x, o.y); } }
      // spikes: down 1.6 s, warning 0.5 s, up 0.5 s
      for (const s of spikes) { s.ph = (s.ph + dt) % 2.6; s.up = s.ph > 2.1; s.warn = s.ph > 1.6 && !s.up;
        if (s.up && pcx === s.cx && pcy === s.cy && P.dash <= 0) hurt(1, s.x, s.y - T / 2); }
      // gems: scatter, settle, then the magnet pulls them in
      const mag = st().magnet;
      for (let i = gems.length - 1; i >= 0; i--) { const o = gems[i]; o.t += dt; const dx = P.x - o.x, dy = P.y - 20 - o.y, d = Math.hypot(dx, dy);
        if (o.t > .35 && d < mag) { const s = 520 * (1 - d / mag * .5); o.vx = dx / d * s; o.vy = dy / d * s; } else { o.vx *= Math.exp(-dt * 4); o.vy *= Math.exp(-dt * 4); }
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (d < 18 && o.t > .2) { gems.splice(i, 1); S.score += o.v; gainXP(o.v >= DD.GEM.big ? DD.XP.big : DD.XP.small); if (S.gemTick == null || S.t - S.gemTick > .05) { S.gemTick = S.t; api.sfx('tick'); } setHudSoon(); } }
      for (let i = drops.length - 1; i >= 0; i--) { const o = drops[i]; o.t += dt; if (Math.hypot(o.x - P.x, o.y - P.y) < 30 && P.hp < P.max) { drops.splice(i, 1); heal(1); } }
      if (altar && !altar.used && Math.hypot(altar.x - P.x, altar.y + 6 - P.y) < T * .95) { altar.used = true; chestReward('แท่นบูชาโบราณ'); }
      // floor chests open when you walk up to them (any side). Before 15 Nov only a sword/axe swing opened them, so a
      // dagger/staff/wand build could never open one.
      for (const c of [...chests]) if (Math.abs(c.x - P.x) < T * 1.25 && Math.abs((c.y - 20) - (P.y - 22)) < T * 1.25) openChest(c);
      if (bossChest && Math.hypot(bossChest.x - P.x, bossChest.y - P.y) < T * .8) { bossChest = null; api.sfx('level'); chestReward('หีบของบอส'); }
      if (relic && Math.hypot(relic.x - P.x, relic.y - P.y) < T * .8) takeRelic();
      // the door
      if (open && Math.abs(P.x - (F.exit.x + .5) * T) < T * .7 && P.y < (F.exit.y + 1.6) * T) { S.mode = 'trans'; trans = .7; fxS.flash('#000', .6); api.sfx('level'); }
    }
    let hudSoon = 0; const setHudSoon = () => { hudSoon = .12; };
    function shoot(m, kind, ang, sp) { shots.push({ x: m.x, y: m.y - m.d.r - 6, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, kind, t: 0, a: ang }); }
    function slam(m, rad, dmg) { fxS.shake(8, .25); fxW.burst(m.x, m.y, { n: 24, colors: ['#c77d0a', '#8a5a2b', '#fff'], speed: 260, grav: 300, size: 5, shape: 'puff', life: .5 });
      if (Math.hypot(P.x - m.x, P.y - m.y) < rad) hurt(dmg, m.x, m.y); }
    // bosses: a short repeating list of moves, a little faster with depth
    function bossAI(m, dt, dist, dx, dy, toward, set) {
      m.cd -= dt * (1 + Math.min(.6, S.depth * .02));
      if (m.state === 'aim') { m.st -= dt; if (m.st <= 0) { m.state = 'charge'; m.st = .6; } return; }
      if (m.state === 'charge') { m.st -= dt; set([m.cx * 480, m.cy * 480]); if (m.st <= 0) { m.state = 'walk'; slam(m, 80, 1); } return; }
      if (m.state === 'wind') { m.st -= dt; if (m.st <= 0) { m.state = 'walk'; slam(m, 120, 1); } return; }
      const [ux, uy] = toward(); set([ux * m.sp, uy * m.sp]);
      if (m.cd > 0) return;
      m.move = (m.move || 0) + 1; const a0 = Math.atan2(P.y - 20 - (m.y - m.d.r), P.x - m.x);
      if (m.d.boss === 'cyclops') {
        const k = m.move % 3;
        if (k === 1) { const n = 10 + (S.depth >> 2), o = R(); for (let i = 0; i < n; i++) shoot(m, 'orb', (i + o) / n * 6.283, 125); m.cd = 2.4; }
        else if (k === 2) { for (const s of [-.25, 0, .25]) shoot(m, 'orb', a0 + s, 200); m.cd = 1.6; }
        else { if (mons.length < 24) for (const s of [-1, 1]) { const x = m.x + s * 60; if (!DE.blocked(g, T, x, m.y, 12)) mons.push(mk('slime', x, m.y, true)); } count(); setHud(); m.cd = 2.2; }
      } else {
        const k = m.move % 3;
        if (k === 1) { m.state = 'aim'; m.st = .7; m.cx = dx / dist; m.cy = dy / dist; m.cd = 2.6; }
        else if (k === 2) { m.state = 'wind'; m.st = .9; m.cd = 2.2; }
        else { const n = 14, o = R(); for (let i = 0; i < n; i++) shoot(m, 'fire', (i + o) / n * 6.283, 150); m.cd = 2.0; }
      }
    }

    // ---------- drawing ----------
    const mmScale = () => Math.max(2, Math.min(3, Math.floor((tall ? 130 : 150) / g.w)));
    function draw() {
      fxS.pre(ctx); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0c0812'; ctx.fillRect(0, 0, W, H);
      if (!g) { fxS.post(ctx, W, H); return; }
      blit(mapC, cam.x / DD.SCALE, cam.y / DD.SCALE, VW / DD.SCALE, VH / DD.SCALE, DD.SCALE * Z);
      ctx.save(); if (Z !== 1) ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y); fxW.pre(ctx);
      // floor layer: door, spikes, telegraphs
      dk(open ? DD.T.arch : DD.T.door, (F.exit.x + .5) * T, (F.exit.y + 1) * T);
      if (open) { txt(ctx, 'ลงต่อ', (F.exit.x + .5) * T, (F.exit.y + 1) * T + 18 + Math.abs(Math.sin(S.t * 5)) * 4, 14, PAL.yel, 'center', 800); }
      for (const s of spikes) if (cam.sees(s.x, s.y)) { dk(DD.T.spikes, s.x, s.y, DD.SCALE, { alpha: s.up ? 1 : s.warn ? (Math.floor(S.t * 12) % 2 ? .9 : .45) : .4 });
        if (s.up) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(s.x - T / 2 + 6, s.y - T + 6, T - 12, T - 12); } }
      for (const w of swirls) if (cam.sees(w.x, w.y)) drawSwirl(w);
      for (const n of novas) { ctx.strokeStyle = `rgba(120,200,255,${.8 * (1 - n.t / (n.dur + .15))})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(P.x, P.y - 14, n.r, n.r * .75, 0, 0, 7); ctx.stroke(); }
      for (const qk of quakes) { const k = Math.min(1, qk.t / .12); ctx.fillStyle = `rgba(199,125,10,${.35 * (1 - qk.t / .5)})`; ctx.beginPath(); ctx.ellipse(qk.x, qk.y, qk.r * k, qk.r * k * .7, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(255,210,63,${.8 * (1 - qk.t / .5)})`; ctx.lineWidth = 3; ctx.stroke(); }
      for (const m of mons) { if (!cam.sees(m.x, m.y, 200)) continue;
        if (m.state === 'aim') { ctx.save(); ctx.strokeStyle = 'rgba(255,77,109,.45)'; ctx.lineWidth = m.d.boss ? 26 : 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(m.x, m.y - 10);
          const L = m.d.ai === 'shoot' ? Math.hypot(P.x - m.x, P.y - m.y) : m.d.boss ? 290 : 160, ax = m.d.ai === 'shoot' ? (P.x - m.x) / Math.hypot(P.x - m.x, P.y - m.y) : m.cx, ay = m.d.ai === 'shoot' ? (P.y - m.y) / Math.hypot(P.x - m.x, P.y - m.y) : m.cy;
          ctx.lineTo(m.x + ax * L, m.y - 10 + ay * L); ctx.stroke(); ctx.restore(); }
        if (m.state === 'wind') { const rad = m.d.boss ? 120 : 92, k = 1 - m.st / (m.d.boss ? .9 : .8); ctx.fillStyle = `rgba(255,77,109,${.12 + k * .25})`; ctx.beginPath(); ctx.ellipse(m.x, m.y, rad * k, rad * k * .6, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(255,77,109,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(m.x, m.y, rad, rad * .6, 0, 0, 7); ctx.stroke(); } }
      // everything with feet, back to front
      const list = [];
      for (const p of props) if (cam.sees(p.x, p.y)) list.push([p.y, () => dk(p.id, p.x, p.y + 3)]);
      for (const c of chests) if (cam.sees(c.x, c.y)) list.push([c.y, () => dk(DD.T.chest, c.x, c.y + 3)]);
      if (altar && cam.sees(altar.x, altar.y)) list.push([altar.y, () => { dk(DD.T.altar, altar.x, altar.y + 3, DD.SCALE, { alpha: altar.used ? .5 : 1 });
        if (!altar.used) { ctx.fillStyle = `rgba(63,210,155,${.25 + Math.sin(S.t * 4) * .15})`; ctx.beginPath(); ctx.ellipse(altar.x, altar.y, 34, 12, 0, 0, 7); ctx.fill(); } }]);
      for (const o of drops) if (cam.sees(o.x, o.y)) list.push([o.y, () => dk(DD.T.potion, o.x, o.y + 4 - Math.abs(Math.sin(o.t * 5)) * 4)]);
      for (const c of [bossChest, relic]) if (c && cam.sees(c.x, c.y)) list.push([c.y, () => { const glow = .35 + Math.sin(S.t * 5) * .2;
        ctx.fillStyle = `rgba(255,210,63,${glow})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, 34, 13, 0, 0, 7); ctx.fill(); dk(DD.T.bigChest, c.x, c.y + 3, 3.4);
        txt(ctx, c === relic ? 'อาวุธใหม่!' : 'หีบบอส', c.x, c.y - 62 - Math.abs(Math.sin(S.t * 4)) * 4, 14, PAL.yel, 'center', 800); }]);
      for (const m of mons) if (cam.sees(m.x, m.y, 80)) list.push([m.y, () => drawMon(m)]);
      list.push([P.y, drawPlayer]);
      list.sort((a, b) => a[0] - b[0]).forEach(o => o[1]());
      for (const a of arcs) { const k = a.t / a.dur, cx = P.x, cy = P.y - 22, a1 = a.full ? a.a + k * 6.283 : a.a - a.span + k * a.span * 2;
        ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${.75 * (1 - k)})`; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath();
        if (a.full) ctx.arc(cx, cy, a.reach * .8, 0, 6.283); else ctx.arc(cx, cy, a.reach * .78, a.a - a.span, a1); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a1 + Math.PI / 2); dk(a.tile, 0, -a.reach * .18, 3); ctx.restore(); }
      for (const [id, a] of Object.entries(S.arms)) if (DD.ARMS[id].kind === 'orbit' && a.active) { const w = wp(id), r = w.r * st().area;
        for (let i = 0; i < w.n; i++) { const an = a.ang + i * 6.283 / w.n, x = P.x + Math.cos(an) * r, y = P.y - 22 + Math.sin(an) * r * .75;
          ctx.save(); ctx.translate(x, y + 14); ctx.rotate(S.t * 14); dk(w.tile, 0, 14, 2.6); ctx.restore(); } }
      for (const o of pshots) { if (o.kind === 'bolt') { ctx.fillStyle = 'rgba(120,200,255,.35)'; ctx.beginPath(); ctx.arc(o.x, o.y, 11, 0, 7); ctx.fill(); drawPixAt(ctx, pxa('d_bolt'), o.x, o.y + 8, 3); }
        else { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a + Math.PI / 2); dk(o.tile, 0, 10, o.kind === 'lance' ? 3 : 2.4); ctx.restore(); } }
      for (const o of gems) if (cam.sees(o.x, o.y)) drawPixAt(ctx, pxa(o.v >= DD.GEM.big ? 'coin' : 'gem'), o.x, o.y + 6, o.v >= DD.GEM.big ? 2.5 : 2);
      for (const o of shots) { if (o.kind === 'knife') { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.a + Math.PI / 2); dk(103, 0, 10, 2.2); ctx.restore(); } else drawPixAt(ctx, pxa(o.kind === 'fire' ? 'd_fire' : 'd_orb'), o.x, o.y + 8, 3); }
      fxW.post(ctx, g.w * T, g.h * T); ctx.restore();
      // fog, torchlight, then the screen layer
      ctx.imageSmoothingEnabled = true; blit(fog.c, cam.x / T, cam.y / T, VW / T, VH / T, T * Z); ctx.imageSmoothingEnabled = false;
      // a spawn warning inside unexplored fog is still shown (it would otherwise be hidden under the fog)
      let fogged = false; for (let i = 0; i < swirls.length; i++) { const w = swirls[i]; if (!fog.seen[Math.floor(w.y / T) * g.w + Math.floor(w.x / T)] && cam.sees(w.x, w.y)) { fogged = true; break; } }
      if (fogged) { ctx.save(); if (Z !== 1) ctx.scale(Z, Z); ctx.translate(-cam.x, -cam.y);
        for (let i = 0; i < swirls.length; i++) { const w = swirls[i]; if (!fog.seen[Math.floor(w.y / T) * g.w + Math.floor(w.x / T)] && cam.sees(w.x, w.y)) drawSwirl(w); } ctx.restore(); }
      // torchlight: one cached gradient around the origin, moved to the player
      if (lgW !== W || lgH !== H || lgZ !== Z || lgD !== S.depth) { lgW = W; lgH = H; lgZ = Z; lgD = S.depth; lg = ctx.createRadialGradient(0, 0, 90 * Z, 0, 0, Math.max(W, H) * .75);
        lg.addColorStop(0, 'rgba(12,8,20,0)'); lg.addColorStop(1, `rgba(12,8,20,${Math.min(.62, .25 + S.depth * .03)})`); }
      const sx = (P.x - cam.x) * Z, sy = (P.y - 24 - cam.y) * Z; ctx.translate(sx, sy); ctx.fillStyle = lg; ctx.fillRect(-sx, -sy, W, H); ctx.translate(-sx, -sy);
      if (!S.big) { drawPointer(); drawMarkers(); drawBossBar(); }
      if (!TOUCH) {
        drawMinimap(); drawXP();
        if (stick) { ctx.globalAlpha = .5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(stick.x0, stick.y0, 40, 0, 7); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(stick.x, stick.y, 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        if (!S.big) txt(ctx, 'Art: Kenney Tiny Dungeon (CC0) · ตัวละคร LimeZu', 8, H - 10, 11, 'rgba(255,255,255,.7)', 'left', 400);
      } else if (S.big) { drawMinimap();
        txt(ctx, 'แตะที่ไหนก็ได้เพื่อกลับไปเล่น', W / 2, H - L.sb - 40, 14, '#fff', 'center', 600);
        txt(ctx, 'Art: Kenney Tiny Dungeon (CC0) · ตัวละคร LimeZu', W / 2, H - L.sb - 16, 11, 'rgba(255,255,255,.7)', 'center', 400); }
      else if (S.mode === 'intro') txt(ctx, 'Art: Kenney Tiny Dungeon (CC0) · ตัวละคร LimeZu', W / 2, H - L.sb - 16, 11, 'rgba(255,255,255,.7)', 'center', 400);
      else touchUI();
      fxS.post(ctx, W, H);
    }
    let lg = null, lgW = -1, lgH = 0, lgZ = 0, lgD = 0;
    // draw part of an offscreen canvas (map, fog) at k screen px per source px, clipped to the image: a camera that
    // centres a small map asks for pixels outside it, which some Safari versions refuse to draw at all
    function blit(img, sx, sy, sw, sh, k) {
      const x0 = Math.max(0, sx), y0 = Math.max(0, sy), x1 = Math.min(img.width, sx + sw), y1 = Math.min(img.height, sy + sh); if (x1 <= x0 || y1 <= y0) return;
      ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * k, (y0 - sy) * k, (x1 - x0) * k, (y1 - y0) * k);
    }
    function drawSwirl(w) { const k = 1 - w.t / DD.WAVE.warn; ctx.save(); ctx.translate(w.x, w.y - 6); ctx.rotate(S.t * 6);
      ctx.strokeStyle = `rgba(160,90,255,${.35 + k * .55})`; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 8 + k * 12, i * 2.09, i * 2.09 + 1.3); ctx.stroke(); }
      ctx.fillStyle = `rgba(160,90,255,${.15 + k * .25})`; ctx.beginPath(); ctx.ellipse(0, 0, 14 + k * 10, 8 + k * 5, 0, 0, 7); ctx.fill(); ctx.restore(); }
    // XP bar across the top, Vampire-Survivors style
    function drawXP() {
      const need = DD.XP.need(S.lv), k = Math.min(1, S.xp / need);
      ctx.fillStyle = 'rgba(12,8,20,.75)'; ctx.fillRect(0, 0, W, 10); ctx.fillStyle = '#4cc3ff'; ctx.fillRect(1, 1, (W - 2) * k, 8);
      txt(ctx, `Lv ${S.lv}`, 8, 20, 12, '#fff', 'left', 800);
    }
    function drawMon(m) {
      const d = m.d, k = d.sc * (m.born ? 1 - m.born / .3 * .5 : 1), w = 16 * k;
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(m.x, m.y, w * .3, 5, 0, 0, 7); ctx.fill();
      if (m.state === 'disguised') { dk(DD.T.chest, m.x, m.y + 3); return; }
      const bob = d.ai === 'swoop' ? Math.sin(m.t * 8) * 5 - 14 : d.ai === 'ghost' ? Math.sin(m.t * 3) * 4 - 10 : (d.ai === 'chase' || d.ai === 'split') ? -Math.abs(Math.sin(m.t * 6)) * 3 : 0;
      const shake = m.state === 'aim' || m.state === 'wind' ? Math.sin(S.t * 60) * 2 : 0, wob = Math.sin(m.t * 6) * .06;
      const o = { flip: P.x < m.x, alpha: m.fade ? .22 : m.flash > 0 ? .45 : 1,
        sx: d.ai === 'chase' || d.ai === 'split' ? 1 + wob : 1, sy: d.ai === 'chase' || d.ai === 'split' ? 1 - wob : d.ai === 'swoop' ? 1 + Math.sin(m.t * 16) * .08 : 1 };
      dk(d.tile, m.x + shake, m.y + bob + 2, k, o);
      if (d.tint === 'big') { ctx.globalAlpha = .18; dk(d.tile, m.x, m.y + bob + 2, k * 1.04, o); ctx.globalAlpha = 1; }
      if (m.state === 'sleep' && Math.sin(m.t * 2) > .3) txt(ctx, 'z', m.x + w * .35, m.y - w - 2 - (m.t * 10 % 8), 14, 'rgba(255,255,255,.75)', 'center', 800);
      if (m.stun > 0) txt(ctx, '*', m.x, m.y - w - 6, 18, PAL.yel, 'center', 800);
      if (!d.boss && m.max > 2 && m.hp < m.max) { const bw = Math.min(56, w * .7); rrect(ctx, m.x - bw / 2, m.y + 6, bw, 6, 2, '#2b2140'); ctx.fillStyle = PAL.red; ctx.fillRect(m.x - bw / 2 + 1, m.y + 7, (bw - 2) * Math.max(0, m.hp / m.max), 4); }
    }
    function drawPlayer() {
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(P.x, P.y, 12, 4, 0, 0, 7); ctx.fill();
      // a ring at your feet so you can find yourself in a crowd
      ctx.strokeStyle = 'rgba(255,210,63,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y, 17, 6, 0, 0, 7); ctx.stroke();
      const blink = P.inv > 0 && S.mode === 'play' && Math.floor(S.t * 16) % 2;
      drawChar(ctx, who, P.moving || P.dash > 0 ? 'run' : 'idle_anim', P.dir, S.t, P.x, P.y, 2, { alpha: blink ? .35 : 1, rot: S.mode === 'over' ? .5 : 0 });
    }
    // an arrow at the screen edge: to the door once it's open, else to a waiting relic or boss chest
    function drawPointer() {
      let tx = null, ty = null, col = PAL.green;
      if (open) { tx = (F.exit.x + .5) * T; ty = (F.exit.y + 1) * T; }
      else if (relic) { tx = relic.x; ty = relic.y; col = PAL.yel; }
      else if (bossChest) { tx = bossChest.x; ty = bossChest.y; col = PAL.yel; }
      if (tx === null) return; const sx = (tx - cam.x) * Z, sy = (ty - cam.y) * Z; if (inView(sx, sy)) return;
      // where the ray from the view centre meets the edge box (desktop: inset 28 px from the canvas edges)
      edgeAt(sx, sy, 0);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ea); ctx.fillStyle = col; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 3; ctx.globalAlpha = .7 + Math.sin(S.t * 6) * .3;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    function drawMinimap() {
      const big = S.big, s = big ? Math.max(TOUCH ? 2 : 3, Math.floor(TOUCH ? Math.min((W - L.sl - L.sr - 24) / g.w, (H - L.st - L.sb - 220) / g.h) : Math.min((W - 40) / g.w, (H - 80) / g.h))) : mmScale(), w = g.w * s, h = g.h * s;
      const x = big ? (W - w) / 2 : W - w - 10, y = big ? (H - h) / 2 : 18;
      if (big) { ctx.fillStyle = 'rgba(12,8,20,.72)'; ctx.fillRect(0, 0, W, H); }
      rrect(ctx, x - 5, y - 5, w + 10, h + 10, 8, big ? '#1b1420' : 'rgba(12,8,20,.6)', 'rgba(255,255,255,.35)');
      ctx.drawImage(mm.c, x, y, w, h);
      const dot = (cx, cy, c, r = 2) => { ctx.fillStyle = c; ctx.fillRect(x + cx * s - r + s / 2, y + cy * s - r + s / 2, r * 2, r * 2); };
      if (fog.seen[F.exit.y * g.w + F.exit.x] || fog.seen[(F.exit.y + 1) * g.w + F.exit.x] || open) dot(F.exit.x, F.exit.y, open ? '#3fd29b' : '#c77d0a', big ? 4 : 3);
      if (altar && !altar.used && fog.seen[altar.cy * g.w + altar.cx]) dot(altar.cx, altar.cy, '#4cc3ff', big ? 4 : 3);
      for (const m of mons) if (m.state !== 'disguised' && (big && fog.seen[m.cell[1] * g.w + m.cell[0]] && m.state !== 'sleep')) dot(m.x / T - .5, m.y / T - .8, '#ff4d6d', big ? 3 : 2);
      dot(P.x / T - .5, P.y / T - .8, Math.floor(S.t * 4) % 2 ? '#ffd23f' : '#fff', big ? 4 : 3);
      if (big) { txt(ctx, `B${S.depth} · ${F.name} · ${F.w}×${F.h} ช่อง · สำรวจแล้ว ${Math.round(fog.seen.reduce((a, v, i) => a + (v && g.cells[i] === 1 ? 1 : 0), 0) / Math.max(1, g.cells.reduce((a, v) => a + (v === 1), 0)) * 100)}%`, W / 2, y - 18, 14, '#fff', 'center', 600);
        // legend under the map
        const items = [['#ffd23f', 'คุณ'], ['#3fd29b', 'ประตู (เปิด)'], ['#c77d0a', 'ประตู (ปิด)'], ['#4cc3ff', 'แท่นบูชา'], ['#ff4d6d', 'มอนสเตอร์']], ly = y + h + 18;
        const per = W < items.length * 92 + 20 ? 3 : items.length, cw = per < items.length ? Math.floor((W - L.sl - L.sr - 24) / per) : 92, lx0 = W / 2 - per * cw / 2;
        items.forEach(([c, t], i) => { const lx = lx0 + (i % per) * cw, ly2 = ly + Math.floor(i / per) * 20; ctx.fillStyle = c; ctx.fillRect(lx, ly2 - 4, 8, 8); txt(ctx, t, lx + 13, ly2, 12, '#fff', 'left', 400); }); }
    }
    function drawBossBar() {
      if (!boss) return; const w = Math.min(420, W - 40), x = (W - w) / 2, y = TOUCH ? L.bossY : H - 46;
      txt(ctx, boss.d.name, W / 2, y - 12, 15, '#fff', 'center', 800);
      rrect(ctx, x, y, w, 14, 6, '#2b2140', '#fff'); ctx.fillStyle = PAL.red; ctx.fillRect(x + 2, y + 2, (w - 4) * Math.max(0, boss.hp / boss.max), 10);
    }

    // ---------- loop ----------
    const perf = { n: 0, ms: 0, max: 0 };
    api.loop(dt => {
      const t0 = TEST ? performance.now() : 0;
      const d = fxS.step(dt); fxW.step(dt); if (dodgeT > 0) dodgeT -= dt;
      if (S.mode === 'play' && d) step(d);
      if (S.mode === 'play' && (bankT -= dt) <= 0) { bankT = 15; bank(); }
      else if (S.mode === 'trans') { trans -= dt; if (trans <= 0) { S.mode = 'play'; build(S.depth + 1); } }
      if (hudSoon > 0 && (hudSoon -= dt) <= 0) setHud();
      if (TOUCH && menuShown !== (S.mode === 'play' || S.mode === 'menu' || S.mode === 'pick' || S.mode === 'trans')) paintHud();
      if (g) cam.follow(P.x, P.y - 20, dt);
      draw();
      if (TEST && S.mode === 'play') { const ms = performance.now() - t0; perf.n++; perf.ms += ms; perf.max = Math.max(perf.max, ms); }
    });
    // the intro screen shows today's first floor behind the card
    (function ready() { if (!tile(0)) return setTimeout(ready, 40); build(1); S.mode = 'intro'; fog.revealAll(); })();
    layout(); setHud(); draw();
    const best = daily('best', 0);
    // start floor: ?floor= for tests, else the checkpoint picked on the intro card (B1, or the floor after a boss beaten today)
    function begin(id) {
      const start = Math.max(1, +((TEST && q.get('floor')) || cpPick));
      S.arms = { [id]: { lv: 1, t: .5 } }; S.pending = perk('lv') + Math.floor((start - 1) / DD.CHECKPOINT.every) * DD.CHECKPOINT.catchUp; build(start);
      S.mode = 'play'; S.t0 = performance.now(); if (S.pending) { S.lv += S.pending; api.after(.4, levelPick); } }
    const cpMax = daily('cp', 0), cps = [1]; for (let f = DD.CHECKPOINT.every; f <= cpMax; f += DD.CHECKPOINT.every) cps.push(f + 1);
    // the intro card is removed before go() runs, so remember the chosen floor as soon as it changes
    let cpPick = cps[cps.length - 1]; root.addEventListener('change', e => { if (e.target.name === 'dgncp') cpPick = +e.target.value; });
    const cpHTML = cps.length > 1 ? `<div class="dgn-cp" role="radiogroup" aria-label="เริ่มที่ชั้น">${cps.map((f, i) => `<label><input type="radio" name="dgncp" value="${f}"${i === cps.length - 1 ? ' checked' : ''}>
      <span>B${f}${f > 1 ? ` <small>+${Math.floor((f - 1) / DD.CHECKPOINT.every) * DD.CHECKPOINT.catchUp} เลเวล</small>` : ''}</span></label>`).join('')}</div>` : '';
    css.textContent += `.dgn-cp{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:6px 0}.dgn-cp label{display:inline-flex}.dgn-cp input{position:absolute;opacity:0}
      .dgn-cp span{min-height:44px;min-width:64px;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid #2b2140;border-radius:10px;padding:2px 10px;font-weight:700;cursor:pointer;background:#fff}
      .dgn-cp span small{font-weight:500;font-size:11px;color:#6b5f7a}.dgn-cp input:checked+span{background:#ffd23f}.dgn-cp input:focus-visible+span{outline:3px solid #4cc3ff}`;
    // combat skill tier 1+: choose the starting weapon from everything you've ever found (lasting progression)
    const startArms = perk('pick') ? Object.keys(DD.ARMS).filter(id => codex.found[id]) : ['sword'];
    const found = Object.keys(DD.ARMS).filter(id => codex.found[id]).length;
    api.intro({ how: `<p><b>ดันเจี้ยนประจำวัน ${day}</b> · แผนที่ใหม่ทุกวัน ทุกคนได้ดันเจี้ยนเดียวกัน${best ? ` · สถิติวันนี้ของคุณ <b>B${best}</b>` : ''}</p>
      <p><b>คุณแค่เดินกับหลบ อาวุธโจมตีเอง</b> · เก็บอัญมณีเพื่อเลเวลอัป แล้วเลือกอาวุธหรือพลังเพิ่ม (มีได้อย่างละ 4) · อาวุธ Lv 5 + พลังคู่ของมัน = วิวัฒนาการจากหีบบอส</p>
      <p>ปราบให้ครบเป้าเพื่อเปิดประตู มอนสเตอร์จะโผล่ออกมาเป็นระลอก (มีวงม่วงเตือนก่อนเสมอ) · ทุก 5 ชั้นมีบอส · ชั้นหลังบอสเป็นห้องสมบัติ</p>
      <p>${TOUCH ? `วางนิ้วที่ครึ่ง${L.left ? 'ขวา' : 'ซ้าย'}ของจอแล้วลากเพื่อเดิน · ปุ่ม "หลบ" มุม${L.left ? 'ซ้าย' : 'ขวา'}ล่าง · ปุ่ม "เมนู" มุมขวาบน มีแผนที่และปุ่มออก · ตอนเลือกพลัง แตะการ์ดที่ต้องการ`
        : 'WASD / ลูกศร เดิน · Shift หรือ Space = หลบ · M = แผนที่ · ตอนเลือก: 1 2 3 · R = สุ่มใหม่'}</p>
      ${cpHTML ? `<p><b>จุดเช็กพอยต์วันนี้</b> · ปราบบอสแล้ว เริ่มชั้นถัดไปได้ (ได้เลเวลชดเชย)</p>${cpHTML}` : ''}
      <p class="muted">คลังอาวุธ: พบแล้ว ${found}/${Object.keys(DD.ARMS).length} อาวุธ · วิวัฒนาการแล้ว ${Object.keys(codex.evo).length} · ลึกสุด B${codex.best} · เล่นมาแล้ว ${codex.runs} รอบ${perk('pick') ? '' : ' · ถึงขั้นการต่อสู้ 1 จะเลือกอาวุธเริ่มต้นได้'}</p>`,
      buttons: startArms.map((id, i) => ({ label: startArms.length > 1 ? `เริ่มด้วย${DD.ARMS[id].name}` : 'ลงดันเจี้ยน', primary: i === 0, go() { begin(id); } })) });

    if (TEST) window.__dgn = { root,
      state: () => ({ mode: S.mode, depth: S.depth, purpose: F && F.purpose, size: F && [F.w, F.h], hp: P.hp, max: P.max, left, open, mons: mons.length, score: S.score, lv: S.lv, xp: S.xp, arms: S.arms, pas: S.pas, fk: S.fk, target: S.target, swirls: swirls.length, relic: !!relic, bossChest: !!bossChest, boss: !!boss, x: P.x, y: P.y, dash: P.dash > 0 || P.dashCd > 0 }),
      god(on = true) { S.god = on; }, killAll() { for (const m of [...mons]) if (m.state !== 'disguised') kill(m); },
      toExit() { P.x = (F.exit.x + .5) * T; P.y = (F.exit.y + 1.4) * T; }, toBoss() { const b = mons.find(m => m.d.boss); if (b) { P.x = b.x; P.y = b.y + T * 3; } },
      nearest() { let b = null, bd = 1e9; for (const m of mons) { if (m.state === 'disguised') continue; const d = Math.hypot(m.x - P.x, m.y - P.y); if (d < bd) { bd = d; b = m; } } return b ? { dx: b.x - P.x, dy: b.y - P.y, d: bd, kind: b.kind } : null; },
      perf: () => ({ frames: perf.n, avg: +(perf.ms / Math.max(1, perf.n)).toFixed(2), max: +perf.max.toFixed(1) }), perfReset() { perf.n = perf.ms = perf.max = 0; },
      awakeAll() { for (const m of mons) if (m.state === 'sleep') wake(m); },
      toMon() { const n = mons.find(m => m.state !== 'disguised'); if (n) { P.x = n.x; P.y = n.y + 50; P.ax = 0; P.ay = -1; } return !!n; },
      openDoor() { S.fk = S.target; S.bossDown = true; checkDoor(); }, xp(n) { gainXP(n); }, toChest() { const c = bossChest || relic; if (c) { P.x = c.x; P.y = c.y; } },
      chests: () => chests.map(c => ({ cx: c.cx, cy: c.cy })), toCell(cx, cy) { if (DE.solid(g, cx, cy) || g.block[cy * g.w + cx]) return false; P.x = (cx + .5) * T; P.y = (cy + .9) * T; return true; },
      give(id, lv = 1, evo) { if (DD.ARMS[id]) S.arms[id] = { lv, t: .2, evo }; else S.pas[id] = lv; setHud(); }, wave() { wave(); },
      toAltar() { if (altar) { P.x = altar.x; P.y = altar.y + T * .5; } }, pick: i => S.onPick?.(i), hurt: n => { P.inv = 0; hurt(n, P.x + 1, P.y); },
      // touch layout in CSS px relative to the viewport: stick = its resting ring (zone = where a thumb-down starts it),
      // dodge, menu; view = tiles visible across / down at the current zoom
      controls() { const r = cv.getBoundingClientRect(), k = r.width / W, R = (x, y, w, h) => ({ x: r.left + x * k, y: r.top + y * k, w: w * k, h: h * k });
        const hm = L.home, d = L.dodge, mb = menuBtn && !menuBtn.hidden ? menuBtn.getBoundingClientRect() : null;
        return { touch: TOUCH, stick: TOUCH ? { ...R(hm.x - hm.r, hm.y - hm.r, hm.r * 2, hm.r * 2), zone: R(L.left ? W / 2 : 0, 0, W / 2, H) } : null,
          dodge: TOUCH ? R(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2) : null, menu: mb ? { x: mb.left, y: mb.top, w: mb.width, h: mb.height } : null,
          view: { across: +(VW / T).toFixed(2), down: +(VH / T).toFixed(2), zoom: +Z.toFixed(3) }, safe: { l: L.sl, t: L.st, r: L.sr, b: L.sb }, canvas: { x: r.left, y: r.top, w: r.width, h: r.height } }; },
      // a spawn warning dx, dy tiles from the player (for the edge-marker check); markers() = how many were drawn last frame
      swirl(dx, dy) { const [cx, cy] = cellOf(P.x, P.y), x = cx + dx, y = cy + dy; if (DE.solid(g, x, y)) return false; swirls.push({ kind: 'slime', x: (x + .5) * T, y: (y + .8) * T, t: DD.WAVE.warn }); return true; },
      swirlOff() { for (let r = 4; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (const dx of [-r, r]) { const [cx, cy] = cellOf(P.x, P.y), x = cx + dx, y = cy + dy;
        if (DE.solid(g, x, y) || flow.dist(x, y) < 0) continue; const wx = (x + .5) * T, wy = (y + .8) * T; if (inView((wx - cam.x) * Z, (wy - 6 - cam.y) * Z)) continue;
        swirls.push({ kind: 'slime', x: wx, y: wy, t: DD.WAVE.warn }); return { dx, dy }; } return null; },
      markers: () => mkN, menu() { openMenu(); }, cam: () => ({ x: cam.x, y: cam.y, w: VW, h: VH }),
    };
    return { leave, confirmLeave };
  },
};
