# Open questions (do not assume answers)

If work depends on one of these: ask the founder, or build it so every answer still works and say so.
When one is answered, move it to `decisions.md` as a new D-entry and delete it here.
Q-1, Q-2, Q-4, Q-6, Q-7, Q-8, Q-11 – Q-14 were answered on 2026-09-28 (D-023 – D-036), Q-16 and Q-17 too (D-041, D-042), Q-15 and Q-20 on 2026-09-29 (D-047, D-045), Q-21, Q-24 and Q-25 on 2026-09-30 (D-052), Q-26 the same day (D-055), Q-23 too (D-056). The ones below are facts the
founder doesn't know yet. **None blocks the restructure (R2–R8). All must be answered before launch.**

| ID | Question | Why it matters | Rule until answered |
|---|---|---|---|
| Q-3 | Which US carrier ships orders to customers (USPS / UPS / other)? | tracking links, label integration (F-1) | admins type the carrier + tracking number by hand |
| Q-5 | What is the returns/exchanges policy (wrong size, damaged)? | policy page, refunds | no returns flow (D-028). The policy page shows `TODO(founder): Q-5` |
| Q-9 | Domain name and support email (bought at launch, D-046) | emails from the real domain, SEO | Vercel URLs and Resend's test sender until launch (D-046) |
| Q-10 | Who is the FDA-registered facility for spices, and who makes the English labels? | compliance (`ops.md`) | spices can be drafted, never published (D-032) |
| Q-18 | Express delivery takes 15–18 days (D-048): counted from the **order date**, or from the export's **arrival in the US** (how express days work today)? | the express delivery window shown before payment (D-008) | production gets no express until confirmed; dev shows placeholder 1–2 days after arrival (`seed/demo.sql`) |
| Q-19 | Before launch, with an accountant: may IWC keep the sales tax on an order the customer cancels (D-042), or must it be refunded or paid to the state? | tax compliance in each state | the rule is built as the founder said; the check is on the launch list |
| Q-22 | What decides **Most wanted** (D-051)? Proposed: most pieces ordered in the last 30 days. (Curated for you and Leaving soon were settled in D-056.) | no invented rankings (D-012) | the section is not built |
| Q-27 | The region photos supplied on 2026-09-30 (Kerala, Punjab ×2, Rajasthan, D-056): who took them, and does IWC have the rights to use them on the live site? | copyright; they are the face of each region page | used in development; before launch each needs its rights confirmed or a replacement |
