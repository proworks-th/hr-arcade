// Online party mode: shared lobby + "Fall Guys"-style race + "Overcooked"-style co-op document kitchen.
// Sync: Firebase Realtime Database (settings in firebase-config.js).
// Art: 2dPig "Pixel Office Asset Pack" (CC0) cut into assets/pixel + hand-drawn floor/desk tiles; sfx: Kenney (CC0).
// Uses helpers defined in index.html: runSfx, store, toast, fmt, mulberry32, bossOn.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getDatabase,ref,set,remove,onValue,onDisconnect,push,onChildAdded,runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {FIREBASE_CONFIG} from './firebase-config.js';

const TS=32,VW=800,VH=448,GRAV=1600,MAXV=230,JUMP=560,SPRING=900,PW=20,PH=30;
const AVAS=['p_office','p_woffice','p_whealth','p_tech','p_cat','p_dog'];
const ava=c=>AVAS.includes(c)?c:'p_office';
const OIMG={};
function oImg(n){if(!OIMG[n]){const i=new Image();i.src='assets/pixel/'+n+'.png';OIMG[n]=i}return OIMG[n]}
const PROPS=['cabinet','plant','vending','sofa','printer','coffee','plant','sofa2'];
const EMOTES=['👋','😂','😱','👍','🔥','หัวหน้ามา!','รอด้วย!','GG'];
const RECIPES=[{n:'ใบลากิจ',f:1,s:0,g:0,pts:20},{n:'ใบลาป่วย',f:1,s:1,g:0,pts:30},{n:'ขอ OT',f:1,s:0,g:1,pts:30},{n:'หนังสือรับรอง',f:1,s:1,g:1,pts:50}];
const KST=[{id:'paper',t:'paper',tx:1,sp:'printer',lab:'หยิบกระดาษ'},{id:'fill1',t:'fill',tx:4,sp:'laptop',lab:'โต๊ะกรอก'},
  {id:'trash',t:'trash',tx:7,sp:'trash',lab:'ถังขยะ'},{id:'stamp',t:'stamp',tx:16,sp:'stamp',lab:'ปั๊มตรา'},
  {id:'fill2',t:'fill',tx:19,sp:'laptop',lab:'โต๊ะกรอก'},{id:'out',t:'out',tx:23,sp:'postbox',lab:'ช่องส่งงาน'}];
const WORK={fill:{need:i=>!i.f,apply:i=>{i.f=1},dur:2.2},stamp:{need:i=>i.f&&!i.s,apply:i=>{i.s=1},dur:1.4}};
const RACE_MS=120000,KITCHEN_MS=150000,RES_MS=10000,LEAD_MS=4000;

/* ---------- maps (tile chars: # ground, = one-way platform, B block, S spring, ^ spikes, F checkpoint) ---------- */
const grid=(w,h)=>Array.from({length:h},()=>Array(w).fill(' '));
function lobbyMap(){const W=25,H=14,g=grid(W,H);
  for(let x=0;x<W;x++){g[12][x]='#';g[13][x]='#'}
  for(let x=3;x<8;x++)g[9][x]='=';for(let x=10;x<15;x++)g[6][x]='=';for(let x=17;x<22;x++)g[9][x]='=';
  g[11][23]='S';g[11][1]='B';
  return{g,W,H,haz:[],spawn:{x:6*TS,y:10*TS}}}
function kitchenMap(){const W=25,H=14,g=grid(W,H);
  for(let x=0;x<W;x++){g[12][x]='#';g[13][x]='#'}
  for(let x=10;x<15;x++)g[10][x]='=';
  return{g,W,H,haz:[],spawn:{x:9*TS,y:10*TS}}}
function raceMap(seed){
  const r=mulberry32(seed),H=14,W=220,g=grid(W,H),haz=[];let x=0,h=12,lastCp=0;
  const col=(cx,top)=>{for(let y=top;y<H;y++)g[y][cx]='#'};
  const flat=n=>{for(let i=0;i<n&&x<W;i++)col(x++,h)};
  flat(10);
  while(x<W-40){
    const k=r(),x0=x;
    if(k<.16){const len=7+Math.floor(r()*3),py=h-1-Math.floor(r()*2);for(let i=0;i<len;i++)if(i%3)g[py][x+i]='=';x+=len}
    else if(k<.3)x+=2+Math.floor(r()*2);
    else if(k<.42){const n=2+Math.floor(r()*2);for(let i=0;i<n&&h>6;i++){h--;flat(2)}}
    else if(k<.52){const n=2+Math.floor(r()*2);for(let i=0;i<n&&h<12;i++){h++;flat(2)}}
    else if(k<.66){flat(7);haz.push({t:'saw',x:(x0+3.5)*TS,y:h*TS-8,range:2.4*TS,per:1.4+r(),ph:r()*6.3})}
    else if(k<.76){flat(6);g[h-1][x0+1]='S';for(let j=1;j<=4;j++)g[h-j][x0+4]='B'}
    else if(k<.88){flat(8);haz.push({t:'slime',x:(x0+4)*TS,y:h*TS,range:2.8*TS,per:2.6+r()*1.5,ph:r()*6.3})}
    else{flat(7);g[h-1][x0+3]='^';g[h-1][x0+4]='^'}
    flat(3+Math.floor(r()*3));
    if(x-lastCp>35){g[h-1][x-2]='F';lastCp=x}
  }
  const gx=x+4;flat(W-x);
  return{g,W,H,haz,spawn:{x:2*TS,y:9*TS},goalX:gx*TS};
}
const hazPos=(z,t)=>z.x+Math.sin(t/1000/z.per*Math.PI*2+z.ph)*z.range;
const bossAway=t=>t%30000>22000;
const bossX=t=>(12+Math.sin(t/2500)*1.8)*TS+TS/2;
const nearSt=(p,s)=>Math.abs(p.x+PW/2-(s.tx*TS+TS/2))<30&&Math.abs(p.y+PH-12*TS)<12;
const nearBoss=(p,t)=>!bossAway(t)&&Math.abs(p.x+PW/2-bossX(t))<40&&Math.abs(p.y+PH-10*TS)<14;
const safeKey=s=>(s||'?').replace(/[.#$\[\]\/]/g,'_').slice(0,24);

function setupHelp(){return `<div class="panel" style="margin:30px auto;text-align:left;max-width:620px">
  <div class="big" style="text-align:center">🔌</div><h2 style="text-align:center">ยังไม่ได้เชื่อม Firebase</h2>
  <div class="how"><p>โหมดออนไลน์ต้องมีตัวกลางรับส่งข้อมูลสด (ฟรี) — ทำครั้งเดียวจบ:</p>
  <p>1. เข้า <b>console.firebase.google.com</b> → สร้างโปรเจกต์ใหม่</p>
  <p>2. Build → <b>Realtime Database</b> → Create database (เลือก Singapore) → Start in <b>locked mode</b></p>
  <p>3. แท็บ Rules วางกฎนี้แล้ว Publish:<br><code>{"rules":{"rooms":{"$room":{".read":true,".write":true}}}}</code></p>
  <p>4. Project settings → Your apps → เพิ่ม Web app → คัดลอก <code>firebaseConfig</code> ไปวางในไฟล์ <code>firebase-config.js</code></p></div></div>`}

export function partyGame(root,api){
  if(!FIREBASE_CONFIG){root.innerHTML=setupHelp();return{destroy(){}}}
  const app=getApps().find(a=>a.name==='party')||initializeApp(FIREBASE_CONFIG,'party');
  const db=getDatabase(app);
  let offset=0;const now=()=>Date.now()+offset;
  const unsubs=[onValue(ref(db,'.info/serverTimeOffset'),s=>{offset=s.val()||0})];
  let destroyed=false,cleanup=()=>{};
  const qs=new URLSearchParams(location.search);
  let color=ava(store.get('partyAva','p_office'));
  root.innerHTML=`<div class="panel pt-join popin"><div class="big">🎉</div><h2>ปาร์ตี้ออนไลน์</h2>
    <p class="muted">เข้าห้องเดียวกัน เห็นเพื่อนวิ่งไปมา แล้วเปิดเกมเล่นพร้อมกัน</p>
    <label class="pt-field">ชื่อเล่น <input data-k="name" maxlength="12" value="${(store.get('name','')||'').replace(/"/g,'')}" placeholder="เช่น พล"></label>
    <div class="pt-colors">${AVAS.map(c=>`<button class="btn${c===color?' primary':''}" data-c="${c}"><img src="assets/pixel/${c}.png" width="44" height="44" alt="" style="object-fit:contain;image-rendering:pixelated"></button>`).join('')}</div>
    <label class="pt-field">ห้อง <input data-k="room" maxlength="16" value="${(qs.get('room')||'office').replace(/[^\w-]/g,'')}"></label>
    <div class="row"><button class="btn primary big" data-k="go">🚪 เข้าห้อง</button></div></div>`;
  root.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{color=b.dataset.c;root.querySelectorAll('[data-c]').forEach(x=>x.classList.toggle('primary',x===b))});
  root.querySelector('[data-k=go]').onclick=()=>{
    const name=root.querySelector('[data-k=name]').value.trim()||'ไม่ระบุชื่อ';
    const room=(root.querySelector('[data-k=room]').value.replace(/[^\w-]/g,'')||'office').toLowerCase();
    store.set('name',name);store.set('partyAva',color);
    cleanup=join(name,color,room);
  };

  function join(name,color,room){
    const R='rooms/'+room,pid=Math.random().toString(36).slice(2,10);
    const meRef=ref(db,`${R}/p/${pid}`);onDisconnect(meRef).remove();
    root.innerHTML=`<div class="pt"><div><div class="pt-stage"><canvas></canvas><div class="pt-res" data-k="res"></div></div>
      <div class="pt-touch"><div><button class="btn" data-t="l">◀</button><button class="btn" data-t="r">▶</button></div>
        <div><button class="btn" data-t="a">✋</button><button class="btn primary" data-t="j">⤒</button></div></div>
      <div class="pt-bar" data-k="bar"></div><div class="pt-emotes">${EMOTES.map((e,i)=>`<button class="btn sm" data-e="${i}">${e}</button>`).join('')}</div></div>
      <aside class="pt-side"><h3>🏠 ห้อง ${room}</h3><ul data-k="plist"></ul><p class="muted pt-help">⬅️➡️ / A D เดิน · Space / W กระโดด · E ใช้งาน (กดค้าง = ทำงาน) · 1-8 อีโมจิ<br>ชวนเพื่อน: ส่งลิงก์นี้ แล้วกด "เข้าห้อง" ชื่อเดียวกัน</p></aside></div>`;
    const cv=root.querySelector('canvas'),ctx=cv.getContext('2d'),q=k=>root.querySelector(`[data-k="${k}"]`);
    const dpr=Math.min(2,window.devicePixelRatio||1);cv.width=VW*dpr;cv.height=VH*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
    [...AVAS,...PROPS,...KST.map(s=>s.sp),'boss','paper','memo','vending','cactus','disk','robot','flag','goal','chair','calendar','window','window2','pic1','pic2','pic3'].forEach(oImg);

    let players={},scores={},best={},K=null,S={sc:'lobby'},sceneKey='',map=lobbyMap(),intents=[],lastEv=0;
    const me={n:name,c:color,e:'',et:0,j:Date.now(),wk:'',fin:0};
    const P={x:map.spawn.x,y:map.spawn.y,vx:0,vy:0,onG:false,coy:0,buf:0,f:1,a:'i',stun:0,cp:null};
    const interp={};

    /* --- input --- */
    const keys={l:0,r:0,j:0,a:0};let jumpPress=false,actPress=false;
    const KMAP={ArrowLeft:'l',a:'l',A:'l',ArrowRight:'r',d:'r',D:'r',ArrowUp:'j',w:'j',W:'j',' ':'j',e:'a',E:'a',j:'a',J:'a',Enter:'a'};
    const kd=e=>{if(bossOn||e.target.closest&&e.target.closest('input'))return;const k=KMAP[e.key];
      if(k){e.preventDefault();if(!keys[k]){if(k==='j')jumpPress=true;if(k==='a')actPress=true}keys[k]=1;return}
      const n=+e.key;if(n>=1&&n<=EMOTES.length)emote(n-1)};
    const ku=e=>{const k=KMAP[e.key];if(k)keys[k]=0};
    window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);
    root.querySelectorAll('[data-t]').forEach(b=>{const k=b.dataset.t;
      b.addEventListener('pointerdown',e=>{e.preventDefault();if(!keys[k]){if(k==='j')jumpPress=true;if(k==='a')actPress=true}keys[k]=1});
      for(const ev of ['pointerup','pointerleave','pointercancel'])b.addEventListener(ev,()=>{keys[k]=0})});
    root.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>emote(+b.dataset.e));
    function emote(i){me.e=EMOTES[i];me.et=now();runSfx('coin')}

    /* --- state --- */
    // host = earliest joiner whose tab is visible (a hidden tab / boss screen stops its game loop)
    const hostId=()=>{const all=Object.entries(players),vis=all.filter(([,p])=>p.v!==0),pool=vis.length?vis:all;let best=null;
      for(const [id,p] of pool)if(!best||p.j<players[best].j||(p.j===players[best].j&&id<best))best=id;return best};
    function onState(st){
      const prevSc=S.sc;
      // tell the hub (missions) when a round I played has finished
      if(st.sc==='res'&&prevSc!=='res'){
        if(st.g==='race'&&(st.res||[]).some(p=>p.n===me.n))window.dispatchEvent(new CustomEvent('hra-party',{detail:{kind:'race'}}));
        if(st.g==='kitchen'&&prevSc==='kitchen')window.dispatchEvent(new CustomEvent('hra-party',{detail:{kind:'kitchen'}}));
      }
      S=st;const key=st.sc+':'+(st.seed||'')+':'+(st.at||'');
      if(key!==sceneKey){sceneKey=key;
        map=st.sc==='race'?raceMap(st.seed):st.sc==='kitchen'?kitchenMap():lobbyMap();
        if(st.sc!=='res'){P.x=map.spawn.x+Math.random()*TS*3;P.y=map.spawn.y;P.vx=P.vy=0;P.cp=null}
        me.fin=0;me.wk='';
        if(st.sc==='race'||st.sc==='kitchen')runSfx('magic');
      }
      renderBar();renderRes();
    }
    function renderBar(){
      const bar=q('bar');
      if(S.sc==='lobby')bar.innerHTML=`<button class="btn primary" data-g="race">🏁 แข่งวิ่ง (Fall Guys)</button><button class="btn yes" data-g="kitchen">🍳 ครัวเอกสาร (Overcooked)</button><span class="muted">ใครกดก็ได้ ทุกคนในห้องจะเข้าเกมพร้อมกัน</span>`;
      else bar.innerHTML=`<span class="muted">${S.sc==='race'?'🏁 กำลังแข่งวิ่ง — ถึงเส้นชัยก่อนได้แต้ม':S.sc==='kitchen'?'🍳 ครัวเอกสาร — ช่วยกันเคลียร์งานให้ทันกำหนด':'📊 สรุปผล'}${S.by?' · เริ่มโดย '+S.by:''}</span>`;
      bar.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>startMini(b.dataset.g));
    }
    function startMini(kind){
      const t=now(),at=t+LEAD_MS,seed=Math.floor(Math.random()*1e9);
      runTransaction(ref(db,R+'/s'),cur=>{if(cur&&cur.sc&&cur.sc!=='lobby')return;return{sc:kind,seed,at,by:me.n}}).then(res=>{
        if(!res.committed)return;remove(ref(db,R+'/ki'));
        if(kind==='kitchen')set(ref(db,R+'/k'),{st:{fill1:{p:0},fill2:{p:0},stamp:{p:0}},oc:0,sc:0,done:0,fail:0,end:at+KITCHEN_MS,nx:at+1500,ev:{t:0,m:''}});
      });
    }
    function renderRes(){
      const el=q('res');if(S.sc!=='res'){el.className='pt-res';return}
      el.className='pt-res show';
      if(S.g==='race'){const medal=['🥇','🥈','🥉'];
        el.innerHTML=`<div class="panel popin"><h2>🏁 ผลแข่งวิ่ง</h2><ol class="pt-rank">${(S.res||[]).map((p,i)=>`<li><img src="assets/pixel/${ava(p.c)}.png" width="28" height="28" alt="" style="object-fit:contain;image-rendering:pixelated"> <b>${p.n}</b> ${p.fin?`${medal[i]||'✅'} ${(p.fin/1000).toFixed(1)} วิ`:'❌ ไม่ถึงเส้นชัย'} ${p.pts?`<span class="tag">+${p.pts}</span>`:''}</li>`).join('')}</ol><p class="muted">กลับห้องรวมใน 10 วินาที</p></div>`}
      else{const stars=S.score>=400?'⭐⭐⭐':S.score>=220?'⭐⭐':S.score>=90?'⭐':'💀';
        el.innerHTML=`<div class="panel popin"><h2>🍳 ครัวเอกสาร</h2><div class="score">${fmt(S.score||0)}</div><div style="font-size:30px">${stars}</div>
          <p>ส่งงานสำเร็จ ${S.done||0} ชิ้น · หลุด ${S.fail||0} ชิ้น<br><span class="muted">สถิติห้องนี้: ${fmt(Math.max(best.kitchen||0,S.score||0))}</span></p><p class="muted">กลับห้องรวมใน 10 วินาที</p></div>`}
    }
    let sideSig='';
    function renderSide(){
      const hid=hostId(),list=Object.entries(players).sort((a,b)=>a[1].j-b[1].j);
      const sig=list.map(([id,p])=>id+p.n+p.c+p.sc).join()+JSON.stringify(scores)+hid;if(sig===sideSig)return;sideSig=sig;
      q('plist').innerHTML=list.map(([id,p])=>`<li><img src="assets/pixel/${ava(p.c)}.png" width="26" height="26" alt="" style="object-fit:contain;image-rendering:pixelated"> <b>${p.n}</b>${id===pid?' (คุณ)':''}${id===hid?' 👑':''}<span class="tag">🏆 ${scores[safeKey(p.n)]||0}</span></li>`).join('');
    }

    /* --- physics --- */
    const tileAt=(tx,ty)=>(ty<0||ty>=map.H)?' ':(tx<0||tx>=map.W)?'#':map.g[ty][tx];
    const solid=c=>c==='#'||c==='B';
    function physics(dt,frozen){
      const dir=frozen||P.stun>0?0:(keys.r-keys.l);
      if(P.stun>0)P.stun-=dt;
      const acc=P.onG?2200:1400,tv=dir*MAXV;P.vx+=Math.max(-acc*dt,Math.min(acc*dt,tv-P.vx));
      if(dir)P.f=dir;
      P.buf-=dt;if(jumpPress&&!frozen)P.buf=.13;jumpPress=false;
      P.coy=P.onG?.1:P.coy-dt;
      if(P.buf>0&&P.coy>0){P.vy=-JUMP;P.buf=0;P.coy=0;runSfx('jump')}
      if(!keys.j&&P.vy<-260)P.vy=-260;
      P.vy=Math.min(900,P.vy+GRAV*dt);
      P.x+=P.vx*dt;
      for(let ty=Math.floor(P.y/TS);ty<=Math.floor((P.y+PH-1)/TS);ty++)for(let tx=Math.floor(P.x/TS);tx<=Math.floor((P.x+PW-1)/TS);tx++)
        if(solid(tileAt(tx,ty))){if(P.vx>0)P.x=tx*TS-PW;else if(P.vx<0)P.x=(tx+1)*TS;P.vx=0}
      const prevB=P.y+PH;P.y+=P.vy*dt;P.onG=false;
      for(let ty=Math.floor(P.y/TS);ty<=Math.floor((P.y+PH-1)/TS);ty++)for(let tx=Math.floor(P.x/TS);tx<=Math.floor((P.x+PW-1)/TS);tx++){
        const c=tileAt(tx,ty);
        if(solid(c)){if(P.vy>0){P.y=ty*TS-PH;P.vy=0;P.onG=true}else if(P.vy<0){P.y=(ty+1)*TS;P.vy=0}}
        else if(c==='='&&P.vy>=0&&prevB<=ty*TS+2){P.y=ty*TS-PH;P.vy=0;P.onG=true}
      }
      // specials under/at the player
      const cx=Math.floor((P.x+PW/2)/TS),cy=Math.floor((P.y+PH-2)/TS),c=tileAt(cx,cy);
      if(c==='S'&&P.vy>=0){P.vy=-SPRING;P.onG=false;runSfx('jump-high')}
      if(c==='^')hurt(-P.f);
      if(c==='F'&&(!P.cp||P.cp.x<cx*TS)){P.cp={x:cx*TS,y:(cy-1)*TS};runSfx('gem');toast('🚩 เช็คพอยต์!')}
      if(P.y>map.H*TS+80){const sp=P.cp||map.spawn;P.x=sp.x;P.y=sp.y;P.vx=P.vy=0;runSfx('hurt')}
      P.a=P.stun>0?'h':!P.onG?'j':Math.abs(P.vx)>20?'w':'i';
    }
    function hurt(dir){if(P.stun>0)return;P.stun=.7;P.vx=dir*320;P.vy=-330;runSfx('hurt')}

    /* --- host duties --- */
    let hostAcc=0;
    function host(t,dt){
      if(S.sc==='race'&&t>S.at){
        const racers=Object.values(players).filter(p=>p.sc==='race'),fins=racers.filter(p=>p.fin).length;
        if(racers.length&&(fins>=Math.max(1,Math.ceil(racers.length*.6))||t>S.at+RACE_MS)){
          const list=Object.values(players).filter(p=>p.sc==='race').map(p=>({n:p.n,c:p.c,fin:p.fin||0,x:p.x}));
          list.sort((a,b)=>a.fin&&b.fin?a.fin-b.fin:a.fin?-1:b.fin?1:b.x-a.x);
          list.forEach((p,i)=>{p.pts=p.fin?([5,3,2][i]||1):0;delete p.x});
          const at=S.at;
          runTransaction(ref(db,R+'/s'),cur=>{if(!cur||cur.sc!=='race'||cur.at!==at)return;return{sc:'res',g:'race',res:list,at:t}}).then(r=>{
            if(!r.committed)return;
            for(const p of list)if(p.pts)runTransaction(ref(db,`${R}/score/${safeKey(p.n)}`),v=>(v||0)+p.pts);
            if(list[0]&&list[0].fin)push(ref(db,'rooms/_hub/feed'),{m:`🏁 ${list[0].n} ชนะแข่งวิ่ง (${(list[0].fin/1000).toFixed(1)} วิ) จาก ${list.length} คน`,n:list[0].n,a:list[0].c,t:now()})});
        }
      }
      if(S.sc==='res'&&t>S.at+RES_MS){const at=S.at;runTransaction(ref(db,R+'/s'),cur=>{if(!cur||cur.sc!=='res'||cur.at!==at)return;return{sc:'lobby'}})}
      if(S.sc==='kitchen'&&K&&t>S.at){hostAcc+=dt;if(hostAcc>=.1){hostKitchen(t,hostAcc);hostAcc=0}}
    }
    function hostKitchen(t,dt){
      const k=JSON.parse(JSON.stringify(K));k.o=k.o||{};k.h=k.h||{};k.st=k.st||{};let ch=false;
      for(const it of intents.splice(0)){remove(ref(db,`${R}/ki/${it.key}`));const p=players[it.pid];if(!p||t-it.t>4000)continue;ch=applyIntent(k,it,p,t)||ch}
      for(const s of KST){const w=WORK[s.t];if(!w)continue;const slot=k.st[s.id]||(k.st[s.id]={p:0});
        if(!slot.i||!w.need(slot.i)){if(slot.p){slot.p=0;ch=true}continue}
        const n=Object.values(players).filter(p=>p.sc==='kitchen'&&p.wk===s.id&&nearSt(p,s)).length;
        if(n){slot.p+=dt*(1+.6*(n-1))/w.dur;ch=true;if(slot.p>=1){w.apply(slot.i);slot.p=0}}}
      if(t>=k.nx&&Object.keys(k.o).length<4){k.oc++;k.o['o'+k.oc]={r:Math.floor(Math.random()*(t-S.at>40000?4:3)),exp:t+55000,t};
        k.nx=t+Math.max(6000,13000-Object.keys(players).length*900);ch=true}
      for(const [id,o] of Object.entries(k.o))if(t>o.exp){delete k.o[id];k.fail++;k.sc=Math.max(0,k.sc-15);k.ev={t,m:'⏰ งานหลุดกำหนด −15'};ch=true}
      if(t>=k.end){const at=S.at;
        runTransaction(ref(db,R+'/s'),cur=>{if(!cur||cur.sc!=='kitchen'||cur.at!==at)return;return{sc:'res',g:'kitchen',score:k.sc,done:k.done,fail:k.fail,at:t}})
          .then(r=>{if(!r.committed)return;runTransaction(ref(db,R+'/best/kitchen'),v=>Math.max(v||0,k.sc));
            const team=Object.values(players).filter(p=>p.sc==='kitchen').length,stars=k.sc>=400?'⭐⭐⭐':k.sc>=220?'⭐⭐':k.sc>=90?'⭐':'';
            push(ref(db,'rooms/_hub/feed'),{m:`🍳 ทีมครัวเอกสาร ${team} คน ส่งงาน ${k.done} ชิ้น ได้ ${k.sc} คะแนน ${stars}`,n:'',a:'',t:now()})});return}
      if(ch)set(ref(db,R+'/k'),k);
    }
    function applyIntent(k,it,p,t){
      const held=k.h[it.pid];
      if(it.st==='boss'){if(held&&held.f&&!held.g&&nearBoss(p,t)){held.g=1;k.ev={t,m:'✒️ หัวหน้าเซ็นให้แล้ว'};return true}return false}
      const s=KST.find(x=>x.id===it.st);if(!s||!nearSt(p,s))return false;
      if(s.t==='paper'&&!held){k.h[it.pid]={f:0,s:0,g:0};return true}
      if(s.t==='trash'&&held){delete k.h[it.pid];return true}
      if(WORK[s.t]){const slot=k.st[s.id]||(k.st[s.id]={p:0});
        if(held&&!slot.i){slot.i=held;slot.p=0;delete k.h[it.pid];return true}
        // tap E on a half-done item = keep working (hold E); it can be picked up once this station's step is done
        if(!held&&slot.i&&!WORK[s.t].need(slot.i)){k.h[it.pid]=slot.i;delete slot.i;slot.p=0;return true}}
      if(s.t==='out'&&held){delete k.h[it.pid];
        const m=Object.entries(k.o).sort((a,b)=>a[1].t-b[1].t).find(([,o])=>{const r=RECIPES[o.r];return r.f===(held.f|0)&&r.s===(held.s|0)&&r.g===(held.g|0)});
        if(m){const r=RECIPES[m[1].r],pts=r.pts+Math.max(0,Math.round((m[1].exp-t)/5000));delete k.o[m[0]];k.sc+=pts;k.done++;k.ev={t,m:`✅ ${r.n} +${pts}`}}
        else{k.sc=Math.max(0,k.sc-10);k.ev={t,m:'❌ ส่งผิดแบบฟอร์ม −10'}}
        return true}
      return false;
    }

    /* --- kitchen client helpers --- */
    function kitchenTarget(t){
      const held=K&&K.h&&K.h[pid];
      if(held&&nearBoss(P,t))return 'boss';
      const s=KST.find(s=>nearSt(P,s));return s?s.id:'';
    }

    /* --- network send --- */
    let sendT=0,lastSent='';
    let vis=1;
    const visTimer=setInterval(()=>{const v=document.hidden||bossOn?0:1;if(v!==vis){vis=v;send(now(),true)}},500);
    function send(t,force){
      if(!force&&t-sendT<110)return;
      const o={n:me.n,c:me.c,j:me.j,x:Math.round(P.x),y:Math.round(P.y),f:P.f,a:P.a,sc:S.sc,e:me.e,et:me.et,wk:me.wk,fin:me.fin,v:vis};
      const s=JSON.stringify(o);if(!force&&s===lastSent&&t-sendT<4000)return;
      sendT=t;lastSent=s;set(meRef,o);
    }

    /* --- render --- */
    const img=n=>oImg(n);
    // pixel sprites: fit inside w×h with a whole-number scale, centred, standing on the box bottom
    function spr(n,x,y,w,h,flip){const im=img(n);if(!im.complete||!im.naturalWidth)return;
      const iw=im.naturalWidth,ih=im.naturalHeight;let k=Math.min(w/iw,h/ih);if(k>=1)k=Math.floor(k);
      const dw=Math.round(iw*k),dh=Math.round(ih*k),dx=Math.round(x+(w-dw)/2),dy=Math.round(y+h-dh);
      if(flip){ctx.save();ctx.translate(dx+dw,dy);ctx.scale(-1,1);ctx.drawImage(im,0,0,dw,dh);ctx.restore()}else ctx.drawImage(im,dx,dy,dw,dh)}
    function text(s,x,y,size=14,col='#2b2140',stroke='#fff'){ctx.font=`600 ${size}px Kanit, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=4;ctx.strokeStyle=stroke;ctx.strokeText(s,x,y);ctx.fillStyle=col;ctx.fillText(s,x,y)}
    function drawPlayer(p,x,y,t,isMe){
      // the pixel characters have a single pose: animate with bob / squash / tilt instead of frames
      const walk=p.a==='w',jump=p.a==='j',hit=p.a==='h',bob=walk?Math.abs(Math.sin(t/85))*5:Math.sin(t/400)*1.2;
      const im=img(ava(p.c));
      if(im.complete&&im.naturalWidth){ctx.save();ctx.translate(x+PW/2,y+PH+2);
        ctx.rotate(hit?Math.sin(t/60)*.35:walk?Math.sin(t/85)*.08*p.f:0);ctx.scale(jump?.9:1,jump?1.12:1);
        const k=Math.max(1,Math.floor(Math.min(48/im.naturalWidth,48/im.naturalHeight))),dw=im.naturalWidth*k,dh=im.naturalHeight*k;
        if(p.f<0)ctx.scale(-1,1);ctx.drawImage(im,-dw/2,-dh-bob,dw,dh);ctx.restore()}
      if(hit)text('💫',x+PW/2,y-34,18);
      text(p.n+(isMe?' ★':''),x+PW/2,y-26,13,isMe?'#d6336c':'#2b2140');
      if(p.e&&t-p.et<3000){ctx.font='600 15px Kanit, sans-serif';const w=Math.max(34,ctx.measureText(p.e).width+16);
        ctx.fillStyle='#fff';ctx.strokeStyle='#2b2140';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x+PW/2-w/2,y-64,w,26,10);ctx.fill();ctx.stroke();
        ctx.fillStyle='#2b2140';ctx.textAlign='center';ctx.fillText(p.e,x+PW/2,y-50)}
    }
    function drawItem(it,x,y){spr('paper',x-13,y-13,26,26);let bx=x-16;
      if(it.f){spr('memo',bx,y-30,14,16);bx+=15}if(it.s){spr('stamp',bx,y-28,14,12);bx+=15}if(it.g)text('✒️',bx+6,y-22,12)}
    function floorTile(X,Y,top){ctx.fillStyle=top?'#e2a868':'#9b6a45';ctx.fillRect(X,Y,TS,TS);
      if(top){ctx.fillStyle='#c98b5e';ctx.fillRect(X,Y,TS,6);ctx.fillStyle='rgba(0,0,0,.08)';ctx.fillRect(X+TS-2,Y+6,2,TS-6)}
      else{ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(X,Y+TS/2-1,TS,2);ctx.fillRect(X+((Y/TS)%2?8:24),Y,2,TS)}}
    function deskTile(X,Y,l,r){ctx.fillStyle='#a8714a';if(l)ctx.fillRect(X+3,Y+8,4,TS-6);if(r)ctx.fillRect(X+TS-7,Y+8,4,TS-6);
      ctx.fillStyle='#d9a066';ctx.beginPath();ctx.roundRect(X-(l?0:1),Y,TS+(l||r?1:2),9,l&&r?4:l?[4,0,0,4]:r?[0,4,4,0]:0);ctx.fill();
      ctx.fillStyle='#b97f50';ctx.fillRect(X,Y+7,TS,2)}
    function wall(cx){
      const g=ctx.createLinearGradient(0,0,0,VH);g.addColorStop(0,'#fdf3e6');g.addColorStop(1,'#f6e2cb');ctx.fillStyle=g;ctx.fillRect(0,0,VW,VH);
      const off=(cx*.5)%320;
      const n0=Math.floor((cx*.5)/320);
      for(let x=-off-320,i=n0-1;x<VW+320;x+=320,i++){spr(i%2?'window2':'window',x+95,52,130,110);spr(['pic1','pic2','pic3'][((i%3)+3)%3],x+262,92,36,40)}
      ctx.fillStyle='#f0cfa8';ctx.fillRect(0,12*TS-18,VW,18)}
    function draw(t){
      const cx=Math.max(0,Math.min(map.W*TS-VW,P.x+PW/2-VW/2));
      wall(cx);
      ctx.save();ctx.translate(-Math.round(cx),0);
      for(let i=Math.floor((cx-200)/260);i<=Math.floor((cx+VW)/260);i++){if(i<0||S.sc==='kitchen')continue;const n=PROPS[i%PROPS.length],X=i*260+150;
        if(map.g[11]&&map.g[12]&&map.g[12][Math.floor(X/TS)]==='#'&&map.g[11][Math.floor(X/TS)]===' '){ctx.globalAlpha=.8;spr(n,X-32,12*TS-80,64,80);ctx.globalAlpha=1}}
      const tx0=Math.floor(cx/TS),tx1=Math.min(map.W-1,tx0+Math.ceil(VW/TS)+1);
      for(let ty=0;ty<map.H;ty++)for(let tx=tx0;tx<=tx1;tx++){const c=map.g[ty][tx],X=tx*TS,Y=ty*TS;
        if(c==='#')floorTile(X,Y,!(ty>0&&map.g[ty-1][tx]==='#'));
        else if(c==='=')deskTile(X,Y,map.g[ty][tx-1]!=='=',map.g[ty][tx+1]!=='=');
        else if(c==='B')spr('vending',X,Y,TS,TS+2);
        else if(c==='S'){spr('chair',X-6,Y-12,TS+12,TS+12);text('เด้ง!',X+TS/2,Y-18,10)}
        else if(c==='^')spr('cactus',X-2,Y-2,TS+4,TS+4);
        else if(c==='F'){spr('flag',X-4,Y-8,TS+8,TS+8);text(P.cp&&P.cp.x>=X?'✓ เช็คพอยต์':'เช็คพอยต์',X+TS/2,Y-16,10,P.cp&&P.cp.x>=X?'#21c07a':'#2b2140')}}
      if(map.goalX){for(let y=4;y<12;y++)for(let i=0;i<2;i++){ctx.fillStyle=(y+i)%2?'#fff':'#2b2140';ctx.fillRect(map.goalX+i*8,y*TS,8,TS)}
        spr('goal',map.goalX-24,12*TS-100,64,96);text('🏁 เส้นชัย',map.goalX+8,12*TS-112,18)}
      for(const z of map.haz){const hx=hazPos(z,t);
        if(z.t==='saw'){ctx.save();ctx.translate(hx,z.y-6);ctx.rotate(t/90);spr('disk',-18,-18,36,36);ctx.restore()}
        else spr('robot',hx-28,z.y-30-Math.abs(Math.sin(t/120))*3,56,30,Math.cos(t/1000/z.per*Math.PI*2+z.ph)>0)}
      if(S.sc==='kitchen')drawKitchen(t);
      if(S.sc==='lobby'||S.sc==='res'){text('🎉 ห้องปาร์ตี้ HR',VW/2,2*TS,26);text('กดปุ่มด้านล่างเพื่อเริ่มเกม · กดตัวเลข 1-8 ส่งอีโมจิ',VW/2,3*TS,14,'#2b2140')}
      for(const [id,p] of Object.entries(players)){if(id===pid||p.sc!==S.sc)continue;
        const ip=interp[id]||(interp[id]={x:p.x,y:p.y});ip.x+=(p.x-ip.x)*.25;ip.y+=(p.y-ip.y)*.25;
        if(Math.abs(p.x-ip.x)>300){ip.x=p.x;ip.y=p.y}
        drawPlayer(p,ip.x,ip.y,t,false);
        if(S.sc==='kitchen'&&K&&K.h&&K.h[id])drawItem(K.h[id],ip.x+PW/2,ip.y-30)}
      drawPlayer({...me,f:P.f,a:P.a},P.x,P.y,t,true);
      if(S.sc==='kitchen'&&K&&K.h&&K.h[pid])drawItem(K.h[pid],P.x+PW/2,P.y-30);
      ctx.restore();
      drawHud(t);
    }
    function drawKitchen(t){
      const bx=bossX(t);
      if(bossAway(t)){spr('calendar',12*TS,10*TS-36,32,32);text('หัวหน้าไปประชุม',12.5*TS,10*TS-46,13)}
      else{spr('boss',bx-24,10*TS-48+Math.sin(t/300)*1.5,48,48);text('หัวหน้า ✒️ เซ็น',bx,10*TS-58,13,'#8338ec')}
      for(const s of KST){const X=s.tx*TS,Y=12*TS;
        ctx.fillStyle='#d9a066';ctx.beginPath();ctx.roundRect(X-6,Y-14,TS+12,14,4);ctx.fill();ctx.fillStyle='#b97f50';ctx.fillRect(X-6,Y-4,TS+12,4);
        spr(s.sp,X+TS/2-28,Y-62,56,52);text(s.lab,X+TS/2,Y-70,11);
        const slot=K&&K.st&&K.st[s.id];
        if(slot&&slot.i)drawItem(slot.i,X+TS/2+22,Y-30);
        if(slot&&slot.p>0){ctx.fillStyle='#2b2140';ctx.fillRect(X-4,Y-84,TS+8,8);ctx.fillStyle='#21c07a';ctx.fillRect(X-3,Y-83,(TS+6)*Math.min(1,slot.p),6)}
      }
      const tg=kitchenTarget(t);if(tg){const X=tg==='boss'?bossX(t):KST.find(s=>s.id===tg).tx*TS+TS/2;text('กด E',X,tg==='boss'?10*TS-76:12*TS-98,15,'#fff','#2b2140')}
    }
    function drawHud(t){
      if((S.sc==='race'||S.sc==='kitchen')&&t<S.at){const n=Math.ceil((S.at-t)/1000);ctx.fillStyle='rgba(43,33,64,.35)';ctx.fillRect(0,0,VW,VH);
        text(n>3?'เตรียมตัว…':String(n),VW/2,VH/2,80,'#fff','#2b2140');
        text(S.sc==='race'?'🏁 วิ่งไปให้ถึงเส้นชัย! ระวังเลื่อยกับสไลม์':'🍳 หยิบกระดาษ → กรอก/ปั๊ม/ให้หัวหน้าเซ็น → ส่งให้ตรงใบงาน',VW/2,VH/2+60,20,'#fff','#2b2140');return}
      if(S.sc==='race'&&map.goalX){const left=Math.max(0,Math.ceil((S.at+RACE_MS-t)/1000));
        ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(100,8,600,14);ctx.strokeStyle='#2b2140';ctx.lineWidth=2;ctx.strokeRect(100,8,600,14);
        for(const p of Object.values(players).filter(p=>p.sc==='race'))spr(ava(p.c),100+Math.min(1,(p.fin?map.goalX:p.x)/map.goalX)*600-13,0,26,26);
        text(`⏱ ${left}`,50,16,18);if(me.fin)text(`🎉 เข้าเส้นชัย ${(me.fin/1000).toFixed(1)} วิ — รอเพื่อน…`,VW/2,46,20,'#21c07a')}
      if(S.sc==='kitchen'&&K){const left=Math.max(0,Math.ceil((K.end-t)/1000));
        text(`⏱ ${left}`,40,18,18);text(`⭐ ${fmt(K.sc||0)}`,40,42,18);
        const ords=Object.values(K.o||{}).sort((a,b)=>a.t-b.t);
        ords.forEach((o,i)=>{const r=RECIPES[o.r],X=90+i*170;ctx.fillStyle='#fffbe0';ctx.strokeStyle='#2b2140';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(X,6,160,46,8);ctx.fill();ctx.stroke();
          ctx.fillStyle='#2b2140';ctx.font='600 13px Kanit, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(r.n,X+8,18);
          spr('memo',X+8,26,18,18);if(r.s)spr('stamp',X+30,28,18,14);if(r.g)text('✒️',X+(r.s?62:40),36,13);
          const fr=Math.max(0,(o.exp-t)/55000);ctx.fillStyle=fr<.3?'#ff4d4d':'#21c07a';ctx.fillRect(X+90,32,64*fr,8);ctx.strokeRect(X+90,32,64,8)})}
    }

    /* --- main loop --- */
    api.loop(dt=>{
      if(destroyed)return;const t=now();
      const frozen=(S.sc==='race'||S.sc==='kitchen')&&t<S.at;
      physics(dt,frozen);
      if(S.sc==='race'&&!frozen){
        for(const z of map.haz){const hx=hazPos(z,t);
          const hit=z.t==='saw'?Math.hypot(P.x+PW/2-hx,P.y+PH/2-z.y)<26:(Math.abs(P.x+PW/2-hx)<24&&P.y+PH>z.y-20&&P.y<z.y);
          if(hit)hurt(P.x+PW/2<hx?-1:1)}
        if(!me.fin&&P.x>=map.goalX){me.fin=Math.max(1,t-S.at);runSfx('gem');toast('🏁 เข้าเส้นชัย!')}
      }
      if(S.sc==='kitchen'&&!frozen){
        const tg=kitchenTarget(t);
        if(actPress&&tg){push(ref(db,R+'/ki'),{pid,st:tg,t});runSfx('select')}
        const s=KST.find(s=>s.id===tg);me.wk=keys.a&&s&&WORK[s.t]?s.id:'';
      }else me.wk='';
      actPress=false;
      send(t);
      if(hostId()===pid)host(t,dt);else intents.length=0;
      draw(t);
    });
    if(location.pathname.endsWith('_test.html'))window.__pt={P,me,keys,get K(){return K},get S(){return S}};
    // subscribe last: listeners may fire synchronously and use everything above
    const unsub=[
      onValue(ref(db,R+'/p'),s=>{players=s.val()||{};renderSide()}),
      onValue(ref(db,R+'/s'),s=>onState(s.val()||{sc:'lobby'})),
      onValue(ref(db,R+'/k'),s=>{K=s.val();if(K&&K.ev&&K.ev.t!==lastEv){lastEv=K.ev.t;if(now()-K.ev.t<3000)toast(K.ev.m)}}),
      onValue(ref(db,R+'/score'),s=>{scores=s.val()||{};renderSide()}),
      onValue(ref(db,R+'/best'),s=>{best=s.val()||{}}),
      onChildAdded(ref(db,R+'/ki'),s=>{intents.push({key:s.key,...s.val()})}),
    ];
    set(meRef,{...me,x:P.x,y:P.y,f:1,a:'i',sc:'lobby'});
    renderBar();
    return()=>{clearInterval(visTimer);unsub.forEach(u=>u());remove(meRef);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku)};
  }
  return{destroy(){destroyed=true;unsubs.forEach(u=>u());cleanup()}};
}
