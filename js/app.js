/* app.js — shell, router, lock screen. Pages register themselves in PAGES. */
import { $, $$, el, esc, icons, toast, modal, confirmDialog, closeMenus } from "./ui.js";
import { store } from "./store.js";
import { auth } from "./auth.js";
import { relTime } from "./dates.js";
import * as home from "./pages/home.js";
import * as tasks from "./pages/tasks.js";
import * as commission from "./pages/commission.js";
import * as people from "./pages/people.js";
import * as settings from "./pages/settings.js";

/* ---------- page registry (add a page: import it and list it here) ---------- */
export const PAGES = [home, tasks, commission, people, settings];

const app = $("#app");
let current = null;   // { page, root }
let shellBuilt = false;

/* ---------- theme ---------- */
const mq = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const pref = store.pref("theme", "system");
  const dark = pref === "dark" || (pref === "system" && mq.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $$("[data-theme-toggle]").forEach(b => { b.innerHTML = dark ? icons.sun : icons.moon; b.title = dark ? "Switch to light" : "Switch to dark"; });
  $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#111412" : "#F4F4EF");
}
mq.addEventListener?.("change", applyTheme);
document.addEventListener("fw:theme", applyTheme);
function toggleTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  store.setPref("theme", dark ? "light" : "dark");
  applyTheme();
}

/* ---------- profile helpers ---------- */
export function profile() {
  const p = store.settings?.get()?.profile || {};
  return { name: p.name || "Abdullah", title: p.title || "Content & Video", company: p.company || "flowork", workspaceName: p.workspaceName || "Backstage", tagline: p.tagline || "" };
}

/* ---------- routing ---------- */
function routeId() { const h = location.hash.replace(/^#\/?/, "").split("?")[0]; return h || "home"; }
export function navigate(id) { if (routeId() === id) render(); else location.hash = "/" + id; }
window.addEventListener("hashchange", () => render());

function visiblePages() { return PAGES.filter(p => auth.canSee(p.id)); }

/* ---------- shell ---------- */
function buildShell() {
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="word">flowork<i>.</i></span></div>
        <div class="brand-sub" data-ws-name></div>
        <nav class="nav" data-nav aria-label="Pages"></nav>
        <button type="button" class="btn block" data-quick style="margin-top:14px;justify-content:flex-start;gap:10px;color:var(--ink-2)" hidden>${icons.spark}<span>Quick capture</span><span class="mono muted" style="margin-left:auto;font-size:10.5px">Q</span></button>
        <div class="sidebar-foot">
          <div class="sync" data-sync><span class="dot"></span><span class="txt">…</span></div>
          <div class="foot-row">
            <button type="button" class="icon-btn" data-theme-toggle aria-label="Toggle theme"></button>
            <button type="button" class="icon-btn" data-lock-btn aria-label="Lock" title="Lock">${icons.lock}</button>
            <span class="grow"></span>
            <button type="button" class="icon-btn" data-go="settings" aria-label="Settings" title="Settings">${icons.settings}</button>
          </div>
        </div>
      </aside>
      <div class="main">
        <div class="topbar">
          <div class="brand"><span class="word">flowork<i>.</i></span></div>
          <div class="row gap-4">
            <span class="sync" data-sync style="padding:6px 8px"><span class="dot"></span><span class="txt hide-mobile"></span></span>
            <button type="button" class="icon-btn" data-theme-toggle aria-label="Toggle theme"></button>
            <button type="button" class="icon-btn" data-lock-btn aria-label="Lock">${icons.lock}</button>
          </div>
        </div>
        <div data-guest-bar></div>
        <div data-page-root></div>
      </div>
      <nav class="tabbar" data-tabbar aria-label="Pages"></nav>
    </div>`;
  $$("[data-theme-toggle]", app).forEach(b => b.addEventListener("click", toggleTheme));
  $$("[data-lock-btn]", app).forEach(b => b.addEventListener("click", onLockClick));
  $("[data-go=settings]", app).addEventListener("click", () => navigate("settings"));
  $("[data-quick]", app).addEventListener("click", () => tasks.quickCapture());
  shellBuilt = true;
  applyTheme();
}

async function onLockClick() {
  if (auth.state === "owner") { await auth.lock(); toast("Locked"); render(); }
  else { auth.leaveGuest(); render(); }
}

function renderNav() {
  const pages = visiblePages().filter(p => p.id !== "settings");
  const cur = routeId();
  const link = p => `<a href="#/${p.id}" ${cur === p.id ? 'aria-current="page"' : ""}>${icons[p.icon] || ""}<span>${esc(p.title)}</span>${(auth.isOwner && !auth.vis()[p.id]) ? `<span class="lock-mini" title="Private — only you can see this">${icons.lock}</span>` : ""}</a>`;
  $("[data-nav]", app).innerHTML = pages.map(link).join("") + (auth.isOwner ? `<div class="nav-label eyebrow">Owner</div><a href="#/settings" ${cur === "settings" ? 'aria-current="page"' : ""}>${icons.settings}<span>Settings</span></a>` : "");
  $("[data-tabbar]", app).innerHTML = pages.map(link).join("") + (auth.isOwner ? `<a href="#/settings" ${cur === "settings" ? 'aria-current="page"' : ""}>${icons.settings}<span>Settings</span></a>` : "");
  $("[data-ws-name]", app).textContent = profile().workspaceName;
  $$("[data-lock-btn]", app).forEach(b => {
    b.innerHTML = auth.state === "owner" ? icons.lock : icons.back;
    b.title = auth.state === "owner" ? "Lock workspace" : "Back to PIN";
    b.setAttribute("aria-label", b.title);
  });
  $("[data-go=settings]", app).hidden = !auth.isOwner;
  $("[data-quick]", app).hidden = !auth.isOwner;
}

function renderGuestBar() {
  const root = $("[data-guest-bar]", app);
  if (auth.state === "owner" && auth.preview) {
    root.innerHTML = `<div class="guest-bar">${icons.eye}<span>Previewing as a <b>guest</b> — this is exactly what visitors see.</span><span class="grow"></span><button type="button" class="btn sm" data-exit-preview>Exit preview</button></div>`;
    $("[data-exit-preview]", root).addEventListener("click", () => { auth.setPreview(false); render(); });
  } else if (auth.state === "guest") {
    root.innerHTML = `<div class="guest-bar">${icons.eye}<span>Viewing <b>${esc(profile().name)}'s</b> shared workspace as a guest.</span><span class="grow"></span><button type="button" class="btn sm" data-unlock>${icons.unlock}Unlock</button></div>`;
    $("[data-unlock]", root).addEventListener("click", () => { auth.leaveGuest(); render(); });
  } else root.innerHTML = "";
}

let lastSynced = null;
function renderSync() {
  const s = store.status;
  if (s === "synced") lastSynced = Date.now();
  const label = {
    local: "On this device only",
    synced: "Synced" + (lastSynced ? " · " + relTime(new Date(lastSynced).toISOString()) : ""),
    saving: "Saving…",
    offline: "Offline · will sync",
    error: "Sync problem",
  }[s] || s;
  $$("[data-sync]", app).forEach(n => { n.dataset.state = s; $(".txt", n).textContent = label; n.title = store.mode === "cloud" ? `Cloud sync (${store.config.firebase?.projectId || ""})` : "Cloud sync is not connected. Set it up in Settings → Cloud."; });
}
setInterval(() => { if (shellBuilt && store.status === "synced") renderSync(); }, 30000);

/* ---------- main render ---------- */
export function render() {
  closeMenus();
  if (auth.state === "locked") { renderLock(); return; }
  if (!shellBuilt || !$(".shell", app)) buildShell();
  let id = routeId();
  const allowed = visiblePages();
  if (!allowed.some(p => p.id === id)) {
    if (!allowed.length) { renderNothingShared(); return; }
    id = allowed[0].id; history.replaceState(null, "", "#/" + id);
  }
  renderNav(); renderGuestBar(); renderSync();
  const page = PAGES.find(p => p.id === id);
  const root = $("[data-page-root]", app);
  if (current?.page !== page || !current.root?.isConnected) {
    current?.page?.unmount?.();
    root.innerHTML = "";
    const pr = el('<div class="page"></div>');
    root.appendChild(pr);
    current = { page, root: pr };
    page.render(pr, ctx());
    window.scrollTo({ top: 0 });
  } else {
    page.update?.(current.root, ctx());
  }
  document.title = `${page.title} — ${profile().workspaceName}`;
}
const ctx = () => ({ store, auth, navigate, profile, render });
document.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || auth.state !== "owner" || auth.preview) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || $(".scrim")) return;
  if (e.key === "q" || e.key === "Q") { e.preventDefault(); tasks.quickCapture(); }
  if (e.key === "g") { window._g = Date.now(); return; }
  if (window._g && Date.now() - window._g < 800) { const map = { t: "home", w: "tasks", l: "commission", p: "people", s: "settings" }; if (map[e.key]) { e.preventDefault(); navigate(map[e.key]); } window._g = 0; }
});

function renderNothingShared() {
  app.innerHTML = `<div class="lock"><div class="lock-card">
    <div class="word">flowork<i>.</i></div>
    <div class="who">${esc(profile().workspaceName)}</div>
    <p class="msg" style="margin-top:34px">Nothing is shared with guests right now.</p>
    <div class="links"><button type="button" data-back>${icons.back} Back</button></div>
  </div></div>`;
  $("[data-back]", app).addEventListener("click", () => { auth.leaveGuest(); render(); });
  shellBuilt = false;
}

/* ---------- lock screen ---------- */
function renderLock() {
  shellBuilt = false; current = null;
  const p = profile();
  const needsSetup = store.mode === "local" && !auth.hasPin();
  const modeNote = store.mode === "cloud" ? "Cloud · synced" : "This device";
  app.innerHTML = `<div class="lock"><div class="lock-card">
    <div class="word">flowork<i>.</i></div>
    <div class="who">${esc(p.workspaceName)}</div>
    <div class="prompt" data-prompt>${needsSetup ? "Create your PIN" : "Enter PIN"}</div>
    <div class="pin-dots" data-dots aria-hidden="true">${"<i></i>".repeat(auth.PIN_LEN)}</div>
    <div class="pad" data-pad>
      ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join("")}
      <button type="button" class="fn" data-k="clear" aria-label="Clear">Clear</button>
      <button type="button" data-k="0">0</button>
      <button type="button" class="fn" data-k="back" aria-label="Delete">${icons.back}</button>
    </div>
    <div class="msg" data-msg aria-live="polite"></div>
    ${needsSetup ? "" : `<label class="switch keep"><input type="checkbox" data-keep ${store.pref("keepUnlocked", true) !== false ? "checked" : ""}><span class="track"></span><span class="lbl">Keep me unlocked on this device</span></label>`}
    <div class="links">
      ${!needsSetup && auth.anyPublicPage() ? `<button type="button" data-guest>Continue as a guest ${icons.arrowUpRight}</button>` : ""}
      ${!needsSetup ? `<button type="button" data-forgot class="muted" style="font-weight:400">Forgot your PIN?</button>` : ""}
    </div>
    <div class="foot">${modeNote}${store.mode === "cloud" && store.config.source === "device" ? ` · <button type="button" data-cloud-off style="font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;text-decoration:underline;text-underline-offset:2px">use this device without cloud</button>` : ""}${store.status === "error" && store.mode === "cloud" ? `<div style="margin-top:8px;color:var(--bad)">Can't reach the cloud project — check the config or your connection.</div>` : ""}</div>
  </div></div>`;
  applyTheme();
  $("[data-cloud-off]", app)?.addEventListener("click", async () => {
    const { saveDeviceConfig } = await import("./store.js");
    if (await confirmDialog({ title: "Use this device without cloud?", text: "Removes the cloud connection stored on this device. Nothing in the cloud is deleted; you can reconnect from Settings later.", ok: "Disconnect" })) { saveDeviceConfig(null); location.reload(); }
  });

  const dots = $("[data-dots]", app), msg = $("[data-msg]", app), prompt = $("[data-prompt]", app);
  let buf = "", firstPin = null, busy = false;
  const paint = () => $$("i", dots).forEach((d, i) => d.classList.toggle("on", i < buf.length));
  const fail = text => { dots.classList.add("err"); msg.textContent = text; msg.classList.add("bad"); setTimeout(() => { dots.classList.remove("err"); buf = ""; paint(); }, 450); };
  const say = (text, bad = false) => { msg.textContent = text; msg.classList.toggle("bad", bad); };

  async function submit() {
    if (busy) return; busy = true;
    if (needsSetup) {
      if (!firstPin) { firstPin = buf; buf = ""; paint(); prompt.textContent = "Repeat your PIN"; say("Once more, to be sure."); busy = false; return; }
      if (firstPin !== buf) { firstPin = null; prompt.textContent = "Create your PIN"; fail("Those didn't match. Start again."); busy = false; return; }
      await auth.setupPin(buf);
      dots.classList.add("ok");
      await auth.unlock(buf, true);
      toast("PIN set. Welcome in.");
      setTimeout(render, 220); return;
    }
    const keep = $("[data-keep]", app)?.checked ?? true;
    say("Checking…");
    const r = await auth.unlock(buf, keep);
    if (r.ok) { dots.classList.add("ok"); say(""); setTimeout(render, 220); }
    else { fail(r.error); busy = false; }
  }
  function key(k) {
    if (busy) return;
    if (k === "clear") { buf = ""; paint(); say(""); return; }
    if (k === "back") { buf = buf.slice(0, -1); paint(); return; }
    if (buf.length >= auth.PIN_LEN) return;
    buf += k; paint();
    if (buf.length === auth.PIN_LEN) setTimeout(submit, 120);
  }
  $("[data-pad]", app).addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) key(b.dataset.k); });
  const onKey = e => {
    if (!$("[data-pad]", app)) { document.removeEventListener("keydown", onKey); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^\d$/.test(e.key)) key(e.key);
    else if (e.key === "Backspace") key("back");
    else if (e.key === "Escape") key("clear");
    else if (e.key === "Enter" && buf.length === auth.PIN_LEN) submit();
  };
  document.addEventListener("keydown", onKey);
  $("[data-guest]", app)?.addEventListener("click", () => { auth.enterGuest(); render(); });
  $("[data-forgot]", app)?.addEventListener("click", forgotPin);
}

async function forgotPin() {
  if (store.mode === "cloud") {
    modal({ title: "Reset your PIN", size: "narrow", body: `<p class="ink2">Your PIN is the password of the owner account in Firebase.</p>
      <ol class="steps mt-16"><li><p>Open the <b>Firebase console</b> → your project → <b>Authentication</b> → <b>Users</b>.</p></li>
      <li><p>Find <b>${esc(auth.ownerEmail || "the owner account")}</b> → menu <b>⋮</b> → <b>Reset password</b>, or delete the user and add it again with a new PIN as the password.</p></li>
      <li><p>Come back here and enter the new PIN.</p></li></ol>` });
    return;
  }
  const ok = await confirmDialog({ title: "Reset PIN and this device's data?", text: "In device mode there is no way to recover a lost PIN. Resetting removes the PIN and every entry stored on this device. If you have a backup file you can restore it afterwards.", ok: "Reset everything", danger: true });
  if (!ok) return;
  store.wipeLocalData(); store.setPref("pin", null); store.setPref("keepUnlocked", null); store.setPref("seeded", null);
  toast("Reset. Create a new PIN.");
  render();
}

/* ---------- first-run data ---------- */
async function firstRun() {
  if (store.mode === "local") {
    if (store.pref("seeded") || store.localHasData()) return;
    try {
      const mod = await import("./seed.js");
      if (mod?.SEED) { await store.importAll(mod.SEED, { merge: true }); store.setPref("seeded", true); }
    } catch (e) { /* no seed shipped — start empty */ }
  }
}
/* when the owner first unlocks a cloud workspace and this device still holds local data, move it up */
async function migrateLocalToCloud() {
  if (store.mode !== "cloud" || auth.state !== "owner") return;
  if (store.pref("cloudMigrated") || !store.localHasData()) return;
  const t = store.collection("tasks"), c = store.collection("commission");
  const ok = await Promise.race([Promise.all([t.ready, c.ready]).then(() => true), new Promise(r => setTimeout(() => r(false), 8000))]);
  if (!ok || t.denied || c.denied) return;
  if (t.all().length || c.all().length) { store.setPref("cloudMigrated", true); return; } // cloud already has data — keep it
  const snap = await store.localSnapshot();
  await store.importAll(snap, { merge: true });
  store.setPref("cloudMigrated", true);
  toast("Moved this device's data to the cloud");
}

/* ---------- boot ---------- */
(async function boot() {
  applyTheme();
  await store.init();
  await firstRun();
  await auth.init();
  PAGES.forEach(p => p.attach?.(ctx()));
  store.onStatus(() => { if (shellBuilt) renderSync(); });
  store.settings.subscribe(() => { if (shellBuilt) { renderNav(); renderGuestBar(); document.title = `${current?.page?.title || ""} — ${profile().workspaceName}`; } });
  auth.onChange(() => migrateLocalToCloud());
  migrateLocalToCloud();
  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
