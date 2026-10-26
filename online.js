// Online services for the hub: shared rankings, "who's online" presence and the live activity feed.
// Firebase RTDB; the database rules only open rooms/$room, so everything lives under rooms/_rank and rooms/_hub.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getDatabase,ref,get,set,remove,push,onValue,onDisconnect,runTransaction,query,limitToLast,orderByChild,endAt,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {FIREBASE_CONFIG} from './firebase-config.js';

// max = sanity cap so an obviously broken score can't take the board
export const RANK_GAMES={spot:{max:30000},run:{max:200000},whack:{max:6000},stack:{max:400},dance:{max:400000}};
export const PERIODS={d:'วันนี้',w:'สัปดาห์นี้',a:'ตลอดกาล'};
const db=()=>getDatabase(getApps().find(a=>a.name==='hub')||initializeApp(FIREBASE_CONFIG,'hub'));
// Thai calendar: day resets at midnight ICT, week starts Monday
const ymd=d=>`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
export function buckets(t=Date.now()){const d=new Date(t+7*3600e3),mon=new Date(d.getTime()-((d.getUTCDay()+6)%7)*864e5);return{d:ymd(d),w:ymd(mon),a:'all'}}
export const nameKey=n=>(n||'').trim().toLowerCase().replace(/[.#$\[\]\/]/g,'_').slice(0,24)||'_';
export const ready=()=>!!FIREBASE_CONFIG;

/* ---------- rankings ---------- */
// returns {d,w,a}: true where this score became the player's best for that period
export async function submit(game,name,score,extra=''){
  if(!FIREBASE_CONFIG||!RANK_GAMES[game]||!name||!(score>0))return null;
  const s=Math.min(Math.round(score),RANK_GAMES[game].max),b=buckets(),k=nameKey(name),D=db(),t=Date.now(),out={};
  await Promise.all(Object.entries(b).map(async([p,bk])=>{
    const r=await runTransaction(ref(D,`rooms/_rank/${game}/${p}/${bk}/${k}`),cur=>{if(cur&&cur.s>=s)return;return{n:name.trim().slice(0,20),s,x:String(extra).slice(0,40),t}});
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
export function setPresence(info){ // info: {n,a,g}
  if(!FIREBASE_CONFIG)return;
  const r=ref(db(),`rooms/_hub/on/${SID}`);
  if(!me){onDisconnect(r).remove();beat=setInterval(()=>me&&set(r,{...me,t:serverTimestamp()}),60000)}
  me={...me,...info};set(r,{...me,t:serverTimestamp()});
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
