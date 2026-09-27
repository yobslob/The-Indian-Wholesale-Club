# Decisions log

Append-only. Never edit the meaning of an entry: to change a decision, add a new entry that supersedes it
(`Supersedes D-xxx`) and mark the old one `SUPERSEDED by D-yyy`.

**By:** `founder` = decided by the founder, binding · `approved` = proposed by Claude, approved by the founder ·
`proposed` = Claude's recommendation awaiting founder review. It may change, so don't treat it as final.
Founder quotes are verbatim (typos kept) so later sessions don't reinterpret them.

---

**D-001 · 2026-09-27 · founder: Users, emotion, competition**
Users: Indians living in the US, plus some US citizens. The emotion we resolve is homesickness. We are cutting out
two competitors: slow couriers, and the feeling of owing a favour when asking a relative or friend travelling from India.
> "the target users are Indians residing in USA and some of the native citizens, the emotion we have to resolve is
> home-sickness … the competition that we are cutting by doing this is the couriers which take so long and the
> feeling of debt if someone asks their relative or friend who is coming from india."

**D-002 · 2026-09-27 · founder: Regions are the core concept, all 36 treated the same**
The site revolves around India's states. Selecting one shows that region's clothes and spices and the emotion.
All 28 states **and** 8 union territories are shown, with no distinction between them.
> "Once the user selects a state they will get to see that state's regional clothes and spices and the emotion that we are selling."
> "Show everything don't differentiate between states and ut's"

**D-003 · 2026-09-27 · founder: No operations info on the customer side**
The customer side never shows physical-operations information. IWC presents the inventory as its own. The site is US-based
and hosted in the US. Operations info is allowed only in the admin.
> "don't use any physical work information on the customer side because it is a US based site and I will host it from US,
> you are only allowed to use that kind of info on admin side." · "I will show it on website as mine"
*Interpretation (proposed, confirm at R1 review):* "operations info" = shops/vendors, shop location, sourcing, pickups,
payouts, cycles and export logistics, staff. Customers **may** see: the product's region, its craft/style name, "Made in
India / Imported" (D-004), and an estimated delivery window (D-008). The exact whitelist is in `storefront.md`.

**D-004 · 2026-09-27 · proposed: Honest origin labelling; the old "stealth origin" layer is removed forever**
Product pages show the region and "Made in India". Listings disclose "Imported". Why: it's the concept itself (D-002), and US
FTC textile rules require country-of-origin labels on garments and an "Imported" disclosure in online listings. The
pre-restructure code rewrote tracking and emails to hide India (see tag `pre-restructure`). That must never return.

**D-005 · 2026-09-27 · founder: Order-first supply in cycles**
Shops' pieces are listed as IWC inventory. When a customer in the US orders, the selected pieces are collected from the
shop in that region. Everything is shipped together and delivered. Shopkeepers are paid when their pieces are collected.
One export every 20–23 days.
> "I will be paying the shopkeepers once their selected pieces are taken from them. And they will be taken from them when
> someone ordered it in US. the flow is, I will take inventories from every shop, I will show it on website as mine, people
> place orders, the selected items from inventory will be taken from that state and everything will be shipped at once and delivered."
> "the goods will be exported every 20-23 days from India to US"

**D-006 · 2026-09-27 · founder: Hidden admin on web and app**
Web: the normal site is for everyone. The admin lives only at `/admin` behind credentials and is not loaded for customers. App: the same
app for everyone, and signing in with an admin account loads the admin app. Never shown or explained publicly. Access only for
admin emails.
> "one endpoint will be for the admin panel, if we can decrease the load by not loading admin side for each customer, it
> will only be loaded when the admin hits the /admin and then enter credentials, same for app … when certain email and
> password will be entered the admin app will be loaded. but dont show it publicly … just give that access to admin email."
> (founder brief) "So we need a very optimized admin side as well."
*Implementation (proposed):* the server enforces access (`profiles.role = 'admin'` **and** email in `ADMIN_EMAILS`) on every
admin page, API route and RLS policy. Hiding is only UX. Admin screens ship inside the mobile binary but aren't loaded until
the server confirms the role.

**D-007 · 2026-09-27 · founder: Two operators**
> "One founder operates on US side and one COO operates on Indian side."
*Proposed:* both have `role = 'admin'`. `profiles.desk` (`us` | `india`) picks the default dashboard. COO scope is open: Q-4.

**D-008 · 2026-09-27 · proposed: Delivery estimates come from cycle data and are honest**
Checkout shows an estimated delivery window computed from the open cycle's dates before payment, and it is stored on the order.
If a cycle slips past an order's window, the customer is notified and offered cancellation with a refund. Why: US FTC
Mail/Internet Order Rule (ship within the stated time, or within 30 days if no time is stated; delays need consent). Confirm with a lawyer.

**D-009 · 2026-09-27 · founder: Brand** "The Indian Wholesale Club", short "IWC".

**D-010 · 2026-09-27 · founder: The app shares the web's backend**
One Supabase backend for web + app (the existing setup). Realtime is part of the product ("realtime functional website").

**D-011 · 2026-09-27 · founder: Speed and real tests are top requirements**
> "the existing codebase is very very veryyy slow, loading takes a long time, endpoints take a long time, tests are trash,
> and even building takes a long time."
Performance budgets and the testing strategy are in `engineering.md`.

**D-012 · 2026-09-27 · founder: The docs must stop the model from inventing things**
> "Make the docs in such a way that the model does not hallucinate with its own answers, solutions and context."
Implemented as the rules in `CLAUDE.md`, decision IDs, `questions.md`, and evidence-only status.

**D-013 · 2026-09-27 · founder: Claude may reset the hosted Supabase dev DB** (test data only).
> "yes yes do whatever you feel like would be the best for IWC."

**D-014 · 2026-09-27 · founder: Git**
GitHub `yobslob/The-Indian_Wholesale-Club`, branch `main`. Baseline commit `d5342ae`, tag `pre-restructure` (pushed by founder).

**D-015 · 2026-09-27 · proposed: Keep the stack, rebuild how it's used**
Keep Turborepo + pnpm, Next.js (storefront + admin), Expo (app), Supabase (Postgres/Auth/Storage/Realtime), Stripe (USD),
Resend (email). Rebuild the domain, schema, data access, tests and docs. Why: the slowness comes from usage patterns (`engineering.md`
§Diagnosis), not from the frameworks.

**D-016 · 2026-09-27 · proposed: In code, a state or UT is a `region`**
`state` already means React state and the US address field. UI copy says "state" or "home".

**D-017 · 2026-09-27 · proposed: Customer reads only through `store_*` views/functions**
Base tables that hold vendor, cost or operations data are admin-only under RLS. Customer surfaces read whitelisted
columns through `store_*` views/functions. This makes D-003 structural and testable (INV-1 in `data-model.md`).

**D-018 · 2026-09-27 · proposed: Shops never get logins.** Founder/COO enter all shop data.

**D-019 · 2026-09-27 · proposed: Claude-drafted content is marked `draft`**
Region greetings, stories and taglines written by Claude are seeded with `content_status = 'draft'`. They are visible in the admin,
and the storefront shows them only after the founder approves them.

**D-020 · 2026-09-27 · proposed: Squash the 13 old migrations into one new baseline** (allowed by D-013).

**D-021 · 2026-09-27 · proposed: Verification runs on the founder's machine**
Claude's sandboxes can't reach npm, so `scripts/check.mjs` is the single verification run. Its output (`.checks/latest.json`)
is the only accepted evidence for build, test and speed claims.

**D-022 · 2026-09-28 · founder: Couriers are also expensive**
Adds to D-001: international couriers are not only slow but also very expensive for Indians living abroad.
> "takes a long time and is very expensive for Indian locals who are abroad."
(founder review comment on `product.md`)

**D-023 · 2026-09-28 · founder: The docs and all `proposed` decisions are approved**
The founder reviewed the R1 docs and approved them. Every entry marked `proposed` above (D-003 interpretation, D-004,
D-006 implementation, D-007 proposal, D-008, D-015 – D-021) now counts as `approved`. Every "current assumption" in
`questions.md` was accepted as the answer (recorded as D-024 – D-036 below).
> "All answers in Questions.md are assumed correctly and yes I do have docker desktop and you have the access for it and yes
> the above markdown is approved you can start."

**D-024 · 2026-09-28 · founder (was Q-1): Order-first only**
Build only the order-first flow (D-005). Keep room for a future faster option through `orders.fulfilment_mode`. Nothing else is built for it.

**D-025 · 2026-09-28 · founder (was Q-2): Retail to consumers.** No B2B or bulk pricing, and no membership. "Wholesale Club" is only the brand name.

**D-026 · 2026-09-28 · founder (was Q-3, first half): No fixed lead times**
Admins enter each cycle's dates (cutoff, estimated export, estimated arrival). Nothing is hard-coded. The US carrier is still open (Q-3).

**D-027 · 2026-09-28 · founder (was Q-4): The COO is a full admin**, with the same access as the founder. `desk` only picks the default screen.
Supersedes the "COO scope is open" note in D-007.

**D-028 · 2026-09-28 · founder (was Q-5, first half): No returns/exchanges flow in the restructure.** Policy text is still needed before launch (Q-5).

**D-029 · 2026-09-28 · founder (was Q-6): Payout records** hold the method, reference and an optional receipt photo.

**D-030 · 2026-09-28 · founder (was Q-7): Piece unavailable at pickup** → refund that item and notify the customer. No substitutes.

**D-031 · 2026-09-28 · founder (was Q-8): Local Supabase via Docker**
The founder has Docker Desktop. The new schema is developed and tested on local Supabase (`supabase start`) first. The hosted
dev DB is reset only when the app code matches the new schema (R5).

**D-032 · 2026-09-28 · founder (was Q-10, first half): Spice listings stay unpublished** until the FDA facility and labels
are settled (Q-10). Spices can still be drafted in the admin.

**D-033 · 2026-09-28 · founder (was Q-11): Sales tax is a flat 8% estimate for now.** Stripe Tax is a later option (F-2).

**D-034 · 2026-09-28 · founder (was Q-12): "Preparing your order"** is the customer-facing status while goods are in India or in transit.

**D-035 · 2026-09-28 · founder (was Q-13): The home page may show "Order by <date>"** for the next delivery window.

**D-036 · 2026-09-28 · founder (was Q-14): USD only, no compare-at prices.**

**D-037 · 2026-09-28 · proposed: Keep `node:test` + `tsx` as the unit-test runner**
Supersedes the "Vitest replaces node:test" line of the R1 `engineering.md` (approved in D-023). Why: the baseline test step
took 1.8 s (`.checks/baseline.json`), and Vitest would add a dependency without solving a measured problem. What was wrong
with the old tests was their content, not the runner (they asserted on SQL text).

