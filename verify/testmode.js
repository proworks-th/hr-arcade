// Loaded synchronously from the HTML head. With ?test=1 it maps Firebase (and our config) to the in-memory
// mocks in verify/mocks via an import map; without the flag it only adds the page's base import map (if any).
// Must run before any module script, so pages include it as a classic <script src> in <head>.
(function(){
  var base=window.HRA_IMPORTS||{},test=/[?&]test=1\b/.test(location.search),map={imports:{}};
  for(var k in base)map.imports[k]=base[k];
  if(test){
    var dir=new URL('mocks/',document.currentScript.src).href,root=new URL('../',document.currentScript.src).href;
    map.imports['https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js']=dir+'firebase-app.js';
    map.imports['https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js']=dir+'firebase-database.js';
    map.imports[root+'firebase-config.js']=dir+'firebase-config.js';
    window.__TEST__=true;
  }
  if(Object.keys(map.imports).length)document.write('<script type="importmap">'+JSON.stringify(map)+'<\/script>');
})();
