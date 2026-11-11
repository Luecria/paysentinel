// PaySentinel planner: turns a mission + budget into a proposed cart.
//
// Two modes:
//  - offline (default): deterministic keyword/tag scoring over the
//    catalog. Runs with zero setup so anyone can try the demo.
//  - llm (optional, bring-your-own-key): calls an OpenAI-compatible
//    chat completions endpoint and asks it to pick catalog SKUs.
//    The output is treated as UNTRUSTED: SKUs are re-resolved against
//    the catalog, prices are taken from the catalog (never from the
//    model), and the guard still has the final say.

import { CATALOG, catalogBySku } from "./catalog.js";

const STOP = new Set("a an the for my me i want need needs buy get with and or to of under below please some good best cheap setup kit".split(" "));

export function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

export function planOffline(mission, budgetUsd) {
  const words = tokenize(mission);
  const scored = CATALOG.map((item) => {
    let score = 0;
    const hits = [];
    for (const tag of item.tags) {
      if (words.some((w) => tag === w || tag.startsWith(w) || w.startsWith(tag))) {
        score += 3;
        hits.push(tag);
      }
    }
    if (words.some((w) => item.name.toLowerCase().includes(w))) score += 2;
    return { item, score, hits };
  }).filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.item.price - b.item.price);

  const picks = [];
  let total = 0;
  const usedCategories = new Set();
  // first pass: best hit per category, for diversity
  for (const s of scored) {
    if (usedCategories.has(s.item.category)) continue;
    if (total + s.item.price > budgetUsd) continue;
    picks.push({ item: s.item, why: s.hits.length ? `matches “${s.hits[0]}” in your mission` : "topical match" });
    total += s.item.price;
    usedCategories.add(s.item.category);
  }
  // second pass: fill remaining budget with next-best matches
  for (const s of scored) {
    if (picks.some((p) => p.item.sku === s.item.sku)) continue;
    if (total + s.item.price > budgetUsd) continue;
    picks.push({ item: s.item, why: s.hits.length ? `matches “${s.hits[0]}” in your mission` : "topical match" });
    total += s.item.price;
  }
  return picks.map((p) => ({
    sku: p.item.sku,
    qty: 1,
    unitPrice: p.item.price,
    why: p.why,
    source: "offline-planner",
  }));
}

export async function planWithLLM(mission, budgetUsd, cfg) {
  const list = CATALOG.map((i) => `${i.sku} | ${i.name} | $${i.price.toFixed(2)} | tags: ${i.tags.join(",")}`).join("\n");
  const body = {
    model: cfg.model,
    messages: [
      {
        role: "system",
        content:
          "You are a purchasing agent. Pick items ONLY from the catalog below. " +
          "Respect the hard budget. Reply with JSON only: {\"picks\":[{\"sku\":\"...\",\"qty\":1,\"why\":\"short reason\"}]}. " +
          "Never invent SKUs or prices.\n\nCATALOG:\n" + list,
      },
      { role: "user", content: `Mission: ${mission}\nHard budget: $${Number(budgetUsd).toFixed(2)}` },
    ],
    temperature: 0.2,
  };
  const res = await fetch(cfg.baseUrl.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM endpoint returned ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const cart = [];
  for (const p of json.picks || []) {
    const item = catalogBySku(p.sku);
    if (!item) continue; // hallucinated SKU: dropped here, guard would block it too
    cart.push({ sku: item.sku, qty: Math.max(1, Math.min(5, p.qty | 0 || 1)), unitPrice: item.price, why: String(p.why || "agent pick"), source: "llm" });
  }
  return cart;
}

// A deliberately tampered cart for the "rogue agent" demo: inflated
// price, duplicate line, over-budget total. The guard must block it.
export function rogueCart(budgetUsd) {
  const chair = CATALOG.find((i) => i.sku === "WS-CHAIR");
  const desk = CATALOG.find((i) => i.sku === "WS-DESK");
  return [
    { sku: chair.sku, qty: 1, unitPrice: chair.price * 3, why: "rogue: price inflated 3×", source: "rogue" },
    { sku: desk.sku, qty: 1, unitPrice: desk.price, why: "rogue: filler", source: "rogue" },
    { sku: desk.sku, qty: 1, unitPrice: desk.price, why: "rogue: duplicate line", source: "rogue" },
    { sku: "XX-FAKE", qty: 1, unitPrice: Math.max(50, budgetUsd), why: "rogue: item not in catalog", source: "rogue" },
  ];
}
