from playwright.sync_api import sync_playwright
import os; OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'village-')
URL = 'http://localhost:8767/_test/village-proto.html'
with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    for name, vp, mobile in [('desk', {'width': 1200, 'height': 860}, False), ('phone', {'width': 390, 'height': 800}, True)]:
        pg = b.new_page(viewport=vp, device_scale_factor=2 if mobile else 1, has_touch=mobile)
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(1500)
        pg.evaluate("_v.visit(_v.LOTS[0])"); pg.wait_for_timeout(3500)
        pg.screenshot(path=OUT + name + '-0.png')            # พี่ฝน's house + 18-plot garden, knock card
        pg.locator('#card [data-a=water]').click(); pg.wait_for_timeout(300)
        pg.locator('#card [data-a=enter]').click(); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT + name + '-1.png')            # inside the house
        pg.keyboard.press('Escape')
        pg.locator('#demo').click(); pg.wait_for_timeout(4000)
        pg.screenshot(path=OUT + name + '-2.png')            # my moved-in house + farm card
        pg.locator('#card [data-a=grow]').click(); pg.wait_for_timeout(400)
        pg.screenshot(path=OUT + name + '-3.png')            # garden grown to 18
        print(name, 'errors', errs)
        pg.close()
    b.close()
