// "ความชำนาญ" (life skills) — prototype of GDD §12 v2 (12 Nov 2026, owner: skills make you better at the activity,
// walls by tool not by skill, titles are the social reward). Classic script; needs Prog + bkkDay (office.js or a mock).
// State: Prog.get().sk = { xp: {farm: n, ...}, day: 'YYYY-MM-DD', today: {farm: n, ...}, title: 'farm' | null }
// Every bonus is capped (see CAP) so a maxed skill never prints coins: farming is ~84% of income (GDD §2).
'use strict';
const Skills = (() => {
  // id → [Thai name, phase, tier titles (T1..T5)]
  const DEF = {
    farm:   ['การเกษตร',   1, ['มือใหม่หัดปลูก', 'ชาวสวนขยัน', 'เกษตรกรประจำซอย', 'ปราชญ์ชาวบ้าน', 'นักปลูกผักมือทอง']],
    pet:    ['ดูแลสัตว์เลี้ยง', 1, ['คนรักสัตว์', 'พี่เลี้ยงใจดี', 'ทาสแมวตัวจริง', 'หมอแมวประจำซอย', 'ราชาแห่งสัตว์เลี้ยง']],
    combat: ['การต่อสู้',    1, ['นักผจญภัยมือใหม่', 'นักดาบประจำซอย', 'ผู้พิทักษ์ดันเจี้ยน', 'นักล่ายักษ์', 'ตำนานดันเจี้ยน']],
    cook:   ['ทำอาหาร',     2, ['ลูกมือในครัว', 'แม่ครัวฝึกหัด', 'เชฟประจำซอย', 'เชฟมือทอง', 'ตำนานโรงอาหาร']],
    mine:   ['ขุดแร่',       2, ['คนขุดหิน', 'ช่างเหมือง', 'นักล่าแร่', 'เซียนอัญมณี', 'เจ้าแห่งเหมือง']],
    forage: ['หาของป่า',     2, ['คนเดินป่า', 'นักเก็บสมุนไพร', 'พรานป่า', 'ผู้รู้แห่งป่า', 'เจ้าป่า']],
    fish:   ['ตกปลา',       2, ['มือใหม่หัดตก', 'นักตกปลาวันหยุด', 'ชาวประมงประจำซอย', 'เซียนเบ็ด', 'ราชาแห่งสายน้ำ']],
  };
  // XP to reach each tier (cumulative). With the daily cap (DAY_CAP) a player at the cap every day reaches
  // T1 day 1, T2 ~day 3, T3 ~day 7, T4 ~day 14, T5 ~day 25: the same 2–4 week window as the house (GDD §3).
  const TIER_XP = [100, 500, 1300, 2700, 5000];
  const DAY_CAP = 200;
  // what each tier gives. `b` = numeric bonuses (looked up with bonus()), `u` = unlocks shown on the card.
  // The values at T5 are the caps; nothing stacks past them.
  const PERKS = {
    farm: [{ u: 'ตำแหน่ง "มือใหม่หัดปลูก"' }, { b: { grow: .03 }, u: 'ผักโตเร็วขึ้น 3%' }, { b: { grow: .06 }, u: 'ผักโตเร็วขึ้น 6% · เมล็ดพันธุ์ลายทอง (ของแต่งสวน)' },
      { b: { grow: .06, extra: .05 }, u: 'เก็บเกี่ยวได้ผลเพิ่ม 1 ลูก (โอกาส 5%)' }, { b: { grow: .10, extra: .10 }, u: 'ผักโตเร็วขึ้น 10% · ผลเพิ่ม 10% · ตำแหน่ง "นักปลูกผักมือทอง"' }],
    pet: [{ u: 'ตำแหน่ง "คนรักสัตว์"' }, { b: { fedH: 2 }, u: 'อิ่มนานขึ้น 2 ชม.' }, { b: { fedH: 2 }, u: 'ท่าใหม่: กลิ้งตัว' },
      { b: { fedH: 3 }, u: 'อิ่มนานขึ้น 3 ชม. · ปลอกคอลายดาว' }, { b: { fedH: 4 }, u: 'อิ่มนานขึ้น 4 ชม. · ท่าใหม่: ไฮไฟว์ · ตำแหน่ง "ราชาแห่งสัตว์เลี้ยง"' }],
    // combat tiers carry between dungeon runs (owner, 13 Nov: runs needed lasting progression)
    combat: [{ b: { pick: 1 }, u: 'เลือกอาวุธเริ่มต้นได้ · ตำแหน่ง "นักผจญภัยมือใหม่"' }, { b: { pick: 1, hp: 1 }, u: 'หัวใจ +1' },
      { b: { pick: 1, hp: 1, dmg: .10, reroll: 1 }, u: 'แรง +10% · สุ่มตัวเลือกเลเวลใหม่ได้ 1 ครั้งต่อรอบ' },
      { b: { pick: 1, hp: 2, dmg: .10, reroll: 1, lv: 1 }, u: 'หัวใจ +2 · เริ่มรอบที่เลเวล 2' },
      { b: { pick: 1, hp: 2, dmg: .20, reroll: 2, lv: 1 }, u: 'แรง +20% · สุ่มใหม่ได้ 2 ครั้ง · ตำแหน่ง "ตำนานดันเจี้ยน"' }],
  };
  const CAP = { grow: .10, extra: .10, fedH: 4, hp: 2, dmg: .20, reroll: 2, lv: 1, pick: 1 };

  const st = () => { const p = Prog.get(); p.sk ||= { xp: {}, today: {}, day: '', title: null }; return p; };
  const xp = id => (st().sk.xp[id] || 0);
  const tier = id => TIER_XP.filter(n => xp(id) >= n).length;          // 0 = not started, 5 = max
  const next = id => { const t = tier(id); if (t >= 5) return null; const lo = t ? TIER_XP[t - 1] : 0, hi = TIER_XP[t]; return { lo, hi, at: xp(id), frac: (xp(id) - lo) / (hi - lo) }; };
  const todayLeft = id => { const s = st().sk; return s.day === bkkDay() ? Math.max(0, DAY_CAP - (s.today[id] || 0)) : DAY_CAP; };

  // add skill XP; returns { got, capped, up } (up = new tier number if a tier was reached)
  function add(id, n) {
    if (!DEF[id] || DEF[id][1] > 1 || !(n > 0)) return { got: 0, capped: false, up: 0 };
    const p = st(), s = p.sk; if (s.day !== bkkDay()) { s.day = bkkDay(); s.today = {}; }
    const before = tier(id), got = Math.min(Math.round(n), DAY_CAP - (s.today[id] || 0));
    if (got <= 0) return { got: 0, capped: true, up: 0 };
    s.xp[id] = (s.xp[id] || 0) + got; s.today[id] = (s.today[id] || 0) + got; Prog.put(p);
    const after = tier(id);
    return { got, capped: got < n, up: after > before ? after : 0 };
  }
  // numeric bonus for a skill, already capped: Skills.bonus('farm', 'grow') → 0 … .10
  function bonus(id, key) {
    const t = tier(id); if (!t || !PERKS[id]) return 0;
    const v = (PERKS[id][t - 1].b || {})[key] || 0; return Math.min(v, CAP[key] ?? v);
  }
  // titles: one shown on the name tag. Every reached tier of every skill is a title you can wear.
  const titles = () => Object.keys(DEF).flatMap(id => DEF[id][2].slice(0, tier(id)).map((t, i) => ({ id, t: i + 1, name: t })));
  const title = () => { const w = st().sk.title; if (!w) return null; const [id, t] = w.split(':'); return tier(id) >= +t ? DEF[id][2][t - 1] : null; };
  function wear(id, t) { const p = st(); p.sk.title = id ? id + ':' + t : null; Prog.put(p); }

  return { DEF, TIER_XP, DAY_CAP, PERKS, CAP, xp, tier, next, todayLeft, add, bonus, titles, title, wear };
})();
