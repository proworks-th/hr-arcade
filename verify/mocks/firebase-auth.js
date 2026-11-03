// Test-mode stand-in for firebase-auth: the signed-in user lives in localStorage (survives reloads like the real one),
// "Google" is a fake account — window.__mockGoogle = {email} picks which; window.__mockAuthOff = guest sign-in disabled.
const K = 'mock_auth', G = 'mock_google';
const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const save = (k, v) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
let cur = load(K);
const subs = [], emit = () => { save(K, cur); subs.forEach(f => f(cur)); };
const gmail = () => (window.__mockGoogle || { email: 'qa@example.test' }).email;
const err = (code, extra) => Object.assign(new Error(code), { code }, extra);
export const getAuth = () => ({ get currentUser() { return cur; } });
export function onAuthStateChanged(a, cb) { subs.push(cb); setTimeout(() => cb(cur), 0); return () => subs.splice(subs.indexOf(cb), 1); }
export const browserLocalPersistence = 'local', browserSessionPersistence = 'session';
export async function setPersistence() {}
export async function signInAnonymously() {
  if (window.__mockAuthOff) throw err('auth/operation-not-allowed');
  cur = { uid: 'anon-' + Math.random().toString(36).slice(2, 8), isAnonymous: true, email: null }; emit(); return { user: cur };
}
export class GoogleAuthProvider { static credentialFromError(e) { return e.cred || null; } }
export async function linkWithPopup(u) {
  const email = gmail(), map = load(G) || {};
  if (map[email] && map[email] !== u.uid) throw err('auth/credential-already-in-use', { cred: { email } });
  map[email] = u.uid; save(G, map); cur = { ...u, isAnonymous: false, email }; emit(); return { user: cur };
}
function signInAs(email) {
  const map = load(G) || {}, uid = map[email] || ('g-' + Math.random().toString(36).slice(2, 8));
  map[email] = uid; save(G, map); cur = { uid, isAnonymous: false, email }; emit(); return { user: cur };
}
export async function signInWithPopup() { return signInAs(gmail()); }
export async function signInWithCredential(a, c) { return signInAs(c.email); }
export async function signOut() { cur = null; emit(); }
