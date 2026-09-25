/* pages/sessions.js — Sessions: every podcast shoot logged, and the sheet you export from it. */
import { $, $$, el, esc, icons, uid, nowISO, num, fmtMoney, toast, modal, confirmDialog, menu, printHTML, download, debounce } from "../ui.js";
import { todayISO, dmy, dm, dayShort, monthLabel, ym, rangeFor, parse, today, iso, monday, weekLabel, weekShort, weekNo, addDays, relTime, DAY, MON, MONF } from "../dates.js";

export const id = "sessions";
export const title = "Sessions";
export const icon = "mic";

export const DEFAULT_CFG = {
  locations: ["Dubai Hills", "Business Bay", "On location"],
  hours: [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8],
  currency: "AED",
  /* Short codes name the exports: "DH Podcast | September". Anything not listed falls
     back to the initials of the location name, and every code is editable in Options. */
  codes: { "Dubai Hills": "DH", "Business Bay": "VT" },
  defaults: { location: "Dubai Hills", hours: 2, editing: true, fee: 0, editingFee: 0 },
};

let ctx, root, col, cfgDoc, intDoc, unsubs = [];
let pushTimer = null, pushing = false, paintFrame = 0, mounted = 0, openedOnce = false;
let filters = { period: "thisMonth", location: "", editing: "", q: "" };

/* ---------- helpers (exported for Home) ---------- */
export function cfg() {
  const saved = cfgDoc?.get() || {};
  const c = { ...DEFAULT_CFG, ...saved };
  if (!Array.isArray(c.locations) || !c.locations.length) c.locations = DEFAULT_CFG.locations.slice();
  if (!Array.isArray(c.hours) || !c.hours.length) c.hours = DEFAULT_CFG.hours.slice();
  c.defaults = { ...DEFAULT_CFG.defaults, ...(saved.defaults || {}) };
  c.codes = { ...DEFAULT_CFG.codes, ...(saved.codes || {}) };
  c.currency = saved.currency || DEFAULT_CFG.currency;
  return c;
}
export const hrs = h => `${fmtMoney(h, 2)}h`;
/* "14:00 – 16:30" — and the hours between them, counting a late finish past midnight */
export const timeRange = s => (s.start && s.end) ? `${s.start} – ${s.end}` : (s.start || "");
export function hoursBetween(start, end) {
  if (!start || !end) return null;
  const [a, b] = [start, end].map(t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; });
  let mins = b - a;
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}
export const cur = () => cfg().currency;
export const money = v => fmtMoney(v, 2);

/* ---------- what a session is worth ---------- */
export const sessionFee = s => num(s.fee);
export const editingFee = s => (s.editing ? num(s.editingFee) : 0);
export const sessionTotal = s => (s.complimentary ? 0 : sessionFee(s) + editingFee(s));
/* a session logged before prices existed, or one never priced, is "—" rather than a made-up 0 */
export const priced = s => s.complimentary || s.fee !== undefined || s.editingFee !== undefined;

/* the code that names an export: set in Options, otherwise the initials of the location */
export function codeFor(location) {
  const c = cfg();
  if (c.codes?.[location]) return c.codes[location];
  return String(location || "")
    .split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 3) || "FW";
}

export function totals(list) {
  return {
    count: list.length,
    hours: list.reduce((a, s) => a + num(s.hours), 0),
    edited: list.filter(s => s.editing).length,
    clients: new Set(list.map(s => s.client).filter(Boolean)).size,
    comp: list.filter(s => s.complimentary).length,
    fees: list.reduce((a, s) => a + (s.complimentary ? 0 : sessionFee(s)), 0),
    editFees: list.reduce((a, s) => a + (s.complimentary ? 0 : editingFee(s)), 0),
    total: list.reduce((a, s) => a + sessionTotal(s), 0),
  };
}
export function newSession(over = {}) {
  const d = cfg().defaults;
  return { id: uid(), date: todayISO(), client: "", hours: num(d.hours), start: d.start || "", end: "", location: d.location, editing: !!d.editing,
           fee: num(d.fee), editingFee: num(d.editingFee), complimentary: false,
           notes: "", createdAt: nowISO(), updatedAt: nowISO(), ...over };
}
export const clients = () => Array.from(new Set(col.all().map(s => s.client).filter(Boolean))).sort();

/* ---------- lifecycle ---------- */
export function attach(c) {
  ctx = c; col = ctx.store.collection("sessions"); cfgDoc = ctx.store.doc("sessions"); intDoc = ctx.store.doc("integrations");
  if (attach._wired) return;
  attach._wired = true;
  col.subscribe(() => queueSheetPush());
  /* Self-healing: a push can fail because you were offline, the script was mid-redeploy,
     or the workspace wasn't unlocked yet. Nothing is lost — the signature check means these
     retries are free when the sheet is already correct, and they catch up when it isn't. */
  const retry = () => queueSheetPush();
  window.addEventListener("online", retry);
  window.addEventListener("focus", retry);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) retry(); });
  ctx.auth.onChange?.(retry);
  setInterval(retry, 120000);
}
export function render(r, c) {
  attach(c); root = r;
  unsubs.forEach(u => u()); unsubs = [col.subscribe(schedulePaint), cfgDoc.subscribe(schedulePaint), intDoc.subscribe(paintSub)];
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
  mounted = Date.now();
  /* On the 1st of a month "this month" is legitimately empty, which reads exactly like
     lost data. Open on everything instead, with the period control showing where we are. */
  if (!openedOnce) {
    openedOnce = true;
    if (col.loaded !== false && !filtered().length && all().length) filters.period = "all";
  }
  wire(); paint();
  // if it is still not loaded a few seconds in, say so rather than sitting silent
  setTimeout(() => { if (root?.isConnected && col.loaded === false) paint(); }, 8200);
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
  const hideCli = ctx.auth.mask("sessionsClients"), hideAmt = ctx.auth.mask("sessionsAmounts");
  const C = cur();
  const list = filtered(), t = totals(list);
  const ready = col.loaded !== false;
  const everything = totals(all());

  paintSub();
  const shc = sheet();
  const openSheetBtn = shc.url
    ? (shc.viewUrl
        ? `<a class="btn" href="${esc(shc.viewUrl)}" target="_blank" rel="noopener" title="Open the Google Sheet">${icons.sheet}<span class="hide-mobile">Open sheet</span><span class="only-mobile">Sheet</span></a>`
        : `<button type="button" class="btn" data-sheet-link title="Add the link to your Google Sheet">${icons.sheet}<span class="hide-mobile">Open sheet</span><span class="only-mobile">Sheet</span></button>`)
    : "";
  $("[data-actions]", root).innerHTML = owner
    ? `${openSheetBtn}<button type="button" class="btn" data-opts>${icons.settings}<span class="hide-mobile">Options</span></button><button type="button" class="btn primary" data-new>${icons.plus}Log a session</button>`
    : openSheetBtn;
  $("[data-new]", root)?.addEventListener("click", () => openEditor(null));
  $("[data-opts]", root)?.addEventListener("click", openOptions);
  $("[data-sheet-link]", root)?.addEventListener("click", askForSheetLink);

  // location filter options (keeps the current choice, adds anything that has been used)
  const sel = $("[data-floc]", root);
  sel.innerHTML = `<option value="">Location: all</option>` + usedLocations().map(l => `<option value="${esc(l)}" ${l === filters.location ? "selected" : ""}>${esc(l)}</option>`).join("");
  $("[data-fedit]", root).value = filters.editing;

  const fig = (k, v, cls = "") => `<div class="fig ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  $("[data-figs]", root).innerHTML = ready
    ? fig(`Sessions · ${periodLabel()}`, t.count, "lead") +
      fig("Hours", `${fmtMoney(t.hours, 2)}<small>h</small>`) +
      (hideAmt ? fig("With editing", t.edited)
               : fig("Billed", `<em>${esc(C)}</em>${money(t.total)}`, "accent") +
                 (t.comp ? fig("Complimentary", t.comp) : fig("With editing", t.edited)))
    : fig(`Sessions · ${periodLabel()}`, "—", "lead") + fig("Hours", "—") + fig(hideAmt ? "With editing" : "Billed", "—");

  const tb = $("[data-table]", root);
  if (!ready) {
    tb.innerHTML = `<div class="tbl-empty">${Date.now() - mounted > 8000
      ? "Still loading your sessions — check your connection, this page will fill in by itself."
      : "Loading your sessions…"}</div>`;
    return;
  }
  if (!list.length) {
    tb.innerHTML = `<div class="tbl-empty">${everything.count
      ? `Nothing logged ${esc(periodLabel())}.<div class="muted mt-8" style="font-size:13px">You have ${everything.count} session${everything.count === 1 ? "" : "s"} in total — ${hrs(everything.hours)}.</div><button type="button" class="btn sm mt-16" data-show-all>Show everything</button>`
      : (owner ? `No sessions logged yet. <button type="button" class="btn primary sm" data-new-empty style="margin-left:8px">${icons.plus}Log a session</button>` : "No sessions logged yet.")}</div>`;
    return;
  }
  const cols = 6 + (hideAmt ? 0 : 1) + (owner ? 1 : 0);
  const groups = new Map();
  list.forEach(s => { const k = groupKey(s); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
  let i = 0, rows = "";
  Array.from(groups.keys()).sort().forEach(k => {
    const gs = groups.get(k), g = totals(gs);
    rows += `<tr class="group"><td colspan="${cols}">${esc(groupLabel(k))} · ${g.count} session${g.count === 1 ? "" : "s"} · ${hrs(g.hours)}${hideAmt ? "" : ` · ${esc(C)} ${money(g.total)}`}</td></tr>`;
    gs.forEach(s => {
      i++;
      const ed = owner
        ? `<button type="button" class="pill ${s.editing ? "sage" : "neutral"}" data-toggle-edit title="Click to switch"><i></i>${s.editing ? "Yes" : "No"}</button>`
        : `<span class="pill ${s.editing ? "sage" : "neutral"}"><i></i>${s.editing ? "Yes" : "No"}</span>`;
      rows += `<tr data-id="${s.id}" class="${owner ? "clickable" : ""}">
        <td class="dim num hide-mobile" style="text-align:left;width:36px">${i}</td>
        <td class="date"><span class="hide-mobile">${esc(dayShort(s.date))}</span><span class="only-mobile">${esc(dm(s.date))}</span>${timeRange(s) ? `<div class="mono muted hide-mobile" style="font-size:10.5px;margin-top:3px">${esc(timeRange(s))}</div>` : ""}</td>
        <td><div class="desc-lines"><div class="l"><b>${hideCli ? "Client" : esc(s.client || "—")}</b></div>
          <div class="l sub only-narrow">${timeRange(s) ? `${esc(timeRange(s))} · ` : ""}${esc(s.location || "—")} · ${hrs(s.hours)}${s.editing && editingFee(s) && !s.complimentary ? ` · editing ${money(editingFee(s))}` : (s.editing ? " · editing" : "")}</div>${s.notes ? `<div class="l sub muted" style="font-size:12.5px">${esc(s.notes)}</div>` : ""}</div></td>
        <td class="nw hide-narrow">${esc(s.location || "—")}</td>
        <td class="num hide-narrow">${hrs(s.hours)}</td>
        <td class="hide-narrow">${ed}</td>
        ${hideAmt ? "" : `<td class="num">${amountCell(s)}</td>`}
        ${owner ? `<td class="r" style="width:1%"><div class="acts"><button type="button" class="icon-btn sm hide-mobile" data-edit title="Edit">${icons.edit}</button><button type="button" class="icon-btn sm" data-more title="More">${icons.more}</button></div></td>` : ""}
      </tr>`;
    });
  });
  tb.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th class="hide-mobile" style="width:36px">#</th><th>Date</th><th>Client</th><th class="hide-narrow">Location</th><th class="num hide-narrow">Hours</th><th class="hide-narrow">Editing</th>${hideAmt ? "" : `<th class="num">Amount</th>`}${owner ? "<th></th>" : ""}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="subtotal hide-narrow"><td colspan="4" class="eyebrow" style="padding:12px 14px">Total</td><td class="num strong">${hrs(t.hours)}</td><td></td>${hideAmt ? "" : `<td class="num strong">${esc(C)} ${money(t.total)}</td>`}${owner ? "<td></td>" : ""}</tr>
      <tr class="subtotal only-narrow"><td colspan="${cols}" style="padding:12px 14px"><span class="eyebrow">Total</span> <span class="mono" style="margin-left:6px">${hrs(t.hours)}${hideAmt ? "" : ` · ${esc(C)} ${money(t.total)}`}</span></td></tr>
    </tfoot>
  </table></div>`;
}

/* several store events can land in the same tick — repaint once, on the next frame */
function schedulePaint() {
  if (paintFrame) return;
  // a timer, not requestAnimationFrame: rAF never fires while the tab is in the background,
  // which would leave the table stale until you looked at it again
  paintFrame = setTimeout(() => { paintFrame = 0; paint(); }, 16);
}

/* just the one line under the title — never the whole table */
function paintSub() {
  const n = root?.isConnected ? $("[data-sub]", root) : null;
  if (!n) return;
  const sh = sheet();
  n.className = "sub row";
  n.innerHTML = sh.url
    ? `${icons.sheet}<span>Google Sheet ${sh.lastError ? `<span style="color:var(--bad)">— ${esc(sh.lastError)}</span>` : (sh.lastPushAt ? `up to date · sent ${esc(relTime(sh.lastPushAt))}` : "connected")}</span>`
    : "Podcast shoots — client, hours, location and editing.";
}

/* One column, but it still shows what the money is made of. */
function amountCell(s) {
  if (s.complimentary) return `<span class="pill neutral" style="font-weight:500">Complimentary</span>`;
  if (!priced(s)) return `<span class="dim">—</span>`;
  const f = sessionFee(s), e = editingFee(s);
  return `${money(f + e)}${f && e ? `<div class="mono muted hide-mobile" style="font-size:10.5px;margin-top:3px">${money(f)} + ${money(e)} editing</div>` : ""}`;
}

function onTableClick(e) {
  if (e.target.closest("[data-new-empty]")) { openEditor(null); return; }
  if (e.target.closest("[data-show-all]")) {
    filters.period = "all";
    $$("[data-period]", root).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.period === "all")));
    paint(); return;
  }
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
      <div class="field"><label for="zStart">From</label><input class="inp mono" type="time" id="zStart" value="${esc(s.start || "")}"></div>
      <div class="field"><label for="zEnd">To</label><input class="inp mono" type="time" id="zEnd" value="${esc(s.end || "")}"></div>
      <div class="field"><label for="zHours">Hours</label><select class="inp" id="zHours">${hourOpts.map(h => `<option value="${h}" ${num(s.hours) === h ? "selected" : ""}>${fmtMoney(h, 2)} ${h === 1 ? "hour" : "hours"}</option>`).join("")}</select></div>
    </div>
    <div class="grid-2">
      <div class="field"><label for="zLoc">Location</label><select class="inp" id="zLoc">${locOpts.map(l => `<option ${l === s.location ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
      <div class="field"><label for="zEdit">Editing services</label><select class="inp" id="zEdit"><option value="yes" ${s.editing ? "selected" : ""}>Yes</option><option value="no" ${s.editing ? "" : "selected"}>No</option></select></div>
    </div>
    <div class="grid-3">
      <div class="field"><label for="zBilling">Billing</label><select class="inp" id="zBilling"><option value="charged" ${s.complimentary ? "" : "selected"}>Charged</option><option value="free" ${s.complimentary ? "selected" : ""}>Complimentary</option></select></div>
      <div class="field"><label for="zFee">Session fee (${esc(c.currency)})</label><input class="inp mono" id="zFee" type="number" step="any" min="0" value="${esc(s.fee ?? "")}" placeholder="0"></div>
      <div class="field" data-efee-wrap><label for="zEFee">Editing fee (${esc(c.currency)})</label><input class="inp mono" id="zEFee" type="number" step="any" min="0" value="${esc(s.editingFee ?? "")}" placeholder="0"></div>
    </div>
    <div class="line-total"><span class="eyebrow">Total for this session</span><span class="v" data-ztotal>—</span></div>
    <div class="field"><label for="zNotes">Notes</label><input class="inp" id="zNotes" value="${esc(s.notes || "")}" placeholder="Guest, episode, anything useful"></div>
    <p class="hint">Locations, codes and the standard prices live in <b>Options</b>.</p>
  </div>`);
  const foot = el(`<div class="row" style="width:100%">
    <button type="button" class="btn primary" data-save>${existing ? "Save changes" : "Log session"}</button>
    <button type="button" class="btn ghost" data-cancel>Cancel</button><span class="grow"></span>
    ${existing ? `<button type="button" class="btn danger" data-delete>Delete</button>` : ""}</div>`);
  const m = modal({ title: existing ? "Edit session" : "Log a session", body, footer: foot });

  /* give the times and the hours dropdown to each other: fill both ends and the hours follow */
  const startI = $("#zStart", body), endI = $("#zEnd", body), hoursSel = $("#zHours", body);
  function syncHours() {
    const h = hoursBetween(startI.value, endI.value);
    if (h === null || h <= 0) return;
    if (![...hoursSel.options].some(o => num(o.value) === h)) {
      const o = document.createElement("option");
      o.value = String(h); o.textContent = `${fmtMoney(h, 2)} ${h === 1 ? "hour" : "hours"}`;
      hoursSel.appendChild(o);
      [...hoursSel.options].sort((a, b) => num(a.value) - num(b.value)).forEach(x => hoursSel.appendChild(x));
    }
    hoursSel.value = String(h);
  }
  [startI, endI].forEach(n => n.addEventListener("change", syncHours));

  /* editing fee only means something when there is editing; complimentary zeroes the lot */
  const billing = $("#zBilling", body), fee = $("#zFee", body), efee = $("#zEFee", body), edSel = $("#zEdit", body);
  function paintMoney() {
    const free = billing.value === "free", hasEdit = edSel.value === "yes";
    fee.disabled = free; efee.disabled = free || !hasEdit;
    $("[data-efee-wrap]", body).style.opacity = hasEdit ? "1" : ".45";
    const totalNow = free ? 0 : num(fee.value) + (hasEdit ? num(efee.value) : 0);
    $("[data-ztotal]", body).textContent = free ? "Complimentary" : `${c.currency} ${money(totalNow)}`;
  }
  [billing, fee, efee, edSel].forEach(n => { n.addEventListener("input", paintMoney); n.addEventListener("change", paintMoney); });
  paintMoney();

  function save() {
    s.date = $("#zDate", body).value || todayISO();
    s.client = $("#zClient", body).value.trim();
    s.start = startI.value || "";
    s.end = endI.value || "";
    s.hours = num($("#zHours", body).value);
    s.location = $("#zLoc", body).value;
    s.editing = $("#zEdit", body).value === "yes";
    s.complimentary = billing.value === "free";
    s.fee = s.complimentary ? 0 : num(fee.value);
    s.editingFee = s.complimentary || !s.editing ? 0 : num(efee.value);
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

/* The web app link and the sheet's own link are different things, and only you have
   the second one — ask for it the first time the button is pressed, then never again. */
function askForSheetLink() {
  const body = el(`<div class="stack gap-12">
    <p class="ink2">Paste the link to the Google Sheet itself — the one you open to look at it, and the one your manager uses.</p>
    <div class="field"><label for="qSheet">Sheet link</label><input class="inp mono" id="qSheet" style="font-size:12px" placeholder="https://docs.google.com/spreadsheets/d/…" autofocus></div>
    <p class="hint">In the sheet: <b>Share → Anyone with the link → Viewer</b>, then <b>Copy link</b>.</p>
  </div>`);
  const foot = el(`<div class="row" style="width:100%"><button type="button" class="btn primary" data-ok>Save and open</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>`);
  const m = modal({ title: "Open the sheet", body, footer: foot, size: "narrow" });
  const save = () => {
    const v = $("#qSheet", body).value.trim();
    if (!/^https?:\/\//.test(v)) { toast("That doesn't look like a link", { error: true }); return; }
    intDoc.set({ sheet: { ...sheet(), viewUrl: v } });
    m.close(); paint();
    window.open(v, "_blank", "noopener");
  };
  $("[data-ok]", foot).addEventListener("click", save);
  $("[data-cancel]", foot).addEventListener("click", () => m.close());
  body.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save(); } });
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
      <div class="grid-3 mt-8">
        <div class="field"><label for="oCur">Currency</label><input class="inp mono" id="oCur" maxlength="6" value="${esc(c.currency)}"></div>
        <div class="field"><label for="oDefFee">Session fee</label><input class="inp mono" id="oDefFee" type="number" step="any" min="0" value="${esc(c.defaults.fee)}"></div>
        <div class="field"><label for="oDefEFee">Editing fee</label><input class="inp mono" id="oDefEFee" type="number" step="any" min="0" value="${esc(c.defaults.editingFee)}"></div>
      </div>
      <span class="hint">Your usual prices — filled in on every new session, and changeable on each one.</span>
    </div>
    <p class="hint">Renaming a location leaves past sessions exactly as they were logged. The short code names your exports: <b>DH Podcast | September</b>.</p>
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
      <input class="inp mono" data-k="code" value="${esc(c.codes?.[l] ?? codeFor(l))}" maxlength="4" placeholder="DH" aria-label="Short code for exports" title="Names the export: “DH Podcast | September”" style="width:70px;text-transform:uppercase">
      ${usedLoc(l) ? `<span class="used">${usedLoc(l)}</span>` : ""}
      <button type="button" class="icon-btn sm danger" data-rm aria-label="Remove">${icons.x}</button>
    </div>`).join("");
    const d = $("#oDefLoc", body);
    d.innerHTML = c.locations.map(l => `<option ${l === c.defaults.location ? "selected" : ""}>${esc(l)}</option>`).join("");
  }
  body.addEventListener("input", ev => {
    if (!ev.target.closest('[data-list="locations"]')) return;
    const i = Number(ev.target.closest("[data-i]").dataset.i), was = c.locations[i];
    if (ev.target.dataset.k === "code") { c.codes = { ...c.codes, [was]: ev.target.value.toUpperCase() }; return; }
    const code = c.codes?.[was];
    c.locations[i] = ev.target.value;
    if (code) { c.codes = { ...c.codes, [ev.target.value]: code }; }   // keep the code with the renamed location
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
    c.currency = ($("#oCur", body).value.trim() || "AED").toUpperCase();
    c.defaults = { hours: num($("#oDefHours", body).value) || c.hours[0], location: $("#oDefLoc", body).value || c.locations[0], editing: $("#oDefEdit", body).value === "yes",
                   fee: num($("#oDefFee", body).value), editingFee: num($("#oDefEFee", body).value) };
    // drop codes for locations that no longer exist, and make sure every one that does has a code
    const codes = {};
    c.locations.forEach(l => { codes[l] = (c.codes?.[l] || codeFor(l)).toUpperCase(); });
    c.codes = codes;
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
const SHEET_HEAD = ["Date", "From", "To", "Client", "Location", "Hours", "Editing", "Billing", "Session", "Editing fee", "Total", "Notes"];
const MONTH_HEAD = ["Month", "Sessions", "Hours", "With editing", "Complimentary", "Session fees", "Editing fees", "Total"];

/* The sheet is laid out exactly like the table on this page: month band, its sessions
   in date order, and a total at the end. The script in the sheet is a plain renderer,
   so the layout can change here without ever touching Google again. */
function sheetPayload() {
  const list = all(), t = totals(list);
  const C = cur(), blank = new Array(SHEET_HEAD.length - 1).fill("");
  const grid = [SHEET_HEAD.slice()], bands = [];
  grouped(list, "month").forEach(g => {
    bands.push(grid.length + 1);
    grid.push([`${g.label}  ·  ${g.count} session${g.count === 1 ? "" : "s"}  ·  ${fmtMoney(g.hours, 2)}h  ·  ${C} ${fmtMoney(g.total, 2)}`, ...blank]);
    g.rows.forEach(x => grid.push([
      x.date || "", x.start || "", x.end || "", x.client || "", x.location || "", num(x.hours), x.editing ? "Yes" : "No",
      x.complimentary ? "Complimentary" : "Charged",
      x.complimentary ? 0 : sessionFee(x), x.complimentary ? 0 : editingFee(x), sessionTotal(x),
      x.notes || "",
    ]));
  });
  if (!list.length) grid.push(["No sessions logged yet", ...blank]);
  const total = grid.length + 1;
  grid.push([`Total  ·  ${t.count} session${t.count === 1 ? "" : "s"}`, "", "", "", "", t.hours, `${t.edited} with editing`,
             t.comp ? `${t.comp} complimentary` : "", t.fees, t.editFees, t.total, ""]);

  const months = [MONTH_HEAD.slice(), ...grouped(list, "month").map(g => [g.label, g.count, g.hours, g.edited, g.comp, g.fees, g.editFees, g.total])];
  const mTotal = months.length + 1;
  months.push(["Total", t.count, t.hours, t.edited, t.comp, t.fees, t.editFees, t.total]);

  return {
    app: "flowork-backstage", v: 2, generatedAt: nowISO(),
    sheets: [
      { name: "Sessions", grid, bands, total,
        formats: ["ddd d mmm yyyy", "", "", "", "", '0.##"h"', "", "", "#,##0.00", "#,##0.00", "#,##0.00", ""],
        widths: [140, 70, 70, 170, 130, 70, 70, 110, 95, 95, 95, 220] },
      { name: "By month", grid: months, bands: [], total: mTotal,
        formats: ["", "0", '0.##"h"', "0", "0", "#,##0.00", "#,##0.00", "#,##0.00"],
        widths: [140, 90, 80, 110, 120, 110, 110, 110] },
    ],
    totals: { sessions: t.count, hours: t.hours, editing: t.edited, complimentary: t.comp, amount: t.total, currency: C },
  };
}
const sig = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h); };

export async function pushSheet({ force = false } = {}) {
  const cfg = sheet();
  if (!cfg.url) return { ok: false, error: "No Google Sheet connected yet." };
  if (!ctx.auth.isOwner) return { ok: false, error: "Unlock with your PIN first." };
  if (pushing) return { ok: true, skipped: true };
  await col.ready;
  /* Guards against wiping the manager's sheet. A Firestore listener that opens a moment
     before sign-in lands is refused and reports an empty list until it retries — sending
     that would blank the sheet and then fill it again a second later. */
  if (col.denied) return { ok: false, skipped: true, error: "Not unlocked yet" };
  const list = all();
  if (!list.length && Number(cfg.lastCount || 0) > 0 && !force) return { ok: false, skipped: true, error: "Nothing loaded yet — not sending an empty sheet" };
  const payload = sheetPayload(), body = JSON.stringify(payload), s = sig(body);
  if (!force && s === cfg.lastSig) return { ok: true, skipped: true };
  pushing = true;
  try { return await send(cfg, body, s, list.length); } finally { pushing = false; }
}

async function send(cfg, body, s, count) {
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
  intDoc.set({ sheet: { ...cfg, lastSig: s, lastCount: count, lastPushAt: nowISO(), lastError: "" } });
  return { ok: true, rows: count };
}
function queueSheetPush() {
  if (!ctx?.auth?.isOwner || !sheet().url || col.denied) return;
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
    <div class="line-total" style="padding-top:10px"><span class="eyebrow">Saves as</span><span class="mono" data-xname style="font-size:13px"></span></div>
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
  const count = () => {
    const s0 = sel(), t = totals(s0.list);
    $("[data-xcount]", body).textContent = `${t.count} session${t.count === 1 ? "" : "s"} · ${hrs(t.hours)} · ${t.edited} with editing`
      + (ctx.auth.mask("sessionsAmounts") ? "" : ` · ${cur()} ${money(t.total)}${t.comp ? ` · ${t.comp} complimentary` : ""}`);
    $("[data-xname]", body).textContent = exportName(s0);
  };
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

/* ---------- what an export is called ----------
   "DH Podcast | September" — the location's short code, then the period it covers. */
function periodName(from, to) {
  if (!from && !to) return "All time";
  const a = parse(from || to), b = parse(to || from);
  const yr = new Date().getFullYear();
  const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  if (sameMonth) return MONF[a.getMonth()] + (a.getFullYear() === yr ? "" : ` ${a.getFullYear()}`);
  if (a.getFullYear() === b.getFullYear()) {
    const wholeYear = a.getMonth() === 0 && a.getDate() === 1 && b.getMonth() === 11 && b.getDate() === 31;
    return wholeYear ? String(a.getFullYear()) : `${MON[a.getMonth()]}–${MON[b.getMonth()]} ${a.getFullYear()}`;
  }
  return `${MON[a.getMonth()]} ${a.getFullYear()} – ${MON[b.getMonth()]} ${b.getFullYear()}`;
}
export function exportName({ list = [], from, to, loc }) {
  // an explicit location wins; otherwise, if everything in range is one location, use that
  let where = loc;
  if (!where) {
    const set = new Set(list.map(x => x.location).filter(Boolean));
    if (set.size === 1) where = [...set][0];
  }
  return `${where ? codeFor(where) : "flowork"} Podcast | ${periodName(from, to)}`;
}

function downloadCSV(sel) {
  const { list, group, notes } = sel;
  const hideCli = ctx.auth.mask("sessionsClients"), hideAmt = ctx.auth.mask("sessionsAmounts");
  const nameOf = x => hideCli ? "Client" : x.client;
  const C = cur();
  let head, rows;
  if (group === "none") {
    head = ["Date", "Day", "Week", "Month", "From", "To", "Client", "Location", "Hours", "Editing"]
      .concat(hideAmt ? [] : ["Billing", `Session (${C})`, `Editing (${C})`, `Total (${C})`])
      .concat(notes ? ["Notes"] : []);
    rows = list.map(x => {
      const d = parse(x.date);
      return [x.date, d ? DAY[d.getDay()] : "", d ? `W${weekNo(d)}` : "", monthLabel(ym(x.date)), x.start || "", x.end || "", nameOf(x), x.location, num(x.hours), x.editing ? "Yes" : "No"]
        .concat(hideAmt ? [] : [x.complimentary ? "Complimentary" : "Charged", x.complimentary ? 0 : sessionFee(x), x.complimentary ? 0 : editingFee(x), sessionTotal(x)])
        .concat(notes ? [x.notes || ""] : []).map(q).join(",");
    });
    const t = totals(list);
    rows.push(["TOTAL", "", "", "", "", "", `${t.clients} clients`, "", t.hours, `${t.edited} with editing`]
      .concat(hideAmt ? [] : [`${t.comp} complimentary`, t.fees, t.editFees, t.total])
      .concat(notes ? [""] : []).map(q).join(","));
  } else {
    const label = { week: "Week", month: "Month", client: "Client", location: "Location" }[group];
    const withClients = group !== "client";
    head = [label, "Sessions", "Hours", "With editing", "Without editing"]
      .concat(withClients ? ["Clients"] : [])
      .concat(hideAmt ? [] : ["Complimentary", `Session (${C})`, `Editing (${C})`, `Total (${C})`]);
    rows = grouped(list, group).map(g => [g.label, g.count, g.hours, g.edited, g.count - g.edited]
      .concat(withClients ? [g.clients] : [])
      .concat(hideAmt ? [] : [g.comp, g.fees, g.editFees, g.total]).map(q).join(","));
    const t = totals(list);
    rows.push(["TOTAL", t.count, t.hours, t.edited, t.count - t.edited]
      .concat(withClients ? [t.clients] : [])
      .concat(hideAmt ? [] : [t.comp, t.fees, t.editFees, t.total]).map(q).join(","));
  }
  download(`${exportName(sel)}.csv`, "﻿" + [head.map(q).join(","), ...rows].join("\r\n"), "text/csv;charset=utf-8");
  toast("Downloaded — opens straight in Sheets or Excel");
}

/* ---------- the printed sheet ----------
   Deliberately plain: a letterhead, one line of figures, one table, one total. The saved
   PDF takes its name from document.title, so that is set to the export name first. */
function printSheet(sel) {
  const { list, from, to, group, notes, loc } = sel;
  const t = totals(list), p = ctx.profile(), C = cur();
  const hideCli = ctx.auth.mask("sessionsClients"), hideAmt = ctx.auth.mask("sessionsAmounts");
  const name = exportName(sel);
  const where = loc || (new Set(list.map(x => x.location).filter(Boolean)).size === 1 ? [...new Set(list.map(x => x.location))][0] : "");
  const showLoc = !where;                                   // no point repeating one location on every row
  const amt = v => `${fmtMoney(v, 2)}`;

  const summary = [`${t.count} session${t.count === 1 ? "" : "s"}`, hrs(t.hours), `${t.edited} with editing`]
    .concat(t.comp ? [`${t.comp} complimentary`] : [])
    .concat(hideAmt ? [] : [`<b>${esc(C)} ${amt(t.total)}</b>`]).join("<span class='dot'>·</span>");

  let table;
  if (group === "none") {
    const gs = grouped(list, "month");
    const anyTime = list.some(x => x.start);
    const cols = 4 + (anyTime ? 1 : 0) + (showLoc ? 1 : 0) + (hideAmt ? 0 : 3);
    let rows = "";
    gs.forEach(g => {
      if (gs.length > 1) rows += `<tr class="grp"><td colspan="${cols}">${esc(g.label)} — ${g.count} session${g.count === 1 ? "" : "s"}, ${hrs(g.hours)}${hideAmt ? "" : `, ${esc(C)} ${amt(g.total)}`}</td></tr>`;
      g.rows.forEach(x => {
        rows += `<tr><td class="d">${esc(dayShort(x.date))}</td>${anyTime ? `<td class="d">${esc(timeRange(x) || "—")}</td>` : ""}<td>${hideCli ? "Client" : esc(x.client || "—")}${notes && x.notes ? `<div class="sub">${esc(x.notes)}</div>` : ""}</td>${showLoc ? `<td>${esc(x.location || "—")}</td>` : ""}<td class="n">${hrs(x.hours)}</td><td>${x.editing ? "Yes" : "No"}</td>${hideAmt ? "" : (x.complimentary
          ? `<td class="n">—</td><td class="n">—</td><td class="n">Complimentary</td>`
          : `<td class="n">${priced(x) ? amt(sessionFee(x)) : "—"}</td><td class="n">${x.editing ? amt(editingFee(x)) : "—"}</td><td class="n b">${priced(x) ? amt(sessionTotal(x)) : "—"}</td>`)}</tr>`;
      });
    });
    table = `<table><thead><tr><th>Date</th>${anyTime ? "<th>Time</th>" : ""}<th>Client</th>${showLoc ? "<th>Location</th>" : ""}<th class="r">Hours</th><th>Editing</th>${hideAmt ? "" : `<th class="r">Session</th><th class="r">Editing</th><th class="r">Total</th>`}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${cols}">No sessions in this period.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="${2 + (anyTime ? 1 : 0) + (showLoc ? 1 : 0)}">Total</td><td class="n">${hrs(t.hours)}</td><td></td>${hideAmt ? "" : `<td class="n">${amt(t.fees)}</td><td class="n">${amt(t.editFees)}</td><td class="n b">${esc(C)} ${amt(t.total)}</td>`}</tr></tfoot></table>`;
  } else {
    const label = { week: "Week", month: "Month", client: "Client", location: "Location" }[group];
    const rows = grouped(list, group).map(g => `<tr><td>${esc(group === "client" && hideCli ? "Client" : g.label)}</td><td class="n">${g.count}</td><td class="n">${hrs(g.hours)}</td><td class="n">${g.edited}</td>${hideAmt ? "" : `<td class="n b">${amt(g.total)}</td>`}</tr>`).join("");
    table = `<table><thead><tr><th>${esc(label)}</th><th class="r">Sessions</th><th class="r">Hours</th><th class="r">With editing</th>${hideAmt ? "" : `<th class="r">Total (${esc(C)})</th>`}</tr></thead>
      <tbody>${rows || `<tr><td colspan="5">No sessions in this period.</td></tr>`}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${t.count}</td><td class="n">${hrs(t.hours)}</td><td class="n">${t.edited}</td>${hideAmt ? "" : `<td class="n b">${amt(t.total)}</td>`}</tr></tfoot></table>`;
  }

  const prev = document.title;
  document.title = name;                     // this is what the saved PDF gets called
  const restore = () => { document.title = prev; };
  window.addEventListener("afterprint", restore, { once: true });
  setTimeout(restore, 60000);                // belt and braces if afterprint never fires

  printHTML(`
    <div class="p-head">
      <div><div class="p-brand">flowork<i>.</i></div><div class="p-sub">Podcast sessions</div></div>
      <div class="p-title"><div class="t">${esc(where ? `${where}` : "All locations")}</div><div class="d">${esc(periodName(from, to))}</div></div>
    </div>
    <div class="p-sum">${summary}</div>
    ${table}
    <div class="p-foot"><span>${esc(p.name)} · flowork</span><span>Issued ${esc(dmy(todayISO()))}</span></div>`);
}
