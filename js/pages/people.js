/* pages/people.js — People: colleagues who give you work, clients who buy it. All derived, nothing to maintain. */
import { $, $$, esc, icons, fmtMoney } from "../ui.js";
import { dmy, relTime } from "../dates.js";
import * as work from "./tasks.js";
import * as ledger from "./commission.js";

export const id = "people";
export const title = "People";
export const icon = "user";

let ctx, root, unsubs = [], selected = "";

export function render(r, c) {
  ctx = c; root = r;
  const q = new URLSearchParams((location.hash.split("?")[1] || "")); selected = q.get("p") || selected;
  const tasks = ctx.store.collection("tasks"), sales = ctx.store.collection("commission");
  unsubs.forEach(u => u()); unsubs = [tasks.subscribe(paint), sales.subscribe(paint)];
  root.innerHTML = `<div class="page-head"><div><h1>People</h1><div class="sub">Everyone who hands you work, and every client on the ledger. Built from what you've logged — nothing to maintain.</div></div></div><div data-people></div>`;
  paint();
}
export function unmount() { unsubs.forEach(u => u()); unsubs = []; }

function paint() {
  if (!root?.isConnected) return;
  const owner = ctx.auth.isOwner, showNotes = !ctx.auth.mask("tasksNotes");
  const canLedger = ctx.auth.canSee("commission"), hideAmt = ctx.auth.mask("commissionAmounts"), hideCli = ctx.auth.mask("commissionClients");
  const tasks = ctx.store.collection("tasks").all(), sales = canLedger && !hideCli ? ctx.store.collection("commission").all() : [];
  const cur = ledger.cfg().currency;
  const map = new Map();
  const get = n => { if (!map.has(n)) map.set(n, { name: n, tasks: [], sales: [] }); return map.get(n); };
  tasks.forEach(t => { if (t.givenBy) get(t.givenBy).tasks.push(t); });
  sales.forEach(e => { if (e.client) get(e.client).sales.push(e); });
  const list = Array.from(map.values()).map(p => ({ ...p, open: p.tasks.filter(t => t.status !== "Completed").length, late: p.tasks.filter(work.isLate).length, s: ledger.summary(p.sales), last: p.tasks.map(t => t.updatedAt).concat(p.sales.map(e => e.updatedAt)).filter(Boolean).sort().pop() }))
    .sort((a, b) => b.open - a.open || b.tasks.length + b.sales.length - (a.tasks.length + a.sales.length) || a.name.localeCompare(b.name));
  if (!list.length) { $("[data-people]", root).innerHTML = `<div class="empty"><h3>No one yet</h3><p>People appear here as soon as work is logged with a “given by”, or a sale with a client.</p></div>`; return; }
  if (selected && !map.has(selected)) selected = "";
  const sel = selected ? list.find(p => p.name === selected) : null;

  const card = p => `<button type="button" class="card" data-p="${esc(p.name)}" style="text-align:left;padding:16px 18px;cursor:pointer;border-color:${p.name === selected ? "var(--sage)" : "var(--line)"};display:flex;flex-direction:column;gap:6px">
      <div class="row" style="justify-content:space-between"><b>${esc(p.name)}</b><span class="mono muted" style="font-size:11px">${p.last ? esc(relTime(p.last)) : ""}</span></div>
      <div class="row wrap gap-4" style="font-size:12.5px;color:var(--muted)">
        ${p.tasks.length ? `<span>${p.open} open of ${p.tasks.length}</span>` : ""}
        ${p.late ? `<span class="tag late">${p.late} past due</span>` : ""}
        ${p.sales.length && !hideAmt ? `<span>${p.tasks.length ? "· " : ""}${p.sales.length} sale${p.sales.length === 1 ? "" : "s"} · ${esc(cur)} ${fmtMoney(p.s.revenue)}</span>` : (p.sales.length ? `<span>${p.tasks.length ? "· " : ""}${p.sales.length} sale${p.sales.length === 1 ? "" : "s"}</span>` : "")}
        ${p.s.due && !hideAmt ? `<span style="color:var(--pending)">· ${esc(cur)} ${fmtMoney(p.s.due)} unpaid</span>` : ""}
      </div></button>`;

  let detail = "";
  if (sel) {
    const open = work.sortTasks(sel.tasks.filter(t => t.status !== "Completed")), done = work.sortTasks(sel.tasks.filter(t => t.status === "Completed"));
    const row = t => `<div class="ov-item" data-task="${t.id}"><span class="dot-st ${work.stClass(t.status)}" style="margin-top:7px"></span><div style="min-width:0"><div class="t" style="font-weight:500">${esc(t.title)}</div><div class="m"><span>${esc(work.isProd(t) ? (t.stage || t.status) : t.status)}</span><span>· ${esc(work.whenShort(t))}</span>${work.isLate(t) ? `<span class="tag late">Past due</span>` : ""}</div>${showNotes && t.notes ? `<div class="muted" style="font-size:12.5px;margin-top:2px">${esc(t.notes)}</div>` : ""}</div><div class="side"><span class="prio ${(t.priority || "Medium").toLowerCase()}" style="font-size:11px"><i></i>${esc(t.priority)}</span></div></div>`;
    detail = `<div class="stack gap-24">
      <div class="page-head" style="margin:0"><div><h1 style="font-size:30px">${esc(sel.name)}</h1><div class="sub">${sel.tasks.length ? `${sel.tasks.length} item${sel.tasks.length === 1 ? "" : "s"} of work` : ""}${sel.tasks.length && sel.sales.length ? " · " : ""}${sel.sales.length ? `${sel.sales.length} sale${sel.sales.length === 1 ? "" : "s"}` : ""}</div></div>
        <div class="actions">${owner && sel.tasks.length ? `<button type="button" class="btn" data-update>${icons.copy}Update for ${esc(sel.name.split(" ")[0])}</button>` : ""}<button type="button" class="btn ghost" data-close>${icons.x}</button></div></div>
      ${open.length ? `<div class="card"><div class="card-h"><h2>Open</h2><span class="muted" style="font-size:12.5px">${open.length}</span></div><div class="ov-list">${open.map(row).join("")}</div></div>` : ""}
      ${sel.sales.length ? `<div class="card"><div class="card-h"><h2>Sales</h2>${!hideAmt ? `<span class="muted" style="font-size:12.5px">${esc(cur)} ${fmtMoney(sel.s.revenue)} · commission ${fmtMoney(sel.s.comm)}${sel.s.due ? ` · <span style="color:var(--pending)">${fmtMoney(sel.s.due)} unpaid</span>` : ""}</span>` : ""}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Items</th>${hideAmt ? "" : `<th class="num">Total</th><th class="num">Commission</th>`}<th>Status</th></tr></thead><tbody>
        ${sel.sales.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => `<tr><td class="date">${esc(dmy(e.date))}</td><td>${esc(ledger.describe(e))}</td>${hideAmt ? "" : `<td class="num">${fmtMoney(ledger.entryTotal(e))}</td><td class="num ${e.status === "Paid" ? "settled" : ""}">${fmtMoney(ledger.entryComm(e))}</td>`}<td><span class="pill ${e.status.toLowerCase()}"><i></i>${esc(e.status)}</span></td></tr>`).join("")}
        </tbody></table></div></div>` : ""}
      ${done.length ? `<div class="card"><div class="card-h"><h2>Completed</h2><span class="muted" style="font-size:12.5px">${done.length}</span></div><div class="ov-list">${done.slice(0, 12).map(row).join("")}${done.length > 12 ? `<div class="ov-item muted" style="font-size:12.5px;cursor:default">and ${done.length - 12} more…</div>` : ""}</div></div>` : ""}
    </div>`;
  }
  $("[data-people]", root).innerHTML = `<div class="ov-grid" style="grid-template-columns:${sel ? "300px 1fr" : "1fr"}">
    <div class="stack gap-12" style="${sel ? "" : "display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px"}">${list.map(card).join("")}</div>
    ${sel ? `<div>${detail}</div>` : ""}</div>`;
  $$("[data-p]", root).forEach(b => b.addEventListener("click", () => { selected = b.dataset.p === selected ? "" : b.dataset.p; history.replaceState(null, "", "#/people" + (selected ? "?p=" + encodeURIComponent(selected) : "")); paint(); }));
  $("[data-close]", root)?.addEventListener("click", () => { selected = ""; history.replaceState(null, "", "#/people"); paint(); });
  $("[data-update]", root)?.addEventListener("click", () => openPersonUpdate(sel.name));
  $$("[data-task]", root).forEach(n => n.addEventListener("click", () => { if (owner) work.openEditor(n.dataset.task); }));
}
async function openPersonUpdate(name) {
  const { modal, el, toast } = await import("../ui.js");
  const { rangeFor } = await import("../dates.js");
  const [a, b] = rangeFor("thisWeek");
  const text = work.buildUpdate({ from: a, to: b, person: name, notes: true });
  const body = el(`<div class="stack gap-12"><textarea class="inp mono" style="min-height:220px;font-size:12.5px" readonly>${esc(text)}</textarea><p class="hint">This week's work from ${esc(name)}. For other periods use Work → Weekly update.</p></div>`);
  const foot = el(`<div class="row"><button type="button" class="btn primary" data-copy>${icons.copy}Copy</button></div>`);
  modal({ title: `Update for ${name}`, body, footer: foot });
  $("[data-copy]", foot).addEventListener("click", async () => { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Select the text and copy it", { error: true }); } });
}
