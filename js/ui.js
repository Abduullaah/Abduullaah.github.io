/* ui.js — tiny DOM + formatting helpers shared by every page */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const nowISO = () => new Date().toISOString();

export const num = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
export const fmtMoney = (v, digits = 2) => num(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
export const fmtInt = v => Math.round(num(v)).toLocaleString("en-US");
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Build an element from an HTML string (first element) */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ---------- icons (inline, 16px viewBox) ---------- */
const P = (d, extra = "") => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icons = {
  home:      P('<path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z"/><path d="M6.5 13.5V9.5h3v4"/>'),
  tasks:     P('<path d="M3 4.5h1.5M6.5 4.5H13M3 8h1.5M6.5 8H13M3 11.5h1.5M6.5 11.5H13"/>'),
  ledger:    P('<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 6h6M5 8.5h6M5 11h3.5"/>'),
  settings:  P('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/>'),
  lock:      P('<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
  unlock:    P('<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 4.9-.7"/>'),
  eye:       P('<path d="M1.8 8s2.2-4 6.2-4 6.2 4 6.2 4-2.2 4-6.2 4S1.8 8 1.8 8z"/><circle cx="8" cy="8" r="1.8"/>'),
  eyeOff:    P('<path d="M2.5 2.5l11 11M6.4 6.5a2 2 0 0 0 2.9 2.8M4.3 4.5C2.6 5.6 1.8 8 1.8 8s2.2 4 6.2 4c1.2 0 2.2-.3 3-.8M7 4.1c.3 0 .7-.1 1-.1 4 0 6.2 4 6.2 4s-.6 1.1-1.7 2.2"/>'),
  sun:       P('<circle cx="8" cy="8" r="2.6"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>'),
  moon:      P('<path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z"/>'),
  plus:      P('<path d="M8 3v10M3 8h10"/>', 'stroke-width="1.8"'),
  x:         P('<path d="M4 4l8 8M12 4l-8 8"/>'),
  check:     P('<path d="M3 8.5l3 3 7-7"/>', 'stroke-width="1.8"'),
  search:    P('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>'),
  filter:    P('<path d="M2.5 4h11M4.5 8h7M6.5 12h3"/>'),
  more:      P('<circle cx="3.5" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12.5" cy="8" r="1"/>', 'fill="currentColor"'),
  edit:      P('<path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z"/>'),
  copy:      P('<rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>'),
  trash:     P('<path d="M3 4.5h10M6.5 4V2.8h3V4M5 4.5l.6 8.2a1 1 0 0 0 1 .9h2.8a1 1 0 0 0 1-.9L11 4.5"/>'),
  pin:       P('<path d="M9.5 2.5l4 4-1.5 1.5-.5-.5L8 11l-.5 2.5-4-4L1 8.5 3.5 8 7 4.5l-.5-.5z"/><path d="M6.5 9.5 3 13"/>'),
  download:  P('<path d="M8 2.5v8M5 7.5l3 3 3-3M3 13.5h10"/>'),
  upload:    P('<path d="M8 10.5v-8M5 5.5l3-3 3 3M3 13.5h10"/>'),
  print:     P('<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 7.5v4h-2"/><rect x="4.5" y="9.5" width="7" height="4"/>'),
  left:      P('<path d="M10 3 5 8l5 5"/>'),
  right:     P('<path d="M6 3l5 5-5 5"/>'),
  back:      P('<path d="M12 8H4M7.5 4.5 4 8l3.5 3.5"/>'),
  cloud:     P('<path d="M4.5 12.5a3 3 0 0 1-.4-6A4 4 0 0 1 12 7a2.75 2.75 0 0 1 .5 5.5z"/>'),
  cloudOff:  P('<path d="M2.5 2.5l11 11M4.5 12.5a3 3 0 0 1-.4-6c.1-.4.2-.8.4-1.1M7 3.3A4 4 0 0 1 12 7a2.75 2.75 0 0 1 2 4.5"/>'),
  refresh:   P('<path d="M13 8a5 5 0 0 1-8.7 3.4M3 8a5 5 0 0 1 8.7-3.4M11.5 2v3h-3M4.5 14v-3h3"/>'),
  calendar:  P('<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/>'),
  user:      P('<circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4"/>'),
  info:      P('<circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.2"/>'),
  warn:      P('<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.3v.2"/>'),
  key:       P('<circle cx="5.5" cy="10.5" r="3"/><path d="M7.6 8.4 13.5 2.5M11 5l1.5 1.5M9.5 6.5 11 8"/>'),
  grid:      P('<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>'),
  list:      P('<path d="M3 4.5h10M3 8h10M3 11.5h10"/>'),
  board:     P('<rect x="2.5" y="2.5" width="3.2" height="11" rx="1"/><rect x="6.9" y="2.5" width="3.2" height="7" rx="1"/><rect x="11.3" y="2.5" width="2.2" height="9" rx="1"/>'),
  arrowUpRight: P('<path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10"/>'),
  spark:     P('<path d="M2 12l3.5-4 2.5 2.5L14 4"/>'),
  logout:    P('<path d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11l3-3-3-3M13.5 8H6.5"/>'),
  share:     P('<circle cx="12" cy="3.5" r="1.7"/><circle cx="4" cy="8" r="1.7"/><circle cx="12" cy="12.5" r="1.7"/><path d="M5.5 7.2 10.5 4.3M5.5 8.8l5 2.9"/>'),
  drag:      P('<circle cx="6" cy="4" r=".9"/><circle cx="10" cy="4" r=".9"/><circle cx="6" cy="8" r=".9"/><circle cx="10" cy="8" r=".9"/><circle cx="6" cy="12" r=".9"/><circle cx="10" cy="12" r=".9"/>', 'fill="currentColor"'),
};

/* ---------- toasts ---------- */
let toastRoot = null;
export function toast(msg, opts = {}) {
  if (!toastRoot) { toastRoot = el('<div class="toasts" aria-live="polite"></div>'); document.body.appendChild(toastRoot); }
  const t = el(`<div class="toast${opts.error ? " err" : ""}"><span>${esc(msg)}</span></div>`);
  if (opts.action) {
    const b = el(`<button type="button">${esc(opts.action)}</button>`);
    b.addEventListener("click", () => { opts.onAction?.(); t.remove(); });
    t.appendChild(b);
  }
  toastRoot.appendChild(t);
  setTimeout(() => t.remove(), opts.duration || (opts.action ? 7000 : 2600));
  return t;
}

/* ---------- modal ----------
   modal({title, body(html|element), footer(html|element), size, onOpen(root), onClose}) => {root, close}
*/
let openModals = [];
export function modal({ title, body, footer, size = "", onOpen, onClose, closeOnScrim = true }) {
  const scrim = el(`<div class="scrim" role="presentation"></div>`);
  const m = el(`<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title || "Dialog")}">
    <div class="m-h"><h2>${esc(title || "")}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icons.x}</button></div>
    <div class="m-b"></div>
    ${footer !== undefined ? `<div class="m-f"></div>` : ""}
  </div>`);
  const b = $(".m-b", m);
  if (typeof body === "string") b.innerHTML = body; else if (body) b.appendChild(body);
  if (footer !== undefined) { const f = $(".m-f", m); if (typeof footer === "string") f.innerHTML = footer; else if (footer) f.appendChild(footer); }
  scrim.appendChild(m);
  document.body.appendChild(scrim);
  const prevFocus = document.activeElement;
  function close(result) {
    if (!scrim.isConnected) return;
    scrim.remove();
    openModals = openModals.filter(x => x !== api);
    onClose?.(result);
    prevFocus?.focus?.();
  }
  const api = { root: m, scrim, close };
  openModals.push(api);
  $("[data-close]", m).addEventListener("click", () => close());
  if (closeOnScrim) scrim.addEventListener("mousedown", e => { if (e.target === scrim) close(); });
  onOpen?.(m, api);
  setTimeout(() => { const f = m.querySelector("[autofocus], input:not([type=hidden]), select, textarea, button.primary"); f?.focus?.(); }, 30);
  return api;
}
export function closeTopModal() { const t = openModals[openModals.length - 1]; if (t) { t.close(); return true; } return false; }
if (typeof document !== "undefined") document.addEventListener("keydown", e => { if (e.key === "Escape") closeTopModal(); });

/* confirm dialog → Promise<boolean> */
export function confirmDialog({ title = "Are you sure?", text = "", ok = "Confirm", danger = false }) {
  return new Promise(resolve => {
    let done = false;
    const foot = el(`<div class="row grow" style="justify-content:flex-end;width:100%">
      <button type="button" class="btn ghost" data-no>Cancel</button>
      <button type="button" class="btn ${danger ? "danger" : "primary"}" data-yes autofocus>${esc(ok)}</button></div>`);
    const m = modal({ title, body: `<p class="ink2">${esc(text)}</p>`, footer: foot, size: "narrow", onClose: () => { if (!done) resolve(false); } });
    $("[data-yes]", foot).addEventListener("click", () => { done = true; m.close(); resolve(true); });
    $("[data-no]", foot).addEventListener("click", () => { done = true; m.close(); resolve(false); });
  });
}

/* ---------- lightweight dropdown menu ---------- */
export function menu(anchor, items) {
  closeMenus();
  const m = el(`<div class="menu" role="menu"></div>`);
  items.forEach(it => {
    if (it === "-") { m.appendChild(el("<hr>")); return; }
    const b = el(`<button type="button" role="menuitem" class="${it.danger ? "danger" : ""}">${it.icon ? icons[it.icon] || "" : ""}<span>${esc(it.label)}</span></button>`);
    b.addEventListener("click", () => { closeMenus(); it.onClick?.(); });
    m.appendChild(b);
  });
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = r.right - mw + window.scrollX, top = r.bottom + 6 + window.scrollY;
  if (left < 8) left = 8;
  if (r.bottom + mh + 12 > window.innerHeight) top = r.top - mh - 6 + window.scrollY;
  m.style.left = left + "px"; m.style.top = top + "px";
  const off = e => { if (!m.contains(e.target)) closeMenus(); };
  setTimeout(() => document.addEventListener("mousedown", off, { once: true }), 0);
  m._off = off;
  return m;
}
export function closeMenus() { $$(".menu").forEach(m => { document.removeEventListener("mousedown", m._off); m.remove(); }); }

/* ---------- download helper ---------- */
export function download(name, content, type = "application/json") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}

/* ---------- print helper: render html into #print-root and print ---------- */
export function printHTML(html) {
  let root = $("#print-root");
  if (!root) { root = el('<div id="print-root"></div>'); document.body.appendChild(root); }
  root.innerHTML = html;
  setTimeout(() => window.print(), 120);
}

/* debounce */
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* count-up animation for stat values (respects reduced motion) */
export function countUp(elm, to, fmt = fmtMoney, ms = 600) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !Number.isFinite(to)) { elm.textContent = fmt(to); return; }
  const start = performance.now();
  const from = 0;
  function tick(t) {
    const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3);
    elm.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
