// PREVIEW COPY (phone-first branch): always test mode, and its own storage, so nothing here touches
// the live game's saved data on this phone (same web address as the live site).
(function(){
  var real=window.localStorage,P='hrapv:';
  var shim={getItem:function(k){return real.getItem(P+k)},setItem:function(k,v){real.setItem(P+k,String(v))},removeItem:function(k){real.removeItem(P+k)},
    key:function(i){var n=0;for(var j=0;j<real.length;j++){var k=real.key(j);if(k.indexOf(P)===0){if(n===i)return k.slice(P.length);n++}}return null},
    clear:function(){for(var j=real.length-1;j>=0;j--){var k=real.key(j);if(k.indexOf(P)===0)real.removeItem(k)}}};
  Object.defineProperty(shim,'length',{get:function(){var n=0;for(var j=0;j<real.length;j++)if(real.key(j).indexOf(P)===0)n++;return n}});
  try{Object.defineProperty(window,'localStorage',{value:shim,configurable:true})}catch(e){}
  addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.textContent='ทดสอบ · ข้อมูลไม่จริง';
    b.style.cssText='position:fixed;right:calc(70px + env(safe-area-inset-right));top:calc(6px + env(safe-area-inset-top));z-index:99998;font:11px/1.2 sans-serif;background:#2a2238;color:#fff;padding:3px 7px;border-radius:6px;pointer-events:none;opacity:.85';
    document.body.appendChild(b)});
})();
// Loaded synchronously from the HTML head. With ?test=1 it maps Firebase (and our config) to the in-memory
// mocks in verify/mocks via an import map; without the flag it only adds the page's base import map (if any).
// Must run before any module script, so pages include it as a classic <script src> in <head>.
(function(){
  var base=window.HRA_IMPORTS||{},test=true,map={imports:{}};
  for(var k in base)map.imports[k]=base[k];
  if(test){
    var dir=new URL('mocks/',document.currentScript.src).href,root=new URL('../',document.currentScript.src).href;
    map.imports['https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js']=dir+'firebase-app.js';
    map.imports['https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js']=dir+'firebase-database.js';
    map.imports['https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js']=dir+'firebase-auth.js';
    map.imports[root+'firebase-config.js']=dir+'firebase-config.js';
    window.__TEST__=true;
  }
  if(Object.keys(map.imports).length)document.write('<script type="importmap">'+JSON.stringify(map)+'<\/script>');
})();
