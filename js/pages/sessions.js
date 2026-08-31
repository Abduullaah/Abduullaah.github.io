/* pages/sessions.js — Sessions: every podcast shoot logged, and the sheet you export from it. */
import { $, $$, el, esc, icons, uid, nowISO, num, fmtMoney, toast, modal, confirmDialog, menu, printHTML, download, debounce } from "../ui.js";
import { todayISO, dmy, dayShort, monthLabel, ym, rangeFor, parse, today, iso, monday, weekLabel, weekShort, weekNo, addDays, relTime, DAY, MON } from "../dates.js";

export const id = "sessions";
export const title = "Sessions";
export const icon = "mic";

export const DEFAULT_CFG = {
  locations: ["Dubai Hills", "Business Bay", "On location"],
  hours: [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8],
  defaults: { location: "Dubai Hills", hours: 2, editing: true },
};

let ctx, root, col, cfgDoc, intDoc, unsubs = [];
let pushTimer = null;
let filters = { period: "thisMonth", location: "", editing: "", q: "" };

/* ---------- helpers (exported for Home) ---------- */
export function cfg() {
  const saved = cfgDoc?.get() || {};
  const c = { ...DEFAULT_CFG, ...saved };
  if (!Array.isArray(c.locations) || !c.locations.length) c.locations = DEFAULT_CFG.locations.slice();
  if (!Array.isArray(c.hours) || !c.hours.length) c.hours = DEFAULT_CFG.hours.slice();
  c.defaults = { ...DEFAULT_CFG.defaults, ...(saved.defaults || {}) };
  return c;
}
export const hrs = h => `${fmtMoney(h, 2)}h`;
export function totals(list) {
  return {
    count: list.length,
    hours: list.reduce((a, s) => a + num(s.hours), 0),
    edited: list.filter(s => s.editing).length,
    clients: new Set(list.map(s => s.client).filter(Boolean)).size,
  };
}
export function newSession(over = {}) {
  const d = cfg().defaults;
  return { id: uid(), date: todayISO(), client: "", hours: num(d.hours), location: d.location, editing: !!d.editing, notes: "", createdAt: nowISO(), updatedAt: nowISO(), ...over };
}
export const clients = () => Array.from(new Set(col.all().map(s => s.client).filter(Boolean))).sort();

/* ---------- lifecycle ---------- */
export function attach(c) {
  ctx = c; col = ctx.store.collection("sessions"); cfgDoc = ctx.store.doc("sessions"); intDoc = ctx.store.doc("integrations");
  if (!attach._wired) { attach._wired = true; col.subscribe(() => queueSheetPush()); }
}
export function render(r, c) {
  attach(c); root = r;
  unsubs.forEach(u => u()); unsubs = [col.subscribe(paint), cfgDoc.subscribe(paint), intDoc.subscribe(paintSub)];
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Sessions</h1><div class="sub" data-sub></div></div>
      <div class="actions" data-actions></div>
    </div>
    <div class="figs" data-figs></div>
    <div class="toolbar" style="margin-top:22px">
      <div class="seg" role="group" aria-label="Period">
        ${[["thisWeek", "This week", "Week"], ["thisMonth", "This month", "Month"], ["lastMonth", "Last month", "Last"], ["thisYear", "This year", "Year"], ["all", "All", "All"]].map(([k, l, sm]) => `<button type="button" data-period="${k}"><span class="hide-mobile">${l}</span><span class="only-mobile">${sm}</span></button>`).join("")}
      </div>
      <select class="inp" data-floc style="width:auto;min-width:130px" aria-label="Filter by location"></select>
      <select class="inp" data-fedit style="width:auto;min-width:118px" aria-label="Filter by editing">
        <option value="">Editing: any</option><option value="yes">With editing</option><option value="no">No editing</option>
      </select>
      <div class="search">${icons.search}<input class="inp" type="search" placeholder="Search client or note…" data-q autocomplete="off"></div>
      <span class="grow"></span>
      <button type="button" class="btn ghost" data-export>${icons.download}Export</button>
    </div>
    <div class="card" data-table></div>`;
  wire(); paint();
}
export function unmount() { unsubs.forEach(u => u()); unsubs = []; document.removeEventListener("keydown", onKey); }
function onKey(e) {
  if (!root?.isConnected || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || $(".scrim")) return;
  if ((e.key === "n" || e.key === "N") && ctx.auth.isOwner) { e.preventDefault(); openEditor(null); }
  if (e.key === "/") { e.preventDefault(); $("[data-q]", root).focus(); }
}
function wire() {
  $$("[data-period]", root).forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.period === filters.period)); b.addEventListener("click", () => { filters.period = b.dataset.period; $$("[data-period]", root).forEach(x => x.setAttribute("aria-pressed", String(x === b))); paint(); }); });
  $("[data-floc]", root).addEventListener("change", e => { filters.location = e.target.value; paint(); });
  $("[data-fedit]", root).addEventListener("change", e => { filters.editing = e.target.value; paint(); });
  const q = $("[data-q]", root); q.value = filters.q; q.addEventListener("input", debounce(() => { filters.q = q.value.trim().toLowerCase(); paint(); }, 120));
  $("[data-export]", root).addEventListener("click", openExport);
  $("[data-table]", root).addEventListener("click", onTableClick);
  document.addEventListener("keydown", onKey);
}

/* ---------- data ---------- */
const all = () => col.all().slice().sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));
const usedLocations = () => Array.from(new Set([...cfg().locations, ...col.all().map(s => s.location).filter(Boolean)]));
function filtered() {
  const [from, to] = filters.period === "all" ? ["", ""] : rangeFor(filters.period);
  return all().filter(s => {
    if (from && (s.date || "") < from) return false;
    if (to && (s.date || "") > to) return false;
    if (filters.location && s.location !== filters.location) return false;
    if (filters.editing === "yes" && !s.editing) return false;
    if (filters.editing === "no" && s.editing) return false;
    if (filters.q && !`${s.client} ${s.location} ${s.notes || ""}`.toLowerCase().includes(filters.q)) return false;
    return true;
  });
}
const periodLabel = () => ({ thisWeek: "this week", thisMonth: "this month", lastMonth: "last month", thisYear: "this year", all: "all time" }[filters.period] || "");
/* week periods read better grouped by week; everything else by month */
const byWeek = () => filters.period === "thisWeek";
const groupKey = s => byWeek() ? iso(monday(parse(s.date || todayISO()))) : ym(s.date);
const groupLabel = k => byWeek() ? weekLabel(k) : monthLabel(k);

/* ---------- paint ---------- */
function paint() {
  if (!root?.isConnected) return;
  const owner = ctx.auth.isOwner;
  const hideCli = ctx.auth.mask("sessionsClients");
  const list = filtered(), t = totals(list);
  const everything = totals(all());

  paintSub();
  $("[data-actions]", root).innerHTML = owner ? `<button type="button" class="btn" data-opts>${icons.settings}<span class="hide-mobile">Options</span></button><button type="button" class="btn primary" data-new>${icons.plus}Log a session</button>` : "";
  $("[data-new]", root)?.addEventListener("click", () => openEditor(null));
  $("[data-opts]", root)?.addEventListener("click", openOptions);

  // location filter options (keeps the current choice, adds anything that has been used)
  const sel = $("[data-floc]", root);
  sel.innerHTML = `<option value="">Location: all</option>` + usedLocations().map(l => `<option value="${esc(l)}" ${l === filters.location ? "selected" : ""}>${esc(l)}</option>`).join("");
  $("[data-fedit]", root).value = filters.editing;

  const fig = (k, v, cls = "") => `<div class="fig ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  $("[data-figs]", root).innerHTML =
    fig(`Sessions · ${periodLabel()}`, t.count, "lead") +
    fig("Hours", `${fmtMoney(t.hours, 2)}<small>h</small>`) +
    fig("With editing", t.edited);

  const tb = $("[data-table]", root);
  if (!list.length) {
    tb.innerHTML = `<div class="tbl-empty">${everything.count ? "No sessions in this view." : (owner ? `No sessions logged yet. <button type="button" class="btn primary sm" data-new-empty style="margin-left:8px">${icons.plus}Log a session</button>` : "No sessions logged yet.")}</div>`;
    return;
  }
  const cols = 6 + (owner ? 1 : 0);
  const groups = new Map();
  list.forEach(s => { const k = groupKey(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
  let i = 0, rows = "";
  Array.from(groups.keys()).sort().forEach(k => {
    const gs = groups.get(k), g = totals(gs);
    rows += `<tr class="group"><td colspan="${cols}">${esc(groupLabel(k))} · ${g.count} session${g.count === 1 ? "" : "s"} · ${hrs(g.hours)}</td></tr>`;
    gs.forEach(s => {
      i++;
      const ed = owner
        ? `<button type="button" class="pill ${s.editing ? "sage" : "neutral"}" data-toggle-edit title="Click to switch"><i></i>${s.editing ? "Yes" : "No"}</button>`
        : `<span class="pill ${s.editing ? "sage" : "neutral"}"><i></i>${s.editing ? "Yes" : "No"}</span>`;
      rows += `<tr data-id="${s.id}" class="${owner ? "clickable" : ""}">
        <td class="dim num hide-mobile" style="text-align:left;width:36px">${i}</td>
        <td class="date">${esc(dayShort(s.date))}</td>
        <td><div class="desc-lines"><div class="l"><b>${hideCli ? "Client" : esc(s.client || "—")}</b></div>
          <div class="l sub only-mobile">${esc(s.location || "—")} · ${hrs(s.hours)} · ${s.editing ? "editing" : "no editing"}</div>${s.notes ? `<div class="l sub muted" style="font-size:12.5px">${esc(s.notes)}</div>` : ""}</div></td>
        <td class="nw hide-mobile">${esc(s.location || "—")}</td>
        <td class="num hide-mobile">${hrs(s.hours)}</td>
        <td class="hide-mobile">${ed}</td>
        ${owner ? `<td class="r" style="width:1%"><div class="acts"><button type="button" class="icon-btn sm" data-edit title="Edit">${icons.edit}</button><button type="button" class="icon-btn sm" data-more title="More">${icons.more}</button></div></td>` : ""}
      </tr>`;
    });
  });
  tb.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th class="hide-mobile" style="width:36px">#</th><th>Date</th><th>Client</th><th class="hide-mobile">Location</th><th class="num hide-mobile">Hours</th><th class="hide-mobile">Editing</th>${owner ? "<th></th>" : ""}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="subtotal"><td colspan="4" class="eyebrow" style="padding:12px 14px">Total<span class="only-mobile" style="text-transform:none;letter-spacing:0"> · ${hrs(t.hours)}</span></td><td class="num strong hide-mobile">${hrs(t.hours)}</td><td class="hide-mobile"></td>${owner ? "<td></td>" : ""}</tr></tfoot>
  </table></div>`;
}

/* just the one line under the title — never the whole table */
function paintSub() {
  const n = root?.isConnected ? $("[data-sub]", root) : null;
  if (!n) return;
  const sh = sheet();
  n.className = "sub row";
  n.innerHTML = sh.url
    ? `${icons.sheet}<span>Google Sheet ${sh.lastError ? `<span style="color:var(--bad)">— ${esc(sh.lastError)}</span>` : (sh.lastPushAt ? `up to date · sent ${esc(relTime(sh.lastPushAt))}` : "connected")}</span>${sh.viewUrl ? ` · <a href="${esc(sh.viewUrl)}" target="_blank" rel="noopener">Open the sheet ${icons.arrowUpRight}</a>` : ""}`
    : "Podcast shoots — client, hours, location and editing.";
}

function onTableClick(e) {
  if (e.target.closest("[data-new-empty]")) { openEditor(null); return; }
  const tr = e.target.closest("tr[data-id]"); if (!tr) return;
  const s = col.get(tr.dataset.id); if (!s || !ctx.auth.isOwner) return;
  if (e.target.closest("[data-toggle-edit]")) { col.upsert({ ...s, editing: !s.editing, updatedAt: nowISO() }); return; }
  if (e.target.closest("[data-more]")) { openMenu(e.target.closest("[data-more]"), s); return; }
  if (e.target.closest("[data-edit]") || !e.target.closest("button")) openEditor(s.id);
}
function openMenu(anchor, s) {
  menu(anchor, [
    { label: "Edit session", icon: "edit", onClick: () => openEditor(s.id) },
    { label: "Duplicate", icon: "copy", onClick: () => { col.upsert({ ...s, id: uid(), date: todayISO(), createdAt: nowISO(), updatedAt: nowISO() }); toast("Duplicated"); } },
    "-",
    { label: "Delete", icon: "trash", danger: true, onClick: () => del(s) },
  ]);
}
function del(s) {
  const keep = s; col.remove(s.id);
  toast(`Deleted session for ${s.client || "client"}`, { action: "Undo", onAction: () => col.upsert(keep) });
}

/* ---------- session editor ---------- */
export function openEditor(idOrNull, presets = {}) {
  if (!ctx.auth.isOwner) return;
  const existing = idOrNull ? col.get(idOrNull) : null;
  const s = existing ? { ...existing } : newSession(presets);
  const c = cfg();
  const hourOpts = Array.from(new Set([...c.hours.map(num), num(s.hours)].filter(h => h > 0))).sort((a, b) => a - b);
  const locOpts = Array.from(new Set([...c.locations, s.location].filter(Boolean)));
  const body = el(`<div class="stack gap-16">
    <div class="grid-2">
      <div class="field"><label for="zDate">Date of shoot</label><input class="inp" type="date" id="zDate" value="${esc(s.date)}"></div>
      <div class="field"><label for="zClient">Client</label><input class="inp" id="zClient" list="fw-session-clients" value="${esc(s.client)}" placeholder="Who the session is for" autocomplete="off" autofocus><datalist id="fw-session-clients">${clients().map(x => `<option value="${esc(x)}">`).join("")}</datalist></div>
    </div>
    <div class="grid-3">
      <div class="field"><label for="zHours">Hours</label><select class="inp" id="zHours">${hourOpts.map(h => `<option value="${h}" ${num(s.hours) === h ? "selected" : ""}>${fmtMoney(h, 2)} ${h === 1 ? "hour" : "hours"}</option>`).join("")}</select></div>
      <div class="field"><label for="zLoc">Location</label><select class="inp" id="zLoc">${locOpts.map(l => `<option ${l === s.location ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="field"><label for="zEdit">Editing services</label><select class="inp" id="zEdit"><option value="yes" ${s.editing ? "selected" : ""}>Yes</option><option value="no" ${s.editing ? "" : "selected"}>No</option></select></div>
    </div>
    <div class="field"><label for="zNotes">Notes</label><input class="inp" id="zNotes" value="${esc(s.notes || "")}" placeholder="Guest, episode, anything useful"></div>
    <p class="hint">Locations and the hours list live in <b>Options</b>.</p>
  </div>`);
  const foot = el(`<div class="row" style="width:100%">
    <button type="button" class="btn primary" data-save>${existing ? "Save changes" : "Log session"}</button>
    <button type="button" class="btn ghost" data-cancel>Cancel</button><span class="grow"></span>
    ${existing ? `<button type="button" class="btn danger" data-delete>Delete</button>` : ""}</div>`);
  const m = modal({ title: existing ? "Edit session" : "Log a session", body, footer: foot });

  function save() {
    s.date = $("#zDate", body).value || todayISO();
    s.client = $("#zClient", body).value.trim();
    s.hours = num($("#zHours", body).value);
    s.location = $("#zLoc", body).value;
    s.editing = $("#zEdit", body).value === "yes";
    s.notes = $("#zNotes", body).value.trim();
    if (!s.client) { toast("Add the client name", { error: true }); $("#zClient", body).focus(); return; }
    s.updatedAt = nowISO();
    col.upsert(s); m.close(); toast(existing ? "Saved" : "Session logged");
  }
  $("[data-save]", foot).addEventListener("click", save);
  $("[data-cancel]", foot).addEventListener("click", () => m.close());
  $("[data-delete]", foot)?.addEventListener("click", () => { m.close(); del(existing); });
  body.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.tagName === "INPUT" && ev.target.type !== "number") { ev.preventDefault(); save(); } });
}

/* ---------- options: locations, hours, defaults ---------- */
function openOptions() {
  const c = JSON.parse(JSON.stringify(cfg()));
  const sh0 = sheet();
  const usedLoc = name => col.all().filter(s => s.location === name).length;
  const body = el(`<div class="stack gap-16">
    <div class="field"><label>Locations</label><p class="hint" style="margin:-2px 0 6px">These are the choices in the Location dropdown.</p><div data-list="locations"></div><button type="button" class="btn sm mt-8" data-add-loc>${icons.plus}Add location</button></div>
    <div class="field"><label for="oHours">Hours choices</label><input class="inp mono" id="oHours" value="${esc(c.hours.join(", "))}" placeholder="1, 1.5, 2, 3, 4"><span class="hint">Comma separated. These fill the Hours dropdown.</span></div>
    <div class="divider" style="margin:2px 0"></div>
    <div class="field"><label>Defaults for a new session</label>
      <div class="grid-3 mt-8">
        <div class="field"><label for="oDefHours">Hours</label><input class="inp mono" id="oDefHours" type="number" step="0.5" min="0" value="${esc(c.defaults.hours)}"></div>
        <div class="field"><label for="oDefLoc">Location</label><select class="inp" id="oDefLoc"></select></div>
        <div class="field"><label for="oDefEdit">Editing</label><select class="inp" id="oDefEdit"><option value="yes" ${c.defaults.editing ? "selected" : ""}>Yes</option><option value="no" ${c.defaults.editing ? "" : "selected"}>No</option></select></div>
      </div>
    </div>
    <p class="hint">Renaming a location leaves past sessions exactly as they were logged.</p>
    <div class="divider" style="margin:2px 0"></div>
    <div class="field"><label>Google Sheet</label>
      <p class="hint" style="margin:-2px 0 8px">Every session you log is written into a Google Sheet, so your manager only needs the sheet link — nothing to send, nothing to export by hand.</p>
      <div class="row wrap mb-8"><span class="badge-mode ${sh0.url ? "cloud" : "local"}">${sh0.url ? (sh0.lastPushAt ? `Connected · sent ${esc(relTime(sh0.lastPushAt))}` : "Connected") : "Not connected"}</span>${sh0.lastError ? `<span class="muted" style="font-size:12.5px;color:var(--bad)">${esc(sh0.lastError)}</span>` : ""}</div>
      <div class="field mb-8"><label for="oSheetUrl">Web app link (ends in /exec)</label><input class="inp mono" id="oSheetUrl" value="${esc(sh0.url || "")}" placeholder="https://script.google.com/macros/s/…/exec" style="font-size:12px"></div>
      <div class="field"><label for="oSheetView">Sheet link — the one you give your manager (optional)</label><input class="inp mono" id="oSheetView" value="${esc(sh0.viewUrl || "")}" placeholder="https://docs.google.com/spreadsheets/d/…" style="font-size:12px"></div>
      <div class="row wrap mt-8"><button type="button" class="btn sm" data-sheet-send>${icons.refresh}Save and send everything now</button></div>
      <details class="mt-8"><summary style="cursor:pointer;font-weight:500;font-size:13.5px">How to set it up — five minutes, once</summary>
        <ol class="steps mt-8">
          <li><p>In Google Drive create a <b>new spreadsheet</b> and name it, e.g. <b>flowork podcast sessions</b>.</p></li>
          <li><p>In it: <b>Extensions → Apps Script</b>. Delete whatever is in the editor, paste the script below, and press <b>Save</b>.</p></li>
          <li><p><b>Deploy → New deployment → Web app</b>. Execute as <b>Me</b>, Who has access <b>Anyone</b> → <b>Deploy</b> → allow the permissions it asks for → copy the <b>Web app URL</b>.</p></li>
          <li><p>Paste that URL above and press <b>Save and send everything now</b>. The sheet fills in.</p></li>
          <li><p>In the sheet: <b>Share → Anyone with the link → Viewer</b>, copy that link, and give it to your manager. It stays live from then on.</p></li>
        </ol>
        <pre class="code mt-8" style="max-height:220px;overflow:auto">${esc(APPS_SCRIPT)}</pre>
        <button type="button" class="btn sm mt-8" data-copy-script>${icons.copy}Copy the script</button>
        <p class="hint mt-8">Keep the web app link private: anyone who has it can write to that sheet. Only the sessions table is sent — nothing about tasks or commission.</p>
      </details>
    </div>
  </div>`);
  const foot = el(`<div class="row" style="width:100%"><button type="button" class="btn primary" data-save>Save options</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>`);
  const m = modal({ title: "Session options", body, footer: foot });

  function paintLocs() {
    $('[data-list="locations"]', body).innerHTML = c.locations.map((l, i) => `<div class="rate-line" data-i="${i}" style="margin-bottom:6px">
      <input class="inp nm" data-k="name" value="${esc(l)}" placeholder="Location name">
      ${usedLoc(l) ? `<span class="used">${usedLoc(l)} session${usedLoc(l) === 1 ? "" : "s"}</span>` : ""}
      <button type="button" class="icon-btn sm danger" data-rm aria-label="Remove">${icons.x}</button>
    </div>`).join("");
    const d = $("#oDefLoc", body);
    d.innerHTML = c.locations.map(l => `<option ${l === c.defaults.location ? "selected" : ""}>${esc(l)}</option>`).join("");
  }
  body.addEventListener("input", ev => {
    if (!ev.target.closest('[data-list="locations"]')) return;
    c.locations[Number(ev.target.closest("[data-i]").dataset.i)] = ev.target.value;
  });
  body.addEventListener("click", ev => {
    const rm = ev.target.closest("[data-rm]");
    if (rm) { c.locations.splice(Number(rm.closest("[data-i]").dataset.i), 1); paintLocs(); return; }
    if (ev.target.closest("[data-add-loc]")) { c.locations.push("New location"); paintLocs(); const ins = $$('[data-list="locations"] .nm', body); ins[ins.length - 1]?.select(); }
  });
  paintLocs();
  $("[data-copy-script]", body)?.addEventListener("click", () => navigator.clipboard.writeText(APPS_SCRIPT).then(() => toast("Script copied — paste it into Apps Script")).catch(() => toast("Copy failed", { error: true })));
  const saveSheet = () => {
    const url = $("#oSheetUrl", body).value.trim(), viewUrl = $("#oSheetView", body).value.trim();
    intDoc.set({ sheet: { ...sheet(), url, viewUrl, lastError: "" } });
    return url;
  };
  $("[data-sheet-send]", body)?.addEventListener("click", async e => {
    const b = e.currentTarget;
    if (!saveSheet()) return toast("Paste the web app link first", { error: true });
    b.disabled = true; b.textContent = "Sending…";
    const r = await pushSheet({ force: true });
    b.disabled = false; b.innerHTML = `${icons.refresh}Save and send everything now`;
    toast(r.ok ? `Sent ${r.rows} session${r.rows === 1 ? "" : "s"} to the sheet` : r.error, { error: !r.ok });
    paintSub();
  });
  $("[data-save]", foot).addEventListener("click", () => {
    saveSheet();
    c.locations = c.locations.map(l => l.trim()).filter(Boolean);
    if (!c.locations.length) c.locations = DEFAULT_CFG.locations.slice();
    const hoursList = $("#oHours", body).value.split(",").map(x => num(x)).filter(x => x > 0);
    c.hours = Array.from(new Set(hoursList.length ? hoursList : DEFAULT_CFG.hours)).sort((a, b) => a - b);
    c.defaults = { hours: num($("#oDefHours", body).value) || c.hours[0], location: $("#oDefLoc", body).value || c.locations[0], editing: $("#oDefEdit", body).value === "yes" };
    cfgDoc.replace(c); m.close(); toast("Options saved");
    if (sheet().url) pushSheet().then(r => { if (r.ok && !r.skipped) toast("Google Sheet updated"); paintSub(); });
  });
  $("[data-cancel]", foot).addEventListener("click", () => m.close());
}

/* ---------- Google Sheet mirror ----------
   Every change is pushed to an Apps Script web app the user deploys on their own sheet,
   so a manager can just open the sheet link. The whole table is sent each time, which
   keeps the sheet correct after edits and deletions without any diffing. */
export const sheet = () => ({ url: "", lastSig: "", lastPushAt: "", ...(intDoc?.get()?.sheet || {}) });
const SHEET_HEAD = ["Date", "Client", "Location", "Hours", "Editing", "Notes"];
const MONTH_HEAD = ["Month", "Sessions", "Hours", "With editing", "Without editing"];

/* The sheet is laid out exactly like the table on this page: month band, its sessions
   in date order, and a total at the end. The script in the sheet is a plain renderer,
   so the layout can change here without ever touching Google again. */
function sheetPayload() {
  const list = all(), t = totals(list);
  const grid = [SHEET_HEAD.slice()], bands = [];
  grouped(list, "month").forEach(g => {
    bands.push(grid.length + 1);
    grid.push([`${g.label}  ·  ${g.count} session${g.count === 1 ? "" : "s"}  ·  ${fmtMoney(g.hours, 2)}h  ·  ${g.edited} with editing`, "", "", "", "", ""]);
    g.rows.forEach(x => grid.push([x.date || "", x.client || "", x.location || "", num(x.hours), x.editing ? "Yes" : "No", x.notes || ""]));
  });
  if (!list.length) grid.push(["No sessions logged yet", "", "", "", "", ""]);
  const total = grid.length + 1;
  grid.push([`Total  ·  ${t.count} session${t.count === 1 ? "" : "s"}`, "", "", t.hours, `${t.edited} with editing`, ""]);

  const months = [MONTH_HEAD.slice(), ...grouped(list, "month").map(g => [g.label, g.count, g.hours, g.edited, g.count - g.edited])];
  const mTotal = months.length + 1;
  months.push(["Total", t.count, t.hours, t.edited, t.count - t.edited]);

  return {
    app: "flowork-backstage", v: 2, generatedAt: nowISO(),
    sheets: [
      { name: "Sessions", grid, bands, total, formats: ["ddd d mmm yyyy", "", "", '0.##"h"', "", ""], widths: [140, 170, 130, 70, 80, 280] },
      { name: "By month", grid: months, bands: [], total: mTotal, formats: ["", "0", '0.##"h"', "0", "0"], widths: [140, 90, 80, 110, 130] },
    ],
    totals: { sessions: t.count, hours: t.hours, editing: t.edited },
  };
}
const sig = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h); };

export async function pushSheet({ force = false } = {}) {
  const cfg = sheet();
  if (!cfg.url) return { ok: false, error: "No Google Sheet connected yet." };
  if (!ctx.auth.isOwner) return { ok: false, error: "Unlock with your PIN first." };
  const payload = sheetPayload(), body = JSON.stringify(payload), s = sig(body);
  if (!force && s === cfg.lastSig) return { ok: true, skipped: true };
  try {
    // text/plain keeps it a "simple" request, so the browser sends it without a preflight
    const res = await fetch(cfg.url, { method: "POST", body, headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    // the script answers {"ok":true}; anything else means it ran but failed (usually an old version)
    const txt = await res.text();
    if (!/"ok"\s*:\s*true/.test(txt)) {
      const err = "The sheet script is out of date — paste the new one and redeploy";
      intDoc.set({ sheet: { ...cfg, lastError: err } });
      return { ok: false, error: err };
    }
  } catch (e) {
    try { await fetch(cfg.url, { method: "POST", body, mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" } }); }
    catch (e2) { intDoc.set({ sheet: { ...cfg, lastError: "Couldn't reach the sheet" } }); return { ok: false, error: "Couldn't reach the sheet — check the link, or your connection." }; }
  }
  intDoc.set({ sheet: { ...cfg, lastSig: s, lastPushAt: nowISO(), lastError: "" } });
  return { ok: true, rows: payload.totals.sessions };
}
function queueSheetPush() {
  if (!ctx?.auth?.isOwner || !sheet().url) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushSheet().then(r => { if (!r.ok && !r.skipped) console.warn("[sessions] sheet push:", r.error); paintSub(); }); }, 2500);
}

export const APPS_SCRIPT = `/** flowork Backstage -> this sheet. Paste, save, deploy. Nothing to edit, ever. */
function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < body.sheets.length; i++) render_(ss, body.sheets[i]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function render_(ss, s) {
  var sh = ss.getSheetByName(s.name) || ss.insertSheet(s.name);
  var rows = s.grid.length, cols = s.grid[0].length, i;

  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < cols) sh.insertColumnsAfter(sh.getMaxColumns(), cols - sh.getMaxColumns());
  sh.clear();

  var grid = s.grid.map(function (r) {
    return r.map(function (v) {
      if (typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(v)) {
        var p = v.split('-');
        return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      }
      return v;
    });
  });
  sh.getRange(1, 1, rows, cols).setValues(grid).setVerticalAlignment('middle').setFontFamily('Inter');

  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#F4F4EF').setFontColor('#5B6157');
  sh.setFrozenRows(1);

  for (i = 0; i < (s.bands || []).length; i++) {
    sh.getRange(s.bands[i], 1, 1, cols).setFontWeight('bold').setBackground('#EDF0E8').setFontColor('#4D5C47');
  }
  if (s.total) sh.getRange(s.total, 1, 1, cols).setFontWeight('bold').setBorder(true, null, null, null, null, null);

  for (i = 0; i < (s.formats || []).length; i++) {
    if (s.formats[i]) sh.getRange(2, i + 1, rows - 1, 1).setNumberFormat(s.formats[i]);
  }
  for (i = 0; i < (s.widths || []).length; i++) {
    if (s.widths[i]) sh.setColumnWidth(i + 1, s.widths[i]);
  }

  if (sh.getMaxRows() > rows + 1) sh.deleteRows(rows + 2, sh.getMaxRows() - rows - 1);
  if (sh.getMaxColumns() > cols) sh.deleteColumns(cols + 1, sh.getMaxColumns() - cols);
}`;

/* ---------- export ---------- */
const GROUPINGS = [
  ["none", "Every session"],
  ["week", "Week by week"],
  ["month", "Month by month"],
  ["client", "By client"],
  ["location", "By location"],
];
function openExport() {
  const [ma, mb] = rangeFor("thisMonth");
  const hideCli = ctx.auth.mask("sessionsClients");
  const groupings = GROUPINGS.filter(g => !(g[0] === "client" && hideCli));
  const body = el(`<div class="stack gap-16">
    <div class="field"><label>Period</label><div class="row wrap">
      ${[["thisWeek", "This week"], ["lastWeek", "Last week"], ["thisMonth", "This month"], ["lastMonth", "Last month"], ["thisYear", "This year"], ["all", "Everything"]].map(([k, l]) => `<button type="button" class="chip" data-xr="${k}" ${k === "thisMonth" ? 'aria-pressed="true"' : ""}>${l}</button>`).join("")}
    </div>
      <div class="grid-2 mt-8"><div class="field"><label>From</label><input class="inp" type="date" data-xf value="${ma}"></div><div class="field"><label>To</label><input class="inp" type="date" data-xt value="${mb}"></div></div></div>
    <div class="grid-2">
      <div class="field"><label for="xGroup">Rows</label><select class="inp" id="xGroup">${groupings.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
      <div class="field"><label for="xLoc">Location</label><select class="inp" id="xLoc"><option value="">All locations</option>${usedLocations().map(l => `<option>${esc(l)}</option>`).join("")}</select></div>
    </div>
    <label class="check"><input type="checkbox" data-xnotes checked><span>Include notes (session rows only)</span></label>
    <p class="hint" data-xcount></p>
  </div>`);
  const foot = el(`<div class="row wrap" style="width:100%"><button type="button" class="btn primary" data-csv>${icons.download}Download CSV</button><button type="button" class="btn" data-print>${icons.print}Print / PDF</button></div>`);
  const m = modal({ title: "Export sessions", body, footer: foot });

  const sel = () => {
    const from = $("[data-xf]", body).value, to = $("[data-xt]", body).value, loc = $("#xLoc", body).value;
    return {
      from, to, loc,
      group: $("#xGroup", body).value,
      notes: $("[data-xnotes]", body).checked,
      list: all().filter(s => (!from || s.date >= from) && (!to || s.date <= to) && (!loc || s.location === loc)),
    };
  };
  const count = () => { const { list } = sel(); const t = totals(list); $("[data-xcount]", body).textContent = `${t.count} session${t.count === 1 ? "" : "s"} · ${hrs(t.hours)} · ${t.edited} with editing`; };
  $$("[data-xr]", body).forEach(b => b.addEventListener("click", () => {
    $$("[data-xr]", body).forEach(x => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", "true");
    const [a, z] = b.dataset.xr === "all" ? ["", ""] : rangeFor(b.dataset.xr);
    $("[data-xf]", body).value = a; $("[data-xt]", body).value = z; count();
  }));
  body.addEventListener("change", count); body.addEventListener("input", count); count();

  $("[data-csv]", foot).addEventListener("click", () => { const s = sel(); m.close(); downloadCSV(s); });
  $("[data-print]", foot).addEventListener("click", () => { const s = sel(); m.close(); printSheet(s); });
}

/* group a list for the summarised exports */
function grouped(list, by) {
  const key = s => by === "week" ? iso(monday(parse(s.date || todayISO())))
    : by === "month" ? ym(s.date)
    : by === "client" ? (s.client || "—")
    : (s.location || "—");
  const label = k => by === "week" ? weekLabel(k) : by === "month" ? monthLabel(k) : k;
  const map = new Map();
  list.forEach(s => { const k = key(s); if (!map.has(k)) map.set(k, []); map.get(k).push(s); });
  const keys = Array.from(map.keys()).sort((a, b) => (by === "week" || by === "month") ? a.localeCompare(b) : a.localeCompare(b));
  return keys.map(k => ({ key: k, label: label(k), rows: map.get(k), ...totals(map.get(k)) }));
}
const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
function downloadCSV({ list, from, to, group, notes }) {
  const hideCli = ctx.auth.mask("sessionsClients");
  const nameOf = s => hideCli ? "Client" : s.client;
  let head, rows;
  if (group === "none") {
    head = ["Date", "Day", "Week", "Month", "Client", "Location", "Hours", "Editing"].concat(notes ? ["Notes"] : []);
    rows = list.map(s => {
      const d = parse(s.date);
      return [s.date, d ? DAY[d.getDay()] : "", d ? `W${weekNo(d)}` : "", monthLabel(ym(s.date)), nameOf(s), s.location, num(s.hours), s.editing ? "Yes" : "No"]
        .concat(notes ? [s.notes || ""] : []).map(q).join(",");
    });
    const t = totals(list);
    rows.push(["TOTAL", "", "", "", `${t.clients} clients`, "", t.hours, `${t.edited} with editing`].concat(notes ? [""] : []).map(q).join(","));
  } else {
    const label = { week: "Week", month: "Month", client: "Client", location: "Location" }[group];
    const withClients = group !== "client";        // a client group is always one client
    head = [label, "Sessions", "Hours", "With editing", "Without editing"].concat(withClients ? ["Clients"] : []);
    const gs = grouped(list, group);
    rows = gs.map(g => [g.label, g.count, g.hours, g.edited, g.count - g.edited].concat(withClients ? [g.clients] : []).map(q).join(","));
    const t = totals(list);
    rows.push(["TOTAL", t.count, t.hours, t.edited, t.count - t.edited].concat(withClients ? [t.clients] : []).map(q).join(","));
  }
  const stamp = (!from && !to) ? "all" : `${from || "start"}_${to || todayISO()}`;
  download(`flowork-sessions-${group === "none" ? "" : group + "-"}${stamp}.csv`, "﻿" + [head.map(q).join(","), ...rows].join("\r\n"), "text/csv;charset=utf-8");
  toast("CSV downloaded — opens straight in Sheets or Excel");
}
function printSheet({ list, from, to, group, notes, loc }) {
  const t = totals(list), p = ctx.profile();
  const hideCli = ctx.auth.mask("sessionsClients");
  const period = (!from && !to) ? "All sessions" : `${from ? dmy(from) : "start"} – ${to ? dmy(to) : "today"}`;
  let table;
  if (group === "none") {
    let i = 0, rows = "";
    const gs = grouped(list, "month");
    gs.forEach(g => {
      if (gs.length > 1) rows += `<tr class="grp"><td colspan="6">${esc(g.label)} · ${g.count} session${g.count === 1 ? "" : "s"} · ${hrs(g.hours)}</td></tr>`;
      g.rows.forEach(s => {
        i++;
        rows += `<tr><td class="n" style="text-align:left;color:#858B84">${i}</td><td class="d">${esc(dayShort(s.date))}</td><td>${hideCli ? "Client" : esc(s.client || "—")}${notes && s.notes ? `<div style="color:#858B84;font-size:8pt">${esc(s.notes)}</div>` : ""}</td><td>${esc(s.location || "—")}</td><td class="n">${hrs(s.hours)}</td><td><span class="pill ${s.editing ? "done" : "idle"}">${s.editing ? "Yes" : "No"}</span></td></tr>`;
      });
    });
    table = `<table><thead><tr><th>#</th><th>Date</th><th>Client</th><th>Location</th><th class="r">Hours</th><th>Editing</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">No sessions in this period.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="3" style="font-family:var(--mono);font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:#858B84">Totals</td><td>${t.clients} client${t.clients === 1 ? "" : "s"}</td><td class="n">${hrs(t.hours)}</td><td>${t.edited} with editing</td></tr></tfoot></table>`;
  } else {
    const label = { week: "Week", month: "Month", client: "Client", location: "Location" }[group];
    const rows = grouped(list, group).map(g => `<tr><td>${esc(group === "client" && hideCli ? "Client" : g.label)}</td><td class="n">${g.count}</td><td class="n">${hrs(g.hours)}</td><td class="n">${g.edited}</td><td class="n">${g.count - g.edited}</td></tr>`).join("");
    table = `<table><thead><tr><th>${esc(label)}</th><th class="r">Sessions</th><th class="r">Hours</th><th class="r">With editing</th><th class="r">Without</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">No sessions in this period.</td></tr>`}</tbody>
      <tfoot><tr><td style="font-family:var(--mono);font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:#858B84">Totals</td><td class="n">${t.count}</td><td class="n">${hrs(t.hours)}</td><td class="n">${t.edited}</td><td class="n">${t.count - t.edited}</td></tr></tfoot></table>`;
  }
  printHTML(`
    <div class="p-head"><div><div class="p-brand">flowork<i>.</i></div><div class="p-sub">Podcast sessions${loc ? ` · ${esc(loc)}` : ""}</div></div>
      <div class="p-title"><div class="t">Session sheet</div><div class="d">${esc(period)} · issued ${dmy(todayISO())}</div><div class="d">${esc(p.name)}</div></div></div>
    <div class="p-stats">
      <div class="p-stat"><div class="k">Sessions</div><div class="v">${t.count}</div></div>
      <div class="p-stat"><div class="k">Hours</div><div class="v">${fmtMoney(t.hours, 2)}</div></div>
      <div class="p-stat paid"><div class="k">With editing</div><div class="v">${t.edited}</div></div>
      <div class="p-stat"><div class="k">Without editing</div><div class="v">${t.count - t.edited}</div></div>
      <div class="p-stat"><div class="k">Clients</div><div class="v">${t.clients}</div></div></div>
    ${table}
    <div class="p-foot"><span>flowork. session sheet · ${esc(period)}</span><span>${GROUPINGS.find(g => g[0] === group)?.[1] || ""}</span></div>`);
}
