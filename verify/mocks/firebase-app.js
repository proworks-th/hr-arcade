// Test-mode stand-in for firebase-app (see verify/mocks/firebase-database.js).
const apps=[];
export const initializeApp=(c,name)=>{const a={name};apps.push(a);return a};
export const getApps=()=>apps;
