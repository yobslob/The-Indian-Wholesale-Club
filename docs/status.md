# Status: where things stand, what is next

Short on purpose (the audit warns past 10 KB): **replace** lines when something changes, don't append. History:
`git log`, `docs/archive/status-to-2026-11-04.md` (what was built and every verification run from 2026-10-22 to
2026-11-04) and the older `docs/archive/status-to-2026-10-21.md`, `status-log-to-2026-10-11.md`.

## What is live today: the OLD store
- **Live:** https://indianwholesaleclub.com (web) and the Android app 1.0.0, with real customers. It is still the store
  from before D-187: the 7-day store, Express, the $99.99 free line, the old database.
- **Not released:** the simple store (D-187) is **built on branch `cleanup/simple-store`**, not merged, not deployed. No
  migration of it has touched production. Until the founder runs `docs/release-simple-store.md`, every doc in this repo
  describes what the branch does, not what customers see.
- **Accounts (D-147):** Vercel (Hobby) and Supabase (free) since 2026-10-21/22, photos in Cloudflare R2. Budgets and the
  weekly check: `monitoring.md`. The free database's memory is already over (1.57 of 1.4 GB, swap 406 MB on 2026-11-04,
  and it stopped answering for about 45 minutes that day).
- **Deploys:** the website once a day at 09:00 UTC from a green `main` (D-145); migrations only through the Deploy
  workflow, which the founder runs.
- **Waiting for the Deploy workflow:** the three new migrations (`20261109090000_simple_rules`,
  `20261109090100_simple_reads`, `20261109090200_simple_drops`). The Deploy of 2026-11-03 on `88b2f82` found production up
  to date, so nothing older is waiting (D-187's "same release" note no longer applies).
- **Catalogue (production copy of 2026-10-21; more has been added since):** 8,032 listings, 5,761 live (clothing 664,
  food 4,093, home 1,004), about 21,000 options, all photos in R2.

## What the branch changes (D-187; the contract is `docs/archive/simple-store-plan.md` §1, §2, §10)
- **One store.** No 7-day store, vendors, vendor accounts, cycles, payouts, Express, the `house_models` table, the
  paused full price formula, the exchange-rate refresh, live stock on product pages, listing with the camera, festival
  clock, week strip, Lenis, the hidden $1 payment page. 14 tables and two pg_cron jobs gone; one daily clean-up job
  (`iwc-tidy`) added.
- **Delivery days:** food 7, clothing and home & gifts 12 – 16, Monday to Friday from the order day. A bag with both
  always ships as two shipments. Orders already placed keep their dates. Already in the US stays calendar days.
- **Free shipping from $49.99** on every bag; bulk saving and the heavy-item discount stay at $99.99. No price changes
  (rehearsed: 0 differences of 29,212 options).
- **Stock is checked at checkout** (Remove / Keep n, payment locked until sorted) on the website and in the app.
- **Home:** hero → Diwali arches → mosaic → Shop by category → Diwali night → What everyone missed this week → The
  kirana counter → Just listed Clothing → Just listed Home & gifts → Pick your home → the delivery band.
- **App 1.1.0** is built for this and not yet published. The old app keeps working as a customer app (shims marked
  `TODO(D-187)`); **its admin mode breaks** with the release.

## Next for the founder
1. **The release: `docs/release-simple-store.md`, in order.** Before it: production's **Names to tidy** count (Y-11; the
   page and Rename all go only at 0), the backup, the pre-check, the checksum.
2. After the release, in the order of use (each from the archived status, still open and not re-checked here):
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
- App: push notifications for new orders; the card's − n +, the For filter and the jewellery drawer.
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
| 2026-11-05 | `5c3c9e8` (only the founder's untracked `hero_updated.png` beside it) | Claude Code (Agent V), Windows 11, local Supabase | `node scripts/check.mjs`, all steps: docs OK 0.3 s, typecheck OK 24 s, lint OK 27 s, test OK 5 s, db OK 54 s (66 SQL files, 0 failed), build OK 77 s, http OK 4 s (nothing over budget), **e2e FAIL 551 s (77 passed, 3 failed, 2 skipped: `phone-flows` 4242, 3-D Secure approved and failed, each on a payment or start-of-checkout error; cause not established)**, bundle OK 20 s. Then: `phone-flows` alone 7 of 7; the whole e2e again on a fresh build 80 passed, 0 failed, 2 skipped; the skipped multi-price spec with a local fixture passed; `@stripe-listen` not run. Findings: `.checks/simple-store/V.md` |
