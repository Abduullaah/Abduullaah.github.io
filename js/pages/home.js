/* pages/home.js — Today: the call sheet. What's on, what's owed, what's waiting. */
import { $, $$, esc, icons, fmtMoney, num, countUp } from "../ui.js";
import { iso, parse, today, todayISO, addDays, addMonths, monday, weekNo, weekLabel, dayShort, dmy, rangeFor, greetingFor, relTime, DAY, DAYF, MONF, MON, monthKey, ym } from "../dates.js";
import * as work from "./tasks.js";
import * as ledger from "./commission.js";

export const id = "home";
export const title = "Today";
export const icon = "home";

let ctx, root, unsubs = [];

export function render(r, c) {
  ctx = c; root = r;
  const tasks = ctx.store.collection("tasks"), sales = ctx.store.collection("commission"), cfg = ctx.store.doc("commission");
  unsubs.forEach(u => u()); unsubs = [tasks.subscribe(paint), sales.subscribe(paint), cfg.subscribe(paint), ctx.store.settings.subscribe(paint)];
  root.innerHTML = `<div data-home></div>`;
  paint();
}
export function unmount() { unsubs.forEach(u => u()); unsubs = []; }

function paint() {
  if (!root?.isConnected) return;
  const owner = ctx.auth.isOwner, p = ctx.profile();
  const tasks = ctx.store.collection("tasks").all(), canLedger = ctx.auth.canSee("commission"), canWork = ctx.auth.canSee("tasks"), canPeople = ctx.auth.canSee("people");
  const sales = canLedger ? ctx.store.collection("commission").all() : [];
  const showPeople = !ctx.auth.mask("tasksPeople"), showNotes = !ctx.auth.mask("tasksNotes"), hideAmt = ctx.auth.mask("commissionAmounts");
  const td = today(), tdISO = todayISO(), mon = monday(td), [wa, wb] = rangeFor("thisWeek");
  const open = tasks.filter(t => t.status !== "Completed");
  const inFlight = open.filter(t => t.status === "In Progress").length;

  /* ---- call sheet groups ---- */
  const isTodayItem = t => t.status !== "Completed" && t.dateMode === "day" && t.date === tdISO;
  const late = tasks.filter(work.isLate);
  const todayItems = open.filter(isTodayItem);
  const focus = open.filter(t => !isTodayItem(t) && !work.isLate(t) && (t.pinned || (t.priority === "High" && work.inRange(t, wa, wb) && t.dateMode !== "none") || (t.dateMode === "none" && t.pinned)));
  const waiting = open.filter(t => work.isWaiting(t) && !todayItems.includes(t));
  const thisWeek = tasks.filter(t => t.dateMode === "week" && t.date === iso(mon) || (t.dateMode === "day" && t.date >= wa && t.date <= wb));
  const weekDone = thisWeek.filter(t => t.status === "Completed").length;

  const item = (t, extra = "") => `<div class="ov-item" data-task="${t.id}">
      <span class="dot-st ${work.stClass(t.status)}" style="margin-top:7px"></span>
      <div style="min-width:0"><div class="t">${esc(t.title)}${t.pinned ? ` <span class="tag pin" style="margin-left:6px">Pinned</span>` : ""}${(t.tags || []).slice(0, 2).map(x => ` <span class="tag cat" style="margin-left:4px">${esc(x)}</span>`).join("")}</div>
        <div class="m">${work.isProd(t) ? `<span style="color:var(--sage-ink)">${esc(t.stage || "Production")}</span>` : `<span>${esc(t.status)}</span>`}${showPeople && t.givenBy ? `<span>· ${esc(t.givenBy)}</span>` : ""}<span>· ${esc(work.whenShort(t))}</span>${extra}</div>
        ${showNotes && t.notes ? `<div class="task-notes" style="font-size:12.5px;margin-top:3px;color:var(--muted)">${esc(t.notes)}</div>` : ""}</div>
      <div class="side"><span class="prio ${(t.priority || "Medium").toLowerCase()}" style="font-size:11px"><i></i>${esc(t.priority)}</span></div>
    </div>`;
  const group = (label, list, cls = "") => list.length ? `<div class="eyebrow" style="padding:14px 20px 4px;${cls}">${label}</div>${list.map(t => item(t)).join("")}` : "";
  const sheetEmpty = !todayItems.length && !late.length && !focus.length && !waiting.length;

  /* ---- ledger figures ---- */
  const s = ledger.summary(sales), cfg = ledger.cfg(), cur = cfg.currency;
  const [ma, mb] = rangeFor("thisMonth");
  const monthS = ledger.summary(sales.filter(e => e.date >= ma && e.date <= mb));
  const oldest = ledger.oldestUnpaidDays(sales);
  const months = []; for (let i = 5; i >= 0; i--) { const d = addMonths(new Date(td.getFullYear(), td.getMonth(), 1), -i); months.push(monthKey(d)); }
  const byMonth = months.map(k => ledger.summary(sales.filter(e => ym(e.date) === k)).comm);
  const maxM = Math.max(1, ...byMonth);

  /* ---- year ---- */
  const y0 = `${td.getFullYear()}-01-01`;
  const doneYear = tasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) >= y0).length;
  const prodYear = tasks.filter(t => work.isProd(t) && t.completedAt && t.completedAt.slice(0, 10) >= y0).length;
  const salesYear = sales.filter(e => e.date >= y0);
  const yS = ledger.summary(salesYear);
  const weeks = []; for (let i = 25; i >= 0; i--) { const m0 = addDays(mon, -7 * i); const a = iso(m0), b = iso(addDays(m0, 6)); weeks.push({ a, b, n: tasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) >= a && t.completedAt.slice(0, 10) <= b).length }); }
  const maxW = Math.max(1, ...weeks.map(w => w.n));

  /* ---- people ---- */
  const byPerson = new Map();
  open.forEach(t => { if (t.givenBy) byPerson.set(t.givenBy, (byPerson.get(t.givenBy) || 0) + 1); });
  const topPeople = Array.from(byPerson.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  /* ---- recent ---- */
  const recent = tasks.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 5);

  $("[data-home]", root).innerHTML = `
    <div class="hero">
      <div>
        <h1 class="greet">${owner ? `${esc(greetingFor())}, <em>${esc(p.name.split(" ")[0])}</em>.` : `<em>${esc(p.name.split(" ")[0])}</em>'s desk.`}</h1>
        <div class="today"><span>${DAYF[td.getDay()]} ${td.getDate()} ${MONF[td.getMonth()]} ${td.getFullYear()}</span><span class="num muted">Week ${weekNo(td)}</span>
          <span><span class="muted">· </span>${open.length} open · ${inFlight} in flight${late.length ? ` · <span style="color:var(--bad)">${late.length} past due</span>` : ""}</span></div>
      </div>
      ${owner ? `<div class="row wrap"><button type="button" class="btn" data-quick>${icons.spark}Quick capture</button><button type="button" class="btn primary" data-sale>${icons.plus}Log a sale</button></div>` : ""}
    </div>
    <div class="ov-grid">
      <div class="stack gap-24">
        ${canWork ? `<div class="card">
          <div class="card-h"><h2>Call sheet</h2><span class="eyebrow">${esc(dayShort(tdISO))}</span></div>
          <div class="ov-list" style="padding-bottom:8px">
            ${sheetEmpty ? `<div class="tbl-empty" style="padding:34px 20px">Clear desk. Nothing due today, nothing past due, nothing pinned.${owner ? " Capture something with <b>Q</b>." : ""}</div>` : ""}
            ${group("On today", todayItems)}
            ${group("Past due", late, "color:var(--bad)")}
            ${group("Focus this week", focus)}
            ${group("Waiting on someone", waiting, "color:var(--warn)")}
          </div>
        </div>
        <div class="card">
          <div class="card-h"><h2>This week</h2><span class="muted" style="font-size:12.5px">${esc(weekLabel(iso(mon)))} · ${weekDone} of ${thisWeek.length} done</span></div>
          <div class="card-b">
            <div class="week-strip">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(mon, i), k = iso(d); const items = tasks.filter(t => t.dateMode === "day" && t.date === k); return `<div class="d ${k === tdISO ? "today" : ""}"><div class="dn">${DAY[d.getDay()]}</div><div class="dd">${d.getDate()}</div><div class="cnt">${items.slice(0, 4).map(t => `<i class="${t.status === "Completed" ? "done" : ""}"></i>`).join("")}</div></div>`; }).join("")}</div>
            <div class="bar mt-16"><i style="width:${thisWeek.length ? Math.round(weekDone / thisWeek.length * 100) : 0}%"></i></div>
            <div class="row mt-16 wrap" style="justify-content:space-between"><span class="muted" style="font-size:12.5px">${thisWeek.length - weekDone} still open this week</span><a href="#/tasks" style="font-size:13px;font-weight:500">Open Work ${icons.arrowUpRight.replace('<svg', '<svg style="display:inline;width:12px;height:12px;vertical-align:-1px"')}</a></div>
          </div>
        </div>` : ""}
        ${canWork && recent.length ? `<div class="card">
          <div class="card-h"><h2>Recently touched</h2></div>
          <div class="ov-list">${recent.map(t => `<div class="ov-item" data-task="${t.id}"><span class="dot-st ${work.stClass(t.status)}" style="margin-top:7px"></span><div style="min-width:0"><div class="t" style="font-weight:500">${esc(t.title)}</div><div class="m"><span>${esc(work.isProd(t) ? (t.stage || t.status) : t.status)}</span>${showPeople && t.givenBy ? `<span>· ${esc(t.givenBy)}</span>` : ""}</div></div><div class="side mono muted" style="font-size:11px">${esc(relTime(t.updatedAt))}</div></div>`).join("")}</div>
        </div>` : ""}
      </div>
      <div class="stack gap-24">
        ${canLedger ? `<div class="card">
          <div class="card-h"><h2>Ledger</h2><a href="#/commission" style="font-size:13px;font-weight:500">Open</a></div>
          <div class="card-b">
            ${hideAmt ? `<div class="stat" style="padding:0"><div class="k">Sales logged</div><div class="v">${s.count}</div></div>` : `
            <div class="row" style="align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap">
              <div><div class="eyebrow">Balance due to me</div><div class="serif" style="font-size:40px;line-height:1.05;margin-top:6px;color:var(--pending);font-variant-numeric:tabular-nums"><span class="mono" style="font-size:12px;color:var(--muted);letter-spacing:.06em;vertical-align:middle;margin-right:6px">${esc(cur)}</span><span data-count="${s.due}">${fmtMoney(s.due)}</span></div>
                <div class="muted" style="font-size:12.5px;margin-top:6px">${oldest ? `oldest unpaid ${oldest} day${oldest === 1 ? "" : "s"}` : (s.due ? "" : "all settled")}</div></div>
              <div class="right"><div class="eyebrow">This month</div><div class="serif" style="font-size:24px;margin-top:6px">${esc(cur)} ${fmtMoney(monthS.comm)}</div><div class="muted" style="font-size:12px">${monthS.count} sale${monthS.count === 1 ? "" : "s"}</div></div>
            </div>
            <div class="divider" style="margin:16px 0"></div>
            <div class="eyebrow mb-8">Commission · last 6 months</div>
            <div class="spark">${byMonth.map((v, i) => `<div class="b ${i === 5 ? "cur" : ""}" style="height:${Math.max(4, Math.round(v / maxM * 56))}px" title="${esc(cur)} ${fmtMoney(v)}"></div>`).join("")}</div>
            <div class="spark-lbl">${months.map(k => `<span>${MON[Number(k.slice(5)) - 1]}</span>`).join("")}</div>`}
          </div>
        </div>` : ""}
        <div class="card">
          <div class="card-h"><h2>${td.getFullYear()} so far</h2></div>
          <div class="card-b">
            <div class="grid-2" style="gap:12px">
              ${canWork ? `<div><div class="eyebrow">Completed</div><div class="serif" style="font-size:28px;margin-top:4px">${doneYear}</div></div>
              <div><div class="eyebrow">Delivered productions</div><div class="serif" style="font-size:28px;margin-top:4px">${prodYear}</div></div>` : ""}
              ${canLedger && !hideAmt ? `<div><div class="eyebrow">Sales</div><div class="serif" style="font-size:28px;margin-top:4px">${yS.count}</div></div>
              <div><div class="eyebrow">Commission</div><div class="serif" style="font-size:28px;margin-top:4px">${esc(cur)} ${fmtMoney(yS.comm)}</div></div>` : ""}
            </div>
            ${canWork ? `<div class="divider" style="margin:16px 0"></div>
            <div class="eyebrow mb-8">Completed per week · last 26 weeks</div>
            <div class="heat">${weeks.map(w => `<i style="opacity:${w.n ? 0.25 + 0.75 * (w.n / maxW) : 0.08}" title="${esc(dmy(w.a))} – ${esc(dmy(w.b))}: ${w.n} done"></i>`).join("")}</div>` : ""}
          </div>
        </div>
        ${canWork && showPeople && topPeople.length ? `<div class="card">
          <div class="card-h"><h2>Open work by person</h2>${canPeople ? `<a href="#/people" style="font-size:13px;font-weight:500">People</a>` : ""}</div>
          <div class="ov-list">${topPeople.map(([n, c2]) => `<div class="ov-item" data-person="${esc(n)}"><div class="t" style="font-weight:500">${esc(n)}</div><div class="side mono muted" style="font-size:12px">${c2} open</div></div>`).join("")}</div>
        </div>` : ""}
        ${!canWork && !canLedger ? `<div class="card"><div class="card-b muted">Nothing is shared here yet.</div></div>` : ""}
      </div>
    </div>`;
  $$("[data-count]", root).forEach(n => countUp(n, num(n.dataset.count), fmtMoney, 500));
  $("[data-quick]", root)?.addEventListener("click", () => work.quickCapture());
  $("[data-sale]", root)?.addEventListener("click", () => ledger.openEditor(null));
  $$("[data-task]", root).forEach(n => n.addEventListener("click", () => { if (owner) work.openEditor(n.dataset.task); else ctx.navigate("tasks"); }));
  $$("[data-person]", root).forEach(n => n.addEventListener("click", () => { location.hash = "/people?p=" + encodeURIComponent(n.dataset.person); }));
}
