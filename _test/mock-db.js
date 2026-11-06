// Test-only stand-in for firebase-database: in-memory tree replicated across tabs via BroadcastChannel.
const bc=new BroadcastChannel('mockdb');let tree={};const subs=[];
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
const parts=p=>p.split('/').filter(Boolean);
function getPath(p){let n=tree;for(const k of parts(p)){if(n==null||typeof n!=='object')return null;n=n[k]}return n??null}
function setPath(p,v){const ks=parts(p);if(!ks.length){tree=v||{};return}let n=tree;
  for(const k of ks.slice(0,-1)){if(typeof n[k]!=='object'||n[k]==null)n[k]={};n=n[k]}
  const last=ks[ks.length-1];if(v==null)delete n[last];else n[last]=v}
const snap=p=>({key:parts(p).pop(),val:()=>clone(getPath(p))});
function notify(p){for(const s of subs.slice()){const a=s.path,b=p;
  if(!(b===a||b.startsWith(a+'/')||a.startsWith(b+'/')||a===''))continue;
  if(s.child){const v=getPath(a)||{};for(const k of Object.keys(v))if(!s.seen.has(k)){s.seen.add(k);s.cb(snap(a+'/'+k))}}
  else s.cb(snap(a))}}
function apply(p,v){setPath(p,clone(v));notify(p)}
bc.onmessage=e=>{const d=e.data;if(d.hello)bc.postMessage({tree});else if(d.tree){if(!Object.keys(tree).length){tree=d.tree;notify('')}}else apply(d.path,d.val)};
bc.postMessage({hello:true});
export const getDatabase=()=>({});
export const ref=(db,path)=>({path:parts(path).join('/'),key:parts(path).pop()});
export function set(r,v){apply(r.path,v);bc.postMessage({path:r.path,val:clone(v)});return Promise.resolve()}
export const remove=r=>set(r,null);
export function onValue(r,cb){const s={path:r.path,cb};subs.push(s);setTimeout(()=>cb(snap(r.path)),0);return()=>subs.splice(subs.indexOf(s),1)}
export function onChildAdded(r,cb){const s={path:r.path,cb,child:true,seen:new Set()};subs.push(s);setTimeout(()=>notify(r.path),0);return()=>subs.splice(subs.indexOf(s),1)}
export function push(r,v){return set(ref(null,r.path+'/'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),v)}
export const onDisconnect=r=>({remove(){addEventListener('pagehide',()=>remove(r))}});
export function runTransaction(r,fn){const nv=fn(clone(getPath(r.path)));if(nv===undefined)return Promise.resolve({committed:false});return set(r,nv).then(()=>({committed:true}))}
