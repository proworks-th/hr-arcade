// Season Pass art: room decorations drawn as pixel rows (one letter = one pixel, '.' = empty).
// Shared by the game (office.js) and the sprite tool (sprite-lab.html). Edit in sprite-lab.html, paste back here.
// LimeZu-matched colours: outline k/K, floor shadow z, light from the top-left.
// name → [Thai name, kind f=floor w=wall, rows]
const SX_PAL = { k: '#3a3a50', K: '#46465e', z: '#a79796', G: '#455c5b', g: '#4e6e61', h: '#568d61', l: '#61af5f', L: '#a4dc77', R: '#9e2b2d', r: '#d93232', f: '#fc5c46', o: '#ed931e', y: '#f2b22b', Y: '#f8d239', u: '#fff59a', w: '#f8f8f8', W: '#c9d3e6', p: '#f49ac1', P: '#d9608f', q: '#ffd6e6', B: '#6b4c2c', b: '#a9764f', c: '#53aedb' };
const SX = {
  sx_krathong: ['🪷 กระทง', 'f', ['.......uu.......', '......kyok......', '......kwWk......', '...kk.kwWk.kk...', '..kqpk.kWk.kpPk.', '.kqppPkkkkkpPPk.', 'kLkqpPpqpPpPPkgk', 'kLlkkpPpPpPPkhgk', '.kLllkkkkkkkhhgk', '.klLlhlhlhlhhgk.', '..kghghghghgGk..', '...kkkkkkkkkk...', '...zzzzzzzzzz...']],
  sx_lantern: ['🏮 โคมยี่เป็ง', 'w', ['....kk....', '....kK....', '..kkkkkk..', '.kYuuuYok.', 'koYuuuuYok', 'koYuuuuYok', 'koyYuuYyok', 'koyYuuYyok', 'kooyYYyoRk', '.kooooooRk', '..kkkkkk..', '...kuok...', '....yo....', '....o.....']],
  sx_snowman: ['⛄ ตุ๊กตาหิมะ', 'f', ['....kkkk....', '....kKKk....', '....kKKk....', '...kkrrkk...', '..kkkkkkkk..', '...kwwwWk...', '..kwkwwkWk..', '..kwwwooWk..', '..krrrrrRk..', '.kwwfRwwwWk.', 'kwwwwkwwwWWk', 'kwwwwwwwwWWk', 'kwwwwkwwwWWk', 'kWwwwwwwWWWk', '.kWWWWWWWWk.', '..kkkkkkkk..', '.zzzzzzzzzz.']],
  sx_xtree: ['🎄 ต้นคริสต์มาส', 'f', ['.......u.......', '......kYk......', '.....kYuYk.....', '......kYk......', '......klk......', '.....kLlhk.....', '....kLlhhgk....', '...kLlhrhhgk...', '...kGGgGgGGk...', '.....kLlhk.....', '....kLlhhhgk...', '...kLlhhhyhgk..', '..kLchhhhhhgk..', '..kGGgGgGgGGk..', '....kLlhhgk....', '...kLlhhhhhgk..', '..kLlyhhhhrhgk.', '.kLlhhhhchhhggk', '.kGGgGgGgGgGGGk', '..kkkkkkkkkkkk.', '......kBk......', '....kkkkkkk....', '....kfrrrRk....', '....krrrrRk....', '.....kRRRk.....', '....zzzzzzz....']],
};
