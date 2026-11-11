# PaySentinel — the AI purchasing agent with a spending firewall

**AI proposes → firewall verifies → PayPal pays.**

PaySentinel is an AI purchasing agent. You give it a mission ("set up a
work-from-home corner for video calls") and a **hard budget**. The agent
proposes an itemized cart and explains every pick. Before any money can
move, a deterministic **spending firewall** verifies the cart:

- **G1 Budget** — cart total must be within the hard budget
- **G2 Catalog integrity** — every item must exist in the catalog at
  exactly the catalog price (catches hallucinated items and price tampering)
- **G3 No duplicates** — quantities are folded into single lines
- **G4 Quantity sanity** — 1–5 per item (an anti-hoarding bound:
  missions are household-scale, so more than 5 of one item signals a
  runaway or manipulated plan, not a genuine need)
- **G5 Non-empty** — nothing to pay for nothing

Only an approved cart unlocks the PayPal checkout button. A built-in
**"Simulate rogue agent"** button feeds the firewall a tampered cart
(inflated price, duplicate line, fake SKU, over budget) and shows it
being blocked, with every decision written to an audit trail. A second
button, **"Simulate subtle tamper"**, is the harder test: every line
is a real catalog item, the total stays *under* budget, and the only
defect is one price quietly marked up 5% — G1 passes, and G2 alone
has to catch it. As defense in depth, the guard also re-runs at the
moment a PayPal order is created, not only when the button renders.

## Why this exists

AI agents are starting to spend real money. The unsafe pattern is
letting a language model's output flow straight into a payment API.
PaySentinel demonstrates the safer pattern: the model proposes, plain
deterministic rules verify, and only then does PayPal execute. The
model can be wrong, manipulated, or compromised — the firewall does
not care, because it never trusts the model's numbers.

## Catalog trust

G2 is only as strong as the catalog it checks against, so the trust
story is stated plainly. In this demo the catalog is a small curated
list shipped in the repo (`src/catalog.js`) — it is the guard's
source of truth, and it is deliberately *not* writable by the agent:
the planner can only reference it. In production the same design
takes the catalog from merchant-signed feeds, with prices
cross-checked against a second independent source before G2 trusts
them; if the catalog itself were compromised, price integrity would
need that second source, which is why it is part of the roadmap
rather than silently assumed here.

## Run it

It's a static site — no build step, no server.

```bash
# any static server works, e.g.:
npx serve .
# or
python3 -m http.server 8000
```

Then open the page and:

1. (Optional) In **Settings**, paste a **PayPal sandbox Client ID**
   (from https://developer.paypal.com → Apps & Credentials → Sandbox).
   Without it, planning and the firewall work fully; checkout stays
   locked with an explanation. You can also pass `?client-id=...` in
   the URL.
2. Give the agent a mission and a budget, click **Plan with agent**.
3. Watch the firewall verdict, then pay with PayPal sandbox.
4. Try **Simulate rogue agent** to see the firewall block a bad cart.

## AI modes

- **Offline planner (default)** — deterministic keyword/tag matching
  over the built-in catalog (`src/catalog.js`). Zero setup; this is
  what judges get out of the box.
- **Live LLM (optional)** — bring your own key for any
  OpenAI-compatible endpoint (Settings). The model must pick catalog
  SKUs; its output is re-resolved against the catalog, prices are
  taken from the catalog (never from the model), and the firewall
  still has the final say.

## Tools used (hackathon disclosure)

- **PayPal** — JavaScript SDK, sandbox, client-side order create +
  capture with itemized purchase units.
- **AG Grid** (community edition, CDN) — the audit-trail grid.
- **AI** — an OpenAI-compatible chat model (optional, BYO key) for
  cart planning; built-in deterministic planner as default/fallback.
- Plain HTML/CSS/JS modules. No build tooling.

## Tests

```bash
node test/logic.test.mjs   # 12 checks: guard rules, planner budget discipline, rogue-cart blocking (loud and subtle)
```

## Layout

- `index.html` — the app shell
- `src/catalog.js` — demo catalog (the guard's source of truth)
- `src/planner.js` — offline planner, LLM planner, rogue-cart generator
- `src/guard.js` — the spending firewall (pure functions, unit-tested)
- `src/app.js` — UI wiring, PayPal checkout, audit trail
- `src/style.css`

## License

MIT — see `LICENSE`.
