"""Phone controls check for the dungeon (PRD _test/prd-phone-first.md 7.3 / 7.4).

Serves the repo on a free port, opens index.html?test=1 (Firebase mocks, never the real database) and plays the
dungeon at 414x896 and 390x844 (touch) in every hand / button-size setting, plus desktop 1366x768. On touch the hub
runs games in its full-screen game mode (body.playing: #stage fixed to the viewport, header hidden, #gmExit top-left).

    python3 _test/dungeon/test-phone.py            # all
    python3 _test/dungeon/test-phone.py --quick    # 414x896, right hand, normal size only

Checks: stick + dodge in the thumb zone (bottom 40%), every control >= Phone.btn() and >= 12 px apart, nothing in
the exit corner, 7+ tiles each side of the player, an edge marker for an off-screen spawn swirl for its whole
warning, the stick moves the player and only from its own half, dodge and menu respond, level-up cards in the lower
half, no key names on touch, desktop unchanged (keyboard intro, DOM HUD with the leave button). Screenshots go to
_test/dungeon/shots/phone-*.png.
"""
import functools, http.server, json, pathlib, socketserver, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
SHOTS = ROOT / '_test' / 'dungeon' / 'shots'
KEYS = ('WASD', 'Shift', 'Space', 'ลูกศร', 'กด 1 2 3', '· R')


class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


def serve():
    class S(socketserver.ThreadingTCPServer): request_queue_size = 128
    h = S(('127.0.0.1', 0), functools.partial(Q, directory=str(ROOT)))
    threading.Thread(target=h.serve_forever, daemon=True).start()
    return h, f'http://127.0.0.1:{h.server_address[1]}'


def phone(br, base, w, hgt, hand, size, gm, fails, tag):
    ctx = br.new_context(viewport={'width': w, 'height': hgt}, is_mobile=True, has_touch=True, device_scale_factor=2, locale='th-TH')
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'fonts.g' not in m.text and errs.append(m.text))
    pg.route('**/*', lambda r: r.abort() if any(k in r.request.url for k in ('firebaseio', 'firebasedatabase', 'gstatic.com/firebasejs')) else r.continue_())
    bad = lambda msg: fails.append(f'{tag}: {msg}')
    pg.goto(base + '/index.html?test=1'); pg.wait_for_function("window.__app && typeof Phone !== 'undefined'")
    pg.evaluate(f"Phone.set('hand', '{hand}'); Phone.set('size', '{size}'); store.set('name', 'ทดสอบ')")
    pg.evaluate('__app.open("dungeon")')
    pg.wait_for_selector('.overlay .btn.primary')
    how = pg.text_content('.overlay .how')
    for k in KEYS:
        if k in how: bad(f'key name "{k}" in the dungeon intro on touch')
    tut = pg.inner_text('.overlay .tut') if pg.query_selector('.overlay .tut') else ''
    hub_keys = [k for k in KEYS if k in tut]
    pg.wait_for_timeout(300); pg.screenshot(path=str(SHOTS / f'phone-{tag}-intro.png'))
    pg.evaluate('__app.start()'); pg.wait_for_function('window.__dgn && __dgn.state().mode === "play"')
    pg.evaluate('__dgn.god(true)'); pg.wait_for_timeout(700)
    btn = pg.evaluate('Phone.btn()'); c = pg.evaluate('__dgn.controls()')
    # thumb zone, sizes, gaps, exit corner, inside the viewport
    for k in ('stick', 'dodge'):
        r = c[k]
        if r['y'] < hgt * .6 - 1: bad(f'{k} top {r["y"]:.0f} above the thumb zone ({hgt * .6:.0f})')
        if r['y'] + r['h'] > hgt + .5 or r['x'] < -.5 or r['x'] + r['w'] > w + .5: bad(f'{k} outside the viewport {r}')
    for k in ('stick', 'dodge', 'menu'):
        r = c[k]
        if min(r['w'], r['h']) < btn - .5: bad(f'{k} {r["w"]:.0f}x{r["h"]:.0f} < Phone.btn() {btn}')
        if r['x'] < 56 + 4 and r['y'] < 56 + 4: bad(f'{k} in the exit corner')
    gap = lambda a, b: max(b['x'] - (a['x'] + a['w']), a['x'] - (b['x'] + b['w']), b['y'] - (a['y'] + a['h']), a['y'] - (b['y'] + b['h']))
    for a, b in (('stick', 'dodge'), ('stick', 'menu'), ('dodge', 'menu')):
        if gap(c[a], c[b]) < 12: bad(f'{a} and {b} only {gap(c[a], c[b]):.0f} px apart')
    left = hand == 'l'
    if (c['dodge']['x'] < w / 2) != left: bad('dodge on the wrong side for the hand setting')
    if (c['stick']['zone']['x'] >= w / 2 - 1) != left: bad('stick zone on the wrong half')
    if c['view']['across'] < 15: bad(f"only {c['view']['across']} tiles across (need 7 each side)")
    if c['canvas']['w'] < w - 1 or c['canvas']['h'] < hgt - 1: bad(f"canvas {c['canvas']} doesn't fill the game-mode stage")
    ex = pg.evaluate("(() => { const r = document.querySelector('#gmExit').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })()")
    if ex['w'] < 1 or ex['x'] + ex['w'] > 56 or ex['y'] + ex['h'] > 56: bad(f'hub exit button not in the top-left 56x56 corner: {ex}')
    pg.screenshot(path=str(SHOTS / f'phone-{tag}-play.png'))
    # the stick moves the player; a press on the other half (off the dodge button) doesn't
    cdp = ctx.new_cdp_session(pg)
    touch = lambda t, pts: cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': pts})
    sx = c['stick']['x'] + c['stick']['w'] / 2; sy = c['stick']['y'] + c['stick']['h'] / 2
    moved = 0
    for dx, dy in ((1, 0), (-1, 0), (0, -1), (0, 1)):   # some direction will be open floor
        s0 = pg.evaluate('__dgn.state()')
        touch('touchStart', [{'x': sx, 'y': sy, 'id': 1}])
        for i in range(1, 9): touch('touchMove', [{'x': sx + dx * i * 9, 'y': sy + dy * i * 9, 'id': 1}]); pg.wait_for_timeout(40)
        pg.wait_for_timeout(250)
        if not pg.evaluate("document.querySelector('.dgn-pick')") and dx == 1 and dy == 0: pg.screenshot(path=str(SHOTS / f'phone-{tag}-stick.png'))
        touch('touchEnd', [])
        s1 = pg.evaluate('__dgn.state()'); moved = max(moved, abs(s1['x'] - s0['x']) + abs(s1['y'] - s0['y']))
    if moved < 20: bad('the stick did not move the player')
    while pg.evaluate('__dgn.state().mode') == 'pick': pg.evaluate('__dgn.pick(0)'); pg.wait_for_timeout(150)
    ox = w * .75 if not left else w * .25
    s0 = pg.evaluate('__dgn.state()'); touch('touchStart', [{'x': ox, 'y': hgt * .45, 'id': 2}])
    touch('touchMove', [{'x': ox + 60, 'y': hgt * .45, 'id': 2}]); pg.wait_for_timeout(300); touch('touchEnd', [])
    s1 = pg.evaluate('__dgn.state()')
    if abs(s1['x'] - s0['x']) > 2: bad('a drag on the dodge half moved the player')
    # dodge: pressed state at once + a dash
    d = c['dodge']; touch('touchStart', [{'x': d['x'] + d['w'] / 2, 'y': d['y'] + d['h'] / 2, 'id': 3}]); pg.wait_for_timeout(40)
    pg.screenshot(path=str(SHOTS / f'phone-{tag}-dodge.png')); touch('touchEnd', [])
    if not pg.evaluate('__dgn.state().dash'): bad('the dodge button did not dodge')
    # edge marker: a spawn swirl outside the view and must be marked for its whole warning
    placed = pg.evaluate('__dgn.swirlOff()')
    # sample markers() on every frame for the swirl's whole warning (DD.WAVE.warn), in game time
    seen = pg.evaluate('''() => new Promise(res => { const out = []; let t = 0, last = performance.now(); const tick = now => {
        t += Math.min(.05, (now - last) / 1000); last = now; if (t < DD.WAVE.warn - .12) { out.push(__dgn.markers()); requestAnimationFrame(tick); } else res(out); };
        requestAnimationFrame(tick); })''')
    pg.evaluate('__dgn.swirlOff(); __dgn.swirlOff()'); pg.wait_for_timeout(250); pg.screenshot(path=str(SHOTS / f'phone-{tag}-marker.png'))
    if not placed: bad('could not place a test swirl outside the view')
    elif not seen or min(seen[1:] or [0]) < 1: bad(f'off-screen swirl lost its edge marker during the warning: {seen}')
    # menu: pauses, map opens and a tap closes it
    pg.tap('.dgn-menu'); pg.wait_for_timeout(150)
    if pg.evaluate('__dgn.state().mode') != 'menu': bad('menu did not open')
    pg.screenshot(path=str(SHOTS / f'phone-{tag}-menu.png'))
    pg.tap('.dgn-sheet .mp'); pg.wait_for_timeout(200); pg.screenshot(path=str(SHOTS / f'phone-{tag}-map.png'))
    touch('touchStart', [{'x': w / 2, 'y': hgt / 2, 'id': 4}]); touch('touchEnd', []); pg.wait_for_timeout(100)
    if pg.evaluate('__dgn.state().mode') != 'play': bad('tapping the map did not return to play')
    # level-up cards in the lower half
    pg.evaluate('__dgn.xp(40)'); pg.wait_for_selector('.dgn-pick .panel', timeout=3000); pg.wait_for_timeout(400)
    top = pg.evaluate("document.querySelector('.dgn-pick .panel').getBoundingClientRect().top")
    if top < hgt * .4: bad(f'level-up cards start at {top:.0f}, not in the lower part ({hgt * .4:.0f})')
    txt = pg.inner_text('.dgn-pick')
    for k in KEYS:
        if k in txt: bad(f'key name "{k}" on the level-up card')
    small = pg.evaluate("[...document.querySelectorAll('.dgn-pick button')].map(b => b.getBoundingClientRect()).filter(r => r.height < Phone.btn() - .5).length")
    if small: bad(f'{small} level-up buttons under Phone.btn()')
    pg.screenshot(path=str(SHOTS / f'phone-{tag}-levelup.png'))
    while pg.evaluate('__dgn.state().mode') == 'pick': pg.evaluate('__dgn.pick(0)'); pg.wait_for_timeout(150)
    # live re-layout: flip the hand during play
    pg.evaluate(f"Phone.set('hand', '{'r' if left else 'l'}')"); pg.wait_for_timeout(120)
    c2 = pg.evaluate('__dgn.controls()')
    if (c2['dodge']['x'] < w / 2) == (c['dodge']['x'] < w / 2): bad('Phone.set hand did not re-lay out the controls')
    pg.evaluate(f"Phone.set('hand', '{hand}')")
    # leave from the menu pays out like before
    for _ in range(12):
        if pg.evaluate('__dgn.state().mode') == 'pick': pg.evaluate('__dgn.pick(0)')
        pg.wait_for_timeout(250)
    pg.tap('.dgn-menu'); pg.tap('.dgn-sheet .q'); pg.wait_for_selector('.overlay .res', timeout=5000)
    for e in errs: bad(f'error: {e[:160]}')
    ctx.close()
    return hub_keys


def desktop(br, base, fails):
    ctx = br.new_context(viewport={'width': 1366, 'height': 768}, locale='th-TH'); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base + '/index.html?test=1'); pg.wait_for_function('window.__app'); pg.evaluate("store.set('name', 'ทดสอบ')")
    pg.evaluate('__app.open("dungeon")'); pg.wait_for_selector('.overlay .btn.primary')
    if 'WASD' not in pg.text_content('.overlay .how'): fails.append('desktop: keyboard hints missing from the intro')
    pg.evaluate('__app.start()'); pg.wait_for_function('window.__dgn && __dgn.state().mode === "play"'); pg.wait_for_timeout(800)
    c = pg.evaluate('__dgn.controls()')
    if c['touch'] or c['view']['zoom'] != 1: fails.append(f'desktop: touch layout or zoom active {c}')
    cv = pg.evaluate("(() => { const c = document.querySelector('#stage canvas'); return [c.width, c.height] })()")
    if cv not in ([720 * 1, 432 * 1], [1440, 864]): fails.append(f'desktop: canvas size changed {cv}')
    s0 = pg.evaluate('__dgn.state()'); pg.keyboard.down('d'); pg.wait_for_timeout(300); pg.keyboard.up('d')
    pg.keyboard.down('a'); pg.wait_for_timeout(300); pg.keyboard.up('a')
    pg.screenshot(path=str(SHOTS / 'phone-desktop-play.png'))
    pg.evaluate('__dgn.god(true); __dgn.awakeAll(); for (let i = 0; i < 4; i++) __dgn.wave()'); pg.wait_for_timeout(900)
    pg.evaluate('__dgn.perfReset()'); pg.wait_for_timeout(1500); perf = pg.evaluate('__dgn.perf()')
    pg.click('.dgn-hud .q'); pg.wait_for_selector('.overlay .res', timeout=5000)
    for e in errs: fails.append(f'desktop error: {e[:160]}')
    ctx.close(); return perf


def main():
    quick = '--quick' in sys.argv
    SHOTS.mkdir(parents=True, exist_ok=True)
    httpd, base = serve(); fails = []; hub_keys = set(); runs = []
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        sizes = [(414, 896)] if quick else [(414, 896), (390, 844)]
        for w, h in sizes:
            for hand, size in ([('r', 'n')] if quick else [('r', 'n'), ('l', 'n'), ('r', 'l'), ('l', 'l')]):
                for gm in [True]:
                    tag = f'{w}x{h}-{hand}{size}'; runs.append(tag)
                    hub_keys |= set(phone(br, base, w, h, hand, size, gm, fails, tag))
        perf = None if quick else desktop(br, base, fails)
        br.close()
    httpd.shutdown()
    print(json.dumps({'runs': runs, 'desktop_perf_swarm': perf, 'hub_tutorial_key_names_on_touch': sorted(hub_keys), 'fails': fails}, ensure_ascii=False, indent=1))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
