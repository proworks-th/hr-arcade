// Dungeon data: every number the dungeon runs on lives here, so balancing never means hunting through game code.
// Pure data (no DOM): gen.js and the node test read it too. Tile ids are Kenney "Tiny Dungeon" (CC0),
// assets/village/kenney-dungeon.png, 12 tiles a row, 16 px each.
'use strict';
const DD = {
  TILE: 16, SCALE: 3,                       // 16 px art drawn ×3 → one tile = 48 logical px

  // ---------- art ----------
  T: {
    face: 40, faceAlt: [40, 40, 40, 40, 14, 28, 57, 58, 59], banner: 29, fount: [7, 8, 19], door: 45, arch: 9,
    spikes: 41, ore: 56, chest: 89, bigChest: 91, mimic: 92, potion: 115, altar: 32,
    props: [82, 82, 82, 63, 75, 66, 64, 65, 72, 74],   // barrel ×3 so barrels are the common one
  },
  // floor looks; each floor picks one by depth band so going deeper visibly changes the place
  THEMES: [
    { id: 'sand', base: 48, deco: [49, 49, 49, 42], rate: .16, wash: null, top: '#3a2c3d', rim: '#6b5a74', void: '#1b1420' },
    { id: 'stone', base: 0, deco: [12, 12, 24], rate: .08, wash: 'rgba(16,8,12,.38)', top: '#2c2030', rim: '#5b4660', void: '#140e18' },
  ],

  // ---------- floors ----------
  // what a floor is for decides its size: [w min, w max], [h min, h max], rooms, room size, monster density, extras
  PURPOSE: {
    warm:  { name: 'ชั้นตื้น',   w: [36, 42], h: [24, 28], rooms: [5, 7],   room: [6, 10, 5, 8],  dens: .030, chests: [1, 1] },
    hunt:  { name: 'โถงล่า',    w: [40, 52], h: [26, 34], rooms: [6, 10],  room: [6, 11, 5, 8],  dens: .036, chests: [1, 2] },
    maze:  { name: 'เขาวงกต',   w: [52, 60], h: [34, 40], rooms: [11, 15], room: [4, 7, 4, 6],   dens: .034, chests: [2, 3], loops: .45 },
    nest:  { name: 'รังสัตว์',    w: [44, 54], h: [30, 36], rooms: [5, 7],   room: [9, 14, 7, 10], dens: .050, chests: [1, 2] },
    vault: { name: 'ห้องสมบัติ',  w: [36, 40], h: [24, 26], rooms: [4, 5],   room: [6, 9, 5, 7],   dens: .012, chests: [2, 3], altar: true },
    lair:  { name: 'รังบอส',     w: [40, 48], h: [28, 32], rooms: [4, 6],   room: [6, 9, 5, 7],   dens: .018, chests: [0, 1], boss: true },
  },
  // which purpose a floor gets: every 5th is a boss lair, the floor after a boss is a vault, the first two are warm-ups
  purposeFor(depth, r) {
    if (depth % 5 === 0) return 'lair';
    if (depth > 5 && depth % 5 === 1) return 'vault';
    if (depth <= 2) return 'warm';
    const w = [['hunt', 50], ['maze', depth >= 4 ? 25 : 0], ['nest', depth >= 4 ? 25 : 0]];
    let t = r() * w.reduce((s, x) => s + x[1], 0); for (const [id, n] of w) if ((t -= n) < 0) return id; return 'hunt';
  },
  themeFor: depth => DD.THEMES[Math.floor((depth - 1) / 5) % DD.THEMES.length],

  // ---------- monsters ----------
  // ai: chase | swoop | pack | charge | shoot | ghost | brute | split | mimic | boss
  // r = hit radius (logical px), sc = draw scale, from = first depth it shows up, w = spawn weight
  MON: {
    slime:    { name: 'สไลม์',        tile: 108, hp: 2, sp: 55,  dmg: 1, pts: 10, r: 15, sc: 3, ai: 'chase',  from: 1, w: 10 },
    bat:      { name: 'ค้างคาว',       tile: 120, hp: 1, sp: 100, dmg: 1, pts: 8,  r: 13, sc: 3, ai: 'swoop',  from: 2, w: 7, fly: true },
    rat:      { name: 'หนูท่อ',        tile: 123, hp: 1, sp: 125, dmg: 1, pts: 6,  r: 11, sc: 3, ai: 'pack',   from: 3, w: 5, group: [3, 4] },
    spider:   { name: 'แมงมุมยักษ์',    tile: 122, hp: 3, sp: 60,  dmg: 1, pts: 20, r: 16, sc: 3, ai: 'charge', from: 3, w: 6 },
    bigslime: { name: 'สไลม์ใหญ่',     tile: 108, hp: 4, sp: 42,  dmg: 1, pts: 25, r: 22, sc: 4.5, ai: 'split', from: 4, w: 4, tint: 'big' },
    bandit:   { name: 'โจรเงา',       tile: 111, hp: 2, sp: 70,  dmg: 1, pts: 25, r: 15, sc: 3, ai: 'shoot',  from: 5, w: 5 },
    ghost:    { name: 'วิญญาณ',       tile: 121, hp: 2, sp: 48,  dmg: 1, pts: 22, r: 15, sc: 3, ai: 'ghost',  from: 6, w: 4, fly: true },
    brute:    { name: 'อสูรแดง',       tile: 110, hp: 5, sp: 40,  dmg: 2, pts: 45, r: 20, sc: 4, ai: 'brute',  from: 8, w: 3 },
    mimic:    { name: 'หีบมิมิค',       tile: 92,  hp: 3, sp: 95,  dmg: 1, pts: 35, r: 16, sc: 3, ai: 'mimic',  from: 4, w: 0 },
    // bosses: lair floors alternate between them
    cyclops:  { name: 'ยักษ์ตาเดียว',   tile: 109, hp: 14, sp: 30, dmg: 1, pts: 200, r: 30, sc: 6, ai: 'boss', boss: 'cyclops', from: 5, w: 0 },
    demon:    { name: 'ราชาอสูรแดง',   tile: 110, hp: 18, sp: 36, dmg: 2, pts: 260, r: 32, sc: 6, ai: 'boss', boss: 'demon', from: 10, w: 0 },
  },
  BOSS_HP: 1.6,                               // boss hp = base + depth × this
  bossFor: depth => (depth / 5) % 2 === 1 ? 'cyclops' : 'demon',
  // endless scaling: tougher and faster with depth, but never so fast you can't dodge
  // difficulty curve (playtest 13 Nov: "easy at first, juice up later"): B1–B3 at base, then +7% hp a floor (cap ×3),
  // contact hits do 1 more damage from B12. Warnings (red lines / circles) never get shorter: owner, 13 Nov —
  // "the indicator needs to be there and honest to the player". Depth makes monsters tougher, never less readable.
  scale(depth) { return { hp: Math.min(3, 1 + Math.max(0, depth - 3) * .07), dmg: depth >= 12 ? 1 : 0, sp: 1 + Math.min(.45, depth * .022), dens: 1 + Math.min(.6, depth * .025) }; },
  MIMIC_CHANCE: d => d >= 4 ? Math.min(.35, .15 + d * .01) : 0,

  // ---------- player ----------
  // Vampire-Survivors logic (owner, 13 Nov): you only move and dodge; weapons fire by themselves; gems give XP;
  // each level you pick 1 of 3 upgrades; a maxed weapon + its partner passive evolves from a boss chest.
  PLAYER: { hp: 5, sp: 165, r: 11, crit: .05, dash: { sp: 440, t: .16, cd: .8, inv: .24 }, inv: .9, magnet: 70, slots: 4 },
  // playtest 13 Nov: "levelling feels really fast" → steeper curve: Lv 2 after ~4 slimes, Lv 5 ≈ B3, Lv 10 ≈ B8 (was +3 a level)
  XP: { need: lv => Math.round(8 + lv * 6 + lv * lv * .6), small: 1, big: 3 },

  // ---------- auto weapons: 5 levels each, then an evolution ----------
  // kind decides the behaviour (game.js); every array is level 1..5; evo = the evolved weapon's numbers
  ARMS: {
    sword:  { name: 'ดาบ',          tile: 104, kind: 'arc',   pair: 'might',  desc: 'ฟันเป็นวงโค้งใส่ตัวที่ใกล้ที่สุด',
      dmg: [2, 2, 3, 3, 4], cd: [1.0, .9, .9, .8, .7], reach: [70, 76, 80, 86, 92], n: [1, 1, 2, 2, 2],
      evo: { name: 'ดาบเพลิง', tile: 105, dmg: 5, cd: .6, reach: 104, n: 1, full: true, desc: 'ฟันรอบตัว 360°' } },
    axe:    { name: 'ขวานหมุน',      tile: 118, kind: 'orbit', pair: 'area',   desc: 'ขวานหมุนรอบตัวเป็นช่วงๆ',
      dmg: [1.5, 2, 2, 2.5, 3], n: [1, 2, 2, 3, 3], r: [70, 72, 78, 82, 88], on: [3, 3, 3.5, 3.5, 4], off: [2.5, 2.4, 2.2, 2, 1.8],
      evo: { name: 'ขวานพายุ', tile: 119, dmg: 3.5, n: 4, r: 96, on: 99, off: 0, desc: 'ขวาน 4 เล่มหมุนไม่หยุด' } },
    dagger: { name: 'มีดบิน',        tile: 103, kind: 'throw', pair: 'haste',  desc: 'ปามีดใส่ตัวที่ใกล้ที่สุด ทะลุได้',
      dmg: [1.5, 1.5, 2, 2, 2.5], cd: [1.0, .9, .85, .75, .65], n: [1, 2, 2, 3, 4], pierce: [1, 1, 2, 2, 3],
      evo: { name: 'พายุมีด', tile: 103, dmg: 2.5, cd: .14, n: 1, pierce: 4, desc: 'มีดพุ่งออกเป็นสาย' } },
    wand:   { name: 'คทาเวท',        tile: 129, kind: 'bolt',  pair: 'crit',   desc: 'ลูกไฟเวทวิ่งตามเป้า',
      dmg: [2, 2.5, 3, 3, 4], cd: [1.3, 1.2, 1.1, 1.0, .9], n: [1, 1, 2, 2, 3],
      evo: { name: 'คทาจันทรา', tile: 129, dmg: 4, cd: .7, n: 4, crit: .3, desc: 'ลูกไฟ 4 ลูก คริติคอลง่าย' } },
    staff:  { name: 'ไม้เท้าโนวา',    tile: 130, kind: 'nova',  pair: 'armor',  desc: 'คลื่นพลังรอบตัว ดันศัตรูออกไป',
      dmg: [2, 2, 3, 3, 4], cd: [2.6, 2.4, 2.2, 2.0, 1.8], r: [90, 100, 110, 120, 135],
      evo: { name: 'โนวาศักดิ์สิทธิ์', tile: 130, dmg: 5, cd: 1.5, r: 180, heal: 10, desc: 'คลื่นใหญ่ ทุก 10 ครั้งฟื้นหัวใจ 1 ดวง' } },
    spear:  { name: 'หอกพุ่ง',        tile: 131, kind: 'lance', pair: 'speed',  desc: 'พุ่งหอกไปทางที่เดิน ทะลุทุกตัว',
      dmg: [3, 3, 4, 4, 5], cd: [1.6, 1.5, 1.4, 1.2, 1.0], n: [1, 1, 2, 2, 3],
      evo: { name: 'หอกสามแฉก', tile: 131, dmg: 6, cd: .8, n: 5, desc: 'หอก 5 เล่มพุ่งเป็นพัด' } },
    hammer: { name: 'ค้อนธรณี',       tile: 117, kind: 'quake', pair: 'heart',  desc: 'ทุบพื้นใส่ศัตรู ทำให้มึน',
      dmg: [4, 4, 5, 6, 7], cd: [3.0, 2.8, 2.6, 2.3, 2.0], r: [60, 66, 72, 80, 90], n: [1, 1, 1, 2, 2],
      evo: { name: 'ค้อนเทพ', tile: 117, dmg: 8, cd: 1.8, r: 100, n: 3, desc: 'ทุบ 3 จุดพร้อมกัน' } },
  },
  // ---------- passives: 5 levels each ----------
  PASSIVES: {
    might:  { name: 'พลัง',       icon: 106, desc: 'แรง +10%' },
    haste:  { name: 'รัวเร็ว',     icon: 116, desc: 'อาวุธพร้อมเร็วขึ้น 8%' },
    area:   { name: 'แผ่กว้าง',    icon: 126, desc: 'ระยะและวงอาวุธ +10%' },
    heart:  { name: 'หัวใจ',       icon: 115, desc: 'หัวใจสูงสุด +1 และฟื้น 1 ดวง' },
    speed:  { name: 'เท้าไฟ',      icon: 114, desc: 'เดินเร็วขึ้น 8% · หลบบ่อยขึ้น' },
    magnet: { name: 'แม่เหล็ก',     icon: 101, desc: 'ดูดอัญมณีไกลขึ้น 30%' },
    armor:  { name: 'เกราะ',       icon: 102, desc: 'โอกาส 10% ไม่เสียหัวใจเมื่อโดนตี' },
    crit:   { name: 'คมกริบ',      icon: 113, desc: 'โอกาสคริติคอล +6% (แรง ×2)' },
  },
  // ---------- lasting progression (across runs) ----------
  // owner, 13 Nov: "this mode has no progression on personal skills" → three lasting layers:
  // 1) combat skill tiers (skills.js) 2) weapons discovered in the dungeon stay unlocked 3) the armoury record.
  // A new player starts with 4 weapons; the other 3 are found once, the first time you reach their depth.
  START_ARMS: ['sword', 'dagger', 'staff', 'axe'],
  DISCOVER: { wand: 3, spear: 6, hammer: 11 },

  // ---------- waves: monsters pour out of the fog while a floor is open ----------
  // each one shows a purple swirl for 0.8 s before it appears (owner: warnings stay honest)
  // playtest 13 Nov: "waves a little thin" → bigger and more often (B1 4 every 10 s · B5 8 every 8.5 s · B10 12 every 7 s)
  WAVE: { first: 6, every: d => Math.max(5, 10 - d * .3), size: d => Math.min(16, 4 + Math.floor(d * .8)), cap: 60, warn: .8, near: 6, far: 11 },
  TARGET: n => Math.max(6, Math.round(n * 1.15)),   // kills to open the door (placed monsters × 1.15)

  // ---------- scoring + pay ----------
  GEM: { small: 3, big: 12 },                // gem score; monsters drop gems worth about their points
  CLEAR: depth => 40 * depth,                 // bonus for clearing a floor
  CHEST: depth => 25 * depth,
  // pay (owner, 13 Nov): coins = round(score / 20), no cap, no ×2 game pay, no bricks (the dungeon will drop its own
  // material later). Measured on 30 days of maps: reaching B5 ≈ 94 coins, B10 ≈ 351, B12 ≈ 488, B20 ≈ 1,252.
  NORM: 20, PAY_CAP: null, GAME_PAY: 1, BRICKS: false,
  // daily checkpoints (owner, 13 Nov): beat a boss today → later runs today may start on the floor after it (B6, B11…).
  // Starting deeper gives catch-up level-ups so the build isn't empty: 3 picks per 5 floors skipped.
  CHECKPOINT: { every: 5, catchUp: 3 },
};
if (typeof module !== 'undefined') module.exports = DD;
