# The simple store's release: the founder's runbook (D-187)

Do these in order. Nothing is skipped and Claude runs none of it: Claude never touches production. Give yourself a quiet
hour for the Deploy part. Nothing is dropped from the database until step 12.

**The one thing to remember:** the new website must not go out on the old database. Migrations first, then the website.

## Before the day
1. **Check that the branch is finished.** `docs/status.md` §Last verification must show the final check, with its result.
2. **Names to tidy (plan Y-11).** Admin → Products → Names to tidy on production: note the count and tell Claude. The page and
   Rename all are removed only when it is 0, in a small change after this release. Any other count: they stay, and the release
   goes ahead.
3. **`prod.env` leaves the repo folder (plan R-2).** Move `C:\kod\root\prod.env` to a folder outside `C:\kod\root`, for example
   `C:\iwc\`. You don't need to open it. If it isn't there any more, nothing to do.
4. **Push the branch and open a pull request** to `main`: `git push origin cleanup/simple-store`. CI runs on the pull request.
   Wait for green. Don't merge yet.

## The day: get ready (nothing changes yet)
5. **Stop the sourcing runner** on the India PC (close the run, and disable its Task Scheduler task for today), and any
   `pnpm weights`, `photos:redo` or `descriptions:redo` run on the laptop. The runner's weekly check moves real prices, which
   would make step 9's checksum mean nothing. From here to step 14 also: no publishing, no price or weight edits, no
   weighing at the hub.
6. **Take the backup** (`ops.md` §Moving, Supabase step 3). In a folder **outside `C:\kod\root`**, for example
   `C:\iwc\backup-before-simple-store\`, with production's connection string (Supabase → Connect → Session pooler):
   ```
   npx supabase@2.122.1 db dump --db-url <production> -f roles.sql --role-only
   npx supabase@2.122.1 db dump --db-url <production> -f schema.sql
   npx supabase@2.122.1 db dump --db-url <production> -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
   npx supabase@2.122.1 db dump --db-url <production> -f history.sql --data-only --schema supabase_migrations
   ```
   Check that all four files exist and that `data.sql` is large. `data.sql` holds every account and address: keep it private.
   **This backup is the only way back for what the release drops.** It holds rows, not the files in storage buckets.
7. **Run the pre-check** in Supabase's SQL editor on production. It only reads. Keep the answer.
   ```sql
   select
     (select beta_pricing from pricing_settings where id = 1)                                   as beta_pricing_must_be_true,
     (select food_cleared from pricing_settings where id = 1)                                   as food_cleared_expected_true,
     (select free_shipping_min_cents from pricing_settings where id = 1)                        as free_line_now,
     (select count(*) from vendors where online_site is null and not is_placeholder)            as real_shops,
     (select count(*) from vendor_accounts)                                                     as vendor_logins,
     (select count(*) from vendor_applications)                                                 as vendor_join_requests,
     (select count(*) from vendor_submissions)                                                  as vendor_pieces,
     (select count(*) from vendor_payouts)                                                      as payouts,
     (select count(*) from cycles)                                                              as cycles,
     (select count(*) from order_moves)                                                         as order_moves,
     (select count(*) from order_moves where offer_status = 'offered')                          as open_faster_offers,
     (select count(*) from orders where cycle_id is not null)                                   as orders_in_a_cycle,
     (select count(*) from house_models)                                                        as house_models,
     (select count(*) from photo_jobs)                                                          as photo_jobs,
     (select count(*) from newsletter_subscribers)                                              as newsletter_subscribers,
     (select count(*) from profiles where role = 'vendor')                                      as vendor_role_profiles_become_customers,
     (select count(*) from order_shipments where kind = 'quick')                                as quick_shipments_become_food,
     (select count(*) from orders where shipping_method = 'express' and status not in ('delivered', 'cancelled', 'refunded')) as open_express_orders,
     (select count(*) from order_items oi join orders o on o.id = oi.order_id join products p on p.id = oi.product_id
       where o.status in ('confirmed', 'collecting') and oi.status = 'active' and not p.is_us_stock
         and not exists (select 1 from pickups x where x.order_item_id = oi.id))                as pieces_added_to_to_order,
     (select count(*) from products p join vendors v on v.id = p.vendor_id where p.source_site is null) as products_shop_filled_from_vendor,
     (select count(*) from products p join vendors v on v.id = p.vendor_id
       where p.source_site is null and v.online_site is null and not p.is_placeholder)          as of_which_a_real_shops_name,
     (select count(*) from pickups pk
        join product_variants pv on pv.id = pk.variant_id join products p on p.id = pv.product_id
        join vendors v on v.id = pk.vendor_id
       where pk.status = 'pending' and pk.source_id is null
         and coalesce(v.online_site, v.shop_name) is distinct from p.source_site)               as open_pickups_shop_differs,
     (select count(*) from products where coming_soon)                                          as coming_soon_pieces_hidden,
     (select count(*) from storage.objects where bucket_id in ('vendor-uploads', 'photo-candidates')) as files_in_old_buckets,
     (select count(*) from cron.job_run_details where end_time < now() - interval '7 days')     as old_cron_log_rows,
     (select count(*) from email_outbox where status = 'sent' and sent_at < now() - interval '30 days') as old_sent_emails,
     (select count(*) from admin_error_events where created_at < now() - interval '90 days')    as old_error_events,
     (select count(*) from search_queries where created_at < now() - interval '90 days')        as old_searches;
   ```
   | Result | What it means | What to do |
   |---|---|---|
   | `beta_pricing_must_be_true` is **false** | the first migration refuses to run, on purpose | **Stop.** Tell Claude |
   | `food_cleared_expected_true` is **false** | today no food can go live; afterwards food follows its status, and any food draft publishing would go live | **Stop and ask Claude** before the Deploy |
   | `open_faster_offers` above 0 | those offers disappear from their order pages; the promised window stays | **Stop and ask Claude** before the Deploy |
   | `real_shops`, `vendor_logins`, `vendor_join_requests`, `vendor_pieces`, `payouts`, `cycles`, `order_moves`, `orders_in_a_cycle`, `house_models`, `newsletter_subscribers` above 0 | real rows the release drops | export them (step 8) |
   | `vendor_role_profiles_become_customers` | those sign-ins become plain customers | note it |
   | `quick_shipments_become_food` | they are renamed, their dates unchanged | note it |
   | `open_express_orders` | they keep their dates and their Express label; they ship from their own order page | note it |
   | `pieces_added_to_to_order` | orders waiting for a cycle's cutoff get their pieces on To order, with no email | buy them after the release |
   | `products_shop_filled_from_vendor`, `of_which_a_real_shops_name`, `open_pickups_shop_differs` | a listing or open pickup takes its shop's name from the old row, so To order can still name the shop. Labels only | note it |
   | `coming_soon_pieces_hidden` | those pieces leave the store; the admin keeps them | note it |
   | `files_in_old_buckets` above 0 | files step 16 deletes; the backup does not hold them | download any you want, in the dashboard |
   | `free_line_now`, `photo_jobs`, the five `old_…` counts | the old free line; photo jobs go with their table; old rows the daily clean-up clears over days | note them |
8. **Export to CSV** every table step 7 says has real rows, into a folder outside the repo: Supabase → Table editor → the table
   → Export: `vendors` (when `real_shops` is above 0), `vendor_accounts`, `vendor_applications`, `vendor_submissions`,
   `vendor_payouts`, `cycles`, `order_moves`, `house_models` (keep the slugs for the laptop's model folders),
   `newsletter_subscribers`. For orders, in the SQL editor: `select * from orders where cycle_id is not null`, then Export. They
   hold customers' details: keep them private.
9. **Run the price checksum** in the SQL editor and keep the five values. It works before and after the migrations.
   ```sql
   select count(*)                                                              as live_variants,
          sum(coalesce(v.price_cents, p.price_cents))                            as sum_variant_cents,
          sum(p.price_cents)                                                     as sum_listing_cents,
          sum(v.heavy_cents)                                                     as sum_heavy_cents,
          md5(string_agg(v.id::text || ':' || coalesce(v.price_cents, p.price_cents)::text || ':' || p.price_cents::text
                         || ':' || v.heavy_cents::text, ',' order by v.id))      as checksum
     from product_variants v
     join products p on p.id = v.product_id
    where p.status = 'live';
   ```
10. **Pause the daily deploy.** GitHub → Actions → Daily website deploy → the ⋯ menu → **Disable workflow**. It runs at 09:00 UTC and
    deploys `main` when `main` changed in the last day and its CI is green. **Merging to `main` alone starts CI, and the daily deploy
    would then send the new website out on the old database.** Do this before you merge.

## Merge and Deploy, at a quiet US hour
11. **Merge the pull request to `main`.** This changes nothing for customers yet (Vercel's own deploys are off). Wait until CI on
    that merge commit is green. Never run the Deploy on a commit whose CI is not green.
12. **Run the Deploy.** GitHub → Actions → **Deploy** → Run workflow, on `main`, type `deploy`; for Android choose `production`
    (an AAB for Google Play) or `preview` (an APK to install by hand). Each migration holds a table for about a third of a second, which
    is why this wants a quiet hour. It runs, in this order:
    - **the migrations:** `20261109090000_simple_rules`, `20261109090100_simple_reads`, `20261109090200_simple_drops`, which drops
      the old tables (the Deploy of 2026-11-03 on `88b2f82` found production up to date, so nothing older is waiting);
    - **then, side by side:** the Vercel deploy hook, and the Android build (uploaded to EAS, never sent to a store).

    The job order means a failed migration stops the website from going out. If only the Android job is red (Expo's free builds
    have run out before), the database and website are fine: make the build later (step 20).
13. **Watch Vercel → Deployments** until the new deployment is Ready. If its build fails, see "If it goes wrong".

**What the old store does in those minutes,** between the migrations and the new website:
- Cached pages keep showing. The old website's 7-day pages may fail if they are not in the cache (their database reads are gone).
- Customers can still pay: rehearsed on a production-sized copy. A payment priced with Express still becomes an Express order, 15 – 18
  days.
- A bag over $49.99 in those minutes is charged by the old website's sums: it saves up to $5 more than the rule. Shipping is free from
  $49.99 at once.
- **The old website's admin and the old app's admin mode fail.** Stay out of the admin until the new site is up.

## After
14. **Run the price checksum again** (step 9). **All five values must match.** If not, see "If it goes wrong".
    In the same SQL editor, also run `select jobname from cron.job order by 1;`. It must list exactly `iwc-email-outbox`,
    `iwc-payment-sweep`, `iwc-search-words` and `iwc-tidy`. If `iwc-roll-cycles` or `iwc-fx-refresh` is still there, it is
    calling a function that is gone: tell Claude straight away.
15. **The smoke test, on the live site.** Stop before paying:
    - Home's order: hero, Diwali arches, mosaic, Shop by category, Diwali night, What everyone missed this week, The kirana counter,
      Just listed Clothing, Just listed Home & gifts, Pick your home, the delivery band.
    - A category tile opens its page, for example `/food?category=sweets`.
    - `/7-day-delivery` lands on `/food`.
    - A food-only bag under $49.99 (Shipping charged) and over $49.99 (free), through to checkout's dates.
    - A mixed bag: Shipment 1 · Food, Shipment 2 · Clothing and home & gifts.
    - The FAQ: "What is a delivery day?", with the numbers from Settings.
    - The admin: Today (and its live dot), To order, Settings (Free shipping from $49.99, bulk from $99.99, food 7 – 7, the rest 12 – 16).
16. **Delete the two old buckets.** Supabase → Storage: empty and delete **`vendor-uploads`** and **`photo-candidates`** (the migration
    cannot: Supabase refuses that from SQL). **Keep `vendor-docs`:** it holds the shop bills' photos.
17. **Pull the code on the laptop and the India PC** (`git pull` on `main`, then `pnpm install`). The old `pnpm photos:redo fetch` refuses
    the new database's answer. The new code works with either database.
18. **Delete any Windows Task Scheduler task that starts `worker.py`:** the file is gone. `tools/photo-worker/.env`, `worker.log` and
    `tools/photo-redo/out/house-models.json` are unused now; leave or delete them.
19. **Restart.** Enable the runner's task again and start it on the India PC. GitHub → Actions → Daily website deploy → **Enable
    workflow**: the next 09:00 UTC may deploy the same commit once more, which is harmless.
    **The next day:** `monitoring.md` §1's numbers and query C (the timers are `iwc-email-outbox`, `iwc-payment-sweep`, `iwc-search-words`,
    `iwc-tidy`).

## The Android app 1.1.0
20. **Build it.** Step 12's Android job, or from `apps/app`: `eas build --platform android --profile production` (`preview` for an APK).
    **Check the version code at the first Play production build:** `app.json` has no `android.versionCode` and `eas.json` no
    `autoIncrement`, and Google Play needs a higher one for each upload. Claude can't see what EAS holds. Release note, for you to change
    as you like: "The 7-day store is now part of the main store: every food piece arrives in 7 delivery days, clothing and home & gifts in
    12 – 16. Free shipping from $49.99. Checkout tells you before you pay if a piece has sold out."
21. **You and the COO install 1.1.0 before using admin mode on a phone.** The old app's admin mode breaks with this release; its customer
    side keeps working. Until then, use the website's admin.
22. **Publish it on Google Play soon after the Deploy,** by hand (the workflow never submits). The old app's bag shows a small saving on a
    $50 – $99.99 bag that checkout does not give; checkout's total is right.
23. **Once 1.1.0 is the minimum, tell Claude:** the `TODO(D-187)` shims can go. The app has no forced update, so when that is true is your
    call.

## If it goes wrong
**Tell Claude what you see, with the error. Claude can read and fix code but never touches production: you run whatever is needed.**

| What happened | What it means | What you can do |
|---|---|---|
| **Before step 12** | production is untouched | stop. If you merged, keep the daily deploy disabled until `main` is reverted with green CI |
| **A migration fails in step 12** | the website does not go out. Each migration file is all or nothing, so the database stops after the last one that finished. Parts 1 and 2 still work with the old website; part 3 is the one that drops | the old store keeps running. Don't re-run it blind: send Claude the error |
| **The website's build fails** after the migrations | the old website stays up on the new database: the state described above, not one to stay in | enable the Daily website deploy and Run workflow to try again (a busy database can fail a build); if it fails again, send Claude the log |
| **The new website has a bug** | | fix forward: Claude fixes, CI, deploy. **Vercel's Promote only helps between two new deployments** |
| **"Roll back the website"** to the old one | **this won't work properly against the new database.** The old site's 7-day pages and admin fail, because what they read is gone | only as a stopgap for customers while a fix is made |
| **The checksum differs** in step 14 | a price moved. The migrations were rehearsed with 0 differences of 29,212 options, so first ask what else ran: the runner, a weighing, a publish, an admin edit | don't edit prices by hand. Send Claude both results. The backup's `data.sql` holds the old prices to compare |
| **You need a dropped table back** | **dropped tables come back only from the backup** | see below |

**Going back to the old database is not a rollback button.** `ops.md` §Moving describes one restore: the four backup files into a
**new, empty project**, with new keys everywhere (Vercel, GitHub, the India PC, EAS). Every order, account and listing change made after the
backup would be missing from it. `ops.md` has no procedure for restoring over the live database, and this runbook doesn't invent one. Whether
that is ever worth it is **your call**, after talking it through. For a few rows, the CSVs of step 8 and the backup can be read without
restoring anything.

## What changed that you may notice
**Customers**
- **Every card gained a delivery-days line** under the price, about 18 px ("12 – 16 delivery days"; 10 px on phones with three to a row). It
  is the most visible layout change, and the old brand chip on the photo is gone. Worth a look at 320 and 375 px.
- A **clearance card ("Already in the US") says the standard days:** a card doesn't know the piece is in the US. Its page and checkout are
  right, and show dates: **US clearance stays in calendar days**, the one exception to "delivery days" and "no dates on store pages".
- The order page names the second shipment only "Shipment 2", because an old order's second shipment may hold food.
- Stamps lost their "ARRIVES <date>" ring. The Diwali banner shows only the free line.
- The **old app's bag can show a small wrong saving** until 1.1.0 (above).
- Coming-soon pieces (liquids) have vanished from the store: their pages answer 404.
- Signed-in customers' hearts still load the Supabase client when needed, with no live connection. Signed-out visitors never load it.
- New words Claude drafted (yours to change, D-019): "One piece in your bag changed", "Sort it out and you can pay.", the line for addresses
  outside the 48 states, Shipping & returns' Food line.

**The app**
- **Category tiles use the newest piece's photo,** not your tile photos: those live in the website's files.
- The app's hero keeps "We go home so you don't have to." It has no delivery line.
- No camera listing, and the camera permission is off in this build.

**The admin**
- **Today always shows stale listings** (the pilot hid them). The runner's weekly check refreshes imported ones, but the number may be large.
- **The "In the US" step no longer happens:** a piece ends At the hub and ships from there. The chip stays for old rows. **This was already
  so in the pilot.**
- **"Orders to ship" counts almost nothing:** only US-clearance orders reach that status. A hub order ready to go has no queue; find it on its
  order page. **Also already so in the pilot.** Optional fix: count open shipments whose pieces are all at the hub, for one small read per
  admin page. Say if you want it.
- The sidebar has no Listings: Products carries the Drafts count, and `/admin/listings` is only the Re-check tab. New listings come from the
  importer and the runner.
- Bulk Mark shipped covers only `arrived` orders; old Express orders still in India ship from their own page.
- Coming soon's Show/Hide toggle is gone: a read-only line stays.
- The Shop filter lists the shops in `sourcing_shops`: a hand-imported site outside it isn't offered.
- Insights: All time stays for sales; searches are kept for 90 days and the section says so.
- The packing list and commercial invoice went with the Cycle pages (plan §7's default); invoices A, B and C stay.
- A late payment of an old faster-delivery offer should show as a payment to check. This was read in the code, not run.

**Your machines and files**
- Models: a folder not named `w-…`, `m-…` or `_…` is skipped with a warning. Today: `m-1`, `m-2`, `w-1` – `w-5`.
- The old mockups are in `C:\kod\iwc-removed-2026-11-04\design.zip`, and 38 unused photos in `…\public-photos\`.
- The 25 `… (7-day)` rows in `diwali-home-gifts.csv` keep their names, seen only in the admin (a rename means not re-uploading that list).

**Answers used because no other came (plan §7; say if any is wrong):** every food listing promises 7 delivery days, slower shops too; US public
holidays count as delivery days; food that can't reach the hub fast stays live.
