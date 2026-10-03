// Small DOM, formatting and dialog helpers shared by every Leo view.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// ---------- Money + dates ----------
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n) => inr.format(Number(n) || 0);
export const money2 = (n) => "₹" + inr2.format(Number(n) || 0);
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + Number(days || 0));
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const fmtDate = (iso) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ---------- Amount in words (Indian system: lakh, crore) ----------
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const three = (n) => {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ONES[h] + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : "");
};
function indian(n) {
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(indian(crore) + " Crore");
  if (lakh) parts.push(two(lakh) + " Lakh");
  if (thousand) parts.push(two(thousand) + " Thousand");
  if (n) parts.push(three(n));
  return parts.join(" ");
}
export function amountInWords(amount) {
  const total = round2(amount);
  const rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);
  return "Rupees " + indian(rupees) + (paise ? " and " + two(paise) + " Paise" : "") + " Only";
}

// ---------- Toasts ----------
export function toast(message, kind = "ok") {
  const box = $("#toasts");
  const t = document.createElement("div");
  t.className = `toast toast--${kind}`;
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => t.classList.add("is-out"), 3200);
  setTimeout(() => t.remove(), 3700);
}

// ---------- Dialogs ----------
// modal({ title, body (html), submitLabel, onSubmit(formData, dialog) -> truthy keeps it open })
export function modal({ title, body, submitLabel = "Save", onSubmit, danger }) {
  const dlg = document.createElement("dialog");
  dlg.className = "modal";
  dlg.innerHTML = `
    <form method="dialog" class="modal__form" novalidate>
      <header class="modal__head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">✕</button>
      </header>
      <div class="modal__body">${body}</div>
      <footer class="modal__foot">
        ${danger ? `<button type="button" class="btn btn--danger-ghost" data-danger>${esc(danger.label)}</button>` : ""}
        <span class="spacer"></span>
        <button type="button" class="btn btn--ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn--gold">${esc(submitLabel)}</button>
      </footer>
    </form>`;
  document.body.appendChild(dlg);
  const form = $("form", dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  $$("[data-close]", dlg).forEach((b) => b.addEventListener("click", close));
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  if (danger) $("[data-danger]", dlg).addEventListener("click", async () => { if (await danger.onClick()) close(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    try {
      const keepOpen = await onSubmit(formToObject(form), dlg);
      if (!keepOpen) close();
    } finally {
      btn.disabled = false;
    }
  });
  dlg.showModal();
  $("input, select, textarea", dlg)?.focus();
  return dlg;
}

export function confirmDialog(message, { confirmLabel = "Delete", danger = true } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "modal modal--sm";
    dlg.innerHTML = `
      <div class="modal__body"><p>${esc(message)}</p></div>
      <footer class="modal__foot">
        <span class="spacer"></span>
        <button type="button" class="btn btn--ghost" data-no>Cancel</button>
        <button type="button" class="btn ${danger ? "btn--danger" : "btn--gold"}" data-yes>${esc(confirmLabel)}</button>
      </footer>`;
    document.body.appendChild(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    $("[data-no]", dlg).addEventListener("click", () => done(false));
    $("[data-yes]", dlg).addEventListener("click", () => done(true));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(false); });
    dlg.showModal();
  });
}

// Reads a form into a plain object; checkboxes become booleans, number inputs numbers.
export function formToObject(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "number") out[el.name] = el.value === "" ? null : Number(el.value);
    else out[el.name] = el.value.trim();
  }
  return out;
}

// ---------- Form field builders ----------
export function field(label, input, { full, hint } = {}) {
  return `<label class="field${full ? " field--full" : ""}"><span class="field__label">${esc(label)}</span>${input}${hint ? `<span class="field__hint">${esc(hint)}</span>` : ""}</label>`;
}
export function input(name, value = "", attrs = "") {
  return `<input name="${name}" value="${esc(value)}" ${attrs}>`;
}
export function textarea(name, value = "", attrs = "") {
  return `<textarea name="${name}" ${attrs}>${esc(value)}</textarea>`;
}
export function select(name, options, value, attrs = "") {
  return `<select name="${name}" ${attrs}>${options
    .map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}"${String(v) === String(value ?? "") ? " selected" : ""}>${esc(l)}</option>`;
    })
    .join("")}</select>`;
}

export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];
export const stateList = () =>
  `<datalist id="states">${STATES.map((s) => `<option value="${s}">`).join("")}</datalist>`;

export const STATUS_LABEL = {
  draft: "Draft", sent: "Sent", accepted: "Accepted", declined: "Declined",
  unpaid: "Unpaid", paid: "Paid", overdue: "Overdue",
  lead: "Lead", quoted: "Quoted", active: "Active", delivered: "Delivered", closed: "Closed",
};
export const pill = (status) => `<span class="pill pill--${status}">${STATUS_LABEL[status] || esc(status)}</span>`;

// Invoices past their due date and still unpaid read as "overdue".
export const effectiveStatus = (d) =>
  d.kind === "invoice" && d.status === "unpaid" && d.due_date && d.due_date < todayISO() ? "overdue" : d.status;
