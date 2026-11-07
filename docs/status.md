# Status: where things stand, what is next

Short on purpose (the audit warns past 10 KB): **replace** lines when something changes, don't append. History:
`git log`, `docs/archive/status-to-2026-11-04.md` (what was built and every verification run from 2026-10-22 to
2026-11-04) and the older `docs/archive/status-to-2026-10-21.md`, `status-log-to-2026-10-11.md`.

## What is live today: the simple store
- **Live:** https://indianwholesaleclub.com (web), with real customers: the simple store (D-187), merged as
  [PR #1](https://github.com/yobslob/The-Indian-Wholesale-Club/pull/1) and deployed on 2026-11-04 (21:47 UTC).
- **Merged and deployed 2026-11-06 (08:38 UTC):** D-189 and D-190, [PR #2](https://github.com/yobslob/The-Indian-Wholesale-Club/pull/2). Vercel is on Pro (founder, 2026-11-07); ISR writes against reads not checked here yet.
- **Merged and deployed 2026-11-07 (00:33 UTC):** D-191, [PR #3](https://github.com/yobslob/The-Indian-Wholesale-Club/pull/3), with its two migrations (the Deploy workflow succeeded).
- **Merged and deployed 2026-11-07 (02:52 UTC):** D-192, [PR #4](https://github.com/yobslob/The-Indian-Wholesale-Club/pull/4) (coupons chosen in the bag, one bill, a card for each shipment).
- **Merged and deployed 2026-11-07 (05:56 UTC):** D-193, [PR #5](https://github.com/yobslob/The-Indian-Wholesale-Club/pull/5) (the first-order band, the Diwali flip, four ads under the navbar, the album faster and never paused).
- **Not released:** D-194 Phases 1 and 2 on branch `look-photos` (`docs/plan-look-photos.md`: each colour, pack and style shows its own photos where one is stored). No migration; no new photos yet.
- **Accounts (D-147):** Vercel Pro, Supabase free since 2026-10-21/22, photos in Cloudflare R2. Budgets and the
  weekly check: `monitoring.md`. The free database's memory is already over (1.57 of 1.4 GB, swap 406 MB on 2026-11-04,
  and it stopped answering for about 45 minutes that day).
- **Deploys:** the website once a day at 09:00 UTC from a green `main` (D-145); migrations only through the Deploy
  workflow, which the founder runs.
- **Catalogue (production copy of 2026-10-21; more has been added since):** 8,032 listings, 5,761 live (clothing 664,
  food 4,093, home 1,004), about 21,000 options, all photos in R2.

## What the simple store changed (D-187; the contract is `docs/archive/simple-store-plan.md` §1, §2, §10)
- **One store.** No 7-day store, vendors, vendor accounts, cycles, payouts, Express, the `house_models` table, the
  paused full price formula, the exchange-rate refresh, live stock on product pages, listing with the camera, festival
  clock, week strip, Lenis. 14 tables and two pg_cron jobs gone; one daily clean-up job
  (`iwc-tidy`) added.
- **Delivery days:** food 7, clothing and home & gifts 12 – 16, Monday to Friday from the order day. A bag with both
  always ships as two shipments. Orders already placed keep their dates. Already in the US stays calendar days.
- **Free shipping from $49.99** on every bag; bulk saving and the heavy-item discount stay at $99.99. No price changes
  (rehearsed: 0 differences of 29,212 options).
- **Stock is checked at checkout** (Remove / Keep n, payment locked until sorted) on the website and in the app.
- **Home:** hero → Diwali arches → mosaic → the first-order band (D-193) → Shop by category → Diwali night → What everyone missed this week → The
  kirana counter → Just listed Clothing → Just listed Home & gifts → Pick your home → the delivery band.
- **App 1.1.0** is built for this; whether it is published is not recorded here. The old app keeps working as a customer app (shims marked
  `TODO(D-187)`); **its admin mode breaks** with the release.

## Next for the founder
1. **D-194:** merge and deploy at a quiet hour; each deploy empties the page cache. Query L1 – L3 are in (`plan-look-photos.md` Phase 0 results); L4 and L5 and today's R2 GB are still wanted. **D-191:** a new app build carries the bill's coins, Popular and the sub-category chips. Your choices: the retailer % (1.5 on the 5 Nov copy, so the charge grows with the bag; Settings → Bag charges), the noodles photo's printed "₹15", the sub-categories' own photos (`sub-photos.ts`). Popular is an experiment: compare orders and average bag in Admin before and after.
2. **Names to tidy:** production's count (Y-11; the page and Rename all go only at 0).
3. In the order of use (each from the archived status, still open and not re-checked here):
   - **The photo redo** (D-164): pull on the laptop, `pnpm photos:redo fetch --type food --again` and `--type home
     --again`, `redo.py` per type, review, publish (`tools/photo-redo/README.md`). Men's faces work now (`m-1`, `m-2`).
   - **The description redo** (D-178): `pnpm descriptions:redo run --limit 100`, review, publish, then 3,000 a night.
   - **Savana, then NEWME** (D-171): Q-51 first; `targets/savana.csv` with `--photo-gb 1.8`, then `targets/newme.csv`.
     Publish in batches of 100 or fewer and watch Vercel ISR.
   - **Fast-shop sources** (D-162): `pnpm quick:sources` dry run, then `--apply` (`ops.md` §Sourcing runner, step 5).
   - **Admin's backlog** (D-146, D-159): Weights to check → Assign all and publish; Drafts → Archive the drafts that
     can't go live; Categories to check; Products → For: not set yet.
   - **Monitoring:** the set-up once (`monitoring.md` §5), then the Monday 15 minutes.
3. **Answer when convenient:** `questions.md`, above all Q-46 (nothing to pay at the door?), Q-60 (Home's poster after
   Diwali, Nov 8) and Y-15 (Diwali on Home after Nov 8: the founder decides after Diwali). Also the plan's §7 defaults,
   used because no other answer came: packing list and commercial invoice removed; every food listing promises 7 delivery
   days, slower shops too; US public holidays count as delivery days; food that cannot reach the hub fast stays live.
4. **Founder's choices seen while building:**
   - **"Orders to ship" counts almost nothing.** Today and the sidebar count `arrived`, which only US-clearance orders
     reach; a hub order ready to go has no queue. Already so in the pilot. Optional fix: count open shipments whose pieces
     are all at the hub (one small read per admin page).
   - **The 25 `… (7-day)` rows** in `tools/sourcing-runner/targets/diwali-home-gifts.csv` keep their names: a rename means
     not re-uploading the list (row names are the skip key).
   - **A clearance piece's card** says the standard days (a card does not know `is_us_stock`); its page and checkout are
     right. Fixing it needs a new card key.

## Not built yet
- **D-194:** Phase 0's numbers and 20-page sample (the founder's machine and production), the orphan report, the backfill (Phase 3), new listings (Phase 4). Until the backfill, Amazon listings look as before. The app gets the swap in its next build; its product screen ignores the tags today.
- App: the bag's coupons and the one bill (it keeps typing a code, D-191, D-192); push notifications for new orders; the card's − n +, the For filter and the jewellery drawer.
- Admin: "Select all n matching" bulk actions and search on Reviews and Returns.
- Size charts from the shops (Q-39); invoice A with the confirmation email; `CHECK_LIVE_SITE`'s production photo check.
- From the backlog: the Expo SDK 52 upgrade (B-9); checkout's round-trip budget (B-21); review photos through fixed copies
  (B-24). Deferred: US labels (Q-3), Stripe Tax, offline drafts, "Ask for it from home", notify-me, gift boxes.

## Known leftovers
- **After app 1.1.0 is the minimum:** the `TODO(D-187)` shims come out; those marked "drop after the release" can go
  once the new site is up.
- Stale comments in the code that name what left: `apps/web/features/admin/ui.tsx` line 10, `packages/tokens/tokens.js`
  line 3 (`design/`); `supabase/seed/catalogue.sql` line 2, `supabase/seed/estimates.sql` line 4 (removed commands);
  `shop_label` still sent by `packages/shared/src/sourcing/auto/listing.ts` and ignored.
- **From the QA pass of 2026-10-24:** the GitHub repo is public (the shops, pricing rules and margins in the docs; no
  secrets found); food and home packs come as the shops write them; many food photos are the shops' thumbnails.
- **Storage, suspected and not fixed (2026-10-30):** a re-import's "replace details" deletes old copies at once while a
  cached page may still show them; an abandoned upload stays under `products/drafts/`; `worker_photo_redo_drop` lets the
  worker account remove any listing's photo.
- `android.versionCode` is not set (`apps/app/app.json`, `eas.json`): check it at the first Play production build.
- Some imported listings are not homesick goods (dog chews, toilet rolls): look in Products before the next round.

## Last verification
<!-- The verifier (plan §5 Phase 3 · Agent V) records the branch's full check here. Replace this table's row. -->
| Date | Commit | Where | Result |
|---|---|---|---|
| 2026-11-07 | D-194 Phases 1 and 2 on top of D-193 (branch `look-photos`) | Claude Code, Windows 11, local Supabase | `node scripts/check.mjs docs typecheck lint test build http` pass, nothing over budget (`/` 11 ms, 133 KB JS; product page 142 KB; `/states/kerala` 150 KB); `db` passed before the last small changes. Full e2e on the code before the last file split: 96 passed, 2 skipped, 4 failed in `customer-choices`, `one-payment` and `phone-flows`: "Too many requests" for the test customer and a slow Stripe page. Those three specs passed alone with the local `rate_limit_hits` cleared (13 of 13), and `look-photos`, `card-bag` and `rows` passed on the final build (15 of 15). `bundle` not run: no app change. Phone check on a simulated Pixel 7 with stand-in photos, not on a physical phone; no real tagged listing checked, as the local database has none. |
