# Builds village-world.js (the live cozy village engine) from _test/village-cozy-big.html. Run from the repo root: python _test/gen_village_world.py
# Run from the repo root: python <this> ; asserts every replacement hits exactly once.
import re, json, sys
SRC = '_test/village-cozy-big.html'
html = open(SRC, encoding='utf-8').read()
css = html.split('<style>')[1].split('</style>')[0]
body = html.split('<body>')[1].split('<script>')[0]
s = html.split("<script>\n'use strict';\n")[1].split('</script>')[0]

def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, ('COUNT', c, a[:110])
    s = s.replace(a, b)

def rep_line(prefix, b):
    """replace the whole line that starts with prefix"""
    global s
    lines = s.split('\n'); hit = [i for i, l in enumerate(lines) if l.startswith(prefix)]
    assert len(hit) == 1, ('LINE', len(hit), prefix[:90])
    lines[hit[0]] = b; s = '\n'.join(lines)

def cut(a, b, keep_b=True, repl=''):
    """remove from marker a up to marker b"""
    global s
    assert s.count(a) == 1, ('CUT A', a[:80]); i = s.index(a); j = s.index(b, i)
    s = s[:i] + repl + (s[j:] if keep_b else s[j + len(b):])

# ---------------- CSS / HTML ----------------
css = css.replace(':root{', ':host{')
css = re.sub(r'html,body\{[^}]*\}', ':host{position:absolute;inset:0;z-index:1;display:block;overflow:hidden;background:#1b1422;font-family:Kanit,"Leelawadee UI",Tahoma,sans-serif;color:var(--ink);font-size:14px;line-height:1.4}', css)
css += '\n#ov{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}\n#clock input,#clock button{display:none}\n#clock{padding:3px 12px}\n'
assert '<small style="font-weight:400;color:var(--muted)">· ตัวอย่าง 2</small>' in body
body = body.replace(' <small style="font-weight:400;color:var(--muted)">· ตัวอย่าง 2</small>', '')
body = body.replace('<canvas id="cv"></canvas>', '<canvas id="cv"></canvas><canvas id="ov"></canvas>')
assert '<canvas id="ov">' in body

# ---------------- wrapper ----------------
rep("(async () => {\n", "return (async () => {\n", 1)
s = s.rstrip()
tail = "})().catch(e => {"
i = s.rindex(tail); s = s[:i] + "@@API@@\n})();"

# ---------------- assets ----------------
rep("const S = Object.fromEntries(await Promise.all(['grass', 'house', 'maple', 'fences'].map(async n => [n, await img('farmrpg/' + n + '.png')])));",
    "// Tiny Farm RPG by Maeve Devs: the four sheets packed into one atlas (credit kept on screen; the raw pack is not shipped)\n"
    "const ATL = await img('assets/village/maeve-atlas.png'), cutA = (y, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(ATL, 0, y, w, h, 0, 0, w, h); return c; };\n"
    "const S = { grass: cutA(0, 192, 64), house: cutA(64, 224, 112), maple: cutA(176, 160, 48), fences: cutA(224, 48, 80) };")
rep("await img('kenney/' + (n === 'cursor' ? 'cursor-pixel-pack' : 'tiny-' + n) + '/tilemap_packed.png')", "await img('assets/village/kenney-' + n + '.png')")
rep("img('../assets/mi/chars/' + w + '_' + a + '.png')", "img('assets/mi/chars/' + w + '_' + a + '.png')")
rep_line("const [farmSrc, soloSrc] = await Promise.all(", "// crops + palette come from farm.js / solo-games.js (globals)")
rep_line("const CROPS = new Function(", "")
rep_line("const PAL = new Function(", "const PAL = PXA_PAL;")

# ---------------- lots from the live game ----------------
cut("const LOTS = [];\n// 10 lots in a ring", "for (const L of LOTS) setG(L.x + 2, L.y + 3, 3);", keep_b=False,
    repl="// lots come from the live game (rooms/_vil/lots): {id, x, y, stage, owner, rc, wc, xs, building, pct, gN, mine, live}\n"
         "const LOTS = H.lots(), MY = LOTS.find(L => L.mine) || { x: -99, y: -99, stage: 0, rc: 'red', wc: 'wood', xs: '' };\n"
         "const BED_AT = new Map();\n"
         "for (const L of LOTS) setG(L.x + 2, L.y + 3, 3);")
# fixed room slots (lot rooms 0–11 by lot order, buildings 12+), so a rebuild never moves a room you are standing in
rep("function makeRoom(o) { const i = ROOMS.length, x0 = RX0 + 2 + (i % 8) * 16, y0 = 1 + (i >> 3) * 12, r = { ...o, x0, y0 };",
    "function makeRoom(o) { const i = o.slot ?? ROOMS.length, x0 = RX0 + 2 + (i % 8) * 16, y0 = 1 + (i >> 3) * 12, r = { ...o, x0, y0, slot: i };")
rep("  L.room = makeRoom({ kind: isBig(L)", "  L.room = makeRoom({ slot: LOTS.indexOf(L), kind: isBig(L)")
rep("B.room = makeRoom({ ...room, key, out, title });", "B.room = makeRoom({ ...room, key, out, title, slot: 12 + BUILDINGS.length });")
rep("makeRoom({ kind: 'barn', key: 'barn',", "makeRoom({ slot: 15, kind: 'barn', key: 'barn',")
# the house garden = the live farm (farm.js plots): beds where the live game puts them, real crops drawn on them
rep("""  L.garden = gCells(L);   // real plots (added with the farm plots below); you can walk between the beds, like Stardew
  const fN = L.stage === 4 && L.building ? 3 : 5;
  for (let i = 0; i < fN; i++) fence(X + 5 + i, Y + 3, i === 0 ? 0 : i === 4 ? 2 : 1);""",
"""  L.garden = [];   // the live farm's beds (same cells as farm.js plots); crops drawn from the real save, tap = the lot card
  for (let i = 0; i < L.gN; i++) { const [x, y] = H.gCell(L.live, i); L.garden.push([x, y]); block[y][x] = 1;
    const p = { x, y, o: 'home', c: null, w: 0, fw: [] }; BED_AT.set(x + ',' + y, p);
    add(y * T + 14, g => { drawSoil(g, p, x * T, y * T); H.drawCrop(g, L.live, i, x * T, y * T); }); }
  if (L.garden.every(c => c[1] < Y + 3)) { const fN = L.stage === 4 && L.building ? 3 : 5;
    for (let i = 0; i < fN; i++) fence(X + 5 + i, Y + 3, i === 0 ? 0 : i === 4 ? 2 : 1); }""")
rep("""const OWNER_KEY = { 'พล': 'me', 'แพร': 'prae', 'ฝน': 'fon', 'ต้น': 'ton' };
for (const L of LOTS) if (L.garden) L.garden.forEach(([x, y]) => { const p = { x, y, o: OWNER_KEY[L.owner] || 'L' + L.id, c: null, t: 0, w: 0, fw: [], rt: 0, fx: -9, fk: '', home: L, nx: 0 };
  PLOTS.push(p); add(y * T + 14, (g, t) => drawPlot(g, p, t)); });
""", "")
# lots 5 + 8 moved out of the park to the east lane: no trees there, the side walk + lamp shift one column east
rep(", [57, 22, 67], [55, 27, 68], [51, 24, 67]]) put('city'", "]) put('city'")
rep("[60, 13, 68]", "[59, 13, 68]")
rep("rect(59, 12, 59, 25, (x, y) => setG(x, y, 5)); rect(59, 25, 70, 25, (x, y) => setG(x, y, 5));", "rect(60, 12, 60, 25, (x, y) => setG(x, y, 5)); rect(60, 25, 70, 25, (x, y) => setG(x, y, 5));")
rep("for (const x of [60, 69]) { put('city', [86, 98], x, 24);", "for (const x of [61, 69]) { put('city', [86, 98], x, 24);")

# ---------------- world build → a function that can run again when lots change ----------------
A = "/* ============ world grid"; B = "/* ============ people ============ */"
i0 = s.index(A); i1 = s.index(B); region = s[i0:i1]

def stmt_end(t, i):
    """index just past the ';' that ends the statement starting at i (depth 0), skipping strings/comments/templates"""
    depth = 0; n = len(t); k = i; stack = []
    while k < n:
        ch = t[k]
        if stack and stack[-1] == '`':
            if ch == '\\': k += 2; continue
            if ch == '`': stack.pop(); k += 1; continue
            if t.startswith('${', k): stack.append('${'); depth += 1; k += 2; continue
            k += 1; continue
        if t.startswith('//', k): k = t.index('\n', k); continue
        if t.startswith('/*', k): k = t.index('*/', k) + 2; continue
        if ch in '\'"':
            q = ch; k += 1
            while t[k] != q: k += 2 if t[k] == '\\' else 1
            k += 1; continue
        if ch == '`': stack.append('`'); k += 1; continue
        if ch in '([{': depth += 1
        elif ch in ')]}':
            depth -= 1
            if ch == '}' and stack and stack[-1] == '${': stack.pop()
        elif ch == ';' and depth == 0: return k + 1
        k += 1
    raise ValueError('no end')

def decl_names(t):
    """names declared by 'a = 1, b = (x, y) => 2' at depth 0"""
    out = []; depth = 0; start = 0; k = 0; stack = []
    parts = []
    while k < len(t):
        ch = t[k]
        if stack and stack[-1] == '`':
            if ch == '\\': k += 2; continue
            if ch == '`': stack.pop()
            elif t.startswith('${', k): stack.append('${'); depth += 1; k += 2; continue
            k += 1; continue
        if t.startswith('//', k): k = t.index('\n', k); continue
        if ch in '\'"':
            q = ch; k += 1
            while t[k] != q: k += 2 if t[k] == '\\' else 1
            k += 1; continue
        if ch == '`': stack.append('`')
        elif ch in '([{': depth += 1
        elif ch in ')]}':
            depth -= 1
            if ch == '}' and stack and stack[-1] == '${': stack.pop()
        elif ch == ',' and depth == 0: parts.append(t[start:k]); start = k + 1
        k += 1
    parts.append(t[start:])
    for p in parts:
        m = re.match(r'\s*([A-Za-z_$][\w$]*)\s*=', p); assert m, ('DECL', p[:60]); out.append(m.group(1))
    return out

names = []; outp = []; k = 0
while k < len(region):
    at_line = k == 0 or region[k - 1] == '\n'
    if at_line and (region.startswith('const ', k) or region.startswith('let ', k)):
        kw = 'const ' if region.startswith('const ', k) else 'let '
        e = stmt_end(region, k); body_ = region[k + len(kw):e - 1]
        names += decl_names(body_); outp.append(body_ + ';'); k = e; continue
    if at_line and region.startswith('function ', k):
        m = re.match(r'function ([A-Za-z_$][\w$]*)', region[k:]); nm = m.group(1); names.append(nm)
        outp.append(nm + ' = function '); k += len('function '); continue
    outp.append(region[k]); k += 1
region2 = ''.join(outp)
assert len(set(names)) == len(names), [n for n in names if names.count(n) > 1]
# a name must not be declared again at the top level outside the region
rest = s[:i0] + s[i1:]
dup = [n for n in names if re.search(r'^(?:const|let|function)\s+' + re.escape(n) + r'\b', rest, re.M)]
assert not dup, ('DUP', dup)
s = s[:i0] + 'let ' + ', '.join(names) + ';\nfunction buildWorld() {\n' + region2 + '}\nbuildWorld();\n\n' + s[i1:]

# ---------------- people ----------------
rep("const me = person('พล (ฉัน)', 'me', 'adam', MY.x + 2, MY.y + 4);", "const me = person('⭐ ' + H.name(), 'me', 'adam', 5, 8);")
rep_line("const mates = [['แพร'", "const mates = [];")
# me = the player's own avatar + wardrobe (drawChar from solo-games.js); riding hides the legs like the prototype
rep("function drawPerson(g, P) { const rd = riding(P),", "function drawPerson(g, P) { if (P === me) return drawMeW(g, P); const rd = riding(P),")
rep("const me = person(", """function drawMeW(g, P) { const rd = riding(P), lift = rd ? 5 + (P.moving ? Math.round(Math.sin(P.t * 18) * .6) : 0) : 0, side = P.dir === 'left' || P.dir === 'right';
  if (rd) drawRide(g, P, rd, true);
  if (rd && side) drawRide(g, P, rd, false);
  H.drawMe(g, P, rd, lift);
  if (rd && P.dir === 'down') drawRide(g, P, rd, false); }
const me = person(""")
# rides at the live scale: bought with Prog coins, kept in progress (vil.rides) so they follow you to another device
rep("bike: ['🚲 จักรยาน', 400, 1.6,", "bike: ['🚲 จักรยาน', 3000, 1.6,")
rep("scoot: ['🛵 สกู๊ตเตอร์', 1200, 2.3,", "scoot: ['🛵 สกู๊ตเตอร์', 9000, 2.3,")
rep("F.coins -= R[1]; F.rides[sel] = 1; F.ride = sel; save();", "F.coins -= R[1]; F.rides[sel] = 1; F.ride = sel; H.rideBought(sel); save();")

# ---------------- villagers: friendship starts at 0 and is saved ----------------
rep("p: 640,", "p: 0,"); rep("p: 1310,", "p: 0,"); rep("p: 120,", "p: 0,")
rep_line("NPCS[1].known = ['cor'];", "")
rep("""    <div class="say">“${line}”</div>""", """    <div class="say">“${line}”</div>${H.jobsFor(NPCS.indexOf(N)) ? `<div class="row"><button class="pri" data-a="jobs">📦 งานส่งของ ×${H.jobsFor(NPCS.indexOf(N))} · ดู/ส่งของ</button></div>` : ''}""")
rep("    if (b.dataset.a === 'talk') { N.td = true;", "    if (b.dataset.a === 'jobs') { closeCard(); return H.jobs(NPCS.indexOf(N)); }\n    if (b.dataset.a === 'talk') { N.td = true;")

# ---------------- community farm: mine only, saved per player, capped ----------------
rep_line("const FARMER = { me: { n: 'พล',", "const FARMER = { me: { n: H.name(), col: '#ffd23f', P: me } };")
rep_line("for (const L of LOTS) if (L.owner && !OWNER_KEY[L.owner]) FARMER", "")
rep("const BOTS = ['prae', 'fon', 'ton'],", "const BOTS = [],")
rep("const F = { ride: 'walk', rides: { walk: 1 }, coins: 300, kind: 0,", "const F = { ride: 'walk', rides: { walk: 1 }, kind: 0,")
rep("\n/* ---- items: the backpack", "\n// coins are the arcade's own (Prog); not enumerable, so the farm save never stores them\nObject.defineProperty(F, 'coins', { get: () => H.coins(), set: v => H.setCoins(v), enumerable: false });\nconst MY_CAP = 8;   // my crops growing at once on the community farm\n/* ---- items: the backpack")
rep("    if (k === 'me') { if (!count(BAG, 's:' + seed))", "    if (k === 'me' && pub && COMM().filter(q => q.by === 'me' && q.c).length >= MY_CAP) return { m: `ไร่ชุมชนปลูกได้ทีละ ${MY_CAP} แปลงต่อคน · เก็บผักก่อนแล้วปลูกต่อ` };\n    if (k === 'me') { if (!count(BAG, 's:' + seed))")
rep("const yd = YIELD + (p.home === MY && gardenRank().t === 2 ? 1 : 0);", "const yd = YIELD;")
rep_line("const SAVE = 'cozyFarm3';", "const SAVE = 'vilCozy1';")
rep("function save() { try { localStorage.setItem(SAVE, JSON.stringify({ F, BAG, CHEST,", "function save() { try { localStorage.setItem(SAVE, JSON.stringify({ F, BAG, CHEST, npc: NPCS.map(N => ({ p: N.p, td: N.td, gn: N.gn, known: N.known })), day: H.day(), wk: H.week(),")
cut("function demo() {", "function load() {",
    repl="function fresh() { [['hoe', 1], ['can', 1], ['s:bok', 4]].forEach((x, i) => BAG[i] = { id: x[0], n: x[1] }); }   // a new player: hoe, can, 4 seeds\n")
rep("if (p) Object.assign(p, q); }); } else demo();",
    "if (p) Object.assign(p, q); });\n    if (Array.isArray(s.npc)) s.npc.forEach((q, i) => { const N = NPCS[i]; if (N && q) Object.assign(N, { p: Math.min(2500, q.p | 0), td: q.td && s.day === H.day(), gn: s.wk === H.week() ? q.gn | 0 : 0, known: Array.isArray(q.known) ? q.known : [] }); }); }\n  else fresh();\n  Object.assign(F.rides, H.rides()); if (!F.rides[F.ride]) F.ride = 'walk';")

rep("if (s && s.plots) { Object.assign(F, s.F);", "if (s && s.plots) { const { coins, ...f } = s.F || {}; Object.assign(F, f);")
# ---------------- my house: the live lot card does it (prices, transactions) ----------------
cut("/* ---- my house: starter → big", "function rideCard(sel) {")
cut("function homeCard() { openN = null; card.dataset.k = 'home';", "/* ============ input")
rep_line("  if (MY.building) { MY.pct = Math.max(", "")
rep_line("    if (MY.pct >= 1 && !homeToldDone)", "")
rep_line("  if ((frame.homeT = (frame.homeT || 0) + dt) > 1)", "")
rep_line("const lotTags = LOTS.map(", "")
rep_line("  LOTS.forEach((L, i) => { const [sx, sy] = scr((L.x + 2) * T + 8, hasHouse(L)", "")

# ---------------- the live game's hooks in the frame ----------------
rep("function frame(now, fixed) {\n", "function frame(now, fixed) {\n  if (!fixed && !H.visible()) { frame.last = now; return; }\n")
rep("  keyMove(dt);\n", "  keyMove(dt);\n  H.tick(dt);\n")
rep("CARS.map(c => ({ y: c.y, c }))).sort(", "CARS.map(c => ({ y: c.y, c })), H.draw(scene).map(h => ({ y: h.y, h }))).sort(")
rep("    else { const c = it.c; g.save();", "    else if (it.h) it.h.d(g);\n    else { const c = it.c; g.save();")
rep("  view = { ox, oy };\n}", "  view = { ox, oy };\n  H.overlay(ox, oy, SC, scene);\n}")
rep("function closeCard() { card.style.display = 'none';", "function closeCard() { card.style.display = 'none'; card.dataset.k = '';")
rep("card.style.display = 'block'", "cardShow()", n=s.count("card.style.display = 'block'"))
rep("function closeCard() {", "function cardShow() { card.style.display = 'block'; H.cardOpened(); }\nfunction closeCard() {")
# guarded checks of card visibility stay valid
s = s.replace("card.style.display === cardShow()", "card.style.display === 'block'")

# ---------------- DOM inside the shadow root, sized by the host ----------------
s = re.sub(r'\bdocument\.getElementById\(', 'SR.getElementById(', s)
rep("document.body.append(", "SR.append(", n=s.count("document.body.append("))
s = re.sub(r'\binnerWidth\b', 'VW()', s); s = re.sub(r'\binnerHeight\b', 'VH()', s)
rep("resize(); addEventListener('resize', () => { SC = Math.max(SC, minSC()); resize(); });",
    "resize(); new ResizeObserver(() => { SC = Math.max(SC, minSC()); resize(); }).observe(host);")
rep("const worldAt = e => [e.clientX / SC + view.ox, e.clientY / SC + view.oy];",
    "const worldAt = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) / SC + view.ox, (e.clientY - b.top) / SC + view.oy]; };")
rep("const SPEED = (m => m ? +m[1] : 1)(", "const SPEED = (m => m && window.__TEST__ ? +m[1] : 1)(")

# ---------------- input: live pills first, then the map; tower / board / lots go to the live game ----------------
rep("  if (scene) return null;\n  for (const B of BUILDINGS)",
    "  if (scene) return null;\n  if (wx >= TOWER.x * T && wx < (TOWER.x + TOWER.w) * T && wy > 0 && wy < 7 * T + 4) return { tower: 1 };\n  if (Math.floor(wx / T) === BOARD[0] && wy > BOARD[1] * T - 12 && wy < (BOARD[1] + 1) * T) return { board: 1 };\n  for (const B of BUILDINGS)")
rep("  const [wx, wy] = worldAt(e), hit = pick(wx, wy);\n",
    "  { const b = cv.getBoundingClientRect(); if (H.tap(e.clientX - b.left, e.clientY - b.top)) return; }\n  const [wx, wy] = worldAt(e), hit = pick(wx, wy);\n  if (hit?.tower) return H.tower();\n  if (hit?.board) return H.board();\n")
rep("  if (hit?.lot) return visit([hit.lot.x + 2, hit.lot.y + 3], () => lotCard(hit.lot), 3);", "  if (hit?.lot) return H.lot(hit.lot.live);")
rep("addEventListener('keydown', e => { const k = KEYS[e.key.toLowerCase()];", "addEventListener('blur', () => held.clear());\naddEventListener('keydown', e => { if (!e.key || !H.visible() || H.typing(e) || e.ctrlKey || e.metaKey || e.altKey) return; const k = KEYS[e.key.toLowerCase()];")
rep_line("SR.getElementById('gohome').onclick = ", "SR.getElementById('gohome').onclick = () => { closeCard(); H.home(); };")


# leftovers of the prototype house section
cut("// a neighbour's house: visit, help water", "const helpNeed = p =>")
cut("function homeSim() {", "function botThink(k) {")
rep("  HOME, MY, homeCard, upCard, gardenCard, homeSim,\n", "  MY,\n")
rep("BUILDINGS, CARS, lotCard, rideCard, gardenRank, runPlots,", "BUILDINGS, CARS, rideCard, runPlots,")
rep("friendsCard, lotCard, give,", "friendsCard, give,")
# ---------------- start + API ----------------
rep("window.__cb = { DAY_MS,", "if (window.__TEST__) window.__cb = { DAY_MS,")
API = r"""// rebuild the static world when the live lots change (stage, colours, garden size); community plots and the room you stand in are kept
function relots() { const keep = {}; for (const p of PLOTS) if (!p.home) keep[p.x + ',' + p.y] = { o: p.o, by: p.by, c: p.c, t: p.t, w: p.w, fw: p.fw, rt: p.rt };
  const was = scene; buildWorld(); PLOT_AT = null;
  for (const p of PLOTS) Object.assign(p, keep[p.x + ',' + p.y] || {});
  if (was) { const s2 = ROOMS.find(r => r.slot === was.slot) || null; scene = s2;
    if (!s2) { place(me, was.out); scene = null; enterScene(null); } else if (!walkable(...cellOf(me))) place(me, s2.entry); }
  else if (!walkable(...cellOf(me))) { const c = near(...cellOf(me)); if (c) place(me, c); } }
return { me, held, C, R, get G() { return G; }, get block() { return block; }, get ctx() { return ctx; }, ov: SR.getElementById('ov'),
  travel: c => { closeCard(); me.after = null; travel(me, c); }, place: c => place(me, c), sceneOf, scene: () => scene, relots, closeCard,
  talk: i => { if (NPCS[i]) talkTo(NPCS[i]); }, enterLot: id => { const L = LOTS.find(l => l.id === id); if (L && L.room) enter(L.room); },
  hasRoom: id => !!(LOTS.find(l => l.id === id) || {}).room,
  lotTop: id => { const L = LOTS.find(l => l.id === id); return !L ? 0 : hasHouse(L) && !(L.stage === 2 && L.building) ? (L.y + 3) * T - (isBig(L) ? 130 : 98) : (L.y + 1) * T - 4; },
  get SC() { return SC; }, NPCS, F, BAG, PLOTS: () => PLOTS, rideCard, friendsCard, hud };"""
s = s.replace("@@API@@", API)

out = "// GENERATED by _test/gen_village_world.py from _test/village-cozy-big.html — the live village engine (map, rooms, NPCs, rides, community farm).\n" \
      "// Rendered in a shadow root inside .vil-wrap; village.js passes the hooks H (lots, presence, pets, jobs, coins) and draws its pills on #ov.\n" \
      "// Art: Kenney (CC0) · Tiny Farm RPG by Maeve Devs (packed atlas, credit on screen) · characters/crops: HR Arcade.\n" \
      "'use strict';\nconst VillageWorld = {\n  start(host, H) {\n    const SR = host.attachShadow({ mode: 'open' });\n" \
      "    SR.innerHTML = '<style>' + " + json.dumps(css, ensure_ascii=False) + " + '</style>' + " + json.dumps(body.strip(), ensure_ascii=False) + ";\n" \
      "    const VW = () => host.clientWidth || 800, VH = () => host.clientHeight || 560;\n" + s + "\n  }\n};\n"
open('village-world.js', 'w', encoding='utf-8').write(out)
print('ok', len(out), 'hoisted', len(names))
