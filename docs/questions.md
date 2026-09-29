# Open questions (do not assume answers)

If work depends on one of these: ask the founder, or build it so every answer still works and say so.
When one is answered, move it to `decisions.md` as a new D-entry and delete it here.
Q-1, Q-2, Q-4, Q-6, Q-7, Q-8, Q-11 – Q-14 were answered on 2026-09-28 (D-023 – D-036), Q-16 and Q-17 too (D-041, D-042), Q-15 and Q-20 on 2026-09-29 (D-047, D-045). The ones below are facts the
founder doesn't know yet. **None blocks the restructure (R2–R8). All must be answered before launch.**

| ID | Question | Why it matters | Rule until answered |
|---|---|---|---|
| Q-3 | Which US carrier ships orders to customers (USPS / UPS / other)? | tracking links, label integration (F-1) | admins type the carrier + tracking number by hand |
| Q-5 | What is the returns/exchanges policy (wrong size, damaged)? | policy page, refunds | no returns flow (D-028). The policy page shows `TODO(founder): Q-5` |
| Q-9 | Domain name and support email (bought at launch, D-046) | emails from the real domain, SEO | Vercel URLs and Resend's test sender until launch (D-046) |
| Q-10 | Who is the FDA-registered facility for spices, and who makes the English labels? | compliance (`ops.md`) | spices can be drafted, never published (D-032) |
| Q-18 | Express delivery takes 15–18 days (D-048): counted from the **order date**, or from the export's **arrival in the US** (how express days work today)? | the express delivery window shown before payment (D-008) | production gets no express until confirmed; dev shows placeholder 1–2 days after arrival (`seed/demo.sql`) |
| Q-19 | Before launch, with an accountant: may IWC keep the sales tax on an order the customer cancels (D-042), or must it be refunded or paid to the state? | tax compliance in each state | the rule is built as the founder said; the check is on the launch list |
| Q-22 | What decides the region sections (D-051)? Proposed: **Most wanted** = most pieces ordered in the last 30 days; **Curated for you** = pieces an admin picks per region (later personalised from saves and views); **Leaving soon** = pieces with ≤ 2 left (a setting). | no invented rankings or fake scarcity (D-012, `design.md` voice) | the mockup shows these rules as labelled samples; nothing is built until confirmed |
| Q-23 | Reviews (D-051): only verified buyers after delivery? Checked by an admin before they show? Stars only, or text and photos too? | trust; no fake reviews | the mockup shows labelled sample cards only; no reviews are collected or shown until answered |
| Q-24 | Helvetica Neue (D-051) is a licensed font, built into Apple devices only. Buy a web licence (Monotype) to self-host it, or use a free look-alike on Windows and Android? | on Windows and Android the page otherwise shows Arial or Roboto; the founder's own Windows machine shows Arial | the font stack `Helvetica Neue, Helvetica, Arial` |
| Q-25 | The region album scrolls by itself with no controls (D-051). WCAG 2.2 (2.2.2) asks for a way to pause moving content that runs longer than 5 seconds. Add a small pause button, or keep it control-free (it already stops for "reduce motion" and when off screen)? | accessibility is non-negotiable in `design.md` | the mockup has no control; it stops for reduced motion and off screen |
| Q-21 | The founder shared a reference map (D-050). The mockup draws Home's map from **DataMeet India's state boundaries** (CC BY 4.0; J&K and Ladakh updated to the Survey of India map in 2021), which needs a visible credit line. Ship that source with its credit, or use another? | this audience will notice a wrong border at once; the licence requires attribution on the page | the mockup uses DataMeet with the credit under the map and in the footer; nothing ships until confirmed |
