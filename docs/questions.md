# Open questions (do not assume answers)

If work depends on one of these: ask the founder, or build it so every answer still works and say so.
When one is answered, move it to `decisions.md` as a new D-entry and delete it here.
Q-1, Q-2, Q-4, Q-6, Q-7, Q-8, Q-11 – Q-14 were answered on 2026-09-28 (D-023 – D-036), Q-16 and Q-17 too (D-041, D-042). The ones below are facts the
founder doesn't know yet. **None blocks the restructure (R2–R8). All must be answered before launch.**

| ID | Question | Why it matters | Rule until answered |
|---|---|---|---|
| Q-3 | Which US carrier ships orders to customers (USPS / UPS / other)? | tracking links, label integration (F-1) | admins type the carrier + tracking number by hand |
| Q-5 | What is the returns/exchanges policy (wrong size, damaged)? | policy page, refunds | no returns flow (D-028). The policy page shows `TODO(founder): Q-5` |
| Q-9 | Domain name, support email, hosting (Vercel, US region?) | ops, emails, SEO | placeholders from `.env` only |
| Q-15 | Pricing settings: FX rate (source), freight per kg, duty %, target margin, US domestic delivery days (min/max), and after how many days a listing's quantity counts as stale? | suggested prices and delivery windows. `create_order` refuses to run until domestic days are set | all NULL in `pricing_settings`, never invented. Dev uses placeholder 3–7 days (`seed/demo.sql`) |
| Q-10 | Who is the FDA-registered facility for spices, and who makes the English labels? | compliance (`ops.md`) | spices can be drafted, never published (D-032) |
| Q-18 | Express shipping (D-041): is it only faster **inside the US** after the export arrives, and how many US delivery days (min/max) does it take? | the express delivery window shown before payment (D-008) | express is not offered until both days are set in admin → Settings. Dev uses placeholder 1–2 days (`seed/demo.sql`) |
| Q-19 | Before launch, with an accountant: may IWC keep the sales tax on an order the customer cancels (D-042), or must it be refunded or paid to the state? | tax compliance in each state | the rule is built as the founder said; the check is on the launch list |
| Q-20 | When a cycle's cutoff time passes and the admin has not cut it off yet (or no next cycle exists): should checkout (a) close until an admin opens the next cycle, (b) keep taking orders into the late cycle, or (c) open the next cycle automatically with dates copied forward (+21 days) that an admin confirms? | the "order by" date on the store, which cycle an order joins, delivery windows (D-008) | today (b) happens silently and the store shows a past "order by" date (B-19). Nothing is changed until you answer |
