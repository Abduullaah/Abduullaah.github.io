/* pages/home.js — Home: a mini preview of everything, and a way into each tab. */
import { $, $$, esc, icons, fmtMoney, num, countUp } from "../ui.js";
import { iso, today, todayISO, addDays, addMonths, monday, weekNo, weekLabel, dayShort, rangeFor, greetingFor, DAY, DAYF, MONF, MON, monthKey, ym } from "../dates.js";
import * as work from "./tasks.js";
import * as ledger from "./commission.js";
import * as shoots from "./sessions.js";

export const id = "home";
export const title = "Home";
export const icon = "home";

let ctx, root, unsubs = [];

export function render(r, c) {
  ctx = c; root = r;
  const tasks = ctx.store.collection("tasks"), sales = ctx.store.collection("commission"), cfg = ctx.store.doc("commission"), sess = ctx.store.collection("sessions");
  unsubs.forEach(u => u()); unsubs = [tasks.subscribe(paint), sales.subscribe(paint), cfg.subscribe(paint), sess.subscribe(paint), ctx.store.settings.subscribe(paint)];
  root.innerHTML = `<div data-home></div>`;
  paint();
}
export function unmount() { unsubs.forEach(u => u()); unsubs = []; }

function paint() {
  if (!root?.isConnected) return;
  const owner = ctx.auth.isOwner, p = ctx.profile();
  const canWork = ctx.auth.canSee("tasks"), canLedger = ctx.auth.canSee("commission"), canSess = ctx.auth.canSee("sessions");
  const showPeople = !ctx.auth.mask("tasksPeople"), showNotes = !ctx.auth.mask("tasksNotes"), hideAmt = ctx.auth.mask("commissionAmounts");
  const tasks = canWork ? ctx.store.collection("tasks").all() : [];
  const sales = canLedger ? ctx.store.collection("commission").all() : [];
  const sessions = canSess ? ctx.store.collection("sessions").all() : [];
  const td = today(), tdISO = todayISO(), mon = monday(td), [wa, wb] = rangeFor("thisWeek");

  /* ---- tasks ---- */
  const open = tasks.filter(t => t.status !== "Completed");
  const late = tasks.filter(work.isLate);
  const doneWeek = tasks.filter(t => t.status === "Completed" && t.completedAt && t.completedAt.slice(0, 10) >= wa && t.completedAt.slice(0, 10) <= wb);
  const isToday = t => t.status !== "Completed" && t.dateMode === "day" && t.date === tdISO;
  /* what matters right now: today first, then past due, then pinned / high this week */
  const focus = [
    ...open.filter(isToday),
    ...late.filter(t => !isToday(t)),
    ...open.filter(t => !isToday(t) && !work.isLate(t) && (t.pinned || (t.priority === "High" && t.dateMode !== "none" && work.inRange(t, wa, wb)))),
  ].slice(0, 6);
  const thisWeek = tasks.filter(t => (t.dateMode === "week" && t.date === iso(mon)) || (t.dateMode === "day" && t.date >= wa && t.date <= wb));
  const weekDone = thisWeek.filter(t => t.status === "Completed").length;

  /* ---- commission ---- */
  const s = ledger.summary(sales), cur = ledger.cfg().currency;
  const [ma, mb] = rangeFor("thisMonth");
  const monthS = ledger.summary(sales.filter(e => e.date >= ma && e.date <= mb));
  const oldest = ledger.oldestUnpaidDays(sales);
  const months = []; for (let i = 5; i >= 0; i--) months.push(monthKey(addMonths(new Date(td.getFullYear(), td.getMonth(), 1), -i)));
  const byMonth = months.map(k => ledger.summary(sales.filter(e => ym(e.date) === k)).comm);
  const maxM = Math.max(1, ...byMonth);
  const y0 = `${td.getFullYear()}-01-01`;
  const yS = ledger.summary(sales.filter(e => e.date >= y0));
  const doneYear = tasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) >= y0).length;

  /* ---- sessions ---- */
  const sMonth = shoots.totals(sessions.filter(x => x.date >= ma && x.date <= mb));
  const sYear = shoots.totals(sessions.filter(x => x.date >= y0));
  const recent = sessions.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 4);

  const stat = (k, v, cls = "", d = "") => `<div class="stat ${cls}"><div class="k">${k}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ""}</div>`;
  const line = t => `<div class="ov-item" data-task="${t.id}">
      <span class="dot-st ${work.stClass(t.status)}" style="margin-top:7px"></span>
      <div style="min-width:0"><div class="t">${esc(t.title)}${work.isLate(t) ? ` <span class="tag late" style="margin-left:6px">Past due</span>` : ""}${t.pinned ? ` <span class="tag pin" style="margin-left:6px">Pinned</span>` : ""}</div>
        <div class="m">${work.isProd(t) ? `<span style="color:var(--sage-ink)">${esc(t.stage || "Production")}</span>` : `<span>${esc(t.status)}</span>`}${showPeople && t.givenBy ? `<span>· ${esc(t.givenBy)}</span>` : ""}<span>· ${esc(work.whenShort(t))}</span></div>
        ${showNotes && t.notes ? `<div class="muted" style="font-size:12.5px;margin-top:3px">${esc(t.notes)}</div>` : ""}</div>
      <div class="side"><span class="prio ${(t.priority || "Medium").toLowerCase()}" style="font-size:11px"><i></i>${esc(t.priority)}</span></div>
    </div>`;

  $("[data-home]", root).innerHTML = `
    <div class="hero">
      <div>
        <h1 class="greet">${owner ? `${esc(greetingFor())}, <em>${esc(p.name.split(" ")[0])}</em>.` : `<em>${esc(p.name.split(" ")[0])}</em>'s desk.`}</h1>
        <div class="today"><span>${DAYF[td.getDay()]} ${td.getDate()} ${MONF[td.getMonth()]} ${td.getFullYear()}</span><span class="num muted">Week ${weekNo(td)}</span></div>
      </div>
      ${owner ? `<div class="row wrap"><button type="button" class="btn" data-newtask>${icons.plus}New task</button>${canSess ? `<button type="button" class="btn" data-session>${icons.plus}Log a session</button>` : ""}${canLedger ? `<button type="button" class="btn primary" data-sale>${icons.plus}Log a sale</button>` : ""}</div>` : ""}
    </div>

    <div class="stats">
      ${canWork ? stat("Open", open.length, "", `${open.filter(t => t.status === "In Progress").length} in flight`) : ""}
      ${canWork ? stat("Past due", late.length, late.length ? "emph" : "") : ""}
      ${canWork ? stat("Done this week", doneWeek.length, "good", `${doneYear} this year`) : ""}
      ${canLedger && !hideAmt ? stat("Balance due", `<small>${esc(cur)}</small><span data-count="${s.due}">${fmtMoney(s.due)}</span>`, "accent", oldest ? `oldest ${oldest} day${oldest === 1 ? "" : "s"}` : "all settled") : ""}
      ${canLedger && !hideAmt ? stat("Earned this month", `<small>${esc(cur)}</small>${fmtMoney(monthS.comm)}`, "", `${yS.count} sale${yS.count === 1 ? "" : "s"} this year`) : ""}
      ${canLedger && hideAmt ? stat("Sales logged", s.count) : ""}
      ${canSess ? stat("Sessions this month", sMonth.count, "", `${shoots.hrs(sMonth.hours)} · ${sMonth.edited} with editing`) : ""}
    </div>

    <div class="ov-grid mt-24">
      ${canWork ? `<div class="card">
        <div class="card-h"><h2>What's on</h2><a href="#/tasks">Open Tasks</a></div>
        <div class="ov-list">${focus.length ? focus.map(line).join("") : `<div class="tbl-empty" style="padding:32px 20px">Clear desk — nothing due today, nothing past due.</div>`}</div>
      </div>` : ""}
      <div class="stack gap-24">
        ${canLedger ? `<div class="card">
          <div class="card-h"><h2>Commission</h2><a href="#/commission">Open</a></div>
          <div class="card-b">
            ${hideAmt ? `<div class="stat" style="padding:0"><div class="k">Sales logged</div><div class="v">${s.count}</div></div>` : `
            <div class="eyebrow">Balance due to me</div>
            <div class="serif" style="font-size:38px;line-height:1.05;margin-top:6px;color:var(--pending);font-variant-numeric:tabular-nums">
              <span class="mono" style="font-size:12px;color:var(--muted);letter-spacing:.06em;vertical-align:middle;margin-right:6px">${esc(cur)}</span>${fmtMoney(s.due)}</div>
            <div class="row wrap mt-16" style="gap:20px">
              <div><div class="eyebrow">Earned</div><div class="mono" style="margin-top:3px">${esc(cur)} ${fmtMoney(s.comm)}</div></div>
              <div><div class="eyebrow">Paid out</div><div class="mono" style="margin-top:3px;color:var(--good)">${esc(cur)} ${fmtMoney(s.paid)}</div></div>
            </div>
            <div class="divider" style="margin:16px 0"></div>
            <div class="eyebrow mb-8">Last 6 months</div>
            <div class="spark">${byMonth.map((v, i) => `<div class="b ${i === 5 ? "cur" : ""}" style="height:${Math.max(4, Math.round(v / maxM * 56))}px" title="${esc(cur)} ${fmtMoney(v)}"></div>`).join("")}</div>
            <div class="spark-lbl">${months.map(k => `<span>${MON[Number(k.slice(5)) - 1]}</span>`).join("")}</div>`}
          </div>
        </div>` : ""}
        ${canSess ? `<div class="card">
          <div class="card-h"><h2>Sessions</h2><a href="#/sessions">Open</a></div>
          <div class="card-b">
            <div class="row wrap" style="gap:20px">
              <div><div class="eyebrow">This month</div><div class="serif" style="font-size:28px;line-height:1.05;margin-top:4px">${sMonth.count}<span class="mono muted" style="font-size:12px;margin-left:6px">${esc(shoots.hrs(sMonth.hours))}</span></div></div>
              <div><div class="eyebrow">This year</div><div class="serif" style="font-size:28px;line-height:1.05;margin-top:4px">${sYear.count}<span class="mono muted" style="font-size:12px;margin-left:6px">${esc(shoots.hrs(sYear.hours))}</span></div></div>
            </div>
            ${recent.length ? `<div class="divider" style="margin:16px 0"></div><div class="eyebrow mb-8">Latest shoots</div>${recent.map(x => `<div class="row" style="justify-content:space-between;gap:12px;padding:5px 0;font-size:13px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ctx.auth.mask("sessionsClients") ? "Client" : esc(x.client || "—")}<span class="muted"> · ${esc(x.location || "—")}</span></span><span class="mono muted" style="font-size:11.5px;white-space:nowrap">${esc(shoots.hrs(x.hours))} · ${esc(dayShort(x.date))}</span></div>`).join("")}` : `<div class="muted mt-16" style="font-size:13px">No sessions logged yet.</div>`}
          </div>
        </div>` : ""}
        ${canWork ? `<div class="card">
          <div class="card-h"><h2>This week</h2><span class="muted" style="font-size:12.5px">${weekDone} of ${thisWeek.length} done</span></div>
          <div class="card-b">
            <div class="week-strip">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = addDays(mon, i), k = iso(d); const items = tasks.filter(t => t.dateMode === "day" && t.date === k); return `<div class="d ${k === tdISO ? "today" : ""}"><div class="dn">${DAY[d.getDay()]}</div><div class="dd">${d.getDate()}</div><div class="cnt">${items.slice(0, 4).map(t => `<i class="${t.status === "Completed" ? "done" : ""}"></i>`).join("")}</div></div>`; }).join("")}</div>
            <div class="bar mt-16"><i style="width:${thisWeek.length ? Math.round(weekDone / thisWeek.length * 100) : 0}%"></i></div>
            <div class="muted mt-8" style="font-size:12.5px">${esc(weekLabel(iso(mon)))}</div>
          </div>
        </div>` : ""}
      </div>
    </div>
    ${!canWork && !canLedger && !canSess ? `<div class="card"><div class="card-b muted">Nothing is shared here yet.</div></div>` : ""}`;

  $$("[data-count]", root).forEach(n => countUp(n, num(n.dataset.count), fmtMoney, 500));
  $("[data-newtask]", root)?.addEventListener("click", () => work.openEditor(null));
  $("[data-sale]", root)?.addEventListener("click", () => ledger.openEditor(null));
  $("[data-session]", root)?.addEventListener("click", () => shoots.openEditor(null));
  $$("[data-task]", root).forEach(n => n.addEventListener("click", () => { if (owner) work.openEditor(n.dataset.task); else ctx.navigate("tasks"); }));
}
