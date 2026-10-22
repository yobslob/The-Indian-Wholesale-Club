# Status: where things stand, what is next

Short on purpose: **replace** lines when something changes, don't append. History: `git log`,
`docs/archive/status-log-to-2026-10-11.md` (every phase step and verification run to 2026-10-11),
`docs/archive/status-to-2026-10-21.md` (the long Built list and every verification run to D-145) and the archived plans
(`docs/archive/plan-roadmap-r0-r8.md`, `plan-coding-c1-c8.md`, `plan-design-v6.md`, `backlog-b1-b24.md`).

## Production today (2026-10-22)
- **Live:** https://the-indian-wholesale-club.vercel.app (web) and the Android app (EAS). Real customers since mid-October;
  the pilot is made to order (D-115): a sold piece is ordered from its Indian shop to the hub and flown over.
- **Accounts (D-147, `ops.md` §Accounts and limits):** a **new Vercel** (Hobby) and a **new Supabase** project (free)
  since 2026-10-21/22, both near zero; photos stay in **Cloudflare R2** (D-141). The first accounts ran out of Vercel's
  image optimisation and page-cache writes and Supabase's storage; they are no longer used. Each limit now has a budget
  and a weekly check: `monitoring.md`.
- **Database:** every migration up to `20261021090000_low_to_high` is applied (restored with the data on the new
  project). Waiting for the Deploy workflow: `20261022090000_assign_weights` (D-146).
- **Catalogue (production copy of 2026-10-21):** 8,032 listings: 5,761 live (clothing 664, food 4,093, home 1,004),
  2,180 drafts, 91 archived; no placeholders left. 20,896 options, 34,915 photos (all in R2).
- **Deploys:** the website once a day at 09:00 UTC from a green `main` (D-145); migrations only through the Deploy
  workflow, which the founder runs.

## What is built (details in the doc named; decisions in `decisions.md`)
- **Storefront** (`storefront.md`): Home (hero, the album of all India, Pick your home, three Just listed rows), 36
  state pages, See all with filters and low-to-high (D-136, D-144), the jewellery drawer, product pages, bag with the
  free-delivery pill, checkout (phone → delivery → payment, saved addresses), order tracking, account, reviews,
  info panel, emails. App: the same customer side.
- **Pricing** (`pilot-numbers.md`): beta pricing, the founder's exact rules in code (D-127, D-128); Shipping $18.79 +
  Retailer charges $1.99 below $149.99, struck through above it with the bulk saving (D-112, D-119, D-125).
- **Admin** (`admin.md`): Today, Orders, To order (order from the shop in one tap), invoices A / B / C, Products with
  filters, pager, Download Excel, Weights to check, Names to tidy, For; Import from shops (bookmark, pasted links);
  Auto-sourcing targets; Settings with the profit check; vendor accounts and Vendor pieces; app admin mode.
- **Weights** (D-129 – D-135, D-146): every option's weight says where it came from; clothing by class, food by the
  label's net quantity, home from its own page; the hub weighs pieces as they are picked; **Assign all and publish**
  gives every missing weight one (similar pieces weighed before, else the category) and publishes.
- **Tools on the founder's machines** (`ops.md` §Tools): the sourcing runner (India PC: auto-sourcing, weekly price and
  stock check, weights, liquids), the weight estimator (laptop GPU), the photo worker (vendor AI photos),
  `pnpm photos:move` (the R2 move, finished).
- **Speed and limits:** store pages from Vercel's cache (`/clothing` 7 – 18 ms on a local production build); photos as
  fixed AVIF copies from `/media/s/` (no resizer); narrow page refreshes (D-145).

## Next for the founder
1. **Run the Deploy workflow** (applies `20261022090000_assign_weights`); the website follows the next morning, or
   Actions → Daily website deploy → Run workflow at once.
2. **Clear the admin's backlog (D-146), in this order:** Products → **Weights to check → Assign all and publish** (about
   2,600 listings, a minute or two; it reports what it did) · **Drafts → Archive the drafts that can't go live** (80 on
   the production copy, no photo) · **Names to tidy → Rename all** (about 770). Drafts are then empty for new batches.
   Estimated weights are marked "Estimated": weigh pieces at the hub as they are picked and they are replaced.
3. **Monitoring:** set up the weekly check once (`monitoring.md` §Set-up: usage alerts in Vercel and Supabase,
   `CHECK_LIVE_SITE`, a free uptime ping), then the Monday 15 minutes it lists.
4. **Products → For: not set yet** (235 clothing listings on the production copy): Women / Men / Kids / Everyone.
5. **Settings → Bag charges → "Shipping shown when free"** ($ a kg; empty keeps $18.79 struck).
6. **Answer:** Q-36 (courier bills by size?), Q-37 (lights, gobar, powders), Q-38 (live Kids listings), Q-39 (interim
   size line), Q-40 (footwear in the drawer); whether ghee and honey sold by the litre count as liquids (D-135 says
   yes); confirm with the courier that ₹2,000 a kg includes the box and clearance.
7. **Real bills for Settings** (D-069): one courier invoice and one duty bill, then the per-parcel cost, duty by type,
   parcel kg and the small-food limits; watch the profit check.
8. **Bulk sourcing** (D-137 – D-139): one product type per machine (`pnpm sourcing run --type food|home|clothing`);
   pull the code on the hub PC first; the target CSVs in `tools/sourcing-runner/targets/` go in through Admin → Import
   → Auto-sourcing → Add targets from a CSV.
9. **Decide when convenient:** the name "Food" and 5 pieces per size by default (D-110); D-118's proposals (3 listings
   per target, the 60% rise / 50% fall guard, drafts until published, 40 targets a day); D-120's (₹200, 250 g, half the
   shipping share); D-105's vendor-screen drafts; the four men house models (D-104); Q-35 (US stores).
10. **Before the launch proper:** Q-3 (US carrier), Q-9 (domain and support email), Q-32 (holding a piece while paying).

## Not built yet (known, in order of use)
- App: push notifications for new orders; the card's − n +, the For filter and the jewellery drawer.
- Admin: "Select all n matching" bulk actions and search on Reviews, Vendor pieces and Returns (plan F10).
- Size charts from the shops (plan S3, Q-39); invoice A sent with the confirmation email (F4); the stitch on the
  free-delivery meter and as section dividers (F7); the empty-band test; the production photo check in
  `check.mjs http` (`CHECK_LIVE_SITE` exists).
- Carried from the backlog: the Expo SDK 52 upgrade and its workarounds (B-9); checkout's round-trip budget, 2 or 3
  (B-21, founder); Realtime Broadcast for stock once product pages have hundreds of viewers (B-22); a retention period
  for `search_queries` (B-23, founder); review photos through fixed copies (B-24).
- Deferred features: US labels (F-1, Q-3), Stripe Tax (F-2), offline drafts (F-3), "Ask for it from home",
  notify-me, gift boxes (F-6).

## Known leftovers
- App bundle ids are still `com.indianwholesaleclub.app` (`apps/app/app.json`); they change with the domain (Q-9).
- `supabase/config.toml` uses the deprecated `[inbucket]` section (a harmless CLI warning).
- Some imported listings are not homesick goods (dog chews, toilet rolls, skewers seen on the production copy):
  worth a look in Products → search before the next sourcing round.

## Last verification
| Date | Commit | Where | Result |
|---|---|---|---|
| 2026-10-22 | D-146 / D-147 commits | Claude, cloud sandbox: Postgres 16 with the Supabase stand-in, the founder's `node_modules` (no Docker, no Next build) | all 83 migrations on a fresh database, 57/57 SQL test files (new `assign_weights.test.sql`, 26 assertions); on a copy of production's catalogue (8,032 listings): Assign all weighed 4,224 options in 32 batches (worst 3.3 s), accepted 3,654, published 2,100 drafts (3.6 s), archived 80; Rename all 770 + 5 then none left; prices of the newly weighed listings in line with live ones (home median $19.59 vs $24.61). tsc clean for shared and db; web clean but for 3 implicit-any errors the sandbox also had before; shared unit tests 289/290 (the one failure is the sandbox's `__filename`, as before); docs audit OK. **Not run:** ESLint with its resolver, `next build`, e2e, http, the app; production. Run `node scripts/check.mjs` on the Windows machine before pushing. |
