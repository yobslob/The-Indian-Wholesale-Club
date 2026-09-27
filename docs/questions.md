# Open questions (do not assume answers)

If work depends on one of these: ask the founder, or build it so every answer still works and say so.
When one is answered, move it to `decisions.md` as a new D-entry and delete it here.

| ID | Question | Why it matters | Current assumption (not a decision) |
|---|---|---|---|
| Q-1 | Asked "pre-orders on goods still in transit?", the founder said *"yes yes there will be an option."* Under the order-first model (D-005) every order already waits for a cycle. What is the option: (a) some pieces held in US stock for fast delivery, (b) a paid faster/air option, (c) something else? | the fulfilment modes on orders, product page promises | Build order-first only. Leave room with `orders.fulfilment_mode` |
| Q-2 | Does "Wholesale" or "Club" mean anything functional (bulk/B2B pricing, membership)? | pricing and account model | Retail to consumers, no membership |
| Q-3 | Typical days from cycle cutoff to US arrival, and from arrival to the customer's door? Which US carrier? | delivery windows (D-008) | Unknown. Cycle dates are entered by admins per cycle |
| Q-4 | Should the COO see everything (revenue, customer names and addresses), or only the India desk? | admin permissions | Both are full admins (D-007) |
| Q-5 | Returns and exchanges for goods that came from India (wrong size, damaged)? | policy page, refunds flow | Unknown. No returns flow built yet |
| Q-6 | How are shopkeepers paid (UPI / cash / bank), and must receipts or photos be stored? | payout records | Record method + reference + optional photo |
| Q-7 | If a piece is no longer at the shop at pickup: refund automatically, or offer a substitute first? | pickup flow, customer emails | Refund that item and notify |
| Q-8 | Can the founder run Docker Desktop (for a local Supabase in tests)? If not, we use a separate free Supabase project for tests. | DB/RLS tests | Unknown |
| Q-9 | Domain name, support email, and hosting (Vercel, US region?) | ops, emails, SEO | Unknown |
| Q-10 | Spices: who is the FDA-registered facility, and who makes the English labels? Required before the first spice goes live. | compliance (`ops.md`) | Unknown. Spice listings stay unpublished until answered |
| Q-11 | US sales tax: keep the flat 8% estimate, or use Stripe Tax? | checkout totals | Flat 8% estimate from the old code |
| Q-12 | While goods are still in India, is "Preparing your order" acceptable customer-facing wording under D-003? | order status copy | Yes, pending confirmation |
| Q-13 | Customer-facing: may the home page show an "order by <date>" countdown for the next delivery window? (It reveals no operations detail, only dates.) | home page | Yes, pending confirmation |
| Q-14 | Currency and price display: USD only? Show "compare at" prices? | pricing UI | USD only, no compare-at |
