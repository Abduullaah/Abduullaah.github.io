/* store.js — one data layer, two backends.
   local  : localStorage (this device only; instant)
   cloud  : Firebase Firestore (live sync on every device, offline-capable)
   Pages only ever talk to store.collection(name) / store.doc(name) / store.settings.
*/
import { uid, nowISO, toast } from "./ui.js";

const NS = "fw.ws.v1";
const FB_VERSION = "12.17.1";
const CDN = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;

/* ---------- config ---------- */
export function readConfig() {
  const base = (typeof window !== "undefined" && window.FLOWORK_CONFIG) || {};
  let override = null;
  try { override = JSON.parse(localStorage.getItem(`${NS}:cloud-config`) || "null"); } catch {}
  const firebase = override?.firebase || base.firebase || null;
  const ownerEmail = override?.ownerEmail || base.ownerEmail || "";
  const valid = firebase && firebase.apiKey && firebase.projectId && firebase.appId;
  return { firebase: valid ? firebase : null, ownerEmail, source: override?.firebase ? "device" : (base.firebase ? "file" : "none"), workspace: base.workspace || {} };
}
export function saveDeviceConfig(cfg) {
  if (!cfg) localStorage.removeItem(`${NS}:cloud-config`);
  else localStorage.setItem(`${NS}:cloud-config`, JSON.stringify(cfg));
}

/* ---------- tiny event emitter ---------- */
function emitter() {
  const subs = new Set();
  return { subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }, emit(v) { subs.forEach(fn => { try { fn(v); } catch (e) { console.error(e); } }); }, size: () => subs.size };
}

/* ---------- LOCAL adapter ---------- */
const lsKey = (kind, name) => `${NS}:${kind}:${name}`;
function lsGet(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function localCollection(name, onChange) {
  const key = lsKey("col", name);
  let items = lsGet(key, []);
  const ev = emitter();
  const persist = () => { lsSet(key, items); ev.emit(items); onChange?.(); };
  return {
    name, ready: Promise.resolve(), denied: false,
    all: () => items.slice(),
    get: id => items.find(x => x.id === id) || null,
    upsert(item) { const i = items.findIndex(x => x.id === item.id); if (i >= 0) items[i] = item; else items.push(item); persist(); },
    upsertMany(list) { list.forEach(item => { const i = items.findIndex(x => x.id === item.id); if (i >= 0) items[i] = item; else items.push(item); }); persist(); },
    remove(id) { items = items.filter(x => x.id !== id); persist(); },
    replaceAll(list) { items = list.slice(); persist(); },
    subscribe: ev.subscribe,
    _reload() { items = lsGet(key, []); ev.emit(items); },
  };
}
function localDoc(name, onChange, kind = "doc") {
  const key = lsKey(kind, name);
  let data = lsGet(key, {});
  const ev = emitter();
  const persist = () => { lsSet(key, data); ev.emit(data); onChange?.(); };
  return {
    name, ready: Promise.resolve(), denied: false,
    get: () => data,
    set(patch) { data = { ...data, ...patch }; persist(); },
    replace(obj) { data = { ...obj }; persist(); },
    subscribe: ev.subscribe,
    _reload() { data = lsGet(key, {}); ev.emit(data); },
  };
}

/* ---------- CLOUD adapter (Firestore) ---------- */
async function loadFirebase(cfg) {
  const [app, fs, auth] = await Promise.all([
    import(CDN + "firebase-app.js"),
    import(CDN + "firebase-firestore.js"),
    import(CDN + "firebase-auth.js"),
  ]);
  const fbApp = app.initializeApp(cfg);
  let db;
  try {
    db = fs.initializeFirestore(fbApp, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (e) { db = fs.getFirestore(fbApp); }
  const fbAuth = auth.getAuth(fbApp);
  return { app: fbApp, db, auth: fbAuth, fs, authMod: auth };
}

function cloudCollection(fb, name, setStatus) {
  const { fs, db } = fb;
  const ref = fs.collection(db, "modules", name, "items");
  let items = [], denied = false, unsub = null, resolveReady, retry = 0, retryTimer = null;
  const ready = new Promise(r => resolveReady = r);
  const ev = emitter();
  const start = () => {
    clearTimeout(retryTimer);
    unsub?.();
    unsub = fs.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
      denied = false; retry = 0;
      items = snap.docs.map(d => d.data());
      ev.emit(items);
      setStatus(snap.metadata.hasPendingWrites ? "saving" : "synced");
      resolveReady();
    }, err => {
      denied = err.code === "permission-denied";
      if (!denied) { console.warn("[store]", name, err); setStatus("error"); }
      // a listener opened a moment before sign-in lands is denied once — take the hint and retry
      if (denied && fb.auth.currentUser && retry < 5) { retry++; retryTimer = setTimeout(start, 400 * retry); }
      items = []; ev.emit(items); resolveReady();
    });
  };
  start();
  const write = p => { setStatus("saving"); return p.then(() => true).catch(e => { console.error("[store] write failed", name, e); setStatus("error"); toast(e.code === "permission-denied" ? "Not saved — unlock with your PIN first" : "Not saved — check your connection", { error: true }); return false; }); };
  const CHUNK = 400;   // Firestore allows 500 operations per batch
  const commitChunks = async ops => {
    for (let i = 0; i < ops.length; i += CHUNK) {
      const batch = fs.writeBatch(db);
      ops.slice(i, i + CHUNK).forEach(op => op(batch));
      const ok = await write(batch.commit());
      if (!ok) return false;
    }
    return true;
  };
  return {
    name, ready, get denied() { return denied; },
    all: () => items.slice(),
    get: id => items.find(x => x.id === id) || null,
    upsert(item) { const i = items.findIndex(x => x.id === item.id); if (i >= 0) items[i] = item; else items.push(item); ev.emit(items); return write(fs.setDoc(fs.doc(ref, item.id), strip(item))); },
    upsertMany(list) {
      list.forEach(item => { const i = items.findIndex(x => x.id === item.id); if (i >= 0) items[i] = item; else items.push(item); });
      ev.emit(items);
      return commitChunks(list.map(item => b => b.set(fs.doc(ref, item.id), strip(item))));
    },
    remove(id) { items = items.filter(x => x.id !== id); ev.emit(items); return write(fs.deleteDoc(fs.doc(ref, id))); },
    replaceAll(list) {
      const ops = [...items.map(x => b => b.delete(fs.doc(ref, x.id))), ...list.map(x => b => b.set(fs.doc(ref, x.id), strip(x)))];
      items = list.slice(); ev.emit(items);
      return commitChunks(ops);
    },
    subscribe: ev.subscribe,
    restart: start,
  };
}
function cloudDoc(fb, path, setStatus) {
  const { fs, db } = fb;
  const ref = fs.doc(db, ...path);
  let data = {}, denied = false, unsub = null, resolveReady, retry = 0, retryTimer = null;
  const ready = new Promise(r => resolveReady = r);
  const ev = emitter();
  const start = () => {
    clearTimeout(retryTimer);
    unsub?.();
    unsub = fs.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
      denied = false; retry = 0; data = snap.exists() ? snap.data() : {};
      ev.emit(data); setStatus(snap.metadata.hasPendingWrites ? "saving" : "synced"); resolveReady();
    }, err => {
      denied = err.code === "permission-denied";
      if (!denied) { console.warn("[store]", path.join("/"), err); setStatus("error"); }
      if (denied && fb.auth.currentUser && retry < 5) { retry++; retryTimer = setTimeout(start, 400 * retry); }
      data = {}; ev.emit(data); resolveReady();
    });
  };
  start();
  const write = p => { setStatus("saving"); return p.then(() => true).catch(e => { console.error("[store] write failed", path.join("/"), e); setStatus("error"); toast(e.code === "permission-denied" ? "Not saved — unlock with your PIN first" : "Not saved — check your connection", { error: true }); return false; }); };
  return {
    name: path.join("/"), ready, get denied() { return denied; },
    get: () => data,
    set(patch) { data = { ...data, ...patch }; ev.emit(data); return write(fs.setDoc(ref, strip(patch), { merge: true })); },
    replace(obj) { data = { ...obj }; ev.emit(data); return write(fs.setDoc(ref, strip(obj))); },
    subscribe: ev.subscribe,
    restart: start,
  };
}
/* Firestore rejects undefined values */
function strip(o) { return JSON.parse(JSON.stringify(o)); }

/* ---------- the store ---------- */
class Store {
  constructor() {
    this.mode = "local";
    this.status = "local";
    this.fb = null;
    this.config = readConfig();
    this._cols = new Map();
    this._docs = new Map();
    this._statusEv = emitter();
    this._changeEv = emitter();
    this.settings = null;
    this.ready = null;
    this.error = null;
  }
  onStatus(fn) { return this._statusEv.subscribe(fn); }
  onChange(fn) { return this._changeEv.subscribe(fn); }
  _setStatus(s) {
    if (this.mode === "local") s = "local";
    if (this.status !== s) { this.status = s; this._statusEv.emit(s); }
  }
  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (this.config.firebase) {
        try {
          this.fb = await loadFirebase(this.config.firebase);
          this.mode = "cloud";
          this.status = navigator.onLine ? "synced" : "offline";
          window.addEventListener("online", () => this._setStatus("synced"));
          window.addEventListener("offline", () => this._setStatus("offline"));
        } catch (e) {
          console.error("[store] Firebase failed to load — falling back to local", e);
          this.error = e; this.mode = "local";
        }
      }
      if (this.mode === "local") {
        window.addEventListener("storage", e => {
          if (!e.key || !e.key.startsWith(NS + ":")) return;
          const [, kind, ...rest] = e.key.split(":"); const name = rest.join(":");
          if (kind === "col") this._cols.get(name)?._reload();
          if (kind === "doc") this._docs.get(name)?._reload();
          if (kind === "settings") this.settings?._reload();
          this._changeEv.emit();
        });
      }
      this.settings = this.mode === "cloud"
        ? cloudDoc(this.fb, ["public", "settings"], s => this._setStatus(s))
        : localDoc("settings", () => this._changeEv.emit(), "settings");
      // never hang the app on a slow / unreachable backend — the listener keeps trying in the background
      const timedOut = await Promise.race([this.settings.ready.then(() => false), new Promise(r => setTimeout(() => r(true), 3500))]);
      if (timedOut) this._setStatus(navigator.onLine ? "error" : "offline");
    })();
    return this.ready;
  }
  collection(name) {
    if (!this._cols.has(name)) {
      const c = this.mode === "cloud" ? cloudCollection(this.fb, name, s => this._setStatus(s)) : localCollection(name, () => this._changeEv.emit());
      c.subscribe(() => this._changeEv.emit());
      this._cols.set(name, c);
    }
    return this._cols.get(name);
  }
  doc(name) {
    if (!this._docs.has(name)) {
      const d = this.mode === "cloud" ? cloudDoc(this.fb, ["modules", name], s => this._setStatus(s)) : localDoc(name, () => this._changeEv.emit());
      d.subscribe(() => this._changeEv.emit());
      this._docs.set(name, d);
    }
    return this._docs.get(name);
  }
  /* after sign-in / sign-out, permission-denied listeners must be re-created */
  resubscribe() {
    if (this.mode !== "cloud") return;
    const run = () => { this._cols.forEach(c => c.restart()); this._docs.forEach(d => d.restart()); this.settings?.restart?.(); };
    run();
    setTimeout(run, 700);   // the auth token can land a beat after sign-in
  }
  /* ---------- device prefs (never synced) ---------- */
  pref(key, fb = null) { return lsGet(`${NS}:pref:${key}`, fb); }
  setPref(key, v) { if (v === null || v === undefined) localStorage.removeItem(`${NS}:pref:${key}`); else lsSet(`${NS}:pref:${key}`, v); }

  /* ---------- backup / restore ---------- */
  async exportAll(names = { collections: ["tasks", "commission"], docs: ["commission", "tasks"] }) {
    const out = { app: "flowork-workspace", version: 1, exportedAt: nowISO(), settings: this.settings?.get() || {}, docs: {}, collections: {} };
    for (const n of names.docs) { const d = this.doc(n); await d.ready; out.docs[n] = d.get(); }
    for (const n of names.collections) { const c = this.collection(n); await c.ready; out.collections[n] = c.all(); }
    return out;
  }
  async importAll(data, { merge = true } = {}) {
    if (!data || data.app !== "flowork-workspace") throw new Error("Not a workspace backup");
    const results = [];
    if (data.settings && Object.keys(data.settings).length) results.push(await this.settings.set(data.settings));
    for (const [n, v] of Object.entries(data.docs || {})) { const d = this.doc(n); await d.ready; results.push(await (merge ? d.set(v) : d.replace(v))); }
    for (const [n, list] of Object.entries(data.collections || {})) {
      const c = this.collection(n); await c.ready;
      results.push(await (merge ? c.upsertMany(list) : c.replaceAll(list)));
    }
    return results.every(r => r !== false);   // local adapter returns undefined = fine
  }
  /* copy everything held locally into the cloud (first connection) */
  async localSnapshot() {
    const names = ["tasks", "commission"];
    const out = { app: "flowork-workspace", version: 1, exportedAt: nowISO(), settings: lsGet(lsKey("settings", "settings"), {}), docs: {}, collections: {} };
    names.forEach(n => { out.docs[n] = lsGet(lsKey("doc", n), {}); out.collections[n] = lsGet(lsKey("col", n), []); });
    return out;
  }
  localHasData() { return ["tasks", "commission"].some(n => (lsGet(lsKey("col", n), []) || []).length > 0); }
  wipeLocalData() {
    Object.keys(localStorage).filter(k => k.startsWith(NS + ":col:") || k.startsWith(NS + ":doc:") || k.startsWith(NS + ":settings:")).forEach(k => localStorage.removeItem(k));
  }
}

export const store = new Store();
export { uid, nowISO };
