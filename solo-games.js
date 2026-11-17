// Extra solo games for the hub (general office theme). Classic script loaded before the hub script;
// at run time it uses the hub's globals: fmt, rnd, pick, toast. Each game is mount(root, api) like the others.
'use strict';
const PIX = {};
function pix(n) { if (!PIX[n]) { const i = new Image(); i.src = 'assets/mi/' + n + '.png'; PIX[n] = i; } return PIX[n]; }
function drawPix(ctx, n, x, y, w, h, flip) {
  const im = pix(n); if (!im.complete || !im.naturalWidth) return;
  ctx.imageSmoothingEnabled = false;
  if (flip) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); ctx.restore(); } else ctx.drawImage(im, x, y, w, h);
}
// canvas with a fixed logical size, scaled to the screen by CSS (.g2box)
function g2canvas(root, W, H) {
  const box = document.createElement('div'); box.className = 'g2box'; root.appendChild(box);
  const cv = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.setProperty('--ar', W / H); box.appendChild(cv);
  // a long press must never open the phone's copy / save-image menu or the text magnifier
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // pointer position in logical canvas units (a resized canvas maps inside its border)
  let LW = W, LH = H, fitted = false;
  const at = e => { const r = cv.getBoundingClientRect();
    if (fitted) return { x: (e.clientX - r.left - cv.clientLeft) * LW / cv.clientWidth, y: (e.clientY - r.top - cv.clientTop) * LH / cv.clientHeight };
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  // portrait phones: logical size = the CSS size of the play area (w x h px), placed at (x, y) in the box;
  // size() with no arguments goes back to the fixed W x H scene
  function size(w, h, x, y) {
    fitted = w != null; LW = fitted ? w : W; LH = fitted ? h : H;
    cv.style.cssText = fitted ? `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:content-box;max-height:none;aspect-ratio:auto` : '';
    cv.style.setProperty('--ar', LW / LH);
    if (cv.width !== Math.round(LW * dpr) || cv.height !== Math.round(LH * dpr)) { cv.width = Math.round(LW * dpr); cv.height = Math.round(LH * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  return { cv, ctx, at, size, dpr, box };
}
// One game frame on every window (PRD _test/prd-phone-game-scale.md, owner 17 Nov 2026): top bar, info card, stage
// and deck, the same on a phone and a PC. The window decides two things only:
//   the art scale s  CSS px per art pixel, a whole number of device pixels, the same in every game on that window:
//                    the largest that fits a 187 x 180 art world, at most 3 (phone 2, 1366 laptop 2, 1080p monitor 3)
//   the stage width  the game's world grows from world.min to world.max art px wide; more scenery, never bigger art
// Stage height = world.h x s. What is left of the height goes to the info card (best score, the rule in one line).
const FRAME_REF = { w: 187, h: 180, max: 3 };
const frameDpr = () => Math.min(2, devicePixelRatio || 1);
function frameScale(aw, ah) {
  const dpr = frameDpr();
  for (let n = Math.floor(FRAME_REF.max * dpr + 1e-6); n > 1; n--) { const s = n / dpr; if (FRAME_REF.w * s <= aw && FRAME_REF.h * s <= ah) return s; }
  return 1 / dpr;
}
// the info card under the top bar: the best score and one line on how to win; the game may add a line with set()
function g2info(root, rule) {
  const el = document.createElement('div'); el.className = 'g2info';
  const id = (root.className.match(/\bgame-(\w+)/) || [])[1], best = id && typeof store !== 'undefined' ? store.get('best_' + id, 0) : 0;
  el.innerHTML = `<b>${best > 0 ? 'สถิติดีสุด ' + fmt(best) : 'รอบแรก ลองดูเลย'}</b><span>${rule || ''}</span><span data-k="info"></span>`;
  const hud = root.querySelector('.hud'); hud ? hud.after(el) : root.prepend(el);
  return el;
}
// g2canvas, plus two other layouts:
//   world given ({ min, max, h } in art px, rule = the info card's line): the frame above, on every window and device
//   no world: a portrait layout on phones held upright (PRD 7.3) that fills the play area; elsewhere the fixed W x H scene
// Both new layouts set L.portrait, draw at 1 unit = 1 CSS px (backing store at devicePixelRatio) and use L.k as the
// pixel-art scale. L.fn() runs after every change (rotation, resize, the hand setting).
function g2view(root, W, H, world, rule) {
  const g = g2canvas(root, W, H), { cv, ctx, box } = g, dpr = frameDpr();
  const L = { portrait: false, frame: !!world, W, H, k: 3, left: false, fn: null };
  const tall = () => phoneOn() && innerHeight > innerWidth;
  let info = null;
  if (world) { root.classList.add('g2f'); info = g2info(root, rule); }
  const px = (el, side) => parseFloat(getComputedStyle(el)[side]) || 0;
  // frame: measure what the top bar and the deck leave, pick the scale, size the canvas in CSS px
  function fit() {
    if (!phoneOn() || !document.body.classList.contains('playing')) {   // PC: the frame fills the window under the page header
      const top = root.getBoundingClientRect().top + scrollY, pb = root.parentElement ? px(root.parentElement, 'paddingBottom') : 16;
      root.style.height = Math.max(420, Math.floor(innerHeight - top - pb - 4)) + 'px';
    }
    const par = root.parentElement, aw = Math.max(200, (par ? par.clientWidth - px(par, 'paddingLeft') - px(par, 'paddingRight') : innerWidth) - px(root, 'paddingLeft') - px(root, 'paddingRight'));
    let used = px(root, 'paddingTop') + px(root, 'paddingBottom');
    for (const c of root.children) {
      if (c === box || c === info || c.classList.contains('overlay') || getComputedStyle(c).position === 'absolute') continue;
      used += c.offsetHeight + px(c, 'marginTop') + px(c, 'marginBottom');
    }
    if (info) used += px(info, 'marginTop') + px(info, 'marginBottom');
    const ah = root.clientHeight - used - 6, s = frameScale(aw - 6, ah);
    const w = Math.round(Math.max(Math.min(aw - 6, world.max * s), Math.min(aw - 6, world.min * s))), h = Math.round(world.h * s);
    root.style.setProperty('--fw', (w + 6 + px(root, 'paddingLeft') + px(root, 'paddingRight')) + 'px');
    box.style.cssText = 'flex:none;height:auto;container-type:normal;display:flex;justify-content:center';
    cv.style.cssText = `width:${w}px;height:${h}px;max-height:none;aspect-ratio:auto;box-sizing:content-box`;
    // short on height (a laptop): one line, best score and rule side by side; no room at all: an empty gap
    if (info) { const ih = info.offsetHeight; info.classList.toggle('one', ih >= 34 && ih < 64); info.classList.toggle('tiny', ih < 34); }
    return { w, h, s };
  }
  function apply(fromObserver) {
    if (!root.isConnected && L.fn) return stop();
    const left = phoneOn() && Phone.left();
    let p, w, h, k;
    if (world) { ({ w, h, s: k } = fit()); p = true; }
    else {
      p = tall();
      if (!fromObserver) root.classList.toggle('g2p', p);   // the class only from window events: no ResizeObserver loop
      else if (p !== root.classList.contains('g2p')) return;
      w = p ? cv.clientWidth : W; h = p ? cv.clientHeight : H; k = Math.max(2, Math.min(4, Math.round(w / 135)));
    }
    if (!w || !h || (p === L.portrait && w === L.W && h === L.H && k === L.k && left === L.left)) return;
    Object.assign(L, { portrait: p, W: w, H: h, left, k });
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    L.fn && L.fn();
  }
  let raf = 0;
  const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; apply(true); }); };
  const onWin = () => apply(false), ro = typeof ResizeObserver === 'function' ? new ResizeObserver(world ? later : () => apply(true)) : null;
  // frame: the deck and hint are added after g2view returns, so watch the game's children too
  const mo = world && typeof MutationObserver === 'function' ? new MutationObserver(later) : null;
  addEventListener('resize', onWin); addEventListener('orientationchange', onWin); ro && ro.observe(world ? root : cv); mo && mo.observe(root, { childList: true });
  const offPhone = phoneOn() ? Phone.on(onWin) : null;
  function stop() { removeEventListener('resize', onWin); removeEventListener('orientationchange', onWin); ro && ro.disconnect(); mo && mo.disconnect(); offPhone && offPhone(); cancelAnimationFrame(raf); }
  apply(false); if (world) later();
  if (world && window.__TEST__) window.__frame = { L, world };
  // pointer position in canvas units for either layout
  const at = e => { const r = cv.getBoundingClientRect();
    return L.portrait ? { x: e.clientX - r.left - cv.clientLeft, y: e.clientY - r.top - cv.clientTop } : { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  return { cv, ctx, at, L, stop, info };
}
// a cached static layer (portrait scenes): paint(g) draws the room once into an offscreen canvas at device resolution;
// it is repainted after reset() (new layout) and until the named sprites have loaded
function g2layer(L, names, paint) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); let ok = false;
  const ready = () => { for (const n of names) { const im = pix(n); if (!im.complete || !im.naturalWidth) return false; } return true; };
  return {
    reset() { ok = false; },
    draw(ctx) {
      if (!ok) { const dpr = Math.min(2, devicePixelRatio || 1); c.width = Math.round(L.W * dpr); c.height = Math.round(L.H * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false; ok = ready(); paint(g); }
      ctx.drawImage(c, 0, 0, L.W, L.H);
    },
  };
}
function g2pad(root, buttons) {
  const bar = document.createElement('div'); bar.className = 'g2pad';
  for (const [label, fn] of buttons) { const b = document.createElement('button'); b.className = 'btn'; b.innerHTML = label;
    b.addEventListener('pointerdown', e => { e.preventDefault(); fn(); }); bar.appendChild(b); }
  root.appendChild(bar); return bar;
}
function txt(ctx, s, x, y, size = 16, col = '#2b2140', align = 'center', weight = 600) {
  ctx.font = `${weight} ${size}px Kanit, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function rrect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/* =================================================================
   Shared look + juice (used by every solo game, incl. the older ones in index.html)
   One art style: LimeZu "Modern Interiors" (free, non-commercial) — characters with real animations,
   wall/floor tiles and furniture drawn at whole-number scale — plus small pixel icons drawn from strings (PXA).
================================================================= */
const PAL = { ink: '#2b2140', wall: '#fdf3e6', wall2: '#f6e2cb', paper: '#fffdf6', floor: '#c98b5e', floor2: '#b77a50', floorLine: '#8f5f3e',
  pink: '#ff5c8a', yel: '#ffd23f', blue: '#3a86ff', green: '#21c07a', red: '#e23030', orange: '#ff9f1c', muted: '#7a6f8c' };
const MI_PEOPLE = ['adam', 'alex', 'amelia', 'bob'], MI_DIR = { right: 0, up: 1, left: 2, down: 3 };
// sprite sizes in pixels (DOM scenes need them before the images load)
const MI_SZ = {adam_down:[16,23],adam_left:[16,23],adam_phone:[16,23],adam_right:[16,23],adam_up:[16,23],alex_down:[16,22],alex_left:[14,22],alex_phone:[15,22],alex_right:[14,22],alex_up:[16,22],amelia_down:[16,22],amelia_left:[14,22],amelia_phone:[16,22],amelia_right:[14,22],amelia_up:[16,22],armchair_dark:[14,14],armchair_dark2:[14,21],armchair_wood:[14,15],armchair_wood2:[14,21],armchair_wood3:[14,14],armchair_wood4:[14,22],armchair_wood5:[14,21],bench_cream:[30,18],bench_pink:[30,18],bin:[9,13],blackboard:[28,23],board_calendar:[31,21],bob_down:[16,22],bob_left:[13,22],bob_phone:[15,22],bob_right:[13,22],bob_up:[16,22],books_desk:[16,22],books_desk2:[16,22],bookshelf:[32,64],box_wood:[15,13],broom:[16,26],cabinet_glass:[27,32],cabinet_plates:[23,31],cabinet_wood:[27,32],cake:[9,8],cake_cream:[9,8],cake_slice:[9,10],cake_straw:[9,9],cans:[28,23],cans_orange:[25,16],chair_back:[12,22],chair_back2:[12,22],chair_beige:[13,21],chair_beige2:[13,21],chair_dark:[13,21],chair_dark2:[13,21],chair_green:[14,23],chair_grey:[10,21],chair_light:[10,21],chair_red:[13,21],chair_red2:[10,21],chair_red3:[13,21],chair_red_side:[10,21],chair_school:[14,16],chair_side_l:[13,25],chair_side_r:[13,25],chair_white:[13,21],chair_white2:[13,21],chair_white3:[10,21],chair_wood_side:[10,21],crate:[15,13],cushion_blue:[13,13],cushion_yellow:[13,13],desk_book:[28,25],desk_book2:[28,22],desk_drawer:[16,21],desk_pair:[25,23],desk_small:[48,20],door:[14,21],door_double:[32,28],dresser:[25,21],filing:[63,28],floorlamp_beige:[13,33],floorlamp_blue:[15,33],floorlamp_blue2:[15,33],floorlamp_red:[15,24],floorlamp_red2:[15,33],floorlamp_white:[15,25],fridge:[16,31],fridge2:[16,31],fridge_wide:[32,32],fruit_basket:[14,18],fruit_bowl:[14,19],fruit_grape:[14,18],fruit_veg:[15,17],globe:[13,21],globe_blue:[13,21],globe_gold:[13,21],jar:[15,16],jar_gold:[15,16],jar_pot:[15,16],jar_white:[15,16],lamp_beige:[12,16],lamp_beige2:[12,18],lamp_blue:[12,17],lamp_blue2:[12,19],lamp_mini:[9,16],lamp_red:[12,17],lamp_red2:[12,19],lamp_white:[12,18],lamp_white2:[12,20],locker:[15,31],mirror_gold:[12,16],mirror_gold2:[12,16],noticeboard:[26,13],palm:[23,31],papers:[14,32],papers2:[15,32],pc_desk:[32,25],pen:[8,13],pencil_cup:[8,13],pic_aqua:[21,14],pic_bird:[13,15],pic_cat:[21,14],pic_fire:[13,15],pic_fish:[21,14],pic_fishblue:[21,14],pic_flower:[13,15],pic_forest:[21,13],pic_hill:[13,15],pic_land:[28,13],pic_long:[22,7],pic_monster:[13,15],pic_robot:[13,15],pic_sunset:[28,13],pizza:[11,11],plant_pot:[14,23],plant_small:[12,14],rug_blue:[24,18],rug_green:[24,18],rug_lblue:[24,18],shelf_plant:[32,20],shelf_white:[21,31],shop_shelf:[32,34],shop_shelf2:[32,34],sofa_blue_s:[22,58],sofa_brown:[48,26],sofa_brown_s:[22,58],sofa_grey:[48,28],sofa_grey_s:[22,58],sofa_lilac_s:[22,58],sofa_red:[32,26],sofa_white:[48,28],table_light:[38,37],table_wood:[38,37],tree:[18,31],tv:[26,18],vanity:[28,30],vanity2:[28,30],wardrobe:[27,39],wardrobe2:[27,39],wardrobe_glass:[27,27],window_big:[28,21],window_frost:[25,15],window_grey:[25,20],window_red:[25,20],window_slide:[38,25],window_small:[12,16],world_map:[32,19]};
const WALL_COL = {'wall_beige': '#bcb9a9', 'wall_dwood': '#7e6052', 'wall_grey': '#a9acbc', 'wall_mint': '#d3f6ee', 'wall_pink': '#d18c6b', 'wall_red': '#8f5641', 'wall_wood': '#a2784b', 'wall_yellow': '#f0e8a0'};
// sprite at its own pixel size x k, anchored bottom-centre at (cx, by); sx/sy squash, rot in radians
function drawPixAt(ctx, n, cx, by, k, o = {}) {
  const im = typeof n === 'string' ? pix(n) : n;
  const w = (im.naturalWidth || im.width) * k, h = (im.naturalHeight || im.height) * k; if (!w || (im.complete === false)) return;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(cx, by); if (o.rot) ctx.rotate(o.rot);
  ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
}
// animated character: anim = idle_anim | run | sit (6 frames per direction) | phone (9 frames, facing the camera)
function drawChar(ctx, who, anim, dir, t, cx, by, k, o = {}) {
  const im = pix('chars/' + who + '_' + anim); if (!im.complete || !im.naturalWidth) return;
  const per = anim === 'phone' ? 9 : 6, f = o.frame ?? Math.floor(t * (anim === 'run' ? 12 : 8)) % per, idx = anim === 'phone' ? f : MI_DIR[dir] * per + f;
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(cx, by); if (o.rot) ctx.rotate(o.rot);
  ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(im, idx * 16, 0, 16, 32, -8 * k, -32 * k, 16 * k, 32 * k); ctx.restore();
}
// tiny pixel icons from string art: each char is a palette key, '.' = transparent
const PXA_PAL = { k: '#2b2140', w: '#ffffff', y: '#ffd23f', o: '#c77d0a', r: '#ff4d6d', R: '#b3203a', b: '#4cc3ff', B: '#2266cc', l: '#bfe9ff',
  g: '#21c07a', G: '#14804f', c: '#6b3e26', C: '#a5683f', m: '#fffdf6', t: '#e0913b', p: '#ff5c8a', s: '#d9dde3', S: '#8a93a3', v: '#8338ec' };
const PXA_ART = {
  coin: ['..kkkk..', '.koooook', 'koyyyyok', 'koywyyok', 'koywyyok', 'koyyyyok', '.koooook', '..kkkk..'],
  heart: ['.kk.kk.', 'krrkrrk', 'krwrrRk', 'krrrrRk', '.krrRk.', '..kRk..', '...k...'],
  gem: ['.kkkkk.', 'kblwbBk', 'kbbbbBk', '.kbbBk.', '..kBk..', '...k...'],
  plane: ['kk...........', 'kwkk.........', '.kwwwkk......', '..kwwwwwkkk..', '..kwwwwwwwwkk', '.kssSkkkkkkk.', 'kSk.k........'],
  spark: ['..w..', '..y..', 'wyyyw', '..y..', '..w..'],
  ball: ['..kkk..', '.kmmsk.', 'kmsmmsk', 'kmmmsmk', 'ksmmmmk', '.kmsmk.', '..kkk..'],
  shot: ['...k....', '..kck...', '..kck...', '.kccck..', 'kcccCck.', 'kccccck.', '.kccck..', '..kkk...'],
  milk: ['..kkk...', '..kwk...', '.kwwwk..', 'kwwwwwk.', 'kwbbbwk.', 'kwbwbwk.', 'kwwwwwk.', 'kkkkkkk.'],
  ice: ['.kkkkkk.', 'kwwwwwlk', 'kwllllbk', 'kwllllbk', 'kwllllbk', 'klbbbbbk', '.kkkkkk.'],
  choco: ['kkkkkkk', 'kCckCck', 'kcckcck', 'kkkkkkk', 'kCckCck', 'kcckcck', 'kkkkkkk'],
  water: ['...k....', '..kbk...', '..kbk...', '.kbbbk..', 'kbbwbbk.', 'kbbbbbk.', '.kbbbk..', '..kkk...'],
  tea: ['...k....', '..ktk...', '..ktk...', '.ktttk..', 'kttytkk.', 'ktttttk.', '.ktttk..', '..kkk...'],
  moon: ['..kkk..', '.kyyk..', 'kyyk...', 'kyyk...', 'kyyyk..', '.kyyyk.', '..kkk..'],
  rocket: ['...k...', '..kwk..', '..kwk..', '.kwbwk.', '.kwwwk.', '.kwwwk.', 'kpkwkpk', 'kp.k.pk', '...y...', '..yry..'],
  ufo: ['...kkk...', '..klllk..', '.kkkkkkk.', 'kssSsSssk', '.kkkkkkk.', '..y.y.y..'],
  cloud: ['....kkkk.......', '...kwwwwk.kkk..', '.kkwwwwwwkwwwk.', 'kwwwwwwwwwwwwwk', 'kwwwwwwwwwwwlwk', '.kkkkkkkkkkkkk.'],
  hey: ['.kkkkk.', 'kwwrwwk', 'kwwrwwk', 'kwwrwwk', 'kwwwwwk', 'kwwrwwk', '.kkkkk.', '..kk...', '..k....'],
  mad: ['.R...R.', 'Rr...rR', '.rR.Rr.', '.......', '.rR.Rr.', 'Rr...rR', '.R...R.'],
  fan: ['.kkkkk.', 'klbklbk', 'kbkskbk', 'klkskbk', '.kkkkk.', '...k...', '...k...', '.kkkkk.'],
};
const PXA = {};
function pxa(key) {
  if (PXA[key]) return PXA[key];
  const rows = PXA_ART[key], c = document.createElement('canvas'); c.width = Math.max(...rows.map(r => r.length)); c.height = rows.length;
  const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PXA_PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  return (PXA[key] = c);
}
// the same icons as <img> for the DOM (buttons, legends)
const PXA_URL = {};
function pxaURL(key, k = 4) {
  if (PXA_URL[key + k]) return PXA_URL[key + k];
  const s = pxa(key), c = document.createElement('canvas'); c.width = s.width * k; c.height = s.height * k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, c.width, c.height);
  return (PXA_URL[key + k] = c.toDataURL());
}
const pxImg = (key, size = 22) => `<img class="pxi" alt="" src="${pxaURL(key)}" height="${size}">`;
const pixImg = (n, size = 26) => `<img class="pxi" alt="" src="assets/mi/${n}.png" height="${size}">`;
// office backdrop: plain wall in the wallpaper's colour with the wallpaper tile as a band along the bottom,
// windows/pictures hung on it, and a plank/tile floor (scroll/wallScroll move them for runners)
const WALL_BASE = {};
function wallBase(n) {
  if (WALL_BASE[n]) return WALL_BASE[n]; const im = pix(n); if (!im.complete || !im.naturalWidth) return '#f3efe6';
  const c = document.createElement('canvas'); c.width = 16; c.height = 32; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(8, 14, 1, 1).data; return (WALL_BASE[n] = `rgb(${d[0]},${d[1]},${d[2]})`);
}
// background + floor; everything drawn after it stays at full contrast
function officeBG(ctx, W, H, floorY, { wall = 'wall_mint', floor = 'floor_wood', k = 3, scroll = 0, wallScroll = 0, windows = [], calm = .42 } = {}) {
  ctx.fillStyle = wallBase(wall); ctx.fillRect(0, 0, W, floorY);
  ctx.imageSmoothingEnabled = false;
  const wt = pix(wall), tw = 16 * k, th = 32 * k;
  if (wt.complete && wt.naturalWidth) for (let x = -(((wallScroll % tw) + tw) % tw); x < W; x += tw) ctx.drawImage(wt, x, floorY - th, tw, th);
  const span = W + 200;
  for (const [n, x, y, kk] of windows) { const im = pix(n), wx = (((x - wallScroll) % span) + span) % span - 100; drawPixAt(ctx, n, wx, y + (im.naturalHeight || 0) * kk, kk); }
  const ft = pix(floor);
  if (ft.complete && ft.naturalWidth) {
    const fw = ft.naturalWidth * k, fh = ft.naturalHeight * k;
    for (let y = floorY, row = 0; y < H; y += fh, row++) { const off = -(((scroll + row * fw / 3) % fw + fw) % fw); for (let x = off; x < W; x += fw) ctx.drawImage(ft, x, y, fw, fh); }
  } else { ctx.fillStyle = PAL.floor; ctx.fillRect(0, floorY, W, H - floorY); }
  // calm wash: the room fades back so the things you play with stand out (owner: the scenes were too busy to read)
  ctx.fillStyle = `rgba(255,249,238,${calm})`; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.fillRect(0, floorY, W, 3);
}
// particles, pop-up text, screen shake, hit-stop and flashes for canvas games.
// loop: const d = fx.step(dt) (0 while hit-stopped) · draw: fx.pre(ctx) ... fx.post(ctx, W, H)
function makeFX() {
  const P = [], T = []; let shT = 0, shA = 0, stop = 0, flT = 0, flMax = 1, flC = '#fff';
  return {
    burst(x, y, o = {}) {
      const n = o.n || 12;
      for (let i = 0; i < n; i++) {
        const a = (o.dir ?? -Math.PI / 2) + (rnd() - .5) * (o.spread ?? Math.PI * 2), sp = (o.speed || 220) * (.35 + rnd() * .8);
        P.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.grav ?? 500, t: 0, life: (o.life || .7) * (.6 + rnd() * .7),
          s: (o.size || 5) * (.6 + rnd() * .8), c: pick(rnd, o.colors || ['#fff']), shape: o.shape || 'sq', rot: rnd() * 6, vr: (rnd() - .5) * 14, drag: o.drag ?? 1.2 });
      }
    },
    text(x, y, s, o = {}) { T.push({ x, y, s, c: o.color || PAL.pink, size: o.size || 26, t: 0, life: o.life || .9, rise: o.rise ?? 44 }); },
    shake(a = 6, t = .25) { shA = Math.max(shT > 0 ? shA : 0, a); shT = Math.max(shT, t); },
    hitstop(t = .06) { stop = Math.max(stop, t); },
    busy: () => P.length > 0 || T.length > 0 || shT > 0 || flT > 0 || stop > 0,   // anything still on screen (games that skip still frames)
    flash(c = '#fff', t = .18) { flC = c; flT = flMax = t; },
    step(dt) {
      shT = Math.max(0, shT - dt); flT = Math.max(0, flT - dt);
      for (const p of P) { p.t += dt; p.vy += p.g * dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      for (let i = P.length - 1; i >= 0; i--) if (P[i].t >= P[i].life) P.splice(i, 1);
      for (const t of T) t.t += dt; for (let i = T.length - 1; i >= 0; i--) if (T[i].t >= T[i].life) T.splice(i, 1);
      if (stop > 0) { stop -= dt; return 0; } return dt;
    },
    pre(ctx) { ctx.save(); if (shT > 0) { const a = shA * Math.min(1, shT * 5); ctx.translate((rnd() - .5) * 2 * a, (rnd() - .5) * 2 * a); } },
    post(ctx, W, H) {
      for (const p of P) {
        const a = 1 - p.t / p.life; ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.c;
        if (p.shape === 'paper') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s, -p.s * .7, p.s * 2, p.s * 1.4); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1; ctx.strokeRect(-p.s, -p.s * .7, p.s * 2, p.s * 1.4); ctx.restore(); }
        else if (p.shape === 'star') { const s = p.s * a; ctx.fillRect(p.x - s, p.y - s / 3, s * 2, s * 2 / 3); ctx.fillRect(p.x - s / 3, p.y - s, s * 2 / 3, s * 2); }
        else if (p.shape === 'puff') { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 + p.t / p.life), 0, 7); ctx.fill(); }
        else { const s = Math.ceil(p.s); ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); }
      }
      ctx.globalAlpha = 1;
      for (const t of T) {
        const k = t.t / t.life, sc = k < .12 ? .4 + k / .12 * .9 : k < .25 ? 1.3 - (k - .12) / .13 * .3 : 1;
        ctx.save(); ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1; ctx.translate(t.x, t.y - t.rise * Math.min(1, k * 1.6)); ctx.scale(sc, sc);
        ctx.font = `800 ${t.size}px Kanit, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, t.size / 5); ctx.strokeStyle = PAL.ink; ctx.strokeText(t.s, 0, 0); ctx.fillStyle = t.c; ctx.fillText(t.s, 0, 0); ctx.restore();
      }
      if (flT > 0) { ctx.globalAlpha = flT / flMax * .55; ctx.fillStyle = flC; ctx.fillRect(-20 - W, -20 - H, 3 * W + 40, 3 * H + 40); ctx.globalAlpha = 1; }
      ctx.restore();
    },
  };
}
const CONFETTI = [PAL.pink, PAL.yel, PAL.blue, PAL.green, PAL.orange, '#fff'];
// DOM juice for the non-canvas games: particles, shake and flash on any positioned element
function domBurst(host, x, y, o = {}) {
  const n = o.n || 10;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), a = rnd() * Math.PI * 2, d = (o.dist || 60) * (.4 + rnd() * .8), sz = (o.size || 8) * (.6 + rnd() * .8);
    s.className = 'jp'; s.style.cssText = `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${pick(rnd, o.colors || CONFETTI)}`;
    host.appendChild(s);
    s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px)) rotate(${rnd() * 360}deg) scale(.4)`, opacity: 0 }],
      { duration: 500 + rnd() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => s.remove();
  }
}
function domShake(el, a = 8) {
  el.animate([{ transform: 'none' }, { transform: `translate(${-a}px,${a / 3}px)` }, { transform: `translate(${a}px,${-a / 3}px)` }, { transform: `translate(${-a / 2}px,0)` }, { transform: 'none' }], { duration: 280 });
}
function domFlash(el, color = 'rgba(255,77,77,.35)') {
  const f = document.createElement('i'); f.className = 'jflash'; f.style.background = color; el.appendChild(f);
  f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => f.remove();
}

/* =================================================================
   Phone controls (PRD 7.4), only when Phone.touch — desktop keeps the old pad under the canvas.
   g2phone(root, kind)  full-screen portrait layout: HUD on top (clear of the exit button), playfield in the middle,
                        controls in a deck at the bottom (CSS .g2t in index.html)
   g2deck(root, g)      the deck: g = { l: [...], r: [...] } for the two lower corners (html.hand-l swaps them),
                        or { rows: [[...], [...]] }. Item: [html, aria-label, onDown, { repeat: ms, up: fn, cls }]
   Every button shows its press state on pointerdown; its size follows Phone.btn(), re-read live through Phone.on.
================================================================= */
const phoneOn = () => typeof Phone !== 'undefined' && Phone.touch;
// deck and hint text: the touch wording, or the PC one (mouse + keys)
const onTouch = (touch, pc) => phoneOn() ? touch : pc;
// all: the game uses the frame (g2view with a world) and shows its deck on PC too, mouse and keys both work
function g2phone(root, kind, all) { if (!phoneOn() && !all) return false; root.classList.add('g2t'); if (kind) root.classList.add('g2t-' + kind); return true; }
function phoneSize(el) {
  const set = () => el.style.setProperty('--b', Phone.btn() + 'px'); set();
  const off = Phone.on(() => { if (!el.isConnected) return off(); set(); });
}
function phoneBtn([html, aria, down, o = {}]) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn g2k' + (o.cls ? ' ' + o.cls : ''); b.innerHTML = html;
  if (aria) b.setAttribute('aria-label', aria);
  let held = false, t1 = 0, t2 = 0;
  const stop = () => { if (!held) return; held = false; b.classList.remove('on'); clearTimeout(t1); clearInterval(t2); o.up && o.up(); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (held) return; held = true; b.classList.add('on');
    try { b.setPointerCapture(e.pointerId); } catch (er) {}
    down();
    if (o.repeat) t1 = setTimeout(() => { t2 = setInterval(() => b.isConnected ? down() : stop(), o.repeat); }, o.delay || 170); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, stop);
  b.addEventListener('contextmenu', e => e.preventDefault());
  return b;
}
function g2deck(root, g, cls = '') {
  const deck = document.createElement('div'); deck.className = 'g2deck' + (g.rows ? ' rows' : '') + (cls ? ' ' + cls : '');
  const add = (items, c) => { const el = document.createElement('div'); el.className = c; for (const it of items) el.appendChild(it instanceof Element ? it : phoneBtn(it)); deck.appendChild(el); return el; };
  if (g.rows) g.rows.forEach(r => add(r, 'g2row')); else { add(g.l || [], 'g2c g2c-l'); add(g.r || [], 'g2c g2c-r'); }
  root.appendChild(deck); phoneSize(deck); return deck;
}
// Portrait phone layouts (PRD 7.3): only on touch with the stage taller than wide; desktop and landscape keep the
// old scene. Three bands: a thin top bar, the play area (.g2p fills it), the thumb deck at the bottom.
function phonePortrait() {
  if (!phoneOn()) return false;
  const s = document.getElementById('stage'), w = s && s.clientWidth || innerWidth, h = s && s.clientHeight || innerHeight;
  return h > w;
}
// fn() now and again (once per frame at most) when the screen turns or resizes or a phone setting changes, until root leaves
function phoneRelayout(root, fn) {
  let raf = 0;
  const ro = new ResizeObserver(() => ask()), st = document.getElementById('stage');
  const stop = () => { ro.disconnect(); off(); removeEventListener('orientationchange', ask); cancelAnimationFrame(raf); };
  const ask = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (!root.isConnected) return stop(); fn(); }); };
  const off = Phone.on(ask);
  ro.observe(root); if (st) ro.observe(st); addEventListener('orientationchange', ask);
  fn(); return stop;
}
// the largest canvas (content px, a 3 px border around it, 6 px shadow below) that fits the play box
function fitBox(box) { const w = Math.max(60, box.clientWidth - 6), h = Math.max(60, box.clientHeight - 12); return { w, h, x: Math.floor((box.clientWidth - w - 6) / 2), y: 0 }; }
// pixel art drawn from a cached layer once its images have loaded (portrait scenes: wall, floor, counters)
function artReady(names) { for (const n of names) { const im = pix(n); if (!im.complete || !im.naturalWidth) return false; } return true; }
function layerCanvas(w, h, dpr) { const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, g }; }
(() => {   // portrait CSS shared by the canvas games (whack keeps its own next to its other styles in index.html)
  const st = document.createElement('style');
  st.textContent = `html.touch .g2t.g2p>.g2box{position:relative;display:block;container-type:normal}
html.touch .g2t-conga.g2p>.g2hint{flex:0 0 17%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin-top:10px;padding:8px;
  border:3px dashed #c9bda8;border-radius:16px;font-size:14px;color:var(--muted)}
html.touch .g2t-conga.g2p>.g2hint::before{content:"";width:56px;height:56px;border-radius:50%;border:3px solid #c9bda8;box-sizing:border-box}`;
  document.head.appendChild(st);
})();
// a quiet line at the bottom of a tap-anywhere game saying what a press does (no key names)
function phoneHint(root, text) { const h = document.createElement('div'); h.className = 'g2hint'; h.textContent = text; root.appendChild(h); return h; }
// a press anywhere on the game (not on the HUD, an overlay or a deck button) — the one-action games
const freePress = e => !e.target.closest('.overlay, .g2deck, button, input, a');
// a short ring under the finger: the press shows at once even before the game reacts
function pressRing(root, e) {
  const r = root.getBoundingClientRect(), s = document.createElement('i'); s.className = 'g2ring';
  s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px'; root.appendChild(s);
  s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .9 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }], { duration: 320, easing: 'ease-out' }).onfinish = () => s.remove();
}

/* =================================================================
   Printer Tetris — paper of different sizes falls into the output tray
================================================================= */
function tetrisGame(root, api) {
  const COLS = 10, ROWS = 20, C = 26, W = 400, H = ROWS * C + 12, BX = 6, BY = 6;
  const SHAPES = {
    I: { c: '#3a86ff', n: 'กระดาษยาว', m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { c: '#ffd23f', n: 'กองโน้ต', m: [[1, 1], [1, 1]] },
    T: { c: '#8338ec', n: 'แฟ้ม', m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { c: '#21c07a', n: 'ใบเสร็จ', m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { c: '#ff4d4d', n: 'ซองจดหมาย', m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { c: '#ff9f1c', n: 'สมุดโน้ต', m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { c: '#00b4d8', n: 'สติกเกอร์', m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  };
  root.innerHTML = `<div class="hud"><span>🖨️ คะแนน <b data-k="sc">0</b></span><span>📄 แถว <b data-k="ln">0</b></span><span>⚡ เลเวล <b data-k="lv">1</b></span>
    <span class="muted g2tip">← → ย้าย · ↑ หมุน · ↓ เร่ง · Space ทิ้งลงทันที</span></div>`;
  const { cv, ctx } = g2canvas(root, W, H), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let bag = [], cur = null, next = null, score = 0, lines = 0, level = 1, fall = 0, lock = 0, running = false, over = false, flash = [], flashT = 0, trail = null, nextPop = 0;
  const draw7 = () => { if (!bag.length) bag = Object.keys(SHAPES).sort(() => rnd() - .5); return bag.pop(); };
  const make = t => ({ t, m: SHAPES[t].m.map(r => r.slice()), x: t === 'O' ? 4 : 3, y: t === 'I' ? -1 : 0 });
  const fits = (m, x, y) => m.every((r, j) => r.every((v, i) => !v || (x + i >= 0 && x + i < COLS && y + j < ROWS && (y + j < 0 || !grid[y + j][x + i]))));
  const rot = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
  const cellsOf = p => p.m.flatMap((r, j) => r.map((v, i) => v ? [p.x + i, p.y + j] : null).filter(Boolean));
  function spawn() { cur = next ? make(next) : make(draw7()); next = draw7(); nextPop = 1; if (!fits(cur.m, cur.x, cur.y)) gameOver(); }
  function hud() { q('sc').textContent = fmt(score); q('ln').textContent = lines; q('lv').textContent = level; }
  function place(hardDrop) {
    const cells = cellsOf(cur);
    cells.forEach(([x, y]) => { if (y >= 0) grid[y][x] = cur.t; });
    // landing dust under the piece
    for (const [x, y] of cells) if (y + 1 >= ROWS || grid[y + 1]?.[x]) fx.burst(BX + x * C + C / 2, BY + (y + 1) * C, { n: 3, colors: ['#d9dde3', '#fff'], speed: 70, grav: -40, size: 5, shape: 'puff', life: .35, spread: Math.PI, dir: -Math.PI / 2 });
    if (hardDrop) fx.shake(3, .12);
    const full = []; grid.forEach((r, j) => { if (r.every(Boolean)) full.push(j); });
    if (full.length) {
      flash = full; flashT = .22; api.sfx(full.length >= 4 ? 'level' : 'good');
      const pts = [0, 100, 300, 500, 800][full.length] * level, lv0 = level;
      score += pts; lines += full.length; level = 1 + Math.floor(lines / 10);
      for (const j of full) for (let i = 0; i < COLS; i += 2) fx.burst(BX + i * C + C, BY + j * C + C / 2, { n: 3, colors: ['#fffdf6', '#fffdf6', SHAPES[grid[j][i]].c], speed: 260, grav: 700, size: 6, shape: 'paper', life: .9 });
      const cy = BY + full[0] * C;
      if (full.length >= 4) { fx.text(BX + COLS * C / 2, cy, 'PRINTER TETRIS!', { color: PAL.yel, size: 26, life: 1.3 }); fx.flash(PAL.yel, .25); fx.hitstop(.09); fx.shake(9, .35); }
      else { fx.text(BX + COLS * C / 2, cy, `+${fmt(pts)}`, { color: '#fff', size: 22 + full.length * 3 }); fx.shake(2 + full.length * 2, .2); }
      if (level > lv0) fx.text(BX + COLS * C / 2, H / 2, `⚡ เลเวล ${level}!`, { color: PAL.pink, size: 30, life: 1.4, rise: 20 });
    } else api.sfx('tick');
    if (cur.y < 0) return gameOver();
    cur = null; hud();
  }
  function clearFlash() { for (const j of flash) { grid.splice(j, 1); grid.unshift(Array(COLS).fill(null)); } flash = []; spawn(); }
  function gameOver() { if (over) return; over = true; running = false; fx.shake(8, .4); fx.flash(PAL.red, .3); api.after(.8, () => api.end(score, `${lines} แถว · เลเวล ${level}`, false, { lines, level })); }
  const move = dx => { if (cur && fits(cur.m, cur.x + dx, cur.y)) { cur.x += dx; lock = 0; } };
  const turn = () => { if (!cur) return; const m = rot(cur.m); for (const k of [0, -1, 1, -2, 2]) if (fits(m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; lock = 0; return; } };
  const soft = () => { if (cur && fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 1; fall = 0; } };
  const hard = () => {
    if (!cur) return; const y0 = cur.y; while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; score += 2; }
    trail = { cells: cellsOf(cur).map(([x]) => x), y0, y1: cur.y, t: .15 };
    place(true); if (!flash.length && !over) spawn();
  };
  const act = f => () => { if (running && !api.paused && !flash.length) f(); };
  api.onKey(e => { const k = e.key; const map = { ArrowLeft: () => move(-1), a: () => move(-1), ArrowRight: () => move(1), d: () => move(1), ArrowUp: turn, w: turn, x: turn, ArrowDown: soft, s: soft, ' ': hard };
    if (map[k]) { e.preventDefault(); act(map[k])(); } });
  const phone = g2phone(root, 'tetris');
  if (!phone) g2pad(root, [['◀', act(() => move(-1))], ['⟳', act(turn)], ['▶', act(() => move(1))], ['▼', act(soft)], ['⤓ ทิ้ง', act(hard)]]);
  else {
    // lower-left: move (hold = repeat), lower-right: rotate / drop; swiping the playfield is the second way
    g2deck(root, { l: [['◀', 'ย้ายซ้าย', act(() => move(-1)), { repeat: 60 }], ['▶', 'ย้ายขวา', act(() => move(1)), { repeat: 60 }]],
      r: [['⟳', 'หมุน', act(turn)], ['⤓', 'ทิ้งลงทันที', act(hard), { cls: 'primary' }]] });
    // drag sideways = one column per 26 px, drag down = soft drop per 26 px, a quick flick down = drop, a tap = rotate
    let sw = null;
    root.addEventListener('pointerdown', e => { if (!freePress(e) || e.target.closest('.hud')) return; sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; pressRing(root, e); });
    root.addEventListener('pointermove', e => { if (!sw || e.pointerId !== sw.id) return;
      while (e.clientX - sw.x > 26) { sw.x += 26; sw.moved = true; act(() => move(1))(); }
      while (sw.x - e.clientX > 26) { sw.x -= 26; sw.moved = true; act(() => move(-1))(); }
      while (e.clientY - sw.y > 26) { sw.y += 26; sw.moved = true; sw.down = (sw.down || 0) + 1; act(soft)(); } });
    const swEnd = e => { if (!sw || e.pointerId !== sw.id) return; const dt = performance.now() - sw.t, dy = e.clientY - sw.y + (sw.down || 0) * 26;
      if (!sw.moved && dt < 300) act(turn)(); else if (dy > 70 && dt < 260) act(hard)(); sw = null; };
    root.addEventListener('pointerup', swEnd); root.addEventListener('pointercancel', () => { sw = null; });
  }
  /* Phone held upright (pv): the canvas is the whole play area at one logical px = one CSS px (the room art stays on
     whole pixels, 3 per sprite pixel). The next piece moves to a strip on top, so the tray gets the full width and is
     drawn as big as the height allows. Rules, speed and controls are the same. */
  const tbox = cv.parentNode, SH = 64; let pv = false, VW = W, VH = H, sb = 1, bx0 = 0, by0 = 0, dprT = 1, ro = null;
  if (phone) { const r = tbox.getBoundingClientRect(); pv = r.height > r.width; }
  function fit() {
    const r = tbox.getBoundingClientRect(), bw = Math.floor(r.width), bh = Math.floor(r.height); if (bw < 100 || bh < 100) return;
    dprT = Math.min(3, devicePixelRatio || 1); VW = bw - 6; VH = bh - 6;
    const fw = COLS * C + 12, fh = ROWS * C + 12;
    sb = Math.min((VW - 8) / fw, (VH - SH - 8) / fh); bx0 = (VW - fw * sb) / 2; by0 = SH + 4 + Math.max(0, (VH - SH - 8 - fh * sb) / 2);
    cv.width = Math.round(VW * dprT); cv.height = Math.round(VH * dprT); cv.style.width = bw + 'px'; cv.style.height = bh + 'px';
  }
  if (pv) { fit(); if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(tbox); } }
  // one sheet of paper: white page, coloured header strip, ruled lines
  function cell(x, y, t, alpha = 1) {
    const s = SHAPES[t]; ctx.globalAlpha = alpha;
    ctx.fillStyle = PAL.ink; ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    ctx.fillStyle = PAL.paper; ctx.fillRect(x + 3, y + 3, C - 6, C - 6);
    ctx.fillStyle = s.c; ctx.fillRect(x + 3, y + 3, C - 6, 5);
    ctx.fillStyle = 'rgba(43,33,64,.2)'; ctx.fillRect(x + 6, y + 12, C - 12, 2); ctx.fillRect(x + 6, y + 17, C - 16, 2);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x + 3, y + 8, 2, C - 11);
    ctx.globalAlpha = 1;
  }
  // the next piece at cell size s, centred on (cx, cy)
  function nextPiece(cx, cy, s0) {
    const m = SHAPES[next].m, n = m.length, s = s0 * (1 + nextPop * .25), ox = cx - n * s / 2, oy = cy - n * s / 2;
    m.forEach((r, j) => r.forEach((v, i) => { if (v) { ctx.save(); ctx.translate(ox + i * s, oy + j * s); ctx.scale(s / C, s / C); cell(0, 0, next); ctx.restore(); } }));
  }
  function draw() {
    if (pv) {   // room and next-piece strip in CSS px, then the tray scaled by sb
      ctx.setTransform(dprT, 0, 0, dprT, 0, 0);
      officeBG(ctx, VW, VH, VH - 46, { wall: 'wall_mint' });
      const x = bx0 + 2;
      rrect(ctx, x, 6, 96, SH - 10, 10, '#fff', PAL.ink); if (next) nextPiece(x + 48, 6 + (SH - 10) / 2, 13);
      txt(ctx, 'ชิ้นต่อไป', x + 108, 22, 14, PAL.ink, 'left', 700); if (next) txt(ctx, SHAPES[next].n, x + 108, 44, 13, PAL.muted, 'left');
      const rx = VW - bx0 - 2; txt(ctx, 'เคลียร์ 4 แถวพร้อมกัน', rx, 22, 12, PAL.ink, 'right'); txt(ctx, '= 800 × เลเวล', rx, 42, 12, PAL.pink, 'right', 700);
      ctx.save(); ctx.translate(bx0, by0); ctx.scale(sb, sb);
    }
    fx.pre(ctx);
    if (!pv) {
      officeBG(ctx, W, H, H - 46, { wall: 'wall_mint', windows: [['window_small', 340, 170, 3]] });
      drawPixAt(ctx, 'plant_small', 372, H - 40, 3);
    }
    // printer body around the tray
    ctx.fillStyle = PAL.ink; ctx.fillRect(BX - 6, BY - 6, COLS * C + 12, ROWS * C + 12);
    ctx.fillStyle = '#d9dde3'; ctx.fillRect(BX - 4, BY - 4, COLS * C + 8, ROWS * C + 8);
    ctx.fillStyle = '#3d3a4f'; ctx.fillRect(BX, BY, COLS * C, ROWS * C);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 1; i < COLS; i++) ctx.fillRect(BX + i * C, BY, 1, ROWS * C);
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { const t = grid[j][i]; if (t) cell(BX + i * C, BY + j * C, t); }
    for (const j of flash) { ctx.globalAlpha = Math.min(1, flashT * 6); ctx.fillStyle = '#fff'; ctx.fillRect(BX, BY + j * C, COLS * C, C); ctx.globalAlpha = 1; }
    if (trail) { ctx.fillStyle = `rgba(255,255,255,${trail.t * 1.6})`; for (const x of new Set(trail.cells)) ctx.fillRect(BX + x * C + 4, BY + Math.max(0, trail.y0) * C, C - 8, (trail.y1 - Math.max(0, trail.y0)) * C); }
    if (cur) {
      let gy = cur.y; while (fits(cur.m, cur.x, gy + 1)) gy++;
      cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && gy + j >= 0) cell(BX + (cur.x + i) * C, BY + (gy + j) * C, cur.t, .22); }));
      cur.m.forEach((r, j) => r.forEach((v, i) => { if (v && cur.y + j >= 0) cell(BX + (cur.x + i) * C, BY + (cur.y + j) * C, cur.t); }));
    }
    if (pv) { fx.post(ctx, COLS * C + 12, ROWS * C + 12); ctx.restore(); return; }
    const px = COLS * C + 16;
    txt(ctx, 'ชิ้นต่อไป', px + 60, 24, 15, PAL.ink, 'center', 700);
    rrect(ctx, px, 40, 120, 100, 10, '#fff', PAL.ink);
    if (next) {
      const m = SHAPES[next].m, n = m.length, s = 22 * (1 + nextPop * .25), ox = px + 60 - n * s / 2, oy = 90 - n * s / 2;
      m.forEach((r, j) => r.forEach((v, i) => { if (v) { ctx.save(); ctx.translate(ox + i * s, oy + j * s); ctx.scale(s / C, s / C); cell(0, 0, next); ctx.restore(); } }));
      txt(ctx, SHAPES[next].n, px + 60, 154, 13, PAL.muted);
    }
    drawPixAt(ctx, 'pc_desk', px + 60, 266, 3, { sy: 1 + Math.sin(performance.now() / 90) * (running ? .02 : 0) });
    txt(ctx, 'เคลียร์ 4 แถวพร้อมกัน', px + 60, 285, 12, PAL.ink); txt(ctx, '= 800 × เลเวล', px + 60, 302, 12, PAL.pink, 'center', 700);
    fx.post(ctx, W, H);
  }
  api.loop(dt => {
    const d = fx.step(dt); nextPop = Math.max(0, nextPop - dt * 5); if (trail && (trail.t -= dt) <= 0) trail = null;
    if (running && d) {
      if (flash.length) { flashT -= d; if (flashT <= 0) clearFlash(); }
      else if (cur) {
        fall += d; const speed = Math.max(.07, .8 - (level - 1) * .07);
        if (fits(cur.m, cur.x, cur.y + 1)) { lock = 0; if (fall >= speed) { cur.y++; fall = 0; } }
        else { lock += d; if (lock > .45) { lock = 0; place(false); if (!flash.length && !over) spawn(); } }
      }
    }
    draw();
  });
  hud(); draw();
  api.intro({ how: `<p>🖨️ เครื่องพิมพ์พ่นกระดาษออกมาไม่หยุด! จัดให้เรียงเต็มแถวในถาด แถวที่เต็มจะหายไป</p>
      ${phone ? '<p>👆 ปุ่มมุมซ้ายล่าง ย้าย · มุมขวาล่าง หมุน / ทิ้ง · หรือปัดบนจอ: ปัดข้าง ย้าย · แตะ หมุน · ปัดลงเร็วๆ ทิ้ง</p>'
        : '<p>⌨️ <b>← →</b> ย้าย · <b>↑</b> หมุน · <b>↓</b> เร่งลง · <b>Space</b> ทิ้งลงทันที (มือถือใช้ปุ่มใต้จอ)</p>'}
      <p>⚡ ทุก 10 แถวขึ้นเลเวล กระดาษตกเร็วขึ้น · กองล้นถึงด้านบน = จบเกม</p>`,
    buttons: [{ label: '🖨️ เริ่มพิมพ์!', primary: true, go() { running = true; spawn(); } }] });
  return { destroy() { ro && ro.disconnect(); } };
}

/* =================================================================
   Stamp Rush — stamp APPROVED on documents riding the conveyor
================================================================= */
function stampGame(root, api) {
  const W = 720, H = 360, SX = 360, BELT_Y = 230;
  const DOCS = ['รายงาน', 'ใบเสนอราคา', 'บันทึกประชุม', 'สัญญา', 'แผนงาน', 'ใบแจ้งหนี้', 'โปรเจกต์', 'งบประมาณ'];
  root.innerHTML = `<div class="hud"><span data-k="hp"></span><span>⭐ <b data-k="sc">0</b></span><span data-k="cb" class="muted"></span><span class="muted g2tip">Space / แตะจอ = ปั๊ม</span></div>`;
  const { cv, ctx, L } = g2view(root, W, H, { min: 187, max: 187, h: 136 }, 'ปั๊มตอนกรอบสีฟ้าอยู่ในแถบสีชมพู · เอกสารร่างห้ามปั๊ม'), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let healed = 0, docs = [], speed = 150, gap = 0, made = 0, lives = 3, score = 0, combo = 0, maxc = 0, perfect = 0, running = false, over = false, press = 0, beltOff = 0;
  // where the pop-up texts go: the landscape scene's numbers, or the portrait ones from layout()
  const LAND = { x: SX, lab: 125, miss: 130, heal: 175, combo: 80, comboB: 90 };
  let V = LAND, P = null;
  // portrait: documents come down a belt from the top; progress d.x (same units, speeds and windows as landscape)
  // maps to y = TY + (d.x - SX) * f, so the target sits just above the thumb deck and a document shows for the same
  // stretch of progress as in the wide scene
  const py = x => P.TY + (x - SX) * P.f;
  const bg = g2layer(L, ['wall_yellow', 'floor_dwood', 'plant_pot', 'desk_drawer', 'box_wood', 'cabinet_wood'], paintBG);
  function layout() {
    if (!L.portrait || L.frame) { P = null; V = LAND; return; }
    const cx = Math.round(L.W / 2), TY = Math.round(L.H - Math.max(64, L.H * .11)), f = (TY + 26) / 410, bw = Math.round(100 * f + 30);
    P = { cx, TY, f, bw, bl: cx - (bw >> 1), wallY: 30 * L.k, side: L.left ? -1 : 1 };
    V = { x: cx, lab: TY - 100 * f, miss: TY - 100 * f, heal: TY - 62 * f, combo: TY - 190 * f, comboB: TY - 180 * f };
    bg.reset();
  }
  L.fn = layout; layout();
  function hud() { q('hp').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives); q('sc').textContent = fmt(score); q('cb').textContent = combo >= 3 ? `🔥 คอมโบ ${combo}` : ''; }
  function spawn() { made++; const draft = made > 8 && rnd() < .2; docs.push({ x: -80, name: pick(rnd, DOCS), draft, stamped: false, done: false, mark: '', sq: 0 }); }
  function lose(msg) {
    lives--; combo = 0; api.sfx('bad'); fx.text(V.x, V.miss, msg, { color: PAL.red, size: 22, life: 1.1 }); fx.shake(8, .3); fx.flash(PAL.red, .25); hud();
    if (lives <= 0 && !over) { over = true; running = false; api.after(.8, () => api.end(score, `Perfect ${perfect} · คอมโบ ${maxc}`, false, { perfect, combo: maxc, docs: made })); }
  }
  function stamp() {
    if (!running || api.paused || press > 0) return; press = .18; api.sfx('stamp');
    let best = null, bd = 1e9; for (const d of docs) { if (d.stamped) continue; const dd = Math.abs(d.x - SX); if (dd < bd) { bd = dd; best = d; } }
    if (!best || bd > 60) { combo = 0; fx.text(V.x, V.miss, 'ปั๊มพลาด!', { color: '#d9d2e6', size: 22 }); fx.shake(2, .1); hud(); return; }
    best.stamped = true; best.sq = 1;
    if (best.draft) { best.mark = 'void'; return lose('❌ เอกสารร่าง ห้ามปั๊ม!'); }
    const [label, pts] = bd < 10 ? ['PERFECT', 30] : bd < 26 ? ['GOOD', 20] : ['OK', 10];
    if (label === 'PERFECT') perfect++;
    combo++; maxc = Math.max(maxc, combo);
    score += Math.round(pts * (1 + Math.floor(combo / 10) * .5)); best.mark = 'ok';
    // ink splatter where the stamp hit, harder feedback the closer it was
    const hx = P ? P.cx : best.x, hy = P ? py(best.x) : BELT_Y - 29 * DS(), sy = P ? hy - 31 * P.f : BELT_Y - 60 * DS();
    fx.burst(hx, hy, { n: label === 'PERFECT' ? 16 : 9, colors: [PAL.red, '#ff6b6b', '#b3203a'], speed: 200, grav: 300, size: 4, life: .45 });
    if (label === 'PERFECT') { fx.shake(7, .18); fx.hitstop(.07); fx.burst(hx, sy, { n: 10, colors: [PAL.yel, '#fff'], speed: 260, grav: 0, size: 7, shape: 'star', life: .5 }); api.sfx('good'); }
    else fx.shake(label === 'GOOD' ? 4 : 2, .12);
    fx.text(V.x, V.lab, label, { color: label === 'PERFECT' ? PAL.pink : label === 'GOOD' ? PAL.orange : PAL.green, size: label === 'PERFECT' ? 34 : 26 });
    if (combo > 0 && combo % 10 === 0 && lives < 3 && healed < 2) { lives++; healed++; fx.text(V.x, V.heal, '❤️ +1 ชีวิต', { color: PAL.pink, size: 24, life: 1.2 }); }   // a long streak buys a life back
    if (combo > 0 && combo % 10 === 0) { fx.text(V.x, V.combo, `🔥 คอมโบ ${combo}!`, { color: PAL.yel, size: 30, life: 1.2 }); fx.burst(V.x, V.comboB, { n: 24, colors: CONFETTI, speed: 320, grav: 500, size: 6, shape: 'paper', life: 1 }); }
    hud();
  }
  // phone: a press anywhere on the game stamps (one action); desktop: the canvas. In portrait the hint is the thumb deck.
  const phone = g2phone(root, 'tap', true);
  if (phone) { const pad = phoneHint(root, onTouch('แตะตรงไหนก็ได้ = ปั๊ม', 'คลิกตรงไหนก็ได้ หรือกด Space = ปั๊ม')); let padT = 0;
    root.addEventListener('pointerdown', e => { if (!freePress(e)) return; e.preventDefault(); pressRing(root, e);
      pad.classList.add('on'); clearTimeout(padT); padT = setTimeout(() => pad.classList.remove('on'), 140); stamp(); }); }
  else cv.addEventListener('pointerdown', e => { e.preventDefault(); stamp(); });
  api.onKey(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stamp(); } });
  function doc(d) {
    const x = d.x - 50, y = BELT_Y - 118, sq = d.sq, D = DS();
    ctx.save(); ctx.translate(d.x, BELT_Y); ctx.scale(D * (1 + sq * .08), D * (1 - sq * .12)); ctx.rotate(Math.sin(d.x / 60) * .03); ctx.translate(-d.x, -BELT_Y);
    ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.fillRect(x + 6, y + 6, 100, 116);
    rrect(ctx, x, y, 100, 116, 4, d.draft ? '#e9e4ef' : PAL.paper, PAL.ink);
    txt(ctx, d.name, d.x, y + 16, 13, PAL.ink);
    ctx.fillStyle = 'rgba(43,33,64,.2)'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 12, y + 30 + i * 10, 76 - (i % 2) * 18, 3);
    if (d.draft) { txt(ctx, 'ร่าง', d.x, y + 82, 18, PAL.red, 'center', 800); txt(ctx, 'ห้ามปั๊ม', d.x, y + 100, L.frame ? 13 : 11, PAL.red); }
    else { ctx.setLineDash([4, 3]); ctx.strokeStyle = PAL.blue; ctx.lineWidth = 2; ctx.strokeRect(d.x - 26, y + 74, 52, 30); ctx.setLineDash([]); }
    if (d.mark === 'ok') { ctx.save(); ctx.translate(d.x, y + 89); ctx.rotate(-.2); ctx.strokeStyle = PAL.red; ctx.lineWidth = 3; ctx.strokeRect(-36, -14, 72, 28); txt(ctx, 'APPROVED', 0, 1, 13, PAL.red, 'center', 800); ctx.restore(); }
    if (d.mark === 'void') { ctx.strokeStyle = PAL.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 10, y + 10); ctx.lineTo(x + 90, y + 106); ctx.moveTo(x + 90, y + 10); ctx.lineTo(x + 10, y + 106); ctx.stroke(); }
    ctx.restore();
  }
  function draw() {
    if (L.frame) return drawF();
    if (P) return drawP();
    fx.pre(ctx);
    officeBG(ctx, W, H, BELT_Y + 42, { wall: 'wall_yellow', floor: 'floor_dwood', windows: [['window_big', 112, 28, 3], ['window_grey', 612, 34, 3]] });
    drawPixAt(ctx, 'plant_pot', 672, BELT_Y - 2, 3); drawPixAt(ctx, 'board_calendar', SX + 180, 100, 3);
    // conveyor: dark belt with moving pixel treads and rollers
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, BELT_Y - 2, W, 40);
    ctx.fillStyle = '#4a4458'; ctx.fillRect(0, BELT_Y, W, 30);
    ctx.fillStyle = '#6b6478'; for (let x = -40 + beltOff % 40; x < W; x += 40) ctx.fillRect(x, BELT_Y + 6, 20, 4);
    ctx.fillStyle = '#8a93a3'; for (let x = 20; x < W; x += 80) ctx.fillRect(x, BELT_Y + 30, 16, 8);
    // target zone
    ctx.fillStyle = 'rgba(255,92,138,.14)'; ctx.fillRect(SX - 26, BELT_Y - 118, 52, 118);
    ctx.fillStyle = 'rgba(255,92,138,.5)'; ctx.fillRect(SX - 26, BELT_Y - 2, 52, 3);
    for (const d of docs) doc(d);
    // stamp arm with a squash when it lands
    const k = press > 0 ? 1 - Math.abs(press - .09) / .09 : 0, down = k * 40;
    ctx.fillStyle = '#8d5a3b'; ctx.fillRect(SX - 6, 0, 12, 40 + down);
    ctx.save(); ctx.translate(SX, 72 + down); ctx.scale(1 + k * .15, 1 - k * .12);
    rrect(ctx, -34, -36, 68, 30, 8, PAL.red, PAL.ink); rrect(ctx, -40, -10, 80, 10, 3, PAL.ink);
    txt(ctx, 'APPROVED', 0, -21, 11, '#fff', 'center', 800); ctx.restore();
    txt(ctx, `ความเร็วสายพาน ${Math.round(speed)}`, 12, H - 14, 12, '#fff3e0', 'left');
    fx.post(ctx, W, H);
  }
  // ---- frame scene (every window, owner 17 Nov 2026: left to right like the wide scene). The wide scene's units at
  // 3 units per art pixel, so the room art is at the frame's scale. The stage is a fixed 561 units wide on every
  // window: a document shows for the same 410 units before the stamp everywhere. Documents, the target zone and the
  // stamp are drawn 1.4x so their text stays 12 px or more at scale 2; the hit windows are unchanged (d.x vs SX).
  const DY = 47;   // room above the documents for the stamp arm
  function DS() { return L.frame ? 1.4 : 1; }
  function drawF() {
    const f = L.k / 3, U = L.W / f, D = DS(), k = press > 0 ? 1 - Math.abs(press - .09) / .09 : 0, down = k * 40;
    fx.pre(ctx); ctx.save(); ctx.scale(f, f);
    officeBG(ctx, U, H + DY, BELT_Y + 42 + DY, { wall: 'wall_yellow', floor: 'floor_dwood', windows: [['window_big', 112, 20, 3], ['window_grey', Math.round(U) - 40, 26, 3]] });
    ctx.translate(0, DY);
    drawPixAt(ctx, 'plant_pot', Math.round(U) - 34, BELT_Y - 2, 3);
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, BELT_Y - 2, U, 40);
    ctx.fillStyle = '#4a4458'; ctx.fillRect(0, BELT_Y, U, 30);
    ctx.fillStyle = '#6b6478'; for (let x = -40 + beltOff % 40; x < U; x += 40) ctx.fillRect(x, BELT_Y + 6, 20, 4);
    ctx.fillStyle = '#8a93a3'; for (let x = 20; x < U; x += 80) ctx.fillRect(x, BELT_Y + 30, 16, 8);
    ctx.fillStyle = 'rgba(255,92,138,.14)'; ctx.fillRect(SX - 26 * D, BELT_Y - 118 * D, 52 * D, 118 * D);
    ctx.fillStyle = 'rgba(255,92,138,.5)'; ctx.fillRect(SX - 26 * D, BELT_Y - 2, 52 * D, 3);
    for (const d of docs) doc(d);
    // the stamp waits 40 units above the documents and drops onto them
    const rest = BELT_Y - 118 * D - 40;
    ctx.fillStyle = '#8d5a3b'; ctx.fillRect(SX - 6, -DY, 12, rest + down - 30 * D + DY);
    ctx.save(); ctx.translate(SX, rest + down); ctx.scale(D * (1 + k * .15), D * (1 - k * .12));
    rrect(ctx, -34, -36, 68, 30, 8, PAL.red, PAL.ink); rrect(ctx, -40, -10, 80, 10, 3, PAL.ink);
    txt(ctx, 'APPROVED', 0, -21, 11, '#fff', 'center', 800); ctx.restore();
    txt(ctx, `ความเร็วสายพาน ${Math.round(speed)}`, 12, H - 16, 12 / f, '#fff3e0', 'left');
    fx.post(ctx, U, H); ctx.restore();
  }
  // ---- portrait scene (phone held upright): the room seen from above, the belt runs top to bottom
  function paintBG(g) {
    const { W: w, H: h, k } = L, { bl, bw, wallY } = P;
    officeBG(g, w, h, wallY, { wall: 'wall_yellow', floor: 'floor_dwood', k });
    // side decor, clear of the target band and the belt
    const lx = bl >> 1, rx = bl + bw + ((w - bl - bw) >> 1);
    const low = P.TY - Math.round(26 * P.f) - 24;
    drawPixAt(g, 'cabinet_wood', lx, wallY + 40 * k, k); drawPixAt(g, 'plant_pot', lx, low, k);
    drawPixAt(g, 'desk_drawer', rx, wallY + 32 * k, k); drawPixAt(g, 'box_wood', rx, low, k);
    // the belt: an ink frame, the dark surface and rollers down both edges, coming out of a hatch in the wall
    g.fillStyle = PAL.ink; g.fillRect(bl - 4, 0, bw + 8, h);
    g.fillStyle = '#4a4458'; g.fillRect(bl, 0, bw, h);
    g.fillStyle = '#8a93a3'; for (let y = 20; y < h; y += 80) { g.fillRect(bl - 10, y, 6, 16); g.fillRect(bl + bw + 4, y, 6, 16); }
    g.fillStyle = PAL.ink; g.fillRect(bl - 14, 0, bw + 28, Math.round(wallY * .55));
    g.fillStyle = '#2f2a3c'; g.fillRect(bl - 4, 0, bw + 8, Math.round(wallY * .55) - 6);
  }
  function docP(d, y) {
    const { cx, f } = P, sq = d.sq;
    ctx.save(); ctx.translate(cx, y); ctx.scale(f * (1 + sq * .08), f * (1 - sq * .12)); ctx.rotate(Math.sin(d.x / 60) * .03);
    // local units: the stamp box (52 x 32) is centred on (0, 0); a PERFECT press is exactly that box inside the band
    ctx.fillStyle = 'rgba(43,33,64,.18)'; ctx.fillRect(-44, -84, 100, 116);
    rrect(ctx, -50, -90, 100, 116, 4, d.draft ? '#e9e4ef' : PAL.paper, PAL.ink);
    txt(ctx, d.name, 0, -74, 13, PAL.ink);
    ctx.fillStyle = 'rgba(43,33,64,.2)'; for (let i = 0; i < 4; i++) ctx.fillRect(-38, -60 + i * 10, 76 - (i % 2) * 18, 3);
    if (d.draft) { txt(ctx, 'ร่าง', 0, -8, 18, PAL.red, 'center', 800); txt(ctx, 'ห้ามปั๊ม', 0, 10, 11, PAL.red); }
    else { ctx.setLineDash([4, 3]); ctx.strokeStyle = PAL.blue; ctx.lineWidth = 2; ctx.strokeRect(-26, -16, 52, 32); ctx.setLineDash([]); }
    if (d.mark === 'ok') { ctx.save(); ctx.rotate(-.2); ctx.strokeStyle = PAL.red; ctx.lineWidth = 3; ctx.strokeRect(-36, -14, 72, 28); txt(ctx, 'APPROVED', 0, 1, 13, PAL.red, 'center', 800); ctx.restore(); }
    if (d.mark === 'void') { ctx.strokeStyle = PAL.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, -80); ctx.lineTo(40, 16); ctx.moveTo(40, -80); ctx.lineTo(-40, 16); ctx.stroke(); }
    ctx.restore();
  }
  function drawP() {
    const { cx, TY, f, bw, bl, side } = P, h = L.H, step = Math.round(40 * f);
    fx.pre(ctx);
    bg.draw(ctx);
    // treads: slats across the belt, moving down with it
    ctx.fillStyle = '#6b6478'; for (let y = -step + Math.round(beltOff * f) % step; y < h; y += step) ctx.fillRect(bl + 6, y, bw - 12, 4);
    // target band: the stamp box fits inside it with 10 units to spare on each side (= the PERFECT window)
    const band = Math.round(26 * f);
    ctx.fillStyle = 'rgba(255,92,138,.16)'; ctx.fillRect(bl, TY - band, bw, band * 2);
    ctx.fillStyle = 'rgba(255,92,138,.7)'; ctx.fillRect(bl, TY - band - 1, bw, 3); ctx.fillRect(bl, TY + band - 1, bw, 3);
    for (const d of docs) { const y = py(d.x); if (y > -40 * f && y < h + 100 * f) docP(d, y); }
    // the stamp swings in from the side over the band and squashes when it lands
    // at rest it waits beside the belt at 70% size, kept fully on screen (16 Nov 2026: it hung off the right edge on phones)
    const k = press > 0 ? 1 - Math.abs(press - .09) / .09 : 0, hw0 = 40 * f * .9 * .7,
      rest = side > 0 ? Math.min(cx + bw / 2 + hw0 + 6, L.W - hw0 - 4) : Math.max(cx - bw / 2 - hw0 - 6, hw0 + 4), hx = Math.round(rest + (cx - rest) * k);
    ctx.fillStyle = '#8d5a3b'; ctx.fillRect(side > 0 ? hx : 0, TY - 6, side > 0 ? L.W - hx : hx, 12);
    ctx.save(); ctx.translate(hx, TY); const s = f * .9 * (.7 + .3 * k) * (1 - k * .1); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(43,33,64,.25)'; ctx.fillRect(-36, -18, 80, 44);
    rrect(ctx, -40, -24, 80, 44, 8, PAL.red, PAL.ink); rrect(ctx, -32, -16, 64, 28, 4, null, '#fff');
    txt(ctx, 'APPROVED', 0, -2, 11, '#fff', 'center', 800); ctx.restore();
    txt(ctx, `สายพาน ${Math.round(speed)}`, bl >> 1, h - 12, 12, PAL.ink, 'center');
    fx.post(ctx, L.W, h);
  }
  api.loop(dt => {
    const d = fx.step(dt);
    if (running && d) {
      speed = Math.min(520, 150 + made * 7); gap -= d * speed; beltOff += d * speed;
      if (gap <= 0) { spawn(); gap = 170 + rnd() * 140; }
      for (const o of docs) { o.x += speed * d; if (!o.done && o.x > SX + 60) { o.done = true; if (!o.stamped && !o.draft) lose('⏰ หลุดไปไม่ได้ปั๊ม!'); } }
      for (let i = docs.length - 1; i >= 0; i--) if (docs[i].x >= W + 80) docs.splice(i, 1);
    }
    for (const o of docs) o.sq = Math.max(0, o.sq - dt * 5);
    press = Math.max(0, press - dt);
    draw();
  });
  hud(); draw();
  if (window.__TEST__) window.__stamp = { SX, get: () => ({ docs, score, lives, perfect, made, P }) };
  api.intro({ how: `<p>🏢 เอกสารวิ่งมาบนสายพาน — ${phoneOn() ? '<b>แตะตรงไหนก็ได้</b>' : '<b>คลิกตรงไหนก็ได้</b> หรือกด <b>Space</b>'} ตอนกรอบสีฟ้าอยู่${P ? 'ในแถบสีชมพู' : 'ใต้ตราปั๊ม'}</p>
      <p>🎯 ตรงกลางเป๊ะ = <b>PERFECT</b> · ยิ่งคอมโบยาวคะแนนยิ่งคูณ · คอมโบครบ 10 ได้หัวใจคืน ❤️ (สูงสุด 2 ครั้ง)</p><p>⚠️ เอกสาร <b>"ร่าง"</b> ห้ามปั๊ม · ปล่อยเอกสารปกติหลุดไป = เสียหัวใจ ❤️</p>`,
    buttons: [{ label: '🔏 เริ่มปั๊ม!', primary: true, go() { running = true; } }] });
}

/* =================================================================
   Lunch Barista — mix the drink each customer ordered before they lose patience
================================================================= */
function baristaGame(root, api) {
  const TOTAL = 90, BONUS_MAX = 40;
  // [key, label, liquid colour in the cup]
  const ING = [['shot', 'ช็อต', '#6b3e26'], ['milk', 'นม', '#fffdf6'], ['ice', 'น้ำแข็ง', '#bfe9ff'], ['choco', 'ช็อกโกแลต', '#7a4a2a'], ['water', 'น้ำ', '#9fdcff'], ['tea', 'ชา', '#e0913b']];
  const MENU = [{ n: 'อเมริกาโน่', r: ['shot', 'water'] }, { n: 'ลาเต้', r: ['shot', 'milk'] }, { n: 'ลาเต้เย็น', r: ['shot', 'milk', 'ice'] },
    { n: 'มอคค่า', r: ['shot', 'milk', 'choco'] }, { n: 'โกโก้เย็น', r: ['choco', 'milk', 'ice'] }, { n: 'ชาเย็น', r: ['tea', 'milk', 'ice'] },
    { n: 'ชาร้อน', r: ['tea', 'water'] }, { n: 'เอสเพรสโซ่', r: ['shot'] }];
  root.innerHTML = `<div class="hud"><div class="timer" data-k="tm"><div data-k="bar"></div></div><span>⏱ <b data-k="t">${TOTAL}</b></span><span>⭐ <b data-k="sc">0</b></span><span data-k="hp"></span></div>`;
  const G = g2canvas(root, 760, 420), { cv, ctx, at } = G, q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let bonus = 0, slots = [null, null, null], leaving = [], cup = [], time = TOTAL, el = 0, score = 0, served = 0, hearts = 3, next = 1, running = false, over = false, wob = 0, t = 0;
  // scene layout. LD = the 760 x 420 scene of desktop / landscape (the old constants); a portrait phone gets portrait(w, h):
  // customers and order bubbles in the top third, a big cup in the middle, art at an integer 3x
  const LD = { W: 760, H: 420, port: false, slot: [140, 380, 620], sw: 90, CUP_X: 380, COUNTER: 262, pby: 238, pk: 4, hop: 60, walk: 160,
    bubY: 60, bx: -92, by: -42, bw: 184, bh: 86, tw: 10, ty: 43, tt: 56, ns: 16, ny: -22, iy: 20, ik: 3.4, is: 38, rx: -70, ry: 26, rw: 140, rh: 9,
    fy: [170, 150, 120, 92, 64], mad: [44, 140], hitY: 260, fullY: 270, wrongY: 250, clearY: 360, cupTop: 300, cupBot: 402, cw: 84, lh: 22, ice: 1, emptyY: 352,
    win: [['window_red', 58, 30, 3], ['window_red', 702, 30, 3]], back: [['fridge_wide', 260, 3], ['plant_pot', 500, 3]], plank: 64, shelf: false,
    front: [['cans', 80, 396, 3], ['fruit_basket', 690, 396, 4], ['cake', 160, 264, 3], ['cake_straw', 196, 264, 3], ['pizza', 570, 264, 3], ['cake_slice', 606, 264, 3]] };
  function portrait(W, H) {
    const pk = 3, pby = 4 + 80 + 12 + 32 * pk, COUNTER = pby + 18, lh = Math.max(24, Math.min(40, Math.round((H - COUNTER - 22 - 120) / 5))), cw = Math.round(lh * 3.6) & ~1;
    const cupBot = Math.round((COUNTER + 22 + H) / 2 + 2 * lh + 4 + 12), cupTop = cupBot - 4 * lh - 8, cx = Math.round(W / 2), side = (cx - cw / 2) / 4;
    return { W, H, port: true, slot: [W / 6, W / 2, W * 5 / 6].map(Math.round), sw: Math.round(W / 6), CUP_X: cx, COUNTER, pby, pk, hop: 45, walk: 120,
      bubY: 44, bx: -58, by: -40, bw: 116, bh: 80, tw: 8, ty: 39, tt: 50, ns: 14, ny: -20, iy: 17, ik: 3, is: 30, rx: -48, ry: 22, rw: 96, rh: 8,
      fy: [pby - 50, pby - 70, pby - 96, pby - 120, pby - 144], mad: [30, pby - 74], hitY: COUNTER + 22, fullY: cupTop - 30, wrongY: cupTop - 56, clearY: cupBot - 42,
      cupTop, cupBot, cw, lh, ice: lh / 22, emptyY: Math.round((cupTop + cupBot) / 2),
      win: [], back: [['plant_pot', Math.round(W / 3), 3], ['fridge', Math.round(W * 2 / 3), 3]], plank: 48, shelf: true,
      // the six ingredients stand on the shelf beside the cup, three on each side (the same icons as the buttons)
      front: [...ING.map(([n], i) => [pxa(n), Math.round(i < 3 ? side * (i + 1) : W - side * (6 - i)), cupBot + 2, 3]),
        ['cake_straw', Math.round(W / 3) + 38, COUNTER + 2, 3], ['cake_slice', Math.round(W * 2 / 3) - 42, COUNTER + 2, 3]] };
  }
  let L = LD, layers = null;   // portrait: cached static art { back, front }
  const FY = 40;
  const ART = ['wall_pink', 'floor_wood', 'plant_pot', 'fridge', 'cake_straw', 'cake_slice'];
  const same = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const ingOf = k => ING.find(z => z[0] === k);
  function hud() { q('t').textContent = Math.ceil(time); q('sc').textContent = fmt(score); q('bar').style.width = Math.min(100, time / TOTAL * 100) + '%'; q('tm').classList.toggle('low', time < 15);
    q('hp').textContent = '❤️'.repeat(hearts) + '🖤'.repeat(3 - hearts); }
  function end() { if (over) return; over = true; running = false; api.end(score, `เสิร์ฟ ${served} แก้ว`, false, { served }); }
  function spawn() { const free = slots.map((s, i) => s ? -1 : i).filter(i => i >= 0); if (!free.length) return;
    const i = pick(rnd, free), m = pick(rnd, el < 25 ? MENU.slice(0, 5) : MENU), pat = Math.max(11, 20 - el * .09);
    slots[i] = { m, face: pick(rnd, MI_PEOPLE), pat, max: pat, in: 0 }; }
  function add(k) {
    if (!running || api.paused) return; if (cup.length >= 4) { fx.text(L.CUP_X, L.fullY, 'แก้วเต็มแล้ว!', { color: PAL.orange, size: 20 }); fx.shake(2, .1); return; }
    cup.push(k); wob = 1; api.sfx('tick');
    fx.burst(L.CUP_X, L.cupBot - 2 - cup.length * L.lh, { n: 8, colors: [ingOf(k)[2], '#fff'], speed: 160, grav: 600, size: 4, life: .5, spread: 1.6 });
  }
  function serve(i) {
    if (!running || api.paused || !cup.length) return;
    if (i == null) i = slots.findIndex(s => s && same(s.m.r, cup));
    const s = slots[i];
    if (!s || !same(s.m.r, cup)) {
      api.sfx('bad'); score = Math.max(0, score - 10); fx.text(L.CUP_X, L.wrongY, '❌ ไม่ตรงออเดอร์ −10', { color: PAL.red, size: 22 }); fx.shake(6, .25); fx.flash(PAL.red, .2);
      if (s) s.pat -= 3; cup = []; hud(); return;
    }
    const tip = Math.round(s.pat / s.max * 20), pts = 30 + s.m.r.length * 5 + tip; score += pts; served++; api.sfx('good');
    const x = L.slot[i], fy = L.fy;
    fx.burst(x, fy[0], { n: 22, colors: CONFETTI, speed: 300, grav: 500, size: 6, shape: 'paper', life: .9 });
    fx.burst(x, fy[1], { n: 6, colors: [PAL.yel], speed: 200, grav: 0, size: 7, shape: 'star', life: .5 });
    const bt = Math.min(BONUS_MAX - bonus, tip >= 15 ? 5 : 3); bonus += bt; time += bt;
    fx.text(x, fy[2], `+${pts}`, { color: PAL.yel, size: 30 }); if (bt > 0) fx.text(x, fy[3], bonus >= BONUS_MAX ? '⏱ โบนัสเต็ม!' : `⏱ +${bt} วิ`, { color: PAL.green, size: 20 }); if (tip >= 15) fx.text(x, fy[4], 'ทิปเพียบ! 💸', { color: PAL.green, size: 18 });
    leaving.push({ i, face: s.face, t: 0, happy: true }); slots[i] = null; cup = []; hud();
  }
  const clear = () => { if (cup.length) fx.burst(L.CUP_X, L.clearY, { n: 10, colors: cup.map(k => ingOf(k)[2]), speed: 120, grav: 700, size: 4, life: .5 }); cup = []; };
  api.onKey(e => { const n = +e.key; if (n >= 1 && n <= ING.length) { e.preventDefault(); add(ING[n - 1][0]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); serve(null); } else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clear(); } });
  cv.addEventListener('pointerdown', e => { const p = at(e); const i = L.slot.findIndex(x => Math.abs(p.x - x) < L.sw && p.y < L.hitY); if (i >= 0 && slots[i]) serve(i); });
  const phone = g2phone(root, 'barista');
  if (!phone) g2pad(root, [...ING.map(([k, n]) => [`${pxImg(k, 22)}<small> ${n}</small>`, () => add(k)]), ['🗑️ เท', clear], ['🛎️ เสิร์ฟ', () => serve(null)]]);
  else {
    // two rows at the bottom: four ingredients, then two more + pour away + serve (serve sits on the thumb side)
    const ib = ([k, n]) => [`${pxImg(k, 24)}<small>${n}</small>`, n, () => add(k), { cls: 'ing' }];
    g2deck(root, { rows: [ING.slice(0, 4).map(ib), [...ING.slice(4).map(ib), ['🗑️<small>เท</small>', 'เททิ้ง', clear, { cls: 'ing' }], ['🛎️<small>เสิร์ฟ</small>', 'เสิร์ฟ', () => serve(null), { cls: 'ing primary' }]]] });
  }
  // static art: the wall with what stands against it (back), the counter and the shelf with their things (front)
  function drawBack(c) {
    officeBG(c, L.W, L.H, L.COUNTER, { wall: 'wall_pink', windows: L.win });
    for (const [n, x, k] of L.back) drawPixAt(c, n, x, L.COUNTER, k);
  }
  function drawFront(c) {
    const { W, H, COUNTER } = L;
    c.fillStyle = PAL.ink; c.fillRect(0, COUNTER - 2, W, 24); c.fillStyle = '#d9a066'; c.fillRect(0, COUNTER, W, 18);
    c.fillStyle = '#9b6a45'; c.fillRect(0, COUNTER + 22, W, H - COUNTER - 22);
    c.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < W; x += L.plank) c.fillRect(x, COUNTER + 22, 2, H);
    if (L.shelf) { c.fillStyle = PAL.ink; c.fillRect(0, L.cupBot, W, 22); c.fillStyle = '#d9a066'; c.fillRect(0, L.cupBot + 2, W, 18); }
    for (const [n, x, y, k] of L.front) drawPixAt(c, n, x, y, k);
  }
  function buildLayers() {
    if (!artReady(ART)) return null;
    const back = layerCanvas(L.W, L.H, G.dpr), front = layerCanvas(L.W, L.H - L.COUNTER + FY, G.dpr);   // FY: room for things on the counter
    drawBack(back.g); front.g.translate(0, -(L.COUNTER - FY)); drawFront(front.g);
    return { back: back.c, front: front.c };
  }
  const person = (who, x, by, o, anim = 'idle_anim', dir = 'down') => drawChar(ctx, who, anim, dir, t, x, by, L.pk, o);
  function draw() {
    const { W, H, COUNTER } = L;
    if (L.port && !layers) layers = buildLayers();
    fx.pre(ctx);
    if (layers) ctx.drawImage(layers.back, 0, 0, W, H); else drawBack(ctx);
    slots.forEach((s, i) => {
      if (!s) return; const x = L.slot[i], f = s.pat / s.max, hop = (1 - s.in) * L.hop, angry = f < .3;
      const jit = angry ? (rnd() - .5) * 4 : 0, bob = Math.sin(t * 4 + i) * .025;
      person(s.face, x + jit, L.pby + hop, { sy: 1 + bob, sx: 1 - bob });
      ctx.save(); ctx.translate(x, L.bubY); const bs = s.in < 1 ? .6 + s.in * .4 : 1; ctx.scale(bs, bs);
      rrect(ctx, L.bx, L.by, L.bw, L.bh, 14, '#fff', PAL.ink);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-L.tw, L.ty); ctx.lineTo(0, L.tt); ctx.lineTo(L.tw, L.ty); ctx.fill();
      txt(ctx, s.m.n, 0, L.ny, L.ns, PAL.ink, 'center', 700);
      const n = s.m.r.length; s.m.r.forEach((k, j) => drawPixAt(ctx, pxa(k), (j - (n - 1) / 2) * L.is, L.iy, L.ik));
      rrect(ctx, L.rx, L.ry, L.rw, L.rh, 4, '#eee'); rrect(ctx, L.rx, L.ry, Math.max(4, L.rw * f), L.rh, 4, angry ? (Math.floor(t * 8) % 2 ? PAL.red : '#ff9b9b') : PAL.green);
      ctx.restore();
      if (angry) { if (L.port) drawPixAt(ctx, pxa('mad'), x + L.mad[0], L.mad[1], 3); else txt(ctx, '💢', x + L.mad[0], L.mad[1], 22); }
    });
    for (const l of leaving) person(l.face, L.slot[l.i] + l.t * L.walk, L.pby, { alpha: 1 - l.t }, 'run', 'right');
    // counter + machines
    if (layers) ctx.drawImage(layers.front, 0, COUNTER - FY, W, H - COUNTER + FY); else drawFront(ctx);
    // the cup: liquid layers stack up, wobble when something is added
    const cx = L.CUP_X, top = L.cupTop, bot = L.cupBot, cw = L.cw, lh = L.lh, s = L.ice, sq = Math.sin(wob * 20) * wob * .06;
    ctx.save(); ctx.translate(cx, bot); ctx.scale(1 + sq, 1 - sq); ctx.translate(-cx, -bot);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(cx - cw / 2, top, cw, bot - top);
    let ly = bot - 4;
    cup.forEach((k, j) => {
      const c = ingOf(k)[2], wave = j === cup.length - 1 ? Math.sin(t * 12) * 2 * wob : 0;
      ctx.fillStyle = c; ctx.fillRect(cx - cw / 2 + 4, ly - lh + wave, cw - 8, lh - wave);
      if (k === 'ice') { ctx.fillStyle = '#fff'; ctx.fillRect(cx - 24 * s, ly - 16 * s, 12 * s, 10 * s); ctx.fillRect(cx + 6 * s, ly - 18 * s, 12 * s, 10 * s); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1; ctx.strokeRect(cx - 24 * s, ly - 16 * s, 12 * s, 10 * s); ctx.strokeRect(cx + 6 * s, ly - 18 * s, 12 * s, 10 * s); }
      ly -= lh;
    });
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 3; ctx.strokeRect(cx - cw / 2, top, cw, bot - top);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(cx - cw / 2 + 6 * s, top + 8, 5 * s, bot - top - 16);
    ctx.restore();
    if (!cup.length) txt(ctx, 'แก้วว่าง', cx, L.emptyY, L.port ? 15 : 13, PAL.muted);
    fx.post(ctx, W, H);
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt; wob = Math.max(0, wob - dt * 2.5);
    for (const s of slots) if (s) s.in = Math.min(1, s.in + dt * 4);
    for (const l of leaving) l.t += dt * 1.6; leaving = leaving.filter(l => l.t < 1);
    if (running && d) {
      el += d; time -= d; next -= d;
      if (next <= 0) { spawn(); next = Math.max(2.2, 5.5 - el * .04); }
      slots.forEach((s, i) => { if (s) { s.pat -= d; if (s.pat <= 0) { leaving.push({ i, face: s.face, t: 0 }); slots[i] = null; hearts--; api.sfx('bad');
        fx.text(L.slot[i], L.fy[1], '😤 รอไม่ไหว!', { color: PAL.red, size: 22 }); fx.shake(6, .25); } } });
      if (time <= 0 || hearts <= 0) { time = Math.max(0, time); hud(); end(); } else hud();
    }
    draw();
  });
  // portrait phone: the canvas takes the play area; back to the 760 x 420 scene when the screen turns sideways
  if (phone) phoneRelayout(root, () => {
    const p = phonePortrait(); root.classList.toggle('g2p', p);
    if (!p) { if (L !== LD) { L = LD; layers = null; G.size(); draw(); } return; }
    const b = fitBox(G.box); if (L.port && L.W === b.w && L.H === b.h) return;
    G.size(b.w, b.h, b.x, b.y); L = portrait(b.w, b.h); layers = null; draw();
  });
  hud(); draw();
  api.intro({ how: `<p>☕ พักเที่ยงคิวยาว! ผสมเครื่องดื่มตามที่ลูกค้าสั่งในบับเบิล แล้วเสิร์ฟให้ทันก่อนหลอดความอดทนหมด</p>
      ${phone ? `<p>👆 แตะปุ่มวัตถุดิบด้านล่าง (${ING.map(([k]) => pxImg(k, 18)).join(' ')}) แล้วกด <b>เสิร์ฟ</b> หรือแตะลูกค้า · <b>เท</b> = เทแก้วทิ้ง</p>`
        : `<p>⌨️ ปุ่ม <b>1–6</b> ใส่วัตถุดิบ (${ING.map(([k]) => pxImg(k, 18)).join(' ')}) · <b>Enter</b> เสิร์ฟ · <b>Backspace</b> เทแก้วทิ้ง — หรือแตะปุ่มใต้จอ / แตะลูกค้า</p>`}
      <p>⏱ เสิร์ฟถูก +3 วิ · เสิร์ฟไวจนได้ทิปเพียบ +5 วิ (รวมได้สูงสุด +40 วิ)</p>
      <p>⭐ ลูกค้าเดินหนี 3 คน หรือเวลาหมด = จบ</p>`,
    buttons: [{ label: '☕ เปิดร้าน!', primary: true, go() { running = true; spawn(); } }] });
}

/* =================================================================
   Paper Toss — flick a paper ball into the bin, mind the fan
================================================================= */
function tossGame(root, api) {
  const W = 720, H = 420, G = 900, THROWS = 10, R = 11, START = { x: 100, y: 300 };
  let FLOOR = 372;
  root.innerHTML = `<div class="hud"><span>🗑️ ลงถัง <b data-k="mk">0</b>/<b data-k="th">0</b></span><span>เหลือ <b data-k="left">10</b> ลูก</span><span>⭐ <b data-k="sc">0</b></span><span data-k="st" class="muted"></span><span class="muted g2tip">ลากลูกบอลถอยหลังแล้วปล่อย · หรือ ←→ เล็ง + กด Space ค้างเพื่อออกแรง</span></div>`;
  const { cv, ctx, at, L } = g2view(root, W, H, { min: 187, max: 300, h: 160 }, 'ลงถังติดกันได้คะแนนเพิ่ม · ลงกลางถังไม่โดนขอบ ได้ลูกฟรี'), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let ball = null, drag = null, wind = 0, throws = 0, made = 0, score = 0, streak = 0, running = false, over = false, binX = 520, aim = -.9, power = 0, charging = false, t = 0, rimHit = false; let bonusT = 0;
  let fanA = 0, binSq = 0, throwSq = 0, trail = [], streaks = [];
  const BIN_K = 6, who = pick(rnd, MI_PEOPLE);
  let BIN_W = 9 * BIN_K, BIN_H = 13 * BIN_K;
  // layout: the wide scene's numbers, or the portrait room from layout(). Physics always runs in world units with the
  // same gravity, wind and pull; VS = screen px per world unit (1 in the wide scene).
  let P = null, VS = 1, WW = W, BIN_B = FLOOR, binBase = 520, binA = 90, LF = 5.2, PULL = 1.25, stY0 = 90, stYR = 230;
  const shelf = { x0: 0, x1: 0 };
  const bg = g2layer(L, ['wall_beige', 'floor_wood', 'window_big', 'bookshelf', 'desk_drawer', 'plant_pot'], paintBG);
  // portrait (phone held upright): the bin sits on a wall shelf in the upper third, the fan blows from a side and you
  // pull the shot back from the bottom, so the arc uses the full height. The bin is 1.5x wider there: a high lob is
  // a smaller target than the wide scene's flat throw, and this keeps the target the same size in pull space
  function layout() {
    if (!L.portrait) { P = null; VS = 1; WW = W; FLOOR = 372; START.x = 100; START.y = 300; BIN_W = 54; BIN_H = 78; BIN_B = FLOOR;
      binBase = 520; binA = 90; LF = 5.2; PULL = 1.25; stY0 = 90; stYR = 230; }
    else {
      // frame: 3 world units per art pixel, so the room is 480 units tall like the portrait one and the bin, pull and arc
      // keep their sizes; the old portrait fill fitted 300 x 480 units to the screen
      VS = L.frame ? L.k / 3 : Math.min(L.W / 300, L.H / 480); WW = L.W / VS; const HW = L.H / VS, m = L.left ? -1 : 1, kb = Math.round(9 * VS);
      BIN_W = 9 * kb / VS; BIN_H = 13 * kb / VS;
      FLOOR = HW - 18; START.x = WW / 2 - 63 * m; START.y = FLOOR - 72; BIN_B = Math.max(40, START.y - 210) + BIN_H;
      binBase = WW / 2 + 63 * m; binA = Math.max(0, Math.min(90, WW / 2 - 63 - BIN_W / 2 - 8));
      shelf.x0 = Math.max(4, binBase - binA - BIN_W / 2 - 12); shelf.x1 = Math.min(WW - 4, binBase + binA + BIN_W / 2 + 12); aim = m > 0 ? -1.25 : 1.25 - Math.PI;
      LF = 6.2; PULL = 1.4; stY0 = BIN_B - BIN_H - 40; stYR = START.y - stY0;
      P = { m, kb, kball: Math.round(3 * VS) };
    }
    if (throws < 5) binX = binBase;
    // a ball waiting in the fork moves to the new start; one in flight keeps flying (physics is in world units)
    if (ball && !ball.fly) { ball.x = START.x; ball.y = START.y; }
    drag = null; bg.reset();
  }
  L.fn = layout;
  function newThrow() { wind = throws < 2 ? 0 : (rnd() * 2 - 1) * Math.min(1, .3 + throws * .1); ball = { x: START.x, y: START.y, vx: 0, vy: 0, fly: false, rot: 0 }; rimHit = false; trail = []; }
  function hud() { q('mk').textContent = made; q('th').textContent = throws; q('left') && (q('left').textContent = THROWS + bonusT - throws); q('sc').textContent = fmt(score); q('st').textContent = streak >= 2 ? `🔥 ติดกัน ${streak}` : ''; }
  function launch(vx, vy) { if (!running || !ball || ball.fly || api.paused) return; ball.vx = vx; ball.vy = vy; ball.fly = true; throws++; throwSq = 1; api.sfx('tick'); hud(); }
  const S = v => v * VS;
  function result(ok, swish) {
    const top = BIN_B - BIN_H;
    if (ok) {
      made++; streak++; const p = 100 + (swish ? 50 : 0) + (streak - 1) * 25; score += p; binSq = 1;
      fx.burst(S(binX), S(top), { n: swish ? 30 : 18, colors: CONFETTI, speed: 320, grav: 600, size: 6, shape: 'paper', life: 1, dir: -Math.PI / 2, spread: 1.6 });
      if (swish && bonusT < 5) { bonusT++; fx.text(S(binX), S(top) - 64, '🎁 ลูกฟรี +1', { color: PAL.green, size: 22, life: 1.2 }); }
      if (swish) { fx.flash(PAL.yel, .22); fx.hitstop(.08); fx.shake(7, .25); fx.burst(S(binX), S(top) - 10, { n: 10, colors: [PAL.yel, '#fff'], speed: 240, grav: 0, size: 8, shape: 'star', life: .6 }); }
      else fx.shake(4, .15);
      fx.text(S(binX), S(top) - 30, swish ? `SWISH! +${p}` : `ลงถัง +${p}`, { color: swish ? PAL.yel : PAL.green, size: swish ? 32 : 26, life: 1.1 });
      if (streak >= 3) fx.text(P ? L.W / 2 : W / 2, P ? L.H * .55 : 110, `🔥 ติดกัน ${streak}!`, { color: PAL.orange, size: 24, life: 1.1 });
      api.sfx(swish ? 'level' : 'good');
    } else {
      streak = 0; fx.text(S(ball.x < 0 || ball.x > WW ? WW / 2 : ball.x), S(FLOOR) - 40, 'พลาด!', { color: '#d9d2e6', size: 24 }); api.sfx('bad'); fx.shake(3, .12);
      if (ball.y >= FLOOR - R - 2) fx.burst(S(ball.x), S(FLOOR), { n: 8, colors: ['#fffdf6', '#d9dde3'], speed: 140, grav: 500, size: 4, life: .4, spread: Math.PI, dir: -Math.PI / 2 });
    }
    hud(); ball = null;
    if (throws >= THROWS + bonusT) { over = true; running = false; api.after(1.2, () => api.end(score, `ลงถัง ${made}/${throws}`, false, { made })); } else api.after(.9, newThrow);
  }
  cv.addEventListener('pointerdown', e => { if (P || !ball || ball.fly) return; const p = at(e); if (Math.hypot(p.x - ball.x, p.y - ball.y) < 60) { drag = p; cv.setPointerCapture(e.pointerId); } });
  cv.addEventListener('pointermove', e => { if (drag) drag = at(e); });
  const release = () => { if (!drag || !ball) { drag = null; return; } const dx = START.x - drag.x, dy = START.y - drag.y, l = Math.min(150, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); drag = null;
    if (l > 15) launch(Math.cos(a) * l * LF, Math.sin(a) * l * LF); };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', () => { drag = null; });
  // phone: a slingshot pad in the lower part of the screen — thumb down anywhere on it, pull back, let go.
  // The pull (screen px x 1.25, max 150) is the same vector as dragging the ball itself.
  const phone = g2phone(root, 'toss', true);
  if (phone) {
    const zone = document.createElement('div'); zone.className = 'g2zone toss-pad';
    zone.innerHTML = '<span>' + onTouch('ลากนิ้วถอยหลังแล้วปล่อย = ปา', 'ลากเมาส์ถอยหลังแล้วปล่อย = ปา · หรือ ← → เล็ง แล้วกด Space ค้าง') + '</span><i class="o"></i><i class="ln"></i><i class="k"></i>'; root.appendChild(zone);
    const [o, ln, kn] = zone.querySelectorAll('i'); let pull = null;
    const show = (on, x0, y0, x1, y1) => { zone.classList.toggle('on', on); if (!on) return;
      o.style.left = x0 + 'px'; o.style.top = y0 + 'px'; kn.style.left = x1 + 'px'; kn.style.top = y1 + 'px';
      ln.style.left = x0 + 'px'; ln.style.top = y0 + 'px'; ln.style.width = Math.hypot(x1 - x0, y1 - y0) + 'px'; ln.style.transform = `rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`; };
    const toDrag = e => { const k = PULL, dx = (e.clientX - pull.x) * k, dy = (e.clientY - pull.y) * k, l = Math.hypot(dx, dy), m = l > 150 ? 150 / l : 1;
      return { x: START.x + dx * m, y: START.y + dy * m }; };
    const grab = e => { e.preventDefault(); if (!running || !ball || ball.fly) return;
      if (pull && pull.id !== e.pointerId && zone.hasPointerCapture && zone.hasPointerCapture(pull.id)) return;   // a second finger; a lost pull starts over
      const r = zone.getBoundingClientRect();
      pull = { id: e.pointerId, x: e.clientX, y: e.clientY, r }; try { zone.setPointerCapture(e.pointerId); } catch (er) {} drag = { x: START.x, y: START.y };
      show(true, e.clientX - r.left, e.clientY - r.top, e.clientX - r.left, e.clientY - r.top); };
    zone.addEventListener('pointerdown', grab);
    // portrait: the thumb can also start anywhere in the lower half of the screen (the pad is the deck below the room)
    root.addEventListener('pointerdown', e => { if (!P || e.target.closest('.toss-pad') || !freePress(e)) return;
      const r = root.getBoundingClientRect(); if (e.clientY > r.top + r.height * .5) grab(e); });
    zone.addEventListener('pointermove', e => { if (!pull || e.pointerId !== pull.id) return; drag = toDrag(e); const r = pull.r;
      show(true, pull.x - r.left, pull.y - r.top, e.clientX - r.left, e.clientY - r.top); });
    zone.addEventListener('pointerup', e => { if (!pull || e.pointerId !== pull.id) return; drag = toDrag(e); pull = null; show(false); release(); });
    zone.addEventListener('pointercancel', () => { pull = null; drag = null; show(false); });
    zone.addEventListener('lostpointercapture', e => { if (pull && e.pointerId === pull.id) { pull = null; drag = null; show(false); } });
  }
  api.onKey(e => { if (e.key === 'ArrowLeft') { aim = Math.max(-1.45, aim - .05); e.preventDefault(); } else if (e.key === 'ArrowRight') { aim = Math.min(-.2, aim + .05); e.preventDefault(); }
    else if (e.key === ' ' && !e.repeat && ball && !ball.fly) { charging = true; power = 0; e.preventDefault(); } });
  const up = e => { if (e.key !== ' ' || !charging) return; charging = false; const l = 30 + power * 120; launch(Math.cos(aim) * l * LF, Math.sin(aim) * l * LF); };
  addEventListener('keyup', up);
  function draw() {
    if (P) return drawP();
    fx.pre(ctx);
    officeBG(ctx, W, H, FLOOR, { wall: 'wall_beige', windows: [['window_big', 285, 40, 4]] });
    drawPixAt(ctx, 'bookshelf', 672, FLOOR, 3); drawPixAt(ctx, 'plant_pot', 210, FLOOR, 3); drawPixAt(ctx, 'board_calendar', 560, 150, 3);
    // wind: streaks drift across the room, the fan spins with the strength
    ctx.fillStyle = 'rgba(58,134,255,.28)'; for (const s of streaks) ctx.fillRect(s.x, s.y, s.l, 2);
    const fx0 = 440, fy = 50; ctx.fillStyle = PAL.ink; ctx.fillRect(fx0 - 3, fy, 6, 26); ctx.fillRect(fx0 - 16, fy + 24, 32, 6);
    ctx.save(); ctx.translate(fx0, fy); ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke();
    ctx.rotate(fanA); ctx.fillStyle = '#4cc3ff'; for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(0, -10, 6, 10, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.restore();
    const wl = Math.round(Math.abs(wind) * 5); txt(ctx, wind === 0 ? 'ลม: นิ่ง' : `ลม: ${wind > 0 ? '→'.repeat(wl || 1) : '←'.repeat(wl || 1)}`, 472, 50, 16, PAL.blue, 'left', 700);
    // bin (pixel sprite) with a happy squash when something lands in it
    drawPixAt(ctx, 'bin', binX, FLOOR, BIN_K, { sx: 1 + binSq * .15, sy: 1 - binSq * .15 });
    // thrower at a desk
    drawChar(ctx, who, 'idle_anim', 'right', t, 62, FLOOR, 3.4, { sx: 1 + throwSq * .12, sy: 1 - throwSq * .1 });
    drawPixAt(ctx, 'desk_drawer', 112, FLOOR, 3);
    // aim guide
    if (ball && !ball.fly) {
      let vx, vy; if (drag) { const dx = START.x - drag.x, dy = START.y - drag.y, l = Math.min(150, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); vx = Math.cos(a) * l * 5.2; vy = Math.sin(a) * l * 5.2; }
      else { const l = 30 + (charging ? power : .5) * 120; vx = Math.cos(aim) * l * 5.2; vy = Math.sin(aim) * l * 5.2; }
      ctx.fillStyle = 'rgba(43,33,64,.35)'; let x = ball.x, y = ball.y, wx = vx, wy = vy;
      for (let i = 0; i < 9; i++) { for (let k = 0; k < 4; k++) { wx += wind * 220 * .02; wy += G * .02; x += wx * .02; y += wy * .02; } ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); }
      if (charging) { rrect(ctx, 30, 200, 14, 100, 4, '#fff', PAL.ink); rrect(ctx, 31, 299 - power * 98, 12, power * 98, 3, power > .85 ? PAL.red : PAL.pink); }
    }
    for (const [i, p] of trail.entries()) { ctx.globalAlpha = i / trail.length * .4; ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8); } ctx.globalAlpha = 1;
    if (ball) { const j = charging ? (rnd() - .5) * power * 4 : 0; drawPixAt(ctx, pxa('ball'), ball.x + j, ball.y + 10.5, 3, { rot: ball.rot }); }
    fx.post(ctx, W, H);
  }
  // ---- portrait scene
  function paintBG(g) {
    const w = L.W, h = L.H, k = L.k, m = P.m, fy = Math.round(S(FLOOR)), side = m > 0 ? .25 : .75;
    officeBG(g, w, h, fy, { wall: 'wall_beige', k, windows: [['window_big', Math.round(w * side) + 100, Math.round(h * .08), k]] });
    drawPixAt(g, 'bookshelf', m > 0 ? w - 4 - 16 * k : 4 + 16 * k, fy, k);
    drawPixAt(g, 'plant_pot', Math.round(w / 2 + 10 * m), fy, k);
    drawPixAt(g, 'desk_drawer', Math.round(S(START.x)), fy, k);
    // the wall shelf the bin slides along, on two brackets
    const x0 = Math.round(S(Math.min(shelf.x0, shelf.x1))), x1 = Math.round(S(Math.max(shelf.x0, shelf.x1))), y0 = Math.round(S(BIN_B));
    g.fillStyle = PAL.ink; g.fillRect(x0 + 10, y0, 6, 22); g.fillRect(x1 - 16, y0, 6, 22);
    rrect(g, x0, y0, x1 - x0, Math.round(S(8)) + 2, 2, '#a2784b', PAL.ink);
    // the slingshot fork on the desk, under the ball
    const sx = Math.round(S(START.x)), sy = Math.round(S(START.y)), dt = fy - 21 * k;
    g.fillStyle = PAL.ink; g.fillRect(sx - 2, sy + 22, 4, dt - sy - 22); g.fillRect(sx - 16, sy + 20, 32, 4); g.fillRect(sx - 16, sy + 4, 4, 18); g.fillRect(sx + 12, sy + 4, 4, 18);
  }
  function drawP() {
    const w = L.W, h = L.H, k = L.k, { m, kb, kball } = P;
    fx.pre(ctx);
    bg.draw(ctx);
    ctx.fillStyle = 'rgba(58,134,255,.28)'; for (const st of streaks) ctx.fillRect(Math.round(S(st.x)), Math.round(S(st.y)), Math.round(S(st.l)), 2);
    drawPixAt(ctx, 'bin', Math.round(S(binX)), Math.round(S(BIN_B)), kb, { sx: 1 + binSq * .15, sy: 1 - binSq * .15 });
    // the fan sits on the side the wind comes from, on a wall bracket
    const fl = wind >= 0, fx0 = fl ? 34 : w - 34, fyy = Math.round(S(BIN_B - BIN_H)) - 40;
    ctx.fillStyle = PAL.ink; ctx.fillRect(fl ? 0 : fx0, fyy - 3, fl ? fx0 : w - fx0, 6);
    ctx.save(); ctx.translate(fx0, fyy); ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke();
    ctx.rotate(fanA); ctx.fillStyle = '#4cc3ff'; for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ctx.beginPath(); ctx.ellipse(0, -10, 6, 10, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.restore();
    const wl = Math.round(Math.abs(wind) * 5);
    txt(ctx, wind === 0 ? 'ลม: นิ่ง' : `ลม: ${wind > 0 ? '→'.repeat(wl || 1) : '←'.repeat(wl || 1)}`, fl ? fx0 + 30 : fx0 - 30, fyy, 16, PAL.blue, fl ? 'left' : 'right', 700);
    drawChar(ctx, who, 'idle_anim', m > 0 ? 'right' : 'left', t, Math.round(S(START.x - 46 * m)), Math.round(S(FLOOR)), k, { sx: 1 + throwSq * .12, sy: 1 - throwSq * .1 });
    // aim guide, and the ball pulled back in the fork with the band while you aim
    let bx = ball ? ball.x : 0, by = ball ? ball.y : 0;
    if (ball && !ball.fly) {
      let vx, vy; if (drag) { const dx = START.x - drag.x, dy = START.y - drag.y, l = Math.min(150, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); vx = Math.cos(a) * l * LF; vy = Math.sin(a) * l * LF;
        const q = l > 0 ? l * .22 / Math.hypot(dx, dy) : 0; bx = START.x - dx * q; by = START.y - dy * q; }
      else { const l = 30 + (charging ? power : .5) * 120; vx = Math.cos(aim) * l * LF; vy = Math.sin(aim) * l * LF; }
      ctx.fillStyle = 'rgba(43,33,64,.35)'; let x = START.x, y = START.y, wx = vx, wy = vy;
      for (let i = 0; i < 9; i++) { for (let j = 0; j < 4; j++) { wx += wind * 220 * .02; wy += G * .02; x += wx * .02; y += wy * .02; } ctx.fillRect(Math.round(S(x)) - 4, Math.round(S(y)) - 4, 8, 8); }
      if (drag) { const sx = Math.round(S(START.x)), sy = Math.round(S(START.y)) + 6; ctx.strokeStyle = '#b3203a'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(sx - 14, sy); ctx.lineTo(S(bx), S(by)); ctx.lineTo(sx + 14, sy); ctx.stroke(); }
    }
    for (let i = 0; i < trail.length; i++) { const p = trail[i]; ctx.globalAlpha = i / trail.length * .4; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(S(p.x)) - 5, Math.round(S(p.y)) - 5, 10, 10); } ctx.globalAlpha = 1;
    if (ball) drawPixAt(ctx, pxa('ball'), Math.round(S(bx)), Math.round(S(by) + 3.5 * kball), kball, { rot: ball.rot });
    // Space held (PC): the power meter beside the fork
    if (charging) { const sx = Math.round(S(START.x)) - 40 * m, sy = Math.round(S(START.y)) - 30, bh = 60;
      rrect(ctx, sx - 7, sy - bh / 2, 14, bh, 4, '#fff', PAL.ink); rrect(ctx, sx - 6, sy + bh / 2 - 1 - power * (bh - 2), 12, power * (bh - 2), 3, power > .85 ? PAL.red : PAL.pink); }
    // the streak lives here instead of the top bar, which must stay one line
    if (streak >= 2) txt(ctx, `🔥 ติดกัน ${streak}`, m > 0 ? w - 12 : 12, 22, 16, PAL.orange, m > 0 ? 'right' : 'left', 800);
    fx.post(ctx, w, h);
  }
  // the bin's sides and the shelf under it are solid in the portrait room (a lob from below bounces off)
  function solid(x, y, w, h) {
    const cx = Math.max(x, Math.min(ball.x, x + w)), cy = Math.max(y, Math.min(ball.y, y + h)), dx = ball.x - cx, dy = ball.y - cy, dd = dx * dx + dy * dy;
    if (dd >= R * R) return false; const d = Math.sqrt(dd), nx = d ? dx / d : 0, ny = d ? dy / d : 1;
    ball.x = cx + nx * R; ball.y = cy + ny * R; const dot = ball.vx * nx + ball.vy * ny; if (dot < 0) { ball.vx -= 1.4 * dot * nx; ball.vy -= 1.4 * dot * ny; }
    rimHit = true; return true;
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt;
    fanA += dt * (1 + Math.abs(wind) * 18) * Math.sign(wind || 1); binSq = Math.max(0, binSq - dt * 4); throwSq = Math.max(0, throwSq - dt * 5);
    if (Math.abs(wind) > .05 && rnd() < Math.abs(wind) * dt * 30) streaks.push({ x: wind > 0 ? -60 : WW, y: stY0 + rnd() * stYR, l: 30 + rnd() * 50 });
    for (const s of streaks) s.x += wind * 420 * dt; for (let i = streaks.length - 1; i >= 0; i--) if (!(streaks[i].x > -80 && streaks[i].x < WW + 10)) streaks.splice(i, 1);
    if (running && throws >= 5) binX = binBase + Math.sin(t * .9) * binA;   // the bin starts moving halfway through
    if (charging) power = Math.min(1, power + dt * .8);
    if (ball && ball.fly && d) {
      trail.push({ x: ball.x, y: ball.y }); if (trail.length > 8) trail.shift(); ball.rot += ball.vx * d / R;
      for (let k = 0; k < 4; k++) {
        const s = d / 4, py = ball.y;
        ball.vx += wind * 220 * s; ball.vy += G * s; ball.x += ball.vx * s; ball.y += ball.vy * s;
        const bx = binX - BIN_W / 2, top = BIN_B - BIN_H;
        for (const rx of [bx, bx + BIN_W]) { const dx = ball.x - rx, dy = ball.y - top, dd = Math.hypot(dx, dy);
          if (dd < R + 3) { rimHit = true; const nx = dx / dd, ny = dy / dd, dot = ball.vx * nx + ball.vy * ny; if (dot < 0) { ball.vx -= 1.6 * dot * nx; ball.vy -= 1.6 * dot * ny; } ball.x = rx + nx * (R + 3); ball.y = top + ny * (R + 3);
            api.sfx('tick'); fx.burst(rx, top, { n: 5, colors: [PAL.yel, '#fff'], speed: 160, grav: 0, size: 4, life: .25 }); fx.shake(2, .08); } }
        if (py < top && ball.y >= top && ball.vy > 0 && ball.x > bx + 4 && ball.x < bx + BIN_W - 4) { result(true, !rimHit); break; }
        if (P) { solid(bx, top + R + 2, BIN_W, BIN_H - R - 2); solid(Math.min(shelf.x0, shelf.x1), BIN_B, Math.abs(shelf.x1 - shelf.x0), 8); }
        if (ball.y > FLOOR - R || ball.x > WW + 40 || ball.x < -40) { result(false); break; }
      }
    }
    draw();
  });
  layout(); hud(); draw();
  if (window.__TEST__) window.__toss = { get: () => ({ START, binX, BIN_B, BIN_W, BIN_H, wind, WW, FLOOR, VS, PULL, LF, made, throws, score, fly: !!(ball && ball.fly) }) };
  api.intro({ how: `<p>🗑️ ปากระดาษก้อนลงถังให้ได้มากที่สุดใน ${THROWS} ลูก · <b>SWISH</b> (ลงไม่โดนขอบ) ได้ลูกฟรี +1 (สูงสุด 5 ลูก)</p>
      ${phoneOn() ? '<p>👆 วางนิ้วบน<b>แผ่นด้านล่าง</b> ลากถอยหลังเหมือนหนังสติ๊กแล้วปล่อย (หรือลากที่ลูกบอลก็ได้) · ลากยาว = แรงขึ้น</p>'
        : P ? '<p>🖱️ กดเมาส์บน<b>แผ่นด้านล่าง</b> ลากถอยหลังเหมือนหนังสติ๊กแล้วปล่อย · หรือ <b>← →</b> เล็ง แล้ว <b>กด Space ค้าง</b> เพื่อออกแรง</p>'
        : '<p>🖱️ <b>ลากลูกบอลถอยหลัง</b> เหมือนหนังสติ๊กแล้วปล่อย · หรือ <b>← →</b> เล็ง แล้ว <b>กด Space ค้าง</b> เพื่อออกแรง</p>'}
      <p>🌬️ ดูลมจากพัดลม${P ? 'ด้านข้าง' : 'ด้านบน'}ด้วย · ลงถังไม่โดนขอบ = <b>SWISH</b> +50 · ครึ่งหลังถังจะเลื่อนไปมา</p>`,
    buttons: [{ label: '🗑️ เริ่มปา!', primary: true, go() { running = true; newThrow(); } }] });
  return { destroy() { removeEventListener('keyup', up); } };
}

/* =================================================================
   แอบเล่นมือถือ — hold to slack off on your phone, let go before the boss turns around
================================================================= */
function slackGame(root, api) {
  const W = 720, H = 400, BOSS_Y = 236, ME_X = 360;
  root.innerHTML = `<div class="hud"><span data-k="hp"></span><span>⭐ <b data-k="sc">0</b></span><span>⏱ <b data-k="t">0</b> วิ</span><span data-k="mul" class="muted"></span>
    <span class="muted g2tip">กด Space / แตะจอค้าง = แอบเล่นมือถือ · ปล่อย = ทำงาน</span></div>`;
  const { cv, ctx, L } = g2view(root, W, H, { min: 187, max: 300, h: 180 }, 'ปล่อยมือให้ทันก่อนหัวหน้าหันมา · ระวังเพื่อนขี้ฟ้องเดินผ่าน'), q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let who = store.get('runWho', 'amelia'); if (!MI_PEOPLE.includes(who) || who === 'bob') who = 'amelia';
  let holding = false, slack = false, streak = 0, score = 0, strikes = 0, time = 0, level = 1, bored = 0, doze = 0, close = 0, running = false, over = false, t = 0, scold = 0, likeT = 0;
  // the boss patrols the back of the room; 'warn' is the fair tell before 'look'
  const boss = { x: 140, dir: 1, st: 'walk', t: 2.5, fake: false };
  // the snitch coworker (from level 2): a ⚠️ warning first, then she crosses behind you; phone out inside the red zone = reported
  const mate = { x: -60, on: false, cool: 6, warn: 0, met: false, passed: false, who: ['alex', 'amelia', 'adam'].find(c => c !== who) }, ZONE = 60;
  // portrait (phone held upright): the boss walks along the back wall at the top, the snitch crosses the middle,
  // you sit at your desk in the lower half. Every rule runs in the wide scene's units (boss.x, mate.x, ME_X and ZONE),
  // only the drawing maps them, so the timings, the tell and the snitch's danger window are exactly the same.
  let P = null;
  const bg = g2layer(L, ['wall_mint', 'floor_herring', 'window_big', 'noticeboard', 'plant_pot', 'shop_shelf', 'pc_desk', 'desk_pair'], paintBG);
  function layout() {
    if (!L.portrait) { P = null; return; }
    const w = L.W, h = L.H, k = L.k, cx = Math.round(w / 2), floorY = Math.round(h * .3), meFeet = h - 4;
    P = { cx, k, floorY, bossFeet: floorY + 6 * k, mateFeet: meFeet - 64 * k + 4 * k, meFeet, deskY: meFeet - 29 * k,
      sb: (cx - 44) / 270, sm: (cx + 34) / 400, bubX: cx + 20 * k, bubY: meFeet - 58 * k };
    bg.reset();
  }
  L.fn = layout; layout();
  const BX = x => P ? Math.round(P.cx + (x - 360) * P.sb) : x, MX = x => P ? Math.round(P.cx + (x - ME_X) * P.sm) : x;
  const bossTxtX = () => P ? Math.max(90, Math.min(L.W - 90, BX(boss.x))) : boss.x;
  const meX = () => P ? P.cx : ME_X, meTxtY = y => P ? P.meFeet - 74 * P.k + (y - 200) : y;
  const lookDur = () => 1.1 + rnd() * (1 + level * .25), warnDur = () => Math.max(.28, .8 - level * .06), speed = () => 60 + level * 14;
  function hud() { q('hp').textContent = '❤️'.repeat(3 - strikes) + '🖤'.repeat(strikes); q('sc').textContent = fmt(Math.floor(score)); q('t').textContent = Math.floor(time);
    const m = mult(); q('mul').textContent = slack && m > 1 ? `📱 x${m}` : bored > 70 ? '😪 ง่วงแล้ว…' : ''; }
  const mult = () => Math.min(5, 1 + Math.floor(streak / 2) * .5);
  function caught(by) {
    strikes++; slack = false; streak = 0; bored = 0; doze = 0; scold = 1.4; boss.st = 'pause'; boss.t = 1.6; api.sfx('bad');
    fx.shake(10, .4); fx.flash(PAL.red, .3); fx.hitstop(.12);
    fx.text(bossTxtX(), P ? P.bossFeet - 40 * P.k : BOSS_Y - 120, by === 'mate' ? 'ฟ้องหัวหน้า!' : 'เห็นนะ!!', { color: PAL.red, size: 34, life: 1.2 });
    fx.burst(meX(), P ? P.meFeet - 50 * P.k : 250, { n: 14, colors: [PAL.red, '#fff'], speed: 260, grav: 300, size: 6, life: .5 });
    hud();
    if (strikes >= 3 && !over) { over = true; running = false; api.after(1.4, () => api.end(Math.floor(score), `รอด ${Math.floor(time)} วิ · เฉียดฉิว ${close} ครั้ง`, false, { secs: Math.floor(time), close })); }
  }
  const down = () => { if (running && !api.paused) holding = true; }, up = () => { holding = false; root.classList.remove('held'); };
  // phone: hold anywhere on the game (one action); desktop: the canvas
  const phone = g2phone(root, 'tap', true), holdEl = phone ? root : cv;
  if (phone) phoneHint(root, onTouch('แตะค้างตรงไหนก็ได้ = เล่นมือถือ · ปล่อย = ทำงาน', 'กดเมาส์ค้าง หรือ Space ค้าง = เล่นมือถือ · ปล่อย = ทำงาน'));
  holdEl.addEventListener('pointerdown', e => { if (!freePress(e)) return; e.preventDefault(); if (phone) root.classList.add('held'); down(); }); addEventListener('pointerup', up); holdEl.addEventListener('pointercancel', up);
  // holding for seconds is the whole game: stop iOS/Android from turning the hold into select / copy / zoom,
  // and keep the finger counting as "holding" even if it slides off the canvas onto the text above
  root.classList.add('nohold');
  holdEl.addEventListener('touchstart', e => { if (!freePress(e)) return; e.preventDefault(); down(); }, { passive: false });
  holdEl.addEventListener('touchend', e => { if (!freePress(e)) return; e.preventDefault(); up(); }, { passive: false });
  holdEl.addEventListener('touchcancel', up);
  api.onKey(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); down(); } });
  const keyUp = e => { if (e.key === ' ' || e.key === 'Enter') up(); }; addEventListener('keyup', keyUp);
  function stepBoss(d) {
    boss.t -= d;
    if (boss.st === 'walk') {
      boss.x += boss.dir * speed() * d; if (boss.x < 90 || boss.x > 630) { boss.dir *= -1; boss.x = Math.max(90, Math.min(630, boss.x)); }
      if (boss.t <= 0) { if (rnd() < .65) { boss.st = 'warn'; boss.t = warnDur(); boss.fake = rnd() < Math.min(.4, .1 + level * .05); api.sfx('tick'); } else { boss.st = 'pause'; boss.t = .5 + rnd(); } }
    } else if (boss.st === 'pause') { if (boss.t <= 0) { boss.st = 'walk'; boss.t = 1 + rnd() * 2.5; } }
    else if (boss.st === 'warn') {
      if (boss.t <= 0) { if (boss.fake) { boss.st = 'walk'; boss.t = .8 + rnd() * 2; boss.dir = rnd() < .5 ? 1 : -1; fx.text(bossTxtX(), P ? P.bossFeet - 37 * P.k : BOSS_Y - 110, 'หลอก!', { color: PAL.muted, size: 18 }); }
        else { boss.st = 'look'; boss.t = lookDur(); } }
    } else if (boss.st === 'look') { if (boss.t <= 0) { boss.st = 'walk'; boss.t = 1 + rnd() * 2.5; boss.dir = rnd() < .5 ? 1 : -1; } }
  }
  function draw() {
    if (P) return drawP();
    fx.pre(ctx);
    officeBG(ctx, W, H, 270, { wall: 'wall_mint', floor: 'floor_herring', windows: [['window_big', 110, 40, 3], ['noticeboard', 360, 70, 3], ['window_big', 610, 40, 3]] });
    drawPixAt(ctx, 'plant_pot', 40, 270, 3); drawPixAt(ctx, 'shop_shelf', 680, 270, 3);
    // boss in the back
    const dirB = boss.st === 'look' || scold > 0 ? 'down' : boss.st === 'warn' ? (Math.floor(t * 14) % 2 ? 'down' : boss.dir > 0 ? 'right' : 'left') : boss.dir > 0 ? 'right' : 'left';
    drawChar(ctx, 'bob', boss.st === 'walk' ? 'run' : 'idle_anim', dirB, boss.st === 'walk' ? t * .55 : t, boss.x, BOSS_Y + 34, 3, { sx: scold > 0 ? 1.1 : 1, sy: scold > 0 ? 1.1 : 1 });
    if (boss.st === 'warn') txt(ctx, '?', boss.x + 22, BOSS_Y - 70, 30, PAL.orange, 'center', 800);
    if (boss.st === 'look') { txt(ctx, '👀', boss.x, BOSS_Y - 76, 22); }
    // snitch: warning arrow on the left edge, then her walk with a name tag and the danger zone behind your desk
    if (mate.warn > 0) { const a = .55 + .45 * Math.sin(t * 14);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(14, 230); ctx.lineTo(44, 250); ctx.lineTo(14, 270); ctx.closePath(); ctx.fill(); ctx.restore();
      rrect(ctx, 50, 232, 196, 36, 10, '#fff', PAL.red); txt(ctx, '⚠️ เพื่อนขี้ฟ้องกำลังเดินมา!', 148, 251, 15, PAL.red, 'center', 800); }
    if (mate.on) {
      const near = Math.abs(mate.x - ME_X) < 260, inZ = Math.abs(mate.x - ME_X) < ZONE;
      if (near) { ctx.fillStyle = `rgba(226,48,48,${inZ ? .28 + Math.sin(t * 16) * .08 : .14})`; ctx.fillRect(ME_X - ZONE, 200, ZONE * 2, 76);
        ctx.strokeStyle = PAL.red; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(ME_X - ZONE, 200, ZONE * 2, 76); ctx.setLineDash([]);
        txt(ctx, inZ ? '📵 ห้ามเล่นมือถือ!' : '📵 เขตขี้ฟ้อง', ME_X, 192, 14, PAL.red, 'center', 800); }
      drawChar(ctx, mate.who, 'run', 'right', t * .8, mate.x, BOSS_Y + 40, 3.4);
      rrect(ctx, mate.x - 42, BOSS_Y - 92, 84, 22, 8, PAL.red); txt(ctx, '🗣️ ขี้ฟ้อง', mate.x, BOSS_Y - 81, 13, '#fff', 'center', 800);
      if (near && slack) { rrect(ctx, mate.x + 26, BOSS_Y - 128, 118, 28, 10, '#fff', PAL.ink); txt(ctx, 'เดี๋ยวฟ้องหัวหน้า!', mate.x + 85, BOSS_Y - 114, 13, PAL.red, 'center', 700); }
    }
    // my desk: back to the camera while working, turned around with the phone while slacking
    drawPixAt(ctx, 'pc_desk', ME_X, 318, 4);
    const sleepy = doze > 0;
    if (slack && !sleepy) drawChar(ctx, who, 'phone', 'down', t, ME_X, 404, 5, { sy: 1 + Math.sin(t * 6) * .01 });
    else drawChar(ctx, who, 'idle_anim', sleepy ? 'down' : 'up', t, ME_X, 404, 5, { rot: sleepy ? Math.sin(t * 3) * .12 : 0 });
    if (sleepy) txt(ctx, 'Zzz', ME_X + 50, 250 - Math.sin(t * 3) * 6, 24, PAL.blue, 'center', 800);
    // phone screen bubble
    if (slack) {
      rrect(ctx, ME_X + 60, 230, 66, 100, 10, PAL.ink); rrect(ctx, ME_X + 65, 236, 56, 86, 6, '#bfe9ff');
      for (let i = 0; i < 4; i++) { const y = 240 + ((i * 24 + t * 50) % 86); if (y < 316) drawPixAt(ctx, pxa(i % 2 ? 'heart' : 'spark'), ME_X + 80 + (i % 3) * 14, y + 8, 2); }
    }
    // meters: boredom
    rrect(ctx, 20, H - 30, 160, 14, 6, '#fff', PAL.ink); rrect(ctx, 21, H - 29, 158 * bored / 100, 12, 5, bored > 70 ? PAL.red : PAL.blue);
    txt(ctx, 'ความเบื่อ', 100, H - 42, 13, PAL.ink, 'center', 700);
    // danger tint when the boss is looking
    if (boss.st === 'look') { ctx.fillStyle = `rgba(226,48,48,${.12 + Math.sin(t * 12) * .06})`; ctx.fillRect(0, 0, W, 10); ctx.fillRect(0, H - 10, W, 10); ctx.fillRect(0, 0, 10, H); ctx.fillRect(W - 10, 0, 10, H); }
    fx.post(ctx, W, H);
  }
  // ---- portrait scene
  function paintBG(g) {
    const { W: w, H: h } = L, { k, floorY, cx, deskY } = P;
    officeBG(g, w, h, floorY, { wall: 'wall_mint', floor: 'floor_herring', k, windows: [['window_big', Math.round(w * .2) + 100, 10, k], ['window_big', Math.round(w * .8) + 100, 10, k]] });
    drawPixAt(g, 'noticeboard', cx, floorY - 34 * k + 13 * k, k);
    drawPixAt(g, 'plant_pot', 12 + 7 * k, floorY + 2 * k, k); drawPixAt(g, 'shop_shelf', w - 4 - 16 * k, floorY + 2 * k, k);
    const midY = Math.round((floorY + P.mateFeet - 30 * k) / 2 + 12 * k);
    drawPixAt(g, 'desk_pair', Math.round(w * .2), midY, k); drawPixAt(g, 'desk_pair', Math.round(w * .8), midY, k);
    drawPixAt(g, 'pc_desk', cx, deskY, k + 1);
  }
  function drawP() {
    const { W: w, H: h } = L, { k, cx, bossFeet, mateFeet, meFeet, bubX, bubY } = P, kb = k + 1;
    fx.pre(ctx);
    bg.draw(ctx);
    // boss along the back wall: the same tell as the wide scene (turns to face you and back, a '?' over the head)
    const bx = BX(boss.x);
    const dirB = boss.st === 'look' || scold > 0 ? 'down' : boss.st === 'warn' ? (Math.floor(t * 14) % 2 ? 'down' : boss.dir > 0 ? 'right' : 'left') : boss.dir > 0 ? 'right' : 'left';
    drawChar(ctx, 'bob', boss.st === 'walk' ? 'run' : 'idle_anim', dirB, boss.st === 'walk' ? t * .55 : t, bx, bossFeet, kb, { sx: scold > 0 ? 1.1 : 1, sy: scold > 0 ? 1.1 : 1 });
    if (boss.st === 'warn') txt(ctx, '?', bx + 7 * kb, bossFeet - 33 * kb, 30, PAL.orange, 'center', 800);
    if (boss.st === 'look') txt(ctx, '👀', bx, bossFeet - 34 * kb, 22);
    // snitch: the warning on the left edge at her height, then her walk with a name tag and the red zone behind your desk
    const my = mateFeet - 12 * k;
    if (mate.warn > 0) { const a = .55 + .45 * Math.sin(t * 14);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(6, my - 20); ctx.lineTo(36, my); ctx.lineTo(6, my + 20); ctx.closePath(); ctx.fill(); ctx.restore();
      rrect(ctx, 42, my - 18, 196, 36, 10, '#fff', PAL.red); txt(ctx, '⚠️ เพื่อนขี้ฟ้องกำลังเดินมา!', 140, my + 1, 15, PAL.red, 'center', 800); }
    if (mate.on) {
      const near = Math.abs(mate.x - ME_X) < 260, inZ = Math.abs(mate.x - ME_X) < ZONE, zx = MX(ME_X - ZONE), zw = MX(ME_X + ZONE) - zx, zy = mateFeet - 26 * k;
      if (near) { ctx.fillStyle = `rgba(226,48,48,${inZ ? .28 + Math.sin(t * 16) * .08 : .14})`; ctx.fillRect(zx, zy, zw, 28 * k);
        ctx.strokeStyle = PAL.red; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(zx, zy, zw, 28 * k); ctx.setLineDash([]);
        txt(ctx, inZ ? '📵 ห้ามเล่นมือถือ!' : '📵 เขตขี้ฟ้อง', cx, zy - 10, 14, PAL.red, 'center', 800); }
      const mx = MX(mate.x);
      drawChar(ctx, mate.who, 'run', 'right', t * .8, mx, mateFeet, k);
      const ty = mateFeet - 26 * k - 34;
      rrect(ctx, mx - 42, ty - 11, 84, 22, 8, PAL.red); txt(ctx, '🗣️ ขี้ฟ้อง', mx, ty, 13, '#fff', 'center', 800);
      if (near && slack) { const tx = Math.max(4, Math.min(w - 122, mx + 20)); rrect(ctx, tx, ty - 50, 118, 28, 10, '#fff', PAL.ink); txt(ctx, 'เดี๋ยวฟ้องหัวหน้า!', tx + 59, ty - 36, 13, PAL.red, 'center', 700); }
    }
    // me at my desk: back to the camera while working, turned around with the phone while slacking
    const sleepy = doze > 0, km = k + 2;
    if (slack && !sleepy) drawChar(ctx, who, 'phone', 'down', t, cx, meFeet, km, { sy: 1 + Math.sin(t * 6) * .01 });
    else drawChar(ctx, who, 'idle_anim', sleepy ? 'down' : 'up', t, cx, meFeet, km, { rot: sleepy ? Math.sin(t * 3) * .12 : 0 });
    if (sleepy) txt(ctx, 'Zzz', cx + 16 * k, meFeet - 50 * k - Math.sin(t * 3) * 6, 24, PAL.blue, 'center', 800);
    if (slack) {
      rrect(ctx, bubX, bubY, 66, 100, 10, PAL.ink); rrect(ctx, bubX + 5, bubY + 6, 56, 86, 6, '#bfe9ff');
      for (let i = 0; i < 4; i++) { const y = bubY + 10 + ((i * 24 + t * 50) % 86); if (y < bubY + 86) drawPixAt(ctx, pxa(i % 2 ? 'heart' : 'spark'), bubX + 20 + (i % 3) * 14, y + 8, 2); }
    }
    // boredom meter, bottom left beside the desk
    const mw = Math.min(150, cx - 18 * k - 20);
    rrect(ctx, 12, h - 26, mw, 14, 6, '#fff', PAL.ink); rrect(ctx, 13, h - 25, (mw - 2) * bored / 100, 12, 5, bored > 70 ? PAL.red : PAL.blue);
    txt(ctx, 'ความเบื่อ', 12 + mw / 2, h - 38, 13, PAL.ink, 'center', 700);
    if (boss.st === 'look') { ctx.fillStyle = `rgba(226,48,48,${.12 + Math.sin(t * 12) * .06})`; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10); ctx.fillRect(0, 0, 10, h); ctx.fillRect(w - 10, 0, 10, h); }
    fx.post(ctx, w, h);
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt; scold = Math.max(0, scold - dt);
    if (running && d) {
      time += d; level = 1 + Math.floor(time / 20);
      stepBoss(d);
      // the snitch walks across from level 3; slacking while she passes behind you = reported
      if (level >= 2) {
        if (!mate.on && mate.warn <= 0 && (mate.cool -= d) <= 0) { mate.warn = 1.8; api.sfx('tick');
          if (!mate.met) { mate.met = true;
            if (P) { fx.text(P.cx, P.floorY + 30, '🗣️ เพื่อนขี้ฟ้องมาแล้ว', { color: PAL.red, size: 18, life: 2.6 }); fx.text(P.cx, P.floorY + 56, 'ตอนเธอเดินผ่านหลังเรา ห้ามเล่นมือถือ!', { color: PAL.red, size: 15, life: 2.6 }); }
            else fx.text(W / 2, 140, '🗣️ เพื่อนขี้ฟ้องมาแล้ว — ตอนเธอเดินผ่านหลังเรา ห้ามเล่นมือถือ!', { color: PAL.red, size: 18, life: 2.6 }); } }
        if (mate.warn > 0 && (mate.warn -= d) <= 0) { mate.on = true; mate.x = -40; mate.passed = false; }
        if (mate.on) { mate.x += 120 * d;
          if (slack && Math.abs(mate.x - ME_X) < ZONE && scold <= 0) { mate.on = false; mate.cool = 9 + rnd() * 7; caught('mate'); }
          else if (!mate.passed && mate.x > ME_X + ZONE) { mate.passed = true; score += 25; fx.text(meX(), meTxtY(190), '😇 รอดจากขี้ฟ้อง +25', { color: PAL.green, size: 22 }); api.sfx('good'); }
          if (mate.x > W + 40) { mate.on = false; mate.cool = 7 + rnd() * 8; } } }
      const was = slack;
      if (doze > 0) { doze -= d; slack = true; if (doze <= 0) { slack = holding; bored = 30; } }
      else slack = holding && scold <= 0;
      if (was && !slack && boss.st === 'warn' && !boss.fake) { close++; score += 20; fx.text(meX(), meTxtY(200), 'เฉียดฉิว! +20', { color: PAL.yel, size: 24 }); api.sfx('good'); }
      if (slack) { streak += d; score += 10 * mult() * d; bored = Math.max(0, bored - 30 * d);
        if ((likeT -= d) <= 0) { likeT = .45; fx.burst(P ? P.bubX + 33 : ME_X + 93, P ? P.bubY + 6 : 236, { n: 2, colors: [PAL.pink, PAL.yel], speed: 90, grav: -80, size: 5, shape: 'star', life: .6 }); }
        if (boss.st === 'look' && scold <= 0) caught('boss'); }
      else { streak = 0; bored = Math.min(100, bored + (8 + level) * d); if (bored >= 100 && doze <= 0) { doze = 1.6; fx.text(meX(), meTxtY(200), 'เผลอหลับ!', { color: PAL.blue, size: 26 }); api.sfx('bad'); } }
      hud();
    }
    draw();
  });
  hud(); draw();
  if (window.__TEST__) window.__slack = { boss, mate, get: () => ({ time, score, strikes, slack, bored }), set: o => { if (o.time != null) time = o.time; if (o.bored != null) bored = o.bored; } };
  api.intro({ how: `<p>📱 งานน่าเบื่อ… <b>${phoneOn() ? 'แตะค้างตรงไหนก็ได้' : 'กดเมาส์ค้าง</b> หรือ <b>Space ค้าง'}</b> เพื่อแอบเล่นมือถือ ยิ่งเล่นต่อเนื่องคะแนนยิ่งคูณ</p>
      <p>👔 หัวหน้าเดินไปมาอยู่ด้านหลัง ถ้ามี <b>?</b> ขึ้นหัว = กำลังจะหันมา <b>ปล่อยมือให้ทัน!</b> (ปล่อยตอนเสี้ยววินาทีสุดท้าย = เฉียดฉิว +20)</p>
      <p>🗣️ <b>เพื่อนขี้ฟ้อง</b> (ป้ายแดงบนหัว) มาหลังเล่นไป ~20 วิ — มี ⚠️ เตือนที่ขอบซ้ายก่อน แล้วเดินผ่านหลังเรา · ตอนเธออยู่ใน<b>กรอบแดง</b> ห้ามเล่นมือถือ · รอดได้ +25</p>
      <p>😪 ทำงานนานเกินจนแถบความเบื่อเต็ม = เผลอหลับ · โดนจับได้ 3 ครั้ง = จบ</p>
      <p>👇 เลือกตัวละคร</p>`,
    buttons: MI_PEOPLE.filter(c => c !== 'bob').map(c => ({ label: `<img class="pxi" src="assets/mi/${c}_phone.png" height="44" alt="${c}" style="display:block">`, primary: c === who,
      go() { who = c; store.set('runWho', c); mate.who = ['alex', 'amelia', 'adam'].find(x => x !== c); running = true; } })) });
  return { destroy() { removeEventListener('pointerup', up); removeEventListener('keyup', keyUp); } };
}

/* =================================================================
   ขบวนไปกินข้าว — snake through the office: pick up coworkers, then lead the line out the door to lunch
================================================================= */
function congaGame(root, api) {
  const TOP = 2;   // rows 0-1 are the back wall
  const FURN = [{ n: 'pc_desk', w: 2, h: 1 }, { n: 'plant_pot', w: 1, h: 1 }, { n: 'sofa_grey', w: 3, h: 1 }, { n: 'table_light', w: 2, h: 2 }, { n: 'cabinet_wood', w: 2, h: 1 },
    { n: 'fridge', w: 1, h: 1 }, { n: 'shop_shelf', w: 2, h: 1 }, { n: 'sofa_red', w: 2, h: 1 }, { n: 'tree', w: 1, h: 1 }];
  const ROOMS = [['wall_mint', 'floor_herring'], ['wall_yellow', 'floor_wood'], ['wall_pink', 'floor_teal'], ['wall_grey', 'floor_yellow'], ['wall_beige', 'floor_brick']];
  // boards. BD: desktop / landscape, 20 x 13 tiles. BP: a portrait phone, a tall 9 x 15 office (13 floor rows, about half the
  // floor) — same coworkers per level; furniture scaled to the floor area; a new coworker stands at least 7 steps from the
  // head when there is room, so the walks stay about as long as on the wide board (mean 9.8 vs 10.3 tiles).
  // sx/sy = start, cx/cy = the start corridor kept free of furniture. The board is picked at each level start.
  const BD = { COLS: 20, ROWS: 13, DOOR: [9, 10], sx: 3, sy: 11, cx: 6, cy: 10, furn: 1, far: 0 },
    BP = { COLS: 9, ROWS: 15, DOOR: [4, 5], sx: 2, sy: 13, cx: 4, cy: 12, furn: 9 * 13 / (20 * 11), far: 7 };
  // the tall board only when the play box is phone-shaped (a portrait tablet keeps the wide board, scaled up)
  const tall = () => phonePortrait() && (!G || G.box.clientHeight >= 1.3 * G.box.clientWidth);
  let G = null, B = BD, COLS = B.COLS, ROWS = B.ROWS, DOOR = B.DOOR;
  // pixels: tile C, art at k, board at (OX, OY) in a W x H canvas (desktop: 32 px tiles, 2x art, the whole canvas)
  let W = 640, H = 416, C = 32, k = 2, s = 1, OX = 0, OY = 0, layer = null;
  root.innerHTML = `<div class="hud"><span>🍱 ด่าน <b data-k="lv">1</b></span><span>👥 <b data-k="got">0</b>/<b data-k="need">0</b></span><span>⭐ <b data-k="sc">0</b></span>
    <span class="muted g2tip">ลูกศร / WASD / ปัดจอ = เลี้ยว · เก็บเพื่อนให้ครบ แล้วพาออกประตูไปกินข้าว</span></div>`;
  G = g2canvas(root, W, H); const { cv, ctx } = G, q = k => root.querySelector(`[data-k="${k}"]`), fx = makeFX();
  let who = store.get('runWho', 'adam'); if (!MI_PEOPLE.includes(who)) who = 'adam';
  let level = 0, score = 0, snake = [], dir = [1, 0], queue = [], blocked = new Set(), furn = [], pick1 = null, cake = null, need = 0, got = 0, doorOpen = false;
  let combo = 0, comboT = -9, lastDir = [1, 0];   // juice only: quick pickups in a row show a combo, no extra score
  let acc = 0, tick = .18, running = false, over = false, t = 0, room = ROOMS[0], clearing = 0, total = 0, go = false;   // go: the line waits for the first turn
  const key = (x, y) => x + ',' + y, free = (x, y) => x >= 0 && x < COLS && y >= TOP && y < ROWS && !blocked.has(key(x, y));
  const X = x => OX + x * C, Y = y => OY + y * C;   // tile -> canvas px
  function hud() { q('lv').textContent = level; q('got').textContent = got; q('need').textContent = need; q('sc').textContent = fmt(score); }
  // the canvas follows the board: the portrait board fills the play area, the wide one keeps the 640 x 416 scene
  function fit() {
    const port = B === BP; root.classList.toggle('g2p', port); layer = null;
    if (!port) { W = 640; H = 416; C = 32; k = 2; s = 1; OX = OY = 0; G.size(); return; }
    const b = fitBox(G.box);
    C = Math.max(16, Math.min(Math.floor(b.w / COLS), Math.floor(b.h / ROWS))); k = C >= 36 ? 3 : 2; s = C / 32;
    W = b.w; H = b.h; OX = Math.floor((W - COLS * C) / 2); OY = H - ROWS * C; G.size(W, H, b.x, b.y);
  }
  function layout() {
    for (let tries = 0; tries < 40; tries++) {
      blocked = new Set(); furn = [];
      const n = Math.max(2, Math.round(Math.min(12, 3 + level) * B.furn));
      for (let i = 0; i < n * 3 && furn.length < n; i++) {
        const f = pick(rnd, FURN), x = Math.floor(rnd() * (COLS - f.w)), y = TOP + 1 + Math.floor(rnd() * (ROWS - TOP - f.h - 1));
        let ok = true; for (let a = -1; a <= f.w; a++) for (let b = -1; b <= f.h; b++) if (blocked.has(key(x + a, y + b))) ok = false;
        if (y + f.h - 1 >= B.cy && x <= B.cx) ok = false;   // keep the start corridor clear
        if (!ok) continue; furn.push({ ...f, x, y }); for (let a = 0; a < f.w; a++) for (let b = 0; b < f.h; b++) blocked.add(key(x + a, y + b));
      }
      // every free cell (and the door) must be reachable from the start
      const seen = new Set([key(B.sx - 1, B.sy)]), st = [[B.sx - 1, B.sy]];
      while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(x + dx, y + dy); if (!seen.has(k) && free(x + dx, y + dy)) { seen.add(k); st.push([x + dx, y + dy]); } } }
      let cells = 0; for (let y = TOP; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (free(x, y)) cells++;
      if (seen.size === cells) return;
    }
  }
  function spawnPick() {
    const h = snake[0];
    for (let i = 0; i < 200; i++) { const x = Math.floor(rnd() * COLS), y = TOP + Math.floor(rnd() * (ROWS - TOP));
      if (free(x, y) && !snake.some(s => s.x === x && s.y === y) && !(cake && cake.x === x && cake.y === y)) {
        if (B.far && h && i < 150 && Math.abs(x - h.x) + Math.abs(y - h.y) < B.far) continue;
        pick1 = { x, y, who: pick(rnd, MI_PEOPLE), pop: 1 }; return; } }
  }
  function startLevel() {
    level++; B = tall() ? BP : BD; COLS = B.COLS; ROWS = B.ROWS; DOOR = B.DOOR; if (phoneOn()) fit();
    room = ROOMS[(level - 1) % ROOMS.length]; layer = null; layout(); need = 4 + level * 3; got = 0; doorOpen = false; cake = null;   // longer lines (was 3 + 2/level) but a slower walk
    snake = [{ x: B.sx, y: B.sy, px: B.sx - 1, py: B.sy, who }]; dir = [1, 0]; queue = [];
    tick = Math.max(.12, .22 - level * .008); acc = 0; go = false; spawnPick(); hud();   // was max(.08, .19 − .012/level): slower start, gentler speed-up
    const bx = X(COLS / 2), by = Y(ROWS / 2);
    combo = 0; if (level > 1) { fx.flash('#fff', .12); fx.burst(OX, by, { n: 18, colors: ['#ffffff', PAL.yel], speed: 520, grav: 0, size: 3, shape: 'sq', life: .5 }); }
    fx.text(bx, by, `ด่าน ${level} — เก็บเพื่อน ${need} คน`, { color: PAL.yel, size: 28, life: 1.6, rise: 10 });
  }
  function die(msg) {
    over = true; running = false; api.sfx('bad'); fx.shake(10, .4); fx.flash(PAL.red, .3); fx.hitstop(.1);
    fx.text(X(COLS / 2), Y(ROWS / 2), msg, { color: PAL.red, size: 30, life: 1.4 });
    api.after(1.4, () => api.end(score, `ถึงด่าน ${level} · พาเพื่อนไปกินข้าว ${total} คน`, false, { level, total }));
  }
  function turn(dx, dy) { if (!go) { go = true; dir = [dx, dy]; queue = []; return; } const last = queue.length ? queue[queue.length - 1] : dir; if (last[0] === -dx && last[1] === -dy || last[0] === dx && last[1] === dy) return; if (queue.length < 2) queue.push([dx, dy]); }
  function step() {
    if (queue.length) dir = queue.shift();
    const h = snake[0], nx = h.x + dir[0], ny = h.y + dir[1];
    if (go && (dir[0] !== lastDir[0] || dir[1] !== lastDir[1])) fx.burst(X(h.x) + C / 2, Y(h.y + 1) - 4 * s, { n: 5, colors: ['#e8dccb', '#fff'], speed: 70, grav: -20, size: 4, shape: 'puff', life: .35 });
    lastDir = dir;
    // the open door is in the wall right above the playfield
    if (doorOpen && ny === TOP - 1 && DOOR.includes(nx)) {
      const bonus = got * 10 * level + 100; score += bonus; total += got; clearing = 1.2; api.sfx('level');
      fx.text(X(COLS / 2), Y(ROWS / 2) - 30 * s, `ไปกินข้าว! +${bonus}`, { color: PAL.green, size: 32, life: 1.4 }); fx.burst(X(nx), Y(TOP), { n: 40, colors: CONFETTI, speed: 360, grav: 500, size: 7, shape: 'paper', life: 1.2 }); fx.flash('#fff', .2);
      hud(); return;
    }
    if (!free(nx, ny)) return die(ny < TOP ? 'ชนผนัง!' : 'ชนโต๊ะ!');
    if (snake.slice(0, -1).some(s => s.x === nx && s.y === ny)) return die('ชนขบวนตัวเอง!');
    const grow = pick1 && pick1.x === nx && pick1.y === ny;
    for (let i = snake.length - 1; i >= 0; i--) { const s = snake[i]; s.px = s.x; s.py = s.y; if (i > 0) { s.x = snake[i - 1].x; s.y = snake[i - 1].y; } }
    h.x = nx; h.y = ny;
    const cx = X(nx) + C / 2, cy = Y(ny);
    if (grow) {
      const tail = snake[snake.length - 1]; snake.push({ x: tail.px, y: tail.py, px: tail.px, py: tail.py, who: pick1.who, pop: 1 });
      got++; const p = 10 * level; score += p; api.sfx('good');
      snake.forEach((s, i) => { s.pop = Math.max(s.pop || 0, 1 - i * .07); });   // a happy wave runs down the line
      combo = t - comboT < 2.6 ? combo + 1 : 1; comboT = t; if (combo >= 2) fx.text(cx, cy - 34 * s, `คอมโบ x${combo}!`, { color: PAL.green, size: 16 + Math.min(combo, 6) * 2, life: .8, rise: 30 });
      fx.shake(2, .08);
      fx.text(cx, cy - 10 * s, `+${p}`, { color: PAL.yel, size: 22 }); fx.burst(cx, cy + C / 2, { n: 14, colors: CONFETTI, speed: 220, grav: 300, size: 5, shape: 'paper', life: .7 });
      if (got >= need && !doorOpen) { doorOpen = true; pick1 = null; fx.text(X(COLS / 2), OY + 90 * s, '🚪 ประตูเปิดแล้ว! พาไปกินข้าว', { color: PAL.green, size: 24, life: 1.6, rise: 10 }); fx.flash(PAL.yel, .2); fx.burst(X(DOOR[0]) + C, Y(TOP), { n: 28, colors: CONFETTI, speed: 300, grav: 420, size: 6, shape: 'paper', life: 1.1 }); fx.shake(4, .15); api.sfx('level'); }
      else spawnPick();
      if (!cake && rnd() < .25) for (let i = 0; i < 50; i++) { const x = Math.floor(rnd() * COLS), y = TOP + Math.floor(rnd() * (ROWS - TOP)); if (free(x, y) && !snake.some(s => s.x === x && s.y === y)) { cake = { x, y, t: 6 }; break; } }
      hud();
    }
    if (cake && cake.x === nx && cake.y === ny) { score += 30 * level; fx.text(cx, cy - 10 * s, `🍰 +${30 * level}`, { color: PAL.pink, size: 22 }); fx.burst(cx, cy + C / 2, { n: 10, colors: [PAL.yel, '#fff'], speed: 200, grav: 0, size: 6, shape: 'star', life: .5 }); api.sfx('good'); cake = null; hud(); }
  }
  api.onKey(e => { const m = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] }[e.key]; if (m && running) { e.preventDefault(); turn(...m); } });
  const phone = g2phone(root, 'conga');
  if (!phone) {
    let sw = null;
    cv.addEventListener('pointerdown', e => { sw = [e.clientX, e.clientY]; });
    cv.addEventListener('pointerup', e => { if (!sw || !running) return; const dx = e.clientX - sw[0], dy = e.clientY - sw[1]; sw = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return; Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy)); });
    g2pad(root, [['◀', () => running && turn(-1, 0)], ['▲', () => running && turn(0, -1)], ['▼', () => running && turn(0, 1)], ['▶', () => running && turn(1, 0)]]);
  } else {
    // floating stick: thumb down anywhere, drag; the line turns as soon as the drag passes 18 px in a new
    // direction (a quick swipe does the same). The stick ring appears under the thumb, nothing needs aiming at.
    // In portrait the hint becomes the thumb pad at the bottom (the stick still works anywhere).
    phoneHint(root, 'ปัดหรือลากนิ้วตรงไหนก็ได้ = เลี้ยว');
    const st = document.createElement('div'); st.className = 'g2stick'; st.innerHTML = '<i></i>'; root.appendChild(st);
    const knob = st.firstChild; let sk = null;
    root.addEventListener('pointerdown', e => { if (!freePress(e) || e.target.closest('.hud')) return; e.preventDefault(); const r = root.getBoundingClientRect();
      sk = { id: e.pointerId, x: e.clientX, y: e.clientY, last: '' }; st.style.left = (e.clientX - r.left) + 'px'; st.style.top = (e.clientY - r.top) + 'px'; st.classList.add('on'); knob.style.transform = ''; });
    root.addEventListener('pointermove', e => { if (!sk || e.pointerId !== sk.id) return; let dx = e.clientX - sk.x, dy = e.clientY - sk.y; const l = Math.hypot(dx, dy);
      knob.style.transform = `translate(${dx * Math.min(1, 34 / (l || 1))}px,${dy * Math.min(1, 34 / (l || 1))}px)`;
      if (l < 18 || !running) return; const d = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)], k = d.join();
      if (k !== sk.last) { sk.last = k; turn(...d); }
      if (l > 60) { sk.x = e.clientX - dx * 60 / l; sk.y = e.clientY - dy * 60 / l; st.style.left = (parseFloat(st.style.left) + dx - dx * 60 / l) + 'px'; st.style.top = (parseFloat(st.style.top) + dy - dy * 60 / l) + 'px'; } });
    const skEnd = e => { if (!sk || e.pointerId !== sk.id) return; sk = null; st.classList.remove('on'); };
    root.addEventListener('pointerup', skEnd); root.addEventListener('pointercancel', skEnd);
  }
  const dname = (dx, dy) => dx > 0 ? 'right' : dx < 0 ? 'left' : dy < 0 ? 'up' : 'down';
  // the room without the things that move. Portrait: the wall runs up to the top of the canvas, cached as one layer
  function drawRoom(c) {
    const [wall, floor] = room;
    if (B !== BP) { officeBG(c, W, H, TOP * C, { wall, floor, k: 2, windows: [['window_big', 120, 6, 2], ['pic_land', 230, 14, 2], ['window_big', 520, 6, 2], ['world_map', 420, 12, 2]] }); return; }
    const bw = COLS * C, bh = ROWS * C;
    c.fillStyle = PAL.ink; c.fillRect(0, 0, W, H);   // the few px beside the board read as its frame
    c.fillStyle = wallBase(wall); c.fillRect(OX, 0, bw, OY); c.fillStyle = 'rgba(255,249,238,.42)'; c.fillRect(OX, 0, bw, OY);   // the wall goes on up
    c.save(); c.beginPath(); c.rect(OX, 0, bw, H); c.clip(); c.translate(OX, OY);
    officeBG(c, bw, bh, TOP * C, { wall, floor, k, windows: [['window_big', 100 + 1.5 * C, 8 * s, k], ['window_big', 100 + bw - 1.5 * C, 8 * s, k]] }); c.restore();
  }
  const DL = [], order = [], so = { rot: 0, sx: 1, sy: 1 }, ca = { alpha: 1 }, NO = {}, byY = (p, q2) => p.y - q2.y;   // draw list, reused every frame
  let dn = 0;
  function put(y, kind, o, i) { let e = DL[dn]; if (!e) e = DL[dn] = { y: 0, kind: 0, o: null, i: 0 }; dn++; e.y = y; e.kind = kind; e.o = o; e.i = i; order.push(e); }
  function draw() {
    fx.pre(ctx);
    if (B === BP && !layer && artReady([room[0], room[1], 'window_big'])) { const l = layerCanvas(W, H, G.dpr); drawRoom(l.g); layer = l.c; }
    if (layer) ctx.drawImage(layer, 0, 0, W, H); else drawRoom(ctx);
    // door to the canteen
    const dx0 = X(DOOR[0]), dw = 2 * C, wy = OY + 6 * s;
    if (doorOpen) { ctx.fillStyle = PAL.ink; ctx.fillRect(dx0, wy, dw, TOP * C - 6 * s); ctx.fillStyle = `rgba(255,210,63,${.5 + Math.sin(t * 8) * .3})`; ctx.fillRect(dx0 + 4 * s, OY + 10 * s, dw - 8 * s, TOP * C - 10 * s);
      txt(ctx, 'โรงอาหาร', dx0 + C, OY + 26 * s, Math.round(13 * s), PAL.ink, 'center', 800); txt(ctx, '▲', dx0 + C, OY + (48 - Math.abs(Math.sin(t * 6)) * 6) * s, Math.round(18 * s), PAL.ink, 'center', 800); }
    else drawPixAt(ctx, 'door_double', dx0 + C, Y(TOP), k, NO);
    // everything with a y gets drawn back-to-front
    const a = Math.min(1, acc / tick); dn = 0; order.length = 0;
    for (const f of furn) put(f.y + f.h, 0, f, 0);
    if (pick1) put(pick1.y + 1, 1, pick1, 0);
    if (cake) put(cake.y + 1, 2, cake, 0);
    for (let i = 0; i < snake.length; i++) { const sg = snake[i]; put(sg.py + (sg.y - sg.py) * a + 1 + .01, 3, sg, i); }
    order.sort(byY);
    for (const e of order) {
      const o = e.o;
      if (e.kind === 0) drawPixAt(ctx, o.n, X(o.x + o.w / 2), Y(o.y + o.h), k, NO);
      else if (e.kind === 1) { so.rot = 0; so.sx = 1 + o.pop * .3; so.sy = 1 - o.pop * .2;
        drawChar(ctx, o.who, 'idle_anim', 'down', t, X(o.x) + C / 2, Y(o.y + 1), k, so);
        const b = Math.abs(Math.sin(t * 5)) * 4;
        if (B === BP) drawPixAt(ctx, pxa('hey'), X(o.x) + C / 2 + 22 * s, Y(o.y) - 18 * s - b * s, k, NO); else txt(ctx, '🙋', o.x * C + C / 2 + 14, o.y * C - 26 - b, 16); }
      else if (e.kind === 2) { ca.alpha = o.t < 2 ? (Math.floor(t * 8) % 2 ? 1 : .3) : 1;
        drawPixAt(ctx, 'cake_straw', X(o.x) + C / 2, Y(o.y + 1) - (4 + Math.abs(Math.sin(t * 6)) * 3) * s, k + 1, ca); }
      else { const i = e.i, x = X(o.px + (o.x - o.px) * a) + C / 2, y = Y(o.py + (o.y - o.py) * a + 1), mdx = o.x - o.px, mdy = o.y - o.py;
        so.rot = over ? (i % 2 ? .5 : -.5) : 0; so.sx = 1 + (o.pop || 0) * .3; so.sy = 1 - (o.pop || 0) * .25;
        drawChar(ctx, o.who || who, over ? 'idle_anim' : 'run', mdx || mdy ? dname(mdx, mdy) : 'right', t + i * .1, x, y, k, so); }
    }
    if (running && !go && clearing <= 0) { const cx = X(COLS / 2), by = B === BP ? Y(ROWS / 2) + 20 : Y(ROWS);   /* portrait: clear of the start corner */ rrect(ctx, cx - 150, by - 70, 300, 40, 12, 'rgba(255,255,255,.92)', PAL.ink); txt(ctx, phone ? 'ปัดนิ้วเพื่อออกเดิน' : 'กดลูกศร / ปัดจอ เพื่อออกเดิน', cx, by - 50, 16, PAL.ink, 'center', 700); }
    fx.post(ctx, W, H);
  }
  api.loop(dt => {
    const d = fx.step(dt); t += dt;
    if (pick1) pick1.pop = Math.max(0, pick1.pop - dt * 4); for (const s of snake) if (s.pop) s.pop = Math.max(0, s.pop - dt * 4);
    if (cake && running && (cake.t -= dt) <= 0) cake = null;
    if (clearing > 0) { clearing -= dt; if (clearing <= 0 && running) startLevel(); }
    else if (running && d && go) { acc += d; while (acc >= tick && running && clearing <= 0) { acc -= tick; step(); } }
    draw();
  });
  if (phone) phoneRelayout(root, () => { if (!level) { B = tall() ? BP : BD; COLS = B.COLS; ROWS = B.ROWS; DOOR = B.DOOR; } fit(); draw(); });
  hud(); draw();
  api.intro({ how: `<p>🍱 เที่ยงแล้ว! เดินไปชวนเพื่อนที่ยกมือ 🙋 มาต่อแถว ครบจำนวนแล้ว <b>ประตูโรงอาหารด้านบนจะเปิด</b> — พาขบวนเดินออกไปเพื่อผ่านด่าน</p>
      <p>${phone ? '👆 ปัดหรือลากนิ้วตรงไหนก็ได้ไปทางที่จะเลี้ยว' : '⌨️ ลูกศร / WASD · มือถือ: ปัดจอหรือใช้ปุ่มใต้จอ'} · 🍰 เค้กโผล่มาแป๊บเดียว เก็บได้คะแนนพิเศษ</p>
      <p>⚠️ ชนโต๊ะ ผนัง หรือชนขบวนตัวเอง = จบ · ด่านยิ่งสูง เฟอร์นิเจอร์ยิ่งเยอะ เดินยิ่งเร็ว</p>`,
    buttons: [{ label: '🍱 ไปกินข้าว!', primary: true, go() { running = true; startLevel(); } }] });
}

/* =================================================================
   Phone extras for the hub's own games in index.html: only the touch wording of the "how to play" cards (TUT).
   Run, stack, spot and whack build their phone layouts and controls themselves. Desktop is not touched.
================================================================= */
const HUB_TOUCH_TUT = {
  run: [['👆', 'แตะ = กระโดด'], ['👇', 'ปัดลง / ปุ่มก้ม = ก้มหลบ'], ['🪙', 'เก็บเหรียญ ไปให้ไกลที่สุด']],
  stack: [['📦', 'แฟ้มเลื่อนไปมา'], ['👆', 'แตะตรงไหนก็ได้ = วาง'], ['🎯', 'วางให้ตรง กองไม่เล็กลง']],
  tetris: [['◀ ▶', 'ปุ่มซ้ายล่าง ย้าย'], ['⟳', 'ขวาล่าง หมุน / ทิ้ง'], ['▬', 'เต็มแถว = หายไป']],
  stamp: [['📄', 'เอกสารเลื่อนมาบนสายพาน'], ['👆', 'แตะตรงไหนก็ได้ = ปั๊ม'], ['🎯', 'ปั๊มตรงกรอบ = PERFECT']],
  barista: [['🧾', 'ดูออเดอร์ในบับเบิล'], ['👆', 'แตะวัตถุดิบตามสูตร'], ['🛎️', 'กดเสิร์ฟ']],
  toss: [['👆', 'ลากแผ่นด้านล่างถอยหลัง'], ['🌬️', 'ดูลมจากพัดลม'], ['🗑️', 'ปล่อยให้ลงถัง']],
  slack: [['✋', 'แตะค้าง = แอบเล่นมือถือ'], ['👀', 'หัวหน้าหันมา ปล่อยทันที!'], ['😴', 'ไม่เล่นเลยจะง่วงหลับ']],
  conga: [['👆', 'ปัดนิ้ว = เลี้ยวขบวน'], ['🧑‍🤝‍🧑', 'เก็บเพื่อนต่อแถว'], ['🚪', 'ครบแล้วพาออกประตู']],
};
const HUB_TOUCH = {};   // per-game mount wrappers: none left (the games handle touch themselves)
addEventListener('DOMContentLoaded', () => {
  if (!phoneOn()) return;
  if (typeof TUT === 'object') Object.assign(TUT, HUB_TOUCH_TUT);
  if (typeof GAMES === 'undefined') return;
  for (const g of GAMES) {
    const fix = HUB_TOUCH[g.id]; if (!fix || !g.mount) continue;
    const mount = g.mount;
    g.mount = (root, api) => {
      const inst = mount(root, api) || {}, undo = fix(root);
      return { ...inst, destroy() { inst.destroy && inst.destroy(); undo && undo(); } };
    };
  }
});
