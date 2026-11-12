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
# one chip at the top-left: place + clock (was two stacked chips), farm HUD moves up into the freed row
_clk = '<div class="chip" id="clock">🕒 <b id="tm"></b><input id="hour"'
assert body.count(_clk) == 1
body = re.sub(r'(<span id="where">หมู่บ้าน</span>)(</div>\s*)' + re.escape(_clk), r'\1 · 🕒 <b id="tm"></b>\2<div id="clock" hidden><input id="hour"', body)
assert body.count('id="tm"') == 1 and '<div id="clock" hidden>' in body
css += '#farmhud{top:60px}\n#toast{top:108px}\n#title{font-size:13px}\n'

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
rep("B.room = makeRoom({ ...room, key, out, title });", "B.room = makeRoom({ ...room, key, out, title, slot: room.slot ?? 12 + BUILDINGS.length });")
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

# ---------------- 🕹️ ตึกเกม (12 Nov 2026): the arcade hall south of the lake — every solo game is a machine inside ----------------
# lessons: _test/references-arcade.md · machines from H.games(), tap = walk up + H.play(id); labels / live players drawn by village.js
rep(", [66, 30, 67]", ""); rep(", [63, 31, 68]", "")
_cafe = s[s.index("building('cafe', 50, 13"):].split('\n')[0]
rep(_cafe, _cafe + "\nbuilding('arcade', 61, 27, 8, 3, 'blue', 'red', [3, 'double'], '🕹️ ตึกเกม', { kind: 'arcade', w: 10, h: 9, wall: '#3d3478', floor: '#6a5aa8', slot: 16 });"
    "\nrect(64, 32, 65, 33, (x, y) => setG(x, y, 5));")
rep("  if (r.kind === 'barn') {", """  if (r.kind === 'arcade') { lampW(1); lampW(7); rug('#ff6fa8', 1, 8, 8, 1);
    // 13 Nov 2026: 10 x 9 hall so it fits a phone at zoom 2 — three rows of cabinets with aisles between (stand on the row below a cabinet)
    const SP = [[2, 2], [4, 2], [6, 2], [1, 4], [3, 4], [5, 4], [7, 4], [1, 6], [3, 6], [5, 6], [7, 6]];
    r.mach = []; H.games().slice(0, SP.length).forEach((gm, i) => { const x = X + SP[i][0], y = Y + SP[i][1], M = { id: gm.id, x, y }; r.mach.push(M); block[y][x] = 1;
      add(y * T + 14, (g, t) => drawCab(g, gm, x * T, y * T, t)); });
    r.board = [X + 8, Y + 2]; block[Y + 2][X + 8] = 1; add((Y + 2) * T + 14, g => drawTrophy(g, (X + 8) * T, (Y + 2) * T));
    // 🎰 gacha machine + 🎉 party room door (12 Nov 2026: ห้องรวม moved here — the door opens the party room)
    r.gacha = [X, Y + 2]; block[Y + 2][X] = 1; add((Y + 2) * T + 14, (g, t) => drawGachaM(g, X * T, (Y + 2) * T, t));
    r.party = [X + 9, Y + 2]; block[Y + 2][X + 9] = 1; add((Y + 2) * T + 14, (g, t) => drawPartyDoor(g, (X + 9) * T, (Y + 2) * T, t));
    // 📋 the game list sign, right next to where you walk in
    r.alist = [X + 6, Y + 8]; block[Y + 8][X + 6] = 1; add((Y + 8) * T + 14, g => drawListSign(g, (X + 6) * T, (Y + 8) * T)); }
  if (r.kind === 'barn') {""")
# arcade cabinet + trophy board, drawn live (featured glow pulses, screen flickers)
rep("/* ============ ground, painted once ============ */", """function drawCab(g, gm, x, y, t) {
  const L = x + 1, B = y + 15, ft = H.featured() === gm.id, f = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(L + a, B - 26 + b, w, h); };
  if (ft) { g.fillStyle = `rgba(255,214,74,${.35 + .25 * Math.sin(t * 4)})`; g.fillRect(L - 2, B - 29, 18, 30); }
  const col = gm.color || '#ff8fbf';
  f(0, 0, 14, 26, O); f(1, 1, 12, 25, col); f(1, 4, 12, 22, 'rgba(25,18,55,.5)'); f(1, 4, 1, 22, 'rgba(255,255,255,.25)');   // body in the game's colour, bright marquee on top
  f(1, 1, 12, 3, col); f(2, 2, 10, 1, 'rgba(255,255,255,.55)');
  f(1, 4, 12, 12, '#141226'); f(2, 5, 10, 10, `hsl(${(t * 30 + gm.id.length * 47) % 360},55%,${20 + 5 * Math.sin(t * 3 + x)}%)`);
  g.font = '9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(gm.emoji, L + 7, B - 16);
  f(1, 16, 12, 3, '#3d3670'); f(3, 17, 1, 1, '#ff5c8a'); f(8, 17, 2, 1, '#4cc3ff'); f(10, 17, 2, 1, '#ffd23f'); f(2, 21, 10, 2, 'rgba(0,0,0,.35)');
  if (ft) { g.font = '6px sans-serif'; g.fillText('⭐', L + 7, B - 30); } }
function drawListSign(g, x, y) { const f = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  f(7, 2, 2, 13, O); f(1, -9, 14, 13, O); f(2, -8, 12, 11, '#fff3c4'); for (let i = 0; i < 4; i++) { f(3, -6 + i * 2.5, 2, 1, '#c99a1a'); f(6, -6 + i * 2.5, 6, 1, '#a8643a'); } }
function drawGachaM(g, x, y, t) { const f = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  f(1, -12, 14, 27, O); f(2, -11, 12, 11, '#dcefff'); f(2, 0, 12, 14, '#e8384f'); f(4, 3, 4, 3, '#2b2140'); f(10, 3, 3, 3, '#ffd23f'); f(3, 10, 10, 2, '#a81f33');
  ['#ff5c8a', '#3a86ff', '#ffd23f', '#21c07a', '#a06cff', '#ff9f1c'].forEach((c, i) => f(3 + (i % 3) * 3 + ((t * 2 + i) % 2 > 1 ? 0 : 1), -9 + (i >> 1 & 1) * 3 + (i > 3 ? 3 : 0), 2, 2, c)); }
function drawPartyDoor(g, x, y, t) { const f = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  f(1, -14, 14, 29, O); f(2, -13, 12, 27, '#ff6fa8'); f(3, -11, 10, 24, '#7a2a55'); f(4, -10, 8, 22, '#a8396f'); f(10, 0, 2, 2, '#ffd23f');
  const c = ['#ffd23f', '#4cc3ff', '#7be07b', '#fff']; for (let i = 0; i < 5; i++) f(2 + i * 2.5, -15 + Math.round(Math.sin(t * 5 + i) * 1), 2, 2, c[(i + Math.floor(t * 3)) % 4]); }
function drawTrophy(g, x, y) { const f = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(x + a, y + b, w, h); };
  f(1, -10, 14, 25, O); f(2, -9, 12, 18, '#f7e3b5'); f(2, 9, 12, 5, '#a8643a'); f(5, -7, 6, 5, '#ffd23f'); f(7, -2, 2, 3, '#ffd23f'); f(5, 1, 6, 1, '#c99a1a');
  for (let i = 0; i < 3; i++) f(4, 3 + i * 2, 8, 1, '#c9a27a'); }
/* ============ ground, painted once ============ */""")

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
# ---------------- community farm goes online: rooms/_vil/cfarm + rooms/_vil/corder; bag / chest / hearts in Prog ----------------
# act() gets a dry run (rules only, no bag / coin changes) so a transaction can test the rules on the server's copy of a plot
rep("function act(k, p, tool, seed) {", "function act(k, p, tool, seed, dry) {")
rep("takeFrom(BAG, 's:' + seed, 1, F.sel); }", "if (!dry) takeFrom(BAG, 's:' + seed, 1, F.sel); }")
rep("F.fwN++; F.coins += 3; F.kind++; }", "if (!dry) { F.fwN++; F.coins += 3; F.kind++; } }")
rep("if (k === 'me') addTo(BAG, c, yd);", "if (k === 'me' && !dry) addTo(BAG, c, yd);")
LIVE_JS = r"""// ---- live community farm: every player works the same plots (rooms/_vil/cfarm/{x_y}); plots are kept forever, anyone may pick a ripe crop.
// Each tap is a transaction that runs act() on the server's copy first (dry), and only after it commits runs again here for the bag / coins.
let LIVE = false, LIVEO = false, KEY = '', OFF = 0;
const PID = p => p.x + '_' + p.y, ONLINE_ERR = { m: '📡 ต่อไร่ชุมชนไม่ได้ ลองใหม่อีกที' };
const liveKey = () => { KEY = H.farmKey ? H.farmKey() : ''; OFF = H.farmOff ? +H.farmOff() || 0 : 0; };
const colOf = k => `hsl(${[...k].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 360} 70% 62%)`;
function who(k, n) { if (k && k !== 'me') { if (!FARMER[k]) FARMER[k] = { n: n || 'เพื่อนบ้าน', col: colOf(k) }; else if (n) FARMER[k].n = n; } return k; }
const mapK = k => k === KEY ? 'me' : k;
function fromSrv(v) { if (!v) return { o: null, by: null, bn: '', c: null, t: 0, w: 0, fw: [], rt: 0 };
  const fw = Array.isArray(v.fw) ? v.fw : v.fw ? Object.values(v.fw) : [];
  return { o: v.o || null, by: v.by ? who(mapK(v.by), v.bn) : null, bn: v.bn || '', c: v.c || null, t: v.t ? v.t - OFF : 0, w: v.w | 0, fw: fw.filter(Boolean).map(mapK), rt: v.rt ? v.rt - OFF : 0 }; }
function toSrv(p) { if (!p.o) return null;
  return { o: p.o, by: p.by ? (p.by === 'me' ? KEY : p.by) : null, bn: p.by ? (p.by === 'me' ? FARMER.me.n : nameOf(p.by)) : null, c: p.c || null,
    t: p.c ? Math.round(p.t + OFF) : 0, w: p.w | 0, fw: p.fw.map(k => k === 'me' ? KEY : k), rt: Math.round((p.rt || Date.now()) + OFF) }; }
function applyPlots(all) { liveKey(); all = all || {}; const first = !LIVE; LIVE = true;
  for (const p of COMM()) { const v = all[PID(p)], n = fromSrv(v);
    if (!first && p.by === 'me' && p.c && !n.c && v && v.hk && v.hk !== KEY) { F.kind++; toast(`🧺 ${v.hn || 'เพื่อนบ้าน'}เก็บ${cropName(p.c)}ที่คุณปลูก · +1 น้ำใจ`); }
    if (!first && !p._tx && (n.c !== p.c || n.o !== p.o || n.fw.length !== p.fw.length || n.w !== p.w)) { p.fx = gameT; p.fk = n.c && n.c !== p.c ? 's' : n.c && n.c === p.c ? 'w' : 'h'; }
    Object.assign(p, n); }
  hud(); }
function liveAct(p, tool, seed) { if (p._tx) return Promise.resolve({ m: '⏳ รอสักครู่…' });
  liveKey(); let pre = null, r = null, nv = null; p._tx = 1;
  return H.farmTx(PID(p), cur => { pre = fromSrv(cur); const q = { ...p, ...pre, fw: [...pre.fw] }; r = act('me', q, tool, seed, true);
      if (!r.ok) return undefined; nv = toSrv(q); if (tool === 'hand') Object.assign(nv, { hk: KEY, hn: FARMER.me.n }); return nv; })
    .then(res => { if (!res || !res.committed) { if (r && !r.ok) { if (pre) Object.assign(p, pre); return r; } return ONLINE_ERR; }
      Object.assign(p, pre, { fw: [...pre.fw] }); const out = act('me', p, tool, seed); Object.assign(p, fromSrv(nv)); return out; })
    .catch(() => ONLINE_ERR).finally(() => { p._tx = 0; }); }
const doAct = (p, tool, seed) => LIVE && !p.home && H.farmTx ? liveAct(p, tool, seed) : Promise.resolve(act('me', p, tool, seed));
// ---- the village order online (rooms/_vil/corder): when the bar fills, the givers are written into h, and each player claims their own reward
function applyOrder(v) { liveKey(); v = v || {}; LIVEO = true; const by = {}, nm = v.nm || {};
  for (const [k, c] of Object.entries(v.by || {})) by[who(mapK(k), nm[k])] = c | 0;
  F.order = { i: v.i | 0, n: v.n | 0, by }; F.done = v.i | 0;
  const h = v.h || {}; let paid = false;
  for (const i of Object.keys(h).map(k => +k.slice(1)).filter(i => i >= 0).sort((a, b) => a - b)) { if (i < (F.paid | 0)) continue; F.paid = i + 1;
    const mine = (h['o' + i] || {})[KEY] | 0; if (mine) { paid = true; F.coins += 50 + mine * 8; F.kind += 3; toast(`🎉 ${ORDERS[i % ORDERS.length][2].split(':')[0]} ครบแล้ว! คุณได้ ${50 + mine * 8} 🪙 +3 น้ำใจ`); } }
  if (paid) save(); if (card.style.display === 'block' && card.dataset.k === 'order') orderCard(); hud(); }
function giveOrder(id, n) { if (!LIVEO || !H.orderTx) return contribute('me', n);
  liveKey(); let add = 0;
  H.orderTx(cur => { cur = cur || {}; const i = cur.i | 0, [oid, need] = ORDERS[i % ORDERS.length], have = cur.n | 0; add = oid === id ? Math.min(n, need - have) : 0; if (add <= 0) return undefined;
      const by = { ...(cur.by || {}) }, nm = { ...(cur.nm || {}) }; by[KEY] = (by[KEY] | 0) + add; nm[KEY] = FARMER.me.n;
      if (have + add < need) return { ...cur, i, n: have + add, by, nm };
      const h = { ...(cur.h || {}), ['o' + i]: by }; for (const k of Object.keys(h).sort((a, b) => +a.slice(1) - +b.slice(1)).slice(0, -10)) delete h[k];
      return { i: i + 1, n: 0, h }; })
    .then(res => res && res.committed ? add : 0, () => 0)
    .then(got => { if (got < n) { addTo(BAG, id, n - got); toast(got ? `📋 ส่งได้ ${got} · คืน ${n - got} เข้ากระเป๋า` : '📡 ส่งไม่ได้ (ออร์เดอร์เปลี่ยนแล้ว) · คืนผักเข้ากระเป๋า'); }
      save(); hud(); if (card.style.display === 'block' && card.dataset.k === 'order') orderCard(); }); }
"""
rep("// ---- HUD + hot bar (top row of the backpack) + plot tip ----", LIVE_JS + "// ---- HUD + hot bar (top row of the backpack) + plot tip ----")
# taps go through doAct (a promise: online plots answer after the transaction)
rep("    const r = act('me', p, tool, isSeed(id) ? seedOf(id) : null);\n    if (r.ok) say(me, EMO[tool], 900, true);\n    toast(r.m); if (!r.ok && r.hint) holdFor(r.hint);\n    tipP = p; tipUntil = performance.now() + 3000; save(); hud(); };",
    "    doAct(p, tool, isSeed(id) ? seedOf(id) : null).then(r => { if (r.ok) say(me, EMO[tool], 900, true);\n    toast(r.m); if (!r.ok && r.hint) holdFor(r.hint);\n    tipP = p; tipUntil = performance.now() + 3000; save(); hud(); }); };")
rep("const r = act('me', p, tool);\n", "doAct(p, tool).then(r => {\n")
rep("    hud(); runPlots(list, tool, n); };", "    hud(); runPlots(list, tool, n); }); };")
rep("contribute('me', n); save(); hud(); orderCard(); }", "giveOrder(id, n); save(); hud(); orderCard(); }")
# saves: bag, chest, hearts, farm counters go to Prog (prog.vil.cozy, a JSON string so empty slots survive); plots are online, never saved here
rep_line("function save() { try {", "let lastSave = '';\nfunction save() { const s = JSON.stringify({ F, BAG, CHEST, npc: NPCS.map(N => ({ p: N.p, td: N.td, gn: N.gn, known: N.known })), day: H.day(), wk: H.week() });\n  if (s === lastSave) return; lastSave = s; if (H.setCozy) return H.setCozy(s); try { localStorage.setItem(SAVE, s); } catch (e) { /* private window */ } }")
rep_line("function load() { let s = null;", "function load() { let s = null, old = false;   // old = the per-browser save from before the farm went online (moved into Prog once)\n  try { if (!/[?&]fresh=1\\b/.test(location.search)) { const c = H.cozy ? H.cozy() : ''; s = c ? JSON.parse(c) : null; if (!s) { s = JSON.parse(localStorage.getItem(SAVE)); old = !!s; } } } catch (e) { s = null; }")
rep("if (s && s.plots) { const { coins, ...f }", "if (s && s.BAG) { const { coins, ...f }")
rep("s.plots.forEach((q, i) => { const p = q.x === undefined ? PLOTS[i] : PLOTS.find(z => z.x === q.x && z.y === q.y); if (p) Object.assign(p, q); });",
    "if (old) for (const q of s.plots || []) if (q && q.c && (q.by === 'me' || q.o === 'me') && PLOTS.some(z => !z.home && z.x === q.x && z.y === q.y)) addTo(BAG, 's:' + q.c, 1);   // crops from the per-browser farm: their seeds come back")
rep("  const now = Date.now(); for (const p of COMM()) if (p.o && !p.c && now - p.rt > FREE_AFTER) p.o = null; }", "  if (old) save(); }   // plots are kept forever: no weeds come back")
rep("load(); hud(); if (/[?&]farm=1", "load(); hud(); if (H.farmLive) H.farmLive(applyPlots, applyOrder); if (/[?&]farm=1")
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

# ---------------- zoom with the mouse wheel / trackpad and two-finger pinch (12 Nov 2026), same steps as ＋ / － ----------------
rep("SR.getElementById('zout').onclick = () => { SC = Math.max(minSC(), SC - 1); resize(); };",
    """SR.getElementById('zout').onclick = () => { SC = Math.max(minSC(), SC - 1); resize(); };
const zoomBy = d => { const n = d > 0 ? Math.min(5, SC + 1) : Math.max(minSC(), SC - 1); if (n !== SC) { SC = n; resize(); } };
let wheelAcc = 0, wheelT = 0;
cv.addEventListener('wheel', e => { e.preventDefault(); const now = performance.now(); if (now - wheelT > 250) wheelAcc = 0;
  wheelAcc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; wheelT = now;
  if (Math.abs(wheelAcc) >= 60) { zoomBy(wheelAcc < 0 ? 1 : -1); wheelAcc = 0; wheelT = now + 120; } }, { passive: false });
const pinch = new Map(); let pinchD = 0;
const pDist = () => { const [a, b] = [...pinch.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; pinch.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.size === 2) { pinchD = pDist(); me.path = []; me.after = null; } });
cv.addEventListener('pointermove', e => { if (!pinch.has(e.pointerId)) return; pinch.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.size !== 2 || !pinchD) return;
  const r = pDist() / pinchD; if (r > 1.3 || r < .77) { zoomBy(r > 1 ? 1 : -1); pinchD = pDist(); } });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, e => { pinch.delete(e.pointerId); if (pinch.size < 2) pinchD = 0; });""")

# ---------------- input: live pills first, then the map; tower / board / lots go to the live game ----------------
rep("  if (scene) return null;\n  for (const B of BUILDINGS)",
    "  if (scene && scene.mach) { const cx = Math.floor(wx / T), on = (c, r) => cx === c && wy >= r * T - 13 && wy < (r + 1) * T;\n"
    "    const M = scene.mach.find(m => on(m.x, m.y)); if (M) return { mach: M }; if (on(...scene.board)) return { arank: 1 };\n"
    "    if (on(...scene.gacha)) return { gacha: 1 }; if (on(...scene.party)) return { party: 1 }; if (on(...scene.alist)) return { alist: 1 }; }\n"
    "  if (scene) return null;\n  if (wx >= TOWER.x * T && wx < (TOWER.x + TOWER.w) * T && wy > 0 && wy < 7 * T + 4) return { tower: 1 };\n  if (Math.floor(wx / T) === BOARD[0] && wy > BOARD[1] * T - 12 && wy < (BOARD[1] + 1) * T) return { board: 1 };\n  for (const B of BUILDINGS)")
rep("  const [wx, wy] = worldAt(e), hit = pick(wx, wy);\n",
    "  { const b = cv.getBoundingClientRect(); if (H.tap(e.clientX - b.left, e.clientY - b.top)) return; }\n  const [wx, wy] = worldAt(e), hit = pick(wx, wy);\n  if (hit?.tower) return H.tower();\n  if (hit?.board) return H.board();\n  if (hit?.mach) return playAt(hit.mach);\n  if (hit?.arank) return H.arcadeRank();\n  if (hit?.gacha) return playAt({ x: scene.gacha[0], y: scene.gacha[1] }, () => H.gacha());\n  if (hit?.party) return playAt({ x: scene.party[0], y: scene.party[1] }, () => H.party());\n")
rep("h?.lot || h?.plot", "h?.mach || h?.arank || h?.alist || h?.gacha || h?.party || h?.lot || h?.plot")
rep("  if (hit?.lot) return visit([hit.lot.x + 2, hit.lot.y + 3], () => lotCard(hit.lot), 3);", "  if (hit?.lot) return H.lot(hit.lot.live);")
rep("addEventListener('keydown', e => { const k = KEYS[e.key.toLowerCase()];", "addEventListener('blur', () => held.clear());\naddEventListener('keydown', e => { if (!e.key || !H.visible() || H.typing(e) || e.ctrlKey || e.metaKey || e.altKey) return; const k = KEYS[e.key.toLowerCase()];")
rep_line("SR.getElementById('gohome').onclick = ", "SR.getElementById('gohome').onclick = () => { closeCard(); H.home(); };\nSR.getElementById('goarc').onclick = () => { closeCard(); if (H.arcGo) H.arcGo(); else warpArc(); };")


# leftovers of the prototype house section
cut("// a neighbour's house: visit, help water", "const helpNeed = p =>")
cut("function homeSim() {", "function botThink(k) {")
rep("  HOME, MY, homeCard, upCard, gardenCard, homeSim,\n", "  MY,\n")
rep("BUILDINGS, CARS, lotCard, rideCard, gardenRank, runPlots,", "BUILDINGS, CARS, rideCard, runPlots,")
rep("friendsCard, lotCard, give,", "friendsCard, give,")

# ---------------- arcade readability (13 Nov 2026): tight zoom for the hall, 📋 list sign ----------------
rep("  if (hit?.arank) return H.arcadeRank();\n", "  if (hit?.arank) return H.arcadeRank();\n  if (hit?.alist) return H.arcList();\n")
rep("const sceneRect = s => s ? {", "const sceneRect = s => s && s.kind === 'arcade' ? { x: s.x0 * T - 4, y: s.y0 * T - 8, w: s.w * T + 8, h: (s.h + 1) * T + 8 } : s ? {")   # hall: no dark margin, so it centres on a phone
rep("Math.floor(Math.min(VW() / ((s.w + 3) * T), (VH() - 120) / ((s.h + 3) * T)))",
    "Math.floor(s.kind === 'arcade' ? Math.min(VW() / (s.w * T + 8), (VH() - 24) / ((s.h + 1) * T + 8)) : Math.min(VW() / ((s.w + 3) * T), (VH() - 120) / ((s.h + 3) * T)))")

# ---------------- phone QoL (12 Nov 2026): ☰ side menu, compact chips, one big action button, stacked name tags, zoom memory, haptics ----------------
css += ('#more{display:none}\n'
        '@media (max-width:719px){#title{font-size:11px;padding:2px 8px;top:8px;left:8px;border-width:2px;border-radius:10px}'
        '#farmhud{font-size:11px;padding:2px 8px;top:36px;left:8px;border-width:2px;border-radius:10px}#toast{top:66px}'
        '.side{top:8px;right:8px;gap:6px}#more{display:block}.side:not(.open)>.btn:not(#more){display:none}.side.open .lbl{display:inline}}\n'
        '@media (pointer:coarse){#zin,#zout{display:none}}\n'
        '#act{position:absolute;right:10px;bottom:96px;z-index:4;display:none;width:66px;height:66px;border-radius:50%;padding:0;'
        'background:#ffd54a;font-size:11px;line-height:1.1;white-space:normal;box-shadow:0 3px 0 var(--ink)}#act b{display:block;font-size:22px;line-height:1.1}\n')
assert body.count('<div class="side">') == 1
body = body.replace('<div class="side">', '<div class="side"><button class="btn" id="more" type="button" aria-label="เมนู">☰</button>', 1)
assert body.count('id="gohome"') == 1
body = body.replace('<button class="btn" id="gofarm"', '<button class="btn" id="goarc" type="button" aria-label="ไปตึกเกม">🕹️<span class="lbl"> ตึกเกม</span></button>\n  <button class="btn" id="gofarm"', 1)
assert 'id="goarc"' in body
body = body.replace('<canvas id="ov"></canvas>', '<canvas id="ov"></canvas><button class="btn" id="act" type="button"></button>', 1)
assert 'id="act"' in body

# the tap dispatch becomes useHit(hit) so the action button can reuse it
_a = "  const [wx, wy] = worldAt(e), hit = pick(wx, wy);\n"
_b = "  closeCard(); me.after = null; go(me, [Math.floor(wx / T), Math.floor(wy / T)]);\n"
assert s.count(_a) == 1 and s.count(_b) == 1
_i = s.index(_a) + len(_a); _j = s.index(_b, _i); _body = s[_i:_j]
assert _body.count('  if (hit?.') >= 10, _body[:200]
_fn = re.sub(r'return ([^;]+);', r'return (\1, true);', _body)
s = s[:_i] + "  if (useHit(hit)) return;\n" + s[_j:]
_k = s.index("cv.addEventListener('pointerdown', e => {", s.index('function pick('))
s = s[:_k] + "function useHit(hit) {\n" + _fn + "  return false;\n}\n" + s[_k:]

# name tags: me first, then the lowest on screen; a tag that would cover one already placed moves up
rep("  for (const P of people) { const [sx, sy] = scr(P.px, P.py - 31); show(P.el, sx, sy, sceneOf(cellOf(P)) === scene); }",
    """  { const L = []; TAGR = [];
    for (const P of people) { const [sx, sy] = scr(P.px, P.py - 31); show(P.el, sx, sy, sceneOf(cellOf(P)) === scene); if (P.el.style.display !== 'none') L.push([P, sx, sy]); }
    L.sort((a, b) => (b[0] === me) - (a[0] === me) || b[2] - a[2]);
    for (const [P, sx, sy0] of L) { const el = P.el; if (el._wt !== el.textContent || !el._w) { el._wt = el.textContent; el._w = el.offsetWidth; el._h = el.offsetHeight; }
      const w = el._w || 60, h = el._h || 20; let sy = sy0;
      for (let k = 0; k < 6; k++) { const o = TAGR.find(r => Math.abs(r[0] - sx) < (r[2] + w) / 2 + 2 && sy - h < r[1] && r[1] - r[3] < sy); if (!o) break; sy = o[1] - o[3] - 2; }
      if (sy !== sy0) el.style.top = sy + 'px'; TAGR.push([sx, sy, w, h]); } }""")
rep("if (r.ok) say(me, EMO[tool], 900, true);", "if (r.ok) { say(me, EMO[tool], 900, true); if (TOUCH && navigator.vibrate) navigator.vibrate(12); }")

MOBILE = r"""// ---- phone QoL: ☰ folds the side buttons, one big button does whatever is right next to you, zoom is remembered ----
{ const side = SR.querySelector('.side'), more = SR.getElementById('more');
  more.onclick = e => { e.stopPropagation(); side.classList.toggle('open'); };
  side.addEventListener('click', e => { if (e.target.closest('.btn') && e.target.closest('.btn') !== more) side.classList.remove('open'); });
  cv.addEventListener('pointerdown', () => side.classList.remove('open')); }
try { const z = +localStorage.getItem('vilZoom'); if (!scene && z >= minSC() && z <= 5) { SC = z; resize(); } } catch (e) {}
const actB = SR.getElementById('act');
const ACT_TH = { npc: ['💬', 'คุย'], mach: ['🕹️', 'เล่น'], gacha: ['🎰', 'กาชา'], party: ['🎉', 'ปาร์ตี้'], alist: ['📋', 'รายชื่อเกม'], arank: ['🏆', 'อันดับ'], plot: ['🌱', ''],
  enter: ['🚪', 'เข้า'], shop: ['🛒', 'ร้าน'], orders: ['📋', 'ออเดอร์'], chest: ['📦', 'กล่อง'], board: ['📌', 'บอร์ด'], tower: ['🏢', 'ตึก'], lot: ['🏠', 'บ้าน'] };
const ACT_ORDER = Object.keys(ACT_TH);
function nearAct() {
  const [cx, cy] = cellOf(me), [fx, fy] = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[me.dir] || [0, 1], here = sceneOf(cellOf(me));
  const N = NPCS.find(N => sceneOf(cellOf(N.P)) === here && cdist(cellOf(N.P), [cx, cy]) <= 1); if (N) return { npc: N };
  if (!scene) { const p = frontPlot(); if (p) return { plot: p }; }
  let best = null, bs = 1e9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const h = pick((cx + dx + .5) * T, (cy + dy + .5) * T); if (!h || h.plot || h.npc) continue;
    const k = ACT_ORDER.findIndex(n => h[n]); if (k < 0) continue;
    // the cell you face wins, then straight up (machines, doors and boards sit above where you stand), then the rest; type order breaks ties
    const sc = (dx === fx && dy === fy ? 0 : dx === 0 && dy === -1 ? 1 : Math.abs(dx) + Math.abs(dy) + 1) * 100 + k; if (sc < bs) { bs = sc; best = h; } }
  return best; }
let actH = null, actSig = '', zSaved = SC;
setInterval(() => {
  if (!scene && SC !== zSaved) { zSaved = SC; try { localStorage.setItem('vilZoom', SC); } catch (e) {} }
  const h = TOUCH && H.visible() && !me.path.length && card.style.display !== 'block' ? nearAct() : null; actH = h;
  let k = h ? ACT_ORDER.find(n => h[n]) : ''; let [em, lb] = k ? ACT_TH[k] : ['', ''];
  if (k === 'mach') { const gm = H.games().find(x => x.id === h.mach.id); if (gm) em = gm.emoji;
    const [cx, cy] = cellOf(me); if (cx === h.mach.x && cy === h.mach.y + 1) { k = ''; } }   // standing at it: village.js shows the cabinet card with ▶ เล่น
  if (k === 'plot') { lb = (selEl.textContent || '').replace(/\s*\(.*$/, '').slice(0, 10) || 'ใช้'; }
  const sig = k + lb; if (sig === actSig) return; actSig = sig;
  actB.style.display = k ? 'block' : 'none'; actB.innerHTML = k ? `<b>${em}</b>${lb}` : ''; }, 200);
actB.onclick = e => { e.stopPropagation(); if (actH) useHit(actH); };
"""
s = s.replace("@@API@@", MOBILE + "@@API@@")
# hoisted so the frame loop (defined earlier) can fill it
rep("const people = [];", "const people = [], TOUCH = matchMedia('(pointer:coarse)').matches; var TAGR = [];")
# ---------------- start + API ----------------
rep("window.__cb = { DAY_MS,", "if (window.__TEST__) window.__cb = { DAY_MS,")
API = r"""// rebuild the static world when the live lots change (stage, colours, garden size); community plots and the room you stand in are kept
function relots() { const keep = {}; for (const p of PLOTS) if (!p.home) keep[p.x + ',' + p.y] = { o: p.o, by: p.by, bn: p.bn, c: p.c, t: p.t, w: p.w, fw: p.fw, rt: p.rt };
  const was = scene; buildWorld(); PLOT_AT = null;
  for (const p of PLOTS) Object.assign(p, keep[p.x + ',' + p.y] || {});
  if (was) { const s2 = ROOMS.find(r => r.slot === was.slot) || null; scene = s2;
    if (!s2) { place(me, was.out); scene = null; enterScene(null); } else if (!walkable(...cellOf(me))) place(me, s2.entry); }
  else if (!walkable(...cellOf(me))) { const c = near(...cellOf(me)); if (c) place(me, c); } }
// 🕹️ arcade: walk up to a machine (from anywhere in the village), face it, then the live game starts that mini game
const arcRoom = () => ROOMS.find(r => r.kind === 'arcade') || null;
// 🕹️ quick trip: from anywhere outside the hall, fade straight to its entrance (no walking across the village)
function warpArc() { const r = arcRoom(); if (!r) return false; if (sceneOf(cellOf(me)) !== r) { me.after = null; place(me, r.entry); me.dir = 'up'; } return true; }
function warp(c) { me.after = null; place(me, c); cam.x = me.px; cam.y = me.py; const s2 = sceneOf(c); if (s2 !== scene) enterScene(s2); }
function playAt(M, cb) { closeCard(); const st = M.st || [M.x, M.y + 1], here = () => cdist(cellOf(me), st) <= 0 && sceneOf(cellOf(me)) === sceneOf(st);
  const go2 = () => { if (!here()) return; me.dir = M.st ? 'right' : 'up'; if (cb) cb(); else if (M.id) H.play(M.id); };
  if (here() && !me.path.length) return go2(); travel(me, st, go2); }
return { me, held, C, R,
  // board deliveries (village.js) also use vegetables harvested here: count / take '<crop>' from the bag
  bagN: id => count(BAG, id), bagTake(id, n) { if (count(BAG, id) < n) return false; takeFrom(BAG, id, n); save(); hud(); return true; },
  arcade: { room: arcRoom, walk(id, cb) { const r = arcRoom(); if (!r) return false; const M = r.mach.find(m => m.id === id); warpArc();
    if (M) playAt(M, cb); else { closeCard(); me.after = null; travel(me, r.entry); } return true; },
    to(what, cb) { const r = arcRoom(); if (!r || !r[what]) return false; warpArc(); playAt({ x: r[what][0], y: r[what][1], st: what === 'alist' ? [r[what][0] - 1, r[what][1]] : null }, cb); return true; } }, get G() { return G; }, get block() { return block; }, get ctx() { return ctx; }, ov: SR.getElementById('ov'),
  travel: c => { closeCard(); me.after = null; travel(me, c); }, place: c => place(me, c), warp: c => { closeCard(); warp(c); }, warpArc: () => { closeCard(); return warpArc(); },
  pos: () => cellOf(me), walkable: (x, y) => walkable(x, y), get ride() { return riding(me); }, rideMul: k => RIDES[k]?.[2] || 1,
  drawRide: (g, P, k, back) => { if (RIDE_SPR[k]) drawRide(g, P, k, back); }, sceneOf, scene: () => scene, relots, closeCard,
  talk: i => { if (NPCS[i]) talkTo(NPCS[i]); }, enterLot: id => { const L = LOTS.find(l => l.id === id); if (L && L.room) enter(L.room); },
  hasRoom: id => !!(LOTS.find(l => l.id === id) || {}).room,
  lotTop: id => { const L = LOTS.find(l => l.id === id); return !L ? 0 : hasHouse(L) && !(L.stage === 2 && L.building) ? (L.y + 3) * T - (isBig(L) ? 130 : 98) : (L.y + 1) * T - 4; },
  get SC() { return SC; }, NPCS, F, BAG, PLOTS: () => PLOTS, rideCard, friendsCard, hud,
  get LIVE() { return LIVE && LIVEO; }, doAct, giveOrder, tagRects: () => TAGR };"""
s = s.replace("@@API@@", API)

out = "// GENERATED by _test/gen_village_world.py from _test/village-cozy-big.html — the live village engine (map, rooms, NPCs, rides, community farm).\n" \
      "// Rendered in a shadow root inside .vil-wrap; village.js passes the hooks H (lots, presence, pets, jobs, coins) and draws its pills on #ov.\n" \
      "// Art: Kenney (CC0) · Tiny Farm RPG by Maeve Devs (packed atlas, credit on screen) · characters/crops: HR Arcade.\n" \
      "'use strict';\nconst VillageWorld = {\n  start(host, H) {\n    const SR = host.attachShadow({ mode: 'open' });\n" \
      "    SR.innerHTML = '<style>' + " + json.dumps(css, ensure_ascii=False) + " + '</style>' + " + json.dumps(body.strip(), ensure_ascii=False) + ";\n" \
      "    const VW = () => host.clientWidth || 800, VH = () => host.clientHeight || 560;\n" + s + "\n  }\n};\n"
open('village-world.js', 'w', encoding='utf-8').write(out)
print('ok', len(out), 'hoisted', len(names))
