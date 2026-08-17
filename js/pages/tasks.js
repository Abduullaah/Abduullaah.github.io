/* pages/tasks.js — Work: everything in flight, week by week. Tasks and productions. */
import { $, $$, el, esc, icons, uid, nowISO, toast, modal, confirmDialog, menu, download, printHTML, debounce } from "../ui.js";
import { iso, parse, today, todayISO, addDays, monday, weekNo, weekLabel, weekShort, dayShort, dayLabel, dmy, rangeFor, DAY } from "../dates.js";

export const id = "tasks";
export const title = "Work";
export const icon = "tasks";

export const STATUSES = ["Not Started", "In Progress", "Completed"];
export const PRIORITIES = ["High", "Medium", "Low"];
export const STAGES = ["Brief", "Shooting", "Editing", "Review", "Delivered"];
const STAGE_STATUS = { Brief: "Not Started", Shooting: "In Progress", Editing: "In Progress", Review: "In Progress", Delivered: "Completed" };
const PO = { High: 0, Medium: 1, Low: 2 };
export const stClass = s => s === "Completed" ? "done" : s === "In Progress" ? "progress" : "idle";
const prClass = p => (p || "Medium").toLowerCase();
const PROD_RE = /\b(video|reel|edit|editing|podcast|shoot|film|footage|cut|clip|episode|trailer|teaser|animation)\b/i;

let ctx, root, col, unsub = null, lastDel = null;
let view = "list", boardBy = "status", showFilters = false;
let filters = { q: "", status: "", priority: "", given: "", tag: "", kind: "", from: "", to: "", chip: "" };

/* ---------- task helpers (exported for Today / People / Ledger) ---------- */
export const isProd = t => t.kind === "production";
export const bandKey = t => (!t.date || t.dateMode === "none") ? "none" : iso(monday(parse(t.date)));
export function whenShort(t) {
  if (!t.date || t.dateMode === "none") return "Ongoing";
  if (t.dateMode === "day") return dayShort(t.date);
  return weekShort(iso(monday(parse(t.date))));
}
export function isLate(t) {
  if (t.status === "Completed" || !t.date || t.dateMode === "none") return false;
  const e = t.dateMode === "week" ? addDays(monday(parse(t.date)), 4) : parse(t.date);
  return e < today();
}
export function inRange(t, from, to) {
  if (!from && !to) return true;
  if (!t.date || t.dateMode === "none") return true;
  const s = t.dateMode === "week" ? monday(parse(t.date)) : parse(t.date);
  const e = t.dateMode === "week" ? addDays(s, 4) : s;
  if (from && e < parse(from)) return false;
  if (to && s > parse(to)) return false;
  return true;
}
export function sortTasks(list) {
  return list.slice().sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const ap = PO[a.priority] ?? 1, bp = PO[b.priority] ?? 1;
    if (ap !== bp) return ap - bp;
    if (a.status !== b.status) return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
    return (a.title || "").localeCompare(b.title || "");
  });
}
export const checkProgress = t => { const c = t.checklist || []; return c.length ? { done: c.filter(x => x.done).length, total: c.length } : null; };
export const isWaiting = t => t.status !== "Completed" && /\b(waiting|blocked|on hold|awaiting|pending approval)\b/i.test(t.notes || "");
export function newTask(over = {}) {
  return { id: uid(), title: "", kind: "task", stage: null, givenBy: "", assignedTo: ctx?.profile().name || "Abdullah", status: "Not Started", priority: "Medium", dateMode: "week", date: iso(monday(new Date())), notes: "", tags: [], checklist: [], links: [], pinned: false, saleId: null, createdAt: nowISO(), updatedAt: nowISO(), completedAt: null, ...over };
}
export function applyStatus(t, status) {
  const was = t.status;
  t.status = status; t.updatedAt = nowISO();
  t.completedAt = status === "Completed" ? (was === "Completed" ? t.completedAt : nowISO()) : null;
  if (isProd(t)) { if (status === "Completed") t.stage = "Delivered"; else if (status === "Not Started") t.stage = "Brief"; else if (!t.stage || STAGE_STATUS[t.stage] !== "In Progress") t.stage = "Editing"; }
  return t;
}
export function applyStage(t, stage) { t.stage = stage; return applyStatus(t, STAGE_STATUS[stage] || "In Progress"); }
export function saveTask(t) { col.upsert(t); }
export function collection() { return col; }

/* ---------- quick capture: "Office walk-in video @Rania !high next week #content" ---------- */
export function parseQuick(text) {
  let s = " " + text.trim() + " ";
  const t = { givenBy: "", priority: "Medium", tags: [], dateMode: "week", date: iso(monday(new Date())), kind: "task" };
  s = s.replace(/\s@([\w'-]+)/g, (_, n) => { t.givenBy = n; return " "; });
  s = s.replace(/\s!(high|h|urgent)\b/i, () => { t.priority = "High"; return " "; }).replace(/\s!(med|medium|m)\b/i, () => { t.priority = "Medium"; return " "; }).replace(/\s!(low|l)\b/i, () => { t.priority = "Low"; return " "; });
  s = s.replace(/\s#([\w-]+)/g, (_, tag) => { t.tags.push(tag[0].toUpperCase() + tag.slice(1)); return " "; });
  const td = today();
  const dayIdx = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  s = s.replace(/\s(today|tomorrow|next week|this week|ongoing|no date|on (mon|tue|wed|thu|fri|sat|sun)[a-z]*)\s/i, (m0, w, dn) => {
    const k = w.toLowerCase();
    if (k === "today") { t.dateMode = "day"; t.date = iso(td); }
    else if (k === "tomorrow") { t.dateMode = "day"; t.date = iso(addDays(td, 1)); }
    else if (k === "next week") { t.dateMode = "week"; t.date = iso(addDays(monday(td), 7)); }
    else if (k === "this week") { t.dateMode = "week"; t.date = iso(monday(td)); }
    else if (k === "ongoing" || k === "no date") { t.dateMode = "none"; t.date = null; }
    else if (dn) { const want = dayIdx[dn.toLowerCase()]; let d = addDays(td, 1); while (d.getDay() !== want) d = addDays(d, 1); t.dateMode = "day"; t.date = iso(d); }
    return " ";
  });
  t.title = s.replace(/\s+/g, " ").trim();
  if (PROD_RE.test(t.title)) { t.kind = "production"; t.stage = "Brief"; }
  return t;
}
export function quickCapture(onDone) {
  if (!ctx?.auth?.isOwner) return;
  const body = el(`<div class="stack gap-12">
    <input class="inp lg" data-qc placeholder="Office walk-in video @Rania !high next week #content" autocomplete="off" autofocus style="height:46px;font-size:15px">
    <div class="mono muted" data-qc-prev style="font-size:12px;min-height:18px"></div>
    <p class="hint"><b>@name</b> given by · <b>!high !low</b> priority · <b>#tag</b> · <b>today</b>, <b>tomorrow</b>, <b>next week</b>, <b>on fri</b>, <b>ongoing</b>. Video work is filed as a production automatically.</p>
  </div>`);
  const foot = el(`<div class="row" style="width:100%"><button type="button" class="btn primary" data-add>Add to Work</button><button type="button" class="btn ghost" data-open>Open full editor</button></div>`);
  const m = modal({ title: "Quick capture", body, footer: foot, size: "narrow" });
  const inp = $("[data-qc]", body), prev = $("[data-qc-prev]", body);
  const paintPrev = () => { const p = parseQuick(inp.value); prev.textContent = inp.value.trim() ? `${p.kind === "production" ? "Production" : "Task"} · ${p.priority} · ${p.givenBy ? "from " + p.givenBy + " · " : ""}${p.dateMode === "none" ? "Ongoing" : p.dateMode === "day" ? dayShort(p.date) : "week of " + dmy(p.date)}${p.tags.length ? " · " + p.tags.join(", ") : ""}` : ""; };
  inp.addEventListener("input", paintPrev);
  const build = () => { const p = parseQuick(inp.value); if (!p.title) { inp.classList.add("err"); inp.focus(); return null; } return newTask(p); };
  $("[data-add]", foot).addEventListener("click", () => { const t = build(); if (!t) return; col.upsert(t); m.close(); toast(`Added “${t.title}”`); onDone?.(t); });
  $("[data-open]", foot).addEventListener("click", () => { const t = build(); if (!t) return; m.close(); openEditor(null, t); });
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("[data-add]", foot).click(); } });
}

/* ---------- lifecycle ---------- */
/* attach() lets other pages open the editor / quick capture before this page has rendered */
export function attach(c) { ctx = c; col = ctx.store.collection("tasks"); }
export function render(r, c) {
  attach(c); root = r;
  unsub?.(); unsub = col.subscribe(() => paint());
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Work</h1><div class="sub" data-sub></div></div>
      <div class="actions" data-actions></div>
    </div>
    <div class="toolbar">
      <div class="search">${icons.search}<input class="inp" type="search" placeholder="Search work…" data-q autocomplete="off"></div>
      <div class="seg" role="group" aria-label="View">
        <button type="button" data-view="list" aria-pressed="true">${icons.list}<span class="hide-mobile">List</span></button>
        <button type="button" data-view="board" aria-pressed="false">${icons.board}<span class="hide-mobile">Board</span></button>
      </div>
      <div class="seg" role="group" aria-label="Board by" data-boardby hidden>
        <button type="button" data-by="status">Status</button><button type="button" data-by="stage">Pipeline</button>
      </div>
      <button type="button" class="btn" data-toggle-filters>${icons.filter}<span>Filter</span><span class="count-badge" data-fcount hidden></span></button>
      <span class="grow"></span>
      <button type="button" class="btn ghost" data-update>${icons.copy}<span class="hide-mobile">Weekly update</span></button>
      <button type="button" class="btn ghost" data-export>${icons.print}<span class="hide-mobile">Report</span></button>
    </div>
    <div class="filters" data-filters hidden>
      <select class="inp" data-f="kind"><option value="">Tasks & productions</option><option value="task">Tasks only</option><option value="production">Productions only</option></select>
      <select class="inp" data-f="status"><option value="">Any status</option>${STATUSES.map(s => `<option>${s}</option>`).join("")}</select>
      <select class="inp" data-f="priority"><option value="">Any priority</option>${PRIORITIES.map(s => `<option>${s}</option>`).join("")}</select>
      <select class="inp" data-f="given"><option value="">Anyone</option></select>
      <select class="inp" data-f="tag"><option value="">Any tag</option></select>
      <button type="button" class="chip" data-chip="thisWeek">This week</button>
      <button type="button" class="chip" data-chip="lastWeek">Last week</button>
      <button type="button" class="chip" data-chip="thisMonth">This month</button>
      <input class="inp" type="date" data-f="from" aria-label="From"><span class="muted">→</span><input class="inp" type="date" data-f="to" aria-label="To">
      <button type="button" class="btn ghost sm" data-clear>Clear</button>
    </div>
    <div data-content></div>`;
  wire();
  paint();
}
export function unmount() { unsub?.(); unsub = null; document.removeEventListener("keydown", onKey); }

function wire() {
  const q = $("[data-q]", root);
  q.value = filters.q;
  q.addEventListener("input", debounce(() => { filters.q = q.value.trim().toLowerCase(); paint(); }, 120));
  $$("[data-view]", root).forEach(b => b.addEventListener("click", () => { view = b.dataset.view; $$("[data-view]", root).forEach(x => x.setAttribute("aria-pressed", String(x === b))); paint(); }));
  $$("[data-view]", root).forEach(x => x.setAttribute("aria-pressed", String(x.dataset.view === view)));
  $$("[data-by]", root).forEach(b => b.addEventListener("click", () => { boardBy = b.dataset.by; paint(); }));
  $("[data-toggle-filters]", root).addEventListener("click", () => { showFilters = !showFilters; $("[data-filters]", root).hidden = !showFilters; });
  $("[data-filters]", root).hidden = !showFilters;
  $$("[data-f]", root).forEach(s => { s.value = filters[s.dataset.f]; s.addEventListener("change", () => { filters[s.dataset.f] = s.value; if (s.dataset.f === "from" || s.dataset.f === "to") { filters.chip = ""; $$("[data-chip]", root).forEach(c => c.setAttribute("aria-pressed", "false")); } paint(); }); });
  $$("[data-chip]", root).forEach(c => {
    c.setAttribute("aria-pressed", String(filters.chip === c.dataset.chip));
    c.addEventListener("click", () => {
      const on = filters.chip === c.dataset.chip;
      filters.chip = on ? "" : c.dataset.chip;
      const [a, b] = on ? ["", ""] : rangeFor(c.dataset.chip);
      filters.from = a; filters.to = b; $("[data-f=from]", root).value = a; $("[data-f=to]", root).value = b;
      $$("[data-chip]", root).forEach(x => x.setAttribute("aria-pressed", String(filters.chip === x.dataset.chip)));
      paint();
    });
  });
  $("[data-clear]", root).addEventListener("click", () => { filters = { q: "", status: "", priority: "", given: "", tag: "", kind: "", from: "", to: "", chip: "" }; $$("[data-f]", root).forEach(s => s.value = ""); q.value = ""; $$("[data-chip]", root).forEach(x => x.setAttribute("aria-pressed", "false")); paint(); });
  $("[data-export]", root).addEventListener("click", openExport);
  $("[data-update]", root).addEventListener("click", openUpdate);
  $("[data-content]", root).addEventListener("click", onContentClick);
  $("[data-content]", root).addEventListener("change", onContentChange);
  document.addEventListener("keydown", onKey);
  window.matchMedia("(max-width:860px)").addEventListener?.("change", () => paint());
}
function onKey(e) {
  if (!root?.isConnected) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement?.tagName;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || document.activeElement?.isContentEditable) return;
  if ($(".scrim")) return;
  if (e.key === "/") { e.preventDefault(); $("[data-q]", root).focus(); }
  if ((e.key === "n" || e.key === "N") && ctx.auth.isOwner) { e.preventDefault(); openEditor(null); }
  if (e.key === "e" || e.key === "E") { e.preventDefault(); openExport(); }
}

/* ---------- data views ---------- */
function all() { return col.all(); }
function filtered() {
  const f = filters;
  return all().filter(t => {
    if (f.kind && (t.kind || "task") !== f.kind) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.given && t.givenBy !== f.given) return false;
    if (f.tag && !(t.tags || []).includes(f.tag)) return false;
    if (!inRange(t, f.from, f.to)) return false;
    if (f.q && !`${t.title} ${t.givenBy} ${t.assignedTo} ${t.notes} ${(t.tags || []).join(" ")} ${(t.checklist || []).map(c => c.text).join(" ")}`.toLowerCase().includes(f.q)) return false;
    return true;
  });
}
const people = () => Array.from(new Set(all().flatMap(t => [t.givenBy, t.assignedTo]).filter(Boolean))).sort();
const givers = () => Array.from(new Set(all().map(t => t.givenBy).filter(Boolean))).sort();
const allTags = () => Array.from(new Set(all().flatMap(t => t.tags || []))).sort();

/* ---------- paint ---------- */
function paint() {
  if (!root?.isConnected) return;
  const owner = ctx.auth.isOwner;
  const list = filtered();
  const open = all().filter(t => t.status !== "Completed").length;
  const [wa, wb] = rangeFor("thisWeek");
  const doneWeek = all().filter(t => t.status === "Completed" && t.completedAt && t.completedAt.slice(0, 10) >= wa && t.completedAt.slice(0, 10) <= wb).length;
  const late = all().filter(isLate).length;
  $("[data-sub]", root).innerHTML = `${open} open · ${doneWeek} completed this week${late ? ` · <span style="color:var(--bad)">${late} past due</span>` : ""}`;
  $("[data-actions]", root).innerHTML = owner ? `<button type="button" class="btn" data-quick title="Quick capture (Q)">${icons.spark}<span class="hide-mobile">Quick</span></button><button type="button" class="btn primary" data-new>${icons.plus}New</button>` : "";
  $("[data-new]", root)?.addEventListener("click", () => openEditor(null));
  $("[data-quick]", root)?.addEventListener("click", () => quickCapture());
  $("[data-boardby]", root).hidden = view !== "board";
  $("[data-update]", root).hidden = !owner;
  $$("[data-by]", root).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.by === boardBy)));

  const gs = $("[data-f=given]", root), ts = $("[data-f=tag]", root);
  const showPeople = !ctx.auth.mask("tasksPeople");
  gs.hidden = !showPeople;
  gs.innerHTML = `<option value="">Anyone</option>` + givers().map(p => `<option ${p === filters.given ? "selected" : ""}>${esc(p)}</option>`).join("");
  ts.innerHTML = `<option value="">Any tag</option>` + allTags().map(p => `<option ${p === filters.tag ? "selected" : ""}>${esc(p)}</option>`).join("");
  ts.hidden = !allTags().length;
  const n = [filters.kind, filters.status, filters.priority, filters.given, filters.tag, filters.from, filters.to].filter(Boolean).length;
  const b = $("[data-fcount]", root); b.hidden = !n; b.textContent = n;

  const content = $("[data-content]", root);
  content.innerHTML = view === "list" ? renderList(list) : renderBoard(list);
  if (view === "board" && owner) wireDrag();
}

function taskCell(t) {
  const cp = checkProgress(t);
  return `<div class="task-title"><span class="txt" data-edit>${esc(t.title)}</span>
      ${t.pinned ? `<span class="tag pin" style="margin-left:8px">Pinned</span>` : ""}${isLate(t) ? `<span class="tag late" style="margin-left:8px">Past due</span>` : ""}
      ${(t.tags || []).map(x => `<span class="tag cat" style="margin-left:6px">${esc(x)}</span>`).join("")}</div>
    <div class="task-sub">${isProd(t) ? `<span style="color:var(--sage-ink)">Production</span>` : ""}${t.dateMode === "day" && t.date ? `<span>${esc(dayShort(t.date))}</span>` : ""}
      ${cp ? `<span class="checkline"><span class="bar"><i style="width:${Math.round(cp.done / cp.total * 100)}%"></i></span>${cp.done}/${cp.total}</span>` : ""}
      ${isWaiting(t) ? `<span style="color:var(--warn)">waiting</span>` : ""}</div>`;
}
function statusControl(t, owner) {
  if (isProd(t)) {
    const stage = t.stage || (t.status === "Completed" ? "Delivered" : t.status === "In Progress" ? "Editing" : "Brief");
    return owner
      ? `<select class="inline ${stClass(t.status)}" data-stage aria-label="Stage">${STAGES.map(s => `<option ${s === stage ? "selected" : ""}>${s}</option>`).join("")}</select>`
      : `<span class="st-btn ${stClass(t.status)}" style="cursor:default"><span class="dot-st ${stClass(t.status)}"></span>${esc(stage)}</span>`;
  }
  return owner
    ? `<button type="button" class="st-btn ${stClass(t.status)}" data-cycle title="Click to move forward"><span class="dot-st ${stClass(t.status)}"></span>${esc(t.status)}</button>`
    : `<span class="st-btn ${stClass(t.status)}" style="cursor:default"><span class="dot-st ${stClass(t.status)}"></span>${esc(t.status)}</span>`;
}
function rowHTML(t) {
  const owner = ctx.auth.isOwner;
  const showNotes = !ctx.auth.mask("tasksNotes"), showPeople = !ctx.auth.mask("tasksPeople");
  const prio = owner
    ? `<select class="inline ${prClass(t.priority)}" data-priority aria-label="Priority">${PRIORITIES.map(p => `<option ${p === t.priority ? "selected" : ""}>${p}</option>`).join("")}</select>`
    : `<span class="prio ${prClass(t.priority)}"><i></i>${esc(t.priority)}</span>`;
  return `<tr data-id="${t.id}" class="${t.status === "Completed" ? "done" : ""}">
    <td style="width:36%">${taskCell(t)}</td>
    ${showPeople ? `<td class="nowrap ink2">${esc(t.givenBy || "—")}</td>` : ""}
    <td class="nw">${statusControl(t, owner)}</td>
    <td class="nw">${prio}</td>
    ${showNotes ? `<td class="hide-mobile"><div class="task-notes">${esc(t.notes || "")}</div></td>` : ""}
    <td class="r" style="width:1%">${owner ? `<div class="acts">
      <button type="button" class="icon-btn sm" data-edit title="Edit">${icons.edit}</button>
      <button type="button" class="icon-btn sm" data-more title="More">${icons.more}</button></div>` : ""}</td>
  </tr>`;
}
const isMobile = () => window.matchMedia("(max-width:860px)").matches;
function mobileRowHTML(t) {
  const owner = ctx.auth.isOwner;
  const showNotes = !ctx.auth.mask("tasksNotes"), showPeople = !ctx.auth.mask("tasksPeople");
  return `<div class="mrow ${t.status === "Completed" ? "done" : ""}" data-id="${t.id}">
    <div class="body">${taskCell(t)}
      <div class="meta">${statusControl(t, owner)}<span class="prio ${prClass(t.priority)}"><i></i>${esc(t.priority)}</span>${showPeople && t.givenBy ? `<span>· ${esc(t.givenBy)}</span>` : ""}</div>
      ${showNotes && t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ""}</div>
    ${owner ? `<button type="button" class="icon-btn sm" data-more aria-label="More">${icons.more}</button>` : ""}
  </div>`;
}
function renderList(list) {
  if (!list.length) return emptyHTML();
  const showNotes = !ctx.auth.mask("tasksNotes"), showPeople = !ctx.auth.mask("tasksPeople");
  const mobile = isMobile();
  const g = new Map();
  list.forEach(t => { const k = bandKey(t); if (!g.has(k)) g.set(k, []); g.get(k).push(t); });
  const keys = Array.from(g.keys()).sort((a, b) => a === "none" ? -1 : b === "none" ? 1 : b.localeCompare(a));
  return keys.map(k => {
    const rows = sortTasks(g.get(k));
    const done = rows.filter(t => t.status === "Completed").length;
    const pct = Math.round(done / rows.length * 100);
    const isThis = k !== "none" && k === iso(monday(new Date()));
    const head = k === "none" ? `<span class="wk">Ongoing</span><h2>No fixed week</h2>` : `<span class="wk">Week ${weekNo(parse(k))}${isThis ? " · this week" : ""}</span><h2>${esc(weekLabel(k))}</h2>`;
    return `<section class="band">
      <div class="band-h">${head}<span class="prog">${done} of ${rows.length} done</span></div>
      <div class="bar" style="margin-bottom:10px"><i style="width:${pct}%"></i></div>
      <div class="card">${mobile ? rows.map(mobileRowHTML).join("") : `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th style="min-width:240px">Task</th>${showPeople ? "<th>Given by</th>" : ""}<th>Status</th><th>Priority</th>${showNotes ? '<th class="hide-mobile">Notes</th>' : ""}<th></th></tr></thead>
        <tbody>${rows.map(rowHTML).join("")}</tbody></table></div>`}</div>
    </section>`;
  }).join("");
}
function cardHTML(t) {
  const showPeople = !ctx.auth.mask("tasksPeople");
  return `<div class="tcard ${t.status === "Completed" ? "done" : ""}" draggable="${ctx.auth.isOwner}" data-id="${t.id}" data-edit>
    <div class="ct">${esc(t.title)}</div>
    <div class="cm"><span class="prio ${prClass(t.priority)}" style="font-size:10.5px"><i></i>${esc(t.priority)}</span>${showPeople && t.givenBy ? `<span>· ${esc(t.givenBy)}</span>` : ""}<span>· ${esc(whenShort(t))}</span>${isProd(t) && boardBy === "status" ? `<span class="tag pin">${esc(t.stage || "")}</span>` : ""}${isLate(t) ? `<span class="tag late">Past due</span>` : ""}${t.pinned ? `<span class="tag pin">Pinned</span>` : ""}</div>
  </div>`;
}
function renderBoard(list) {
  if (!list.length) return emptyHTML();
  if (boardBy === "stage") {
    const prods = list.filter(isProd), others = list.length - prods.length;
    if (!prods.length) return `<div class="empty"><h3>No productions in view</h3><p>Video and content work shows up here once it's filed as a production. Tasks stay on the status board.</p></div>`;
    return `<div class="board" style="grid-template-columns:repeat(5,minmax(0,1fr))">${STAGES.map(name => {
      const rows = sortTasks(prods.filter(t => (t.stage || "Brief") === name));
      return `<div class="col" data-col="${name}"><div class="col-h"><span class="dot-st ${stClass(STAGE_STATUS[name])}"></span>${name}<span class="n">${rows.length}</span></div><div class="col-b">${rows.map(cardHTML).join("") || `<p class="hintx">—</p>`}</div></div>`;
    }).join("")}</div>${others ? `<p class="muted mt-16" style="font-size:12.5px">${others} task${others === 1 ? "" : "s"} without production stages hidden — switch to Status to see everything.</p>` : ""}`;
  }
  return `<div class="board">${STATUSES.map(name => {
    const rows = sortTasks(list.filter(t => t.status === name));
    return `<div class="col" data-col="${name}">
      <div class="col-h"><span class="dot-st ${stClass(name)}"></span>${name}<span class="n">${rows.length}</span></div>
      <div class="col-b">${rows.map(cardHTML).join("") || `<p class="hintx">Nothing here</p>`}</div>
    </div>`;
  }).join("")}</div>`;
}
function emptyHTML() {
  const any = all().length > 0;
  return `<div class="empty"><h3>${any ? "Nothing matches" : "Nothing logged yet"}</h3>
    <p>${any ? "Widen the period or clear the filters." : "Add the first task — it saves itself."}</p>
    ${any ? `<button type="button" class="btn" data-clear-all>Clear filters</button>` : (ctx.auth.isOwner ? `<button type="button" class="btn primary" data-new-empty>${icons.plus}New task</button>` : "")}</div>`;
}

/* ---------- interactions ---------- */
function onContentClick(e) {
  if (e.target.closest("[data-clear-all]")) { $("[data-clear]", root).click(); return; }
  if (e.target.closest("[data-new-empty]")) { openEditor(null); return; }
  const holder = e.target.closest("[data-id]"); if (!holder) return;
  const t = col.get(holder.dataset.id); if (!t) return;
  if (e.target.closest("[data-cycle]") && ctx.auth.isOwner) { col.upsert(applyStatus(t, STATUSES[(STATUSES.indexOf(t.status) + 1) % STATUSES.length])); return; }
  if (e.target.closest("[data-more]")) { openMenu(e.target.closest("[data-more]"), t); return; }
  if (e.target.closest("select")) return;
  if (e.target.closest("[data-edit]")) { openEditor(t.id); return; }
}
function onContentChange(e) {
  const holder = e.target.closest("[data-id]"); if (!holder || !ctx.auth.isOwner) return;
  const t = col.get(holder.dataset.id); if (!t) return;
  if (e.target.matches("[data-priority]")) { t.priority = e.target.value; t.updatedAt = nowISO(); col.upsert(t); }
  if (e.target.matches("[data-stage]")) { col.upsert(applyStage(t, e.target.value)); }
}
function openMenu(anchor, t) {
  const items = [
    { label: "Edit", icon: "edit", onClick: () => openEditor(t.id) },
    { label: t.pinned ? "Unpin" : "Pin to top", icon: "pin", onClick: () => { t.pinned = !t.pinned; t.updatedAt = nowISO(); col.upsert(t); } },
    { label: "Duplicate", icon: "copy", onClick: () => dup(t) },
    { label: "Move to next week", icon: "right", onClick: () => { if (t.dateMode === "none") { t.dateMode = "week"; t.date = iso(monday(new Date())); } t.date = iso(addDays(monday(parse(t.date)), 7)); t.updatedAt = nowISO(); col.upsert(t); toast("Moved to next week"); } },
    { label: isProd(t) ? "Make a plain task" : "Make a production", icon: "spark", onClick: () => { t.kind = isProd(t) ? "task" : "production"; if (isProd(t)) t.stage = t.status === "Completed" ? "Delivered" : t.status === "In Progress" ? "Editing" : "Brief"; else t.stage = null; t.updatedAt = nowISO(); col.upsert(t); } },
  ];
  if (t.saleId) items.push({ label: "Open sale in Ledger", icon: "ledger", onClick: () => ctx.navigate("commission") });
  items.push("-", { label: "Delete", icon: "trash", danger: true, onClick: () => del(t) });
  menu(anchor, items);
}
function del(t) {
  lastDel = t; col.remove(t.id);
  toast(`Deleted “${t.title}”`, { action: "Undo", onAction: () => { col.upsert(lastDel); lastDel = null; } });
}
function dup(t) {
  col.upsert({ ...t, id: uid(), title: t.title + " (copy)", status: "Not Started", stage: isProd(t) ? "Brief" : null, completedAt: null, saleId: null, createdAt: nowISO(), updatedAt: nowISO(), checklist: (t.checklist || []).map(c => ({ ...c, id: uid(), done: false })) });
  toast("Duplicated");
}
function wireDrag() {
  let dragId = null;
  $$(".tcard", root).forEach(c => {
    c.addEventListener("dragstart", e => { dragId = c.dataset.id; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
    c.addEventListener("dragend", () => c.classList.remove("dragging"));
  });
  $$(".col", root).forEach(colEl => {
    colEl.addEventListener("dragover", e => { e.preventDefault(); colEl.classList.add("over"); });
    colEl.addEventListener("dragleave", () => colEl.classList.remove("over"));
    colEl.addEventListener("drop", e => {
      e.preventDefault(); colEl.classList.remove("over"); const t = col.get(dragId); if (!t) return;
      if (boardBy === "stage") { if (t.stage !== colEl.dataset.col) col.upsert(applyStage(t, colEl.dataset.col)); }
      else if (t.status !== colEl.dataset.col) col.upsert(applyStatus(t, colEl.dataset.col));
    });
  });
}

/* ---------- editor ---------- */
export function openEditor(idOrNull, presets = null) {
  if (!ctx.auth.isOwner) return;
  const existing = idOrNull ? col.get(idOrNull) : null;
  const t = existing ? JSON.parse(JSON.stringify(existing)) : (presets ? { ...newTask(), ...presets } : newTask());
  let dateMode = t.dateMode || "week", kind = t.kind || "task";
  const body = el(`<div class="stack gap-16">
    <div class="field"><label for="tTitle">Title</label><input class="inp" id="tTitle" placeholder="e.g. Office walk-in video" value="${esc(t.title)}" autocomplete="off" autofocus></div>
    <div class="grid-2">
      <div class="field"><label>Type</label><div class="seg" style="display:flex;height:38px"><button type="button" data-kind="task" style="flex:1;justify-content:center">Task</button><button type="button" data-kind="production" style="flex:1;justify-content:center">Production</button></div></div>
      <div class="field" data-stage-wrap><label for="tStage">Stage</label><select class="inp" id="tStage">${STAGES.map(s => `<option ${s === (t.stage || "Brief") ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="field" data-status-wrap><label for="tStatus">Status</label><select class="inp" id="tStatus">${STATUSES.map(s => `<option ${s === t.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
    </div>
    <div class="grid-2">
      <div class="field"><label for="tGiven">Given by</label><input class="inp" id="tGiven" list="fw-people" value="${esc(t.givenBy || "")}" autocomplete="off" placeholder="Who asked for it"></div>
      <div class="field"><label for="tPriority">Priority</label><select class="inp" id="tPriority">${PRIORITIES.map(s => `<option ${s === t.priority ? "selected" : ""}>${s}</option>`).join("")}</select></div>
    </div>
    <datalist id="fw-people">${people().map(p => `<option value="${esc(p)}">`).join("")}</datalist>
    <div class="field"><label>When</label>
      <div class="card plain" style="padding:12px">
        <div class="seg sm" style="display:flex">
          <button type="button" data-mode="week" style="flex:1;justify-content:center">Week</button>
          <button type="button" data-mode="day" style="flex:1;justify-content:center">One day</button>
          <button type="button" data-mode="none" style="flex:1;justify-content:center">Ongoing</button>
        </div>
        <div class="row" data-stepper style="margin-top:10px">
          <button type="button" class="btn" data-step="-1" aria-label="Back" style="padding:0 10px">${icons.left}</button>
          <input class="inp" type="date" id="tDate" value="${esc(t.date || iso(monday(new Date())))}">
          <button type="button" class="btn" data-step="1" aria-label="Forward" style="padding:0 10px">${icons.right}</button>
        </div>
        <div class="mono muted" data-date-prev style="margin-top:8px;font-size:12px;text-align:center">—</div>
      </div>
    </div>
    <div class="grid-2">
      <div class="field"><label for="tTags">Tags</label><input class="inp" id="tTags" list="fw-tags" value="${esc((t.tags || []).join(", "))}" placeholder="Content, Podcast, Client work" autocomplete="off"><datalist id="fw-tags">${allTags().map(x => `<option value="${esc(x)}">`).join("")}</datalist></div>
      <div class="field"><label for="tAssigned">Assigned to</label><input class="inp" id="tAssigned" list="fw-people" value="${esc(t.assignedTo || "")}" autocomplete="off"></div>
    </div>
    <div class="field"><label for="tNotes">Notes</label><textarea class="inp" id="tNotes" placeholder="Blockers, who you're waiting on, what's left">${esc(t.notes || "")}</textarea></div>
    <div class="field"><label>Checklist</label>
      <div class="stack gap-4" data-checklist></div>
      <div class="row" style="margin-top:6px"><input class="inp" data-check-new placeholder="Add a step and press Enter" autocomplete="off"></div>
    </div>
    <div class="field"><label>Links</label>
      <div class="stack gap-4" data-links></div>
      <div class="row" style="margin-top:6px"><input class="inp" data-link-new placeholder="Paste a Drive / Frame.io / Notion link and press Enter" autocomplete="off"></div>
    </div>
    <label class="check"><input type="checkbox" id="tPinned" ${t.pinned ? "checked" : ""}><span>Pin to the top</span></label>
  </div>`);
  const foot = el(`<div class="row" style="width:100%">
    <button type="button" class="btn primary" data-save>${existing ? "Save changes" : "Add"}</button>
    <button type="button" class="btn ghost" data-cancel>Cancel</button>
    <span class="grow"></span>
    ${existing ? `<button type="button" class="btn danger" data-delete>Delete</button>` : ""}</div>`);

  const m = modal({ title: existing ? (isProd(t) ? "Edit production" : "Edit task") : "New work", body, footer: foot });
  const dateIn = $("#tDate", body), prev = $("[data-date-prev]", body);
  const snap = () => { if (dateMode === "week" && dateIn.value) dateIn.value = iso(monday(parse(dateIn.value))); };
  const setMode = mo => {
    dateMode = mo; $$("[data-mode]", body).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mo)));
    $("[data-stepper]", body).style.display = mo === "none" ? "none" : "flex"; snap(); paintPrev();
  };
  const paintPrev = () => {
    if (dateMode === "none") { prev.textContent = "Ongoing — no fixed date"; return; }
    if (!dateIn.value) { prev.textContent = "Pick a date"; return; }
    prev.textContent = dateMode === "week" ? `Week ${weekNo(monday(parse(dateIn.value)))} · ${weekLabel(iso(monday(parse(dateIn.value))))}` : dayLabel(dateIn.value);
  };
  const setKind = k => { kind = k; $$("[data-kind]", body).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === k))); $("[data-stage-wrap]", body).hidden = k !== "production"; $("[data-status-wrap]", body).hidden = k === "production"; };
  $$("[data-kind]", body).forEach(b => b.addEventListener("click", () => setKind(b.dataset.kind)));
  $$("[data-mode]", body).forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  $$("[data-step]", body).forEach(b => b.addEventListener("click", () => { const d = parse(dateIn.value || todayISO()); dateIn.value = iso(addDays(d, (dateMode === "week" ? 7 : 1) * Number(b.dataset.step))); snap(); paintPrev(); }));
  dateIn.addEventListener("change", () => { snap(); paintPrev(); });
  setMode(dateMode); setKind(kind);

  const clRoot = $("[data-checklist]", body);
  const paintCL = () => {
    clRoot.innerHTML = (t.checklist || []).map(c => `<label class="check" data-cid="${c.id}" style="padding:4px 0"><input type="checkbox" ${c.done ? "checked" : ""}><span style="flex:1;${c.done ? "color:var(--muted);text-decoration:line-through" : ""}">${esc(c.text)}</span><button type="button" class="icon-btn sm" data-crm aria-label="Remove">${icons.x}</button></label>`).join("");
  };
  clRoot.addEventListener("change", e => { const l = e.target.closest("[data-cid]"); const c = (t.checklist || []).find(x => x.id === l.dataset.cid); if (c) { c.done = e.target.checked; paintCL(); } });
  clRoot.addEventListener("click", e => { const b = e.target.closest("[data-crm]"); if (!b) return; e.preventDefault(); const l = b.closest("[data-cid]"); t.checklist = (t.checklist || []).filter(x => x.id !== l.dataset.cid); paintCL(); });
  const newIn = $("[data-check-new]", body);
  newIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); const v = newIn.value.trim(); if (!v) return; (t.checklist ||= []).push({ id: uid(), text: v, done: false }); newIn.value = ""; paintCL(); } });
  paintCL();

  const lkRoot = $("[data-links]", body);
  const paintLinks = () => { lkRoot.innerHTML = (t.links || []).map((u, i) => `<div class="row" data-li="${i}"><a href="${esc(u)}" target="_blank" rel="noopener" style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u)}</a><button type="button" class="icon-btn sm" data-lrm aria-label="Remove">${icons.x}</button></div>`).join(""); };
  lkRoot.addEventListener("click", e => { const b = e.target.closest("[data-lrm]"); if (!b) return; t.links.splice(Number(b.closest("[data-li]").dataset.li), 1); paintLinks(); });
  const linkIn = $("[data-link-new]", body);
  linkIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); let v = linkIn.value.trim(); if (!v) return; if (!/^https?:\/\//i.test(v)) v = "https://" + v; (t.links ||= []).push(v); linkIn.value = ""; paintLinks(); } });
  paintLinks();

  body.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA" && e.target !== newIn && e.target !== linkIn) { e.preventDefault(); save(); } });
  function save() {
    const titleV = $("#tTitle", body).value.trim();
    if (!titleV) { $("#tTitle", body).classList.add("err"); $("#tTitle", body).focus(); return; }
    const was = existing?.status;
    Object.assign(t, {
      title: titleV, kind, givenBy: $("#tGiven", body).value.trim(), assignedTo: $("#tAssigned", body).value.trim() || ctx.profile().name,
      priority: $("#tPriority", body).value, dateMode,
      date: dateMode === "none" ? null : (dateIn.value || null),
      tags: $("#tTags", body).value.split(",").map(s => s.trim()).filter(Boolean),
      notes: $("#tNotes", body).value.trim(), pinned: $("#tPinned", body).checked, updatedAt: nowISO(),
    });
    if (kind === "production") { t.stage = $("#tStage", body).value; t.status = STAGE_STATUS[t.stage]; }
    else { t.stage = null; t.status = $("#tStatus", body).value; }
    if (t.dateMode === "week" && t.date) t.date = iso(monday(parse(t.date)));
    t.completedAt = t.status === "Completed" ? (was === "Completed" ? (existing?.completedAt || nowISO()) : nowISO()) : null;
    col.upsert(t); m.close(); toast(existing ? "Saved" : "Added");
  }
  $("[data-save]", foot).addEventListener("click", save);
  $("[data-cancel]", foot).addEventListener("click", () => m.close());
  $("[data-delete]", foot)?.addEventListener("click", () => { m.close(); del(existing); });
}

/* ---------- weekly update (copy for WhatsApp / Slack) ---------- */
export function buildUpdate({ from, to, person = "", notes = true }) {
  const p = ctx.profile();
  let list = all().filter(t => inRange(t, from, to));
  if (person) list = list.filter(t => t.givenBy === person);
  const done = sortTasks(list.filter(t => t.status === "Completed"));
  const prog = sortTasks(list.filter(t => t.status === "In Progress"));
  const idle = sortTasks(list.filter(t => t.status === "Not Started"));
  const late = list.filter(isLate);
  const line = t => `• ${t.title}${isProd(t) && t.stage && t.status !== "Completed" ? ` (${t.stage.toLowerCase()})` : ""}${notes && t.notes ? ` — ${t.notes}` : ""}`;
  const period = from && to ? (from === to ? dayLabel(from) : `${dmy(from)} – ${dmy(to)}`) : "All work";
  const parts = [`Update · ${period}${person ? ` · for ${person}` : ""} — ${p.name}`, ""];
  if (done.length) parts.push(`✅ Done (${done.length})`, ...done.map(line), "");
  if (prog.length) parts.push(`🔄 In progress (${prog.length})`, ...prog.map(line), "");
  if (idle.length) parts.push(`⏳ Not started (${idle.length})`, ...idle.map(line), "");
  if (late.length) parts.push(`⚠️ Past due (${late.length})`, ...late.map(t => `• ${t.title}`), "");
  if (!list.length) parts.push("Nothing logged for this period.");
  return parts.join("\n").trim();
}
function openUpdate() {
  const [wa, wb] = rangeFor("thisWeek");
  const body = el(`<div class="stack gap-16">
    <div class="row wrap"><button type="button" class="chip" data-ur="thisWeek" aria-pressed="true">This week</button><button type="button" class="chip" data-ur="lastWeek">Last week</button><button type="button" class="chip" data-ur="thisMonth">This month</button></div>
    <div class="grid-2"><div class="field"><label>From</label><input class="inp" type="date" data-uf value="${wa}"></div><div class="field"><label>To</label><input class="inp" type="date" data-ut value="${wb}"></div></div>
    <div class="grid-2"><div class="field"><label>For</label><select class="inp" data-up><option value="">Everyone</option>${givers().map(g => `<option>${esc(g)}</option>`).join("")}</select></div>
      <div class="field"><label>Notes</label><label class="switch" style="height:38px"><input type="checkbox" data-un checked><span class="track"></span><span class="lbl">Include notes</span></label></div></div>
    <div class="field"><label>Message</label><textarea class="inp mono" data-utext style="min-height:220px;font-size:12.5px" readonly></textarea></div>
  </div>`);
  const foot = el(`<div class="row" style="width:100%"><button type="button" class="btn primary" data-copy>${icons.copy}Copy message</button><span class="grow"></span><span class="muted" style="font-size:12.5px">Paste it into WhatsApp, Slack or an email.</span></div>`);
  const m = modal({ title: "Weekly update", body, footer: foot });
  const ta = $("[data-utext]", body);
  const gen = () => { ta.value = buildUpdate({ from: $("[data-uf]", body).value, to: $("[data-ut]", body).value, person: $("[data-up]", body).value, notes: $("[data-un]", body).checked }); };
  $$("[data-ur]", body).forEach(c => c.addEventListener("click", () => { $$("[data-ur]", body).forEach(x => x.setAttribute("aria-pressed", "false")); c.setAttribute("aria-pressed", "true"); const [a, b] = rangeFor(c.dataset.ur); $("[data-uf]", body).value = a; $("[data-ut]", body).value = b; gen(); }));
  body.addEventListener("change", gen); body.addEventListener("input", gen);
  gen();
  $("[data-copy]", foot).addEventListener("click", async () => { try { await navigator.clipboard.writeText(ta.value); toast("Copied"); } catch { ta.select(); document.execCommand("copy"); toast("Copied"); } });
}

/* ---------- report / export ---------- */
function openExport() {
  const [ma, mb] = rangeFor("thisMonth");
  const body = el(`<div class="stack gap-16">
    <div class="field"><label>Period</label>
      <div class="row wrap">
        <button type="button" class="chip" data-er="thisWeek">This week</button><button type="button" class="chip" data-er="lastWeek">Last week</button>
        <button type="button" class="chip" data-er="thisMonth" aria-pressed="true">This month</button><button type="button" class="chip" data-er="lastMonth">Last month</button><button type="button" class="chip" data-er="all">Everything</button>
      </div>
      <div class="grid-2 mt-8"><div class="field"><label>From</label><input class="inp" type="date" data-ef value="${ma}"></div><div class="field"><label>To</label><input class="inp" type="date" data-et value="${mb}"></div></div>
      <p class="hint">Ongoing work is always included, listed at the end.</p></div>
    <div class="grid-2">
      <div class="field"><label>For</label><select class="inp" data-ep><option value="">Everyone</option>${givers().map(g => `<option>${esc(g)}</option>`).join("")}</select></div>
      <div class="field"><label for="eTitle">Title</label><input class="inp" id="eTitle" value="Work report"></div></div>
    <div class="field"><label>Include</label>
      <label class="check"><input type="checkbox" data-esum checked><span>Summary figures</span></label>
      <label class="check"><input type="checkbox" data-enotes ${ctx.auth.mask("tasksNotes") ? "disabled" : "checked"}><span>Notes</span></label>
      <label class="check"><input type="checkbox" data-edone><span>Completed work only</span></label></div>
  </div>`);
  const foot = el(`<div class="row wrap" style="width:100%">
    <button type="button" class="btn primary" data-pdf>${icons.print}Print / PDF</button>
    <button type="button" class="btn" data-csv>${icons.download}CSV</button></div>`);
  const m = modal({ title: "Work report", body, footer: foot });
  $$("[data-er]", body).forEach(c => c.addEventListener("click", () => {
    $$("[data-er]", body).forEach(x => x.setAttribute("aria-pressed", "false")); c.setAttribute("aria-pressed", "true");
    const [a, b] = c.dataset.er === "all" ? ["", ""] : rangeFor(c.dataset.er); $("[data-ef]", body).value = a; $("[data-et]", body).value = b;
  }));
  const set = () => {
    const from = $("[data-ef]", body).value, to = $("[data-et]", body).value, person = $("[data-ep]", body).value;
    let list = all().filter(t => inRange(t, from, to));
    if (person) list = list.filter(t => t.givenBy === person);
    if ($("[data-edone]", body).checked) list = list.filter(t => t.status === "Completed");
    return { list, from, to, person, notes: $("[data-enotes]", body).checked && !ctx.auth.mask("tasksNotes"), sum: $("[data-esum]", body).checked, title: $("#eTitle", body).value || "Work report" };
  };
  $("[data-pdf]", foot).addEventListener("click", () => { const s = set(); m.close(); printReport(s); });
  $("[data-csv]", foot).addEventListener("click", () => {
    const { list } = set();
    const c = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Title", "Type", "Stage", "Given by", "Assigned to", "Status", "Priority", "When", "Tags", "Notes", "Completed on"];
    const rows = list.map(t => [t.title, isProd(t) ? "Production" : "Task", t.stage || "", t.givenBy, t.assignedTo, t.status, t.priority, whenShort(t), (t.tags || []).join("; "), t.notes, t.completedAt ? t.completedAt.slice(0, 10) : ""].map(c).join(","));
    download(`work-${todayISO()}.csv`, "﻿" + [head.map(c).join(","), ...rows].join("\r\n"), "text/csv;charset=utf-8");
    toast("CSV downloaded");
  });
}
function printReport({ list, from, to, person, notes, sum, title }) {
  const p = ctx.profile();
  const d = list.filter(t => t.status === "Completed").length, ip = list.filter(t => t.status === "In Progress").length, ns = list.filter(t => t.status === "Not Started").length;
  const groups = new Map();
  list.forEach(t => { const k = bandKey(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
  const keys = Array.from(groups.keys()).sort((a, b) => a === "none" ? 1 : b === "none" ? -1 : a.localeCompare(b));
  const showPeople = !ctx.auth.mask("tasksPeople");
  const secs = keys.map(k => {
    const rows = sortTasks(groups.get(k)); const done = rows.filter(t => t.status === "Completed").length;
    return `<section class="sec"><h2><span>${k === "none" ? "Ongoing" : esc(weekLabel(k))}</span><em>${done} of ${rows.length} completed</em></h2>
      ${rows.map(t => `<div class="row"><div class="main"><div class="t">${esc(t.title)}</div>
        <div class="m">${isProd(t) ? "Production · " : ""}${showPeople && t.givenBy ? esc(t.givenBy) + " · " : ""}${esc(t.priority)} priority${t.dateMode === "day" && t.date ? " · " + esc(dayShort(t.date)) : ""}${(t.tags || []).length ? " · " + esc(t.tags.join(", ")) : ""}</div>
        ${notes && t.notes ? `<div class="nt">${esc(t.notes)}</div>` : ""}</div>
        <div class="st"><span class="pill ${stClass(t.status)}">${esc(isProd(t) && t.status !== "Completed" ? (t.stage || t.status) : t.status)}</span></div></div>`).join("")}</section>`;
  }).join("");
  const period = (!from && !to) ? "All recorded work" : `${from ? dayLabel(from) : "the beginning"} to ${to ? dayLabel(to) : "today"}`;
  printHTML(`
    <div class="p-head"><div><div class="p-brand">flowork<i>.</i></div><div class="p-sub">${esc(p.name)} · ${esc(p.title)}</div></div>
      <div class="p-title"><div class="t">${esc(title)}${person ? ` · for ${esc(person)}` : ""}</div><div class="d">${esc(period)} · issued ${dmy(todayISO())}</div></div></div>
    ${sum ? `<div class="p-stats"><div class="p-stat"><div class="k">Items</div><div class="v">${list.length}</div></div><div class="p-stat paid"><div class="k">Completed</div><div class="v">${d}</div></div><div class="p-stat"><div class="k">In progress</div><div class="v">${ip}</div></div><div class="p-stat"><div class="k">Not started</div><div class="v">${ns}</div></div></div>` : ""}
    ${list.length ? secs : `<p style="color:#858B84;margin-top:14pt">No work recorded in this period.</p>`}
    <div class="p-foot"><span>${esc(p.workspaceName)}</span><span>Generated ${dmy(todayISO())}</span></div>`);
}
