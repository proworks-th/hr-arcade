// Test-mode stand-in for firebase-database (loaded only with ?test=1 via the import map in the HTML head).
// In-memory tree, replicated across tabs of the same browser with BroadcastChannel; never touches the network.
const bc=new BroadcastChannel('hra-mockdb');let tree={};const subs=[];
const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
const parts=p=>p.split('/').filter(Boolean);
function getPath(p){let n=tree;for(const k of parts(p)){if(n==null||typeof n!=='object')return null;n=n[k]}return n??null}
function setPath(p,v){const ks=parts(p);if(!ks.length){tree=v||{};return}let n=tree;
  for(const k of ks.slice(0,-1)){if(typeof n[k]!=='object'||n[k]==null)n[k]={};n=n[k]}
  const last=ks[ks.length-1];if(v==null)delete n[last];else n[last]=v}
function snap(p,q){let v=clone(getPath(p));
  if(v&&q&&q.last&&typeof v==='object'){const ks=Object.keys(v).sort().slice(-q.last);v=Object.fromEntries(ks.map(k=>[k,v[k]]))}
  return{key:parts(p).pop()??null,ref:ref(null,p),val:()=>v,exists:()=>v!=null,
    forEach(cb){if(v&&typeof v==='object')for(const k of Object.keys(v))cb(snap(p+'/'+k))}}}
function notify(p){for(const s of subs.slice()){const a=s.path,b=p;
  if(!(b===a||b.startsWith(a+'/')||a.startsWith(b+'/')||a===''||b===''))continue;
  if(s.child){const v=getPath(a)||{};for(const k of Object.keys(v))if(!s.seen.has(k)){s.seen.add(k);s.cb(snap(a+'/'+k))}}
  else s.cb(snap(a,s.q))}}
const stamp=v=>JSON.parse(JSON.stringify(v??null),(k,x)=>x&&x['.sv']==='timestamp'?Date.now():x);
function apply(p,v){setPath(p,stamp(v));notify(p)}
bc.onmessage=e=>{const d=e.data;if(d.hello)bc.postMessage({tree});else if(d.tree){if(!Object.keys(tree).length){tree=d.tree;notify('')}}else apply(d.path,d.val)};
bc.postMessage({hello:true});
export const getDatabase=()=>({});
export const ref=(db,path='')=>({path:parts(path).join('/'),key:parts(path).pop()??null});
export const serverTimestamp=()=>({'.sv':'timestamp'});
export function set(r,v){apply(r.path,v);bc.postMessage({path:r.path,val:stamp(v)});return Promise.resolve()}
export const remove=r=>set(r,null);
export const update=(r,v)=>Promise.all(Object.entries(v).map(([k,x])=>set(ref(null,r.path+'/'+k),x)));
export async function get(r){return snap(r.path,r.q)}
export const query=(r,...cs)=>({path:r.path,key:r.key,q:Object.assign({},...cs)});
export const limitToLast=n=>({last:n});
export const orderByChild=()=>({});
export const endAt=()=>({});
export function onValue(r,cb){const s={path:r.path,cb,q:r.q};subs.push(s);setTimeout(()=>cb(snap(r.path,r.q)),0);return()=>subs.splice(subs.indexOf(s),1)}
export function onChildAdded(r,cb){const s={path:r.path,cb,child:true,seen:new Set()};subs.push(s);setTimeout(()=>notify(r.path),0);return()=>subs.splice(subs.indexOf(s),1)}
export function push(r,v){const k=Date.now().toString(36)+Math.random().toString(36).slice(2,6);const c=ref(null,r.path+'/'+k);return v===undefined?c:set(c,v).then(()=>c)}
export const onDisconnect=r=>({remove(){addEventListener('pagehide',()=>remove(r));return Promise.resolve()}});
export function runTransaction(r,fn){const nv=fn(clone(getPath(r.path)));if(nv===undefined)return Promise.resolve({committed:false});return set(r,nv).then(()=>({committed:true}))}
