// Runs the Prism Foundry solver off the main thread (hint + dead-end check after every move).
// Shortest path when the search is small; otherwise any path (a hint only has to keep the level solvable).
importScripts('prism-core.js?v=2');
const geos = {};
onmessage = e => {
  const { id, lv, def, st } = e.data;
  const geo = geos[lv] || (geos[lv] = PrismCore.load(def).geo);
  let res = PrismCore.solve(geo, st, 12000);
  if (res === 'limit') res = PrismCore.solveAny(geo, st, 600000);
  postMessage({ id, res });
};
