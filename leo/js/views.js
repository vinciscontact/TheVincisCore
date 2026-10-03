// Leo views: dashboard, clients, projects, document lists, services, settings.
import {
  $, $$, esc, money, fmtDate, todayISO, toast, modal, confirmDialog,
  field, input, textarea, select, stateList, pill, effectiveStatus, STATUS_LABEL,
} from "./ui.js";

const PROJECT_TYPES = ["Website", "E-commerce", "Landing page", "Mobile app", "SEO · AEO · GEO", "Data analytics", "TableServe", "Maintenance", "Other"];
const PROJECT_STATUSES = ["lead", "quoted", "active", "delivered", "closed"];
const UNITS = ["project", "month", "year", "hour", "page", "item"];

function fail(error) {
  if (!error) return false;
  console.error(error);
  toast(error.message || "Something went wrong", "err");
  return true;
}
const clientLabel = (c) => (c ? (c.company && c.company !== c.name ? `${c.name} · ${c.company}` : c.name) : "—");

// ======================================================================
// Dashboard
// ======================================================================
export async function dashboard(el, _p, { sb }) {
  const [{ data: docs, error }, { data: projects }] = await Promise.all([
    sb.from("documents").select("id,kind,number,status,total,issue_date,due_date,paid_on,bill_to").order("created_at", { ascending: false }),
    sb.from("projects").select("id,status"),
  ]);
  if (fail(error)) return;

  const month = todayISO().slice(0, 7);
  const invoices = docs.filter((d) => d.kind === "invoice");
  const unpaid = invoices.filter((d) => d.status === "unpaid");
  const overdue = unpaid.filter((d) => effectiveStatus(d) === "overdue");
  const paidMonth = invoices.filter((d) => d.status === "paid" && (d.paid_on || "").startsWith(month));
  const openQuotes = docs.filter((d) => d.kind === "quote" && ["draft", "sent"].includes(d.status));
  const active = (projects || []).filter((p) => p.status === "active").length;
  const sum = (arr) => arr.reduce((s, d) => s + Number(d.total), 0);

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">Leo</p><h1>Good to see you.</h1></div>
      <div class="actions">
        <a class="btn btn--ghost" href="#/doc/new/quote">New quotation</a>
        <a class="btn btn--gold" href="#/doc/new/invoice">New invoice</a>
      </div>
    </header>
    <section class="stats">
      <a class="stat" href="#/invoices?status=unpaid"><span>Outstanding</span><b>${money(sum(unpaid))}</b><small>${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}</small></a>
      <a class="stat ${overdue.length ? "stat--alert" : ""}" href="#/invoices?status=overdue"><span>Overdue</span><b>${money(sum(overdue))}</b><small>${overdue.length} past due date</small></a>
      <a class="stat" href="#/invoices?status=paid"><span>Paid this month</span><b>${money(sum(paidMonth))}</b><small>${paidMonth.length} invoice${paidMonth.length === 1 ? "" : "s"}</small></a>
      <a class="stat" href="#/quotes"><span>Open quotations</span><b>${money(sum(openQuotes))}</b><small>${openQuotes.length} awaiting reply · ${active} active project${active === 1 ? "" : "s"}</small></a>
    </section>
    <section class="card">
      <header class="card__head"><h2>Recent documents</h2></header>
      ${docTable(docs.slice(0, 10), true)}
    </section>`;
}

function docTable(docs, showKind) {
  if (!docs.length) return `<div class="empty"><p class="muted">Nothing here yet.</p></div>`;
  return `
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Number</th>${showKind ? "<th>Type</th>" : ""}<th>Client</th><th>Date</th><th class="num">Total</th><th>Status</th></tr></thead>
      <tbody>${docs.map((d) => `
        <tr data-href="#/doc/${d.id}">
          <td><a href="#/doc/${d.id}"><b>${esc(d.number)}</b></a></td>
          ${showKind ? `<td>${d.kind === "quote" ? "Quotation" : "Invoice"}</td>` : ""}
          <td>${esc(d.bill_to?.company || d.bill_to?.name || "—")}</td>
          <td>${fmtDate(d.issue_date)}</td>
          <td class="num">${money(d.total)}</td>
          <td>${pill(effectiveStatus(d))}</td>
        </tr>`).join("")}</tbody>
    </table></div>`;
}

// Whole-row click for tables with data-href rows.
function rowLinks(el) {
  $$("tr[data-href]", el).forEach((tr) =>
    tr.addEventListener("click", (e) => { if (!e.target.closest("a,button")) location.hash = tr.dataset.href; }));
}

// ======================================================================
// Document lists
// ======================================================================
export const docList = (kind) => async (el, params, { sb }) => {
  const { data: docs, error } = await sb.from("documents")
    .select("id,kind,number,status,total,issue_date,due_date,bill_to")
    .eq("kind", kind).order("issue_date", { ascending: false }).order("number", { ascending: false });
  if (fail(error)) return;

  const statuses = kind === "quote" ? ["draft", "sent", "accepted", "declined"] : ["unpaid", "overdue", "paid"];
  let filter = params.status || "all";
  const label = kind === "quote" ? "Quotations" : "Invoices";

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${docs.length} total</p><h1>${label}</h1></div>
      <div class="actions"><a class="btn btn--gold" href="#/doc/new/${kind}">New ${kind === "quote" ? "quotation" : "invoice"}</a></div>
    </header>
    <div class="chips" role="tablist">
      ${["all", ...statuses].map((s) => `<button class="chip" data-s="${s}">${s === "all" ? "All" : STATUS_LABEL[s]}</button>`).join("")}
      <input class="search" type="search" placeholder="Search number or client" aria-label="Search">
    </div>
    <section class="card" id="list"></section>`;

  const search = $(".search", el);
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const rows = docs.filter((d) =>
      (filter === "all" || effectiveStatus(d) === filter || (filter === "unpaid" && d.status === "unpaid")) &&
      (!q || d.number.toLowerCase().includes(q) || JSON.stringify(d.bill_to).toLowerCase().includes(q)));
    $$(".chip", el).forEach((c) => c.classList.toggle("is-on", c.dataset.s === filter));
    $("#list", el).innerHTML = docTable(rows, false);
    rowLinks(el);
  };
  $$(".chip", el).forEach((c) => c.addEventListener("click", () => { filter = c.dataset.s; draw(); }));
  search.addEventListener("input", draw);
  draw();
};

// ======================================================================
// Clients
// ======================================================================
function clientForm(c = {}) {
  return `<div class="grid">
    ${field("Name *", input("name", c.name, "required"))}
    ${field("Company", input("company", c.company))}
    ${field("Phone", input("phone", c.phone, 'type="tel"'))}
    ${field("Email", input("email", c.email, 'type="email"'))}
    ${field("Address", textarea("address", c.address, 'rows="2"'), { full: true })}
    ${field("City", input("city", c.city))}
    ${field("State", input("state", c.state, 'list="states"'), { hint: "Used to decide CGST+SGST vs IGST" })}
    ${field("GSTIN", input("gstin", c.gstin, 'maxlength="15" style="text-transform:uppercase"'), { hint: "Optional" })}
    ${field("Notes", textarea("notes", c.notes, 'rows="2"'), { full: true })}
    ${stateList()}
  </div>`;
}

export function openClientModal(sb, client, onSaved) {
  modal({
    title: client ? "Edit client" : "New client",
    body: clientForm(client || {}),
    onSubmit: async (data) => {
      data.gstin = data.gstin.toUpperCase();
      const q = client
        ? sb.from("clients").update(data).eq("id", client.id).select().single()
        : sb.from("clients").insert(data).select().single();
      const { data: saved, error } = await q;
      if (fail(error)) return true;
      toast(client ? "Client updated" : "Client added");
      onSaved?.(saved);
    },
  });
}

export async function clients(el, _p, { sb }) {
  const [{ data: list, error }, { data: docs }] = await Promise.all([
    sb.from("clients").select("*").order("name"),
    sb.from("documents").select("client_id,kind,status,total"),
  ]);
  if (fail(error)) return;
  const owed = {};
  (docs || []).filter((d) => d.kind === "invoice" && d.status === "unpaid")
    .forEach((d) => (owed[d.client_id] = (owed[d.client_id] || 0) + Number(d.total)));

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${list.length} client${list.length === 1 ? "" : "s"}</p><h1>Clients</h1></div>
      <div class="actions"><button class="btn btn--gold" id="add">Add client</button></div>
    </header>
    <div class="chips"><input class="search" type="search" placeholder="Search clients" aria-label="Search clients"></div>
    <section class="card" id="list"></section>`;

  const draw = () => {
    const q = $(".search", el).value.trim().toLowerCase();
    const rows = list.filter((c) => !q || [c.name, c.company, c.phone, c.email, c.city].join(" ").toLowerCase().includes(q));
    $("#list", el).innerHTML = rows.length ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Phone</th><th>City</th><th class="num">Outstanding</th></tr></thead>
        <tbody>${rows.map((c) => `
          <tr data-href="#/clients/${c.id}">
            <td><a href="#/clients/${c.id}"><b>${esc(c.name)}</b></a>${c.company && c.company !== c.name ? `<small class="sub">${esc(c.company)}</small>` : ""}</td>
            <td>${esc(c.phone || "—")}</td>
            <td>${esc([c.city, c.state].filter(Boolean).join(", ") || "—")}</td>
            <td class="num">${owed[c.id] ? money(owed[c.id]) : "—"}</td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><p class="muted">No clients match.</p></div>`;
    rowLinks(el);
  };
  $(".search", el).addEventListener("input", draw);
  $("#add", el).addEventListener("click", () => openClientModal(sb, null, (c) => (location.hash = `#/clients/${c.id}`)));
  draw();
}

export async function clientDetail(el, { id }, ctx) {
  const { sb } = ctx;
  const [{ data: c, error }, { data: projects }, { data: docs }] = await Promise.all([
    sb.from("clients").select("*").eq("id", id).maybeSingle(),
    sb.from("projects").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    sb.from("documents").select("id,kind,number,status,total,issue_date,due_date,bill_to").eq("client_id", id).order("issue_date", { ascending: false }),
  ]);
  if (fail(error)) return;
  if (!c) return notFound(el);

  const info = [
    ["Phone", c.phone], ["Email", c.email], ["Address", c.address],
    ["City / State", [c.city, c.state].filter(Boolean).join(", ")], ["GSTIN", c.gstin], ["Notes", c.notes],
  ].filter(([, v]) => v);

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow"><a href="#/clients">Clients</a></p><h1>${esc(c.name)}</h1>${c.company && c.company !== c.name ? `<p class="muted">${esc(c.company)}</p>` : ""}</div>
      <div class="actions">
        <button class="btn btn--ghost" id="edit">Edit</button>
        <a class="btn btn--ghost" href="#/doc/new/quote?client=${c.id}">New quotation</a>
        <a class="btn btn--gold" href="#/doc/new/invoice?client=${c.id}">New invoice</a>
      </div>
    </header>
    <div class="cols">
      <section class="card">
        <header class="card__head"><h2>Details</h2></header>
        ${info.length ? `<dl class="info">${info.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v).replace(/\n/g, "<br>")}</dd>`).join("")}</dl>` : `<p class="muted pad">No contact details yet.</p>`}
      </section>
      <section class="card">
        <header class="card__head"><h2>Projects</h2><button class="btn btn--sm btn--ghost" id="addp">Add project</button></header>
        ${projects.length ? `<ul class="plist">${projects.map((p) => `
          <li data-id="${p.id}"><button class="plist__item"><b>${esc(p.title)}</b><span class="muted">${esc(p.type)} · ${money(p.value)}</span>${pill(p.status)}</button></li>`).join("")}</ul>`
          : `<p class="muted pad">No projects yet.</p>`}
      </section>
    </div>
    <section class="card">
      <header class="card__head"><h2>Quotations &amp; invoices</h2></header>
      ${docTable(docs, true)}
    </section>
    <p class="danger-zone"><button class="btn btn--sm btn--danger-ghost" id="del">Delete client</button></p>`;

  rowLinks(el);
  const reload = () => clientDetail(el, { id }, ctx);
  $("#edit", el).addEventListener("click", () => openClientModal(sb, c, reload));
  $("#addp", el).addEventListener("click", () => openProjectModal(sb, null, reload, c.id));
  $$(".plist li", el).forEach((li) =>
    li.addEventListener("click", () => openProjectModal(sb, projects.find((p) => p.id === li.dataset.id), reload)));
  $("#del", el).addEventListener("click", async () => {
    if (docs.length) return toast("This client has quotations or invoices, so it can't be deleted.", "warn");
    if (!(await confirmDialog(`Delete ${c.name} and their projects? This can't be undone.`))) return;
    const { error: e } = await sb.from("clients").delete().eq("id", c.id);
    if (fail(e)) return;
    toast("Client deleted");
    location.hash = "#/clients";
  });
}

// ======================================================================
// Projects
// ======================================================================
async function openProjectModal(sb, project, onSaved, presetClient) {
  const { data: cl } = await sb.from("clients").select("id,name,company").order("name");
  if (!cl?.length) return toast("Add a client first.", "warn");
  const p = project || { client_id: presetClient, status: "lead", type: "Website", value: 0 };
  modal({
    title: project ? "Edit project" : "New project",
    body: `<div class="grid">
      ${field("Client *", select("client_id", cl.map((c) => [c.id, clientLabel(c)]), p.client_id, "required"), { full: true })}
      ${field("Project title *", input("title", p.title, "required"), { full: true })}
      ${field("Type", select("type", PROJECT_TYPES, p.type))}
      ${field("Status", select("status", PROJECT_STATUSES.map((s) => [s, STATUS_LABEL[s]]), p.status))}
      ${field("Start date", input("start_date", p.start_date, 'type="date"'))}
      ${field("Due date", input("due_date", p.due_date, 'type="date"'))}
      ${field("Project value (₹)", input("value", p.value, 'type="number" min="0" step="1"'))}
      ${field("Notes", textarea("notes", p.notes, 'rows="3"'), { full: true })}
    </div>`,
    danger: project && {
      label: "Delete",
      onClick: async () => {
        if (!(await confirmDialog(`Delete project “${project.title}”?`))) return false;
        const { error } = await sb.from("projects").delete().eq("id", project.id);
        if (fail(error)) return false;
        toast("Project deleted");
        onSaved?.();
        return true;
      },
    },
    onSubmit: async (data) => {
      data.start_date ||= null;
      data.due_date ||= null;
      data.value ??= 0;
      const q = project ? sb.from("projects").update(data).eq("id", project.id) : sb.from("projects").insert(data);
      const { error } = await q;
      if (fail(error)) return true;
      toast(project ? "Project updated" : "Project added");
      onSaved?.();
    },
  });
}

export async function projects(el, params, ctx) {
  const { sb } = ctx;
  const { data: list, error } = await sb.from("projects").select("*, clients(name,company)").order("created_at", { ascending: false });
  if (fail(error)) return;
  let filter = params.status || "all";

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${list.length} project${list.length === 1 ? "" : "s"}</p><h1>Projects</h1></div>
      <div class="actions"><button class="btn btn--gold" id="add">Add project</button></div>
    </header>
    <div class="chips">${["all", ...PROJECT_STATUSES].map((s) => `<button class="chip" data-s="${s}">${s === "all" ? "All" : STATUS_LABEL[s]}</button>`).join("")}</div>
    <section class="card" id="list"></section>`;

  const reload = () => projects(el, { status: filter }, ctx);
  const draw = () => {
    const rows = list.filter((p) => filter === "all" || p.status === filter);
    $$(".chip", el).forEach((c) => c.classList.toggle("is-on", c.dataset.s === filter));
    $("#list", el).innerHTML = rows.length ? `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Project</th><th>Client</th><th>Type</th><th>Due</th><th class="num">Value</th><th>Status</th></tr></thead>
        <tbody>${rows.map((p) => `
          <tr data-id="${p.id}" class="clickable">
            <td><b>${esc(p.title)}</b></td>
            <td><a href="#/clients/${p.client_id}">${esc(clientLabel(p.clients))}</a></td>
            <td>${esc(p.type)}</td>
            <td>${fmtDate(p.due_date)}</td>
            <td class="num">${money(p.value)}</td>
            <td>${pill(p.status)}</td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><p class="muted">No projects here.</p></div>`;
    $$("tr[data-id]", el).forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      openProjectModal(sb, list.find((p) => p.id === tr.dataset.id), reload);
    }));
  };
  $$(".chip", el).forEach((c) => c.addEventListener("click", () => { filter = c.dataset.s; draw(); }));
  $("#add", el).addEventListener("click", () => openProjectModal(sb, null, reload));
  draw();
}

// ======================================================================
// Services catalog
// ======================================================================
export async function services(el, _p, ctx) {
  const { sb } = ctx;
  const { data: list, error } = await sb.from("services").select("*").order("sort").order("name");
  if (fail(error)) return;
  const reload = () => services(el, _p, ctx);

  el.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">Picked from when building quotations</p><h1>Services</h1></div>
      <div class="actions"><button class="btn btn--gold" id="add">Add service</button></div>
    </header>
    <section class="card">
      ${list.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Service</th><th>Unit</th><th>SAC</th><th class="num">Price</th><th>Status</th></tr></thead>
        <tbody>${list.map((s) => `
          <tr data-id="${s.id}" class="clickable${s.active ? "" : " is-muted"}">
            <td><b>${esc(s.name)}</b>${s.description ? `<small class="sub">${esc(s.description)}</small>` : ""}</td>
            <td>per ${esc(s.unit)}</td>
            <td>${esc(s.sac || "—")}</td>
            <td class="num">${money(s.price)}</td>
            <td>${s.active ? "Active" : "Hidden"}</td>
          </tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty"><p class="muted">No services yet.</p></div>`}
    </section>`;

  const open = (s) => modal({
    title: s ? "Edit service" : "New service",
    body: `<div class="grid">
      ${field("Name *", input("name", s?.name, "required"), { full: true })}
      ${field("Description", textarea("description", s?.description, 'rows="2"'), { full: true, hint: "Printed under the line item" })}
      ${field("Price (₹)", input("price", s?.price ?? 0, 'type="number" min="0" step="1" required'))}
      ${field("Unit", select("unit", UNITS.map((u) => [u, "per " + u]), s?.unit || "project"))}
      ${field("SAC code", input("sac", s?.sac), { hint: "Shown on GST invoices. 998314 = IT design & development" })}
      ${field("Sort order", input("sort", s?.sort ?? 100, 'type="number" step="1"'))}
      <label class="check field--full"><input type="checkbox" name="active" ${s?.active === false ? "" : "checked"}> Show in quotation picker</label>
    </div>`,
    danger: s && {
      label: "Delete",
      onClick: async () => {
        if (!(await confirmDialog(`Delete “${s.name}”? Existing documents keep their lines.`))) return false;
        const { error: e } = await sb.from("services").delete().eq("id", s.id);
        if (fail(e)) return false;
        reload();
        return true;
      },
    },
    onSubmit: async (data) => {
      const q = s ? sb.from("services").update(data).eq("id", s.id) : sb.from("services").insert(data);
      const { error: e } = await q;
      if (fail(e)) return true;
      toast("Service saved");
      reload();
    },
  });
  $("#add", el).addEventListener("click", () => open(null));
  $$("tr[data-id]", el).forEach((tr) => tr.addEventListener("click", () => open(list.find((s) => s.id === tr.dataset.id))));
}

// ======================================================================
// Settings
// ======================================================================
export async function settings(el, _p, ctx) {
  const { sb } = ctx;
  await ctx.refreshSettings();
  const s = ctx.settings;
  const { data: { user } } = await sb.auth.getUser();

  el.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Printed on every quotation and invoice</p><h1>Settings</h1></div></header>
    <form id="settings" class="stack">
      <section class="card pad">
        <h2>Company</h2>
        <div class="grid">
          ${field("Business name *", input("company_name", s.company_name, "required"))}
          ${field("Tagline", input("tagline", s.tagline))}
          ${field("Address", textarea("address", s.address, 'rows="3"'), { full: true })}
          ${field("State", input("state", s.state, 'list="states"'), { hint: "Your state of registration" })}
          ${field("Phone", input("phone", s.phone, 'type="tel"'))}
          ${field("Email", input("email", s.email, 'type="email"'))}
          ${field("Website", input("website", s.website))}
          ${stateList()}
        </div>
      </section>

      <section class="card pad">
        <h2>GST</h2>
        <p class="muted">Keep this off until TheVincis is GST-registered. Invoices work fine without it. Once registered, switch it on and add your GSTIN — new documents will then carry GST lines, SAC codes and the “Tax Invoice” title.</p>
        <div class="grid">
          <label class="check field--full"><input type="checkbox" name="gst_enabled" ${s.gst_enabled ? "checked" : ""}> Charge GST on new documents</label>
          ${field("GSTIN", input("gstin", s.gstin, 'maxlength="15" style="text-transform:uppercase" placeholder="Add after registration"'))}
          ${field("Default GST rate (%)", input("gst_rate", s.gst_rate, 'type="number" min="0" max="28" step="0.01"'))}
        </div>
      </section>

      <section class="card pad">
        <h2>Payment details</h2>
        <p class="muted">Printed on invoices so clients can pay you. Leave blank until ready — empty fields are simply left off the PDF. A UPI ID also adds a scan-to-pay QR code.</p>
        <div class="grid">
          ${field("Account holder name", input("account_name", s.account_name, 'placeholder="—"'))}
          ${field("Bank name", input("bank_name", s.bank_name, 'placeholder="—"'))}
          ${field("Account number", input("account_number", s.account_number, 'inputmode="numeric" autocomplete="off" placeholder="—"'))}
          ${field("IFSC", input("ifsc", s.ifsc, 'style="text-transform:uppercase" autocomplete="off" placeholder="—"'))}
          ${field("UPI ID", input("upi_id", s.upi_id, 'autocomplete="off" placeholder="name@bank"'))}
        </div>
      </section>

      <section class="card pad">
        <h2>Numbering &amp; defaults</h2>
        <p class="muted">Numbers look like <b>${esc(s.quote_prefix)}-2026-001</b> and restart every April (financial year).</p>
        <div class="grid">
          ${field("Quotation prefix", input("quote_prefix", s.quote_prefix, "required"))}
          ${field("Invoice prefix", input("invoice_prefix", s.invoice_prefix, "required"))}
          ${field("Quotation valid for (days)", input("quote_validity_days", s.quote_validity_days, 'type="number" min="1" step="1"'))}
          ${field("Invoice due in (days)", input("payment_terms_days", s.payment_terms_days, 'type="number" min="0" step="1"'))}
          ${field("Default quotation terms", textarea("quote_terms", s.quote_terms, 'rows="4"'), { full: true })}
          ${field("Default invoice terms", textarea("invoice_terms", s.invoice_terms, 'rows="4"'), { full: true })}
        </div>
      </section>

      <div class="savebar"><button class="btn btn--gold" type="submit">Save settings</button></div>
    </form>

    <section class="card pad">
      <h2>Security</h2>
      <p class="muted">Signed in as <b>${esc(user?.email)}</b> with two-step sign-in. Leo signs you out after a period of inactivity.</p>
    </section>`;

  $("#settings", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.reportValidity()) return;
    const data = Object.fromEntries([...f.elements].filter((x) => x.name).map((x) =>
      [x.name, x.type === "checkbox" ? x.checked : x.type === "number" ? Number(x.value || 0) : x.value.trim()]));
    data.gstin = data.gstin.toUpperCase();
    data.ifsc = data.ifsc.toUpperCase();
    if (data.gst_enabled && !data.gstin) {
      if (!(await confirmDialog("GST is on but there's no GSTIN. Documents will show GST without a registration number. Save anyway?", { confirmLabel: "Save anyway", danger: false }))) return;
    }
    const { error } = await sb.from("settings").update(data).eq("id", 1);
    if (fail(error)) return;
    await ctx.refreshSettings();
    toast("Settings saved");
  });
}

export function notFound(el) {
  el.innerHTML = `<div class="empty"><h2>Not found</h2><p class="muted">That page doesn't exist.</p><a class="btn btn--ghost" href="#/">Back to dashboard</a></div>`;
}
