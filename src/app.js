import { CATALOG, catalogBySku } from "./catalog.js";
import { runGuard, cartTotal, verdictLabel } from "./guard.js";
import { planOffline, planWithLLM, rogueCart } from "./planner.js";

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n).toFixed(2)}`;
const moneyStr = (n) => Number(n).toFixed(2);

let cart = [];
let buttonsSignature = "";
let gridApi = null;
const auditRows = [];

// ---------- settings ----------
const store = {
  get clientId() { return new URLSearchParams(location.search).get("client-id") || localStorage.getItem("pp_client_id") || ""; },
  get aiBase() { return localStorage.getItem("pp_ai_base") || "https://api.openai.com/v1"; },
  get aiKey() { return localStorage.getItem("pp_ai_key") || ""; },
  get aiModel() { return localStorage.getItem("pp_ai_model") || "gpt-4o-mini"; },
};

function loadSettingsIntoForm() {
  $("cfg-client-id").value = localStorage.getItem("pp_client_id") || "";
  $("cfg-ai-base").value = store.aiBase;
  $("cfg-ai-key").value = store.aiKey;
  $("cfg-ai-model").value = store.aiModel;
  updatePlannerModeNote();
}

function updatePlannerModeNote() {
  $("planner-mode").textContent = store.aiKey
    ? `Planner: live LLM (${store.aiModel}) via your endpoint — output treated as untrusted, firewall decides.`
    : "Planner: built-in offline planner (no setup). Add an AI key in Settings to use a live LLM — the firewall treats its output as untrusted either way.";
}

$("save-settings").addEventListener("click", () => {
  localStorage.setItem("pp_client_id", $("cfg-client-id").value.trim());
  localStorage.setItem("pp_ai_base", $("cfg-ai-base").value.trim());
  localStorage.setItem("pp_ai_key", $("cfg-ai-key").value.trim());
  localStorage.setItem("pp_ai_model", $("cfg-ai-model").value.trim());
  buttonsSignature = ""; // force PayPal re-render with the new client id
  updatePlannerModeNote();
  audit("user", "SETTINGS_SAVED", store.clientId ? "PayPal client ID configured" : "no PayPal client ID yet", "info");
  refresh();
});

// ---------- audit trail ----------
function audit(actor, action, detail, verdict) {
  const row = { time: new Date().toLocaleTimeString(), actor, action, detail, verdict };
  auditRows.push(row);
  if (gridApi) {
    gridApi.applyTransaction({ add: [row] });
  } else {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.time}</td><td>${row.actor}</td><td>${row.action}</td><td>${row.detail}</td><td>${row.verdict}</td>`;
    $("audit-body").appendChild(tr);
  }
}

function initAuditGrid() {
  if (window.agGrid && window.agGrid.createGrid) {
    gridApi = window.agGrid.createGrid($("audit-grid"), {
      columnDefs: [
        { field: "time", width: 105 },
        { field: "actor", width: 95 },
        { field: "action", width: 170 },
        { field: "detail", flex: 1 },
        { field: "verdict", width: 110 },
      ],
      rowData: auditRows,
      defaultColDef: { sortable: false, resizable: true },
    });
  } else {
    $("audit-grid").hidden = true;
    $("audit-fallback").hidden = false;
  }
}

// ---------- cart + guard rendering ----------
function renderCart() {
  const body = $("cart-body");
  body.innerHTML = "";
  if (cart.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="empty">No plan yet — give the agent a mission.</td></tr>`;
  }
  for (const line of cart) {
    const item = catalogBySku(line.sku);
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${item ? item.name : line.sku + " (unknown)"}</td><td>${line.qty}</td>` +
      `<td>${money(line.unitPrice)}</td><td>${money(line.qty * line.unitPrice)}</td><td>${line.why || ""}</td>`;
    body.appendChild(tr);
  }
  $("cart-total").textContent = money(cartTotal(cart));
}

function renderGuard() {
  const budget = Number($("budget").value) || 0;
  const result = runGuard(cart, budget);
  const v = $("verdict");
  v.textContent = cart.length === 0 ? "Waiting for a cart…" : verdictLabel(result);
  v.className = "verdict " + (cart.length === 0 ? "neutral" : result.approved ? "ok" : "bad");
  const ul = $("guard-list");
  ul.innerHTML = "";
  for (const c of result.checks) {
    const li = document.createElement("li");
    li.className = c.pass ? "pass" : "fail";
    li.innerHTML = `${c.pass ? "✅" : "⛔"} <strong>${c.id}</strong> — ${c.label}<span class="detail">${c.detail}</span>`;
    ul.appendChild(li);
  }
  return result;
}

function refresh() {
  renderCart();
  const result = renderGuard();
  maybeRenderPayPal(result);
}

// ---------- PayPal ----------
function loadPayPalSdk(clientId) {
  return new Promise((resolve, reject) => {
    if (window.paypal) return resolve();
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function maybeRenderPayPal(result) {
  const container = $("paypal-buttons");
  const status = $("paypal-status");
  if (!result.approved) {
    container.innerHTML = "";
    buttonsSignature = "";
    status.textContent = "PayPal buttons unlock only when the firewall approves the cart.";
    return;
  }
  if (!store.clientId) {
    container.innerHTML = "";
    status.textContent = "Cart approved ✅ — add your PayPal sandbox Client ID in Settings to enable checkout.";
    return;
  }
  const signature = store.clientId + "|" + cart.map((l) => `${l.sku}x${l.qty}@${l.unitPrice}`).join(",");
  if (signature === buttonsSignature) return;
  buttonsSignature = signature;
  status.textContent = "Cart approved ✅ — PayPal sandbox checkout is live.";
  try {
    await loadPayPalSdk(store.clientId);
  } catch {
    status.textContent = "Could not load the PayPal SDK — check the Client ID and your connection.";
    return;
  }
  container.innerHTML = "";
  window.paypal.Buttons({
    createOrder: (data, actions) => {
      const total = moneyStr(cartTotal(cart));
      const order = actions.order.create({
        purchase_units: [{
          description: "PayPilot agent cart (firewall approved)",
          amount: {
            currency_code: "USD",
            value: total,
            breakdown: { item_total: { currency_code: "USD", value: total } },
          },
          items: cart.map((l) => ({
            name: (catalogBySku(l.sku)?.name || l.sku).slice(0, 127),
            sku: l.sku,
            quantity: String(l.qty),
            unit_amount: { currency_code: "USD", value: moneyStr(l.unitPrice) },
          })),
        }],
      });
      audit("paypal", "ORDER_CREATED", `cart total ${money(total)}`, "info");
      return order;
    },
    onApprove: async (data, actions) => {
      const details = await actions.order.capture();
      audit("paypal", "ORDER_CAPTURED", `order ${details.id} · ${details.status}`, "paid");
      const r = $("receipt");
      r.hidden = false;
      r.textContent =
        `✅ Payment captured in PayPal sandbox\nOrder ID: ${details.id}\nStatus: ${details.status}\n` +
        `Payer: ${details.payer?.name?.given_name || ""} ${details.payer?.name?.surname || ""} (${details.payer?.email_address || ""})\n` +
        `Amount: ${money(cartTotal(cart))} — every line in this order passed the spending firewall first.`;
    },
    onError: (err) => audit("paypal", "ORDER_ERROR", String(err).slice(0, 140), "error"),
  }).render(container);
}

// ---------- actions ----------
$("plan-btn").addEventListener("click", async () => {
  const mission = $("mission").value.trim();
  const budget = Number($("budget").value) || 0;
  audit("agent", "PLAN_REQUESTED", `mission: “${mission.slice(0, 80)}” · budget ${money(budget)}`, "info");
  try {
    if (store.aiKey) {
      cart = await planWithLLM(mission, budget, { baseUrl: store.aiBase, apiKey: store.aiKey, model: store.aiModel });
      audit("agent", "PLAN_PROPOSED", `LLM proposed ${cart.length} line(s), total ${money(cartTotal(cart))}`, "pending");
    } else {
      cart = planOffline(mission, budget);
      audit("agent", "PLAN_PROPOSED", `offline planner proposed ${cart.length} line(s), total ${money(cartTotal(cart))}`, "pending");
    }
  } catch (e) {
    audit("agent", "PLAN_LLM_FAILED", `${e.message} — falling back to offline planner`, "info");
    cart = planOffline(mission, budget);
  }
  const result = runGuard(cart, budget);
  for (const c of result.checks) audit("firewall", c.id, c.detail, c.pass ? "pass" : "FAIL");
  audit("firewall", "VERDICT", verdictLabel(result), result.approved ? "approved" : "blocked");
  refresh();
});

$("rogue-btn").addEventListener("click", () => {
  const budget = Number($("budget").value) || 0;
  cart = rogueCart(budget);
  audit("rogue-agent", "PLAN_PROPOSED", "tampered cart: inflated price, duplicate line, fake SKU, over budget", "pending");
  const result = runGuard(cart, budget);
  for (const c of result.checks) audit("firewall", c.id, c.detail, c.pass ? "pass" : "FAIL");
  audit("firewall", "VERDICT", verdictLabel(result) + " — PayPal checkout stayed locked", result.approved ? "approved" : "blocked");
  refresh();
});

$("reset-btn").addEventListener("click", () => {
  cart = [];
  $("receipt").hidden = true;
  audit("user", "RESET", "cart cleared", "info");
  refresh();
});

// ---------- boot ----------
loadSettingsIntoForm();
initAuditGrid();
audit("system", "BOOT", `catalog loaded: ${CATALOG.length} items · guard rules: 5 · currency USD`, "info");
refresh();
