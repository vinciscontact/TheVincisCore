// Line-item and tax maths for quotations and invoices.
// GST is charged on (subtotal − discount). Same-state supply splits into
// CGST + SGST; inter-state supply is a single IGST line.
import { round2 } from "./ui.js";

export function computeTotals(doc) {
  const items = (doc.items || []).map((it) => ({
    ...it,
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    amount: round2((Number(it.qty) || 0) * (Number(it.rate) || 0)),
  }));
  const subtotal = round2(items.reduce((s, it) => s + it.amount, 0));
  const discount = Math.min(round2(doc.discount), subtotal);
  const taxable = round2(subtotal - discount);
  const rate = doc.gst_enabled ? Number(doc.gst_rate) || 0 : 0;
  const tax = round2((taxable * rate) / 100);
  const half = round2(tax / 2);
  return {
    items, subtotal, discount, taxable, tax,
    igst: doc.interstate ? tax : 0,
    cgst: doc.interstate ? 0 : half,
    sgst: doc.interstate ? 0 : round2(tax - half),
    total: round2(taxable + tax),
  };
}
