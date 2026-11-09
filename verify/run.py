"""Visual verify harness for HR Arcade.

Serves the site locally, opens every screen at three viewports in headless Chromium (test mode ?test=1, so
Firebase runs on in-memory mocks), runs the objective checks in verify/checks.js, and saves screenshots plus
report.json to verify/out/. Exit code 1 when any check fails.

    python verify/run.py                 # everything
    python verify/run.py --only hub,run  # some screens
    python verify/run.py --vp desktop    # one viewport
See VERIFY.md for what each check means and the taste rubric.
"""
import argparse, functools, http.server, io, json, pathlib, socketserver, sys, threading, time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'verify' / 'out'
CHECKS = (ROOT / 'verify' / 'checks.js').read_text(encoding='utf-8')
VIEWPORTS = {  # office PCs are the primary target
    'desktop': dict(viewport={'width': 1366, 'height': 768}),
    'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2),
    'tablet': dict(viewport={'width': 768, 'height': 1024}, has_touch=True),
}
# any of these in a request URL while in test mode = a real backend was hit -> fail
REAL_BACKENDS = ('firebasedatabase.app', 'firebaseio.com', 'gstatic.com/firebasejs', 'identitytoolkit')
# console errors we accept, with the reason
ALLOW_CONSOLE = [
    ('fonts.googleapis.com', 'web font may be blocked offline/CI; the page falls back to system fonts'),
    ('fonts.gstatic.com', 'web font files, same as above'),
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    request_queue_size = 128  # games load many small sprites at once; the default backlog of 5 refuses connections


def serve():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = Server(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}'


def canvas_blank(page, selector):
    """True when the canvas screenshot is a single flat colour (nothing rendered)."""
    from PIL import Image
    png = page.locator(selector).first.screenshot()
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((64, 40))
    px = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    return len(set(px)) < 8


# ---------- screens: name -> steps(page, base, shot) ----------
def hub(page, base, shot):
    page.goto(base + '/index.html?test=1')
    page.wait_for_function("window.__app && document.querySelector('.solo-grid .scard')", timeout=3000)
    page.wait_for_timeout(600)  # mock DB callbacks fill the online box / feed / champions
    page.click('#helpBtn')
    page.wait_for_selector('.overlay .help', timeout=2000)
    shot('hub-help')
    page.click('.overlay .help .btn.primary')
    shot('hub')  # last: its full-page capture resets touch emulation


def solo(game, play_ms=1200):
    def run(page, base, shot):
        page.goto(base + '/index.html?test=1')
        page.wait_for_function('window.__app', timeout=3000)
        page.evaluate(f'__app.open({json.dumps(game)})')
        page.wait_for_selector('.overlay .btn.primary', timeout=3000)
        shot(f'{game}-intro')
        page.evaluate('__app.start()')
        page.wait_for_function("__app.state().started", timeout=3000)
        page.wait_for_timeout(play_ms)
        shot(f'{game}-play')
    return run


def party2d(page, base, shot):
    page.goto(base + '/index.html?test=1')
    page.wait_for_function('window.__app', timeout=3000)
    page.evaluate("localStorage.setItem('hra_name', JSON.stringify('ทดสอบ'))")
    page.evaluate('__app.open("party")')
    page.wait_for_selector('[data-k=go]', timeout=5000)
    shot('party-join')
    page.click('[data-k=go]')
    page.wait_for_selector('.pt-stage canvas', timeout=5000)
    page.wait_for_timeout(800)
    if canvas_blank(page, '.pt-stage canvas'):
        raise AssertionError('party lobby canvas is blank')
    shot('party-lobby')


def party3d(page, base, shot):
    page.goto(base + '/party3d.html?test=1')
    page.wait_for_selector('#loading', state='detached', timeout=20000)  # three.js + GLB models
    page.wait_for_selector('.overlay [data-go]', timeout=5000)
    shot('party3d-join')
    page.click('.overlay [data-go]')
    page.wait_for_timeout(2500)
    if canvas_blank(page, '#stage canvas'):
        raise AssertionError('3D room canvas is blank (WebGL)')
    shot('party3d-room')


def office(page, base, shot):
    page.goto(base + '/index.html?test=1')
    page.wait_for_function('window.__app', timeout=3000)
    page.evaluate("localStorage.setItem('hra_name', JSON.stringify('ทดสอบ'))")
    page.click('#officeBtn')
    page.wait_for_selector('.office .shop-grid', timeout=3000)
    page.wait_for_timeout(600)
    shot('office')


def farm(page, base, shot):
    page.goto(base + '/index.html?test=1')
    page.wait_for_function('window.__app', timeout=3000)
    page.evaluate("localStorage.setItem('hra_name', JSON.stringify('ทดสอบ'))")
    page.click('#farmBtn')
    page.wait_for_selector('.farm .shop-grid', timeout=3000)
    page.mouse.click(*page.evaluate("(()=>{const r=document.querySelector('.farm canvas').getBoundingClientRect();return [r.left+r.width*.15,r.top+r.height*.4]})()"))
    page.wait_for_timeout(700)
    if canvas_blank(page, '.farm canvas'):
        raise AssertionError('farm canvas is blank')
    shot('farm')



TOWER_SEED = """async () => {
  localStorage.setItem('hra_name', JSON.stringify('ทดสอบ'));
  const M = await import('/verify/mocks/firebase-database.js'), now = Date.now(), P = {}, F = {};
  [['พี่ฝน', 14, 18, now - 36e5], ['เอ', 12, 15, 0], ['แบงค์', 9, 12, 0], ['ทดสอบ', 6, 12, 0], ['ใหม่', 2, 12, 0]].forEach(([n, lv, w, rt]) => {
    P[n] = { n, lv, ti: 'พนักงาน', who: 'adam', rt, t: now, room: { wall: 'wall_pink', floor: 'floor_wood', w, items: [['plant_pot', 2, 8], ['sofa_red', 5, 7]] } };
    F[n] = { nm: n, who: 'adam', n: 4, plots: [{ c: 'tom', t: now - 6e4, w: 0 }, { c: 'bok', t: now - 6e5, w: 0 }, 0, 0], t: now }; });
  M.set(M.ref(null, 'rooms/_prof'), P); M.set(M.ref(null, 'rooms/_farm'), F);
}"""


def tower(page, base, shot):
    page.goto(base + '/index.html?test=1')
    page.wait_for_function('window.__app', timeout=3000)
    page.evaluate(TOWER_SEED)
    page.click('[data-view=tower]')
    page.evaluate('Tower.refresh()')
    page.wait_for_selector('.tower-signs .door-s', timeout=3000)
    page.wait_for_timeout(600)
    shot('tower')
    page.locator('.door-s', has_text='พี่ฝน').first.click()
    page.wait_for_selector('.knock [data-a=water]', timeout=2000)
    shot('tower-knock')
    page.click('.knock [data-a=water]')
    page.wait_for_function("!document.querySelector('.knock [data-a=water]')", timeout=2000)
    # last: an element capture taller than the viewport resizes it and drops touch emulation
    if canvas_blank(page, '.tower-wrap canvas'):
        raise AssertionError('tower canvas is blank')


VILLAGE_SEED = """async () => {
  localStorage.setItem('hra_name', JSON.stringify('ทดสอบ'));
  const M = await import('/verify/mocks/firebase-database.js');
  M.set(M.ref(null, 'rooms/_vil/lots'), { 1: { k: 'พี่ฝน', n: 'พี่ฝน', who: 'amelia', stage: 5, g: 18 }, 2: { k: 'จ๋า', n: 'จ๋า', who: 'alex', stage: 3 },
    4: { k: 'ทดสอบ', n: 'ทดสอบ', who: 'adam', stage: 2 }, 5: { k: 'เอ', n: 'เอ', who: 'bob', stage: 1 }, 7: { k: 'นก', n: 'นก', stage: 4 } });
}"""


def village(page, base, shot):
    page.goto(base + '/index.html?test=1')
    page.wait_for_function('window.__app', timeout=3000)
    # hidden for real players: without test mode and without ?village=1 there is no tab
    hidden = page.evaluate("(() => { const t = window.__TEST__; window.__TEST__ = false; store.set('vilFlag', false); const r = Village.on(); window.__TEST__ = t; return r })()")
    if hidden:
        raise AssertionError('village tab would show for real players')
    page.evaluate(VILLAGE_SEED)
    page.click('[data-view=village]')
    page.wait_for_function('Village._dbg.ready', timeout=3000)
    page.wait_for_timeout(500)
    shot('village')
    # bricks: a weak round gives 1, a good one 3, never more than 12 a day
    b = page.evaluate("(() => { const got = [Prog.award('spot', 60).bricks]; for (let i = 0; i < 6; i++) got.push(Prog.award('spot', 2000).bricks); Village.show(); return { got, ...Prog.bricks() } })()")
    if b['got'][:2] != [1, 3] or sum(b['got']) != 12 or b['got'][-1] != 0 or b['n'] != 12 or b['today'] != 12:
        raise AssertionError('bricks wrong: ' + json.dumps(b))
    # a second player in another tab (same mock DB): they must show up and walk in this tab
    p2 = page.context.new_page()
    try:
        p2.goto(base + '/index.html?test=1')
        p2.wait_for_function('window.__app', timeout=3000)
        p2.evaluate("store.set('name', 'เพื่อนบี')")
        p2.click('[data-view=village]')
        p2.wait_for_function('Village._dbg.ready', timeout=3000)
        p2.evaluate('Village._dbg.goTo([16, 8])')
        page.evaluate("store.set('name', 'ทดสอบ')")  # same localStorage: give this tab its own name back
        page.wait_for_function("Object.values(Village._dbg.others).some(a => a.p.n === 'เพื่อนบี')", timeout=3000)
        page.wait_for_timeout(1200)
        shot('village-live')
        if page.evaluate("Object.values(Village._dbg.others)[0].x") < 6:  # spawned at the tower door (x 5), walking to x 16
            raise AssertionError('the other player did not walk: ' + json.dumps(page.evaluate("Object.values(Village._dbg.others).map(a => [a.x, a.y, a.to, a.path.length, a.p.vx, a.p.vy, a.p.v])")))
    finally:
        p2.close()
    # bricks on the roads: 3 a day, walking over one picks it up, each only once
    fl = page.evaluate('''async () => { const D = Village._dbg, w = ms => new Promise(r => setTimeout(r, ms)), b0 = Prog.bricks().n;
      for (const f of D.floorSpots()) { for (let i = 0; i < 2; i++) { D.me.path.length = 0; D.me.x = f.x; D.me.y = f.y; await w(150); } }
      return { spots: D.floorSpots().length, got: Prog.bricks().n - b0, fp: Prog.get().vil.fp } }''')
    if fl['spots'] != 3 or fl['got'] != 3:
        raise AssertionError('road bricks wrong: ' + json.dumps(fl))
    # full build path with fast timers (1 build hour = 100 ms): race, reserve, 4 stages, help a coworker
    r = page.evaluate('''async () => {
      const D = Village._dbg, M = await import('/verify/mocks/firebase-database.js'), w = ms => new Promise(r => setTimeout(r, ms));
      const L = id => D.LOTS.find(l => l.id === id), until = async f => { for (let i = 0; i < 100 && !f(); i++) await w(100); return f(); };
      D.fast = 100; await M.set(M.ref(null, 'rooms/_vil/lots/4'), null);
      const p = Prog.get(); p.lv = 12; p.room = { ...(p.room || {}), w: 22 }; p.coins = 70000; p.vil.bricks = 70; p.farm = { ...(p.farm || {}), bag: { tom: 40 }, plots: Array.from({ length: 10 }, (_, i) => ({ c: i % 2 ? 'tom' : 'bok', t: Date.now() - i * 60e3, w: i % 3 ? 1 : 0 })) }; Prog.put(p);
      const before = JSON.stringify(Prog.get().farm.plots), nBefore = Farm.n();
      const out = {};
      // someone else took lot 6 a moment ago but this tab still shows it empty: the transaction must refuse
      await M.set(M.ref(null, 'rooms/_vil/lots/6'), { k: 'คนอื่น', n: 'คนอื่น', stage: 1 }); Object.assign(L(6), { stage: 0, k: '' });
      await D.reserve(L(6)); out.race = [Prog.get().coins, (await M.get(M.ref(null, 'rooms/_vil/lots/6'))).val().k];
      await D.reserve(L(3)); await until(() => D.myLot()); out.res = [D.myLot() && D.myLot().id, Prog.get().coins, Prog.get().vil.lot];
      D.act(L(3)); out.stages = [];
      for (let s = 1; s < 5; s++) { await D.next(L(3)); await until(() => L(3).stage === s + 1);
        out.stages.push(L(3).stage); if (s === 1) { out.card = !!document.querySelector('.vil-card:not([hidden]) .vil-pb'); }
        await until(() => !(L(3).end > Date.now())); }
      const q = Prog.get(); out.after = [q.coins, q.vil.bricks, q.farm.bag.tom || 0, L(3).g];
      out.move = [nBefore, Farm.n(), Farm.home(), JSON.stringify(q.farm.plots) === before];
      // help: not on my own house; once a day on a coworker's house that is building
      const end = Date.now() + 60000; await M.set(M.ref(null, 'rooms/_vil/lots/7'), { k: 'นก', n: 'นก', stage: 4, end }); await until(() => L(7).end === end);
      const c0 = Prog.get().coins; await D.help(L(7)); await until(() => L(7).end < end);
      out.help = [end - L(7).end, Prog.get().coins - c0, Object.keys((L(7).hp || {}).by || {}).length];
      await D.help(L(7)); out.help2 = Prog.get().coins - c0;
      D.fast = false; D.act(L(7)); return out; }''')
    want = {'race': [70000, 'คนอื่น'], 'res': [3, 60000, 3], 'stages': [2, 3, 4, 5], 'after': [20000, 10, 10, 14], 'move': [10, 14, 14, True], 'help': [200, 5, 1], 'help2': 5}
    if any(r.get(k) != v for k, v in want.items()) or not r.get('card'):
        raise AssertionError('build path wrong: ' + json.dumps(r, ensure_ascii=False))
    page.wait_for_timeout(1500)
    shot('village-card')
    if canvas_blank(page, '.vil-wrap canvas'):
        raise AssertionError('village canvas is blank')
    # step 5: the farm moved in. Tower balcony shows the sign, the farm screen has 14 plots, buying 18 updates the lot
    page.evaluate("document.querySelector('.vil-card [data-a=close]').click()")
    page.click('[data-view=tower]')
    page.evaluate('scrollTo(0, 0)')
    page.wait_for_timeout(800)
    shot('village-tower')
    page.evaluate("startGame('farm')")
    page.wait_for_selector('.farm [data-a=garden]', timeout=3000)
    page.wait_for_timeout(600)
    shot('village-farm14')
    page.click('.farm [data-a=garden]')
    g = page.evaluate('''async () => { const M = await import('/verify/mocks/firebase-database.js'); await new Promise(r => setTimeout(r, 400));
      return [Farm.n(), Prog.get().coins, (await M.get(M.ref(null, 'rooms/_vil/lots/3'))).val().g, (await M.get(M.ref(null, 'rooms/_farm/' + Village._dbg.myLot().k))).val()] }''')
    if g[0] != 18 or g[1] != 10005 or g[2] != 18:  # 20,000 left after the house + 5 from helping − 10,000
        raise AssertionError('garden upgrade wrong: ' + json.dumps(g[:3]))
    page.wait_for_timeout(1200)
    fr = page.evaluate('''async () => { const M = await import('/verify/mocks/firebase-database.js'); const v = (await M.get(M.ref(null, 'rooms/_farm/' + Village._dbg.myLot().k))).val(); return v && [v.n, v.plots.length, v.plots.filter(Boolean).length] }''')
    if fr != [18, 18, 10]:
        raise AssertionError('public farm copy wrong: ' + json.dumps(fr))
    shot('village-farm18')
    if canvas_blank(page, '.farm canvas'):
        raise AssertionError('farm canvas is blank')


SCREENS = {'office': office, 'farm': farm, 'hub': hub, 'tower': tower, 'village': village, 'spot': solo('spot'), 'run': solo('run'), 'whack': solo('whack'), 'stack': solo('stack', 600),
           'tetris': solo('tetris'), 'stamp': solo('stamp'), 'barista': solo('barista', 2500), 'toss': solo('toss'), 'slack': solo('slack', 2000), 'conga': solo('conga', 2000), 'prism': solo('prism'),
           'party': party2d}


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--vp', default='')
    a = ap.parse_args()
    screens = [s for s in SCREENS if not a.only or s in a.only.split(',')]
    vps = [v for v in VIEWPORTS if not a.vp or v in a.vp.split(',')]
    OUT.mkdir(parents=True, exist_ok=True)
    httpd, base = serve()
    report, failed = [], 0
    with sync_playwright() as pw:
        args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
        browser = None
        # bundled Chromium (CI); some Windows PCs block its exe ("spawn UNKNOWN"), so fall back to installed Edge/Chrome
        for channel in (None, 'msedge', 'chrome'):
            try:
                browser = pw.chromium.launch(args=args, **({'channel': channel} if channel else {}))
                print(f'browser: {channel or "bundled chromium"} {browser.version}')
                break
            except Exception as e:
                print(f'browser {channel or "bundled chromium"} unavailable: {str(e).splitlines()[0][:90]}')
        if not browser:
            sys.exit('no Chromium-based browser could be launched')
        for vp in vps:
            for name in screens:
                ctx = browser.new_context(**VIEWPORTS[vp], locale='th-TH')
                page = ctx.new_page()
                errors, backend, shots = [], [], []
                page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
                page.on('console', lambda m: m.type == 'error' and not any(k in (m.text + str(m.location)) for k, _ in ALLOW_CONSOLE) and errors.append(f'console: {m.text[:200]}'))

                def route(r, backend=backend):
                    if any(h in r.request.url for h in REAL_BACKENDS):
                        backend.append(r.request.url[:120]); return r.abort()
                    r.continue_()
                page.route('**/*', route)

                findings = {'fail': [], 'warn': []}

                def shot(label, page=page, vp=vp, shots=shots, findings=findings, name=name):
                    # measure only after entrance animations (e.g. dialog pop-in scale) have settled
                    page.wait_for_function("document.getAnimations().every(a => a.playState !== 'running' || a.effect.getTiming().iterations === Infinity)", timeout=3000)
                    res = page.evaluate(CHECKS, VIEWPORTS[vp].get('has_touch', False))
                    findings['fail'] += [f'[{label}] {x}' for x in res['fail']]
                    findings['warn'] += [f'[{label}] {x}' for x in res['warn']]
                    f = OUT / f'{label}@{vp}.png'
                    # full-page capture resizes the emulated viewport and drops touch emulation for later checks,
                    # so only the hub (its first shot) is captured full length
                    page.screenshot(path=str(f), full_page=(label == 'hub'))
                    shots.append({'label': label, 'file': f.name, 'height': res['height']})

                t0 = time.time()
                try:
                    SCREENS[name](page, base, shot)
                except Exception as e:  # readiness timeout, blank canvas, ...
                    findings['fail'].append(f'[{name}] {type(e).__name__}: {str(e).splitlines()[0][:200]}')
                    try: page.screenshot(path=str(OUT / f'{name}-ERROR@{vp}.png'), full_page=True)
                    except Exception: pass
                findings['fail'] += errors + [f'real backend hit: {u}' for u in backend]
                ok = not findings['fail']
                failed += not ok
                report.append({'screen': name, 'viewport': vp, 'ok': ok, 'secs': round(time.time() - t0, 1), **findings, 'shots': shots})
                print(f"{'PASS' if ok else 'FAIL'}  {name:8} {vp:7} {len(findings['fail'])} fail, {len(findings['warn'])} warn")
                for x in findings['fail'][:8]: print('      -', x)
                ctx.close()
        browser.close()
    httpd.shutdown()
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'\n{len(report) - failed}/{len(report)} passed · screenshots + report.json in {OUT}')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
