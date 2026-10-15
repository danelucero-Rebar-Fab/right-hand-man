/* Right Hand Man - IndexedDB storage */
'use strict';
const DBN = 'right-hand-man', DBV = 3, STORES = ['clients','projects','sheets','takeoff','payapps','logs','cos','costs','photos','kv','orders','items'];
let _db;
function db() { return _db ||= new Promise((res, rej) => { const r = indexedDB.open(DBN, DBV);
  r.onupgradeneeded = () => { STORES.forEach(s => { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, {keyPath:'id'}); }); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => alert('Close other Right Hand Man tabs to finish the update.'); }); }
async function tx(store, mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s);
  t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage full? The transaction was aborted.')); }); }
const DB = {
  put: (s, v) => tx(s, 'readwrite', o => o.put(v)), del: (s, k) => tx(s, 'readwrite', o => o.delete(k)), get: (s, k) => tx(s, 'readonly', o => o.get(k)),
  all: s => tx(s, 'readonly', o => o.getAll()), clear: s => tx(s, 'readwrite', o => o.clear()),
  async where(s, f) { return (await DB.all(s)).filter(f); },
  async bulk(s, arr) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(s, 'readwrite'), o = t.objectStore(s); arr.forEach(v => o.put(v)); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async kv(k, v) { if (v === undefined) { const r = await DB.get('kv', k); return r ? r.v : undefined; } return DB.put('kv', {id:k, v}); },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
