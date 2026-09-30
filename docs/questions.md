# Open questions (do not assume answers)

If work depends on one of these: ask the founder, or build it so every answer still works and say so.
When one is answered, move it to `decisions.md` as a new D-entry and delete it here.
Q-1, Q-2, Q-4, Q-6, Q-7, Q-8, Q-11 – Q-14 were answered on 2026-09-28 (D-023 – D-036), Q-16 and Q-17 too (D-041, D-042), Q-15 and Q-20 on 2026-09-29 (D-047, D-045), Q-21, Q-24 and Q-25 on 2026-09-30 (D-052), Q-26 the same day (D-055), Q-23 too (D-056), Q-27 too (D-057), Q-22 too (D-058). The ones below are facts the
founder doesn't know yet. **None blocks the restructure (R2–R8). All must be answered before launch.**

| ID | Question | Why it matters | Rule until answered |
|---|---|---|---|
| Q-3 | Which US carrier ships orders to customers (USPS / UPS / other)? | tracking links, label integration (F-1) | admins type the carrier + tracking number by hand |
| Q-5 | What is the returns/exchanges policy (wrong size, damaged)? | policy page, refunds | no returns flow (D-028). The policy page shows `TODO(founder): Q-5` |
| Q-9 | Domain name and support email (bought at launch, D-046) | emails from the real domain, SEO | Vercel URLs and Resend's test sender until launch (D-046) |
| Q-10 | Who is the FDA-registered facility for spices, and who makes the English labels? | compliance (`ops.md`) | spices can be drafted, never published (D-032) |
| Q-18 | Express delivery takes 15–18 days (D-048): counted from the **order date**, or from the export's **arrival in the US** (how express days work today)? | the express delivery window shown before payment (D-008) | production gets no express until confirmed; dev shows placeholder 1–2 days after arrival (`seed/demo.sql`) |
| Q-19 | Before launch, with an accountant: may IWC keep the sales tax on an order the customer cancels (D-042), or must it be refunded or paid to the state? | tax compliance in each state | the rule is built as the founder said; the check is on the launch list |
| Q-28 | Items loved in one state but made in another (Lucknowi chikan on Delhi's page; Ilkal, Narayanpet and khun sarees on Maharashtra's): the product page says "Made in India · from <region>". Should these show the real making state instead ("from Uttar Pradesh", "from Karnataka"), or move to that state's page? | honest origin (D-004) | listed as placeholders under the catalogue's region, with the real making place in their description (`catalogue/README.md`) |
| Q-29 | May IWC sell named brands (MDH masalas; packaged goods from named Pune, Lonavala or Old Delhi makers), with the brand on the page? | the store never names shops (D-003); brands are also the makers | products listed under their own names, no brand (`catalogue/README.md`) |
