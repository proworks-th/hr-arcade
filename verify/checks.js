// Objective layout checks, evaluated inside the page by verify/run.py.
// Returns {fail:[...], warn:[...]} with short human-readable findings.
(touch) => {
  const fail = [], warn = [], W = innerWidth, H = innerHeight;
  const vis = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const label = el => { const t = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${t}"`; };
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  const MODAL = '.overlay, [role=dialog], #boss, .pt-res, .res, .count';

  // 1. horizontal page overflow
  const sw = document.documentElement.scrollWidth;
  if (sw > W + 1) fail.push(`page scrolls sideways: scrollWidth ${sw} > viewport ${W}`);

  // 2. visible elements past the right edge
  const all = [...document.body.querySelectorAll('*')].filter(vis);
  let past = 0;
  for (const el of all) { const r = el.getBoundingClientRect(); if (r.right > W + 1 && !inScroller(el)) { if (past++ < 6) fail.push(`past right edge (${Math.round(r.right)}px > ${W}): ${label(el)}`); } }
  if (past > 6) fail.push(`…and ${past - 6} more elements past the right edge`);

  // 3. truncated text (only elements that hold text themselves)
  for (const el of all) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el);
    if (!['hidden', 'clip'].includes(s.overflowX) && !['hidden', 'clip'].includes(s.overflow)) continue;
    if (el.scrollWidth > el.clientWidth + 1) { const msg = `text cut off: ${label(el)} (full: "${el.textContent.trim().slice(0, 80)}")`; (s.textOverflow === 'ellipsis' ? warn : fail).push(msg); }
  }
  // 4. clipped input text
  for (const el of document.querySelectorAll('input')) if (vis(el) && el.scrollWidth > el.clientWidth + 1) warn.push(`input text/placeholder clipped: ${label(el)}`);

  // interactive elements inside the viewport
  const inter = [...document.querySelectorAll('button, a[href], [role=button], input, select')].filter(el => vis(el) && !el.disabled).filter(el => {
    const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < H && r.right > 0 && r.left < W; })
    .filter(el => { const open = [...document.querySelectorAll('.overlay, [role=dialog]')].filter(vis); return !open.length || open.some(m => m.contains(el)); });

  // 5. tap targets on touch screens
  if (touch) for (const el of inter) { const r = el.getBoundingClientRect(); if (r.width < 44 || r.height < 44) fail.push(`tap target ${Math.round(r.width)}x${Math.round(r.height)} < 44x44: ${label(el)}`); }

  // 6. overlapping / covered controls
  for (let i = 0; i < inter.length; i++) {
    const a = inter[i], ra = a.getBoundingClientRect();
    for (let j = i + 1; j < inter.length; j++) {
      const b = inter[j]; if (a.contains(b) || b.contains(a)) continue;
      const rb = b.getBoundingClientRect(), ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 4 && oy > 4) fail.push(`controls overlap: ${label(a)} × ${label(b)}`);
    }
    const cx = ra.left + ra.width / 2, cy = ra.top + ra.height / 2;
    if (cx >= 0 && cy >= 0 && cx < W && cy < H) { const top = document.elementFromPoint(cx, cy);
      // a modal (dialog/overlay) deliberately covers everything behind it; only controls outside the modal count
      const modal = top && top.closest(MODAL);
      if (top && top !== a && !a.contains(top) && !top.contains(a) && !(modal && !modal.contains(a))) fail.push(`control covered by ${label(top)}: ${label(a)}`); }
  }
  return { fail, warn, height: document.documentElement.scrollHeight };
}
