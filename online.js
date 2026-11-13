// Online services for the hub: shared rankings, "who's online" presence and the live activity feed.
// Firebase RTDB; the database rules only open rooms/$room, so everything lives under rooms/_rank and rooms/_hub.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getDatabase,ref,get,set,remove,push,onValue,onDisconnect,runTransaction,query,limitToLast,orderByChild,endAt,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {FIREBASE_CONFIG} from './firebase-config.js';

// max = sanity cap so an obviously broken score can't take the board
export const RANK_GAMES={spot:{max:30000},run:{max:200000},whack:{max:6000},stack:{max:400},dance:{max:400000},tetris:{max:2000000},stamp:{max:200000},barista:{max:30000},toss:{max:3000},slack:{max:200000},conga:{max:100000},prism:{max:1000}};
export const PERIODS={d:'วันนี้',w:'สัปดาห์นี้',m:'เดือนนี้ 🏆',a:'ตลอดกาล'};   // m = trophy season (calendar month)
const app=()=>getApps().find(a=>a.name==='hub')||initializeApp(FIREBASE_CONFIG,'hub'),db=()=>getDatabase(app());
// Thai calendar: day resets at midnight ICT, week starts Monday
const ymd=d=>`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
export function buckets(t=Date.now()){const d=new Date(t+7*3600e3),mon=new Date(d.getTime()-((d.getUTCDay()+6)%7)*864e5);return{d:ymd(d),w:ymd(mon),m:ymd(d).slice(0,6),a:'all'}}
export const nameKey=n=>(n||'').trim().toLowerCase().replace(/[.#$\[\]\/]/g,'_').slice(0,24)||'_';
export const ready=()=>!!FIREBASE_CONFIG;

/* ---------- rankings ---------- */
// returns {d,w,a}: true where this score became the player's best for that period
export async function submit(game,name,score,extra='',lv=0){
  if(!FIREBASE_CONFIG||!RANK_GAMES[game]||!name||!(score>0))return null;
  const s=Math.min(Math.round(score),RANK_GAMES[game].max),b=buckets(),k=nameKey(name),D=db(),t=Date.now(),out={};
  await Promise.all(Object.entries(b).map(async([p,bk])=>{
    const r=await runTransaction(ref(D,`rooms/_rank/${game}/${p}/${bk}/${k}`),cur=>{if(cur&&cur.s>=s)return;return{n:name.trim().slice(0,20),s,x:String(extra).slice(0,40),t,...(lv?{l:lv}:{})}});
    out[p]=r.committed;
  }));
  return out;
}
export function board(game,period){return boardAt(game,period,buckets()[period])}
export async function boardAt(game,period,bk){
  if(!FIREBASE_CONFIG)return[];
  const snap=await get(ref(db(),`rooms/_rank/${game}/${period}/${bk}`));
  return Object.entries(snap.val()||{}).map(([k,v])=>({k,...v})).sort((a,b)=>b.s-a.s||a.t-b.t);
}

/* ---------- presence: one node per open tab, removed by the server when the tab disconnects ---------- */
const SID=Math.random().toString(36).slice(2,10);
let me=null,beat=null;
export function setPresence(info){ // info: {n,a,g,lv} + room position {x,y} and per-game fields
  if(!FIREBASE_CONFIG)return;
  const r=ref(db(),`rooms/_hub/on/${SID}`);
  if(!me){onDisconnect(r).remove();beat=setInterval(()=>me&&set(r,{...me,t:serverTimestamp()}),60000)}
  me={j:Date.now(),...me,...info};set(r,{...me,t:serverTimestamp()});
}
// cb(list of {n,a,g,t}); entries without a heartbeat for 3 min are treated as gone
export function watchOnline(cb){
  if(!FIREBASE_CONFIG)return()=>{};
  return onValue(ref(db(),'rooms/_hub/on'),s=>{const now=Date.now();cb(Object.entries(s.val()||{}).map(([id,v])=>({id,me:id===SID,...v})).filter(v=>!v.t||now-v.t<180000))});
}

/* ---------- village (village.js): lots = rooms/_vil/lots/{id} {k,n,who,stage,end,g,h} ---------- */
export function watchLots(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_vil/lots'),s=>cb(s.val()||{})):()=>{}}
// reserve / build / help all go through a transaction on the one lot, so two people can never take the same lot
export function txLot(id,fn){return FIREBASE_CONFIG?runTransaction(ref(db(),`rooms/_vil/lots/${id|0}`),fn):Promise.resolve({committed:false})}
// community farm: rooms/_vil/cfarm/{x_y} = {o,by,bn,c,t,w,fw,rt,hk,hn} (one record per plot, kept forever, anyone may harvest)
export function watchCFarm(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_vil/cfarm'),s=>cb(s.val()||{})):()=>{}}
export function txCPlot(id,fn){return FIREBASE_CONFIG?runTransaction(ref(db(),`rooms/_vil/cfarm/${String(id).replace(/[^0-9_]/g,'')}`),fn):Promise.resolve({committed:false})}
// the village order everyone fills together: rooms/_vil/corder = {i,n,by:{key:count},nm:{key:name},h:{i:{key:count}}}
export function watchCOrder(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_vil/corder'),s=>cb(s.val())):()=>{}}
export function txCOrder(fn){return FIREBASE_CONFIG?runTransaction(ref(db(),'rooms/_vil/corder'),fn):Promise.resolve({committed:false})}

/* ---------- activity feed ---------- */
export function pushFeed(m,n='',a=''){if(FIREBASE_CONFIG)push(ref(db(),'rooms/_hub/feed'),{m:String(m).slice(0,120),n,a,t:serverTimestamp()})}
export function watchFeed(cb,n=8){
  if(!FIREBASE_CONFIG)return()=>{};
  return onValue(query(ref(db(),'rooms/_hub/feed'),limitToLast(n)),s=>cb(Object.values(s.val()||{}).sort((a,b)=>b.t-a.t)));
}
// keep the feed small: drop items older than 3 days (run once per page load)
export async function pruneFeed(){
  if(!FIREBASE_CONFIG)return;
  const old=await get(query(ref(db(),'rooms/_hub/feed'),orderByChild('t'),endAt(Date.now()-3*864e5)));
  old.forEach(c=>{remove(c.ref)});
}

/* ---------- "ออฟฟิศของฉัน" profiles: level, title and decorated room, plus likes from coworkers ---------- */
export function saveProfile(name,p){
  if(!FIREBASE_CONFIG||!name)return;
  const items=(p.room.items||[]).slice(0,90).map(([n,x,y,f])=>[String(n).slice(0,24),x|0,y|0,f?1:0]);
  return set(ref(db(),`rooms/_prof/${nameKey(name)}`),{n:name.trim().slice(0,20),lv:p.lv|0,ti:String(p.ti||'').slice(0,20),who:String(p.who||'adam').slice(0,10),b:String(p.b||'').slice(0,12),h:String(p.h||'').slice(0,12),f:String(p.f||'').slice(0,12),
    room:{wall:String(p.room.wall).slice(0,20),floor:String(p.room.floor).slice(0,20),items,cs:(p.room.cs||[]).slice(0,6).map(x=>String(x).slice(0,24)),w:Math.min(22,Math.max(12,p.room.w|0||12))},rt:+p.rt||0,t:serverTimestamp()});
}
export async function listProfiles(n=40){
  if(!FIREBASE_CONFIG)return[];
  const snap=await get(ref(db(),'rooms/_prof'));
  return Object.entries(snap.val()||{}).map(([k,v])=>({k,...v,room:{wall:'wall_mint',floor:'floor_wood',...(v.room||{}),items:(v.room&&v.room.items)||[]}}))
    .sort((a,b)=>(b.t||0)-(a.t||0)).slice(0,n);
}
// resolves true only for a first like from this person (the weekly "ห้องยอดไลก์" award counts those)
export async function like(ownerKey,fromName){
  if(!FIREBASE_CONFIG)return false;
  const r=ref(db(),`rooms/_like/${ownerKey}/${nameKey(fromName)}`);
  if((await get(r)).exists())return false;
  await set(r,1);return true;
}
// room visits + sticker notes: rooms/_visit/{ownerKey}/{day}/{visitorKey}={n:name,s:sticker,t}; the owner's read prunes days older than a week
export function visitRoom(ownerKey,name,aid){
  if(!FIREBASE_CONFIG||!ownerKey)return Promise.resolve();
  const vk=name?nameKey(name):'a_'+String(aid||'x').slice(0,10),b=`rooms/_visit/${ownerKey}/${buckets().d}/${vk}`,D=db();
  return Promise.all([set(ref(D,`${b}/n`),String(name||'').trim().slice(0,20)),set(ref(D,`${b}/t`),serverTimestamp())]);
}
export function stickRoom(ownerKey,name,s){
  if(!FIREBASE_CONFIG||!ownerKey||!name)return Promise.resolve();
  const b=`rooms/_visit/${ownerKey}/${buckets().d}/${nameKey(name)}`,D=db();
  return Promise.all([set(ref(D,`${b}/n`),name.trim().slice(0,20)),set(ref(D,`${b}/s`),String(s).slice(0,10)),set(ref(D,`${b}/t`),serverTimestamp())]);
}
// → {today:n, week:n, notes:[{k,n,s,t}] newest first, all:[{k,n,t}]}
export async function roomVisits(ownerKey,prune){
  if(!FIREBASE_CONFIG||!ownerKey)return{today:0,week:0,notes:[],all:[]};
  const s=(await get(ref(db(),`rooms/_visit/${ownerKey}`))).val()||{},cut=buckets(Date.now()-7*864e5).d,today=buckets().d,wk=new Set(),notes={},all=[];
  for(const [d,vs] of Object.entries(s)){
    if(d<cut){if(prune)remove(ref(db(),`rooms/_visit/${ownerKey}/${d}`));continue}
    for(const [k,v] of Object.entries(vs||{})){wk.add(k);all.push({k,...v});if(v.s&&(!notes[k]||(v.t||0)>(notes[k].t||0)))notes[k]={k,...v}}
  }
  return{today:Object.keys(s[today]||{}).length,week:wk.size,notes:Object.values(notes).sort((a,b)=>(b.t||0)-(a.t||0)),all};
}
// top-3 places this player holds in a trophy season (default: the current month) → [{g,r}]
export async function trophies(k,season=buckets().m){
  if(!FIREBASE_CONFIG||!k)return[];
  const out=[];
  await Promise.all(Object.keys(RANK_GAMES).map(g=>boardAt(g,'m',season).then(rows=>{const i=rows.findIndex(r=>r.k===k);if(i>=0&&i<3)out.push({g,r:i+1})}).catch(()=>{})));
  await get(ref(db(),`rooms/_fund/${season}`)).then(f=>{const i=fundRows(f.val()).filter(r=>r.p>=FUND_CUP_MIN).findIndex(r=>r.k===k);if(i>=0&&i<3)out.push({g:'fund',r:i+1})}).catch(()=>{});
  return out.sort((a,b)=>a.r-b.r);
}
/* ---------- seasons: office ladder (games played together), monthly room likes, hall of fame ---------- */
export function ladderAdd(name,aid,n=1){
  if(!FIREBASE_CONFIG)return;
  const k=name?nameKey(name):'a_'+String(aid||'x').replace(/[.#$\[\]\/]/g,'_').slice(0,20);
  runTransaction(ref(db(),`rooms/_ladder/${buckets().m}/${k}`),c=>({n:String(name||'').trim().slice(0,20),g:((c&&c.g)||0)+n}));
}
export async function ladder(season=buckets().m){
  if(!FIREBASE_CONFIG)return{total:0,rows:[]};
  const s=await get(ref(db(),`rooms/_ladder/${season}`)),rows=Object.entries(s.val()||{}).map(([k,v])=>({k,n:v.n||'',g:v.g|0})).sort((a,b)=>b.g-a.g);
  return{total:rows.reduce((t,r)=>t+r.g,0),rows};
}
export function likeMonth(ownerKey,fromName){return FIREBASE_CONFIG&&fromName?set(ref(db(),`rooms/_likem/${buckets().m}/${ownerKey}/${nameKey(fromName)}`),1):Promise.resolve()}
export async function likeBoard(season=buckets().m){
  if(!FIREBASE_CONFIG)return[];
  const s=await get(ref(db(),`rooms/_likem/${season}`));
  return Object.entries(s.val()||{}).map(([k,v])=>({k,c:Object.keys(v||{}).length})).sort((a,b)=>b.c-a.c);
}
export async function fameAll(){if(!FIREBASE_CONFIG)return{};const s=await get(ref(db(),'rooms/_fame'));return s.val()||{}}
export async function fame(season){if(!FIREBASE_CONFIG)return null;const s=await get(ref(db(),`rooms/_fame/${season}`));return s.val()}
// writes the hall-of-fame record for a finished month once (the first visitor of the new month does it); returns it when this call wrote it
export async function closeSeason(ss){
  if(!FIREBASE_CONFIG)return null;
  const r=ref(db(),`rooms/_fame/${ss}`);if((await get(r)).exists())return null;
  const champ={};
  await Promise.all(Object.keys(RANK_GAMES).map(g=>boardAt(g,'m',ss).then(rows=>{if(rows[0])champ[g]={k:rows[0].k,n:rows[0].n,s:rows[0].s}}).catch(()=>{})));
  const L=await ladder(ss),lk=(await likeBoard(ss))[0];
  let room=null;if(lk&&lk.c>=2){const p=(await get(ref(db(),`rooms/_prof/${lk.k}`))).val()||{};room={k:lk.k,n:p.n||lk.k,c:lk.c}}
  const rec={champ,lad:{t:L.total,top:L.rows.filter(x=>x.n).slice(0,3).map(x=>({n:x.n,g:x.g}))},...(room?{room}:{}),t:Date.now()};
  const tx=await runTransaction(r,c=>c?undefined:rec);
  return tx.committed?rec:null;
}
export async function likeCount(ownerKey){if(!FIREBASE_CONFIG)return 0;const s=await get(ref(db(),`rooms/_like/${ownerKey}`));return Object.keys(s.val()||{}).length}

/* ---------- ห้องรวม: chat, the shared party-game state and the server clock ---------- */
export const mySid=()=>SID;
export function chat(m,n,w){if(FIREBASE_CONFIG)push(ref(db(),'rooms/_hub/chat'),{m:String(m).slice(0,80),n:String(n).slice(0,20),w:String(w||'').slice(0,10),s:SID,t:serverTimestamp()})}
export function watchChat(cb,n=20){
  if(!FIREBASE_CONFIG)return()=>{};
  return onValue(query(ref(db(),'rooms/_hub/chat'),limitToLast(n)),s=>cb(Object.values(s.val()||{}).sort((a,b)=>a.t-b.t)));
}
export async function pruneChat(){
  if(!FIREBASE_CONFIG)return;
  const old=await get(query(ref(db(),'rooms/_hub/chat'),orderByChild('t'),endAt(Date.now()-864e5)));
  old.forEach(c=>{remove(c.ref)});
}
export function watchGame(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_hub/game'),s=>cb(s.val()||{sc:'lobby'})):()=>{}}
export function txGame(fn){return FIREBASE_CONFIG?runTransaction(ref(db(),'rooms/_hub/game'),fn):Promise.resolve({committed:false})}
export function watchOffset(cb){if(FIREBASE_CONFIG)onValue(ref(db(),'.info/serverTimeOffset'),s=>cb(s.val()||0))}

/* ---------- office level: every coin anyone earns adds to one shared counter (rooms/_office) ---------- */
export async function addOffice(n,name){
  if(!FIREBASE_CONFIG||!(n>0))return null;
  const D=db();let before=0;n=Math.min(200,Math.round(n));
  await runTransaction(ref(D,'rooms/_office/pts'),cur=>{before=+cur||0;return before+n});
  if(name)runTransaction(ref(D,`rooms/_office/by/${nameKey(name)}`),cur=>({n:name.trim().slice(0,20),p:((cur&&cur.p)||0)+n}));
  return{before,after:before+n};
}
/* ---------- ฟาร์มดาดฟ้า: public copy of each garden + friends' water ---------- */
const cleanPlot=x=>x&&x.c?{c:String(x.c).slice(0,6),t:+x.t||0,w:x.w?1:0}:0;
export function saveFarm(name,f){
  if(!FIREBASE_CONFIG||!name)return;
  return set(ref(db(),`rooms/_farm/${nameKey(name)}`),{nm:name.trim().slice(0,20),who:String(f.who||'adam').slice(0,10),n:Math.min(24,f.n|0),...(f.y?{y:1}:{}),plots:Array.from({length:Math.min(24,f.n|0)},(_,i)=>cleanPlot((f.plots||[])[i])),t:serverTimestamp()});
}
export async function listFarms(){
  if(!FIREBASE_CONFIG)return[];
  const s=await get(ref(db(),'rooms/_farm'));
  return Object.entries(s.val()||{}).map(([k,v])=>({k,...v,plots:(v.plots||[]).map(x=>x||null)})).sort((a,b)=>(b.t||0)-(a.t||0)).slice(0,60);
}
export function water(owner,i,from,s){return FIREBASE_CONFIG?set(ref(db(),`rooms/_farmw/${owner}/${i}/${nameKey(from)}`),{n:String(from).trim().slice(0,20),s}):Promise.resolve()}
// every garden's friend water at once (the office tower shows who still needs a 💧)
export async function allWaters(){if(!FIREBASE_CONFIG)return{};const s=await get(ref(db(),'rooms/_farmw'));return s.val()||{}}
export async function getWaters(owner){if(!FIREBASE_CONFIG)return{};const s=await get(ref(db(),`rooms/_farmw/${owner}`));return s.val()||{}}
export function watchWaters(owner,cb){return FIREBASE_CONFIG?onValue(ref(db(),`rooms/_farmw/${owner}`),s=>cb(s.val()||{})):()=>{}}
export function clearWaters(owner,i){if(FIREBASE_CONFIG)remove(ref(db(),`rooms/_farmw/${owner}/${i}`))}
// gifts: rooms/_gift/{toKey}/{pushId}={f:fromName,c:basketKey,t}; taken (read + removed) when the receiver opens the farm
export function sendGift(toKey,from,c){return FIREBASE_CONFIG?push(ref(db(),`rooms/_gift/${toKey}`),{f:String(from).trim().slice(0,20),c:String(c).slice(0,8),t:serverTimestamp()}):Promise.resolve()}
export async function takeGifts(me){
  if(!FIREBASE_CONFIG)return[];
  const s=await get(ref(db(),`rooms/_gift/${me}`)),out=[];
  s.forEach(c=>{const v=c.val();if(v&&v.c){out.push(v);remove(c.ref)}});
  return out;
}
/* ---------- farm market: rooms/_mkt/o/{id}={s:'s'|'b',c,q,l,p,k,n,d,t} resting orders (d = hours it stays up) (crops or coins already held by the owner);
   a fill owed to a resting order's owner waits in rooms/_mkt/c/{key}/{id}={s,c,u,p,n,t}; NPC vendor lots taken: rooms/_mkt/bt/{slot}=n ---------- */
export function watchMkt(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_mkt/o'),s=>cb(s.val()||{})):()=>{}}
export function watchNpc(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_mkt/bt'),s=>cb(s.val()||{})):()=>{}}
export async function mktPut(o){const r=await push(ref(db(),'rooms/_mkt/o'),{s:o.s,c:String(o.c).slice(0,4),q:o.q|0,l:o.q|0,p:o.p|0,k:o.k,n:String(o.n).trim().slice(0,20),d:Math.max(1,Math.min(24,o.d|0||24)),t:serverTimestamp()});return r.key}
// take up to n from a resting order (own=true: only my own, for cancelling; otherwise never my own); returns how many were taken
export async function mktTake(id,n,me,own){
  if(!FIREBASE_CONFIG)return 0;let got=0;
  const r=await runTransaction(ref(db(),`rooms/_mkt/o/${id}`),cur=>{got=0;if(!cur)return cur;if(own?cur.k!==me:cur.k===me)return;
    got=Math.min(n|0,cur.l|0);if(got<=0)return;const l=cur.l-got;return l>0?{...cur,l}:null});
  return r.committed?got:0;
}
// take up to n from an NPC vendor lot of size q
export async function npcTake(id,n,q){
  if(!FIREBASE_CONFIG)return 0;let got=0;
  const r=await runTransaction(ref(db(),`rooms/_mkt/bt/${id}`),cur=>{got=Math.min(n|0,q-(cur|0));if(got<=0)return;return (cur|0)+got});
  return r.committed?got:0;
}
export function mktClaim(toKey,v){return FIREBASE_CONFIG?push(ref(db(),`rooms/_mkt/c/${toKey}`),{s:v.s,c:v.c,u:v.u|0,p:v.p|0,n:String(v.n).trim().slice(0,20),t:serverTimestamp()}):Promise.resolve()}
export function watchMktClaims(me,cb){return FIREBASE_CONFIG?onValue(ref(db(),`rooms/_mkt/c/${me}`),s=>cb(Object.keys(s.val()||{}))):()=>{}}
// each claim is removed in a transaction, so two open tabs never pay it twice
export async function takeMktClaim(me,id){
  if(!FIREBASE_CONFIG)return null;let v=null;
  const r=await runTransaction(ref(db(),`rooms/_mkt/c/${me}/${id}`),cur=>{v=cur;return null});
  return r.committed&&v&&v.c?v:null;
}
// vendor counts from before the last 24 h are no longer needed
export async function pruneNpc(minP){
  if(!FIREBASE_CONFIG)return;const s=await get(ref(db(),'rooms/_mkt/bt'));
  s.forEach(c=>{if((parseInt(c.key,10)||0)<minP)remove(c.ref)});
}
// canteen orders: rooms/_canteen/{week}={q:{slot:{r,got,done,by,prev:{r,by}}},by:{key:{n,p}}} (by = the week's helpers board).
// A filled order (done = time) waits cd ms, then the next delivery opens round r+1 (prev keeps who helped, so they can still claim).
// Returns how many were accepted (never past the goal); 0 when the round changed or the order is cooling down.
export async function deliverQ(wk,s,r,n,goal,name,now,cd){
  if(!FIREBASE_CONFIG)return 0;
  const D=db(),k=nameKey(name),nm=name.trim().slice(0,20);let took=0;
  await runTransaction(ref(D,`rooms/_canteen/${wk}/q/${s}`),cur=>{
    let q=cur||{r:0,got:0};took=0;
    if(q.done&&now>=q.done+cd)q={r:(q.r||0)+1,got:0,prev:{r:q.r||0,by:q.by||{}}};
    if((q.r||0)!==r||q.done)return undefined;
    took=Math.max(0,Math.min(n,goal-(q.got||0)));if(!took)return undefined;
    const by=Object.assign({},q.by);by[k]={n:nm,p:((by[k]&&by[k].p)||0)+took};
    q=Object.assign({},q,{got:(q.got||0)+took,by});if(q.got>=goal)q.done=now;
    return q;
  });
  if(took)await runTransaction(ref(D,`rooms/_canteen/${wk}/by/${k}`),cur=>({n:nm,p:((cur&&cur.p)||0)+took}));
  return took;
}
// (old weekly board, kept for clients that have not reloaded yet)
export async function deliver(wk,crop,n,goal,name){
  if(!FIREBASE_CONFIG)return 0;
  const D=db();let took=0;
  await runTransaction(ref(D,`rooms/_canteen/${wk}/got/${crop}`),cur=>{took=Math.max(0,Math.min(n,goal-(+cur||0)));return took?(+cur||0)+took:undefined});
  if(took)await runTransaction(ref(D,`rooms/_canteen/${wk}/by/${nameKey(name)}`),cur=>({n:name.trim().slice(0,20),p:((cur&&cur.p)||0)+took}));
  return took;
}
/* ---------- กองทุนออฟฟิศ: a voluntary monthly coin pot rooms/_fund/{yyyymm}={got,by:{key:{n,p}}}; top 3 donors get a cup ---------- */
export const FUND_CUP_MIN=100;
export async function fundGive(n,name){
  if(!FIREBASE_CONFIG||!(n>0)||!name)return null;
  const D=db(),m=buckets().m;n=Math.min(1000,Math.round(n));let after=0;
  await runTransaction(ref(D,`rooms/_fund/${m}/got`),cur=>(after=(+cur||0)+n));
  await runTransaction(ref(D,`rooms/_fund/${m}/by/${nameKey(name)}`),cur=>({n:name.trim().slice(0,20),p:((cur&&cur.p)||0)+n}));
  return{before:after-n,after};
}
const fundRows=v=>Object.entries((v&&v.by)||{}).map(([k,x])=>({k,...x})).filter(r=>r.p>0).sort((a,b)=>b.p-a.p);
export function watchFund(cb,m=buckets().m){return FIREBASE_CONFIG?onValue(ref(db(),`rooms/_fund/${m}`),s=>{const v=s.val()||{};cb({m,got:+v.got||0,by:fundRows(v)})}):()=>{}}
export function watchCanteen(wk,cb){return FIREBASE_CONFIG?onValue(ref(db(),`rooms/_canteen/${wk}`),s=>cb(s.val()||{})):()=>{}}
/* ---------- cloud save: rooms/_save/{nameKey}={h:pinHash,d:{key:json},lt,lv,c,n,t} ---------- */
export function saveCloud(k,v){return FIREBASE_CONFIG?set(ref(db(),`rooms/_save/${k}`),{...v,t:serverTimestamp()}):Promise.resolve()}
export async function getCloud(k){if(!FIREBASE_CONFIG)return null;const s=await get(ref(db(),`rooms/_save/${k}`));return s.val()}

/* ---------- accounts: everyone plays as an anonymous guest until they link Google (same uid, nothing moves) ---------- */
// auth is loaded on demand so the rest of the online features never wait on it
const AU=()=>import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
const acct=u=>u&&{uid:u.uid,guest:!!u.isAnonymous,email:u.email||''};
// current account, signing in as a guest when there is none; null when sign-in is off in the console (or offline),
// with the reason kept for authErr()
let authE='';
export const authErr=()=>authE;
export async function account(){
  if(!FIREBASE_CONFIG)return null;
  try{const M=await AU(),a=M.getAuth(app());
    const u=await new Promise(r=>{const off=M.onAuthStateChanged(a,u=>{off();r(u)})});
    authE='';return acct(u||(await M.signInAnonymously(a)).user);
  }catch(e){authE=(e&&(e.code||e.message))||'unknown';return null}
}
// shared computer: forget the sign-in when the browser closes
export async function setShared(on){const M=await AU();await M.setPersistence(M.getAuth(app()),on?M.browserSessionPersistence:M.browserLocalPersistence)}
// link Google to the current guest; when that Google account already belongs to another save, sign in to that one instead
// → {acct, switched}
export async function google(){
  const M=await AU(),a=M.getAuth(app()),p=new M.GoogleAuthProvider();
  if(a.currentUser&&a.currentUser.isAnonymous){
    try{return{acct:acct((await M.linkWithPopup(a.currentUser,p)).user),switched:false}}
    catch(e){if(e.code!=='auth/credential-already-in-use')throw e;
      return{acct:acct((await M.signInWithCredential(a,M.GoogleAuthProvider.credentialFromError(e))).user),switched:true}}
  }
  return{acct:acct((await M.signInWithPopup(a,p)).user),switched:true};
}
export async function logout(){const M=await AU();await M.signOut(M.getAuth(app()))}
// saves by account: rooms/_usave/{uid}={d:{key:json},lt,lv,c,n,t}
export function saveUser(uid,v){return FIREBASE_CONFIG?set(ref(db(),`rooms/_usave/${uid}`),{...v,t:serverTimestamp()}):Promise.resolve()}
export async function getUser(uid){if(!FIREBASE_CONFIG)return null;const s=await get(ref(db(),`rooms/_usave/${uid}`));return s.val()}

/* ---------- anonymous usage stats: rooms/_stat/{day}={u:{anonId:1},g:{game:finished plays},s:{game:starts},
   o:{feature:opens},p:{feature or game:{anonId:1}},f:farmOpens,e:{in_src|out_sink|event:amount},w:{anonId:{l,c,b}}} ---------- */
export function stat(kind,id,aid,n=1){
  if(!FIREBASE_CONFIG)return;
  const D=db(),b=`rooms/_stat/${buckets().d}`,cl=x=>String(x||'').replace(/[.#$\[\]\/]/g,'_').slice(0,16),k=cl(id);
  if(kind==='u')return set(ref(D,`${b}/u/${k}`),1);
  if(kind==='d')return set(ref(D,`${b}/d/${cl(aid)}`),k);              // device per browser per day: m = phone/tablet, c = computer
  if(kind==='w')return set(ref(D,`${b}/w/${cl(aid)}`),id);              // id = {l:level,c:coins,b:basket items}
  if(kind==='e')return runTransaction(ref(D,`${b}/e/${k}`),c=>(+c||0)+(+n||0)); // economy counter, n = amount
  if((kind==='s'||kind==='o')&&aid)set(ref(D,`${b}/p/${k}/${cl(aid)}`),1);
  return runTransaction(ref(D,kind==='g'||kind==='s'||kind==='o'?`${b}/${kind}/${k}`:`${b}/${kind}`),c=>(+c||0)+1);
}
export async function stats(){if(!FIREBASE_CONFIG)return{};const s=await get(ref(db(),'rooms/_stat'));return s.val()||{}}

/* ---------- weekly office awards: rooms/_wk/{week}/{cat}/{nameKey}={n,v} ---------- */
export function wkAdd(cat,name,n){
  if(!FIREBASE_CONFIG||!name||!(n>0))return;
  return runTransaction(ref(db(),`rooms/_wk/${buckets().w}/${cat}/${nameKey(name)}`),cur=>({n:name.trim().slice(0,20),v:((cur&&cur.v)||0)+Math.min(500,Math.round(n))}));
}
// {cat:[{k,n,v}] best first} for one week; "rec" = most #1 spots on that week's game boards, "cant" = canteen deliveries
export async function weekAwards(w){
  if(!FIREBASE_CONFIG)return{};
  const D=db(),out={},rows=o=>Object.entries(o||{}).map(([k,x])=>({k,n:x.n,v:x.v})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const [wk,cant,...boards]=await Promise.all([get(ref(D,`rooms/_wk/${w}`)),get(ref(D,`rooms/_canteen/${w}/by`)),...Object.keys(RANK_GAMES).map(g=>get(ref(D,`rooms/_rank/${g}/w/${w}`)))]);
  Object.entries(wk.val()||{}).forEach(([c,o])=>{if(c[0]!=='_')out[c]=rows(o)});
  out.cant=rows(Object.fromEntries(Object.entries(cant.val()||{}).map(([k,x])=>[k,{n:x.n,v:x.p}])));
  const rec={};
  boards.forEach(s=>{const top=Object.entries(s.val()||{}).sort((a,b)=>b[1].s-a[1].s||a[1].t-b[1].t)[0];
    if(top){const r=rec[top[0]]||(rec[top[0]]={n:top[1].n,v:0});r.v++}});
  out.rec=rows(rec);
  return out;
}
// true for exactly one caller per week, so the announcement goes to the feed once
export async function wkAnnounce(w){
  if(!FIREBASE_CONFIG)return false;
  const r=await runTransaction(ref(db(),`rooms/_wk/${w}/_a`),cur=>cur?undefined:1);
  return r.committed;
}
// true for exactly one caller ever (per path) — one-time announcements such as a launch post
export async function onceFlag(path){
  if(!FIREBASE_CONFIG)return false;
  const r=await runTransaction(ref(db(),path),cur=>cur?undefined:Date.now());
  return r.committed;
}
export function watchOffice(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_office/pts'),s=>cb(+s.val()||0)):()=>{}}
export async function officeBoard(){
  if(!FIREBASE_CONFIG)return[];
  const s=await get(ref(db(),'rooms/_office/by'));
  return Object.entries(s.val()||{}).map(([k,v])=>({k,...v})).sort((a,b)=>b.p-a.p);
}

/* ---------- rename (13 Nov 2026): name-keyed records follow the player to the new name ---------- */
// Village houses also carry the owner's account uid (village.js), so a house can't be orphaned by a rename again.
// Refuses a name another player already uses (their profile exists), so two people can't merge by sharing a name.
export async function renameRecords(oldName,newName){
  if(!FIREBASE_CONFIG)return{ok:false,offline:true};
  const D=db(),ok=nameKey(oldName),nk=nameKey(newName),nm=newName.trim().slice(0,20);
  if(!oldName.trim()||ok===nk)return{ok:true};
  if((await get(ref(D,`rooms/_prof/${nk}`))).exists())return{ok:false,taken:true};
  const likes=(await get(ref(D,`rooms/_like/${ok}`))).val();
  if(likes)await runTransaction(ref(D,`rooms/_like/${nk}`),cur=>({...likes,...(cur||{})}));
  const off=(await get(ref(D,`rooms/_office/by/${ok}`))).val();
  if(off&&off.p)await runTransaction(ref(D,`rooms/_office/by/${nk}`),cur=>({n:nm,p:((cur&&cur.p)||0)+off.p}));
  const lots=(await get(ref(D,'rooms/_vil/lots'))).val()||{};
  for(const id of Object.keys(lots))if(lots[id]&&lots[id].k===ok)await runTransaction(ref(D,`rooms/_vil/lots/${id|0}`),cur=>cur&&cur.k===ok?{...cur,k:nk,n:nm}:undefined);
  for(const p of [`rooms/_like/${ok}`,`rooms/_office/by/${ok}`,`rooms/_prof/${ok}`,`rooms/_farm/${ok}`])await remove(ref(D,p));
  return{ok:true};
}
