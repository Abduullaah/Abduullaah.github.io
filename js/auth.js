/* auth.js — the front door.
   Owner unlocks with a PIN. Guests may view whatever the owner has chosen to share.
   local mode : PIN is hashed on this device.
   cloud mode : PIN is the Firebase password of the owner account, so the rules
                on the server enforce who can read and write what.
*/
import { store } from "./store.js";

const PIN_LEN = 6;
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(auth.state); } catch (e) { console.error(e); } });

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
const randomSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, "0")).join("");

const AUTH_ERRORS = {
  "auth/invalid-credential": "That PIN isn't right.",
  "auth/wrong-password": "That PIN isn't right.",
  "auth/user-not-found": "No owner account found for that email in Firebase.",
  "auth/invalid-email": "The owner email in the cloud settings isn't valid.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "You're offline. Reconnect and try again.",
  "auth/operation-not-allowed": "Email/password sign-in isn't enabled in Firebase yet.",
  "auth/user-disabled": "The owner account is disabled in Firebase.",
  "auth/weak-password": "PIN must be at least 6 digits.",
  "auth/requires-recent-login": "Lock and unlock again, then change the PIN.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "The Firebase config on this device isn't valid — check Settings → Cloud sync.",
  "auth/invalid-api-key": "The Firebase config on this device isn't valid — check Settings → Cloud sync.",
};
const friendly = e => AUTH_ERRORS[e?.code] || (e?.code ? `Firebase: ${e.code.replace("auth/", "").replace(/[-.]+/g, " ").trim()}` : (e?.message || "Couldn't unlock."));

export const auth = {
  PIN_LEN,
  state: "locked",          // locked | owner | guest
  preview: false,           // owner previewing as guest
  _idleTimer: null,
  _user: null,

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get isOwner() { return this.state === "owner" && !this.preview; },
  get isGuest() { return this.state === "guest" || (this.state === "owner" && this.preview); },
  get mode() { return store.mode; },
  get ownerEmail() { return store.config.ownerEmail || ""; },

  async init() {
    if (store.mode === "cloud") {
      const { auth: fa, authMod } = store.fb;
      await new Promise(resolve => {
        let first = true;
        authMod.onAuthStateChanged(fa, user => {
          this._user = user;
          const owner = !!user && (!this.ownerEmail || (user.email || "").toLowerCase() === this.ownerEmail.toLowerCase());
          if (owner) this.state = "owner";
          else if (this.state === "owner") this.state = "locked";
          if (!owner && sessionStorage.getItem("fw.guest") === "1") this.state = "guest";
          if (!first) store.resubscribe();
          first = false;
          emit(); resolve();
        });
      });
    } else {
      const keep = store.pref("keepUnlocked", false);
      if (this.hasPin() && (keep || sessionStorage.getItem("fw.unlocked") === "1")) this.state = "owner";
      else if (sessionStorage.getItem("fw.guest") === "1") this.state = "guest";
    }
    this._wireIdle();
    return this.state;
  },

  /* local mode only: is a PIN configured on this device? */
  hasPin() { return store.mode === "cloud" ? true : !!store.pref("pin"); },

  async setupPin(pin) {
    if (store.mode === "cloud") throw new Error("In cloud mode the PIN is managed by Firebase.");
    if (!/^\d{6,}$/.test(pin)) throw new Error("PIN must be at least 6 digits.");
    const salt = randomSalt();
    store.setPref("pin", { salt, hash: await sha256(salt + pin) });
    return true;
  },

  async unlock(pin, keep = true) {
    if (store.mode === "cloud") {
      const { auth: fa, authMod } = store.fb;
      if (!this.ownerEmail) return { ok: false, error: "Add the owner email in Settings → Cloud first." };
      try {
        await authMod.setPersistence(fa, keep ? authMod.browserLocalPersistence : authMod.browserSessionPersistence);
        await authMod.signInWithEmailAndPassword(fa, this.ownerEmail, pin);
        try { await fa.authStateReady?.(); } catch {}
        sessionStorage.removeItem("fw.guest");
        this.preview = false; this.state = "owner"; emit(); store.resubscribe();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: friendly(e) };
      }
    }
    const rec = store.pref("pin");
    if (!rec) return { ok: false, error: "No PIN set yet." };
    const ok = (await sha256(rec.salt + pin)) === rec.hash;
    if (!ok) return { ok: false, error: "That PIN isn't right." };
    store.setPref("keepUnlocked", !!keep);
    sessionStorage.setItem("fw.unlocked", "1"); sessionStorage.removeItem("fw.guest");
    this.preview = false; this.state = "owner"; emit();
    return { ok: true };
  },

  async lock() {
    if (store.mode === "cloud") { try { await store.fb.authMod.signOut(store.fb.auth); } catch {} }
    store.setPref("keepUnlocked", null);
    sessionStorage.removeItem("fw.unlocked"); sessionStorage.removeItem("fw.guest");
    this.preview = false; this.state = "locked"; emit();
    if (store.mode === "cloud") store.resubscribe();
  },

  enterGuest() {
    sessionStorage.setItem("fw.guest", "1");
    if (this.state !== "owner") this.state = "guest";
    emit();
  },
  leaveGuest() { sessionStorage.removeItem("fw.guest"); if (this.state === "guest") this.state = "locked"; emit(); },

  setPreview(on) { if (this.state !== "owner") return; this.preview = !!on; emit(); },

  async changePin(current, next) {
    if (!/^\d{6,}$/.test(next)) return { ok: false, error: "New PIN must be at least 6 digits." };
    if (store.mode === "cloud") {
      const { auth: fa, authMod } = store.fb;
      try {
        const user = fa.currentUser; if (!user) return { ok: false, error: "Unlock first." };
        const cred = authMod.EmailAuthProvider.credential(user.email, current);
        await authMod.reauthenticateWithCredential(user, cred);
        await authMod.updatePassword(user, next);
        return { ok: true };
      } catch (e) { return { ok: false, error: friendly(e) }; }
    }
    const rec = store.pref("pin");
    if (rec && (await sha256(rec.salt + current)) !== rec.hash) return { ok: false, error: "Current PIN isn't right." };
    await this.setupPin(next);
    return { ok: true };
  },

  /* ---------- visibility (what guests can see) ---------- */
  DEFAULT_VIS: { home: true, tasks: true, commission: false, tasksNotes: true, tasksPeople: true, commissionClients: false, commissionAmounts: true },
  vis() { return { ...this.DEFAULT_VIS, ...(store.settings?.get()?.visibility || {}) }; },
  /* can the current viewer see a page? */
  canSee(pageId) {
    if (this.isOwner) return true;
    if (pageId === "settings") return false;
    return !!this.vis()[pageId];
  },
  /* field-level masks for guests */
  mask(key) { return this.isGuest && this.vis()[key] === false; },
  anyPublicPage() { const v = this.vis(); return ["home", "tasks", "commission"].some(p => v[p]); },

  /* ---------- auto-lock ---------- */
  _wireIdle() {
    const reset = () => {
      clearTimeout(this._idleTimer);
      const mins = Number(store.settings?.get()?.security?.autoLockMin || 0);
      if (!mins || this.state !== "owner") return;
      this._idleTimer = setTimeout(() => { if (this.state === "owner") this.lock(); }, mins * 60000);
    };
    ["mousemove", "keydown", "pointerdown", "touchstart", "scroll", "visibilitychange"].forEach(ev => document.addEventListener(ev, reset, { passive: true }));
    store.settings?.subscribe?.(reset);
    this.onChange(reset);
    reset();
  },
};
