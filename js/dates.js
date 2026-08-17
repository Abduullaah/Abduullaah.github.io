/* dates.js — local-date helpers (ISO yyyy-mm-dd strings in, no timezone drift) */

export const MON  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const MONF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const DAY  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const DAYF = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const parse = s => { if (!s) return null; const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
export const today = () => { const t = new Date(); t.setHours(0,0,0,0); return t; };
export const todayISO = () => iso(today());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
export const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth()+n); return x; };
export function monday(d){ const x = new Date(d); x.setDate(x.getDate() - ((x.getDay()+6)%7)); x.setHours(0,0,0,0); return x; }
export function weekNo(d){ const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate()+3-((t.getDay()+6)%7)); const f = new Date(t.getFullYear(),0,4); return 1+Math.round(((t-f)/864e5-3+((f.getDay()+6)%7))/7); }

export const dmy = s => { const d = parse(s); return d ? `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : ""; };
export const dm  = s => { const d = parse(s); return d ? `${d.getDate()} ${MON[d.getMonth()]}` : ""; };
export const dayLabel = s => { const d = parse(s); return d ? `${DAY[d.getDay()]} ${d.getDate()} ${MONF[d.getMonth()]} ${d.getFullYear()}` : ""; };
export const dayShort = s => { const d = parse(s); return d ? `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` : ""; };
export const monthLabel = ym => { const [y,m] = ym.split("-").map(Number); return `${MONF[m-1]} ${y}`; };
export const ym = s => (s || "").slice(0,7);
export const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

export function weekLabel(mondayISO){
  const a = parse(mondayISO), b = addDays(a, 4);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONF[a.getMonth()]} ${b.getFullYear()}`;
  return `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear()}`;
}
export function weekShort(mondayISO){
  const a = parse(mondayISO), b = addDays(a, 4);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MON[a.getMonth()]}` : `${a.getDate()} ${MON[a.getMonth()]}–${b.getDate()} ${MON[b.getMonth()]}`;
}
export function rangeFor(name){
  const t = today(), m = monday(t);
  if (name === "thisWeek")  return [iso(m), iso(addDays(m,6))];
  if (name === "lastWeek")  return [iso(addDays(m,-7)), iso(addDays(m,-1))];
  if (name === "thisMonth") return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(new Date(t.getFullYear(), t.getMonth()+1, 0))];
  if (name === "lastMonth") return [iso(new Date(t.getFullYear(), t.getMonth()-1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
  if (name === "thisYear")  return [iso(new Date(t.getFullYear(),0,1)), iso(new Date(t.getFullYear(),11,31))];
  return ["",""];
}
export function relTime(isoTs){
  if (!isoTs) return "";
  const diff = (Date.now() - new Date(isoTs).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff/60)} min ago`;
  if (diff < 86400) return `${Math.round(diff/3600)} h ago`;
  const d = Math.round(diff/86400);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return dmy(isoTs.slice(0,10));
}
export function greetingFor(d = new Date()){
  const h = d.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
