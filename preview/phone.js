// Phone layer (PRD _test/prd-phone-first.md): player settings for touch controls, touch detection, site-wide zoom block
// and the ?fps=1 counter. Classic script loaded first, before every game, so games can read Phone at mount time.
//
// Contract for games (keep it this small):
//   Phone.touch          true on phones/tablets (coarse pointer or no hover)
//   Phone.left()         true when the player chose left-hand: mirror the layout (stick right, action buttons left)
//   Phone.scale()        1 (normal) or 1.25 (large): multiply every in-game control size by it, keep the gaps
//   Phone.btn()          minimum control size in CSS px = 48 * scale()
//   Phone.on(fn)         fn() runs after a setting changes; the returned function unsubscribes
//   <html> classes:      .touch, .hand-l, .btn-l   (for CSS-only layouts)
// Settings live in localStorage 'hra_set' (same format as store()), so the cloud save carries them to a new phone.
'use strict';
const Phone = (() => {
  const KEY = 'hra_set', subs = new Set();
  const touch = matchMedia('(pointer:coarse)').matches || matchMedia('(hover:none)').matches;
  const read = () => { try { return Object.assign({ hand: 'r', size: 'n' }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { hand: 'r', size: 'n' }; } };
  const cls = () => { const s = read(), h = document.documentElement.classList;
    h.toggle('touch', touch); h.toggle('hand-l', s.hand === 'l'); h.toggle('btn-l', s.size === 'l'); };
  const P = {
    touch,
    get: read,
    left: () => read().hand === 'l',
    scale: () => read().size === 'l' ? 1.25 : 1,
    btn: () => Math.round(48 * P.scale()),
    set(k, v) { const s = read(); s[k] = v; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} cls(); subs.forEach(f => { try { f(); } catch (e) {} }); },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
  cls();
  addEventListener('storage', e => { if (e.key === KEY) { cls(); subs.forEach(f => f()); } });   // cloud load / another tab

  // ---- no zoom anywhere (owner, 15 Nov 2026). Safari ignores the viewport lock, so cancel its gesture events;
  // double-tap zoom is stopped by touch-action: manipulation in the page CSS.
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // ---- ?fps=1: a corner counter for measuring on the real iPhone (average and worst frame over the last 5 s)
  if (/[?&]fps=1\b/.test(location.search)) addEventListener('DOMContentLoaded', () => {
    const el = document.createElement('div'); el.id = 'fpsMeter';
    el.style.cssText = 'position:fixed;left:calc(4px + env(safe-area-inset-left));top:calc(4px + env(safe-area-inset-top));z-index:99999;font:12px/1.3 monospace;background:#000c;color:#fff;padding:3px 6px;border-radius:6px;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
    const ts = []; let last = performance.now(), shown = 0;
    const tick = now => { ts.push([now, now - last]); last = now; while (ts.length && now - ts[0][0] > 5000) ts.shift();
      if (now - shown > 500 && ts.length > 1) { shown = now; const dts = ts.map(t => t[1]), avg = dts.reduce((a, b) => a + b, 0) / dts.length, worst = Math.max(...dts);
        el.textContent = `${Math.round(1000 / avg)} fps\nworst ${worst.toFixed(1)} ms`; }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  return P;
})();
