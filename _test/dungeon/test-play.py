import asyncio, json, random
from playwright.async_api import async_playwright
# Playwright smoke test for the dungeon (desktop + phone). Needs: pip install playwright; a Chrome/Chromium;
# a local server at the repo root (python -m http.server 8767). Usage: python _test/dungeon/test-play.py [chrome path]
import sys
CHROME = sys.argv[1] if len(sys.argv) > 1 else None
B='http://localhost:8767/_test/combat-proto.html?test=1&seed=demo'
async def pickloop(pg):
  for i in range(8):
    if (await pg.evaluate('__dgn.state()'))['mode']=='pick': await pg.evaluate('__dgn.pick(0)'); await pg.wait_for_timeout(250)
async def main():
  async with async_playwright() as p:
    br = await p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox']); out={}
    pg = await (await br.new_context(viewport={'width':1366,'height':768})).new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(B); await pg.wait_for_timeout(300); await pg.evaluate("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(1300)
    await pg.screenshot(path='shots-v-intro.png')
    await pg.click('#stage .overlay .btn.primary'); await pg.wait_for_timeout(800)
    await pg.evaluate('__dgn.god(true)')
    # walk toward monsters for 25 s (god mode: the bot doesn't dodge): auto weapons must kill, gems must level you up
    picked=0; shot=False
    for i in range(80):
      s = await pg.evaluate('__dgn.state()')
      if s['mode']=='pick':
        if not shot: await pg.screenshot(path='shots-v-levelup.png'); shot=True
        await pg.evaluate('__dgn.pick(0)'); picked+=1; await pg.wait_for_timeout(200); continue
      if s['mode']!='play': break
      n = await pg.evaluate('__dgn.nearest()')
      k = 'd'
      if n: k = ('d' if n['dx']>0 else 'a') if abs(n['dx'])>abs(n['dy']) else ('s' if n['dy']>0 else 'w')
      if n and n['d'] > 300: await pg.evaluate('__dgn.toMon()')
      await pg.keyboard.down(k); await pg.wait_for_timeout(300); await pg.keyboard.up(k)
    out['walk']=await pg.evaluate('__dgn.state()'); out['walk_picks']=picked
    await pg.screenshot(path='shots-v-play.png')
    # every weapon maxed + evolved, a swarm: visuals and performance
    await pg.evaluate('__dgn.god(true)')
    for wid in ['sword','axe','dagger','wand']: await pg.evaluate(f"__dgn.give('{wid}',5,true)")
    for pid in ['might','area','haste','crit']: await pg.evaluate(f"__dgn.give('{pid}',3)")
    for i in range(5): await pg.evaluate('__dgn.wave()')
    await pg.wait_for_timeout(1200); await pg.evaluate('__dgn.awakeAll()'); await pg.evaluate('__dgn.perfReset()')
    await pg.wait_for_timeout(1200); await pg.screenshot(path='shots-v-swarm.png'); await pg.wait_for_timeout(3000)
    out['perf_swarm_evolved']=await pg.evaluate('__dgn.perf()'); out['swarm_state']={k:v for k,v in (await pg.evaluate('__dgn.state()')).items() if k in ('mons','fk','target','swirls','lv')}
    await pickloop(pg)
    for wid in ['staff','spear','hammer']: pass
    # floors: door by target, relic (wand at B3), boss chest + evolution at B5, vault altar B6
    floors=[]
    for i in range(7):
      await pickloop(pg)
      s = await pg.evaluate('__dgn.state()'); floors.append({k:s[k] for k in ('depth','purpose','fk','target','relic','lv')})
      if s['relic']: await pg.evaluate('__dgn.toChest()'); await pg.wait_for_timeout(500); await pg.screenshot(path=f"shots-v-relic-b{s['depth']}.png"); floors[-1]['relic_taken']=not (await pg.evaluate('__dgn.state()'))['relic']
      if s['purpose']=='lair':
        await pg.evaluate("__dgn.give('staff',5)"); await pg.evaluate("__dgn.give('armor',1)")
        await pg.evaluate('__dgn.killAll()'); await pg.wait_for_timeout(800); await pg.evaluate('__dgn.toChest()'); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shots-v-evo.png'); floors[-1]['after_boss_mode']=(await pg.evaluate('__dgn.state()'))['mode']
        await pg.evaluate('__dgn.pick(0)'); await pg.wait_for_timeout(300); floors[-1]['staff']=(await pg.evaluate('__dgn.state()'))['arms'].get('staff')
      if s['purpose']=='vault':
        await pg.evaluate('__dgn.toAltar()'); await pg.wait_for_timeout(600); floors[-1]['altar_mode']=(await pg.evaluate('__dgn.state()'))['mode']; await pickloop(pg)
      await pg.evaluate('__dgn.openDoor()'); await pg.wait_for_timeout(300); await pg.evaluate('__dgn.toExit()'); await pg.wait_for_timeout(1300)
    out['floors']=floors
    # results card
    await pickloop(pg); out['before_quit']=await pg.evaluate('__dgn && __dgn.state()'); out['overlay']=await pg.evaluate("[...document.querySelectorAll('.overlay')].map(o=>o.className+': '+o.innerText.slice(0,120))")
    await pg.screenshot(path='shots-v-before-quit.png')
    if not await pg.is_visible('.res'): await pg.click('.dgn-hud .q', timeout=3000); await pg.wait_for_timeout(800)
    await pg.screenshot(path='shots-v-end.png'); out['end']=(await pg.inner_text('.res'))[:500] if await pg.is_visible('.res') else ''
    out['errs']=errs
    # phone
    pm = await (await br.new_context(viewport={'width':390,'height':844}, has_touch=True, is_mobile=True)).new_page(); e2=[]
    pm.on('pageerror', lambda e: e2.append(str(e)))
    await pm.goto(B); await pm.wait_for_timeout(1300); await pm.click('#stage .overlay .btn.primary'); await pm.wait_for_timeout(600)
    box = await pm.locator('#stage canvas').bounding_box(); cdp = await pm.context.new_cdp_session(pm)
    cx, cy = box['x']+box['width']*.4, box['y']+box['height']*.6
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':cx,'y':cy}]})
    for i in range(10): await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':cx+i*6,'y':cy-i*4}]}); await pm.wait_for_timeout(100)
    s0=await pm.evaluate('__dgn.state()'); await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    await pm.wait_for_timeout(600); await pm.screenshot(path='shots-v-mobile.png')
    out['mobile']={'moved':s0['x'], 'errs':e2, 'small': await pm.evaluate("""[...document.querySelectorAll('button,.btn')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect();return [e.textContent.trim().slice(0,12),Math.round(r.width),Math.round(r.height)]}).filter(x=>x[1]<44||x[2]<44)""")}
    print(json.dumps(out, ensure_ascii=False, indent=1)); await br.close()
asyncio.run(main())
