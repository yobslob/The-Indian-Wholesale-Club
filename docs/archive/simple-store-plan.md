# Simple store: the removal plan (D-187)

Written 2026-11-04 for the founder's subagents. **One branch, one release.** Read this file whole before touching code;
each agent then reads only its own brief (§5) and the docs that brief names. CLAUDE.md's non-negotiables still hold,
except where §1 below changes them (it is the founder's decision, filed as D-187 in Phase 0).

## 0. Why

The founder (2026-11-04, verbatim, typos kept):
> "I have been adding on and on as soon as I got ideas and building up this website, but I forgot the most important
> part clearing up that clutter and mess that I left behind. Therefore Make a very smart removal plan which My subagents
> will perform. The Honest truth about this website is that we buy from online webstores and resell it on our website
> providing faster shipping and very efficient interface. Now we will clear all the clutter and make a very simple
> interface. We will remove the 7-day store, We will remove the entire concept of shops and vendors and everything
> related to that, no cycles, no payouts, no house models. We will simply show that clothing takes 12-16 delivery days
> and food takes 7 delivery days to arrive. Then we will define the defination of delivery days in somewhere in faqs,
> delivery days is considered as the business working days except for the delays of flights. We will remove the
> concept of 99.99$, we will give free shipping over 49.99$ on everything. rest of it I want to keep the same, just
> remove the 7 day store page and put the categories exactly as they are under the global grid, then diwali banner then
> what everyone missed this week then the kirana counter then the just listed clothing then home decor. Just keep
> everything simple so we don't hit the limits anymore. keep everything light, so everything loads fast and efficiently
> while giving the customer a seamless experience"

Answers to Claude's questions the same day:
- Home & gifts delivery: **"12–16, like clothing"**.
- Faces on new clothing photos: **"We still want new clothing to have a model to replace with"**, and the models live
  as **"Folders on the laptop only"** (the House models admin page and table go).
- Old tables: **"Drop them in the same release"**.
- Home order: **"Yes, keep map and band at end"** ("global grid" = Home's drifting photo mosaic; Just listed Food is
  removed because the two food rows cover it).
- Bulk saving and heavy-item 20% off: **"Keep them at $99.99"** (only shipping moves to $49.99).

The founder's answers to §10 (2026-11-04, verbatim): "1. Remove express option. 2. yes 3. show it at checkout and also
show which product is unavailable and give a remove option. 4. yes 5. Just use the term "delivery days" and quietly
explain it in faqs, so you can easily promise using this term and it will still be valid, It basically defines that
an order can be delayed due to flight delay. 6. yes. 7. no 8. yes 9. yes no need to load 10. remove it because the
payment is already made 11. yes 12. no 13. yes 14. move to archive now but keep track of what was done before in
short. 15. We'll see it after diwali leave as is."

## 1. The new rules (the contract every agent builds to)

| Rule | Before | After |
|---|---|---|
| Delivery, **food** | 7 days only for "7-day pieces" (quick-shop listings, D-148), in a split bag only from $49.99 of them (D-154) | **every food piece: 7 delivery days** |
| Delivery, **clothing and home & gifts** | 12 – 16 days | **12 – 16 delivery days** (unchanged numbers) |
| What a **delivery day** is | calendar days from the order | **a business working day, Monday to Friday**, counted from the order day; weekends do not count; flight delays are not part of the promise (we email a new date, D-008 as today). US public holidays are not skipped (founder may add later) |
| A bag with food **and** other pieces | one shipment, unless 7-day pieces ≥ $49.99 | **always two shipments**: 1 = food (7 days), 2 = clothing and home (12 – 16) |
| Address outside the 48 states and DC, PO box, APO | 7-day pieces travel with the rest | same: **one shipment**, 12 – 16 days |
| **Free shipping** | $99.99 any bag, $49.99 a bag of only 7-day pieces | **$49.99 for every bag** (one line, Settings) |
| Shipping below the line | $18.62 × billed kg, one parcel for a split bag | unchanged |
| Retailer charges below the line | Settings ($0.99) | unchanged |
| **Bulk saving** (10% over the line, cap $25, D-119) and **heavy-item 20% off** (D-155) | start at the free line | start at a **new setting `bulk_saving_from_cents` = 9999** ($99.99): money unchanged |
| Express (courier, D-070) | an option at checkout, 15 – 18 days | **gone** (founder, §10 Y-1): standard is the only shipping |
| Cancel | 7-day shipment free until bought, then not; the rest until it leaves India | same, with "food shipment" for "7-day shipment" |
| Cycles, cutoffs, "Order by", moving an order to another cycle, the faster-delivery offer (D-064) | in the code, unused since the pilot (D-115) | **gone** |
| Vendors, vendor accounts, vendor pieces, payouts, AI photo jobs, `house_models` table | built | **gone** |
| Face swap on new clothing photos (D-163, D-168) | models listed in `house_models` + laptop folder | **kept**; models are only the laptop folder `IWC_MODELS/house-models/w-1…, m-1…` (w = women, m = men) |

**The promise is said in "delivery days" (founder, §10 Y-5).** Store pages say the term, not a calendar date: cards,
the product page, the bag, the hero and Home say "7 delivery days" (food) and "12 – 16 delivery days" (clothing,
home & gifts). The FAQ explains the term quietly (below); that explanation is what keeps the promise true when a
flight is late. No week strip, no festival clock, no "open it Sat, Oct 31" lines.
Checkout and the order page still show the order's estimated window (an order needs one: delay notices and INV-6),
labelled "Estimated delivery". That window is made by one SQL function `_add_business_days(date, int)`; the shared
`addBusinessDays()` in `packages/shared/src/domain/delivery.ts` is its twin for any date the browser draws; both are
tested against the **same 20 cases** (e.g. Fri + 7 = the Tuesday after next; Sat + 1 = Mon).

**FAQ and Shipping & returns** (`packages/shared/src/info/pages.ts`; numbers from `store_policy()`, never typed):
- New question, after "When will my order arrive?": **"What is a delivery day?"** → "A delivery day is a working day,
  Monday to Friday. Delays to flights are not counted in them: if a flight is late, your order can arrive later, and we
  email you the new date." Short and calm; it is the only place the definition is spelled out.
- "When will my order arrive?" → "Food arrives in 7 delivery days, clothing and home & gifts in 12 to 16, counted from
  your order. A bag with both comes in two parcels. Before you pay, you see the dates for your order."
- "How much is shipping?" → free on orders over $49.99 (from `standardShipping()`, which already words it).
- Shipping & returns' Delivery list: Food · Clothing and home & gifts · Already in the US; the same definition
  sentence under it. No Express.

## 2. What stays (false friends: do NOT delete)

These share a word with what goes. Deleting them breaks the store or the admin's buying.

| Keep | Why |
|---|---|
| `quick-add.tsx`, `quickAddSchema`, `quick_add` (card's Add) · `quick-find.tsx` (admin search) | "quick" = fast UI, not the 7-day store |
| `pickups` table, `admin_to_order`, `admin_mark_ordered`, `hub-weigh.tsx`, `piece-ordering.tsx`, `to-order/**` | in the pilot a pickup **is the buy list**: To order → Ordered → At the hub → In the US. Only its `vendor_id`, `cycle_id` and payout columns go |
| `shop_bills*`, `paid_paise`, `shop_order_ref`, invoices A/B/C, `money.ts` | what we paid the online shop: buying, not vendor payouts |
| `vendor-docs` storage bucket | holds the shop-bill photos; the name stays (renaming a bucket moves files for nothing) |
| `product_sources`, `products.source_url/source_site`, `sourcing_shops`, every reader, the runner | **the online webstores we buy from** (the business). "Shop" here = the webstore, admin only |
| `sourcing_shops.quick_delivery` + `_quick_sourceable()` + `scripts/quick-sources.mjs` | admin-only: food is bought from the fast shops (Blinkit, Zepto, Instamart, BigBasket) when it can be, which is what makes 7 days true. Rename to "fast shop" in admin copy only |
| Today's "food shipments not bought within 2 hours / not shipped by the next day" | the 7-day promise depends on it (re-keyed from 7-day to food) |
| `order_shipments` table and the two-shipment admin panel | now used for food vs the rest (`kind` 'quick' → 'food') |
| "Retailer charges", bulk saving, heavy-item shipping, small-food shelf, beta pricing | pricing, unchanged (non-negotiable 5) |
| "Shop under $99" button (`diwali-hooks.ts`) | a price filter (`?max=99`), not the free line |
| `tools/photo-worker/redo.py`, `redo_serve.py`, `iwc_worker/redo_clothing.py`, `faceswap.py`, `parts.py`, `refresh.py`, `redo_scene.py`, `prepare_house_model.py` | the face swap the founder keeps; `prepare_house_model.py` makes a model's front/back for the folder |
| US clearance stock ("Already in the US"), returns, reviews, promos, Stripe safety nets | not part of this change |

## 3. What goes (inventory, measured 2026-11-04)

About **10,000 lines** of app code and tests, **about 75 database functions** dropped or rewritten, **11 tables**, and the
**`iwc-roll-cycles` pg_cron job that runs every minute** (1,440 database calls a day for nothing).

- **7-day store:** web `app/(store)/7-day-delivery/**`, `features/seven-day/**` (the tiles move to Home), the store
  switch and 7-day search in the header, the "Arrives in 7 days" rows and bands, `store_quick_front`,
  `store_quick_browse`, `store_quick_bag`, `_quick_listings*`, `_quick_days`, `admin_quick_insights`,
  `admin_quick_watch` (→ food watch), `ops_quick_sources`, quick settings, `packages/db/src/store/quick.ts`, app
  `app/7-day-delivery.tsx`, `features/seven-day/**`, tests `seven_day*.test.sql`, `seven-day-bag.spec.ts`,
  `apps/app/tests/seven-day.test.ts`, visual slots `seven-day-hero` and `seven-day-poster`.
- **Vendors:** web `app/vendor/**`, `features/vendor/**`, the `/vendor` matcher in `middleware.ts`; admin pages
  `vendors`, `vendor-pieces/**`; `vendor-access.tsx`, `actions/vendor-accounts.ts`, `actions/vendor-pieces.ts`;
  `packages/db/src/vendor/**`, `server/vendor.ts`, `admin/vendor-pieces.ts`; `packages/shared/src/vendor/**` (13
  languages); app `app/vendor/**`, `app/vendor-login.tsx`, `features/vendor/**`, `app/admin/vendors.tsx`,
  `features/admin/vendor-form.tsx`; tables `vendors`, `vendor_accounts`, `vendor_sign_in_codes`,
  `vendor_applications`, `vendor_submissions`, `vendor_submission_photos`; buckets `vendor-uploads`,
  `photo-candidates`; every `vendor_*` function, `is_vendor`, `my_vendor_id`, `_online_vendor`; `products.vendor_id`
  (the shop now comes from `product_sources.site` / `products.source_site`, as To order already groups it).
- **Cycles:** admin `cycles/**` (incl. packing list + commercial invoice, see §7), `cycle-*.tsx`, `arrival-list.tsx`,
  `pickup-cards.tsx`, `order-move-form.tsx`, `export-documents.ts`, `actions/cycles.ts`; `features/orders/faster*`,
  `app/api/orders/faster/**`; app `(tabs)/cycles.tsx`, `admin/cycle/[id].tsx`, `cycle-flow.tsx`, `cycle-view.tsx`,
  `arrival-list.tsx`, `shop-pickups.tsx`, `orders/faster-offer.tsx`; `packages/shared/src/domain/cycles.ts`,
  `isWindowAtRisk`; tables `cycles` and `order_moves`, `orders.cycle_id`, `pickups.cycle_id`; `roll_cycles`,
  `cutoff_cycle`, `advance_cycle`, `move_order`, `confirm_move_shipped`, `accept_fast_offer`, `check_off_arrival`,
  `_store_cycle`, `_next_cycle_dates`, `_open_next_cycle`, `_cutoff_cycle`, `admin_cycle_totals`; settings "Cycles
  and offers"; tests `cycle*.test.sql`, `cycles.test.sql`, `order_moves.test.sql`, `arrival.test.sql`,
  `faster-decision.test.ts`, `export-documents.test.ts`.
- **Payouts:** admin `payouts`, app `admin/payouts.tsx`, `payout-card.tsx`; `vendor_payouts`, `record_payout`,
  `pickups.payout_id`; Insights' "what the shops were paid" column.
- **House models (as a website concept):** admin `house-models`, `house_models` table, `photo_jobs`,
  `worker_claim_job`, `worker_finish_job`, `admin_*_submission`, `admin_rerun_photo_job`; photo-worker `worker.py`,
  `iwc_worker/pipeline.py` and `prompts.py` **only if** nothing in §2's kept list imports them (check first);
  `scripts/dev-photo-e2e.mjs`. `worker_photo_redo_plan` stops returning `house_models`; `redo.py` reads the folder.

## 4. How the work runs

```
Phase 0  Lead ............ clean tree, branch, D-187, baseline check, prod pre-check   (sequential)
Phase 1  Agent A (DB) .... migrations + SQL tests + generated types + shared contract   (alone; others wait)
Phase 2  B store web | C admin web + vendor + db/server | E app | F tools & scripts     (in parallel)
Phase 3  G docs, then V verify (a fresh agent that wrote none of it)                    (sequential)
Phase 4  Founder ......... backup, pre-check, Deploy, smoke test                        (manual)
```

**Rules for every agent**
- Work on branch `cleanup/simple-store` in `C:\kod\root`. Touch only the files your brief owns; if you need a change
  outside them, write it under "Asks" in your report instead of making it.
- Small commits (`git` author yogeshxiix@gmail.com), message says what and why and cites D-187. **No push.** Never run the
  Deploy workflow, never touch a hosted database or `.env` files (CLAUDE.md).
- Delete, don't comment out. No "removed" stubs, no unused exports, no dead settings. After deleting a file, search for
  its imports and its route string and fix every one.
- Customer words: "delivery days", "Food", "Clothing", "Home & gifts", "Shipment 1 / 2". Never "7-day store", "cycle",
  "vendor", "shop" (customer side).
- **Old Android app in customers' hands:** until the new app is out, API answers keep the keys the old app reads, with
  values that make it behave as the new store: `quick_delivery_on: false`, `quick_*: null`, `free_shipping_min_cents:
  4999`. Mark each `// TODO(D-187): drop when app <next version> is the minimum`. The old app then hides its 7-day
  store on its own.
- Report: files deleted, files changed, checks run with results, and anything you were unsure of.
- Also do the §9 rows that name you, and §10's **Do** rows that name you.

## 5. Briefs

### Phase 0 · Lead (the main session)
1. `git status`: commit or set aside the founder's open changes (`docs/monitoring.md`, `docs/status.md`,
   `apps/web/public/visuals/hero_updated.png`) **with the founder's OK**, then `git switch -c cleanup/simple-store`.
2. Run `/record-answer` with §0's quote and answers → **D-187** "Simple store: one store, food 7 and the rest 12 – 16
   business days, free shipping from $49.99; no 7-day store, vendors, cycles, payouts or house-models table".
   It supersedes D-005, D-008's cycle half, D-045, D-064, D-065, D-102 – D-104, D-148, D-154's store and line, and the
   7-day parts of D-161, D-166, D-181, D-183 – D-186. Close nothing else.
3. `node scripts/check.mjs` → keep `.checks/latest.json` as **baseline.json** (route timings, first-load JS, build
   page count) for Agent V.
4. Give the founder §6's pre-check query to run (read-only). If any count of real rows is above zero, the founder
   exports those tables as CSV (Supabase table editor → Export) **outside the repo folder** before Phase 4.
5. Confirm with the founder that every migration waiting for the Deploy workflow (status.md: `20261103090000` to
   `20261108090600`) is meant to ship in this release too; the new migrations come after them.
6. §10 is decided (founder, 2026-11-04): agents do §9 and §10's **Do** rows.
7. Repo housekeeping (§9 R-1, R-2) before the branch, so agents start from a clean tree.

### Phase 1 · Agent A: database and the shared contract
**Owns:** `supabase/**`, `packages/db/src/database.types.ts` (generated), `packages/db/src/store/schemas.ts`,
`packages/shared/src/domain/{bag-shipments,bag-goal,checkout,delivery,homesick,cycles,order-status}.ts` and their tests.
**Read first:** `docs/data-model.md`, `docs/flows.md` §3, the latest definition of each function you change (newest
migration that defines it).

Three new migrations, applied in order in one Deploy (timestamps after `20261108090600`):
1. `20261109090000_simple_rules.sql`: `_add_business_days`; settings `food_delivery_days_min/max` (7/7, renamed from
   `quick_delivery_days_*`), standard `pilot_delivery_days_*` → 12/16 (rename to `delivery_days_*` if every reader is
   rewritten here anyway), `free_shipping_min_cents` = 4999, new `bulk_saving_from_cents` = 9999. Rewrite to the rules in
   §1: `create_order` (always made to order: no cycle branch, no `roll_cycles()`, pickups at once; windows by business
   days; split = food vs the rest; the 48 + DC rule kept), `checkout_context`, `store_bag_charges`, `_bag_shipments`,
   `store_policy`, `store_next_delivery`, `store_my_order`, `_order_actions`, `ship_shipment`, `_cancel_shipment`,
   `customer_cancel`, `cancel_after_delay`, `admin_to_order` (group by site only), `admin_quick_watch` → `admin_food_watch`,
   `admin_sales` (no payout column). `order_shipments.kind`: update rows 'quick' → 'food' and its check. **Existing orders
   keep their promised dates** (INV-6: no window is recomputed).
2. `20261109090100_simple_reads.sql`: take `_quick_days` / `_quick_listings()` out of every store read
   (`store_browse*`, `store_product_page`, cards, `store_search*`): the days now come from the product type, with no
   shop joins. `store_home` gains, in its one cached call: `categories` (the 12 tile categories, §5 B, with count and
   newest photo), `most_ordered` (top 12 by pieces ordered in the last 7 days, all live listings, as `store_quick_front`
   counted them) and `under_5` (as `store_quick_front`, all live listings). Show `EXPLAIN (ANALYZE, BUFFERS)` before/after
   for `store_home`, Food's first browse page and one product page in your report; none may get slower.
3. `20261109090200_simple_drops.sql`: `cron.unschedule('iwc-roll-cycles')`; drop every function in §3 (with `if
   exists` and exact signatures); drop columns `products.vendor_id`, `pickups.vendor_id/cycle_id/payout_id`,
   `orders.cycle_id`, the quick / cycle / fast-offer settings, then the tables `vendor_payouts`, `vendor_submission_photos`,
   `vendor_submissions`, `vendor_applications`, `vendor_sign_in_codes`, `vendor_accounts`, `photo_jobs`, `house_models`,
   `order_moves`, `cycles`, `vendors` (children first). The `vendor` role: drop the RLS policies and grants that name
   it; an enum value cannot be dropped, so add a check that no profile has role 'vendor'. **Keep the `worker` role and
   `is_worker()`**: the sourcing runner, the weight estimator and the photo redo sign in with it; drop only the vendor
   photo jobs' worker functions (`worker_claim_job`, `worker_finish_job`). Empty and
   remove buckets `vendor-uploads` and `photo-candidates` (keep `vendor-docs`). Keep `schema.test.sql`'s whitelist
   current.

Then: delete the SQL tests of §3; rewrite `checkout`, `shipments`, `shipment_admin`, `bag_charges`, `policy_days`,
`pilot_delivery`, `ship`, `after_sales`, `insights`, `photo_redo`, `schema`, `rls_*` to the new rules; add
`simple_store.test.sql` with a case table (at least: food $30 → 7 days, shipping charged; food $50 → free; clothing
$40 + food $15 → free, two shipments; clothing $30 + food $10 → charged as one parcel, two shipments; Alaska → one
shipment 12 – 16; a Friday order; a $120 bag → bulk saving from $99.99; an old 'quick' order keeps its dates).
Clean `supabase/seed/*` (no vendors, cycles, quick settings). `pnpm db:types`. Update the shared domain files you own
(`bagGoal`: only `free-gap` and `free`, bulk part from `bulk_saving_from_cents`; `bagShipmentState` on food;
`addBusinessDays` + the 20 cases; `datesIn` uses it; delete `cycles.ts`).
**Done when:** `node scripts/check.mjs db` and `node scripts/check.mjs test` (shared) pass; the report lists every function
dropped and every function whose signature changed (Phase 2 needs it).

### Phase 2 · Agent B: storefront web
**Owns:** `apps/web/app/(store)/**`, `apps/web/app/api/{bag-charges,browse,card-options,checkout,orders,search}/**`,
`apps/web/app/sitemaps/**`, `apps/web/features/{home,seven-day,shell,cart,checkout,catalog,orders,info,visuals,regions,search}/**`,
`apps/web/lib/{site,email/*}.ts`, `apps/web/next.config.js`, `packages/db/src/store/**` (not `schemas.ts`),
`packages/shared/src/info/**`, the store e2e specs. **Read first:** `docs/storefront.md`, `docs/engineering.md` §Performance.

- **Home** (`app/(store)/page.tsx`), top to bottom: Hero → Diwali arches → photo mosaic → **category tiles** → Diwali night
  banner (with the plane) → **What everyone missed this week** → **The kirana counter** (sub "Under $5") → Just listed
  **Clothing** → Just listed **Home & gifts** → Pick your home → delivery band (the empty `home-poster` slot goes, §10 Y-8). Gone from Home:
  the "Arrives in 7 days" row and Just listed Food. Still one cached `store_home()` read and server-rendered headings;
  rows drawn as they come near (`lazy-sections.tsx`), as today.
- **Category tiles:** move `features/seven-day/quick-tiles.tsx` + `tile-photos.ts` to `features/home/category-tiles.tsx` +
  `features/home/tile-photos.ts`. Same 12 categories, same photos, same order (biggest first), same look; a tile opens
  the main store's See all (`/food?category=sweets`, `/home-and-gifts?category=pooja-and-spiritual`). Label: "Shop by
  category".
- **Hero:** keep the poster and its words; the link goes to `/food`; screen-reader kicker uses `HERO.storeClosed`; delete
  the 7-day-only branches. The button stays "Free delivery from $49.99" (the free line).
- **Header and search:** remove `store-switch.tsx`, the 7-day half of `store-links.tsx`, `isQuickPath`, `QUICK_HOME`, and the
  7-day search action in `search-pill.tsx` / `phone-search.tsx`.
- **Delete** `app/(store)/7-day-delivery/**`, `features/seven-day/**` (after the move), `quick-band*`, `features/orders/faster*`,
  `app/api/orders/faster/**`, the `seven-day-*` slots in `features/visuals/slots.ts` and their files in `public/visuals/`
  if nothing else uses them, the 7-day rewrites in `next.config.js`.
- **Redirects** (permanent, `next.config.js` `redirects()`: no page cache, no function): `/7-day-delivery` → `/food`,
  `/7-day-delivery/search` → `/search`, `/7-day-delivery/:type(food|home-and-gifts)/:category` →
  `/:type?category=:category` (`all` → no query), `/7-day-delivery/:type` → `/:type`, `/vendor/:path*` → `/`.
- **Cards, product page, bag, hero:** one delivery line per type, the term and no date ("7 delivery days" /
  "12 – 16 delivery days"; the hero's line: "From India to your door in 7 delivery days (on food)."); checkout and
  the order page show the order's estimated window from the server (§1); the bag's one bar (free at $49.99; the saving part
  fills from $99.99); two shipment groups "Shipment 1 · Food" / "Shipment 2 · Clothing and home & gifts". No "7-day" tag
  anywhere. `shell/days.tsx` keeps `food`, `standard` and `freeMinCents` only.
- **Emails** (`lib/email/shipments.ts`, `order-update.ts`, `order-confirmation.ts`): "Shipment 1 (food)" wording, no 7-day
  or cycle words.
- **FAQ and Shipping & returns:** §1's text in `packages/shared/src/info/pages.ts`; `policy-text.test.ts` updated.
- **Sitemap:** no 7-day URLs.
- **Tests:** add `checkout-stock.spec.ts` (§10 Y-3: sold out, fewer left, Remove, Keep n, payment locked until
  resolved); rewrite `seven-day-bag.spec.ts` as `food-bag.spec.ts` (§5 A's cases, from the bag to the order page);
  update `home-hero.spec.ts` (and a new check of Home's section order), `rows.spec.ts`, `checkout.spec.ts`,
  `customer-choices.spec.ts`, `search-url.test.ts`, `product-seo.test.ts`, `order-email.test.ts`, `order-update.test.ts`.
**Done when:** `node scripts/check.mjs typecheck lint test build` has no error in your files; first-load JS of Home and a
product page is at or under baseline (budget 160 KB, D-182); the build no longer lists any `/7-day-delivery` page.

### Phase 2 · Agent C: admin web, vendor web, server package
**Owns:** `apps/web/app/admin/**`, `apps/web/app/vendor/**`, `apps/web/features/{admin,vendor}/**`, `apps/web/middleware.ts`,
`apps/web/app/api/{internal,webhooks}/**` (only if they reference what goes), `packages/db/src/{admin,server,vendor}/**`,
`packages/shared/src/{vendor,admin}/**`, `admin.spec.ts`, `hidden-admin.spec.ts`, `insights-live.spec.ts`.
**Read first:** `docs/admin.md`.

- **Delete pages:** `cycles/**`, `payouts`, `vendors`, `vendor-pieces/**`, `house-models`; their entries and counts in
  `frame.tsx` and `counts.ts`. **Delete** `app/vendor/**`, `features/vendor/**`, the `/vendor` parts of `middleware.ts`,
  `packages/db/src/vendor/**`, `server/vendor.ts`, `admin/vendor-pieces.ts`, `packages/shared/src/vendor/**`, and §3's
  admin files.
- **Today:** no cycle countdown, pickups-to-do of a cycle, shops owed or join requests; keep orders to ship, To order,
  stale listings, payments to check, disputes, and the **food watch** (food shipments not bought within 2 hours / not
  shipped by the next day).
- **Orders:** no "Move to another cycle", no faster offer; the Shipments panel says Food / Clothing and home.
- **Settings** (`settings-fields.ts`, `actions/settings.ts`): remove Cycles and offers and the 7-day section with its
  Pause; one **Free shipping from** ($49.99), **Bulk saving and heavy-item discount from** ($99.99), **Food delivery days**
  (7 – 7) and **Clothing and home & gifts delivery days** (12 – 16), each saying "business days".
- **Listings and import:** the vendor picker in new listing / Add many / the importer becomes the source link (or
  nothing, for a piece without one); the catalogue's "shop" filter reads `source_site`; `names/proposals.ts` per site.
- **Insights:** remove the 7-day section and "what the shops were paid"; sales by shop come from the site.
- `packages/db/src/admin/supply.ts` and `operations.ts`: remove what reads dropped tables; keep pickups as the buy list.
**Done when:** typecheck, lint and tests pass in your files; `admin.spec.ts` and `hidden-admin.spec.ts` pass; `/vendor`
redirects to `/` and no admin page links to a removed one.

### Phase 2 · Agent E: the Android app
**Owns:** `apps/app/**`. **Read first:** `docs/storefront.md` §Mobile app, `docs/admin.md` §App admin mode.

- **Delete:** `app/vendor/**`, `app/vendor-login.tsx`, `features/vendor/**`, `app/7-day-delivery.tsx`,
  `features/seven-day/**`, `app/admin/(tabs)/cycles.tsx`, `app/admin/cycle/[id].tsx`, `app/admin/payouts.tsx`,
  `app/admin/vendors.tsx`, `features/admin/{cycle-flow,cycle-view,arrival-list,payout-card,vendor-form,shop-pickups}.tsx`,
  `features/orders/faster-offer.tsx`, `tests/seven-day.test.ts`. Keep `hub-weigh.tsx`, `piece-order.tsx`.
- Admin tabs: Today (no cycle countdown), Orders, Listings, More (no Payouts or Vendors); the listing form without a vendor.
- Customer side: Home in the web's order where the app has the section (category tiles, the two food rows, Just listed
  Clothing and Home & gifts); the bag's one bar; shipment groups by food; delivery lines in delivery days.
- Bump the app version; the release note says the 7-day store is now part of the main store.
**Done when:** `pnpm --filter app typecheck lint test` pass; the app builds (`expo export` or the project's usual check).

### Phase 2 · Agent F: tools and scripts
**Owns:** `tools/**`, `scripts/**` (not `check.mjs` unless a removed step needs it), `catalogue/README.md`.

- **Photo worker:** `redo.py` reads models **only** from `IWC_MODELS/house-models/` (`w-*` women, `m-*` men; the
  `out/house-models.json` fallback goes); `tools/photo-redo` and `tools/sourcing-runner/src/redo.ts` stop reading
  `house_models` from the plan. Delete `worker.py` and the vendor FLUX pipeline (`pipeline.py`, `prompts.py`) only if the
  redo does not import them (check `redo.py`, `redo_clothing.py`, `parts.py`); else remove only their vendor parts. Update
  `tools/photo-worker/README.md`: "to add a model, add a folder with `front.jpg`; to remove one, remove its folder".
- **Sourcing runner:** no vendor rows (`_online_vendor` is gone; the site is the shop); the "7-day" target lists become
  plain food targets; keep the fast-shop preference for food.
- **Scripts:** delete `dev-photo-e2e.mjs` and its `package.json` entry; clean `demo.mjs`, `build-catalogue.mjs`,
  `production-seed.mjs`, `launch-check.mjs` of vendors, cycles and quick settings.
**Done when:** `pnpm sourcing --help`, `pnpm photos:redo --help`, `pnpm weights --help` run; the tools' own tests pass;
`python -m py_compile` passes on every remaining `.py`.

### Phase 3 · Agent G: docs
**Owns:** `CLAUDE.md`, `README.md`, `docs/*.md` (not `decisions.md` beyond D-187's links), `docs/archive/` (only to add).
- Move the retired sections whole to `docs/archive/retired-2026-11-simple-store.md` (flows §1, §4 – §6b, admin
  §Vendor screens and the cycle/payout rows, data-model's removed tables, pilot-numbers §6, storefront's 7-day parts),
  then rewrite what is left for the new model: the customer orders → we buy from the online shop → hub → flight → door.
- CLAUDE.md: "What it is" without the retailer target model and vendor accounts; **non-negotiable 4** becomes "Delivery
  dates come from Settings' food and standard delivery days, counted in business days (D-187); never hard-coded"; the repo
  map without `app/vendor` and `packages/shared/vendor`; glossary in `product.md` without vendor, vendor account, house
  model (or: "a model photo folder on the laptop"), photo job, cycle, cutoff, export, payout, 7-day piece; add
  **delivery day** and **food shipment**.
- `status.md` replaced (not appended), `monitoring.md` without the 7-day budgets and the per-minute cron,
  `questions.md` closes what D-187 answers.
**Done when:** `node scripts/docs-audit.mjs` passes.

### Phase 3 · Lead: the unused-code sweep (before V)
Run `npx knip` from the repo root (monorepo mode, every workspace; add a `knip.json` naming the Next, Expo, Playwright
and tools entry points). It lists files nothing imports, exports nobody uses and dependencies nobody imports, which is
what Phase 2 leaves behind. Hand each hit to the agent that owns the folder; keep only what a framework loads by name
(Next routes, Expo screens, peer dependencies Expo Router needs: `expo-linking`, `react-native-web`, `react-dom`,
`@react-navigation/native`). Then `pnpm install` so `pnpm-lock.yaml` drops what went.

### Phase 3 · Agent V: verification (fresh agent, wrote none of the code)
1. `node scripts/check.mjs` (all steps). Record it in `status.md` with `/check`.
2. **Leftover sweep** (outside `docs/archive/`, `supabase/migrations/` before 20261109, and §2's kept list): zero hits for
   `7-day-delivery|QUICK_HOME|isQuickPath|store_quick|_quick_listings|_quick_days|quick_delivery_on|vendor_account|
   my_vendor_id|vendor_payout|record_payout|roll_cycles|cycle_id|cutoff|house_models|photo_jobs|faster.?offer|9999`
   `|express_|festivalClock|week-strip|lenis|use-live-availability|payment-test|fx_refresh` (`9999` only as
   `bulk_saving_from_cents`'s default; `quick_*` keys only on lines marked `TODO(D-187)` for the old app).
3. Compare with Phase 0's baseline: route timings, first-load JS, build page count, the number of database calls
   Home makes (one). Anything slower is a failure to report, not to accept.
4. On a phone-sized browser (375 px) and a desktop, screenshot Home and check the section order of §5 B; open a tile, a
   card, the bag and checkout for §5 A's cases, and an old order with a 'quick' shipment (it keeps its dates).
5. The FAQ shows the delivery-day definition and the numbers from Settings; no store page shows a calendar date for
   delivery, only "delivery days".
6. **Prices:** every live variant's price after the migrations equals Agent A's export from before (§10 Y-2): 0
   differences.
7. **Checkout stock (§10 Y-3):** a bag with a sold-out piece and one with more than is left: checkout lists each with
   Remove / Keep n, payment stays locked until it is resolved, and the totals change at once (web and app); a product
   page opens no live connection (browser network tab).
8. A "Coming soon" piece appears in no list, search or page (§10 Y-9); the admin still has it.
Report pass/fail per item with evidence; fix nothing yourself.

## 6. Release (the founder)

1. **Backup:** `ops.md` §Moving (a `pg_dump` of the production database, kept **outside** `C:\kod\root`).
2. **Pre-check** (Supabase SQL editor; read-only; Agent A corrects names to the schema):
   ```sql
   select
     (select count(*) from vendors where online_site is null) as real_shops,
     (select count(*) from vendor_accounts)                     as vendor_logins,
     (select count(*) from vendor_submissions)                  as vendor_pieces,
     (select count(*) from vendor_payouts)                      as payouts,
     (select count(*) from cycles)                              as cycles,
     (select count(*) from orders where cycle_id is not null)   as orders_in_a_cycle,
     (select count(*) from order_shipments where kind = 'quick') as quick_shipments;
   ```
   Non-zero `payouts` or `orders_in_a_cycle`: export those rows to CSV first (they are history the drop deletes).
3. Merge `cleanup/simple-store` to `main`, run the **Deploy workflow** at a quiet US hour (it applies the migrations, then
   deploys the site; between the two the old site's 7-day pages may fail for a few minutes while cached pages keep
   showing). Pause the 09:00 UTC daily deploy for that day if it would race.
4. **Smoke test on the live site:** Home's order, a tile, `/7-day-delivery` → `/food`, a food-only bag under and over
   $49.99, a mixed bag (two shipments), the FAQ, the admin's Today, To order and Settings. `monitoring.md` the next day.
5. Build and publish the new Android app; once it is the minimum version, Agent B's `TODO(D-187)` keys come out.

## 7. Founder's calls (answer before Phase 2; the default is used if there is no answer)

| # | Question | Why it matters | Default |
|---|---|---|---|
| 1 | Do you print the **packing list / commercial invoice** for flights? They exist only on the Cycle pages. | they go with Cycles | not used in the pilot → deleted (invoices A/B/C per order stay) |
| 2 | **Every** food listing will promise 7 business days, including food bought from slower shops (Amazon, Flipkart). OK? | about 4,000 live food listings; some may arrive later than promised | yes, as asked; the runner keeps preferring the fast shops, and Today's food watch flags late buys |
| 3 | Should US public holidays also not count as delivery days? | dates around Thanksgiving and Christmas | no, Monday – Friday only |
| 4 | Food that cannot reach the hub fast enough (e.g. out of stock at the fast shops): keep it live or pause it? | the 7-day promise | keep live; the weekly source check moves it to the cheapest fast source first |

## 8. What the founder gets

- One store: the header, Home and search have no second store, and every food card says 7 delivery days.
- One free-shipping line ($49.99), one bar in the bag, and the FAQ that defines a delivery day.
- A lighter database: no per-minute cron job, no shop joins on every card and product page, 11 fewer tables, no
  7-day pages to build or refresh.
- About 10,000 fewer lines to load, test and keep, in the website, the app and the tools.

## 9. More clutter found in Claude's audit: do it in this release (no change customers notice)

Found by reading the code, the database's migrations, the repo and `monitoring.md` on 2026-11-04. Each row names its
owner (the agent whose files it is in).

| # | Area | What | Why it goes | Action | Owner |
|---|---|---|---|---|---|
| R-1 | Repo | 8 old worktrees in `.claude/worktrees/` (all "prunable") and 15 branches (`qa/*`, `worktree-agent-*`), **every one already merged into `main`**; loose garbage in `.git` | clutter in every search and every new agent's view of the repo | `git worktree prune`, delete the 15 merged branches, `git gc` | Lead, Phase 0 |
| R-2 | Repo | `prod.env` sits in the repo root (git-ignored, not committed; Claude did not open it) | CLAUDE.md: pulled env files never live in this folder | the founder moves it outside `C:\kod\root` | Founder |
| R-3 | Repo | `design/` is **24 MB of the repo's ~36 MB** of tracked files (old mockups, `pages/`); only `demo-photos.mjs`, `dev-photos.mjs` and `build-india-map.mjs` touch it | every clone, CI run and search carries it | zip it to a folder outside the repo (history kept), delete it here, drop those scripts' use of it (`build-india-map.mjs` stops writing `design/mockups/shared/india-map.js`) | F |
| R-4 | Repo | the demo round's tools (D-078; production has no placeholders left): `scripts/demo.mjs`, `demo-photos.mjs` (Openverse photos), `dev-photos.mjs`, `pnpm demo:*`, `dev:photos` | built for loading a fake store on a hosted database in early October | delete them and their `package.json` lines; **keep** `catalogue/` + `supabase/seed/*`, the local test data | F |
| R-5 | Website files | **36 photos in `apps/web/public/` that no code uses (about 4.6 MB)**: `smilingsisters.jpg`, `cyclemodel.jpg`, `modelold.jpg`, `sharbat.jpg`, `desifit.jpg`, `joda.jpg`, `retropod.jpg`, `feet.jpg`, `pinkteastall.jpg`, `oldcouple.jpg`, `familytv.jpg`, `home-poster.jpg`, `pcolocal.jpg`, `localbangles.jpg`, `cinemastairs.jpg`, `desivintage.jpg`, `south.jpg`, `chaimodel.jpg`, `desichai.jpg`, `converse.jpg`, `chotasheesha.jpg`, `auto.jpg`, `newcouple.jpg`, `rotichini.jpg`, `familyfood.jpg`, `sistermakeup.jpg`, `tailor.jpg`, `heels.jpg`, `parlechai.jpg`, `trainkids.jpg`, `ind2007.jpg`, `shaadibangles.jpg`, `sign-in.jpg`, `wife bangles.jpg`, and `images/home-hero.avif`, `home-hero-diwali.avif/.webp` | deployed with every build, used nowhere | move them to a folder outside the repo (they may be the founder's photos for later slots), not delete. Re-check each name with a search first | B |
| R-6 | Website, limits | See all's `[show]` route segment (`see-all/[type]/[state]/[category]/[show]/[for]`): since the endless scroll (D-166) the address no longer carries `?show=`, but the route still builds and caches **a separate page for every `?show=` value** a link or a crawler sends | page-cache writes (Vercel ISR budget 100,000 a month) for pages nobody needs | remove the `[show]` segment and its rewrite; the no-JavaScript fallback in `use-browse.ts` (line ~116) loads more with the endless scroll's own request; old `?show=` links land on the first page | B |
| R-7 | Database | no clean-up exists for `cron.job_run_details` (pg_cron logs **every** run: the email timer alone runs 1,440 times a day), `webhook_events`, sent `email_outbox` rows, `admin_error_events` | the free database is already over its memory (1.57 of 1.4 GB on 2026-11-04) and these grow forever | one daily pg_cron job `iwc-tidy`: run details older than 7 days, done webhook events and sent emails older than 30 days, error events older than 90 days. Each delete in batches under the 8 s limit (D-146) | A |
| R-8 | Database | tables no code reads: `newsletter_subscribers` (no code at all), `vendor_sign_in_codes` (in §3 already) | dead weight | drop with §5 A's drops | A |
| R-9 | Database, admin | the "Spices are cleared" switch (`pricing_settings.spices_cleared`, D-074): on since D-107, and food is live only while it is on | a switch that can only ever be on; one wrong click hides all food | remove the switch and its check (food simply follows its status) | A + C |
| R-10 | Dependencies | `qrcode` (web) and `jpeg-js` (app) are used only by the vendor screens; `query-string` (app) is imported nowhere | weight in installs and the lockfile | remove with the vendor code; the Phase 3 knip sweep finds the rest | C, E |
| R-11 | Docs, Claude limits | `docs/status.md` is **82 KB** (about 20,000 words) although it says "short on purpose"; `docs/decisions.md` is **113 KB** with **36 full entries** under Recent (its own rule says about 10); every session reads CLAUDE.md and usually status.md | every agent session spends its budget reading history before it starts; this is a direct cause of hitting usage limits | status.md under 8 KB: what is live, what is open, the last check (history to `docs/archive/status-to-2026-11-04.md`); decisions.md: move D-151 – D-176's full text to `decisions-full.md`, leave index lines; `docs-audit.mjs` warns past 10 KB for status.md | G |
| R-12 | Plan fix | the plan first said to drop the `worker` role's grants; the runner, the weight estimator and the photo redo use that role | would stop sourcing and photos | corrected in §5 A | A |

## 10. Decided by the founder (2026-11-04): changes customers or the admin see

The founder answered every row (§0, verbatim). **Do** rows are part of this release, owned as named; **Keep** rows are
left as they are.

| # | What | Decision | What to build | Owner |
|---|---|---|---|---|
| Y-1 | **Express** (courier from Mumbai, 15 – 18 days: slower than standard and food, at an extra price) | **Do: remove** | no shipping picker (standard is the only shipping); the 7 express settings, express branches in `create_order`, `checkout_context`, `store_policy`, emails, FAQ and Shipping & returns lines, the app's checkout option. Orders already placed with express keep their dates and show "Express" in their history | A, B, C, E |
| Y-2 | **The paused full price formula** (D-119, D-126) and the **exchange-rate refresh** (every 10 minutes; a rate change re-prices all ~8,000 listings, while beta pricing uses a fixed ₹92) | **Do: remove** | keep beta pricing (D-128) and the bag charges (shipping per kg, food at 110% of its label, retailer charges, bulk saving, heavy items). Drop the unused `pricing_settings` columns (pilot recipes, small-food shelf, courier rate card, profit guard, margins, tapers, `food_off_*`, FX), `pricing_estimates`, `fx_fetches`, `cron.unschedule('iwc-fx-refresh')`, the Settings sections and the profit check. **No price may change**: A exports every live variant's price before the migration and the SQL test compares after (0 differences) | A, C; G archives the formula in `pilot-numbers.md` |
| Y-3 | **Live stock on product pages** (Realtime) | **Do: replace** with a stock check at checkout | product pages and cards show the stock their cached page was built with, and nothing live (no Supabase client in the browser, no live connection). **At checkout** (web and app), when it opens and on every re-price, `checkout_context` answers each line's stock; a line that is sold out, has fewer left than the bag asks, or is no longer on sale is listed at the top: its photo, name and option, "Not available right now" (or "Only 2 left"), and a **Remove** button (or **Keep 2**). Payment stays locked until each such line is removed or lowered; totals re-price at once. `create_order`'s own check (INV-3) and its refund stay for the rare race. Drop `variant_availability` from the Realtime publication (the old app's subscription then simply hears nothing) | A, B, E |
| Y-4 | **Listing with the camera** (app: New listing, Add many; web: New listing, Add many) | **Do: remove** | listings come from the importer and the runner; editing a listing stays | C, E |
| Y-5 | **The festival clock and the week strip**, and how delivery is promised | **Do: remove both; say "delivery days"** | §1: store pages say "7 delivery days" / "12 – 16 delivery days", with no calendar dates or day drawings; the FAQ explains the term quietly; checkout and the order page keep the estimated window. Remove `festivalClock`, `FESTIVALS`, `week-strip.tsx` and their tests; the duties stamp stays | A (`homesick.ts`), B, E |
| Y-6 | **Lenis smooth scrolling** (D-049) | **Do: remove** | the browser's own scrolling; drop `lenis` and `smooth-scroll.ts`; keep the reveal and the rows' drift if they do not need Lenis | B |
| Y-7 | **The hero's own fonts** (Cormorant Garamond, Montserrat) | **Keep** | — | — |
| Y-8 | **Empty picture slots**: `home-poster`, Sign in, About us, How it works, Contact | **Do: remove the empty ones** | a slot comes back when it has its photo; Home's order ends Pick your home → delivery band (§5 B) | B |
| Y-9 | **"Coming soon" pieces** (liquids shown with no price) | **Do: hide, and do not load them** | every `store_*` read leaves them out (not fetched and then hidden), search too; their product pages answer 404 until they are on sale; the admin still sees them | A, B, E |
| Y-10 | **The hidden $1 payment test page** | **Do: remove now** (the real payment on the domain is done) | `settings/payment-test`, `features/admin/payment-test/`, `actions/payment-test.ts`, `payment-test.spec.ts` | C |
| Y-11 | **Names to tidy** and **Rename all** (D-146) | **Do: remove once its count is 0** | C checks the count on the local copy and asks the founder for production's (Admin → Products → Names to tidy); removes it only at 0 | C |
| Y-12 | One-off scripts (`stock-every-live-piece-to-10.sql`, `quick-sources.mjs`, `tools/description-redo`) | **Keep** | — | — |
| Y-13 | **Search history**: `search_queries` keeps every search forever | **Do: keep 90 days** | in §9 R-7's daily `iwc-tidy`; Insights' "all time" becomes "90 days" | A, C |
| Y-14 | **`docs/launch-qa-plan.md`** | **Done 2026-11-04** | moved to `docs/archive/launch-qa-plan.md` with a short record on top (done, skipped, still open); `ops.md`, `domain-check.mjs` and `e2e/pay.ts` point there | — |
| Y-15 | **Diwali on Home after Nov 8** | **Keep as it is**; the founder decides after Diwali | — | — |

What the yes rows add up to: about 7 more Settings sections and 50+ settings gone, two more pg_cron jobs gone (the
exchange rate, plus §3's per-minute cycle timer), no live connection and no 66 KB Supabase client on any product view,
no Lenis on desktop, unbuyable pieces never read, a stock problem shown before payment instead of a refund after it,
and fewer tables and functions for the database's API layer to reload (its schema-cache reloads were a load in the
2026-11-03 incident, `docs/archive/launch-qa-plan.md` INC-1).
