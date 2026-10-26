// 3D office room: one locked top-down camera for everyone, Kenney Mini Characters + Furniture Kit (CC0),
// players synced through Firebase RTDB under rooms/lobby3d (the database rules only open rooms/$room).
// Mini-games run in the same room; the host (earliest visible player) owns shared state:
//  - "ครัวเอกสาร" (Overcooked-style co-op)
//  - "Office Audition" (rhythm dance: arrows each bar, Space on beat 4; code-generated music from dance-music.js)
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getDatabase,ref,set,remove,push,onValue,onChildAdded,onDisconnect,runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {FIREBASE_CONFIG} from './firebase-config.js';
import {createMusic,SONGS,INTRO_BARS} from './dance-music.js?v=1';

const $=s=>document.querySelector(s);
const store={get(k,d){try{const v=localStorage.getItem('hra_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
             set(k,v){try{localStorage.setItem('hra_'+k,JSON.stringify(v))}catch(e){}}};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CHARS=['female-a','female-b','female-c','female-d','female-e','female-f','male-a','male-b','male-c','male-d','male-e','male-f'];
const EMOTES=['👋','😂','😱','👍','🔥','หัวหน้ามา!','รอด้วย!','GG'];
const EMOTE_ANIM={'👋':'interact-right','👍':'emote-yes','😱':'die','🔥':'emote-yes'};
const X0=-7.5,X1=7.5,Z0=-4.3,Z1=4.6,SPEED=3.6,RAD=0.34,CHAR_H=1.3,FS=1.5; // FS: furniture scale so the kit matches the chibi characters

/* ---------- ครัวเอกสาร: stations sit on real furniture; (px,pz) is where a player stands to use it ---------- */
const RECIPES=[{n:'ใบลากิจ',f:1,s:0,g:0,pts:20},{n:'ใบลาป่วย',f:1,s:1,g:0,pts:30},{n:'ขอ OT',f:1,s:0,g:1,pts:30},{n:'หนังสือรับรอง',f:1,s:1,g:1,pts:50}];
const KST=[{id:'paper',t:'paper',px:-4.7,pz:-3.7,ic:'📄',lab:'หยิบกระดาษ'},{id:'fill1',t:'fill',px:-6.3,pz:.75,ic:'✍️',lab:'โต๊ะกรอก'},
  {id:'fill2',t:'fill',px:-3.7,pz:.75,ic:'✍️',lab:'โต๊ะกรอก'},{id:'stamp',t:'stamp',px:4.8,pz:.85,ic:'🔏',lab:'ปั๊มตรา'},
  {id:'trash',t:'trash',px:-2.2,pz:-3.7,ic:'🗑️',lab:'ถังขยะ'},{id:'out',t:'out',px:-5.1,pz:2.4,ic:'📮',lab:'ส่งงาน'}];
const WORK={fill:{need:i=>!i.f,apply:i=>{i.f=1},dur:2.2},stamp:{need:i=>i.f&&!i.s,apply:i=>{i.s=1},dur:1.4}};
const KITCHEN_MS=150000,LEAD_MS=4000,RES_MS=10000,USE_R=.85;
const bossAway=t=>t%30000>22000;
const bossPos=t=>({x:5+Math.sin(t/3200)*1.5,z:-.7+Math.sin(t/4700)*.25});
const nearSt=(p,s)=>Math.hypot(p.x-s.px,p.z-s.pz)<USE_R;
const nearBoss=(p,t)=>{if(bossAway(t))return false;const b=bossPos(t);return Math.hypot(p.x-b.x,p.z-b.z)<1.1};
const badges=i=>i?'📄'+(i.f?'✍️':'')+(i.s?'🔏':'')+(i.g?'✒️':''):'';

/* ---------- Office Audition ---------- */
const music=createMusic();music.muted=store.get('muted3d',false);
const ARROW={l:'←',u:'↑',r:'→',d:'↓'},OPP={l:'r',r:'l',u:'d',d:'u'};
const DANCE_MOVES=['emote-yes','attack-kick-left','attack-kick-right','interact-left','interact-right','jump','attack-melee-right','pick-up','holding-both-shoot','crouch'];
// [name, max |error| in ms from beat 4, points, colour]
const JUDGE=[['PERFECT',60,100,'#ff5c8a'],['GREAT',110,70,'#ff9f1c'],['COOL',170,40,'#21c07a'],['BAD',250,10,'#7a6f8c']];
const JCOL={PERFECT:'#ff5c8a',GREAT:'#ff9f1c',COOL:'#21c07a',BAD:'#7a6f8c',MISS:'#e23030'};
const songOf=st=>SONGS[st.song|0]||SONGS[0];
const barSec=song=>240/song.bpm;
function drng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// same arrows for everyone: seeded by the round seed + bar number; longer and trickier as the song goes on
function seqFor(st,bar){
  const song=songOf(st),r=drng((st.seed|0)*7919+bar*104729),prog=(bar-INTRO_BARS)/Math.max(1,song.bars-INTRO_BARS-1),last=bar===song.bars-1;
  const extra=song.level==='ยาก'?2:song.level==='กลาง'?1:0,n=last?8:Math.min(8,3+Math.floor(prog*3)+extra);
  const rev=song.level==='ยาก'&&prog>.3?.25:song.level==='กลาง'&&prog>.6?.12:0;
  return Array.from({length:n},()=>({d:'lurd'[Math.floor(r()*4)],rev:r()<rev}));
}
const danceSlot=i=>({x:-3+(i%5)*1.5,z:.7+Math.floor(i/5)*1.4});

/* ---------- renderer, scene, locked camera ---------- */
const stage=$('#stage'),hi=store.get('gfx3d',true);
const renderer=new THREE.WebGLRenderer({antialias:hi});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(hi?Math.min(devicePixelRatio,1.75):1);
renderer.shadowMap.enabled=hi;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
$('#gfx').textContent=hi?'✨ กราฟิกสูง':'⚡ กราฟิกต่ำ';
$('#gfx').onclick=()=>{store.set('gfx3d',!hi);location.reload()};
const scene=new THREE.Scene();scene.background=new THREE.Color('#fdf0e0');
// fixed camera: same framing for every player (stage is locked to 16:10 by CSS)
const camera=new THREE.PerspectiveCamera(34,16/10,.1,100);camera.position.set(0,15.5,10.8);camera.lookAt(0,0,.7);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);resize();
scene.add(new THREE.HemisphereLight(0xffffff,0xd9b98f,2.2));
const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-6,12,6);sun.castShadow=hi;
Object.assign(sun.shadow.camera,{left:-10,right:10,top:8,bottom:-8,near:1,far:40});sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0005;
scene.add(sun);

// floor: wooden planks drawn on a canvas
(function floor(){
  const c=document.createElement('canvas');c.width=1024;c.height=832;const g=c.getContext('2d');
  for(let y=0;y<832;y+=40){for(let x=(y/40%2)*60-60;x<1024;x+=240){g.fillStyle=['#e6bf8e','#e1b783','#eac796'][(x/240+y/40)&1?1:((y/40)%3===0?2:0)];g.fillRect(x,y,238,38)}}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  // floor runs past the front edge so the fixed camera never sees the background below the room
  const m=new THREE.Mesh(new THREE.PlaneGeometry(16,13),new THREE.MeshStandardMaterial({map:tex,roughness:.9}));
  m.rotation.x=-Math.PI/2;m.position.z=1.5;m.receiveShadow=true;scene.add(m);
  // walls behind the models so gaps never show the background
  const wm=new THREE.MeshStandardMaterial({color:'#f7e6cf'});
  const back=new THREE.Mesh(new THREE.BoxGeometry(16.2,1.3,.05),wm);back.position.set(0,.65,-5.06);scene.add(back);
})();

/* ---------- model loading + placement ---------- */
const loader=new GLTFLoader(),cache={};
const load=u=>cache[u]||(cache[u]=new Promise((ok,no)=>loader.load(u,ok,undefined,no)));
const obstacles=[];
async function furn(name,x,z,rot=0,{y=0,solid=true,scale=FS}={}){
  const g=await load(`assets/3d/furn/${name}.glb`),o=g.scene.clone(true);
  o.rotation.y=rot;o.scale.setScalar(scale);
  o.traverse(m=>{if(m.isMesh){m.castShadow=hi;m.receiveShadow=true}});
  scene.add(o);o.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(o),c=b.getCenter(new THREE.Vector3());
  o.position.x+=x-c.x;o.position.z+=z-c.z;o.position.y+=y-b.min.y;o.updateMatrixWorld(true);
  const bb=new THREE.Box3().setFromObject(o);
  if(solid)obstacles.push({x0:bb.min.x,x1:bb.max.x,z0:bb.min.z,z1:bb.max.z});
  return bb;
}
async function buildRoom(){
  const jobs=[],on=(p,f)=>p.then(f);
  // back wall with windows, side walls (each wall piece is 1 unit wide before scaling)
  for(let i=0;i<11;i++)jobs.push(furn(i%3===1?'wallWindow':'wall',-7.5+FS/2+i*FS,-5,0,{solid:false}));
  for(let i=0;i<7;i++){const z=-5+FS/2+i*FS;jobs.push(furn('wall',-8.05,z,Math.PI/2,{solid:false}),furn('wall',8.05,z,-Math.PI/2,{solid:false}))}
  // work area: two rows of desks with screens, keyboards and chairs
  for(const row of [-2.9,-.2])for(const x of [-6.3,-5,-3.7]){
    jobs.push(on(furn('desk',x,row),b=>Promise.all([furn('computerScreen',x,row-.15,0,{y:b.max.y,solid:false}),furn('computerKeyboard',x,row+.2,0,{y:b.max.y,solid:false})])));
    jobs.push(furn('chairDesk',x,row+.85,Math.PI,{solid:false}));
  }
  // bookcases + plants along the back wall
  jobs.push(furn('bookcaseClosedWide',-6.4,-4.55),furn('bookcaseOpen',-4.7,-4.6),furn('pottedPlant',-7.4,-4.45),furn('pottedPlant',-7.4,4.1));
  // pantry: bar with coffee machine, fridge, stools, trash
  jobs.push(on(furn('kitchenBar',-.75,-4.45),b=>furn('kitchenCoffeeMachine',-.75,-4.5,0,{y:b.max.y,solid:false})),furn('kitchenBar',.75,-4.45),furn('kitchenFridge',2.2,-4.5));
  jobs.push(furn('stoolBar',-.75,-3.3,0,{solid:false}),furn('stoolBar',.75,-3.3,0,{solid:false}),furn('trashcan',-2.2,-4.5));
  // lounge corner
  jobs.push(furn('rugRectangle',5.2,-2.4,0,{solid:false}),furn('loungeSofa',5.2,-4.1),furn('tableCoffee',5.2,-2.4),furn('loungeChair',7.1,-2.3,-Math.PI/2),
    on(furn('sideTableDrawers',3.4,-4.5),b=>furn('televisionModern',3.4,-4.55,0,{y:b.max.y,solid:false})),furn('pottedPlant',7.4,-4.45));
  // meeting table + misc
  jobs.push(furn('tableRound',4.8,1.9),furn('chair',3.7,1.9,Math.PI/2,{solid:false}),furn('chair',5.9,1.9,-Math.PI/2,{solid:false}),furn('chair',4.8,3,Math.PI,{solid:false}));
  jobs.push(furn('cardboardBoxClosed',-7,2.2),furn('cardboardBoxOpen',-6.2,2.6),furn('coatRackStanding',7.4,4.1),furn('lampRoundFloor',4,-4.55,0,{solid:false}),
    furn('rugRound',0,1.6,0,{solid:false}),furn('plantSmall2',-1.6,-4.5,0,{solid:false}));
  await Promise.all(jobs);
}

/* ---------- characters ---------- */
async function makeAvatar(model){
  const g=await load(`assets/3d/chars/character-${CHARS.includes(model)?model:'female-a'}.glb`);
  const o=SkeletonUtils.clone(g.scene);
  o.traverse(m=>{if(m.isMesh){m.castShadow=hi;m.frustumCulled=false}});
  const b=new THREE.Box3().setFromObject(o);o.scale.setScalar(CHAR_H/Math.max(.01,b.max.y-b.min.y));
  const mixer=new THREE.AnimationMixer(o),actions={};
  for(const c of g.animations)actions[c.name]=mixer.clipAction(c);
  const av={o,mixer,actions,cur:null,play(n){const a=actions[n]||actions.idle;if(!a||a===av.cur)return;a.reset().fadeIn(.15).play();av.cur&&av.cur.fadeOut(.15);av.cur=a}};
  av.play('idle');scene.add(o);return av;
}

/* ---------- labels (name + emote bubble) projected over the canvas ---------- */
const labels=$('#labels'),tmp=new THREE.Vector3();
function tagFor(p,isMe){const d=document.createElement('div');d.className='tag';d.innerHTML=`<div class="bub" hidden></div><div class="held" hidden></div><div class="nm${isMe?' me':''}"></div>`;labels.appendChild(d);return d}
function placeTag(tag,x,y,z,name,e,et,now,held=''){
  tmp.set(x,y+CHAR_H+.15,z).project(camera);
  tag.style.left=((tmp.x+1)/2*100)+'%';tag.style.top=((1-tmp.y)/2*100)+'%';
  const [bub,hl,nm]=tag.children;if(nm.textContent!==name)nm.textContent=name;
  const show=e&&now-et<3500;if(bub.hidden===!!show){bub.hidden=!show}if(show&&bub.textContent!==e)bub.textContent=e;
  if(hl.hidden===!!held)hl.hidden=!held;if(held&&hl.textContent!==held)hl.textContent=held;
}
// station markers: floor ring (3D) + label with icon, item on it and progress bar (HTML)
const stEls={};
function buildStations(){
  for(const s of KST){
    const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.56,32),new THREE.MeshBasicMaterial({color:'#ff5c8a',transparent:true,opacity:.75,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.set(s.px,.02,s.pz);ring.visible=false;scene.add(ring);
    const d=document.createElement('div');d.className='st';d.hidden=true;d.innerHTML=`<div class="ic">${s.ic}</div><div class="lb">${s.lab}</div><div class="it"></div><div class="pg"><i></i></div>`;labels.appendChild(d);
    stEls[s.id]={ring,d,it:d.querySelector('.it'),pg:d.querySelector('.pg'),bar:d.querySelector('.pg i')};
  }
}
const disco=[];
function buildDisco(){for(let r=0;r<3;r++)for(let c=0;c<5;c++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.35,1.25),new THREE.MeshBasicMaterial({color:'#ff5c8a',transparent:true,opacity:.45}));
  m.rotation.x=-Math.PI/2;const s=danceSlot(r*5+c);m.position.set(s.x,.012,s.z);m.visible=false;scene.add(m);disco.push(m)}}
function placeLabel(el,x,y,z){tmp.set(x,y,z).project(camera);el.style.left=((tmp.x+1)/2*100)+'%';el.style.top=((1-tmp.y)/2*100)+'%'}

/* ---------- input: keyboard + touch joystick ---------- */
const keys={};let jumpPress=false,joy={x:0,y:0};
const KM={ArrowLeft:'l',a:'l',A:'l',ArrowRight:'r',d:'r',D:'r',ArrowUp:'u',w:'u',W:'u',ArrowDown:'dn',s:'dn',S:'dn'};
let actPress=false;
const DKEY={ArrowLeft:'l',ArrowUp:'u',ArrowRight:'r',ArrowDown:'d',a:'l',w:'u',d:'r',s:'d',A:'l',W:'u',D:'r',S:'d',4:'l',8:'u',6:'r',2:'d'};
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input'))return;
  if(S.sc==='dance'&&D){if(DKEY[e.key]&&!e.repeat){e.preventDefault();danceKey(DKEY[e.key]);return}
    if((e.key===' '||e.key==='Control')&&!e.repeat){e.preventDefault();danceSpace();return}}
  if(KM[e.key]){keys[KM[e.key]]=1;e.preventDefault()}else if(e.key===' '){if(!e.repeat)jumpPress=true;e.preventDefault()}
  else if(e.key==='e'||e.key==='E'||e.key==='Enter'){if(!keys.e)actPress=true;keys.e=1;e.preventDefault()}
  else{const n=+e.key;if(n>=1&&n<=EMOTES.length)emote(n-1)}});
addEventListener('keyup',e=>{if(KM[e.key])keys[KM[e.key]]=0;if(e.key==='e'||e.key==='E'||e.key==='Enter')keys.e=0});
(function joystick(){const el=$('#joy'),knob=el.querySelector('i');let id=null;
  const upd=e=>{const r=el.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),m=Math.min(l,40);
    joy={x:l?dx/l*m/40:0,y:l?dy/l*m/40:0};knob.style.transform=`translate(${joy.x*40}px,${joy.y*40}px)`};
  el.addEventListener('pointerdown',e=>{id=e.pointerId;el.setPointerCapture(id);upd(e)});
  el.addEventListener('pointermove',e=>{if(e.pointerId===id)upd(e)});
  const end=()=>{id=null;joy={x:0,y:0};knob.style.transform=''};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)})();
$('#tJump').addEventListener('pointerdown',e=>{e.preventDefault();jumpPress=true});
{const b=$('#tAct');b.addEventListener('pointerdown',e=>{e.preventDefault();if(!keys.e)actPress=true;keys.e=1});
  for(const ev of ['pointerup','pointerleave','pointercancel'])b.addEventListener(ev,()=>{keys.e=0})}
$('#emotes').innerHTML=EMOTES.map((e,i)=>`<button class="btn sm" data-e="${i}">${e}</button>`).join('');
document.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>emote(+b.dataset.e));

/* ---------- local player ---------- */
const me={n:'',c:'female-a',x:0,z:2,y:0,vy:0,r:0,a:'idle',e:'',et:0,j:Date.now(),busy:0,wk:''};
let D=null; // my run in the current dance round
let myAv=null,myTag=null;
function emote(i){const e=EMOTES[i];me.e=e;me.et=now();if(EMOTE_ANIM[e]){me.a=EMOTE_ANIM[e];me.busy=1.2}}
const blocked=(x,z)=>x<X0||x>X1||z<Z0||z>Z1||obstacles.some(o=>x>o.x0-RAD&&x<o.x1+RAD&&z>o.z0-RAD&&z<o.z1+RAD);
function step(dt,frozen){
  let dx=(keys.r?1:0)-(keys.l?1:0)+joy.x,dz=(keys.dn?1:0)-(keys.u?1:0)+joy.y;if(frozen)dx=dz=0;const l=Math.hypot(dx,dz);
  if(l>1){dx/=l;dz/=l}
  const moving=l>.15;
  if(moving){const nx=me.x+dx*SPEED*dt,nz=me.z+dz*SPEED*dt;if(!blocked(nx,me.z))me.x=nx;if(!blocked(me.x,nz))me.z=nz;me.r=Math.atan2(dx,dz)}
  if(jumpPress&&me.y<=0){me.vy=5.2;me.busy=0}jumpPress=false;
  me.vy-=14*dt;me.y=Math.max(0,me.y+me.vy*dt);if(me.y===0)me.vy=0;
  me.busy=Math.max(0,me.busy-dt);
  const held=K&&K.h&&K.h[me.id];
  me.a=me.y>0?'jump':moving?(me.busy=0,'walk'):me.wk?'interact-right':me.busy>0?me.a:held?'holding-both':'idle';
}

/* ---------- network ---------- */
let offset=0;const now=()=>Date.now()+offset;
const others={};let players={},db=null,meRef=null,sendT=0,last='',vis=1;
let S={sc:'lobby'},K=null,intents=[],best=0,lastEv=0,R='rooms/lobby3d',boss=null,bossTag=null;
// host = earliest joiner whose tab is visible (a hidden tab stops its loop)
function hostId(){const all=Object.entries(players),v=all.filter(([,p])=>p.v!==0),pool=v.length?v:all;let b=null;
  for(const [id,p] of pool)if(!b||p.j<players[b].j||(p.j===players[b].j&&id<b))b=id;return b}
function toast(m){const d=document.createElement('div');d.className='toast';d.textContent=m;$('#toasts').appendChild(d);setTimeout(()=>d.remove(),2200)}
function queueMission(kind){try{const q=store.get('pendingMissions',[]);q.push({game:'party',kind});store.set('pendingMissions',q)}catch(e){}}
function onState(st){
  const prev=S.sc;
  if(st.sc==='res'&&prev==='kitchen')queueMission('kitchen'); // round I was in has ended: the hub counts it as a mission
  if(st.sc==='res'&&prev==='dance'&&D)queueMission('dance');
  if(st.sc==='dance'&&(!D||D.at!==st.at)){
    D={at:st.at,bar:-1,seq:[],idx:0,judged:true,score:0,combo:0,maxc:0,cnt:{PERFECT:0,GREAT:0,COOL:0,BAD:0,MISS:0},last:null,wrongT:0,done:false};
    music.play(songOf(st),st.seed|0,st.at,now);
  }
  if(st.sc!=='dance'){music.stop();if(prev==='dance')me.a='idle'}
  if(st.sc==='lobby')D=null;
  S=st;me.wk='';renderBar();renderRes();
}
function startDance(i){
  music.unlock();const t=now(),at=t+LEAD_MS,seed=Math.floor(Math.random()*1e9);
  runTransaction(ref(db,R+'/s'),cur=>{if(cur&&cur.sc&&cur.sc!=='lobby')return;return{sc:'dance',song:i,seed,at,by:me.n}});
}
function judge(name,why=''){
  const song=songOf(S),J=JUDGE.find(j=>j[0]===name),last=D.bar===song.bars-1;
  D.judged=true;D.cnt[name]++;
  if(J&&name!=='BAD'){D.combo++;D.maxc=Math.max(D.maxc,D.combo)}else D.combo=0;
  const pts=J?Math.round(J[2]*(1+Math.min(D.combo,20)*.1)*(1+D.seq.length/8)*(last?2:1)):0;
  D.score+=pts;D.last={j:name,t:now(),pts,why};
  if(J&&name!=='BAD'){me.a=DANCE_MOVES[Math.floor(Math.random()*DANCE_MOVES.length)];me.busy=barSec(song)*.9;music.blip(name==='PERFECT'?'perfect':'ok')}
  else{me.a='emote-no';me.busy=1;music.blip('bad')}
}
function danceKey(k){
  if(!D||D.judged||D.bar<INTRO_BARS)return;
  const a=D.seq[D.idx];if(!a)return;
  if(k===(a.rev?OPP[a.d]:a.d)){D.idx++;music.blip('ok')}else{D.idx=0;D.wrongT=now();music.blip('bad')} // a wrong key resets the bar, like Audition
}
function danceSpace(){
  if(!D||D.judged||D.bar<INTRO_BARS)return;
  if(D.idx<D.seq.length)return judge('MISS','ลูกศรยังไม่ครบ');
  const song=songOf(S),st=(now()-S.at)/1000,err=Math.abs(st-(D.bar*4+3)*barSec(song)/4)*1000;
  const j=JUDGE.find(j=>err<=j[1]);judge(j?j[0]:'MISS',j?'':'ไม่ตรงจังหวะ');
}
function finishDance(){
  if(!D||D.done)return;D.done=true;
  if(!me.n||D.score<=0)return;
  const nm=me.n,extra=`Perfect ${D.cnt.PERFECT} · คอมโบ ${D.maxc}`,score=D.score;
  import('./online.js?v=2').then(async O=>{const res=await O.submit('dance',nm,score,extra);const rows=await O.board('dance','d'),i=rows.findIndex(r=>r.k===O.nameKey(nm));
    if(i>=0)toast(`🏆 อันดับวันนี้ Office Audition: #${i+1}`);
    if(res&&res.d&&i===0)O.pushFeed(`👑 ${nm} ขึ้นที่ 1 วันนี้ 🕺 Office Audition (${score})`,nm,store.get('partyAva','p_office'))}).catch(()=>{});
}
function danceTick(t,dt){
  const song=songOf(S),bs=barSec(song),st=(t-S.at)/1000,bar=Math.floor(st/bs);
  // stand on my dance-floor slot facing the camera
  const order=Object.entries(players).sort((a,b)=>a[1].j-b[1].j).map(([id])=>id),slot=danceSlot(Math.max(0,order.indexOf(me.id)));
  me.x+=(slot.x-me.x)*Math.min(1,dt*8);me.z+=(slot.z-me.z)*Math.min(1,dt*8);me.r=0;me.y=Math.abs(Math.sin(st*Math.PI*song.bpm/60))*.08;
  if(D&&st>=0){
    if(bar>=INTRO_BARS&&bar<song.bars&&bar!==D.bar){if(!D.judged&&D.bar>=INTRO_BARS)judge('MISS','ช้าไป');D.bar=bar;D.seq=seqFor(S,bar);D.idx=0;D.judged=false}
    if(!D.judged&&D.bar>=INTRO_BARS&&st>(D.bar*4+3)*bs/4+.25)judge('MISS','ช้าไป');
    if(st>=song.bars*bs)finishDance();
  }
  me.busy=Math.max(0,me.busy-dt);if(me.busy<=0)me.a='idle';
  danceHud(t,st,song);
}
function danceHud(t,st,song){
  const el=$('#dpanel'),cnt=$('#count');
  if(st<0){cnt.hidden=false;cnt.innerHTML=`<b>${Math.ceil(-st)}</b><span>🎵 ${song.th} (${song.level}) — กดลูกศรตามให้ครบ แล้วกด Space ตอนเข็มถึงเส้นจังหวะที่ 4</span>`}else cnt.hidden=true;
  el.hidden=false;
  const bs=barSec(song),ph=st<0?0:(st%bs)/bs,inPlay=D&&D.bar>=INTRO_BARS&&st<song.bars*bs,last=D&&D.bar===song.bars-1;
  const arrows=inPlay?D.seq.map((a,i)=>`<span class="ar${i<D.idx?' ok':''}${a.rev?' rev':''}">${ARROW[a.d]}</span>`).join(''):`<span class="muted">${st<song.bars*bs?(st<INTRO_BARS*bs?'เตรียมตัว… ♪':'') :'จบเพลง!'}</span>`;
  const shake=D&&t-D.wrongT<250?' shake':'';
  const L=D&&D.last&&t-D.last.t<900?`<div class="judge" style="color:${JCOL[D.last.j]}">${D.last.j}${D.combo>1&&D.last.j!=='MISS'&&D.last.j!=='BAD'?` <small>x${D.combo}</small>`:''}${D.last.why?`<small class="why">${D.last.why}</small>`:''}</div>`:'';
  el.innerHTML=`${L}<div class="drow${shake}">${last&&inPlay?'<span class="fin">FINISH!</span>':''}${arrows}</div>
    <div class="beat"><i style="left:${ph*100}%"></i><b style="left:75%"></b></div>
    <div class="dstat">⭐ ${D?D.score:0} · คอมโบ ${D?D.combo:0} · 🎵 ${song.th} · ห้อง ${Math.max(0,Math.min(song.bars,Math.floor(st/bs)+1))}/${song.bars}</div>`;
  // live scoreboard
  const rows=Object.entries(players).map(([id,p])=>({n:p.n,s:id===me.id?(D?D.score:0):(p.ds||0),me:id===me.id})).sort((a,b)=>b.s-a.s);
  const sb=$('#khud');sb.hidden=false;sb.innerHTML=rows.slice(0,6).map((r,i)=>`<div class="tk${r.me?' meK':''}"><b>${['🥇','🥈','🥉'][i]||'#'+(i+1)} ${esc(r.n)}</b><span>${r.s}</span></div>`).join('');
}
function startKitchen(){
  const t=now(),at=t+LEAD_MS;
  runTransaction(ref(db,R+'/s'),cur=>{if(cur&&cur.sc&&cur.sc!=='lobby')return;return{sc:'kitchen',at,by:me.n}}).then(r=>{
    if(!r.committed)return;remove(ref(db,R+'/ki'));
    set(ref(db,R+'/k'),{st:{fill1:{p:0},fill2:{p:0},stamp:{p:0}},oc:0,sc:0,done:0,fail:0,end:at+KITCHEN_MS,nx:at+1500,ev:{t:0,m:''}});
  });
}
let hostAcc=0;
function host(t,dt){
  if(S.sc==='kitchen'&&K&&t>S.at){hostAcc+=dt;if(hostAcc>=.1){hostKitchen(t,hostAcc);hostAcc=0}}
  if(S.sc==='dance'&&t>S.at+songOf(S).bars*barSec(songOf(S))*1000+2500){
    const at=S.at,song=songOf(S),list=Object.values(players).map(p=>({n:p.n,c:p.c,ds:p.ds||0,mc:p.dmc||0})).sort((a,b)=>b.ds-a.ds);
    runTransaction(ref(db,R+'/s'),cur=>{if(!cur||cur.sc!=='dance'||cur.at!==at)return;return{sc:'res',g:'dance',song:S.song|0,res:list,at:t}}).then(r=>{
      if(r.committed&&list[0]&&list[0].ds>0)push(ref(db,'rooms/_hub/feed'),{m:`💃 ${list[0].n} ชนะ Office Audition เพลง ${song.th} (${list[0].ds} คะแนน) จาก ${list.length} คน`,n:list[0].n,a:'',t})});
  }
  if(S.sc==='res'&&t>S.at+RES_MS){const at=S.at;runTransaction(ref(db,R+'/s'),cur=>{if(!cur||cur.sc!=='res'||cur.at!==at)return;return{sc:'lobby'}})}
}
function hostKitchen(t,dt){
  const k=JSON.parse(JSON.stringify(K));k.o=k.o||{};k.h=k.h||{};k.st=k.st||{};let ch=false;
  for(const it of intents.splice(0)){remove(ref(db,`${R}/ki/${it.key}`));const p=players[it.pid];if(!p||t-it.t>4000)continue;ch=applyIntent(k,it,p,t)||ch}
  for(const s of KST){const w=WORK[s.t];if(!w)continue;const slot=k.st[s.id]||(k.st[s.id]={p:0});
    if(!slot.i||!w.need(slot.i)){if(slot.p){slot.p=0;ch=true}continue}
    const n=Object.values(players).filter(p=>p.wk===s.id&&nearSt(p,s)).length;
    if(n){slot.p+=dt*(1+.6*(n-1))/w.dur;ch=true;if(slot.p>=1){w.apply(slot.i);slot.p=0}}}
  if(t>=k.nx&&Object.keys(k.o).length<4){k.oc++;k.o['o'+k.oc]={r:Math.floor(Math.random()*(t-S.at>40000?4:3)),exp:t+55000,t};
    k.nx=t+Math.max(6000,13000-Object.keys(players).length*900);ch=true}
  for(const [id,o] of Object.entries(k.o))if(t>o.exp){delete k.o[id];k.fail++;k.sc=Math.max(0,k.sc-15);k.ev={t,m:'⏰ งานหลุดกำหนด −15'};ch=true}
  if(t>=k.end){const at=S.at,team=Object.keys(players).length,stars=k.sc>=400?'⭐⭐⭐':k.sc>=220?'⭐⭐':k.sc>=90?'⭐':'';
    runTransaction(ref(db,R+'/s'),cur=>{if(!cur||cur.sc!=='kitchen'||cur.at!==at)return;return{sc:'res',score:k.sc,done:k.done,fail:k.fail,at:t}}).then(r=>{
      if(!r.committed)return;runTransaction(ref(db,R+'/best'),v=>Math.max(v||0,k.sc));
      push(ref(db,'rooms/_hub/feed'),{m:`🍳 ทีมครัวเอกสาร 3D ${team} คน ส่งงาน ${k.done} ชิ้น ได้ ${k.sc} คะแนน ${stars}`,n:'',a:'',t})});return}
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
function kitchenTarget(t){
  const held=K&&K.h&&K.h[me.id];if(held&&nearBoss(me,t))return'boss';
  let best=null,bd=9;for(const s of KST){const d=Math.hypot(me.x-s.px,me.z-s.pz);if(d<USE_R&&d<bd){best=s;bd=d}}return best?best.id:'';
}
function renderBar(){
  const b=$('#bar');
  if(S.sc==='lobby')b.innerHTML=`<button class="btn primary" id="startK">🍳 เริ่มครัวเอกสาร</button>${SONGS.map((g,i)=>`<button class="btn" data-song="${i}">🕺 ${g.th} <small class="muted">(${g.level})</small></button>`).join('')}<span class="muted">ใครกดก็ได้ ทุกคนในห้องเล่นด้วยกัน</span>`;
  else b.innerHTML=`<span class="muted">${S.sc==='kitchen'?'🍳 ครัวเอกสาร — หยิบกระดาษ → กรอก/ปั๊ม/ให้หัวหน้าเซ็น → ส่งให้ตรงใบงาน':S.sc==='dance'?'🕺 Office Audition — ลูกศร / WASD / 4 8 6 2 ตามให้ครบ แล้ว Space ตรงจังหวะที่ 4':'📊 สรุปผล'}${S.by?' · เริ่มโดย '+esc(S.by):''}</span>`;
  const s=$('#startK');if(s)s.onclick=startKitchen;
  b.querySelectorAll('[data-song]').forEach(x=>x.onclick=()=>startDance(+x.dataset.song));
  $('#dpad').hidden=S.sc!=='dance';
}
function renderRes(){
  const el=$('#res');if(S.sc!=='res'){el.hidden=true;return}
  if(S.g==='dance'){const m=['🥇','🥈','🥉'];el.hidden=false;
    el.innerHTML=`<div class="panel"><h2>🕺 Office Audition</h2><p class="muted">${esc(songOf(S).th)}</p><ol class="rank">${(S.res||[]).map((r,i)=>`<li><img src="assets/3d/chars/previews/character-${CHARS.includes(r.c)?r.c:'female-a'}.png" alt=""><b>${esc(r.n)}</b><span>${m[i]||'#'+(i+1)} ${r.ds} · คอมโบ ${r.mc}</span></li>`).join('')}</ol>${D?`<p>ของคุณ: Perfect ${D.cnt.PERFECT} · Great ${D.cnt.GREAT} · Cool ${D.cnt.COOL} · Bad ${D.cnt.BAD} · Miss ${D.cnt.MISS}</p>`:''}<p class="muted">กลับห้องรวมใน 10 วินาที</p></div>`;return}
  const stars=S.score>=400?'⭐⭐⭐':S.score>=220?'⭐⭐':S.score>=90?'⭐':'💀';
  el.hidden=false;el.innerHTML=`<div class="panel"><h2>🍳 ครัวเอกสาร</h2><div style="font-size:52px;font-weight:800;line-height:1">${S.score||0}</div><div style="font-size:30px">${stars}</div>
    <p>ส่งงานสำเร็จ ${S.done||0} ชิ้น · หลุด ${S.fail||0} ชิ้น<br><span class="muted">สถิติห้องนี้: ${Math.max(best,S.score||0)}</span></p><p class="muted">กลับห้องรวมใน 10 วินาที</p></div>`;
}
function kitchenHud(t){
  const el=$('#khud');
  if(S.sc==='dance')return;$('#dpanel').hidden=true;
  if(S.sc!=='kitchen'||!K){el.hidden=true;$('#count').hidden=true;return}
  if(t<S.at){$('#count').hidden=false;$('#count').innerHTML=`<b>${Math.ceil((S.at-t)/1000)}</b><span>หยิบกระดาษ → กรอก / ปั๊มตรา / ให้หัวหน้าเซ็น → ส่งให้ตรงใบงาน</span>`}else $('#count').hidden=true;
  el.hidden=false;
  const ords=Object.values(K.o||{}).sort((a,b)=>a.t-b.t);
  el.innerHTML=`<div class="kt">⏱ ${Math.max(0,Math.ceil((K.end-t)/1000))} · ⭐ ${K.sc||0}</div>`+ords.map(o=>{const r=RECIPES[o.r],f=Math.max(0,(o.exp-t)/55000);
    return`<div class="tk"><b>${r.n}</b><span>✍️${r.s?' 🔏':''}${r.g?' ✒️':''}</span><i style="width:${f*100}%;background:${f<.3?'#ff4d4d':'#21c07a'}"></i></div>`}).join('');
}
async function syncOthers(){
  for(const [id,p] of Object.entries(players)){if(id===me.id)continue;
    let o=others[id];
    if(!o){o=others[id]={x:p.x,z:p.z,y:0,r:p.r||0,av:null,c:p.c,tag:tagFor(p,false),loading:true};makeAvatar(p.c).then(av=>{o.av=av;o.loading=false})}
    else if(o.c!==p.c&&!o.loading){o.loading=true;o.c=p.c;const old=o.av;makeAvatar(p.c).then(av=>{old&&scene.remove(old.o);o.av=av;o.loading=false})}}
  for(const id of Object.keys(others))if(!players[id]){others[id].av&&scene.remove(others[id].av.o);others[id].tag.remove();delete others[id]}
  renderList();
}
function send(t){
  if(!meRef||t-sendT<100)return;
  const o={n:me.n,c:me.c,j:me.j,x:+me.x.toFixed(2),z:+me.z.toFixed(2),y:+me.y.toFixed(2),r:+me.r.toFixed(2),a:me.a,e:me.e,et:me.et,wk:me.wk,v:vis};
  if(S.sc==='dance'&&D){o.ds=D.score;o.dc=D.combo;o.dmc=D.maxc;if(D.last){o.dj=D.last.j;o.djt=D.last.t}}
  const s=JSON.stringify(o);if(s===last&&t-sendT<4000)return;sendT=t;last=s;set(meRef,o);
}
function renderList(){
  $('#plist').innerHTML=Object.entries(players).sort((a,b)=>a[1].j-b[1].j).map(([id,p])=>`<li><img src="assets/3d/chars/previews/character-${CHARS.includes(p.c)?p.c:'female-a'}.png" alt=""><b>${esc(p.n)}</b>${id===me.id?' (คุณ)':''}</li>`).join('')||'<li class="muted">ยังไม่มีใคร</li>';
}

/* ---------- main loop ---------- */
const clock=new THREE.Clock();let fpsT=0,frames=0,fps=0;
function frame(){
  const dt=Math.min(.05,clock.getDelta()),t=now();
  const kit=S.sc==='kitchen'&&K,frozen=S.sc==='kitchen'&&t<S.at;
  let tg='';
  if(myAv){
    if(kit&&!frozen){tg=kitchenTarget(t);if(actPress&&tg){push(ref(db,R+'/ki'),{pid:me.id,st:tg,t})}
      const s=KST.find(s=>s.id===tg);me.wk=keys.e&&s&&WORK[s.t]?s.id:''}else me.wk='';
    actPress=false;jumpPress=S.sc==='dance'?false:jumpPress;
    if(S.sc==='dance')danceTick(t,dt);else step(dt,frozen);
    myAv.o.position.set(me.x,me.y,me.z);myAv.o.rotation.y=me.r;myAv.play(me.a);myAv.mixer.update(dt);
    const myJ=S.sc==='dance'&&D&&D.last&&t-D.last.t<1200?D.last.j+(D.combo>1?' x'+D.combo:''):'';
    placeTag(myTag,me.x,me.y,me.z,me.n+' ★',me.e,me.et,t,kit?badges(K.h&&K.h[me.id]):myJ);send(t);
    if(db&&hostId()===me.id)host(t,dt);else intents.length=0;
  }
  // stations + boss only during the kitchen round
  for(const s of KST){const e=stEls[s.id];if(!e)continue;e.ring.visible=!!kit;e.d.hidden=!kit;if(!kit)continue;
    e.ring.material.color.set(tg===s.id?'#21c07a':'#ff5c8a');placeLabel(e.d,s.px,1.05,s.pz);
    const slot=K.st&&K.st[s.id];const it=slot&&slot.i?badges(slot.i):'';if(e.it.textContent!==it)e.it.textContent=it;
    e.pg.hidden=!(slot&&slot.p>0);if(slot&&slot.p>0)e.bar.style.width=Math.min(100,slot.p*100)+'%'}
  if(boss){const show=!!kit&&!bossAway(t),b=bossPos(t);boss.o.visible=show;bossTag.hidden=!kit;
    if(kit){if(show){boss.o.position.set(b.x,0,b.z);boss.o.rotation.y=Math.cos(t/3200)>0?Math.PI/2:-Math.PI/2;boss.play('walk');boss.mixer.update(dt);
      placeTag(bossTag,b.x,0,b.z,tg==='boss'?'หัวหน้า ✒️ กด E ให้เซ็น':'หัวหน้า ✒️ เซ็นเอกสาร','',0,t)}
      else placeTag(bossTag,5.2,0,-3.4,'🗓 หัวหน้าไปประชุม','',0,t)}}
  kitchenHud(t);
  if(K&&K.ev&&K.ev.t!==lastEv){lastEv=K.ev.t;if(t-K.ev.t<3000&&K.ev.m)toast(K.ev.m)}
  for(const [id,o] of Object.entries(others)){const p=players[id];if(!p)continue;
    o.x+=(p.x-o.x)*Math.min(1,dt*10);o.z+=(p.z-o.z)*Math.min(1,dt*10);o.y+=((p.y||0)-o.y)*Math.min(1,dt*12);
    let dr=(p.r||0)-o.r;dr=Math.atan2(Math.sin(dr),Math.cos(dr));o.r+=dr*Math.min(1,dt*10);
    if(o.av){o.av.o.position.set(o.x,o.y,o.z);o.av.o.rotation.y=o.r;o.av.play(p.a||'idle');o.av.mixer.update(dt)}
    if(S.sc==='dance'&&o.av)o.av.o.position.y=Math.abs(Math.sin((t-S.at)/1000*Math.PI*songOf(S).bpm/60))*.08;
    placeTag(o.tag,o.x,o.y,o.z,p.n,p.e,p.et,t,kit?badges(K.h&&K.h[id]):S.sc==='dance'&&p.dj&&t-p.djt<1200?p.dj+(p.dc>1?' x'+p.dc:''):'')}
  // disco floor flashes on the beat during the dance
  if(disco.length){const on=S.sc==='dance',beat=on?Math.floor((t-S.at)/1000*songOf(S).bpm/60):0;
    disco.forEach((m,i)=>{m.visible=on;if(on)m.material.color.setHSL(((beat*47+i*29)%360)/360,.8,.6)})}
  renderer.render(scene,camera);
  frames++;fpsT+=dt;if(fpsT>=1){fps=Math.round(frames/fpsT);frames=0;fpsT=0;$('#hud').textContent=`${fps} fps · ${Object.keys(players).length} คนในห้อง`}
  requestAnimationFrame(frame);
}

/* ---------- join ---------- */
function joinPanel(){
  let c=store.get('avatar3d',CHARS[Math.floor(Math.random()*CHARS.length)]);
  const ov=document.createElement('div');ov.className='overlay';
  ov.innerHTML=`<div class="panel"><h2>🧊 ห้องรวม 3D</h2><p class="muted">เลือกตัวละครแล้วเข้าห้อง — กล้องล็อกมุมเดียว ทุกคนเห็นห้องเหมือนกัน</p>
    <label class="field">ชื่อเล่น <input maxlength="12" value="${esc(store.get('name',''))}" placeholder="เช่น พล"></label>
    <div class="avas">${CHARS.map(k=>`<button class="${k===c?'on':''}" data-c="${k}"><img src="assets/3d/chars/previews/character-${k}.png" alt=""></button>`).join('')}</div>
    <div style="margin-top:14px"><button class="btn primary" data-go>🚪 เข้าห้อง</button></div></div>`;
  ov.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{c=b.dataset.c;ov.querySelectorAll('[data-c]').forEach(x=>x.classList.toggle('on',x===b))});
  ov.querySelector('[data-go]').onclick=()=>{music.unlock();const n=ov.querySelector('input').value.trim()||'ผู้เล่นปริศนา';store.set('name',n);store.set('avatar3d',c);ov.remove();join(n,c)};
  document.body.appendChild(ov);
}
async function join(n,c){
  me.n=n;me.c=c;me.id=Math.random().toString(36).slice(2,10);
  myAv=await makeAvatar(c);myTag=tagFor(me,true);
  // spawn on a free spot near the rug
  for(let i=0;i<50;i++){const x=(Math.random()-.5)*4,z=1+Math.random()*2.5;if(!blocked(x,z)){me.x=x;me.z=z;break}}
  if(!FIREBASE_CONFIG){$('#hud').textContent='ออฟไลน์ (ยังไม่ตั้งค่า Firebase)';return}
  const app=getApps().find(a=>a.name==='lobby3d')||initializeApp(FIREBASE_CONFIG,'lobby3d');db=getDatabase(app);
  onValue(ref(db,'.info/serverTimeOffset'),s=>{offset=s.val()||0});
  meRef=ref(db,`rooms/lobby3d/p/${me.id}`);onDisconnect(meRef).remove();
  onValue(ref(db,R+'/p'),s=>{players=s.val()||{};syncOthers()});
  onValue(ref(db,R+'/s'),s=>onState(s.val()||{sc:'lobby'}));
  onValue(ref(db,R+'/k'),s=>{K=s.val()});
  onValue(ref(db,R+'/best'),s=>{best=s.val()||0});
  onChildAdded(ref(db,R+'/ki'),s=>{intents.push({key:s.key,...s.val()})});
  setInterval(()=>{const v=document.hidden?0:1;if(v!==vis){vis=v;sendT=0;last=''}},500);
  addEventListener('pagehide',()=>remove(meRef));
  boss=await makeAvatar('male-f');boss.o.visible=false;bossTag=tagFor({},false);bossTag.hidden=true;
  // show up as "in the 3D room" in the hub's online box
  import('./online.js?v=2').then(O=>O.setPresence({n,a:store.get('partyAva','p_office'),g:'party3d'})).catch(()=>{});
}

// ?debug exposes state for local testing
if(location.search.includes('debug'))window.__p3={me,keys,get K(){return K},get S(){return S},get players(){return players},get D(){return D},dkey:k=>danceKey(k),dspace:()=>danceSpace(),now:()=>now(),press:()=>{actPress=true},tick:()=>frame()};
document.querySelectorAll('#dpad [data-d]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();b.dataset.d==='sp'?danceSpace():danceKey(b.dataset.d)}));
$('#mute').textContent=music.muted?'🔇':'🔊';$('#mute').onclick=()=>{music.muted=!music.muted;store.set('muted3d',music.muted);$('#mute').textContent=music.muted?'🔇':'🔊'};
buildRoom().catch(e=>console.error(e)).finally(()=>{buildStations();buildDisco();renderBar();$('#loading').remove();requestAnimationFrame(frame);joinPanel()});
