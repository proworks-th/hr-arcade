// Phone checks (PRD _test/prd-phone-first.md 7.1 / section 3), evaluated inside the page by verify/run.py on the
// phone viewports. Returns a list of short findings; run.py reports them as warnings until PHONE_STRICT is on.
// opt: { running: a game is being played, keys: look for keyboard hints, narrow: viewport is the 390 px case }
(opt) => {
  const out = [], W = innerWidth, H = innerHeight;
  const vis = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W; };
  const label = el => { const t = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${t}"`; };
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim();
  const texty = [...document.body.querySelectorAll('*')].filter(el => ownText(el) && vis(el));

  // (a) keyboard hints on a touch screen
  if (opt.keys) {
    const KEY = /\b(WASD|Shift|Esc|Space(bar)?)\b|ลูกศร|กด\s*\d+\s*[–-]\s*\d+/i, seen = new Set();
    for (const el of texty) { const t = ownText(el), m = t.match(KEY);
      if (m && !seen.has(t)) { seen.add(t); out.push(`key name "${m[0]}" on touch: ${label(el)}`); } }
  }

  // (b) in-game controls: >= 48 px and inside the thumb zone (bottom 40%); exit top-left 56x56, menu top-right
  if (opt.running) {
    const zone = H * 0.6, MIN = 48;
    let ctl = [...document.querySelectorAll('button, a[href], [role=button], input, select')].filter(el => vis(el) && !el.disabled)
      .map(el => ({ name: label(el), r: el.getBoundingClientRect() }));
    // canvas-drawn controls (dungeon): __dgn.controls() -> { stick, dodge, menu: { x, y, w, h } | null, ... } in viewport
    // CSS px (other keys such as view / safe / canvas / stick.zone are not controls); a DOM button reported there
    // (the menu) is counted once
    if (window.__dgn && typeof __dgn.controls === 'function') { try {
      const C = __dgn.controls() || {}, same = (a, b) => Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1;
      for (const k of ['stick', 'dodge', 'menu']) { const c = C[k]; if (!c) continue;
        const r = { left: c.x, top: c.y, right: c.x + c.w, bottom: c.y + c.h, width: c.w, height: c.h };
        ctl = ctl.filter(o => !same(o.r, r)); ctl.push({ name: `canvas "${k}"`, r }); }
    } catch (e) { out.push(`__dgn.controls() threw: ${e.message}`); } }
    let menu = 0;
    for (const { name, r } of ctl) {
      const sz = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (r.width < MIN || r.height < MIN) out.push(`in-game control ${sz} < 48: ${name}`);
      const exit = r.left >= 0 && r.top >= 0 && r.right <= 56 && r.bottom <= 56;
      const isMenu = !exit && r.left >= W - 56 && r.top >= 0 && r.bottom <= 56 && !menu++;
      if (!exit && !isMenu && r.top < zone) out.push(`in-game control outside the bottom 40% (top ${Math.round(r.top)} < ${Math.round(zone)}): ${name}`);
    }
  }

  // (c) zoom blocked on html or body
  const ta = [document.documentElement, document.body].map(el => getComputedStyle(el).touchAction);
  if (!ta.some(t => t === 'manipulation' || t === 'none')) out.push(`zoom not blocked: touch-action html "${ta[0]}", body "${ta[1]}" (want manipulation or none)`);

  // (d) text under 12 px
  const small = texty.filter(el => parseFloat(getComputedStyle(el).fontSize) < 12);
  for (const el of small.slice(0, 5)) out.push(`text ${getComputedStyle(el).fontSize} < 12px: ${label(el)}`);
  if (small.length > 5) out.push(`…and ${small.length - 5} more texts under 12px`);

  // (e) no sideways scroll at 390 px
  if (opt.narrow && document.documentElement.scrollWidth > W + 1) out.push(`sideways scroll at ${W}px: scrollWidth ${document.documentElement.scrollWidth}`);
  return out;
}
