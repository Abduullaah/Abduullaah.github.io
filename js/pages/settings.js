/* pages/settings.js — owner only: who you are, what guests see, PIN, cloud sync, data. */
import { $, $$, el, esc, icons, toast, modal, confirmDialog, download } from "../ui.js";
import { readConfig, saveDeviceConfig } from "../store.js";
import { toBackup } from "../migrate.js";
import { todayISO } from "../dates.js";

export const id = "settings";
export const title = "Settings";
export const icon = "settings";

let ctx, root, unsub = null;
const VERSION = "1.0.0";

export function render(r, c) {
  ctx = c; root = r;
  unsub?.(); unsub = ctx.store.settings.subscribe(() => paintDynamic());
  const cloud = ctx.store.mode === "cloud";
  root.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><div class="sub">Only you see this page.</div></div></div>
    <div class="settings-grid">
      <nav class="settings-nav" data-snav>
        <a href="#/settings" data-to="profile" class="on">Profile</a>
        <a href="#/settings" data-to="guests">Front of house</a>
        <a href="#/settings" data-to="security">PIN & lock</a>
        <a href="#/settings" data-to="cloud">Cloud sync</a>
        <a href="#/settings" data-to="data">Data</a>
        <a href="#/settings" data-to="appearance">Appearance</a>
        <a href="#/settings" data-to="about">About</a>
      </nav>
      <div>
        <section class="settings-sec" id="s-profile"><h2>Profile</h2><p class="lead">How your name appears on the lock screen, reports and statements.</p>
          <div class="card"><div class="card-b stack gap-16">
            <div class="grid-2"><div class="field"><label for="pName">Name</label><input class="inp" id="pName" data-prof="name"></div><div class="field"><label for="pTitle">Role</label><input class="inp" id="pTitle" data-prof="title" placeholder="Content & Video"></div></div>
            <div class="grid-2"><div class="field"><label for="pCompany">Company</label><input class="inp" id="pCompany" data-prof="company"></div><div class="field"><label for="pWs">Workspace name</label><input class="inp" id="pWs" data-prof="workspaceName" placeholder="Backstage"></div></div>
          </div><div class="card-f row"><button type="button" class="btn primary" data-save-profile>Save profile</button></div></div>
        </section>

        <section class="settings-sec" id="s-guests"><h2>Front of house</h2><p class="lead">Anyone with the link who does not have your PIN is a guest. Choose exactly what they can see. Everything else stays backstage.${cloud ? " In cloud mode this is enforced by the server — hidden pages cannot be fetched at all." : ""}</p>
          <div class="card"><div class="card-b" data-vis></div>
          <div class="card-f row wrap"><button type="button" class="btn" data-preview>${icons.eye}Preview as a guest</button><button type="button" class="btn ghost" data-copy-link>${icons.share}Copy link</button><span class="grow"></span><span class="muted" style="font-size:12.5px" data-vis-summary></span></div></div>
        </section>

        <section class="settings-sec" id="s-security"><h2>PIN & lock</h2><p class="lead">${cloud ? "Your PIN is the password of the owner account in Firebase, so it is checked on the server." : "Your PIN is stored as a salted hash on this device only."}</p>
          <div class="card"><div class="card-b stack gap-16">
            <div class="grid-3">
              <div class="field"><label for="pinCur">Current PIN</label><input class="inp mono" id="pinCur" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12"></div>
              <div class="field"><label for="pinNew">New PIN</label><input class="inp mono" id="pinNew" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="6 digits"></div>
              <div class="field"><label for="pinRep">Repeat</label><input class="inp mono" id="pinRep" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12"></div>
            </div>
            <div class="row"><button type="button" class="btn primary" data-change-pin>Change PIN</button></div>
            <div class="divider" style="margin:4px 0"></div>
            <div class="grid-2">
              <div class="field"><label for="autoLock">Auto-lock after</label><select class="inp" id="autoLock"><option value="0">Never</option><option value="5">5 minutes idle</option><option value="15">15 minutes idle</option><option value="60">1 hour idle</option><option value="240">4 hours idle</option></select><span class="hint">Applies on every device you're unlocked on.</span></div>
              <div class="field"><label>&nbsp;</label><button type="button" class="btn" data-lock-now>${icons.lock}Lock now</button></div>
            </div>
          </div></div>
        </section>

        <section class="settings-sec" id="s-cloud"><h2>Cloud sync</h2><p class="lead">Live on every device, offline-safe, and free: your data lives in your own Google Firebase project (Spark plan — no card, no expiry). Until you connect it, everything stays on this device.</p>
          <div data-cloud></div>
        </section>

        <section class="settings-sec" id="s-data"><h2>Data</h2><p class="lead">Your data is yours. Back it up any time, restore it anywhere, or bring in the two original trackers.</p>
          <div class="card"><div class="card-b stack gap-16">
            <div class="row wrap"><button type="button" class="btn primary" data-backup>${icons.download}Download backup</button><span class="muted" style="font-size:12.5px">One JSON file with work, ledger, rates and these settings.</span></div>
            <div class="dropzone" data-drop>${icons.upload}<div class="mt-8"><b>Restore or import</b> — drop a file here or click to choose.<br><span style="font-size:12px">Accepts a workspace backup, the old <em>Task Ledger</em> backup, or the old <em>Commission Tracker</em> backup.</span></div><input type="file" accept="application/json,.json" data-file hidden></div>
            <div class="row wrap"><label class="check"><input type="radio" name="impmode" value="merge" checked><span>Merge into what's here</span></label><label class="check"><input type="radio" name="impmode" value="replace"><span>Replace everything</span></label></div>
          </div><div class="card-f row wrap"><button type="button" class="btn danger" data-erase>${icons.trash}Erase all work and ledger data</button></div></div>
        </section>

        <section class="settings-sec" id="s-appearance"><h2>Appearance</h2>
          <div class="card"><div class="card-b"><div class="field"><label>Theme</label><div class="seg" data-theme-seg><button type="button" data-th="system">System</button><button type="button" data-th="light">${icons.sun}Light</button><button type="button" data-th="dark">${icons.moon}Dark</button></div><span class="hint">Remembered per device.</span></div></div></div>
        </section>

        <section class="settings-sec" id="s-about"><h2>About</h2>
          <div class="card"><div class="card-b">
            <dl class="kv"><dt>Version</dt><dd class="mono">${VERSION}</dd><dt>Storage</dt><dd><span class="badge-mode ${cloud ? "cloud" : "local"}">${cloud ? "Cloud · Firestore" : "This device"}</span></dd><dt>Shortcuts</dt><dd class="mono" style="font-size:12.5px">Q quick capture · N new · / search · E report · Esc close</dd><dt>Install</dt><dd style="font-size:13.5px">On iPhone: Share → Add to Home Screen. On Android/desktop Chrome: Install app from the address bar. Works offline; syncs when back.</dd></dl>
          </div></div>
        </section>
      </div>
    </div>`;
  wire(); paintDynamic();
}
export function unmount() { unsub?.(); unsub = null; }

function wire() {
  $$("[data-to]", root).forEach(a => a.addEventListener("click", e => { e.preventDefault(); $$("[data-to]", root).forEach(x => x.classList.toggle("on", x === a)); $("#s-" + a.dataset.to, root)?.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  // profile
  const prof = ctx.store.settings.get()?.profile || {};
  $$("[data-prof]", root).forEach(i => i.value = prof[i.dataset.prof] || (i.dataset.prof === "name" ? "Abdullah" : i.dataset.prof === "company" ? "flowork" : ""));
  $("[data-save-profile]", root).addEventListener("click", () => {
    const p = {}; $$("[data-prof]", root).forEach(i => p[i.dataset.prof] = i.value.trim());
    ctx.store.settings.set({ profile: { ...(ctx.store.settings.get()?.profile || {}), ...p } }); toast("Profile saved");
  });
  // guests
  $("[data-preview]", root).addEventListener("click", () => { ctx.auth.setPreview(true); ctx.navigate("home"); ctx.render(); });
  $("[data-copy-link]", root).addEventListener("click", async () => { const u = location.origin + location.pathname; try { await navigator.clipboard.writeText(u); toast("Link copied"); } catch { toast(u); } });
  // security
  $("[data-change-pin]", root).addEventListener("click", async () => {
    const cur = $("#pinCur", root).value, nw = $("#pinNew", root).value, rp = $("#pinRep", root).value;
    if (!/^\d{6,}$/.test(nw)) return toast("New PIN must be at least 6 digits", { error: true });
    if (nw !== rp) return toast("The two new PINs don't match", { error: true });
    const r = await ctx.auth.changePin(cur, nw);
    if (r.ok) { toast("PIN changed"); ["#pinCur", "#pinNew", "#pinRep"].forEach(s => $(s, root).value = ""); } else toast(r.error, { error: true });
  });
  $("#autoLock", root).value = String(ctx.store.settings.get()?.security?.autoLockMin || 0);
  $("#autoLock", root).addEventListener("change", e => { ctx.store.settings.set({ security: { ...(ctx.store.settings.get()?.security || {}), autoLockMin: Number(e.target.value) } }); toast("Auto-lock updated"); });
  $("[data-lock-now]", root).addEventListener("click", async () => { await ctx.auth.lock(); ctx.render(); });
  // data
  $("[data-backup]", root).addEventListener("click", async () => { const d = await ctx.store.exportAll(); download(`flowork-workspace-backup-${todayISO()}.json`, JSON.stringify(d, null, 2)); toast("Backup downloaded"); });
  const drop = $("[data-drop]", root), file = $("[data-file]", root);
  drop.addEventListener("click", () => file.click());
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) importFile(f); });
  file.addEventListener("change", e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ""; });
  $("[data-erase]", root).addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Erase all work and ledger data?", text: "This removes every task, production, sale and the rate catalog" + (ctx.store.mode === "cloud" ? " from the cloud, on every device." : " from this device.") + " Settings and your PIN stay. Download a backup first if you might want any of it back.", ok: "Erase everything", danger: true });
    if (!ok) return;
    ctx.store.collection("tasks").replaceAll([]); ctx.store.collection("commission").replaceAll([]); ctx.store.doc("commission").replace({});
    toast("Erased");
  });
  // appearance
  const th = ctx.store.pref("theme", "system");
  $$("[data-th]", root).forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.th === th)); b.addEventListener("click", () => { ctx.store.setPref("theme", b.dataset.th); $$("[data-th]", root).forEach(x => x.setAttribute("aria-pressed", String(x === b))); document.dispatchEvent(new Event("fw:theme")); }); });
}

async function importFile(f) {
  try {
    const raw = JSON.parse(await f.text());
    const backup = toBackup(raw);
    const mode = $('input[name="impmode"]:checked', root).value;
    const nT = (backup.collections?.tasks || []).length, nC = (backup.collections?.commission || []).length;
    const ok = await confirmDialog({ title: mode === "replace" ? "Replace everything with this file?" : "Import this file?", text: `${f.name}: ${nT} work item${nT === 1 ? "" : "s"}, ${nC} sale${nC === 1 ? "" : "s"}${backup.docs?.commission ? ", rate catalog" : ""}${Object.keys(backup.settings || {}).length ? ", settings" : ""}. ${mode === "replace" ? "Existing items are removed first." : "Existing items with the same id are updated, everything else is kept."}`, ok: mode === "replace" ? "Replace" : "Import" });
    if (!ok) return;
    await ctx.store.importAll(backup, { merge: mode !== "replace" });
    toast(`Imported ${nT + nC} item${nT + nC === 1 ? "" : "s"}`);
  } catch (e) { console.error(e); toast("That file isn't a backup this workspace understands", { error: true }); }
}

/* sections that depend on live settings */
function paintDynamic() {
  if (!root?.isConnected) return;
  const vis = ctx.auth.vis();
  const sw = (key, label, sub = "") => `<label class="switch"><input type="checkbox" data-vis="${key}" ${vis[key] ? "checked" : ""}><span class="track"></span><span class="lbl">${label}${sub ? `<small>${sub}</small>` : ""}</span></label>`;
  const rowV = (key, t, s, subs = "") => `<div><div class="vis-row"><div><div class="t">${t}</div><div class="s">${s}</div></div>${sw(key, "")}</div>${subs && vis[key] ? `<div class="vis-sub">${subs}</div>` : ""}</div>`;
  $("[data-vis]", root).innerHTML =
    rowV("home", "Today", "The call sheet, this week, and year figures for whatever else is shared.") +
    rowV("tasks", "Work", "Tasks and productions, week by week.", sw("tasksPeople", "Show who gave each task", "Names of colleagues in Given by") + sw("tasksNotes", "Show notes", "Blockers and comments")) +
    rowV("commission", "Ledger", "Sales and commission. Off by default — this is your money.", sw("commissionAmounts", "Show amounts", "Off: guests only see counts and statuses") + sw("commissionClients", "Show client names", "Off: clients appear as “Client”")) +
    rowV("people", "People", "Colleagues and clients with their open work.");
  $$("[data-vis]", root).forEach(i => i.addEventListener("change", () => { ctx.store.settings.set({ visibility: { ...ctx.auth.vis(), [i.dataset.vis]: i.checked } }); }));
  const on = ["home", "tasks", "commission", "people"].filter(k => vis[k]);
  $("[data-vis-summary]", root).textContent = on.length ? `Guests see: ${on.map(k => ({ home: "Today", tasks: "Work", commission: "Ledger", people: "People" })[k]).join(", ")}` : "Guests see nothing — the link only shows the PIN screen.";
  paintCloud();
}

function paintCloud() {
  const wrap = $("[data-cloud]", root); if (!wrap) return;
  const cfg = readConfig(), cloud = ctx.store.mode === "cloud";
  const email = cfg.ownerEmail || "you@example.com";
  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isOwner() { return request.auth != null && request.auth.token.email == '${email}'; }
    function isPublic(m) { return get(/databases/$(db)/documents/public/settings).data.visibility[m] == true; }
    match /public/{doc}            { allow read: if true;                  allow write: if isOwner(); }
    match /modules/{m}             { allow read: if isOwner() || isPublic(m); allow write: if isOwner(); }
    match /modules/{m}/items/{id}  { allow read: if isOwner() || isPublic(m); allow write: if isOwner(); }
  }
}`;
  if (cloud) {
    wrap.innerHTML = `<div class="card"><div class="card-b stack gap-16">
      <div class="row wrap"><span class="badge-mode cloud">Connected</span><span class="muted" style="font-size:13px">Project <b class="mono">${esc(cfg.firebase.projectId)}</b> · owner <b>${esc(cfg.ownerEmail)}</b> · config from ${cfg.source === "device" ? "this device" : "config.js"}</span></div>
      <details><summary style="cursor:pointer;font-weight:500;font-size:13.5px">Firestore security rules (paste in Firebase → Firestore → Rules if you change the owner email)</summary><pre class="code mt-8">${esc(rules)}</pre><button type="button" class="btn sm mt-8" data-copy-rules>${icons.copy}Copy rules</button></details>
      </div>${cfg.source === "device" ? `<div class="card-f row wrap"><button type="button" class="btn danger" data-disconnect>Disconnect on this device</button><span class="muted" style="font-size:12.5px">Goes back to device-only storage here. Nothing in the cloud is deleted.</span></div>` : ""}</div>`;
    $("[data-copy-rules]", wrap)?.addEventListener("click", () => navigator.clipboard.writeText(rules).then(() => toast("Rules copied")));
    $("[data-disconnect]", wrap)?.addEventListener("click", async () => { if (await confirmDialog({ title: "Disconnect cloud on this device?", text: "This device returns to local storage. Your cloud data stays where it is.", ok: "Disconnect", danger: true })) { saveDeviceConfig(null); ctx.store.setPref("cloudMigrated", null); location.reload(); } });
    return;
  }
  wrap.innerHTML = `<div class="card"><div class="card-b stack gap-16">
    <div class="row wrap"><span class="badge-mode local">This device only</span><span class="muted" style="font-size:13px">Connect once, and every device you unlock stays in sync.</span></div>
    <ol class="steps">
      <li><p>Go to <b>console.firebase.google.com</b> → <b>Add project</b> (any name, e.g. <b>flowork-backstage</b>; analytics off).</p></li>
      <li><p><b>Build → Firestore Database → Create database</b> → production mode → pick a region → Create.</p></li>
      <li><p><b>Build → Authentication → Get started → Email/Password → Enable</b>. Then <b>Users → Add user</b>: your email and, as the password, <b>your 6-digit PIN</b>.</p></li>
      <li><p><b>Project settings (gear) → Your apps → Web (&lt;/&gt;)</b> → register (no hosting) → copy the <b>firebaseConfig</b> object and paste it below with your email.</p></li>
      <li><p>Back in <b>Firestore → Rules</b>, replace everything with the rules that appear after you connect, and <b>Publish</b>.</p></li>
    </ol>
    <div class="field"><label for="fbCfg">firebaseConfig</label><textarea class="inp mono" id="fbCfg" style="min-height:120px;font-size:12px" placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "...", "storageBucket": "...", "messagingSenderId": "...", "appId": "..." }'></textarea><span class="hint">Paste the whole object — <code>const firebaseConfig = {…}</code> is fine too.</span></div>
    <div class="field"><label for="fbEmail">Owner email (the Firebase user you created)</label><input class="inp" id="fbEmail" type="email" placeholder="you@flowork.ae" value="${esc(cfg.ownerEmail || "")}"></div>
    <div class="row wrap"><button type="button" class="btn primary" data-connect>${icons.cloud}Connect cloud</button><span class="muted" style="font-size:12.5px">The data on this device is copied up the first time you unlock.</span></div>
    <details><summary style="cursor:pointer;font-weight:500;font-size:13.5px">Firestore security rules — paste after connecting</summary><pre class="code mt-8">${esc(rules)}</pre></details>
    </div></div>`;
  $("[data-connect]", wrap).addEventListener("click", () => {
    let txt = $("#fbCfg", wrap).value.trim(), em = $("#fbEmail", wrap).value.trim();
    if (!em) return toast("Add the owner email", { error: true });
    try {
      txt = txt.replace(/^[\s\S]*?firebaseConfig\s*=\s*/, "").replace(/;\s*$/, "");
      const obj = Function('"use strict";return (' + txt + ")")();
      if (!obj.apiKey || !obj.projectId || !obj.appId) throw new Error("missing fields");
      saveDeviceConfig({ firebase: { apiKey: obj.apiKey, authDomain: obj.authDomain, projectId: obj.projectId, storageBucket: obj.storageBucket, messagingSenderId: obj.messagingSenderId, appId: obj.appId }, ownerEmail: em });
      toast("Connecting…"); setTimeout(() => location.reload(), 400);
    } catch (e) { toast("That doesn't look like a firebaseConfig object", { error: true }); }
  });
}
