// Shared leaderboards (today / this week / all time) for the solo games.
// Stored in Firebase RTDB under rooms/_rank (the database rules only open rooms/$room); one best score per nickname per period.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getDatabase,ref,get,runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {FIREBASE_CONFIG} from './firebase-config.js';

// max = sanity cap so an obviously broken score can't take the board
export const RANK_GAMES={spot:{max:30000},run:{max:200000},whack:{max:6000},stack:{max:400}};
export const PERIODS={d:'วันนี้',w:'สัปดาห์นี้',a:'ตลอดกาล'};
const db=()=>getDatabase(getApps().find(a=>a.name==='rank')||initializeApp(FIREBASE_CONFIG,'rank'));
// Thai calendar: day resets at midnight ICT, week starts Monday
const ymd=d=>`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;
export function buckets(t=Date.now()){const d=new Date(t+7*3600e3),mon=new Date(d.getTime()-((d.getUTCDay()+6)%7)*864e5);return{d:ymd(d),w:ymd(mon),a:'all'}}
export const nameKey=n=>(n||'').trim().toLowerCase().replace(/[.#$\[\]\/]/g,'_').slice(0,24)||'_';
export const ready=()=>!!FIREBASE_CONFIG;

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
