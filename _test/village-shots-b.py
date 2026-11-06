from playwright.sync_api import sync_playwright
import os; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'village-')
URL = 'http://localhost:8767/_test/village-proto.html'
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    for name, vp, mobile in [('desk', {'width': 1200, 'height': 860}, False), ('phone', {'width': 390, 'height': 800}, True)]:
        pg = b.new_page(viewport=vp, device_scale_factor=2 if mobile else 1, has_touch=mobile)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.evaluate("_v.visit('board')"); pg.wait_for_timeout(3000)
        pg.screenshot(path=OUT + name + '-4.png')            # board with delivery jobs
        pg.locator('#card [data-a=job]').first.click(); pg.wait_for_timeout(5000)
        pg.screenshot(path=OUT + name + '-5.png')            # walked to จ๋า, deliver button, pet following
        pg.locator('#card [data-a=deliver]').click(); pg.wait_for_timeout(300)
        pg.locator('#ride').click(); pg.wait_for_timeout(300)
        pg.locator('#card [data-a=buyride]').first.click(); pg.wait_for_timeout(300)
        pg.screenshot(path=OUT + name + '-6.png')            # rides card after buying bike
        pg.evaluate("_v.pet.full = 0; document.getElementById('card').hidden = true"); pg.wait_for_timeout(200)
        pg.evaluate("_v.open('pet')"); pg.wait_for_timeout(300)
        pg.screenshot(path=OUT + name + '-7.png')            # pet card, hungry
        print(name, 'coins', pg.inner_text('#coins'), 'jobs', pg.evaluate("_v.JOBS.map(j=>j.s)"), 'errors', errs)
        pg.close()
    b.close()
