// Dependency-free logic tests: node test/logic.test.mjs
import assert from "node:assert";
import { runGuard, cartTotal } from "../src/guard.js";
import { planOffline, rogueCart, rogueCartSubtle } from "../src/planner.js";
import { catalogBySku } from "../src/catalog.js";

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("PASS", name); };

t("valid cart is approved", () => {
  const cart = [{ sku: "AU-ANC", qty: 1, unitPrice: catalogBySku("AU-ANC").price }];
  const r = runGuard(cart, 400);
  assert.equal(r.approved, true);
  assert.equal(r.total, 129);
});

t("over-budget cart is blocked by G1", () => {
  const cart = [{ sku: "WS-DESK", qty: 1, unitPrice: 329 }];
  const r = runGuard(cart, 100);
  assert.equal(r.approved, false);
  assert.equal(r.checks.find((c) => c.id === "G1_BUDGET").pass, false);
});

t("tampered price is blocked by G2", () => {
  const cart = [{ sku: "AU-ANC", qty: 1, unitPrice: 12.90 }];
  const r = runGuard(cart, 400);
  assert.equal(r.approved, false);
  assert.equal(r.checks.find((c) => c.id === "G2_CATALOG").pass, false);
});

t("fake SKU is blocked by G2", () => {
  const cart = [{ sku: "XX-FAKE", qty: 1, unitPrice: 10 }];
  assert.equal(runGuard(cart, 400).approved, false);
});

t("duplicate lines are blocked by G3", () => {
  const cart = [
    { sku: "AU-BUDS", qty: 1, unitPrice: 49 },
    { sku: "AU-BUDS", qty: 1, unitPrice: 49 },
  ];
  const r = runGuard(cart, 400);
  assert.equal(r.checks.find((c) => c.id === "G3_NO_DUPES").pass, false);
  assert.equal(r.approved, false);
});

t("qty above cap is blocked by G4", () => {
  const cart = [{ sku: "WL-BAND", qty: 6, unitPrice: 19 }];
  assert.equal(runGuard(cart, 400).checks.find((c) => c.id === "G4_QTY").pass, false);
});

t("empty cart is blocked", () => {
  assert.equal(runGuard([], 400).approved, false);
});

t("offline planner stays within budget and matches the mission", () => {
  const cart = planOffline("headphones for focus and video calls with a good webcam", 200);
  assert.ok(cart.length >= 2, "expected several picks");
  assert.ok(cartTotal(cart) <= 200, "total within budget");
  assert.ok(cart.some((l) => l.sku === "AU-ANC"), "headphones picked");
  assert.ok(cart.some((l) => l.sku === "CP-WEBCAM"), "webcam picked");
  const r = runGuard(cart, 200);
  assert.equal(r.approved, true, "planner output must pass the guard");
});

t("offline planner with tiny budget picks nothing it cannot afford", () => {
  const cart = planOffline("standing desk and chair", 50);
  assert.ok(cartTotal(cart) <= 50);
});

t("rogue cart is blocked on at least three rules", () => {
  const r = runGuard(rogueCart(400), 400);
  assert.equal(r.approved, false);
  const fails = r.checks.filter((c) => !c.pass).map((c) => c.id);
  assert.ok(fails.includes("G1_BUDGET") && fails.includes("G2_CATALOG") && fails.includes("G3_NO_DUPES"), `fails: ${fails}`);
});

t("subtle rogue cart stays under budget (G1 passes)", () => {
  const cart = rogueCartSubtle(400);
  assert.ok(cart.length > 0);
  assert.ok(cartTotal(cart) <= 400, `total ${cartTotal(cart)} must stay under budget`);
  const r = runGuard(cart, 400);
  assert.equal(r.checks.find((c) => c.id === "G1_BUDGET").pass, true);
});

t("subtle rogue cart is blocked by G2 alone", () => {
  const r = runGuard(rogueCartSubtle(400), 400);
  assert.equal(r.approved, false);
  const fails = r.checks.filter((c) => !c.pass).map((c) => c.id);
  assert.deepEqual(fails, ["G2_CATALOG"], `only G2 may fail, got: ${fails}`);
});

console.log(`\n${passed} tests passed`);
