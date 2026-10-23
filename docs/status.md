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
- **Database:** every migration up to `20261022120000_seven_day_delivery` (D-148) is applied (the founder ran the
  Deploy workflow on 2026-10-22, per their message).
- **Sourcing runner (India PC):** its `.env` pointed at the old Supabase project until 2026-10-22 (the move's step 7,
  `ops.md`); fixed by the founder. The Blinkit 7-day CSV is in (102 targets added, 11 already there). **Blinkit blocks
  the runner** from 2026-10-22: the cause was headless Chrome (`IWC_SOURCING_HEADLESS=1` in its `.env`); the runner now
  always opens a window (D-151) and Blinkit reads again; a shop that still blocks rests (D-149). The 7-day targets
  search all four quick shops (D-150); Zepto and Instamart read again since D-152 (their readers had not matched the
  shops' data; the food run of 22:13 UTC added 76 listings through them and BigBasket). The runner now keeps each quick shop to
  60 – 90 pages an hour and believes a shop's Retry-After (D-153): Blinkit asked for about 20½ hours on 2026-10-22, so
  it rests until about 18:46 UTC on 2026-10-23; BigBasket rests until 00:35 UTC.
- **Catalogue (production copy of 2026-10-21):** 8,032 listings: 5,761 live (clothing 664, food 4,093, home 1,004),
  2,180 drafts, 91 archived; no placeholders left. 20,896 options, 34,915 photos (all in R2).
- **Deploys:** the website once a day at 09:00 UTC from a green `main` (D-145); migrations only through the Deploy
  workflow, which the founder runs.

## What is built (details in the doc named; decisions in `decisions.md`)
- **7-day store and two shipments (D-154, approved 2026-10-23, being built in five steps):** 1 database (shipments, Shipping
  at $18.62 a billed kg, the $49.99 line), 2 admin, 3 bag and checkout, 4 the store switch and front page, 5 Insights.
  Step 1 built (migration `20261023120000_seven_day_shipments`, not deployed): Shipping $18.62 a billed kg, the $49.99
  line, `order_shipments`, the 12 – 16 window. Step 2 built (migration `20261024090000_shipment_admin`, not deployed):
  each shipment ships, is delivered, gets new dates and is cancelled on its own (order page, emails), To order's 7-day
  lane, Today's 7-day count, the pause switch in Settings; an order without a cycle (the pilot) now ships from the hub
  once its pieces are there. Step 3 built (migration `20261025090000_bag_shipments`, not deployed): the bag (web and
  app) under its shipments' dates with the 7-day meter, the pill's notes with Undo (web), checkout's shipments after the
  address, the customer's order page per shipment. Step 4 built (migration `20261026090000_seven_day_store`, not
  deployed): the store switch at the top of the header (web) and of Home and the 7-day screen (app), the 7-day front
  page (date, tiles, Most ordered this week, Under $5, New this week), its header categories and search, See all's and
  search's "Delivery: in 7 days", the product page's line, Home's "Arrives in 7 days" row; not built: "From your state"
  (no chosen state is kept). Until the Deploy workflow runs, production keeps D-148 and the top-up.
- **7-day delivery (D-148, deployed 2026-10-22):** `/7-day-delivery` lists every piece bought from Blinkit,
  BigBasket, Zepto or Instamart; cards say "In 7 days"; a bag of only such pieces gets the 7-day window (Settings, 7 – 7)
  at checkout and on its order; Home's line reads "Want in 7 days? Click here." No shop is named anywhere.
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
1. **The Blinkit 7-day batch (D-148 – D-151).** Upload `tools/sourcing-runner/out/7-day-four-shops.csv` again
   (Admin → Import → Auto-sourcing → Add targets from a CSV): the first upload ran before the new admin was live; the
   message should say "(102 of them now search more shops)". Then on this PC `pnpm sourcing run --targets --type food`
   (and `--type home`), once a day, e.g. from Task Scheduler; about 65 food targets claimed by the run stopped on
   2026-10-22 come back to the queue at 02:37 UTC (08:07 in India) by themselves. At the hourly limits the batch fills
   over several daily runs. The window opens off-screen; leave
   `IWC_SOURCING_HEADLESS=1` or delete the line, it is ignored. If a shop still blocks, each run asks it twice at most
   and rests it (2, 6, then 24 hours); its targets stay waiting and nothing is marked nothing fit or sold out
   (`out/blocks/` shows what it answered). The Deploy workflow's database and website steps succeed; it ends red
   only because Expo's free Android builds are used up until 2026-11-01. Ctrl+C now puts the run's
   targets back at once; the 64 claimed by the stopped run of 2026-10-22 come back by themselves six hours after it.
   Against the limits (from production's 8,032 listings, 34,915
   photos, about 4 – 5 GB in R2, 78 MB of catalogue): **R2** about 0.6 MB a listing → about 1.8 GB, to about 6 – 7 GB
   of 10 (past the 6 GB budget, under the 9 GB line; about 26,000 writes of 1M); **database** about 10 KB a listing →
   about 30 MB, to about 110 MB of 500; **Vercel** each new product page is a page-cache write when first visited
   (about 20 units of 8 KB), up to about 60,000 of the 100,000 monthly budget if every page is crawled, plus one store
   refresh per bulk publish: publish in three weekly batches of about 1,000 and read Usage → ISR each Monday;
   **Supabase egress** small (photos go straight to R2). A whole-Blinkit copy (well over 10,000 items) would not fit
   in R2's 10 GB.
2. **Clear the admin's backlog (D-146), in this order:** Products → **Weights to check → Assign all and publish** (about
   2,600 listings, a minute or two; it reports what it did) · **Drafts → Archive the drafts that can't go live** (80 on
   the production copy, no photo) · **Names to tidy → Rename all** (about 770). Drafts are then empty for new batches.
   Estimated weights are marked "Estimated": weigh pieces at the hub as they are picked and they are replaced.
3. **Monitoring:** set up the weekly check once (`monitoring.md` §Set-up: usage alerts in Vercel and Supabase,
   `CHECK_LIVE_SITE`, a free uptime ping), then the Monday 15 minutes it lists.
4. **Products → For: not set yet** (235 clothing listings on the production copy): Women / Men / Kids / Everyone.
5. **Settings → Bag charges → "Shipping shown when free"** ($ a kg; empty keeps $18.79 struck).
6. **Answer:** Q-36 (courier bills by size?), Q-37 (lights, gobar, powders), Q-38 (live Kids listings), Q-39 (interim
   size line), Q-40 (footwear in the drawer), Q-42 (the Blinkit CSV's band and
   leave-outs); approve D-148's drafted words (the 7-day page, the tag, the bag and product-page lines); whether ghee and honey sold by the litre count as liquids (D-135 says
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
- App: the product page's 7-day date (`store_product_page().quick_delivery`, D-148; the 7-day screen, tag, Home line
  and Bag line are built); an admin switch for `sourcing_shops.quick_delivery`.
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
| 2026-10-24 | D-154 step 4 (the 7-day store: switch, front page, filter, search) | Claude Code, founder's Windows machine with Docker (`check.mjs` all steps) | docs 0.6 s, typecheck 21.2 s, lint 23.9 s, test 3.7 s (323, the 7-day date), db 57.7 s (new `seven_day_store.test.sql` 16: See all's filter and count, the store's search, the front page's tiles and rows, the policy, the pause), build 62.6 s, http 2.9 s (/ 15 ms 132 KB, /clothing 10 ms **150 KB, at the budget** (150.2 KB measured: the switch's script is on every page), search 57 ms), bundle 16.3 s: OK. e2e: 27 passed, 6 failed, 1 skipped; both `seven-day-bag.spec.ts` tests passed (the new one: the switch opens the 7-day store with its date, its search finds the 7-day snack, IWC returns to /clothing). The six are step 3's paid checkouts stopped at Stripe's hCaptcha. In the browser on a local dev server with 8 local placeholder 7-day pieces: the switch (desktop and 375 px), the thumb and gold stitch in the 7-day store, the header's categories, tiles and pills carrying ?category=, the 7-day search, search's and See all's "Delivery: in 7 days", the product page's line (no tag on its own section), Home's row, ← → between the tabs; the app's web build: the switch on Home and the 7-day screen, the rows, IWC back to Home. **Not run:** the app on a phone, the 240 ms motion by eye at full speed, production. |
| 2026-10-24 | D-154 step 3 (the bag and checkout show two shipments) | Claude Code, founder's Windows machine with Docker (`check.mjs` all steps; build, e2e and bundle again after a restart stopped the first run) | docs 0.7 s, typecheck 22.5 s, lint 21.8 s, test 4.3 s (320, new `bag-shipments.test.ts`), db 64.0 s (`shipments.test.sql` 23: the bag's 7-day ids and dates, no weight in its answer), build 170.0 s, http 3.1 s (/ 13 ms 131 KB, /clothing 7 ms 149 KB), bundle 47.1 s: OK. e2e: 26 passed, 6 failed, 1 skipped; the new `seven-day-bag.spec.ts` passed (a 7-day snack under the line, alone at $50, split with the demo saree, both shipments at checkout). The six all stop after Pay at Stripe's hCaptcha (in the trace), step 2's five and `sold-out.spec.ts`, which pays the same way. In the browser on a local dev server: the pill with both meters, the bag under the line with Shop the 7-day store, at $50 one 7-day group with its note and Shipping struck through ($27.93 → $0), split groups with Shipping $37.24, and the note "Shipping is now $37.24 until $149.99." with Undo putting the bag back. **Not run:** a paid two-shipment order end to end (the captcha), the app's Bag on a phone, production. |
| 2026-10-24 | D-154 step 2 (two shipments in the admin) | Claude Code, founder's Windows machine with Docker (`check.mjs` all steps) | docs 0.6 s, typecheck 18.4 s, lint 19.4 s, test 3.7 s (new shipment email and ship-rule tests), db 53.0 s (new `shipment_admin.test.sql` 30: two parcels with two shipped emails, a refunded 7-day piece leaving the second shipment untouched, cases 23 – 24 and 28 – 29), build 75.4 s, http 3.6 s (/ 13 ms 129 KB, /clothing 7 ms 146 KB), bundle 40.2 s: OK. e2e: 27 passed, 5 failed, all five paid checkouts: after Pay, Stripe's page loads an hCaptcha challenge (`api.hcaptcha.com/getcaptcha` in the trace) and never sends the confirm; `/api/checkout` answered 200 with its payment intent. Stripe challenges the automated browser, not this step (likely step 1's four too). In the browser on a local dev server, a local two-shipment order (5 snacks from a Blinkit listing and a kurta): the Shipments panel with both shipments, their dates, Shipping shares ($9.91 + $18.02 = $27.93), buy-by / ship-by and cancel amounts; marking the snack picked brought shipment 1's Pack & ship and took its cancel away; shipping it left the order Confirmed, shipment 2 open, and queued one shipped email naming shipment 1. **Not run:** the emails sent through Resend, the Settings pause and To order's lane in a browser, production. |
| 2026-10-23 | D-154 step 1 (shipments, Shipping per kg) | Claude Code, founder's Windows machine with Docker (`check.mjs` all steps) | docs, typecheck, lint, test, db (new `shipments.test.sql` 21, `bag_charges` 13, `seven_day` 19), build 83.9 s, http (/ 15 ms 129 KB, /clothing 15 ms 146 KB), bundle: OK. e2e: 28 passed, 4 failed, all four paid checkouts stuck at Stripe's confirm (no order request followed); the same four failed on the previous commit 10b7b08 built apart against the same local database, and `checkout.spec` passed alone: a Stripe test-mode flake, not this step. **Not run:** production. |
| 2026-10-23 | D-153 (hourly pace per quick shop, Retry-After believed, five-hour stop) | Claude Code, founder's Windows machine (`check.mjs docs typecheck lint test`) | docs 1.8 s, typecheck 41.7 s, lint 31.4 s, test 4.4 s: OK (`shop-rest.test.ts` 9, 3 new). With a stand-in browser: 60 pages counted in the hour from the pace file; a 429 with Retry-After 73,954 s rested Blinkit at once for 20½ h and the next ask was not sent (test files removed). **Not run:** a live run at the limits (Blinkit and BigBasket rest), a five-hour run. |
| 2026-10-23 | D-152 (Zepto and Instamart readers) | Claude Code, founder's Windows machine (the India runner PC; `check.mjs docs typecheck lint test`) | docs 0.7 s, typecheck 24.5 s, lint 25.6 s, test 3.6 s: OK (4 new reader tests on fixtures trimmed from the shops' real answers). Live, dry runs only (nothing written), `--shops zepto.com,swiggy.com`: makhana Zepto 40 / Instamart 49 results, ghee 47 / 51, toor dal 29 / 40, basmati rice 49 / 55, haldi powder 23 / 60; each made 3 listings ready from item pages read back (Instamart with its pack sizes, Zepto as listings and backups). No block page from either. **Not run:** a full `run` against production, the weekly check of a listing already sourced from these shops. |
| 2026-10-23 | D-151 (the runner never browses headless) | Claude Code, founder's Windows machine (the India runner PC; `check.mjs docs typecheck lint test`) | docs 1.0 s, typecheck 20.7 s, lint 28.5 s, test 3.7 s: OK. Live, dry runs only (nothing written): the runner headless (as its `.env` says) got Blinkit's block page 4 of 4 times; the same command in a window got 28 results and 2 listings ready; with the fix and the `.env` unchanged, Blinkit 28 results and a listing ready; all six food shops answered (Flipkart 38, Blinkit 24, Amazon 56, BigBasket 21, Zepto 0, Instamart 0; Zepto and Instamart 0 for makhana too). **Not run:** a full `run` against production. |
| 2026-10-23 | D-150 (a re-uploaded target takes the row's shops) | Claude Code, founder's Windows machine (`check.mjs docs typecheck lint test`) | docs 0.9 s, typecheck 25.2 s, lint 44.8 s, test 4.3 s: OK (2 new `widenedSites` tests). `addTargets` on the **local** database: a Blinkit-only target uploaded again with four shops → 0 added, 1 widened, sites blinkit, bigbasket, zepto, swiggy, still waiting; the same or no shops change nothing (test row removed). `7-day-four-shops.csv` read by the importer's parser: 113 rows, 0 errors. **Not run:** the admin page's message in a browser, production (needs the push and the daily deploy). |
| 2026-10-23 | D-149 (the runner rests a blocking shop) | Claude Code, founder's Windows machine (the India runner PC; `check.mjs docs typecheck lint test`) | docs 0.6 s, typecheck 24.2 s, lint 31.8 s, test 3.9 s: OK (new `shop-rest.test.ts`, 6). Live, dry runs only (nothing written): Blinkit answered 403 `cf-mitigated: challenge` with its "Verify you are human" page; the runner waited 22 s, called it a robot check and saved `out/blocks/` (screenshot + words); a stand-in browser showed two robot checks rest the shop (2 of 4 asks reached it) while another shop carried on; `shop-rest.json` written and read back (test file removed). **Not run:** a full `run` against production, `check.mjs` db/build/e2e (runner-only change). |
| 2026-10-22 | app D-148 (7-day screen, tag, Home and Bag lines) | Claude Code, founder's Windows machine (`check.mjs typecheck lint test`) | typecheck 32.1 s, lint 56.1 s, test 5.6 s: OK (app tests 11, new `seven-day.test.ts`). In the app's web preview (`app-web`) on the local database with three local pieces briefly marked Blinkit (undone): Home's line, the 7-day screen and a pill, the tag on the region page, the Bag line, gone with one other piece. **Not run:** a phone or emulator (Android build), db, build, e2e. |
| 2026-10-22 | 9ae158b + D-148 (7-day delivery) | Claude Code, founder's Windows machine with Docker (`check.mjs` all steps) | docs 0.8 s, typecheck 31.4 s, lint 63.0 s, test 6.1 s, build 104.1 s, http 4.5 s (/ 15 ms, /states/kerala 13 ms, /clothing 11 ms; / 129 KB first-load JS, none over budget), e2e 127.1 s, bundle 49.7 s: OK. db FAIL on the first run: `schema.test.sql`'s list of functions customers may call lacked the two new `store_quick_*` functions; added, db re-run alone OK 56.7 s (58 files, incl. new `seven_day.test.sql`, 19 assertions). In the browser on a local dev server with six local Blinkit pieces: Home's line, the 7-day page and its pills, the tag on See all, the bag line and the product page's date; no shop name in the page source. **Not run:** production (needs the Deploy workflow), the app. |
