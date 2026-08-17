/* pages/commission.js — Ledger: every sale, the commission it earns, and what is still owed. */
import { $, $$, el, esc, icons, uid, nowISO, num, fmtMoney, toast, modal, confirmDialog, menu, printHTML, download, debounce, countUp } from "../ui.js";
import { todayISO, dmy, monthLabel, ym, rangeFor, parse, today, iso, monday, MON } from "../dates.js";
import * as work from "./tasks.js";

export const id = "commission";
export const title = "Ledger";
export const icon = "ledger";

export const STATUSES = ["Pending", "Invoiced", "Paid"];
export const DEFAULT_CFG = {
  rate: 20, currency: "AED", serviceLine: "Editing Services",
  packages: [
    { id: "p1", name: "Package 1", price: 200, deliverables: [] },
    { id: "p2", name: "Package 2", price: 440, deliverables: [] },
    { id: "p3", name: "Package 3", price: 950, deliverables: [] },
  ],
  addons: [
    { id: "a1", name: "Subtitles", price: 450 },
    { id: "a2", name: "Rush Delivery", price: 200 },
    { id: "a3", name: "Reel", price: 200 },
  ],
};

let ctx, root, col, cfgDoc, unsubs = [];
let filters = { period: "all", status: "", q: "" };

/* ---------- money helpers (exported for Today / People) ---------- */
export const cfg = () => ({ ...DEFAULT_CFG, ...(cfgDoc?.get() || {}) });
export const lineTotal = l => num(l.unit) * (num(l.qty) || 1);
export const entryTotal = e => (e.lines || []).reduce((a, l) => a + lineTotal(l), 0);
export const entryRate = e => (e.rate === undefined || e.rate === null || e.rate === "") ? num(cfg().rate) : num(e.rate);
export const entryComm = e => entryTotal(e) * entryRate(e) / 100;
export function summary(list) {
  const revenue = list.reduce((a, e) => a + entryTotal(e), 0);
  const comm = list.reduce((a, e) => a + entryComm(e), 0);
  const paid = list.filter(e => e.status === "Paid").reduce((a, e) => a + entryComm(e), 0);
  const invoiced = list.filter(e => e.status === "Invoiced").reduce((a, e) => a + entryComm(e), 0);
  return { revenue, comm, paid, invoiced, due: comm - paid, count: list.length };
}
export const describe = e => (e.lines || []).map(l => l.name + ((num(l.qty) || 1) > 1 ? ` ×${l.qty}` : "")).join(" + ") || "—";
export function oldestUnpaidDays(list) {
  const open = list.filter(e => e.status !== "Paid" && e.date).map(e => parse(e.date)).sort((a, b) => a - b);
  if (!open.length) return 0;
  return Math.max(0, Math.round((today() - open[0]) / 864e5));
}
export function newEntry(over = {}) {
  return { id: uid(), date: todayISO(), client: "", lines: [], rate: num(cfg().rate), status: "Pending", invoicedOn: null, paidOn: null, notes: "", taskId: null, createdAt: nowISO(), updatedAt: nowISO(), ...over };
}
export function setStatus(e, status) {
  e.status = status; e.updatedAt = nowISO();
  if (status === "Paid") { e.paidOn = e.paidOn || todayISO(); e.invoicedOn = e.invoicedOn || e.paidOn; }
  else if (status === "Invoiced") { e.paidOn = null; e.invoicedOn = e.invoicedOn || todayISO(); }
  else { e.paidOn = null; e.invoicedOn = null; }
  col.upsert(e);
}
const money = v => `${fmtMoney(v)}`;
const stCls = s => (s || "Pending").toLowerCase();

/* ---------- lifecycle ---------- */
export function attach(c) { ctx = c; col = ctx.store.collection("commission"); cfgDoc = ctx.store.doc("commission"); }
export function render(r, c) {
  attach(c); root = r;
  unsubs.forEach(u => u()); unsubs = [col.subscribe(paint), cfgDoc.subscribe(paint)];
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Ledger</h1><div class="sub" data-sub></div></div>
      <div class="actions" data-actions></div>
    </div>
    <div class="stats" data-stats></div>
    <div class="toolbar" style="margin-top:22px">
      <div class="seg" role="group" aria-label="Period">
        ${[["thisMonth", "This month"], ["lastMonth", "Last month"], ["thisYear", "This year"], ["all", "All"]].map(([k, l]) => `<button type="button" data-period="${k}">${l}</button>`).join("")}
      </div>
      <div class="seg" role="group" aria-label="Status">
        <button type="button" data-st="">All</button>${STATUSES.map(s => `<button type="button" data-st="${s}">${s}</button>`).join("")}
      </div>
      <div class="search">${icons.search}<input class="inp" type="search" placeholder="Search client or item…" data-q autocomplete="off"></div>
      <span class="grow"></span>
      <button type="button" class="btn ghost" data-statement>${icons.print}<span class="hide-mobile">Statement</span></button>
    </div>
    <div class="card" data-table></div>
    <p class="kpi-note" data-note></p>`;
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
  $$("[data-st]", root).forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.st === filters.status)); b.addEventListener("click", () => { filters.status = b.dataset.st; $$("[data-st]", root).forEach(x => x.setAttribute("aria-pressed", String(x === b))); paint(); }); });
  const q = $("[data-q]", root); q.value = filters.q; q.addEventListener("input", debounce(() => { filters.q = q.value.trim().toLowerCase(); paint(); }, 120));
  $("[data-statement]", root).addEventListener("click", openStatement);
  $("[data-table]", root).addEventListener("click", onTableClick);
  document.addEventListener("keydown", onKey);
}

/* ---------- data ---------- */
const all = () => col.all().slice().sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));
function filtered() {
  const [from, to] = filters.period === "all" ? ["", ""] : rangeFor(filters.period);
  return all().filter(e => {
    if (from && (e.date || "") < from) return false;
    if (to && (e.date || "") > to) return false;
    if (filters.status && e.status !== filters.status) return false;
    if (filters.q && !`${e.client} ${describe(e)} ${e.notes || ""}`.toLowerCase().includes(filters.q)) return false;
    return true;
  });
}
export const clients = () => Array.from(new Set(col.all().map(e => e.client).filter(Boolean))).sort();

/* ---------- paint ---------- */
function paint() {
  if (!root?.isConnected) return;
  const owner = ctx.auth.isOwner, c = cfg(), cur = c.currency;
  const hideAmt = ctx.auth.mask("commissionAmounts"), hideCli = ctx.auth.mask("commissionClients");
  const list = filtered(), sAll = summary(all()), s = summary(list);
  const [ma, mb] = rangeFor("thisMonth");
  const month = summary(all().filter(e => e.date >= ma && e.date <= mb));
  const oldest = oldestUnpaidDays(all());

  $("[data-sub]", root).textContent = `${c.serviceLine} · ${fmtMoney(c.rate)}% commission · ${cur}, excl. VAT`;
  $("[data-actions]", root).innerHTML = owner ? `<button type="button" class="btn" data-rates>${icons.settings}<span class="hide-mobile">Rates</span></button><button type="button" class="btn primary" data-new>${icons.plus}Log a sale</button>` : "";
  $("[data-new]", root)?.addEventListener("click", () => openEditor(null));
  $("[data-rates]", root)?.addEventListener("click", openRates);

  const stat = (k, v, cls = "", d = "") => `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ""}</div>`;
  const m = v => `<small>${esc(cur)}</small><span data-count="${v}">${money(v)}</span>`;
  $("[data-stats]", root).innerHTML = hideAmt
    ? stat("Sales logged", sAll.count) + stat("Pending", all().filter(e => e.status === "Pending").length) + stat("Invoiced", all().filter(e => e.status === "Invoiced").length) + stat("Paid", all().filter(e => e.status === "Paid").length)
    : stat("Balance due to me", m(sAll.due), "emph accent", oldest ? `oldest unpaid ${oldest} day${oldest === 1 ? "" : "s"}` : (sAll.due ? "" : "all settled")) +
      stat("Earned this month", m(month.comm), "", `${month.count} sale${month.count === 1 ? "" : "s"}`) +
      stat("Commission earned", m(sAll.comm), "", "all time") +
      stat("Paid out", m(sAll.paid), "good") +
      stat("Revenue logged", m(sAll.revenue), "", `${sAll.count} sale${sAll.count === 1 ? "" : "s"}`);
  $$("[data-count]", root).forEach(n => countUp(n, num(n.dataset.count), money, 500));

  // table
  const t = $("[data-table]", root);
  if (!list.length) {
    t.innerHTML = `<div class="tbl-empty">${all().length ? "No sales match this view." : (owner ? `Nothing logged yet. <button type="button" class="btn primary sm" data-new-empty style="margin-left:8px">${icons.plus}Log a sale</button>` : "Nothing logged yet.")}</div>`;
    $("[data-note]", root).textContent = "";
    return;
  }
  let running = 0, i = 0, curMonth = null, rows = "";
  const cols = 3 + (hideAmt ? 0 : 3) + 1 + (owner ? 1 : 0);
  const months = new Map();
  list.forEach(e => { const k = ym(e.date); if (!months.has(k)) months.set(k, []); months.get(k).push(e); });
  Array.from(months.keys()).sort().forEach(k => {
    const es = months.get(k), ms = summary(es);
    rows += `<tr class="group"><td colspan="${cols}">${esc(monthLabel(k))}${hideAmt ? "" : ` · ${es.length} sale${es.length === 1 ? "" : "s"} · commission ${money(ms.comm)}`}</td></tr>`;
    es.forEach(e => {
      i++; const tot = entryTotal(e), cm = entryComm(e), settled = e.status === "Paid";
      if (!settled) running += cm;
      const st = owner ? `<button type="button" class="pill ${stCls(e.status)}" data-cycle title="Click to move forward"><i></i>${esc(e.status)}</button>` : `<span class="pill ${stCls(e.status)}"><i></i>${esc(e.status)}</span>`;
      const linked = e.taskId && ctx.store.collection("tasks").get(e.taskId);
      rows += `<tr data-id="${e.id}" class="${owner ? "clickable" : ""}">
        <td class="dim num" style="text-align:left;width:36px">${i}</td>
        <td class="date">${esc(dmy(e.date))}</td>
        <td><div class="desc-lines">
          <div class="l"><b>${hideCli ? "Client" : esc(e.client || "—")}</b>${linked ? ` <span class="tag cat" title="Linked delivery task: ${esc(linked.title)}" style="margin-left:6px">${esc(work.stClass(linked.status) === "done" ? "Delivered" : "In production")}</span>` : ""}</div>
          <div class="l sub">${esc(describe(e))}${e.notes ? ` · <span class="muted">${esc(e.notes)}</span>` : ""}</div></div></td>
        ${hideAmt ? "" : `<td class="num">${money(tot)}</td>
        <td class="num ${settled ? "settled" : ""}">${money(cm)}${entryRate(e) !== num(c.rate) ? `<span class="muted" style="font-size:10px"> ${fmtMoney(entryRate(e))}%</span>` : ""}</td>`}
        <td>${st}${e.status === "Paid" && e.paidOn ? `<div class="mono muted" style="font-size:10.5px;margin-top:3px">paid ${esc(dmy(e.paidOn))}</div>` : (e.status === "Invoiced" && e.invoicedOn ? `<div class="mono muted" style="font-size:10.5px;margin-top:3px">sent ${esc(dmy(e.invoicedOn))}</div>` : "")}</td>
        ${hideAmt ? "" : `<td class="num balance ${running ? "" : "dim"}">${running ? money(running) : "—"}</td>`}
        ${owner ? `<td class="r" style="width:1%"><div class="acts"><button type="button" class="icon-btn sm" data-edit title="Edit">${icons.edit}</button><button type="button" class="icon-btn sm" data-more title="More">${icons.more}</button></div></td>` : ""}
      </tr>`;
    });
  });
  t.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th style="width:36px">#</th><th>Date</th><th>Client · Sale</th>${hideAmt ? "" : `<th class="num">Total</th><th class="num">Commission</th>`}<th>Status</th>${hideAmt ? "" : `<th class="num balance">Balance due</th>`}${owner ? "<th></th>" : ""}</tr></thead>
    <tbody>${rows}</tbody>
    ${hideAmt ? "" : `<tfoot><tr class="subtotal"><td colspan="3" class="eyebrow" style="padding:12px 14px">Totals for this view</td><td class="num strong">${money(s.revenue)}</td><td class="num strong">${money(s.comm)}</td><td class="mono" style="font-size:11px">paid ${money(s.paid)}</td><td class="num balance">${money(s.due)}</td>${owner ? "<td></td>" : ""}</tr></tfoot>`}
  </table></div>`;
  $("[data-note]", root).textContent = hideAmt ? "" : "Balance due counts every sale not yet marked Paid. Marking a sale Paid keeps it in Commission earned and removes it from the balance. Click a status to move it forward: Pending → Invoiced → Paid.";
}

function onTableClick(e) {
  if (e.target.closest("[data-new-empty]")) { openEditor(null); return; }
  const tr = e.target.closest("tr[data-id]"); if (!tr) return;
  const en = col.get(tr.dataset.id); if (!en) return;
  if (!ctx.auth.isOwner) return;
  if (e.target.closest("[data-cycle]")) { setStatus(en, STATUSES[(STATUSES.indexOf(en.status) + 1) % STATUSES.length]); return; }
  if (e.target.closest("[data-more]")) { openMenu(e.target.closest("[data-more]"), en); return; }
  if (e.target.closest("[data-edit]") || !e.target.closest("button")) { openEditor(en.id); }
}
function openMenu(anchor, en) {
  const linked = en.taskId && ctx.store.collection("tasks").get(en.taskId);
  menu(anchor, [
    { label: "Edit sale", icon: "edit", onClick: () => openEditor(en.id) },
    { label: "Duplicate", icon: "copy", onClick: () => { col.upsert({ ...en, id: uid(), status: "Pending", paidOn: null, invoicedOn: null, taskId: null, date: todayISO(), createdAt: nowISO(), updatedAt: nowISO() }); toast("Duplicated"); } },
    linked ? { label: "Open delivery task", icon: "tasks", onClick: () => { ctx.navigate("tasks"); setTimeout(() => work.openEditor(linked.id), 350); } }
           : { label: "Create delivery task", icon: "tasks", onClick: () => { createTaskFor(en); col.upsert(en); toast("Delivery task added to Work"); } },
    "-",
    { label: "Delete", icon: "trash", danger: true, onClick: () => del(en) },
  ]);
}
function del(en) {
  const keep = en; col.remove(en.id);
  toast(`Deleted sale for ${en.client || "client"}`, { action: "Undo", onAction: () => col.upsert(keep) });
}
/* a sale becomes a delivery task in Work, with the package's deliverables as its checklist */
function createTaskFor(en) {
  const tasks = ctx.store.collection("tasks");
  const c = cfg();
  const pkgLines = (en.lines || []).filter(l => l.kind === "package");
  const checklist = [];
  pkgLines.forEach(l => { const p = c.packages.find(x => x.name === l.name); (p?.deliverables || []).forEach(d => { for (let i = 0; i < (num(l.qty) || 1); i++) checklist.push({ id: uid(), text: (num(l.qty) || 1) > 1 ? `${d} (${i + 1})` : d, done: false }); }); });
  const t = work.newTask({
    title: `${describe(en)} — ${en.client || "client"}`, givenBy: en.client || "", kind: "production", stage: "Brief",
    priority: "High", tags: ["Client work"], checklist, notes: en.notes || "", saleId: en.id,
    dateMode: "week", date: iso(monday(parse(en.date || todayISO()))),
  });
  tasks.upsert(t); en.taskId = t.id; en.updatedAt = nowISO();
  return t;
}

/* ---------- sale editor ---------- */
export function openEditor(idOrNull, presets = {}) {
  if (!ctx.auth.isOwner) return;
  const existing = idOrNull ? col.get(idOrNull) : null;
  const e = existing ? JSON.parse(JSON.stringify(existing)) : newEntry(presets);
  const c = cfg(), cur = c.currency;
  if (!existing && !e.lines.length) e.lines.push({ id: uid(), kind: "package", name: c.packages[0]?.name || "", unit: c.packages[0]?.price || 0, qty: 1 });
  const body = el(`<div class="stack gap-16">
    <div class="grid-2">
      <div class="field"><label for="sDate">Date</label><input class="inp" type="date" id="sDate" value="${esc(e.date)}"></div>
      <div class="field"><label for="sClient">Client</label><input class="inp" id="sClient" list="fw-clients" value="${esc(e.client)}" placeholder="Who bought it" autocomplete="off" autofocus><datalist id="fw-clients">${clients().map(x => `<option value="${esc(x)}">`).join("")}</datalist></div>
    </div>
    <div class="field"><label>Items</label>
      <div class="lines" data-lines></div>
      <div class="row mt-8"><button type="button" class="btn sm" data-add="package">${icons.plus}Package</button><button type="button" class="btn sm" data-add="addon">${icons.plus}Add-on</button><button type="button" class="btn sm ghost" data-add="custom">${icons.plus}Custom item</button></div>
      <div class="line-total"><span class="eyebrow">Total · commission at <input class="inp mono" id="sRate" type="number" step="0.5" min="0" value="${esc(e.rate)}" style="width:64px;height:26px;display:inline-block;padding:0 6px;margin:0 2px"> %</span><span><span class="v" data-total>0</span> <span class="muted mono" style="font-size:12px" data-comm></span></span></div>
    </div>
    <div class="grid-2">
      <div class="field"><label for="sStatus">Status</label><select class="inp" id="sStatus">${STATUSES.map(s => `<option ${s === e.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="field" data-paid-wrap><label for="sPaidOn">Paid on</label><input class="inp" type="date" id="sPaidOn" value="${esc(e.paidOn || "")}"></div>
    </div>
    <div class="field"><label for="sNotes">Notes</label><input class="inp" id="sNotes" value="${esc(e.notes || "")}" placeholder="Reference, invoice number, anything useful"></div>
    ${!existing ? `<label class="check"><input type="checkbox" id="sTask" checked><span>Also add a delivery task in Work (with the package's checklist)</span></label>` : ""}
  </div>`);
  const foot = el(`<div class="row" style="width:100%">
    <button type="button" class="btn primary" data-save>${existing ? "Save changes" : "Log sale"}</button>
    <button type="button" class="btn ghost" data-cancel>Cancel</button><span class="grow"></span>
    ${existing ? `<button type="button" class="btn danger" data-delete>Delete</button>` : ""}</div>`);
  const m = modal({ title: existing ? "Edit sale" : "Log a sale", body, footer: foot });

  const linesRoot = $("[data-lines]", body);
  const catalogFor = kind => kind === "package" ? c.packages : kind === "addon" ? c.addons : [];
  function paintLines() {
    linesRoot.innerHTML = e.lines.map(l => {
      const cat = catalogFor(l.kind);
      const nameField = l.kind === "custom"
        ? `<input class="inp" data-lf="name" value="${esc(l.name)}" placeholder="Describe the item">`
        : `<select class="inp" data-lf="name">${cat.map(p => `<option ${p.name === l.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}${l.name && !cat.some(p => p.name === l.name) ? `<option selected>${esc(l.name)}</option>` : ""}</select>`;
      return `<div class="line-row" data-lid="${l.id}">
        <select class="inp" data-lf="kind"><option value="package" ${l.kind === "package" ? "selected" : ""}>Package</option><option value="addon" ${l.kind === "addon" ? "selected" : ""}>Add-on</option><option value="custom" ${l.kind === "custom" ? "selected" : ""}>Custom</option></select>
        ${nameField}
        <input class="inp" type="number" min="1" step="1" data-lf="qty" value="${esc(l.qty || 1)}" aria-label="Quantity" title="Quantity">
        <input class="inp" type="number" step="any" data-lf="unit" value="${esc(l.unit ?? "")}" aria-label="Unit price" title="Unit price (${esc(cur)})">
        <button type="button" class="icon-btn sm" data-lrm aria-label="Remove item">${icons.x}</button>
      </div>`;
    }).join("") || `<p class="muted" style="font-size:13px">No items yet.</p>`;
    paintTotal();
  }
  function paintTotal() {
    const tot = entryTotal(e), rate = num($("#sRate", body).value);
    $("[data-total]", body).textContent = `${cur} ${money(tot)}`;
    $("[data-comm]", body).textContent = `→ ${cur} ${money(tot * rate / 100)} commission`;
  }
  linesRoot.addEventListener("input", ev => {
    const row = ev.target.closest("[data-lid]"); const l = e.lines.find(x => x.id === row.dataset.lid); if (!l) return;
    const f = ev.target.dataset.lf;
    if (f === "kind") { l.kind = ev.target.value; const cat = catalogFor(l.kind); l.name = cat[0]?.name || (l.kind === "custom" ? "" : l.name); l.unit = cat[0]?.price ?? l.unit; paintLines(); return; }
    if (f === "name") { l.name = ev.target.value; const hit = catalogFor(l.kind).find(p => p.name === l.name); if (hit) { l.unit = hit.price; row.querySelector('[data-lf="unit"]').value = hit.price; } paintTotal(); return; }
    if (f === "qty") { l.qty = Math.max(1, Math.round(num(ev.target.value)) || 1); paintTotal(); return; }
    if (f === "unit") { l.unit = num(ev.target.value); paintTotal(); }
  });
  linesRoot.addEventListener("click", ev => { const b = ev.target.closest("[data-lrm]"); if (!b) return; e.lines = e.lines.filter(x => x.id !== b.closest("[data-lid]").dataset.lid); paintLines(); });
  $$("[data-add]", body).forEach(b => b.addEventListener("click", () => { const kind = b.dataset.add, cat = catalogFor(kind); e.lines.push({ id: uid(), kind, name: cat[0]?.name || "", unit: cat[0]?.price || 0, qty: 1 }); paintLines(); }));
  $("#sRate", body).addEventListener("input", paintTotal);
  const paidWrap = $("[data-paid-wrap]", body), stSel = $("#sStatus", body);
  const syncPaid = () => { paidWrap.style.visibility = stSel.value === "Paid" ? "visible" : "hidden"; if (stSel.value === "Paid" && !$("#sPaidOn", body).value) $("#sPaidOn", body).value = todayISO(); };
  stSel.addEventListener("change", syncPaid); syncPaid();
  paintLines();

  function save() {
    e.date = $("#sDate", body).value || todayISO();
    e.client = $("#sClient", body).value.trim();
    e.rate = num($("#sRate", body).value);
    e.notes = $("#sNotes", body).value.trim();
    e.lines = e.lines.filter(l => l.name || l.unit);
    if (!e.lines.length) { toast("Add at least one item", { error: true }); return; }
    const st = stSel.value, was = existing?.status;
    e.status = st;
    if (st === "Paid") { e.paidOn = $("#sPaidOn", body).value || todayISO(); e.invoicedOn = e.invoicedOn || e.paidOn; }
    else if (st === "Invoiced") { e.paidOn = null; e.invoicedOn = e.invoicedOn || (was === "Invoiced" ? existing.invoicedOn : todayISO()); }
    else { e.paidOn = null; e.invoicedOn = null; }
    e.updatedAt = nowISO();
    if (!existing && $("#sTask", body)?.checked && e.lines.some(l => l.kind === "package")) createTaskFor(e);
    col.upsert(e); m.close(); toast(existing ? "Saved" : "Sale logged");
  }
  $("[data-save]", foot).addEventListener("click", save);
  $("[data-cancel]", foot).addEventListener("click", () => m.close());
  $("[data-delete]", foot)?.addEventListener("click", () => { m.close(); del(existing); });
  body.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.tagName === "INPUT" && ev.target.type !== "number") { ev.preventDefault(); save(); } });
}

/* ---------- rates & catalog ---------- */
function openRates() {
  const c = JSON.parse(JSON.stringify(cfg()));
  const used = (kind, name) => col.all().filter(e => (e.lines || []).some(l => l.kind === kind && l.name === name)).length;
  const body = el(`<div class="stack gap-16">
    <div class="grid-3">
      <div class="field"><label for="rRate">Commission %</label><input class="inp mono" id="rRate" type="number" step="0.5" min="0" value="${esc(c.rate)}"></div>
      <div class="field"><label for="rCur">Currency</label><input class="inp mono" id="rCur" maxlength="6" value="${esc(c.currency)}"></div>
      <div class="field"><label for="rLine">Service line</label><input class="inp" id="rLine" value="${esc(c.serviceLine)}"></div>
    </div>
    <div class="field"><label>Packages</label><p class="hint" style="margin:-2px 0 6px">Unit prices. Deliverables become the checklist of the delivery task when you log a sale.</p><div data-list="packages"></div><button type="button" class="btn sm mt-8" data-add-item="packages">${icons.plus}Add package</button></div>
    <div class="field"><label>Add-ons</label><div data-list="addons"></div><button type="button" class="btn sm mt-8" data-add-item="addons">${icons.plus}Add add-on</button></div>
    <p class="hint">Renaming keeps past sales as they were logged. Changing the commission % only affects new sales — each sale remembers its own rate.</p>
  </div>`);
  const foot = el(`<div class="row" style="width:100%"><button type="button" class="btn primary" data-save>Save rates</button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>`);
  const m = modal({ title: "Rates & catalog", body, footer: foot, size: "wide" });
  function paintList(key) {
    const kind = key === "packages" ? "package" : "addon";
    $(`[data-list="${key}"]`, body).innerHTML = c[key].map((it, i) => `<div class="stack gap-4" style="margin-bottom:${key === "packages" ? "12px" : "6px"}">
      <div class="rate-line" data-i="${i}">
        <input class="inp nm" data-k="name" value="${esc(it.name)}" placeholder="Name">
        <input class="inp pr mono" data-k="price" type="number" step="any" value="${esc(it.price ?? "")}" placeholder="0" aria-label="Price">
        <span class="mono muted" style="font-size:11px;width:34px">${esc(c.currency)}</span>
        ${used(kind, it.name) ? `<span class="used">${used(kind, it.name)} sale${used(kind, it.name) === 1 ? "" : "s"}</span>` : ""}
        <button type="button" class="icon-btn sm danger" data-rm aria-label="Remove">${icons.x}</button>
      </div>
      ${key === "packages" ? `<input class="inp" data-i="${i}" data-k="deliverables" value="${esc((it.deliverables || []).join(", "))}" placeholder="Deliverables, comma separated — e.g. Main edit, Reel cut, Subtitles" style="font-size:13px;height:34px">` : ""}
    </div>`).join("");
  }
  body.addEventListener("input", ev => {
    const key = ev.target.closest("[data-list]")?.dataset.list; if (!key) return;
    const i = Number(ev.target.closest("[data-i]").dataset.i), it = c[key][i], k = ev.target.dataset.k;
    if (k === "name") it.name = ev.target.value; else if (k === "price") it.price = num(ev.target.value); else if (k === "deliverables") it.deliverables = ev.target.value.split(",").map(s => s.trim()).filter(Boolean);
  });
  body.addEventListener("click", ev => {
    const rm = ev.target.closest("[data-rm]"); if (rm) { const key = rm.closest("[data-list]").dataset.list; c[key].splice(Number(rm.closest("[data-i]").dataset.i), 1); paintList(key); return; }
    const add = ev.target.closest("[data-add-item]"); if (add) { const key = add.dataset.addItem; c[key].push({ id: uid(), name: key === "packages" ? `Package ${c[key].length + 1}` : "New add-on", price: 0, ...(key === "packages" ? { deliverables: [] } : {}) }); paintList(key); const ins = $$(`[data-list="${key}"] .nm`, body); ins[ins.length - 1]?.focus(); }
  });
  paintList("packages"); paintList("addons");
  $("[data-save]", foot).addEventListener("click", () => {
    c.rate = num($("#rRate", body).value); c.currency = $("#rCur", body).value.trim() || "AED"; c.serviceLine = $("#rLine", body).value.trim() || "Editing Services";
    c.packages = c.packages.filter(p => p.name); c.addons = c.addons.filter(p => p.name);
    cfgDoc.replace(c); m.close(); toast("Rates saved");
  });
  $("[data-cancel]", foot).addEventListener("click", () => m.close());
}

/* ---------- statement (print) ---------- */
function openStatement() {
  const [ma, mb] = rangeFor("thisMonth");
  const body = el(`<div class="stack gap-16">
    <div class="field"><label>Period</label><div class="row wrap">
      <button type="button" class="chip" data-sr="thisMonth" aria-pressed="true">This month</button><button type="button" class="chip" data-sr="lastMonth">Last month</button><button type="button" class="chip" data-sr="thisYear">This year</button><button type="button" class="chip" data-sr="all">Everything</button></div>
      <div class="grid-2 mt-8"><div class="field"><label>From</label><input class="inp" type="date" data-sf value="${ma}"></div><div class="field"><label>To</label><input class="inp" type="date" data-st2 value="${mb}"></div></div></div>
    <div class="field"><label>Include</label>
      <label class="check"><input type="checkbox" data-inc-paid checked><span>Sales already paid</span></label>
      <label class="check"><input type="checkbox" data-inc-notes checked><span>Notes</span></label></div>
    <p class="hint">Prints as an A4 statement you can save as PDF and send to finance.</p>
  </div>`);
  const foot = el(`<div class="row wrap" style="width:100%"><button type="button" class="btn primary" data-print>${icons.print}Print / PDF</button><button type="button" class="btn" data-csv>${icons.download}CSV</button></div>`);
  const m = modal({ title: "Commission statement", body, footer: foot });
  $$("[data-sr]", body).forEach(cb => cb.addEventListener("click", () => { $$("[data-sr]", body).forEach(x => x.setAttribute("aria-pressed", "false")); cb.setAttribute("aria-pressed", "true"); const [a, b] = cb.dataset.sr === "all" ? ["", ""] : rangeFor(cb.dataset.sr); $("[data-sf]", body).value = a; $("[data-st2]", body).value = b; }));
  const sel = () => {
    const from = $("[data-sf]", body).value, to = $("[data-st2]", body).value, incPaid = $("[data-inc-paid]", body).checked;
    return { from, to, notes: $("[data-inc-notes]", body).checked, list: all().filter(e => (!from || e.date >= from) && (!to || e.date <= to) && (incPaid || e.status !== "Paid")) };
  };
  $("[data-print]", foot).addEventListener("click", () => { const s = sel(); m.close(); printStatement(s); });
  $("[data-csv]", foot).addEventListener("click", () => {
    const { list } = sel(); const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Date", "Client", "Items", "Total", "Rate %", "Commission", "Status", "Invoiced on", "Paid on", "Notes"];
    const rows = list.map(e => [e.date, e.client, describe(e), entryTotal(e), entryRate(e), entryComm(e), e.status, e.invoicedOn || "", e.paidOn || "", e.notes || ""].map(q).join(","));
    download(`commission-${todayISO()}.csv`, "﻿" + [head.map(q).join(","), ...rows].join("\r\n"), "text/csv;charset=utf-8"); toast("CSV downloaded");
  });
}
function printStatement({ list, from, to, notes }) {
  const c = cfg(), cur = c.currency, s = summary(list), p = ctx.profile();
  const hideCli = ctx.auth.mask("commissionClients");
  const period = (!from && !to) ? "All sales" : `${from ? dmy(from) : "start"} – ${to ? dmy(to) : "today"}`;
  const stNo = from && to && ym(from) === ym(to) ? `ST-${ym(from)}` : `ST-${todayISO().replace(/-/g, "")}`;
  let running = 0, i = 0, rows = "";
  const months = new Map(); list.forEach(e => { const k = ym(e.date); if (!months.has(k)) months.set(k, []); months.get(k).push(e); });
  Array.from(months.keys()).sort().forEach(k => {
    if (months.size > 1) rows += `<tr class="grp"><td colspan="8">${esc(monthLabel(k))}</td></tr>`;
    months.get(k).forEach(e => {
      i++; const tot = entryTotal(e), cm = entryComm(e), settled = e.status === "Paid"; if (!settled) running += cm;
      rows += `<tr><td class="n" style="text-align:left;color:#858B84">${i}</td><td class="d">${esc(dmy(e.date))}</td><td>${hideCli ? "Client" : esc(e.client || "—")}${notes && e.notes ? `<div style="color:#858B84;font-size:8pt">${esc(e.notes)}</div>` : ""}</td><td>${esc(describe(e))}</td><td class="n">${money(tot)}</td><td class="n ${settled ? "settled" : ""}">${money(cm)}</td><td><span class="pill ${stCls(e.status)}">${esc(e.status)}</span>${e.paidOn ? `<div class="d" style="color:#858B84;font-size:7pt">${esc(dmy(e.paidOn))}</div>` : ""}</td><td class="n bal">${running ? money(running) : ""}</td></tr>`;
    });
  });
  printHTML(`
    <div class="p-head"><div><div class="p-brand">flowork<i>.</i></div><div class="p-sub">${esc(c.serviceLine)} · ${fmtMoney(c.rate)}% commission · ${esc(cur)}, excl. VAT</div></div>
      <div class="p-title"><div class="t">Commission statement</div><div class="d">${esc(stNo)} · ${esc(period)} · issued ${dmy(todayISO())}</div><div class="d">${esc(p.name)}</div></div></div>
    <div class="p-stats">
      <div class="p-stat"><div class="k">Sales</div><div class="v">${s.count}</div></div>
      <div class="p-stat"><div class="k">Revenue</div><div class="v">${esc(cur)} ${money(s.revenue)}</div></div>
      <div class="p-stat"><div class="k">Commission</div><div class="v">${esc(cur)} ${money(s.comm)}</div></div>
      <div class="p-stat paid"><div class="k">Paid out</div><div class="v">${esc(cur)} ${money(s.paid)}</div></div>
      <div class="p-stat due"><div class="k">Balance due</div><div class="v">${esc(cur)} ${money(s.due)}</div></div></div>
    <table><thead><tr><th>#</th><th>Date</th><th>Client</th><th>Items</th><th class="r">Total</th><th class="r">Commission</th><th>Status</th><th class="r">Balance due</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8">No sales in this period.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="4" style="font-family:var(--mono);font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:#858B84">Totals</td><td class="n">${money(s.revenue)}</td><td class="n">${money(s.comm)}</td><td style="font-family:var(--mono);font-size:7.5pt;color:#858B84">paid ${money(s.paid)}</td><td class="n bal">${money(s.due)}</td></tr></tfoot></table>
    <div class="p-foot"><span>flowork. commission statement · ${esc(stNo)}</span><span>Balance due excludes sales marked paid</span></div>`);
}
