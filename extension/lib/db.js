// Tiny IndexedDB wrapper. Everything stays inside the extension on this computer.
const DB_NAME = 'wa-reader';
const STORE = 'messages';
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const s = db.createObjectStore(STORE, { keyPath: 'id' });
      s.createIndex('t', 't');
      s.createIndex('chatId', 'chatId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error); };
  });
  return dbp;
}

const done = (tx) => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

/** Insert messages; returns only the ones that were new. */
export async function putMessages(msgs) {
  if (!msgs?.length) return [];
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  const st = tx.objectStore(STORE);
  const fresh = [];
  await Promise.all(msgs.map((m) => new Promise((res) => {
    const g = st.getKey(m.id);
    g.onsuccess = () => {
      if (g.result === undefined) fresh.push(m);
      st.put({ ...m, storedAt: Date.now() }); // put also refreshes names/edits
      res();
    };
    g.onerror = () => res();
  })));
  await done(tx);
  return fresh;
}

/** Messages with fromMs <= t*1000 < toMs, oldest first. */
export async function getRange(fromMs, toMs) {
  const db = await open();
  const tx = db.transaction(STORE, 'readonly');
  const idx = tx.objectStore(STORE).index('t');
  const range = IDBKeyRange.bound(Math.floor(fromMs / 1000), Math.ceil(toMs / 1000), false, true);
  return new Promise((res, rej) => {
    const r = idx.getAll(range);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function count() {
  const db = await open();
  return new Promise((res) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).count();
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(0);
  });
}

export async function pruneOlderThan(ms) {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  const idx = tx.objectStore(STORE).index('t');
  const range = IDBKeyRange.upperBound(Math.floor(ms / 1000), true);
  let removed = 0;
  idx.openCursor(range).onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) { cur.delete(); removed++; cur.continue(); }
  };
  await done(tx);
  return removed;
}

export async function clearAll() {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
  await done(tx);
}
