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
  the runner** since 2026-10-22 (Cloudflare, "Verify you are human"): the runner now rests a blocking shop (D-149).
- **Catalogue (production copy of 2026-10-21):** 8,032 listings: 5,761 live (clothing 664, food 4,093, home 1,004),
  2,180 drafts, 91 archived; no placeholders left. 20,896 options, 34,915 photos (all in R2).
- **Deploys:** the website once a day at 09:00 UTC from a green `main` (D-145); migrations only through the Deploy
  workflow, which the founder runs.

## What is built (details in the doc named; decisions in `decisions.md`)
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
1. **The Blinkit 7-day batch (D-148, D-149).** Pull the code on the India PC, then run
   `pnpm sourcing run --targets --type food` (and `--type home`) once a day, e.g. from Task Scheduler. While Blinkit
   blocks, each run asks it twice at most and rests it (2, 6, then 24 hours); its targets stay waiting and nothing is
   marked nothing fit or sold out. `out/blocks/` shows what Blinkit answered. Answer **Q-43** (may these targets also
   search BigBasket, Zepto and Instamart?) to keep the batch filling while Blinkit refuses. Ctrl+C now puts the run's
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
   size line), Q-40 (footwear in the drawer), Q-41 (is 7 days true every day?), Q-42 (the Blinkit CSV's band and
   leave-outs), Q-43 (the 7-day targets on all four quick shops); approve D-148's drafted words (the 7-day page, the tag, the bag and product-page lines); whether ghee and honey sold by the litre count as liquids (D-135 says
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
| 2026-10-23 | D-149 (the runner rests a blocking shop) | Claude Code, founder's Windows machine (the India runner PC; `check.mjs docs typecheck lint test`) | docs 0.6 s, typecheck 24.2 s, lint 31.8 s, test 3.9 s: OK (new `shop-rest.test.ts`, 6). Live, dry runs only (nothing written): Blinkit answered 403 `cf-mitigated: challenge` with its "Verify you are human" page; the runner waited 22 s, called it a robot check and saved `out/blocks/` (screenshot + words); a stand-in browser showed two robot checks rest the shop (2 of 4 asks reached it) while another shop carried on; `shop-rest.json` written and read back (test file removed). **Not run:** a full `run` against production, `check.mjs` db/build/e2e (runner-only change). |
| 2026-10-22 | app D-148 (7-day screen, tag, Home and Bag lines) | Claude Code, founder's Windows machine (`check.mjs typecheck lint test`) | typecheck 32.1 s, lint 56.1 s, test 5.6 s: OK (app tests 11, new `seven-day.test.ts`). In the app's web preview (`app-web`) on the local database with three local pieces briefly marked Blinkit (undone): Home's line, the 7-day screen and a pill, the tag on the region page, the Bag line, gone with one other piece. **Not run:** a phone or emulator (Android build), db, build, e2e. |
| 2026-10-22 | 9ae158b + D-148 (7-day delivery) | Claude Code, founder's Windows machine with Docker (`check.mjs` all steps) | docs 0.8 s, typecheck 31.4 s, lint 63.0 s, test 6.1 s, build 104.1 s, http 4.5 s (/ 15 ms, /states/kerala 13 ms, /clothing 11 ms; / 129 KB first-load JS, none over budget), e2e 127.1 s, bundle 49.7 s: OK. db FAIL on the first run: `schema.test.sql`'s list of functions customers may call lacked the two new `store_quick_*` functions; added, db re-run alone OK 56.7 s (58 files, incl. new `seven_day.test.sql`, 19 assertions). In the browser on a local dev server with six local Blinkit pieces: Home's line, the 7-day page and its pills, the tag on See all, the bag line and the product page's date; no shop name in the page source. **Not run:** production (needs the Deploy workflow), the app. |
