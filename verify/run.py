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


SCREENS = {'hub': hub, 'spot': solo('spot'), 'run': solo('run'), 'whack': solo('whack'), 'stack': solo('stack', 600),
           'tetris': solo('tetris'), 'stamp': solo('stamp'), 'barista': solo('barista', 2500), 'toss': solo('toss'),
           'party': party2d, 'party3d': party3d}


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
