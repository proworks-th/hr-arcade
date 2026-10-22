// 3D lobby prototype: one locked top-down camera for everyone, Kenney Mini Characters + Furniture Kit (CC0),
// players synced through Firebase RTDB under rooms/lobby3d (the database rules only open rooms/$room).
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getDatabase,ref,set,remove,onValue,onDisconnect} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {FIREBASE_CONFIG} from './firebase-config.js';

const $=s=>document.querySelector(s);
const store={get(k,d){try{const v=localStorage.getItem('hra_'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
             set(k,v){try{localStorage.setItem('hra_'+k,JSON.stringify(v))}catch(e){}}};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CHARS=['female-a','female-b','female-c','female-d','female-e','female-f','male-a','male-b','male-c','male-d','male-e','male-f'];
const EMOTES=['👋','😂','😱','👍','🔥','หัวหน้ามา!','รอด้วย!','GG'];
const EMOTE_ANIM={'👋':'interact-right','👍':'emote-yes','😱':'die','🔥':'emote-yes'};
const X0=-7.5,X1=7.5,Z0=-4.3,Z1=4.6,SPEED=3.6,RAD=0.34,CHAR_H=1.3,FS=1.5; // FS: furniture scale so the kit matches the chibi characters

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
function tagFor(p,isMe){const d=document.createElement('div');d.className='tag';d.innerHTML=`<div class="bub" hidden></div><div class="nm${isMe?' me':''}"></div>`;labels.appendChild(d);return d}
function placeTag(tag,x,y,z,name,e,et,now){
  tmp.set(x,y+CHAR_H+.15,z).project(camera);
  tag.style.left=((tmp.x+1)/2*100)+'%';tag.style.top=((1-tmp.y)/2*100)+'%';
  const nm=tag.lastChild,bub=tag.firstChild;if(nm.textContent!==name)nm.textContent=name;
  const show=e&&now-et<3500;if(bub.hidden===!!show){bub.hidden=!show}if(show&&bub.textContent!==e)bub.textContent=e;
}

/* ---------- input: keyboard + touch joystick ---------- */
const keys={};let jumpPress=false,joy={x:0,y:0};
const KM={ArrowLeft:'l',a:'l',A:'l',ArrowRight:'r',d:'r',D:'r',ArrowUp:'u',w:'u',W:'u',ArrowDown:'dn',s:'dn',S:'dn'};
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input'))return;
  if(KM[e.key]){keys[KM[e.key]]=1;e.preventDefault()}else if(e.key===' '){if(!e.repeat)jumpPress=true;e.preventDefault()}
  else{const n=+e.key;if(n>=1&&n<=EMOTES.length)emote(n-1)}});
addEventListener('keyup',e=>{if(KM[e.key])keys[KM[e.key]]=0});
(function joystick(){const el=$('#joy'),knob=el.querySelector('i');let id=null;
  const upd=e=>{const r=el.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,l=Math.hypot(dx,dy),m=Math.min(l,40);
    joy={x:l?dx/l*m/40:0,y:l?dy/l*m/40:0};knob.style.transform=`translate(${joy.x*40}px,${joy.y*40}px)`};
  el.addEventListener('pointerdown',e=>{id=e.pointerId;el.setPointerCapture(id);upd(e)});
  el.addEventListener('pointermove',e=>{if(e.pointerId===id)upd(e)});
  const end=()=>{id=null;joy={x:0,y:0};knob.style.transform=''};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)})();
$('#tJump').addEventListener('pointerdown',e=>{e.preventDefault();jumpPress=true});
$('#emotes').innerHTML=EMOTES.map((e,i)=>`<button class="btn sm" data-e="${i}">${e}</button>`).join('');
document.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>emote(+b.dataset.e));

/* ---------- local player ---------- */
const me={n:'',c:'female-a',x:0,z:2,y:0,vy:0,r:0,a:'idle',e:'',et:0,j:Date.now(),busy:0};
let myAv=null,myTag=null;
function emote(i){const e=EMOTES[i];me.e=e;me.et=now();if(EMOTE_ANIM[e]){me.a=EMOTE_ANIM[e];me.busy=1.2}}
const blocked=(x,z)=>x<X0||x>X1||z<Z0||z>Z1||obstacles.some(o=>x>o.x0-RAD&&x<o.x1+RAD&&z>o.z0-RAD&&z<o.z1+RAD);
function step(dt){
  let dx=(keys.r?1:0)-(keys.l?1:0)+joy.x,dz=(keys.dn?1:0)-(keys.u?1:0)+joy.y;const l=Math.hypot(dx,dz);
  if(l>1){dx/=l;dz/=l}
  const moving=l>.15;
  if(moving){const nx=me.x+dx*SPEED*dt,nz=me.z+dz*SPEED*dt;if(!blocked(nx,me.z))me.x=nx;if(!blocked(me.x,nz))me.z=nz;me.r=Math.atan2(dx,dz)}
  if(jumpPress&&me.y<=0){me.vy=5.2;me.busy=0}jumpPress=false;
  me.vy-=14*dt;me.y=Math.max(0,me.y+me.vy*dt);if(me.y===0)me.vy=0;
  me.busy=Math.max(0,me.busy-dt);
  me.a=me.y>0?'jump':moving?(me.busy=0,'walk'):me.busy>0?me.a:'idle';
}

/* ---------- network ---------- */
let offset=0;const now=()=>Date.now()+offset;
const others={};let players={},db=null,meRef=null,sendT=0,last='';
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
  const o={n:me.n,c:me.c,j:me.j,x:+me.x.toFixed(2),z:+me.z.toFixed(2),y:+me.y.toFixed(2),r:+me.r.toFixed(2),a:me.a,e:me.e,et:me.et};
  const s=JSON.stringify(o);if(s===last&&t-sendT<4000)return;sendT=t;last=s;set(meRef,o);
}
function renderList(){
  $('#plist').innerHTML=Object.entries(players).sort((a,b)=>a[1].j-b[1].j).map(([id,p])=>`<li><img src="assets/3d/chars/previews/character-${CHARS.includes(p.c)?p.c:'female-a'}.png" alt=""><b>${esc(p.n)}</b>${id===me.id?' (คุณ)':''}</li>`).join('')||'<li class="muted">ยังไม่มีใคร</li>';
}

/* ---------- main loop ---------- */
const clock=new THREE.Clock();let fpsT=0,frames=0,fps=0;
function frame(){
  const dt=Math.min(.05,clock.getDelta()),t=now();
  if(myAv){step(dt);myAv.o.position.set(me.x,me.y,me.z);myAv.o.rotation.y=me.r;myAv.play(me.a);myAv.mixer.update(dt);placeTag(myTag,me.x,me.y,me.z,me.n+' ★',me.e,me.et,t);send(t)}
  for(const [id,o] of Object.entries(others)){const p=players[id];if(!p)continue;
    o.x+=(p.x-o.x)*Math.min(1,dt*10);o.z+=(p.z-o.z)*Math.min(1,dt*10);o.y+=((p.y||0)-o.y)*Math.min(1,dt*12);
    let dr=(p.r||0)-o.r;dr=Math.atan2(Math.sin(dr),Math.cos(dr));o.r+=dr*Math.min(1,dt*10);
    if(o.av){o.av.o.position.set(o.x,o.y,o.z);o.av.o.rotation.y=o.r;o.av.play(p.a||'idle');o.av.mixer.update(dt)}
    placeTag(o.tag,o.x,o.y,o.z,p.n,p.e,p.et,t)}
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
  ov.querySelector('[data-go]').onclick=()=>{const n=ov.querySelector('input').value.trim()||'ผู้เล่นปริศนา';store.set('name',n);store.set('avatar3d',c);ov.remove();join(n,c)};
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
  onValue(ref(db,'rooms/lobby3d/p'),s=>{players=s.val()||{};syncOthers()});
  addEventListener('pagehide',()=>remove(meRef));
  // show up as "in the 3D room" in the hub's online box
  import('./online.js?v=1').then(O=>O.setPresence({n,a:store.get('partyAva','p_office'),g:'party3d'})).catch(()=>{});
}

buildRoom().catch(e=>console.error(e)).finally(()=>{$('#loading').remove();requestAnimationFrame(frame);joinPanel()});
