/* migrate.js — converts the two original trackers (Task Ledger + Commission Tracker) into workspace format. */
import { uid } from "./ui.js";

const PROD_RE = /\b(video|reel|edit|editing|podcast|shoot|film|footage|cut|clip|episode|trailer|teaser|animation)\b/i;
const STAGE_FOR = { "Not Started": "Brief", "In Progress": "Editing", "Completed": "Delivered" };

export function isLegacyTasks(d) { return d && Array.isArray(d.tasks) && !d.app; }
export function isLegacyCommission(d) { return d && Array.isArray(d.rows) && !d.app; }

export function convertLegacyTasks(d) {
  const tasks = (d.tasks || []).map(t => {
    let title = String(t.title || "").trim(), tags = [];
    const m = title.match(/^([A-Za-z][\w ]{1,20}):\s+(.+)$/);        // "Content: Folder Video" → tag Content
    if (m && m[1].length <= 20) { tags.push(m[1].trim()); title = m[2].trim(); }
    const prod = PROD_RE.test(title) || tags.some(x => /content|video|podcast/i.test(x));
    return {
      id: t.id || uid(), title, kind: prod ? "production" : "task", stage: prod ? STAGE_FOR[t.status] || "Brief" : null,
      givenBy: t.givenBy || "", assignedTo: t.assignedTo || d.owner || "Abdullah",
      status: ["Not Started", "In Progress", "Completed"].includes(t.status) ? t.status : "Not Started",
      priority: ["High", "Medium", "Low"].includes(t.priority) ? t.priority : "Medium",
      dateMode: t.dateMode || (t.date ? "week" : "none"), date: t.date || null,
      notes: t.notes || "", tags, checklist: [], links: [], pinned: !!t.pinned, saleId: null,
      createdAt: t.createdAt || new Date().toISOString(), updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
      completedAt: t.completedAt || null,
    };
  });
  return { app: "flowork-workspace", version: 1, exportedAt: new Date().toISOString(), settings: d.owner ? { profile: { name: d.owner } } : {}, docs: {}, collections: { tasks } };
}

export function convertLegacyCommission(d) {
  const rate = Number(d.commission) || 20;
  const cfg = {
    rate, currency: d.currency || "AED", serviceLine: d.serviceLine || "Editing Services",
    packages: (d.packages || []).map(p => ({ id: uid(), name: p.name, price: Number(p.price) || 0, deliverables: [] })),
    addons: (d.addons || []).map(p => ({ id: uid(), name: p.name, price: Number(p.price) || 0 })),
  };
  const entries = (d.rows || []).map(r => {
    const lines = [];
    if (r.pkg) lines.push({ id: uid(), kind: "package", name: r.pkg, qty: Number(r.pkgQty) || 1, unit: (Number(r.pkgPrice) || 0) / (Number(r.pkgQty) || 1) });
    if (r.addon) lines.push({ id: uid(), kind: "addon", name: r.addon, qty: Number(r.addonQty) || 1, unit: (Number(r.addonPrice) || 0) / (Number(r.addonQty) || 1) });
    if (!r.pkg && Number(r.pkgPrice)) lines.push({ id: uid(), kind: "custom", name: "Package", qty: 1, unit: Number(r.pkgPrice) });
    if (!r.addon && Number(r.addonPrice)) lines.push({ id: uid(), kind: "custom", name: "Add-on", qty: 1, unit: Number(r.addonPrice) });
    const status = ["Pending", "Invoiced", "Paid"].includes(r.status) ? r.status : "Pending";
    return { id: r.id || uid(), date: r.date || "", client: r.client || "", lines, rate, status, invoicedOn: status !== "Pending" ? r.date || null : null, paidOn: status === "Paid" ? r.date || null : null, notes: "", taskId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  });
  return { app: "flowork-workspace", version: 1, exportedAt: new Date().toISOString(), settings: {}, docs: { commission: cfg }, collections: { commission: entries } };
}

/* Detect any supported file and return a workspace backup object */
export function toBackup(d) {
  if (d && d.app === "flowork-workspace") return d;
  if (isLegacyTasks(d)) return convertLegacyTasks(d);
  if (isLegacyCommission(d)) return convertLegacyCommission(d);
  throw new Error("Unrecognised file");
}
