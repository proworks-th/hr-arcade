"""End-to-end test of the rename fix (13 Nov 2026) on the in-memory Firebase mocks: python verify/test_rename.py"""
import sys, json; import pathlib; sys.path.insert(0, str(pathlib.Path(__file__).parent))
import run as V
from playwright.sync_api import sync_playwright
httpd, base = V.serve()
res = {}
with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    page = br.new_page(viewport={'width': 1366, 'height': 768}); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(base + '/index.html?test=1'); page.wait_for_function('window.__app', timeout=5000)
    # an existing player "จจ" (signed in, uid u1) with an older house that has no uid yet, plus another player "taken"
    page.evaluate("""async () => { store.set('name', 'จจ'); document.querySelector('#nameIn').value = 'จจ'; Cloud.acct = { uid: 'u1' };
      const M = await import('/verify/mocks/firebase-database.js');
      await M.set(M.ref(null, 'rooms/_vil/lots/3'), { k: 'จจ', n: 'จจ', stage: 2, end: 1, who: 'alex', g: 10, t: 1 });
      await M.set(M.ref(null, 'rooms/_prof/จจ'), { n: 'จจ', lv: 29 });
      await M.set(M.ref(null, 'rooms/_like/จจ'), { a: 1, b: 1 });
      await M.set(M.ref(null, 'rooms/_office/by/จจ'), { n: 'จจ', p: 100 });
      await M.set(M.ref(null, 'rooms/_prof/taken'), { n: 'taken', lv: 3 }); }""")
    page.click('[data-view=village]'); page.wait_for_function('Village._dbg.ready', timeout=8000); page.wait_for_timeout(1500)
    db = lambda path: page.evaluate(f"(async () => {{ const M = await import('/verify/mocks/firebase-database.js'); return (await M.get(M.ref(null, '{path}'))).val(); }})()")
    res['1_adopted_uid'] = (db('rooms/_vil/lots/3') or {}).get('u')
    page.click('[data-view=hub]') if page.locator('[data-view=hub]').count() else None; page.wait_for_timeout(300)
    ni, nb, nn = page.locator('#nameIn'), page.locator('#nameSave'), page.locator('#nameNote')
    # typing alone must not rename
    ni.fill('taken'); page.wait_for_timeout(1000)
    res['2_typing_no_rename'] = page.evaluate("store.get('name')")
    res['2_save_button_visible'] = nb.is_visible()
    res['2_save_button_px'] = nb.bounding_box()
    nb.click(); res['3_confirm_label'] = nb.inner_text(); res['3_note'] = nn.inner_text()
    nb.click(); page.wait_for_timeout(600)
    res['4_taken_refused'] = [page.evaluate("store.get('name')"), nn.inner_text()]
    ni.fill('จ๊ะจ๋าพาทัวร์'); nb.click(); nb.click(); page.wait_for_timeout(1200)
    res['5_renamed'] = page.evaluate("store.get('name')")
    L = db('rooms/_vil/lots/3'); res['5_lot'] = {k: L.get(k) for k in ('k', 'n', 'u', 'stage')}
    res['5_likes'] = db('rooms/_like/จ๊ะจ๋าพาทัวร์'); res['5_office'] = db('rooms/_office/by/จ๊ะจ๋าพาทัวร์')
    res['5_old_gone'] = [db('rooms/_prof/จจ'), db('rooms/_like/จจ'), db('rooms/_office/by/จจ')]
    res['5_other_player_untouched'] = db('rooms/_prof/taken')
    # an old-style rename (name changed some other way): the uid relabels the house on its own
    page.evaluate("store.set('name', 'ใหม่อีก')"); page.wait_for_timeout(16500)
    L = db('rooms/_vil/lots/3'); res['6_healed_by_uid'] = {k: L.get(k) for k in ('k', 'n', 'u')}
    res['6_still_my_house'] = page.evaluate("Village._dbg.LOTS.filter(l => l.stage).map(l => [l.id, l.k, l.u])")
    res['errors'] = errs
    br.close()
httpd.shutdown()
print(json.dumps(res, ensure_ascii=False, indent=1))
