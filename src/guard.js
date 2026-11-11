// PayPilot spending firewall.
//
// The AI agent PROPOSES a cart. This deterministic guard DISPOSES: it
// verifies the cart against the catalog and the user's hard budget
// before any PayPal order can be created. No LLM output reaches
// PayPal unless every rule passes.
//
// Cart line shape: { sku, qty, unitPrice }  (unitPrice is what the
// agent claims; the guard compares it to the catalog truth.)

import { catalogBySku } from "./catalog.js";

export const MAX_QTY_PER_ITEM = 5;

export function cartTotal(cart) {
  return cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

export function runGuard(cart, budgetUsd) {
  const checks = [];
  const push = (id, label, pass, detail) => checks.push({ id, label, pass, detail });

  // G1 — hard budget cap
  const total = cartTotal(cart);
  push(
    "G1_BUDGET",
    "Total within hard budget",
    cart.length > 0 && total <= budgetUsd + 1e-9,
    `total $${total.toFixed(2)} vs budget $${Number(budgetUsd).toFixed(2)}`
  );

  // G2 — catalog integrity: every SKU exists and the claimed price
  // equals the catalog price (catches price tampering / hallucinated items)
  const badLines = cart.filter((l) => {
    const item = catalogBySku(l.sku);
    return !item || Math.abs(item.price - l.unitPrice) > 1e-9;
  });
  push(
    "G2_CATALOG",
    "Every item exists in catalog at the catalog price",
    badLines.length === 0,
    badLines.length === 0
      ? `${cart.length} line(s) verified against catalog`
      : `mismatch: ${badLines.map((l) => l.sku).join(", ")}`
  );

  // G3 — no duplicate SKUs (quantities must be folded into one line)
  const seen = new Set();
  const dupes = cart.filter((l) => (seen.has(l.sku) ? true : (seen.add(l.sku), false)));
  push(
    "G3_NO_DUPES",
    "No duplicate line items",
    dupes.length === 0,
    dupes.length === 0 ? "all SKUs unique" : `duplicate: ${dupes.map((l) => l.sku).join(", ")}`
  );

  // G4 — quantity sanity per line
  const badQty = cart.filter((l) => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY_PER_ITEM);
  push(
    "G4_QTY",
    `Quantities within 1–${MAX_QTY_PER_ITEM} per item`,
    badQty.length === 0,
    badQty.length === 0 ? "quantities sane" : `bad qty: ${badQty.map((l) => `${l.sku}×${l.qty}`).join(", ")}`
  );

  // G5 — non-empty cart
  push("G5_NONEMPTY", "Cart is not empty", cart.length > 0, `${cart.length} line(s)`);

  const approved = checks.every((c) => c.pass);
  return { approved, checks, total };
}

export function verdictLabel(result) {
  return result.approved ? "APPROVED — safe to pay" : "BLOCKED — do not pay";
}
