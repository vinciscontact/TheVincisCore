// Quotation / invoice editor: pick a client, pick services, get a PDF.
import {
  $, $$, esc, money, money2, todayISO, addDays, amountInWords, toast, confirmDialog, select, pill, effectiveStatus, STATUS_LABEL, round2,
} from "./ui.js";
import { computeTotals } from "./totals.js";
import { downloadPdf } from "./pdf.js";
import { openClientModal } from "./views.js";

const norm = (s) => String(s || "").trim().toLowerCase();

export async function docEditor(el, params, ctx) {
  const { sb } = ctx;
  const settings = ctx.settings;
  const newKind = (location.hash.match(/^#\/doc\/new\/(quote|invoice)/) || [])[1];

  const [{ data: clients }, { data: projects }, { data: catalog }] = await Promise.all([
    sb.from("clients").select("*").order("name"),
    sb.from("projects").select("id,client_id,title,type,value,status").order("created_at", { ascending: false }),
    sb.from("services").select("*").eq("active", true).order("sort").order("name"),
  ]);

  let doc;
  if (newKind) {
    const presetClient = clients.find((c) => c.id === params.client);
    doc = {
      kind: newKind,
      number: null,
      client_id: presetClient?.id || "",
      project_id: params.project || "",
      issue_date: todayISO(),
      due_date: addDays(todayISO(), newKind === "quote" ? settings.quote_validity_days : settings.payment_terms_days),
      status: newKind === "quote" ? "draft" : "unpaid",
      items: [],
      discount: 0,
      gst_enabled: settings.gst_enabled,
      gst_rate: settings.gst_rate,
      interstate: false,
      notes: "",
      terms: newKind === "quote" ? settings.quote_terms : settings.invoice_terms,
      paid_on: null,
    };
  } else {
    const { data, error } = await sb.from("documents").select("*").eq("id", params.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      el.innerHTML = `<div class="empty"><h2>Document not found</h2><a class="btn btn--ghost" href="#/">Back</a></div>`;
      return;
    }
    doc = { ...data, project_id: data.project_id || "", items: data.items || [] };
  }

  const isQuote = doc.kind === "quote";
  const listHash = isQuote ? "#/quotes" : "#/invoices";
  $$(".side__nav a, .tabbar a").forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === listHash));

  let dirty = false;
  const markDirty = () => { dirty = true; $("#savestate", el).textContent = "Unsaved changes"; };
  const onUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", onUnload);
  window.addEventListener("hashchange", () => window.removeEventListener("beforeunload", onUnload), { once: true });

  const client = () => clients.find((c) => c.id === doc.client_id);
  const gstAllowed = settings.gst_enabled || doc.gst_enabled;
  const autoInterstate = () => {
    const c = client();
    doc.interstate = !!(c?.state && settings.state && norm(c.state) !== norm(settings.state));
  };
  if (newKind && doc.client_id) autoInterstate();

  const statuses = isQuote ? ["draft", "sent", "accepted", "declined"] : ["unpaid", "paid"];
  const clientOptions = () => [["", "Select a client…"], ...clients.map((c) => [c.id, c.company && c.company !== c.name ? `${c.name} · ${c.company}` : c.name])];
  const projectOptions = () => [["", "No project"], ...projects.filter((p) => p.client_id === doc.client_id).map((p) => [p.id, `${p.title} · ${money(p.value)}`])];

  el.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow"><a href="${listHash}">${isQuote ? "Quotations" : "Invoices"}</a></p>
        <h1>${doc.number ? esc(doc.number) : `New ${isQuote ? "quotation" : "invoice"}`} ${doc.number ? pill(effectiveStatus(doc)) : ""}</h1>
        <p class="muted" id="savestate">${doc.number ? "Saved" : "Not saved yet — a number is assigned on first save"}</p>
      </div>
      <div class="actions">
        ${isQuote && doc.id ? `<button class="btn btn--ghost" id="convert">Convert to invoice</button>` : ""}
        <button class="btn btn--ghost" id="pdf">Download PDF</button>
        <button class="btn btn--gold" id="save">Save</button>
      </div>
    </header>

    <div class="editor">
      <div class="editor__main">
        <section class="card pad">
          <h2>${isQuote ? "Prepared for" : "Bill to"}</h2>
          <div class="grid">
            <label class="field field--full"><span class="field__label">Client *</span>
              <div class="inline">${select("client_id", clientOptions(), doc.client_id, 'id="f-client" required')}
              <button type="button" class="btn btn--ghost btn--sm" id="newclient">+ New</button></div></label>
            <label class="field field--full"><span class="field__label">Project</span>
              ${select("project_id", projectOptions(), doc.project_id, 'id="f-project"')}
              <span class="field__hint">Picking a project with no lines yet adds it as the first line.</span></label>
            <label class="field"><span class="field__label">${isQuote ? "Date" : "Invoice date"}</span><input type="date" id="f-issue" value="${doc.issue_date}"></label>
            <label class="field"><span class="field__label">${isQuote ? "Valid until" : "Due by"}</span><input type="date" id="f-due" value="${doc.due_date || ""}"></label>
            <label class="field"><span class="field__label">Status</span>${select("status", statuses.map((s) => [s, STATUS_LABEL[s]]), doc.status, 'id="f-status"')}</label>
            <label class="field" id="paidwrap" ${doc.status === "paid" ? "" : "hidden"}><span class="field__label">Paid on</span><input type="date" id="f-paid" value="${doc.paid_on || todayISO()}"></label>
          </div>
        </section>

        <section class="card">
          <header class="card__head"><h2>Items</h2></header>
          <div class="items" id="items"></div>
          <footer class="items__add">
            ${select("catalog", [["", "＋ Add a service…"], ...catalog.map((s) => [s.id, `${s.name} — ${money(s.price)}${s.unit !== "project" ? " / " + s.unit : ""}`])], "", 'id="f-catalog" aria-label="Add a service from the catalog"')}
            <button type="button" class="btn btn--ghost btn--sm" id="custom">Custom line</button>
          </footer>
        </section>

        <section class="card pad">
          <h2>Notes &amp; terms</h2>
          <div class="grid">
            <label class="field field--full"><span class="field__label">Notes (shown on the PDF)</span><textarea id="f-notes" rows="3" placeholder="Scope, timeline, deliverables…">${esc(doc.notes)}</textarea></label>
            <label class="field field--full"><span class="field__label">Terms</span><textarea id="f-terms" rows="4">${esc(doc.terms)}</textarea></label>
          </div>
        </section>
      </div>

      <aside class="editor__side">
        <section class="card pad totals" id="totals"></section>
        ${doc.id ? `<button class="btn btn--sm btn--danger-ghost" id="delete">Delete ${isQuote ? "quotation" : "invoice"}</button>` : ""}
      </aside>
    </div>`;

  // ---------- Items ----------
  const itemsBox = $("#items", el);
  function drawItems() {
    const gst = doc.gst_enabled;
    if (!doc.items.length) {
      itemsBox.innerHTML = `<p class="muted pad">Add a service from the list below, or a custom line.</p>`;
      return;
    }
    itemsBox.innerHTML = `
      <div class="item item--head ${gst ? "has-sac" : ""}"><span>Description</span>${gst ? "<span>SAC</span>" : ""}<span>Qty</span><span>Rate (₹)</span><span class="num">Amount</span><span></span></div>
      ${doc.items.map((it, i) => `
        <div class="item ${gst ? "has-sac" : ""}" data-i="${i}">
          <div class="item__desc">
            <input data-k="name" value="${esc(it.name)}" placeholder="Item name" aria-label="Item name">
            <textarea data-k="description" rows="1" placeholder="Details (optional)" aria-label="Item details">${esc(it.description || "")}</textarea>
          </div>
          ${gst ? `<input data-k="sac" value="${esc(it.sac || "")}" placeholder="SAC" aria-label="SAC code">` : ""}
          <input data-k="qty" type="number" min="0" step="any" value="${it.qty}" aria-label="Quantity">
          <input data-k="rate" type="number" min="0" step="any" value="${it.rate}" aria-label="Rate">
          <span class="num item__amt">${money2(round2(it.qty * it.rate))}</span>
          <button type="button" class="icon-btn" data-remove aria-label="Remove line">✕</button>
        </div>`).join("")}`;
  }
  itemsBox.addEventListener("input", (e) => {
    const row = e.target.closest(".item[data-i]");
    if (!row || !e.target.dataset.k) return;
    const it = doc.items[row.dataset.i];
    const k = e.target.dataset.k;
    it[k] = k === "qty" || k === "rate" ? Number(e.target.value) || 0 : e.target.value;
    $(".item__amt", row).textContent = money2(round2(it.qty * it.rate));
    markDirty();
    drawTotals();
  });
  itemsBox.addEventListener("click", (e) => {
    if (!e.target.closest("[data-remove]")) return;
    doc.items.splice(e.target.closest(".item").dataset.i, 1);
    markDirty(); drawItems(); drawTotals();
  });
  $("#f-catalog", el).addEventListener("change", (e) => {
    const s = catalog.find((x) => x.id === e.target.value);
    e.target.value = "";
    if (!s) return;
    doc.items.push({ name: s.name, description: s.description || "", sac: s.sac || "", unit: s.unit, qty: 1, rate: Number(s.price) });
    markDirty(); drawItems(); drawTotals();
  });
  $("#custom", el).addEventListener("click", () => {
    doc.items.push({ name: "", description: "", sac: "", unit: "item", qty: 1, rate: 0 });
    drawItems(); drawTotals();
    $$(".item[data-i] input[data-k=name]", el).pop()?.focus();
  });

  // ---------- Totals panel ----------
  const totalsBox = $("#totals", el);
  function drawTotals() {
    const t = computeTotals(doc);
    const half = doc.gst_rate / 2;
    totalsBox.innerHTML = `
      <h2>Summary</h2>
      <div class="totals__row"><span>Subtotal</span><b>${money2(t.subtotal)}</b></div>
      <label class="totals__row"><span>Discount (₹)</span><input type="number" min="0" step="any" id="f-discount" value="${doc.discount || 0}"></label>
      ${gstAllowed ? `
        <label class="check"><input type="checkbox" id="f-gst" ${doc.gst_enabled ? "checked" : ""}> Charge GST</label>
        ${doc.gst_enabled ? `
          <label class="totals__row"><span>GST rate (%)</span><input type="number" min="0" max="28" step="0.01" id="f-rate" value="${doc.gst_rate}"></label>
          <label class="check"><input type="checkbox" id="f-inter" ${doc.interstate ? "checked" : ""}> Inter-state client (IGST)</label>
          ${doc.interstate
            ? `<div class="totals__row"><span>IGST @ ${doc.gst_rate}%</span><b>${money2(t.igst)}</b></div>`
            : `<div class="totals__row"><span>CGST @ ${half}%</span><b>${money2(t.cgst)}</b></div>
               <div class="totals__row"><span>SGST @ ${half}%</span><b>${money2(t.sgst)}</b></div>`}` : ""}`
        : `<p class="field__hint">GST is off. Turn it on in Settings once registered.</p>`}
      <div class="totals__grand"><span>Total</span><b>${money2(t.total)}</b></div>
      <p class="totals__words">${amountInWords(t.total)}</p>`;
    $("#f-discount", totalsBox).addEventListener("change", (e) => { doc.discount = Math.max(0, Number(e.target.value) || 0); markDirty(); drawTotals(); });
    $("#f-gst", totalsBox)?.addEventListener("change", (e) => {
      doc.gst_enabled = e.target.checked;
      if (doc.gst_enabled && !doc.gst_rate) doc.gst_rate = settings.gst_rate;
      markDirty(); drawItems(); drawTotals();
    });
    $("#f-rate", totalsBox)?.addEventListener("change", (e) => { doc.gst_rate = Number(e.target.value) || 0; markDirty(); drawTotals(); });
    $("#f-inter", totalsBox)?.addEventListener("change", (e) => { doc.interstate = e.target.checked; markDirty(); drawTotals(); });
  }

  // ---------- Header fields ----------
  function setClient(id) {
    doc.client_id = id;
    doc.project_id = "";
    $("#f-project", el).outerHTML = select("project_id", projectOptions(), "", 'id="f-project"');
    bindProject();
    autoInterstate();
    markDirty(); drawTotals();
  }
  function bindClient() {
    $("#f-client", el).addEventListener("change", (e) => setClient(e.target.value));
  }
  bindClient();
  function bindProject() {
    $("#f-project", el).addEventListener("change", (e) => {
      doc.project_id = e.target.value;
      const p = projects.find((x) => x.id === doc.project_id);
      if (p && !doc.items.length) {
        doc.items.push({ name: p.title, description: p.type, sac: "998314", unit: "project", qty: 1, rate: Number(p.value) });
        drawItems(); drawTotals();
      }
      markDirty();
    });
  }
  bindProject();
  $("#newclient", el).addEventListener("click", () => openClientModal(sb, null, (c) => {
    clients.push(c);
    clients.sort((a, b) => a.name.localeCompare(b.name));
    $("#f-client", el).outerHTML = select("client_id", clientOptions(), c.id, 'id="f-client" required');
    bindClient();
    setClient(c.id);
  }));
  $("#f-issue", el).addEventListener("change", (e) => { doc.issue_date = e.target.value; markDirty(); });
  $("#f-due", el).addEventListener("change", (e) => { doc.due_date = e.target.value || null; markDirty(); });
  $("#f-status", el).addEventListener("change", (e) => {
    doc.status = e.target.value;
    $("#paidwrap", el).hidden = doc.status !== "paid";
    markDirty();
  });
  $("#f-paid", el).addEventListener("change", (e) => { doc.paid_on = e.target.value; markDirty(); });
  $("#f-notes", el).addEventListener("input", (e) => { doc.notes = e.target.value; markDirty(); });
  $("#f-terms", el).addEventListener("input", (e) => { doc.terms = e.target.value; markDirty(); });

  // ---------- Save ----------
  async function save() {
    const c = client();
    if (!c) { toast("Choose a client first.", "warn"); $("#f-client", el).focus(); return false; }
    doc.items = doc.items.filter((it) => it.name.trim() || it.rate);
    if (!doc.items.length) { toast("Add at least one line item.", "warn"); drawItems(); return false; }
    if (doc.items.some((it) => !it.name.trim())) { toast("Every line needs a name.", "warn"); return false; }

    const t = computeTotals(doc);
    const payload = {
      kind: doc.kind,
      client_id: doc.client_id,
      project_id: doc.project_id || null,
      issue_date: doc.issue_date || todayISO(),
      due_date: doc.due_date || null,
      status: doc.status,
      items: t.items.map(({ name, description, sac, unit, qty, rate, amount }) => ({ name: name.trim(), description, sac, unit, qty, rate, amount })),
      discount: t.discount,
      gst_enabled: !!doc.gst_enabled,
      gst_rate: doc.gst_enabled ? Number(doc.gst_rate) || 0 : 0,
      interstate: !!doc.interstate,
      subtotal: t.subtotal,
      tax_total: t.tax,
      total: t.total,
      bill_to: { name: c.name, company: c.company, email: c.email, phone: c.phone, address: c.address, city: c.city, state: c.state, gstin: c.gstin },
      notes: doc.notes,
      terms: doc.terms,
      paid_on: doc.status === "paid" ? doc.paid_on || todayISO() : null,
      source_quote_id: doc.source_quote_id || null,
    };

    const btn = $("#save", el);
    btn.disabled = true;
    try {
      if (!doc.id) {
        const { data: number, error: ne } = await sb.rpc("next_doc_number", { p_kind: doc.kind });
        if (ne) throw ne;
        const { data, error } = await sb.from("documents").insert({ ...payload, number }).select().single();
        if (error) throw error;
        Object.assign(doc, data, { project_id: data.project_id || "" });
        dirty = false;
        toast(`${isQuote ? "Quotation" : "Invoice"} ${number} saved`);
        history.replaceState(null, "", `#/doc/${data.id}`);
        await docEditor(el, { id: data.id }, ctx);
        return true;
      }
      const { data, error } = await sb.from("documents").update(payload).eq("id", doc.id).select().single();
      if (error) throw error;
      Object.assign(doc, data, { project_id: data.project_id || "" });
      dirty = false;
      $("#savestate", el).textContent = "Saved";
      toast("Saved");
      return true;
    } catch (err) {
      console.error(err);
      toast(err.message || "Couldn't save", "err");
      return false;
    } finally {
      btn.disabled = false;
    }
  }
  $("#save", el).addEventListener("click", save);

  $("#pdf", el).addEventListener("click", async () => {
    if ((dirty || !doc.id) && !(await save())) return;
    // save() re-renders a brand-new document, so look the button up afresh.
    const btn = $("#pdf", el);
    btn.disabled = true;
    try {
      await downloadPdf({ ...doc }, ctx.settings);
    } catch (err) {
      console.error(err);
      toast(err.message || "PDF failed", "err");
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Convert quote → invoice ----------
  $("#convert", el)?.addEventListener("click", async () => {
    if (dirty && !(await save())) return;
    const { data: existing } = await sb.from("documents").select("id,number").eq("source_quote_id", doc.id).maybeSingle();
    if (existing) {
      toast(`Already invoiced as ${existing.number}`, "warn");
      location.hash = `#/doc/${existing.id}`;
      return;
    }
    if (!(await confirmDialog(`Create an invoice from ${doc.number}? The quotation will be marked accepted.`, { confirmLabel: "Create invoice", danger: false }))) return;
    try {
      const { data: number, error: ne } = await sb.rpc("next_doc_number", { p_kind: "invoice" });
      if (ne) throw ne;
      const today = todayISO();
      const { data: inv, error } = await sb.from("documents").insert({
        kind: "invoice", number, client_id: doc.client_id, project_id: doc.project_id || null, source_quote_id: doc.id,
        issue_date: today, due_date: addDays(today, ctx.settings.payment_terms_days), status: "unpaid",
        items: doc.items, discount: doc.discount, gst_enabled: doc.gst_enabled, gst_rate: doc.gst_rate, interstate: doc.interstate,
        subtotal: doc.subtotal, tax_total: doc.tax_total, total: doc.total, bill_to: doc.bill_to,
        notes: doc.notes, terms: ctx.settings.invoice_terms,
      }).select().single();
      if (error) throw error;
      await sb.from("documents").update({ status: "accepted" }).eq("id", doc.id);
      if (doc.project_id) await sb.from("projects").update({ status: "active" }).eq("id", doc.project_id).in("status", ["lead", "quoted"]);
      toast(`Invoice ${number} created`);
      location.hash = `#/doc/${inv.id}`;
    } catch (err) {
      console.error(err);
      toast(err.message || "Couldn't create the invoice", "err");
    }
  });

  // ---------- Delete ----------
  $("#delete", el)?.addEventListener("click", async () => {
    const warn = isQuote
      ? `Delete quotation ${doc.number}? This can't be undone.`
      : `Delete invoice ${doc.number}? Invoice numbers should stay continuous for your records — prefer marking it paid or editing it. Delete anyway?`;
    if (!(await confirmDialog(warn))) return;
    const { error } = await sb.from("documents").delete().eq("id", doc.id);
    if (error) return toast(error.message, "err");
    dirty = false;
    toast("Deleted");
    location.hash = listHash;
  });

  drawItems();
  drawTotals();
}
