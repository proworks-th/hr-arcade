// Online services for the hub: shared rankings, "who's online" presence and the live activity feed.
// Firebase RTDB; the database rules only open rooms/$room, so everything lives under rooms/_rank and rooms/_hub.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getDatabase,ref,get,set,remove,push,onValue,onDisconnect,runTransaction,query,limitToLast,orderByChild,endAt,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {FIREBASE_CONFIG} from './firebase-config.js';

// max = sanity cap so an obviously broken score can't take the board
export const RANK_GAMES={spot:{max:30000},run:{max:200000},whack:{max:6000},stack:{max:400},dance:{max:400000},tetris:{max:2000000},stamp:{max:200000},barista:{max:30000},toss:{max:3000},slack:{max:200000},conga:{max:100000}};
export const PERIODS={d:'วันนี้',w:'สัปดาห์นี้',a:'ตลอดกาล'};
const db=()=>getDatabase(getApps().find(a=>a.name==='hub')||initializeApp(FIREBASE_CONFIG,'hub'));
// Thai calendar: day resets at midnight ICT, week starts Monday
const ymd=d=>`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
export function buckets(t=Date.now()){const d=new Date(t+7*3600e3),mon=new Date(d.getTime()-((d.getUTCDay()+6)%7)*864e5);return{d:ymd(d),w:ymd(mon),a:'all'}}
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
export async function board(game,period){
  if(!FIREBASE_CONFIG)return[];
  const snap=await get(ref(db(),`rooms/_rank/${game}/${period}/${buckets()[period]}`));
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
    room:{wall:String(p.room.wall).slice(0,20),floor:String(p.room.floor).slice(0,20),items,w:Math.min(22,Math.max(12,p.room.w|0||12))},t:serverTimestamp()});
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
  return set(ref(db(),`rooms/_farm/${nameKey(name)}`),{nm:name.trim().slice(0,20),who:String(f.who||'adam').slice(0,10),n:Math.min(10,f.n|0),plots:Array.from({length:Math.min(10,f.n|0)},(_,i)=>cleanPlot((f.plots||[])[i])),t:serverTimestamp()});
}
export async function listFarms(){
  if(!FIREBASE_CONFIG)return[];
  const s=await get(ref(db(),'rooms/_farm'));
  return Object.entries(s.val()||{}).map(([k,v])=>({k,...v,plots:(v.plots||[]).map(x=>x||null)})).sort((a,b)=>(b.t||0)-(a.t||0)).slice(0,60);
}
export function water(owner,i,from,s){return FIREBASE_CONFIG?set(ref(db(),`rooms/_farmw/${owner}/${i}/${nameKey(from)}`),{n:String(from).trim().slice(0,20),s}):Promise.resolve()}
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
// canteen board: rooms/_canteen/{week}={got:{crop:n},by:{key:{n,p}}}; returns how many were accepted (never past the goal)
export async function deliver(wk,crop,n,goal,name){
  if(!FIREBASE_CONFIG)return 0;
  const D=db();let took=0;
  await runTransaction(ref(D,`rooms/_canteen/${wk}/got/${crop}`),cur=>{took=Math.max(0,Math.min(n,goal-(+cur||0)));return took?(+cur||0)+took:undefined});
  if(took)await runTransaction(ref(D,`rooms/_canteen/${wk}/by/${nameKey(name)}`),cur=>({n:name.trim().slice(0,20),p:((cur&&cur.p)||0)+took}));
  return took;
}
export function watchCanteen(wk,cb){return FIREBASE_CONFIG?onValue(ref(db(),`rooms/_canteen/${wk}`),s=>cb(s.val()||{})):()=>{}}
/* ---------- cloud save: rooms/_save/{nameKey}={h:pinHash,d:{key:json},lt,lv,c,n,t} ---------- */
export function saveCloud(k,v){return FIREBASE_CONFIG?set(ref(db(),`rooms/_save/${k}`),{...v,t:serverTimestamp()}):Promise.resolve()}
export async function getCloud(k){if(!FIREBASE_CONFIG)return null;const s=await get(ref(db(),`rooms/_save/${k}`));return s.val()}

/* ---------- anonymous usage stats: rooms/_stat/{day}={u:{anonId:1},g:{game:plays},f:farmOpens} ---------- */
export function stat(kind,id){
  if(!FIREBASE_CONFIG)return;
  const D=db(),b=`rooms/_stat/${buckets().d}`,k=String(id||'').replace(/[.#$\[\]\/]/g,'_').slice(0,16);
  if(kind==='u')return set(ref(D,`${b}/u/${k}`),1);
  return runTransaction(ref(D,kind==='g'?`${b}/g/${k}`:`${b}/${kind}`),c=>(+c||0)+1);
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
export function watchOffice(cb){return FIREBASE_CONFIG?onValue(ref(db(),'rooms/_office/pts'),s=>cb(+s.val()||0)):()=>{}}
export async function officeBoard(){
  if(!FIREBASE_CONFIG)return[];
  const s=await get(ref(db(),'rooms/_office/by'));
  return Object.entries(s.val()||{}).map(([k,v])=>({k,...v})).sort((a,b)=>b.p-a.p);
}
