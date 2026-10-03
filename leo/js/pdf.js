// Branded A4 sheet for quotations and invoices, exported to PDF with html2pdf.
import { esc, money2, fmtDate, amountInWords } from "./ui.js";
import { computeTotals } from "./totals.js";

const BEE = new URL("../images/brand/bee-400.webp", location.href).href;

const lines = (text) => esc(text).replace(/\n/g, "<br>");

function upiQr(settings, amount, number) {
  if (!settings.upi_id || typeof qrcode !== "function") return "";
  const params = new URLSearchParams({ pa: settings.upi_id, pn: settings.company_name, am: amount.toFixed(2), cu: "INR", tn: number });
  const qr = qrcode(0, "M");
  qr.addData("upi://pay?" + params.toString());
  qr.make();
  return `<figure class="sheet__qr"><img src="${qr.createDataURL(4, 0)}" alt=""><figcaption>Scan to pay via UPI</figcaption></figure>`;
}

export function buildSheet(doc, settings) {
  const t = computeTotals(doc);
  const isQuote = doc.kind === "quote";
  const gst = doc.gst_enabled && settings.gst_enabled;
  const title = isQuote ? "Quotation" : gst && settings.gstin ? "Tax Invoice" : "Invoice";
  const to = doc.bill_to || {};

  const fromLines = [
    settings.address && lines(settings.address),
    settings.state,
    settings.phone && `Phone: ${esc(settings.phone)}`,
    settings.email && esc(settings.email),
    gst && settings.gstin && `<b>GSTIN:</b> ${esc(settings.gstin)}`,
  ].filter(Boolean);

  const toLines = [
    to.company && to.company !== to.name && esc(to.company),
    to.address && lines(to.address),
    [to.city, to.state].filter(Boolean).map(esc).join(", "),
    to.phone && `Phone: ${esc(to.phone)}`,
    to.email && esc(to.email),
    to.gstin && `<b>GSTIN:</b> ${esc(to.gstin)}`,
  ].filter(Boolean);

  const rows = t.items.map((it, i) => `
    <tr>
      <td class="c-num">${i + 1}</td>
      <td class="c-desc"><b>${esc(it.name)}</b>${it.description ? `<span>${lines(it.description)}</span>` : ""}</td>
      ${gst ? `<td class="c-sac">${esc(it.sac || "")}</td>` : ""}
      <td class="c-qty">${esc(it.qty)}${it.unit && it.unit !== "project" ? ` <small>${esc(it.unit)}</small>` : ""}</td>
      <td class="c-amt">${money2(it.rate)}</td>
      <td class="c-amt">${money2(it.amount)}</td>
    </tr>`).join("");

  const taxRows = !gst ? "" : doc.interstate
    ? `<div><span>IGST @ ${doc.gst_rate}%</span><span>${money2(t.igst)}</span></div>`
    : `<div><span>CGST @ ${doc.gst_rate / 2}%</span><span>${money2(t.cgst)}</span></div>
       <div><span>SGST @ ${doc.gst_rate / 2}%</span><span>${money2(t.sgst)}</span></div>`;

  const bank = [
    settings.account_name && ["Account name", settings.account_name],
    settings.bank_name && ["Bank", settings.bank_name],
    settings.account_number && ["Account no.", settings.account_number],
    settings.ifsc && ["IFSC", settings.ifsc],
    settings.upi_id && ["UPI", settings.upi_id],
  ].filter(Boolean);

  const payBlock = isQuote || (!bank.length && !settings.upi_id) ? "" : `
    <section class="sheet__pay pdf-avoid">
      <div>
        <h4>Payment details</h4>
        <dl>${bank.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      </div>
      ${upiQr(settings, t.total, doc.number)}
    </section>`;

  const el = document.createElement("div");
  el.className = "sheet";
  el.innerHTML = `
    <header class="sheet__head">
      <div class="sheet__brand">
        <img src="${BEE}" alt="" crossorigin="anonymous">
        <div>
          <p class="sheet__word">The<em>Vincis</em></p>
          ${settings.tagline ? `<p class="sheet__tag">${esc(settings.tagline)}</p>` : ""}
        </div>
      </div>
      <div class="sheet__title">
        <h1>${title}</h1>
        <p class="sheet__no">${esc(doc.number || "Draft")}</p>
      </div>
    </header>

    <div class="sheet__rule"></div>

    <section class="sheet__parties">
      <div>
        <h4>From</h4>
        <p class="sheet__party">${esc(settings.company_name)}</p>
        <p>${fromLines.join("<br>")}</p>
      </div>
      <div>
        <h4>${isQuote ? "Prepared for" : "Bill to"}</h4>
        <p class="sheet__party">${esc(to.name || "")}</p>
        <p>${toLines.join("<br>")}</p>
      </div>
      <div class="sheet__dates">
        <div><span>${isQuote ? "Date" : "Invoice date"}</span><b>${fmtDate(doc.issue_date)}</b></div>
        ${doc.due_date ? `<div><span>${isQuote ? "Valid until" : "Due by"}</span><b>${fmtDate(doc.due_date)}</b></div>` : ""}
        ${gst ? `<div><span>Place of supply</span><b>${esc(to.state || settings.state || "")}</b></div>` : ""}
      </div>
    </section>

    <table class="sheet__items">
      <thead><tr>
        <th class="c-num">#</th><th class="c-desc">Description</th>${gst ? `<th class="c-sac">SAC</th>` : ""}
        <th class="c-qty">Qty</th><th class="c-amt">Rate</th><th class="c-amt">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <section class="sheet__sum pdf-avoid">
      <p class="sheet__words"><span>Amount in words</span>${amountInWords(t.total)}</p>
      <div class="sheet__totals">
        <div><span>Subtotal</span><span>${money2(t.subtotal)}</span></div>
        ${t.discount ? `<div><span>Discount</span><span>− ${money2(t.discount)}</span></div>` : ""}
        ${gst && t.discount ? `<div><span>Taxable value</span><span>${money2(t.taxable)}</span></div>` : ""}
        ${taxRows}
        <div class="sheet__grand"><span>Total</span><span>${money2(t.total)}</span></div>
      </div>
    </section>

    ${payBlock}

    ${doc.notes ? `<section class="sheet__note pdf-avoid"><h4>Notes</h4><p>${lines(doc.notes)}</p></section>` : ""}
    ${doc.terms ? `<section class="sheet__note pdf-avoid"><h4>Terms</h4><p>${lines(doc.terms)}</p></section>` : ""}

    <footer class="sheet__foot">
      <span>Thank you for choosing ${esc(settings.company_name)}.</span>
      <span>${[settings.website, settings.email].filter(Boolean).map(esc).join(" · ")}</span>
    </footer>`;
  return el;
}

async function imagesReady(el) {
  await Promise.all([...el.querySelectorAll("img")].map((img) =>
    img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
}

export async function downloadPdf(doc, settings) {
  if (typeof html2pdf !== "function") throw new Error("PDF engine is still loading — try again in a moment.");
  const sheet = buildSheet(doc, settings);
  // Render inside an off-screen stage so fonts and images resolve before capture.
  const stage = document.createElement("div");
  stage.className = "sheet-stage";
  stage.appendChild(sheet);
  document.body.appendChild(stage);
  try {
    await document.fonts.ready;
    await imagesReady(sheet);
    await html2pdf()
      .set({
        margin: 0,
        filename: `${doc.number || "draft"}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".pdf-avoid"] },
      })
      .from(sheet)
      .save();
  } finally {
    stage.remove();
  }
}
