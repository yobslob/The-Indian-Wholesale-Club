# Data model

> **Status:** implemented in `supabase/migrations/` (R3 baseline, D-020; the simple store's three migrations, D-187, are the
> latest and are **not on production until the Deploy workflow runs**, `docs/release-simple-store.md`).
> Built and tested on local Supabase first (D-031). The web app uses it since R5, the mobile app since R6.
> See `status.md`. This doc lists tables, purpose, visibility and invariants. Column types and constraints live in the
> migration, so read it for details and don't copy them here.

## Visibility levels (D-003, D-017)
| Level | Who can read | How |
|---|---|---|
| **store** | anyone (anon + customers) | only through `store_*` views/functions exposing whitelisted columns |
| **owner** | the signed-in customer, own rows only | RLS `auth.uid() = user_id` (profiles, addresses, wishlists), or `store_*` views filtered by `auth.uid()` (orders) |
| **admin** | founder + COO | RLS `is_admin()`: `profiles.role = 'admin'` **and** email in `admin_emails` (D-006) |
| **worker** | the founder's machines: the sourcing runner, the weight estimator, the photo and description redo (D-103, D-118) | `worker_*` functions and the photo uploads they allow (role `worker`, `is_worker()`) |
| **service** | server code only (webhooks, jobs, order creation) | service-role key, never shipped to clients |

Customer-facing code (storefront, customer screens in the app) reads catalog and order data **only** through `store_*`
objects. The only base tables it touches are the customer's own rows under owner RLS (`profiles`, `addresses`,
`wishlists`) and the public `variant_availability` mirror (search's "sold out last" and app 1.0.0's read; no longer in the
Realtime publication, D-187). Tables with cost or operations data are never queried from customer code.

## Tables
`*` = admin-only column (never in a `store_*` view).

| Group | Table | Purpose | Visibility |
|---|---|---|---|
| People | `profiles` | one per auth user (created by trigger): name, phone, `role`, `desk`* (D-007). Users may edit only `full_name`, `phone` | owner / admin |
| | `admin_emails` | the DB copy of the admin allowlist, the second gate of `is_admin()` (INV-7). Mirrors the `ADMIN_EMAILS` env var | service |
| | `addresses` | US shipping addresses (one default per user) | owner |
| Places | `regions` | the 36 regions (D-002): slug, name, sort, `is_live`, greeting (native + ISO 15924 script + Latin + meaning), languages, tagline, story, hero image, accent colour, `content_status` (D-019) | store (text only if approved) / admin |
| Catalog | `categories` | browse groups per product type. A child always has its parent's type | store / admin |
| | `products` | region, category, `product_type`, name, slug, summary, description, story, craft, `attributes` (customer-safe JSON), `price_cents`, `status`, search vector; `shop_price_paise`*, `origin_town`*, `has_origin_label`*, `is_placeholder`*; `wears` (women, men, kids, unisex: who it is for, D-140; filled from the name or category on save, required for clothing to go live); `shop_title`* (an imported piece's own title on the shop, D-140 L1); `made_in`* (the country its page states, 'India' by default; D-171: Savana's and NEWME's China pieces; customers see only `store_products.made_in_india`, the customs invoice the country); `description_redo`* (how the description redo last set the summary and description, D-178). Food follows its status (D-187: the "cleared" switch went) | store (live only) / admin |
| | `product_variants` | `options` JSON (colour, flavour, style = "Type", pack, size: D-118), SKU*, label, price override, `weight_g`* with `weight_source`* and `weight_note`* (D-129), `weight_estimate_g`*, `weight_estimate_note`*, `weight_estimated_at`* (D-131), `weight_checked_at`* (D-146), `net_qty` (food, D-133), `qty_listed`*, `qty_reserved`*, `qty_confirmed_at`*, `shop_price_paise`*, `source_id`* | store (`available`, food's `net_qty`) / admin |
| | `product_sources` | the shop items a variant can be ordered as, checked weekly (D-118) | admin / worker via functions |
| | `variant_availability` | public mirror `variant_id → available`, trigger-maintained; out of the Realtime publication since D-187 | store (visible products) |
| | `product_search` | each listing's search words with English stems (name; category, craft, state; summary; type), and since 20261108090000 what search filters, counts and ranks by (type, category, state, `listed`, placeholder, published); trigger-maintained (D-160) | functions only |
| | `search_synonyms`, `search_words` | search's synonym groups (Claude's draft, D-160) and the vocabulary of live listings' words (pg_cron every 6 hours) for spelling fixes and suggestions | admin (read) |
| | `product_media` | Storage paths (bucket `product-media`), alt text, one primary per product, `is_ai` (an AI-generated model photo, D-100: the product's Details say so), `redo` (what the photo redo did, D-163, D-164) | store / admin |
| Supply | `pickups` | **the buy list** (D-187): one per ordered piece: variant, qty, shop price (the variant's own when it has one), status, who/when, photo; `source_id` (the shop item in use), `site` (D-187: the shop of a pickup placed before the release; null afterwards, then the source or the listing names it), `ordered_at`, `ordered_by`, `paid_paise`, `shop_order_ref`, `shop_bill_path` (ordered from the shop, D-140), `arrived_at` (old rows only) | admin |
| | `shop_bills`, `shop_bill_lines`, `shop_bill_photos` | invoice C, one per order (D-140): the shop bill's rows (a piece at its price paid, delivery, extras such as a coupon as a minus), its photos in `vendor-docs/shop-bills/`, draft or final (a final bill's rows and photos are locked by trigger) | admin |
| | `sourcing_settings`, `sourcing_shops`, `sourcing_targets`, `sourcing_runs` | auto-sourcing's rules, shops, targets and run log (D-118) | admin / worker via functions |
| | `stock_movements` | append-only ledger, written by trigger only (INV-4) | admin (read) |
| | `pricing_settings` | one row, the numbers of `pilot-numbers.md`: `food_delivery_days_min/_max` (7, 7), `delivery_days_min/_max` (12, 16), both business days; `domestic_days_*` (Already in the US, calendar days); `free_shipping_min_cents` (4999), `bulk_saving_from_cents` (9999), `shipping_cents_per_kg`, `food_billed_pct`, `retailer_pct`, `small_order_*`, `bulk_saving_pct`, `bulk_saving_cap_cents`, `heavy_line_off_pct`, `shipping_flat_cents`, `min_order_cents`, `home_est_*`, `stale_listing_days`, `leaving_soon_max`, the after-the-sale numbers. An update reprices the store only when it writes `home_est_*` (the trigger is `update of` those two since D-187) | admin |
| Orders | `orders` | number `IWC-YYMMDD-<10 hex>`, email, internal `status`, `fulfilment_mode` (`order_first`, D-024), `shipping_method` (D-041), `est_delivery_from/_to` (D-008), totals in cents (USD only, D-036), `refunded_cents` (D-042), Stripe ids, address snapshot, tracking, carrier, `notes`* | owner via `store_orders` / admin |
| | `order_items` | snapshot (product, variant label, region name), qty, unit price, status (`active`/`unavailable`/`refunded`); the cost snapshot taken when it is placed (D-140): `shop_price_paise`*, `weight_g`*, `weight_source`*, `inr_per_usd`*, `pricing_rule`* | owner via `store_order_items` / admin |
| | `order_events` | timeline: `kind` + `visible_to_customer`. The app turns `kind` into copy (no customer text stored in SQL). `internal_note`* | owner (visible rows) / admin |
| | `promo_codes` | codes, limits, validity. Redeemed via `increment_promo_uses()` | admin |
| | `wishlists` | saved products | owner |
| Settings | `app_settings` | `dev_preview` (true only via `seed/demo.sql`: store shows placeholders + draft text) | admin |
| Ops | `webhook_events`, `pending_orders`, `failed_reconciliations`, `email_outbox`, `admin_error_events` | kept from the old schema. `webhook_events.status` (`processing`/`done`) + `claimed_at`: a claim unfinished after 2 minutes is taken over (F-1); `pending_orders.swept_at`/`sweep_note`: the payment sweep's last look and why it stopped (F-2), `reconciled_by` browser/webhook/sweep | service |
| Ops | `payment_disputes` | Stripe disputes (chargebacks) from the webhook: amount, reason, status, evidence due date, the order; `closed_at` once won/lost (launch QA F-3, migration 20261108090300). `failed_reconciliations` keeps one open row per PaymentIntent (trigger `failed_reconciliations_once`) | service |

**Dropped from the old schema:** `cart_items`, `tracking_events` (→ `order_events`), `reviews` (re-added with the reviews
feature), `product_images` (→ `product_media`), the `size_enum` type (→ `options` JSON).
**Later (founder approval needed):** `home_requests`, `region_waitlist`, `bundles` (`product.md` §Later ideas).

## Store read path (`store_*`, D-017)
**The simple store (D-187, `20261109090000_simple_rules`, `20261109090100_simple_reads`, `20261109090200_simple_drops`). What
this block says wins over the older migration notes below.**
- **Gone:** tables `vendors`, `vendor_accounts`, `vendor_sign_in_codes`, `vendor_applications`, `vendor_submissions`,
  `vendor_submission_photos`, `vendor_payouts`, `photo_jobs`, `house_models`, `order_moves`, `cycles`, `pricing_estimates`,
  `fx_fetches`, `newsletter_subscribers`; columns `products.vendor_id`, `pickups.vendor_id/cycle_id/payout_id`,
  `orders.cycle_id`; about 75 functions (plan §3, `docs/archive/retired-2026-11-simple-store.md`); pg_cron `iwc-roll-cycles`,
  `iwc-fx-refresh`. `profiles` checks `role <> 'vendor'` (an enum value cannot be dropped; a vendor profile became a customer).
  Buckets `vendor-uploads` and `photo-candidates`: hosted Supabase refuses deletes from storage tables from SQL, so the
  migration leaves them with no policy and the founder deletes them in the dashboard. `vendor-docs` stays: it holds the shop
  bills' photos.
- **New:** `_add_business_days(date, int)` (internal; its twin is `addBusinessDays`, the same 20 cases), `_food_bought(uuid)`
  (internal), `admin_food_watch()` (`{open, not_bought, not_shipped}` on `kind = 'food'`), `_tidy()` with pg_cron `iwc-tidy`,
  daily at 08:37 UTC: run details over 7 days, done webhook events and sent emails over 30, error events and `search_queries`
  over 90, in batches of 2,000 (20 rounds a table, under the 8 s limit, D-146). `order_shipments.kind` is
  `food | standard | express`.
- **`store_policy()` keys:** `shipping_flat_cents`, `free_shipping_min_cents`, `bulk_saving_from_cents`, `min_order_cents`,
  `delivery_days_min`, `delivery_days_max`, `food_delivery_days_min`, `food_delivery_days_max`, `us_delivery_days_min`,
  `us_delivery_days_max`, `cancel_fee_pct`, `return_claim_days`, `return_tiers`, `tax`.
- **`store_home()`** adds `categories` `[{slug, name, product_type, count, image_path}]` (the 12 tile slugs, biggest first),
  `most_ordered` and `under_5` (12 cards each at most); `just_listed_types` holds only `clothing` and `home`.
- **Cards** (`_store_product_card`, `store_browse`, `store_search_page`): no `coming_soon`, no `quick_days`. A card's delivery
  line comes from `product_type` and `store_policy()`. A coming-soon piece is left out of `store_products`, `store_media` and
  `product_search` (`listed` = live only); `store_product_page` answers null for it (the 404). `store_browse` and `store_search`
  have no `p_quick`.
- **`store_bag_charges(items, discount, state, line1)`:** `free_min_cents`, `bulk_saving_from_cents`, `shipping_cents`,
  `past_line_cents` (0), `retailer_cents`, `retailer_pct`, `bulk_saving_pct`, `bulk_saving_cap_cents`, `shown_shipping_cents`,
  `heavy_cents`, `heavy_line_off_pct`, `heavy_ids`, `shipments: {days_min, days_max, food_cents, food_only, split, outside,
  shipping_cents}`, `food_ids`, `dates: {food_from, food_to, standard_from, standard_to}`.
- **`checkout_context(ids, promo, state)`:** `variants[]`; `shipping` with `bulk_saving_from_cents`; `delivery`, `food_delivery`,
  `tax`, `us_delivery`, `promo`; **`stock`**: every id asked, in order, `[{variant_id, on_sale, available, product_name, label,
  image_path}]` (not on sale or gone: `on_sale: false`, `available: 0`). Service role only.
- **`create_order`:** always made to order: pickups at once (none for a piece in the US), windows by business days, split =
  food vs the rest, the 48 + DC rule kept. Raises `delivery_window_unconfigured`, `order_has_no_items`,
  `variant_unavailable:<id>`, `price_mismatch:<id>`, `insufficient_stock:<id>`, `subtotal_mismatch`. **Existing orders keep their
  promised dates** (INV-6); an old 'quick' shipment became 'food' with its dates unchanged.
- **Signatures that changed:** `admin_to_order()` has no `vendor_name`, its `site` is `coalesce(source's site, pickup's site,
  listing's source_site)`; `admin_stale_variants()`'s `shop_name` is `site`; `admin_price_sheet(...)` takes `p_site`;
  `admin_sales.by_shop` is `{name, pieces, revenue_cents}` by site; `admin_order_counts()` is only `{by_status}`;
  `admin_create_listing` reads optional `region_id`, `source_url`, `source_site`; `worker_sourcing_add` makes no vendor row and
  ignores `shop_label`; `worker_photo_redo_plan` answers `{listings}`; `ship_shipment` and `ship_order` raise `pieces_not_picked`
  for a shipment whose pieces are not all at the hub.
- **Shims, each `TODO(D-187)`:** until app 1.1.0 is the minimum: `store_policy`'s `express_days_*`, `quick_delivery_*` (`false`
  or null); `store_bag_charges`' `shipments.quick_cents`, `quick_only`, `min_cents`, `gap_cents`, `quick_ids`, `dates.quick_*`;
  `store_home`'s `just_listed`, `delivery`; `store_product_page`'s `delivery`, `quick_delivery`; `store_next_delivery`'s
  `order_by: null`; `store_search_page`'s ignored `p_quick`; a food shipment's `kind` answers `quick` in customer JSON
  (`orderShipmentSchema` reads it back as `food`). After the release only (the old website, for the minutes before its deploy):
  `checkout_context`'s `courier_cents`, `quick_delivery`, `express: null`, and `create_order` still making an Express order
  from a payment priced with it, 15 – 18 days.

Views: `store_regions`, `store_categories`, `store_products`, `store_variants`, `store_media`, `store_orders`,
`store_order_items` (with each item's product photo, `image_path`, since D-088; `guest_order_lookup` returns the same keys), `store_order_events`. Functions: `store_next_delivery()` (the next windows in business days, D-187), and
one-round-trip page reads (PR-2, migration 2) that read **only** the views: `store_home()`, `store_region_page(slug)`,
`store_product_page(region, slug)`, `store_my_order(number)` (signed-in). Since C1 (migration 5, the approved design):
`store_home()` adds `just_listed` (the four newest live products), region-page cards come newest first with
`published_at`, and `store_product_page()` adds `similar` (up to five other live products in the same category, own
region first). All product cards come from the internal helper `_store_product_card(product_id)` (not callable by
anon or customers), which adds `available` and `quick_add` (the variant, only when a product has exactly one and it is
in stock, so a card's "Add" needs no choice). Migration 6 (D-056): `products.is_curated` (an admin's pick) and
`pricing_settings.leaving_soon_max` (default 2); `store_region_page()` adds `curated` (up to four picks) and `leaving_soon`
(up to four live pieces with 1 to `leaving_soon_max` left, read by the internal `_leaving_soon_max()`), and
`store_product_page()` adds `curated` (the region's other picks; since `20261108090400_product_page_reads` both lists
walk an index newest first and stop at 12: `products_category_region_newest_idx`, `products_category_newest_idx`,
`products_curated_newest_idx` on `coalesce(region_id, zero uuid)`, so all-India matches all-India; one all-India
piece's page read 3,165 buffers before, 1,717 after on a production-sized copy). Migration 7 (reviews, D-051, D-056): `reviews`
(rating 1–5, text, display name, one per customer per product; a trigger makes every new review `pending` and sets
`is_verified_buyer` from `_is_verified_buyer(user, product)`: a delivered order on their account with the product) and
`review_photos` (verified reviews only, at most four); customers insert and read their own, admins approve or reject;
`review_eligibility(product)` tells the form whether photos are allowed. The store reads `store_reviews` and
`store_review_photos` (approved reviews of visible products, no user id); `store_product_page()` adds `reviews`
(count, average, per-star counts, the six newest with photos). Photos live in the public `review-media` bucket under
the customer's own folder. Migration 8 (D-058): `store_region_page()` adds `most_wanted` (up to four in-stock live pieces ranked by pieces ordered in the last 30 days: paid orders that are not cancelled or refunded, active lines only; ties to the newer listing). Only the ranking leaves the function, never the counts (D-003); `order_items_product_idx` serves the count. Migration 9 (D-062): the lists rows show grow to 12 (Just listed, Most
wanted, Curated for you, Leaving soon, Similar items). Migration 10 (D-051): `region_photos` (the region album: path
under `regions/<slug>/album/`, required alt text, order; admin-only under RLS), and `store_region_page()` adds `album`
(path and alt text only, in order). Migration 11 (D-019): a trigger sends approved region text back to `draft` when
any of the greeting, its script, the tagline or the story changes (approval and photo, accent or `is_live` changes
leave it alone). Migration 12 (C3): `admin_create_listing(jsonb)`
creates a draft product and its variants in one transaction, quantities stamped as confirmed;
`admin_stale_variants()` lists live variants not re-confirmed within `pricing_settings.stale_listing_days` (nothing
while that is unset, D-047). Both refuse non-admins and run as the caller. Migration 15: `pickups.arrived_at` / `arrived_by`
(old rows only: nothing sets them since D-187). Migration 16: shipping and delivering go
through `ship_order()` / `deliver_order()`. Migration 17 (C5): a trigger queues an `order_update` email for every
customer-visible order event (`_queue_order_email`); `store_my_order()` / `guest_order_lookup()` add `actions` (cancel and
delay choices with their refunds, from `_order_actions`, `_delay_open`, `_cancel_refund_cents`); `_kick_email_outbox()` is
the every-minute timer (pg_net, Vault secrets). Migration 18 (D-067): `store_type_rows(type)`, one row per category
with its total and its first 12 cards (the app's Explore). Migration 20 (C7): `admin_sales(since)` and
`admin_demand(since)` (admin only; real numbers computed in SQL); `search_queries` (the words searched and the number of
matches, no user or address; admin read) written by `store_search(q, offset, limit)`, which the website and app search
now call. Migration 21 (B-3): `rate_limit_hits` (unlogged; keyed-hash caller + rule, one-minute windows) and
`rate_limit_hit()` (service only). Migration 22 (B-8): `admin_attention()` (counts of recent server errors, payments to
check and stuck emails, for Today; the tables stay service-only). Migration 23 (D-068, speed audit): product cards
carry no `summary` or `craft` and read their variants once; `store_region_page()`'s `products` holds only the cards the
page draws (the newest 12 and each category's first 12) plus `category_counts` (every category with its total);
`store_browse(type, region, category, offset, limit)` returns one page of light cards (no stock) for See all with its
total and the per-state and per-category counts; `store_search(..., p_record)` records only when asked (the website's
"Show more" re-reads without recording) and serves pages of up to 500; `create_order` reserves pieces in variant-id order
(PR-9); the `variant_availability` trigger fires only on stock columns and skips writes that change nothing; indexes for
`order_items.variant_id`, `wishlists.product_id` and newest-live-first. Migration 24 (D-075, D-069, D-074): `_auto_price_cents`
is the one price formula (D-128, `docs/pilot-numbers.md`), `products.price_auto` says whether a product follows it, and triggers
reprice when a variant weight, a category's `default_weight_g` or `home_est_*` changes; `admin_price_preview()` lets admins
preview it; `admin_create_listing()` prices a listing without a price. `categories.tax_class` (clothing, food, general; D-073).
`business_details` (exporter, importer, broker, FDA, contact: placeholders until saved; admin-only). Migration 25 (D-073):
`tax_rates` (one row per state where IWC is registered, with the classes it taxes; New Jersey 6.625% on general goods; no row =
no tax; admin-only); `checkout_context(variant_ids, promo, state)` adds each line's tax class (never its weight) and the state's
rule; a cancel refunds the tax (`_cancel_refund_cents`). Migration 26 (D-071, D-072): after the
sale. `products.is_us_stock` marks US clearance pieces (in `store_products`; `store_product_page()` adds `ships_from_us`,
today + the US delivery days); an order of only such pieces is `arrived` at once, with no pickups.
`_to_clearance(item, why)` turns a returned or cancelled piece into a draft clearance product at
`clearance_discount_pct` off what was paid. `_in_india(order)` decides the customer's cancel; `returns` (one per order
line: reason, status, the refund fixed when asked, % kept; admin-only) with `_return_quote(item, reason)` and
`_delivered_at(order)`; `_order_actions()` adds `returns`. New settings: the cancel fee, the after-export deduction, the
claim window, three change-of-mind tiers and the clearance discount. Migration 27: `store_policy()` (anon) returns the
terms the Shipping & returns page states (never a cost, margin or customer-care deduction; keys above). Migration 28:
`checkout_context()` adds `us_delivery` (a bag of only US pieces: today + the US delivery days). Migration 29 (D-078, the demo round): `product_media.credit` (a free-licence photo's
attribution, in `store_media`); `reviews.is_placeholder` (a demo review, written only by the service role, shown only in
demo mode, in `store_reviews` as `is_demo` so the store labels it). `guest_order_lookup(number, email)` returns the
same shape for guests and is **service-only** (the server route rate-limits it). A test keeps its fields identical to the views'.
Migration 31 (D-099, the second speed audit): `admin_order_counts()` (every order by status), admin only, counted in SQL because
the API sends at most 1,000 rows; indexes for orders by status and newest and pickups by status.
Migration 70 (D-136): `store_browse()` takes `p_min_cents`, `p_max_cents` (pieces with a shown price), `p_sizes`
('|'-separated option values; food's `pack` counts as a size) and `p_sort` ('price-asc', 'price-desc', else newest)
and adds `states_total`, `sizes` (value, pieces) and `prices` (min, max, quartiles), each counted with the other
filters applied (`regions` and `categories` keep their meaning, so the app reads as before); `store_home()` adds
`just_listed_types` (the twelve newest of each type); `admin_price_sheet()` takes the Products filters (type, region
or none, category, site, price). Tests: `browse_filters.test.sql`.
Migration 71 (D-140, plan F3, F4, A1): trigger `order_items_snapshot` keeps each order line's cost when it is placed
(older lines backfilled from their pickup or today's listing); trigger `pickups_source` gives a pickup the variant's own
shop price and its shop item in use; the pickup columns for ordering from the shop and the shop bill tables above.
Admin functions: `admin_to_order()` (every piece of a paid, open order not yet ordered, oldest first, with the shop item
in use, its price now, stock and delivery days), `admin_mark_ordered(lines, ref, bill_path)` (pending pieces only; what
was paid defaults to the shop price × quantity; fills the order's shop bill rows; an internal `shop_ordered` event),
`admin_unmark_ordered(pickup)`, `admin_shop_bill(order)` (made on first use with a row per piece and a Delivery row),
`admin_save_shop_bill(bill, lines, note)`, `admin_set_shop_bill_final(bill, final)` (reopening is logged as
`shop_bill_reopened`). Raise `pickup_not_pending`, `shop_bill_final`, `nothing_to_order`, `amount_invalid`. Trigger
`order_events_admin_new_order` queues an `admin_new_order` email to every address in `admin_emails` when an order is
confirmed. Tests: `order_from_shop.test.sql`.
Migration 72 (D-140, plan F2, L2, L8): `products.wears` with trigger `products_wears` (`_wears_from_name`,
`_wears_from_category`; raises `wears_missing` when clothing goes live without it); `_size_norm(text)` and
`_variant_size(options, type)` (one spelling per size; clothing without a size is One size); `store_browse()` takes
`p_for` ('women' | 'men', unisex under both) and returns `wears` counts, matches sizes by their one spelling, puts a
state's own pieces first in the newest order (under every sort since `20261108090500_browse_reads`, D-181) and mixes
pieces published at the same moment by shop and category (never returning the shop); `store_home()` mixes the same way in Just listed; `store_region_page()` puts the state's own pieces
first in Most wanted, Curated and Leaving soon too. Tests: `wears_and_rows.test.sql` (older test files that make generic
"Test" clothing switch the wears trigger off inside their own transaction).
Migration 73 (D-140, L1): `products.shop_title` (admin only, backfilled from the names of imported listings);
`tests.forbidden_keys()` adds it and the order line's cost snapshot keys.
Migration 74 (D-140, F8, F9): `_store_card_options(product)` (up to 20 of a piece's variants: id, label, options, price,
available, from `store_variants`); `_store_product_card()` and `store_browse()` cards add `options`.
Migration 75 (D-140, F5): `store_bag_charges()`'s `shown_shipping_cents` (since D-154 the same figure as Shipping per kg). Display
only: never charged, stored or sent to Stripe.
Migration 76 (D-140, L4): the `products_wears` trigger also raises `care_missing` when clothing goes live without its
care (`attributes.care`), placeholders and US clearance exempt.
Migration 77 (D-140, L7): `store_home()` adds `band` (`free_min_cents`, `return_claim_days` from `store_policy()`), so
Home's band needs no second read.
Migration 78 (2026-10-18, the production build's statement timeouts): `_size_norm` and `_variant_size` are single
expressions with no SET clause, so Postgres inlines them; `store_browse()` reads the visible pieces' variants once and
spells each distinct size once. At production volume (3,000 food, 2,800 clothing listings) food's See all went from
1.3 s to about 0.11 s, clothing for men from 1.0 s to about 0.14 s, a state's See all from 0.33 s to 0.07 s.
Migration 79 (D-140, the photo fix): an album photo may sit in its `c/` folder beside its fixed copies
(`regions/<slug>/album/c/<name>`); listing photos and state photos had no path rule.
Migration `20261022090000_assign_weights` (D-146, admin only, every one checks `is_admin()`):
`product_variants.weight_checked_at` (an admin accepted the weight Weights to check showed; trigger
`product_variants_weight_checked` clears it when the weight changes; `_weight_needs_check` skips an accepted weight).
`admin_weight_plan(limit)` (listings with an active or held option without a weight, live first, at most 200, and
`left`); `admin_assign_weights(items)` (only options without a weight: the website's `class` weight for clothing or
`packed` for food, else the middle weight of the 7 most similar pieces of the category weighed by a trusted source,
same words in the name and the closest shop price, through `_weight_words`, else the category's `default_weight_g`,
both `estimated`; returns `ruled`, `similar`, `usual`); `admin_accept_weights(limit)` (marks up to 5,000 shown weights
accepted); `admin_publish_drafts(limit)` (now publishes at most `limit` a call, 500 by default, and returns `left`);
`admin_rename_listings(items)` (up to 500 names in one statement, the old name kept as `shop_title`);
`admin_archive_unready_drafts()` (drafts without a photo, an active option or stock become archived; counts by
reason). Never placeholders or US clearance pieces. Tests: `assign_weights.test.sql`.
Migration `20261101090000_quick_sources` (D-162): `_quick_sourceable(product)` (internal: every active option with a usable
source has one on a shop marked `sourcing_shops.quick_delivery`, Blinkit, BigBasket, Zepto, Instamart: the "fast shops" in admin
copy; not limited to food, so home listings keep their source and price); `_sourcing_settle` then picks the fast shop's source
first, else the cheapest. `ops_quick_sources(apply, limit)` (service role only: the listings bought elsewhere that would switch,
then the switch in batches, each listing's `source_checked_at` kept; `pnpm quick:sources`). Tests: `quick_sources.test.sql`.
Migration `20261023120000_seven_day_shipments` (D-154, step 1; rules since D-187): `pricing_settings.shipping_cents_per_kg`
(1862). `order_shipments` (an order's one or two shipments: `seq` 1 | 2, `kind`, dates, `shipping_cents` its share, `status` open |
shipped | delivered | cancelled, carrier, tracking, `shipped_at`; admin read, written by `create_order`; every older order got
one, carrying its tracking) and `order_items.shipment_id`. `_bag_shipments(items, discount, state, line1)` (internal): food vs the
rest, `split`, `outside` (not the 48 states or DC, or a PO box / APO), the billed weight and Shipping (one parcel) with its share.
Tests: `shipments.test.sql`, `bag_charges.test.sql`.
Migration `20261024090000_shipment_admin` (D-154, step 2; rules since D-187): shipments run one at a time. `order_events.shipment_id`
(the event is about that shipment; its `order_update` email row carries `shipment`, its seq). `ship_shipment(shipment, carrier,
tracking)`: from the hub once its pieces are picked; `deliver_shipment(shipment)`. The order follows its shipments (`_settle_order`,
also after any piece's status changes): a shipment with nothing left to send is cancelled; the order is `shipped` once nothing is
open, `delivered` once nothing is on its way, with the latest tracking. `ship_order` and `deliver_order` work on an order of one
shipment (`order_has_two_shipments` otherwise), and so does `change_delivery_window`; an order of one shipment copies its window to
it. `change_shipment_window(shipment, from, to, note)`: the delay notice for one shipment (the order's window spans its shipments);
`_delay_shipment(order)` and `_delay_refund_cents(order)` (internal) scope `_delay_open` / `cancel_after_delay` to that shipment.
`shipment_cancel_cents(shipment, reason)` and `admin_cancel_shipment(shipment, reason, amount, ref)`: one of two shipments cancelled
(a food one until its pieces are ordered or at the hub, the other until it leaves India): its pieces after their discount share, its
Shipping share and their tax back (the cancel fee for the customer's own once at the hub). `customer_cancel` refuses (`food_bought`),
and `_order_actions.can_cancel` is false, once a food shipment's pieces are bought; `_order_actions.delay_shipment`.
`admin_to_order()` adds `buy_by` / `ship_by` (2 hours, 1 day) for a food piece. `_order_shipments_json(order)` (internal):
`guest_order_lookup` and `store_my_order` add `shipments` (seq, kind, status, dates, Shipping share, carrier, tracking, `item_ids`);
`store_order_events` and their events add `shipment`. Tests: `shipment_admin.test.sql`.
Migration `20261027090000_seven_day_insights` (D-154, step 5): `order_shipments.promised_to` (the last day promised when the order was
placed, set by the `order_shipments_promise` trigger, `_shipment_promise()`; a delay moves `est_delivery_to`, never this).
Migration `20261028090000_vessel_weights` (D-155): a home bottle's or lunch box's option no person weighed or typed and
above the founder's range (550 g, 800 g) is set to 500 g or 700 g (`packed`, its note saying so); the reprice trigger
moves its price. Migration `20261028100000_heavy_items` (D-155): `products.heavy_item` (trigger `products_heavy_item`,
`_heavy_item_default()`: a home piece named a cooker when it is inserted; `products_heavy_reprice`,
`_reprice_on_heavy()`: ticking or unticking reprices it); `_priced_weight(g, heavy)` (half a heavy piece's weight,
rounded up), used by `_product_auto_price` and `_reprice_products`, which also writes
`product_variants.heavy_cents` (the price on the whole weight less the price on half; 0 for others);
`store_variants.heavy_cents` (0 when the piece is priced by hand); `pricing_settings.heavy_line_off_pct` (20);
`store_bag_charges` adds `heavy_cents` (the bag's), `heavy_line_off_pct` and `heavy_ids`; `orders.heavy_shipping_cents`
(its part of `shipping_cents`, written beside it like `retailer_charge_cents`). Tests: `heavy_items.test.sql`.
Migration `20261029090000_region_head` (D-157): `store_region_head(slug)`, a state page's head without card lists
(`region`, `album`, `most_wanted`, `curated` as `store_region_page()` gives them, and `type_counts`: each type's own and
all-India pieces); the state page reads it and one `store_browse()` (the website falls back to `store_region_page()`
while the function is missing). `store_region_page()` is unchanged. Tests: `region_head.test.sql`.
Migrations `20261105090000_newme_shop` and `20261105100000_imported_pieces` (D-170, D-171): shops NEWME (`newme`) and
Savana (`savana`), 10 days each; a shop's own `delivery_days` is its limit when longer than Settings' (`_sourcing_settle`,
`_quick_sourceable`); `products.made_in` (the country its page states, 'India' by default; kept on a US clearance copy,
`_to_clearance`); `store_products`, `store_order_items` and `guest_order_lookup`'s items append `made_in_india` (the
country itself stays admin-only); worker only: `worker_set_origin(product, made_in)` (a listing the runner made; returns
whether one was changed). Tests: `imported_pieces.test.sql`.
Migration `20261107090000_description_redo` (D-178): `products.description_redo` (`rewritten`: the redo's new summary
and description, approved; `edited`: the founder's own on the review page; null: not done, so planned, a listing the
runner adds later too). Worker only: `worker_description_plan(type, after, limit)` (listings by id after `after`,
of one type or all, not placeholders or archived, with a summary or description and no mark; each with its
attributes, `made_in`, `shop_title`, the shop's name and `hash`, the words' md5; at most 50) and
`worker_description_set(product, hash, summary, description, redo)` (the new words, empty ones stored as null; only
while the listing has no mark and its words still hash to `hash`; false otherwise; raises `price_or_link` for a price
or a link, `too_long` past 300 / 4,000 characters, `bad_redo`). Internal: `_description_hash(summary, description)`.
No store change: the views show the new words as they are. Tests: `description_redo.test.sql`.
Migration `20261104090000_home_photos` (D-169): `home_photos` (Home's own mosaic photos: path under `home/album/`,
required alt text, order; admin-only under RLS), `admin_order_home_photos(ids)` (the admin's new order in one call,
RLS-bound), and `store_home()`'s `album` reads only them, in order, up to 60 (no state album or listing photo).
Migration `20261103090000_photo_redo_modes` (D-164): `product_media.redo` may be `fresh` (the light refresh, any
type); `_redo_wanted` plans every stored photo of every type (clothing's vendor AI ones excepted); the plan includes
kids' pieces (their faces are cut off, never drawn); `worker_photo_redo_set` takes `fresh` for any type;
`worker_photo_redo_drop(media, old_path)` (worker: a photo removed on the review page, only while the listing keeps
another and the row is as read; the next photo becomes the main one). Tests: `photo_redo.test.sql`.
Migration `20261102090000_photo_redo` (D-163): `product_media.redo` (face, food, scene, or kept: looked at, nothing to
change; null: not done). Worker only: `worker_photo_redo_plan(type, after, limit)` (listings by id after `after` with
photos still to do: every clothing photo but kids' pieces and vendor AI ones, food's and home's main photo; stored
photos only), `worker_photo_redo_set(media, old_path, new_path, redo)` (a new path in the
listing's own `s/` folder, or `kept`; only while the row still has `old_path` and no redo; false otherwise),
`worker_photo_redo_scene(media, old_path, new_path, alt)` (home: the scene becomes the main photo, the plain one second)
and `worker_photo_stems_in_use(stems)` (which stored photos, paths without their extension, a listing still shows; at
most 1,000). Internal: `_main_photo(product)`, `_redo_wanted(media, type)`. No store change. Tests: `photo_redo.test.sql`.
Migration `20261030090000_search` (D-160): search that reads words as customers write them, at no running cost.
`product_search` (one row per listing: `doc`, a weighted English tsvector of name A; category, craft and state B;
summary C; type D; GIN-indexed; kept by triggers on `products`, `regions` and `categories` renames), `search_synonyms`
(`term`, `grp`, `term_key` = `_search_key(term)`, the sorted English stems), `search_words` (`word`, `word_key`,
`ndoc`: live listings' name, category, craft and state words, one spelling per stem (the shortest), no stop words, plus
one-word synonyms of groups in use; `refresh_search_words()`, pg_cron `iwc-search-words` every 6 hours, writes only
what changed). `_search_match(q)` reads a search: its
words (`_search_split`: at most 8), one tsquery per word with its synonyms and, for a last word no listing uses, its
beginning (`_search_term`, `_search_groups`; a two-word synonym such as "gram flour" counts as one); every word, else
the words spelled as the nearest vocabulary word (`_search_fix`: one change up to five letters or a swap, two from six,
fuzzystrmatch's levenshtein), else some of the words; hits are listings whose `doc` matches or whose old
`products.search` (simple words with the description) has every word (`_search_hits`). `store_search_page(q, type,
category, region, sort, offset, limit, record, quick)` returns one jsonb (`quick` is ignored, app 1.0.0 still sends it): `query`, `fixed`, `mode` (`all` · `fixed` ·
`some` · `none`), `total`, `all_total`, `types` (counts with the state filter), `categories` and `regions` (top 12 with
the other filters), `named_regions` (states the words name), `products` (cards as `store_browse`'s); best match puts
pieces that cannot be bought (sold out) last, the listing's own words before its description, then
`ts_rank` + 0.5 per word matched + whole words over synonyms + the words in the name in order + a named state + new in
14 days. It records only the first page of an unfiltered search, a fix's words in `search_queries.fixed`, and a search
answered only by some words as 0 results with `partial`. `store_search(...)` keeps its arguments and rows and answers
from it. `store_search_hints()` (anon): the 1,500 most used words, synonym groups in use, categories and states with
their counts, and popular searches (30 days, 3 or more, results, only vocabulary words). `admin_search_fixes(since)`:
searches answered through a fix, with `pairs` (each changed word: typed, read as, already a synonym);
`admin_add_synonym(term, means)` puts the typed word in the group of the word it was read as (Insights' button) and
refreshes the vocabulary. Tests: `search.test.sql`.
Migration `20261108090000_search_speed` (launch QA D-1, INC-1: search read the disk, 500 after 90 s): `product_search`
gains `product_type`, `category_id`, `region_id`, `listed` (since D-187: live), `is_placeholder`, `published_at`, rebuilt once and
kept by the same trigger (it also fires on a
listing's status, coming soon, placeholder and published time); its GIN index is partial (`product_search_listed_doc_idx`,
`where listed`). `variant_availability_on_sale_idx` (`variant_availability (product_id) where available > 0`): the
"sold out last" check. `_search_hits` is plpgsql (it was an un-inlined SQL function planned once for any words: a scan
of every listing per search) and reads only `product_search`; the old `products.search` (description) is read only when
no listing's own words match. `store_search_page` reads hits, counts, filters and best match from `product_search`,
stock (and a price sort's price) for the best 1,000 only, and listing rows only for the cards; `total` and `all_total`
stop at 1,000 with `capped` true ("1,000+"); `slow` is true when `_search_late()` (2.5 s since the request's statement
began; `iwc.search_budget_ms` overrides it, for tests) skipped the spelling-fix or some-words pass. `_search_match`
returns `slow` too. A function-level `statement_timeout` would not stop the running statement (Postgres arms it at
statement start), so the hard stop is the role's timeout and the website's 3.5 s limit (`SEARCH_TIMEOUT_MS`).
`store_search_hints()` counts categories and states from `product_search`. Every function here plans with its words
(`plan_cache_mode = force_custom_plan`). Measured on 8,278 live listings with 16 MB of shared buffers (`EXPLAIN
(ANALYZE, BUFFERS)`, cold / warm reads outside the cache): saree 4,677 / 2,077 → 801 / 0; kurti 4,776 / 2,369 → 939 / 0;
masala 4,112 / 2,152 → 906 / 0; ghee 4,685 / 2,249 → 932 / 0; xyzqq (nothing) 1,956 / 1,326 → 370 / 0 (of the cold
reads about 370 are Postgres' own catalogue after a restart). Tests: `search_speed.test.sql`.
Migration 80 (D-141, the photo store): a photo in Cloudflare R2 is recorded with an `s/` path
(`products/<id>/s/<name>.jpg`, packages/shared media.ts). `worker_sourcing_media` accepts `products/<id>/s/<name>` as
well as `products/<id>/<name>`; album photos may be `regions/<slug>/album/s/<name>`.
Migration 69 (D-135): `products.coming_soon`, `coming_soon_note`, `liquid_checked_at`; trigger `products_coming_soon`
(any status but archived ends it). Since D-187 no `store_*` read shows such a piece. Worker only:
`worker_liquid_plan(after, limit, all)` (food and home listings not yet checked) and `worker_set_liquids(items)` (marks each
checked; archives a liquid as coming soon; returns how many). Tests: `coming_soon.test.sql`.
Migration 68 (D-134): worker only: `worker_home_plan(limit, all)` (home listings with an option whose weight is
missing, unrecorded, a matching item's or an estimate; `all`: every one not weighed or typed; with every page each
option is on) and `worker_set_home_weights(weights)` (home only; `shop`, `packed` or `similar`; never over a weighed or
typed weight, a similar one never over a page's own; returns how many changed). `worker_sourcing_add` keeps a new home
option's packed weight. No store change. Tests: `home_weights.test.sql`.
Migration 67 (D-133): `weight_source` may be `packed` (food: the label's net quantity plus its pack, worked out by
`packages/shared/src/sourcing/estimate/food.ts`); `product_variants.net_qty` (the net quantity as the label states it,
"400 g", "2 × 200 g"; customers see it: `store_variants.net_qty` for food, and `_store_pack` falls back to it). Worker
only: `worker_food_plan(after, limit, all)` (food listings with an option not weighed, typed or packed, or without a
net quantity; `all`: every one) and `worker_set_food_weights(weights)` (food only; always keeps the net quantity, the
weight never over a weighed or typed one; returns how many changed). `_variant_weight` refuses `weight_weighed` (23514)
when an admin types a weight over one weighed at the hub (weighing it again replaces it); `admin_weigh_pickup` also
replaces the other flavours' packed weights of the same net quantity; `worker_sourcing_add` keeps a new food option's
packed weight and net quantity. Shop pages (`worker_set_weights`) and estimates do not replace a packed weight. Tests:
`food_weights.test.sql`.
Migration 66: `worker_sourcing_target_release(target, note)` (worker): a target whose search failed on every shop goes
back to the queue instead of "nothing fit". Tests: `runner_by_type.test.sql`.
Migration 65: `worker_sourcing_plan(checks, type, site)`: with a product type (and a shop) it claims only that type's
queued targets (open to that shop), lists only that shop or the type's shops, and re-checks only that type's listings
(with a shop: only those sourced there alone), so two runners share the work. Tests: `runner_by_type.test.sql`.
Migration 64 (D-132): `weight_source` may be `class` (clothing by the founder's four classes, 350 / 750 / 800 /
1,500 g). Worker only: `worker_clothing_plan(after, limit, all)` (clothing listings with an option not weighed, typed
or already classed; `all` also classed ones) and `worker_set_class_weights(weights)` (never on food, a weighed or a
typed option; returns how many changed). `worker_estimate_plan` leaves clothing out; `_weight_needs_check` never
calls a class weight unusual; `admin_weigh_pickup` also replaces the other sizes' class weights. Shop pages
(`worker_set_weights`) and estimates do not replace a class weight. Tests: `clothing_classes.test.sql`.
Migration 63 (D-131): `weight_source` may be `estimated`; `product_variants.weight_estimate_g`, `weight_estimate_note`,
`weight_estimated_at` (the weight estimator's latest, kept after weighing). Worker only: `worker_estimate_plan(after,
limit, mode)` (missing / redo / audit; every option with `wanted`), `worker_weight_references(after, limit)` (weighed,
typed and shop weights, with the estimate made before), `worker_set_estimates(estimates)` (keeps each estimate, never
on a weighed or typed option; a sure one becomes the weight of an option with none or an estimate; returns
`{estimates, weights}`). `_variant_weight` keeps the source when a weight is rewritten with a new note;
`_weight_needs_check` also lists a shop weight the estimate is over a third away from; `admin_weights_to_check` returns
the estimate; `worker_set_weights` lets a shop's page replace an estimate; `worker_weight_plan` reads estimated
listings too (missing first); `admin_weigh_pickup` also replaces the other sizes' estimates. Tests:
`weight_estimates.test.sql`.
Migration 62 (D-130): `pickups.weighed_g` and `weigh_note`; `admin_weigh_pickup(pickup, grams)` (admin, a picked
piece) sets the option's weight (weighed), fills the same piece's sizes that have none or a similar one, reprices,
and returns and stores what changed. Tests: `weigh_at_hub.test.sql`.
Migration 61 (D-129): `product_variants.weight_source` (weighed, admin, shop, similar) and `weight_note`; trigger
`product_variants_weight` (`_variant_weight`): a weight changed without a source is the changer's (admin or worker),
the worker never overwrites a weighed or typed weight, a new size or colour takes its sibling's weight (similar; never a
pack), a live option cannot lose its weight and a new worker item without one on a live listing is held inactive
(`_weight_held_note()`) until it has one; trigger `products_weight_before_live` refuses `weight_missing` (23514) for a
listing with an active option without a weight (not demo rows or US clearance pieces); `admin_publish_drafts` counts
`no_weight`; `admin_create_listing` and `worker_sourcing_add` store the source and note; `admin_weights_to_check(offset,
limit)` (admin), `worker_weight_plan(limit)` and `worker_set_weights(weights)` (worker). Tests: `weights.test.sql`.
Migration 52 (D-122): footwear's `default_weight_g` 600; `_store_pack(product, name, type)` and the cards (`_store_product_card`,
`store_browse`) carry `pack`; `store_browse` returns `all_total`. Tests: `food_cards.test.sql`, `pricing_engine.test.sql`.
Migration 50 (D-121): `products.region_id`, `order_items.region_name` and `sourcing_targets.region_id` may be empty (an all-India
listing). `store_products` left-joins the state; `store_region_page` and
`store_browse` add the all-India pieces to every state after its own (counts too); `store_product_page` finds them under
`store_browse` add the all-India pieces to every state after its own (counts too); `store_product_page` finds them under
`india`; `create_order` and `admin_demand` keep them without a state. `sourcing_targets` gains `sites`,
`min_price_paise`, `max_price_paise`, `listings` (and its name is unique per state or all states); the runner's plan
returns them. `pricing_settings.home_est_g_per_rupee`, `home_est_min_g` and `_fallback_weight_g(type, shop, category)`:
home & gifts without a weight is priced at shop ₹ × g per rupee (at least the minimum, at most the category's weight)
in `_product_auto_price`, `_reprice_products` and `worker_sourcing_add`. Tests: `all_india.test.sql`.
Migrations 48 – 49 (D-120): `admin_publish_drafts()` (admin only) publishes every ready draft one by one and returns how many went
live and what held the rest (`no_photo`, `no_option`, `no_stock`, `refused`, `live_missing_details`). Tests: `publish_drafts.test.sql`.
Migration 47 (D-119): the bulk saving `bulk_saving_pct`, `bulk_saving_cap_cents` (from `bulk_saving_from_cents` since D-187);
`store_bag_charges` returns the two numbers; `orders.bulk_saving_cents` is the part of `discount_cents` that was the bulk saving
(admin view). Migrations 56 – 60 (D-127, D-128): `_auto_price_cents` is the fixed formula, the founder's exact rules, alone since D-187
(`docs/archive/pricing-full-formula.md` keeps the full one); migration 60: `admin_price_sheet()` for Products → Download Excel. Tests:
`pricing_engine.test.sql`, `bag_charges.test.sql`.
Migrations 44 – 46 (D-118, auto-sourcing): `sourcing_settings` (one row: delivery limit, listings per target, check
interval, pieces per variant, targets per run, the price-jump guard, auto-publish), `sourcing_shops` (each shop the
runner searches: its reader, types, fallback delivery days, on/off, last good run and problem), `sourcing_targets`
(name, query, `must_match`, type, category, region, tier, status `queued → searching → found / none`, `paused`; one per
name and state), `product_sources` (every shop item a variant can be ordered as: site, page, item address, `item_key`
(the shop's id; null for a pre-D-118 import until its first check), price, MRP, stock, delivery days, check date, failed
reads, a held price in `review` / `review_price_paise`; unique per site and item) and `sourcing_runs` (the run log), all
admin and worker only; `products.sourcing_target_id`; `product_variants.shop_price_paise` (a variant's own shop price:
it is auto-priced from it at its own weight, and the product's price is its cheapest variant's, `_product_auto_price`;
`_reprice_products` reprices variants too) and `source_id` (the source the desk orders from). The runner (role `worker`)
uses `worker_sourcing_plan(checks)` (settings, shops, the targets it now holds, the listings due a check with their
sources, the items already listed), `worker_sourcing_add(target, listing)` (a draft listing for the
target's state with its variants, sources and backups; an item already listed returns that listing),
`worker_sourcing_media(product, media, publish)` (photos once, under `products/<id>/`; storage allows the upload only
where `worker_may_add_photos(product)` says; since D-168 each photo may carry its `redo` mark, `face` for clothing or `fresh`, when the runner made it again before upload), `worker_product_wears(product)` (who a runner's clothing listing is for, so a kids' face is only cut), `worker_sourcing_target_done(target, note)`,
`worker_sourcing_checked(product, results)` (prices and stock follow the shop, a jump beyond the guard is held, new items
become variants, then `_sourcing_settle`: each variant takes its best usable source, its shop price and a top-up of
pieces, or stops selling) and `worker_sourcing_log(run)`. Admins decide a held price with
`admin_sourcing_review(source, accept)`. `admin_create_listing` takes a variant's `shop_price_paise`. Tests:
`supabase/tests/auto_sourcing.test.sql`.
Migration 42 (D-113): `store_home()` adds `album` (up to 30 photos: the states' album photos, then the main photo of
each state's newest pieces, one state at a time in turn).
Migration 41 (D-112): `_auto_price_cents` without card fees; `pricing_settings.small_order_shipping_cents` and
`small_order_retailer_cents` (fixed charges) replace D-111's courier rates, `small_order_margin_pct` and
`parcel_handling_paise` (dropped); `store_bag_charges` returns the fixed amounts for a bag with a piece from India.
Migration 40 (D-111): `pricing_settings` margins by type (`margin_clothing_pct`, `margin_food_pct`, `margin_home_pct`),
the courier's rates (`courier_first_kg_paise`, `courier_next_kg_paise`), `small_order_margin_pct` and
`parcel_handling_paise`; `_auto_price_cents(shop, weight, type)` (the two-argument form = no type) and
`admin_price_preview(shop, weight, type)`; `orders.retailer_charge_cents` (the part of `shipping_cents` that was retailer
charges, admin view); `store_bag_charges(items)` (anon: a bag's small-order shipping and retailer charges and the
free-shipping line, never a weight; `supabase/tests/bag_charges.test.sql`).
Migrations 38 – 39 (D-110): the type `spice` renamed `food`; imported
listings: `products.source_url` (unique, https), `source_site`, `source_checked_at`, `source_in_stock`, all admin-only (no `store_*`
object reads them; `supabase/tests/sourced_listings.test.sql`).
Migrations 36 – 37 (D-106): the product type `home` (Home & gifts) with its three categories, taxed as general goods by
the category trigger, and the business detail `hs_home` for its shipping documents.
Migrations 32 – 35 (D-103): the role `worker` and `is_worker()`, kept for the sourcing runner, the weight estimator and the photo
and description redo (the vendor half went with D-187).
`checkout_context(variant_ids, promo_code)` (migration 3, **service-only**) returns what the server needs to price a bag in
one round trip: the variants as customers can buy them (through `store_*`), the promo if usable now, the shipping settings
and the next window (D-038).
They run with the owner's rights and expose only whitelisted columns (`storefront.md`). `store_orders.customer_status`
collapses internal statuses into what customers see (`flows.md` §8). Two small helpers are callable by visitors:
`dev_preview()` (is the dev preview on) and `is_product_visible(product)` (the one "may a customer see this product"
rule, used by the `variant_availability` read policy so the mirror never reveals hidden products).

## Business functions (the only way to do these things)
| Function | Who | Does (flows.md) |
|---|---|---|
| `create_order(jsonb)` | service (server, after Stripe verification) | §3: checks prices + subtotal, reserves stock atomically, makes the shipments and the buy list, stores the windows. Raises `delivery_window_unconfigured`, `variant_unavailable`, `price_mismatch`, `insufficient_stock`, `subtotal_mismatch`, `order_has_no_items` |
| `ship_shipment(shipment, carrier, tracking)`, `deliver_shipment(shipment)` | admin | §6: a shipment leaves from the hub once its pieces are picked (visible "Shipped" event), and is delivered. Raises `pieces_not_picked`, `invalid_tracking` |
| `ship_order(order, carrier, tracking)` | admin | §6: the same for an order of one shipment. Raises `pieces_not_picked`, `order_has_two_shipments`, `invalid_tracking`, and `order_not_arrived` only when nothing is left open |
| `deliver_order(order)` | admin | §6: a shipped order is delivered (visible event). Raises `order_not_shipped` |
| `keep_after_delay(order)` | service (customer through the server), admin | §7: the customer keeps the order after a window change. Raises `no_open_delay` |
| `cancel_after_delay(order, amount, ref)` | service, admin | §7: full refund after a window change (D-008), stock released for pieces not collected, collected ones to US clearance (D-072). Raises `no_open_delay`, `refund_amount_mismatch` |
| `customer_cancel(order, amount, ref)`, `_customer_cancel_cents(order)` | service (customer through the server), admin | §7b: the customer's cancel until the order leaves India (D-072): everything back minus `cancel_fee_pct` once pieces are collected; pieces not collected back to stock, collected ones to clearance. Raises `order_left_india`, `refund_amount_mismatch` |
| `admin_cancel_after_export_cents(order)`, `admin_cancel_after_export(order, amount, ref)` | admin | §7b: customer care cancels after it left India: all but `export_cancel_deduction_pct`, every piece to clearance. Raises `order_still_in_india_or_done`, `refund_amount_mismatch` |
| `request_return(order, item, reason)` | service (customer through the server), admin | §7c (D-071): a delivered piece, the refund fixed by `_return_quote` now. Raises `not_returnable`, `item_not_in_order` |
| `admin_return_received(return)`, `admin_return_refunded(return, amount, ref)`, `admin_return_rejected(return, note)` | admin | §7c: the piece is back (it becomes a clearance draft), refunded (Stripe first; the amount must be the fixed one), or rejected. Raise `return_not_open`, `return_not_received`, `refund_amount_mismatch` |
| `mark_pickup(pickup, status, photo, note)` | admin | §4: at the hub (`picked`) / `unavailable` (+ D-030 refund flag + customer event) |
| `change_delivery_window(order, from, to, note)` | admin | §7: the only way to move a window (INV-6) |
| `increment_promo_uses(promo)` | service | guarded promo redemption |
| `checkout_context(variant_ids, promo)` | service | §3 step 1: pricing inputs and stock for a bag (read-only) |
| `claim_webhook_event(event_id, event_type)` | service | §3: true when this delivery may process the Stripe event (the first, or a retry of one still `processing` after 2 minutes); the handler then marks it `done` (F-1) |
| `claim_payment_sweep(limit)` | service | §3: stamps and returns up to `limit` (≤ 50) unreconciled checkouts 10 minutes to 2 days old not looked at in the last hour (F-2). `_kick_payment_sweep()`, pg_cron `iwc-payment-sweep` every 10 minutes, calls the site's sweep only when one is due |
| `item_refund_cents(item)`, `cancel_refund_cents(order, reason)` | admin | D-042 refund amounts (the only place the rules live) |
| `refund_order_item(item, amount, ref)` | admin | §4: records the Stripe refund of an unavailable piece; re-checks the amount |
| `cancel_order(order, reason, amount, ref)` | admin | §7b: cancels before it ships, releases stock, records the refund; re-checks the amount |
| `record_stripe_refund(payment_intent, refunded_cents, refund_id)` | service | §3 (F-3, `charge.refunded`): the order's `refunded_cents` catches up with Stripe's cumulative refund (never down, never past the total), `payment_status` becomes refunded / partially_refunded and a customer-visible `item_refunded` event queues the refund email. Returns `found`, `order_number`, `applied_cents` (0 when the admin already recorded it) |
| `record_payment_dispute(dispute, payment_intent, charge, amount, currency, reason, status, due)` | service | §3 (F-3, `charge.dispute.*`): keeps `payment_disputes` current; `is_new` only the first time (one alert); won / lost / warning_closed close it. `admin_attention()` counts the open ones (`disputes_open`) |
| `admin_set_listed_qty(variant, qty, note)` | admin | stock correction with a ledger note. It also counts as re-confirmed with the shop |

**Privileges rule:** Supabase grants every new function to everyone by default. Any migration adding a function must set
its grants explicitly. `schema.test.sql` fails if anon/customers can execute anything beyond the whitelisted functions.

## Invariants
Enforced by the DB, and each covered by a test that **fails when the rule breaks**. Each was checked by deliberately
breaking it and watching the test fail ("mutation check", `status.md`).

| ID | Invariant | Enforced by | Test (`supabase/tests/`) |
|---|---|---|---|
| INV-1 | anon/customers can't read admin-only tables or columns | grants + RLS + `store_*` | `rls_visibility.test.sql`, `schema.test.sql` |
| INV-2 | customers can never create/update/delete orders, items, events. Only `create_order` (service) creates orders | RLS + grants | `rls_orders.test.sql` |
| INV-3 | no overselling: conditional reservation + `qty_reserved ≤ qty_listed` CHECK. Reservations change only via functions. Concurrent orders run side by side and lock pieces in variant-id order (PR-9) | function + CHECK + guard trigger | `stock.test.sql` (concurrency checked by hand, `status.md` 2026-10-06) |
| INV-4 | every stock change writes one `stock_movements` row. The ledger sums to current stock | trigger | `stock.test.sql` |
| INV-5 | retired with cycles (D-187) | | |
| INV-6 | a promised delivery window changes only via `change_delivery_window`, which adds a customer-visible event | guard trigger + function | `orders_window.test.sql` |
| INV-7 | admin = role `admin` **and** allowlisted email, in the DB (`is_admin()`) and in the website (`apps/web/features/admin/guard.ts`) | function + server guard | `rls_admin.test.sql` |
| INV-8 | draft region text and placeholder products never appear in `store_*` output (unless `dev_preview`) | view filters; a trigger re-drafts edited text | `rls_visibility.test.sql`, `region_content.test.sql`, `checkout.test.sql` (not buyable either) |
| INV-9 | money columns are integers (`*_cents` USD, `*_paise` INR) | column types | `schema.test.sql` |
| INV-10 | retired with vendor accounts (D-187) | | |

## Seed (`supabase/seed/`, applied by `supabase db reset`, local only)
- `regions.sql`: all 36 regions. Names and slugs are factual. Greetings are Claude drafts (`content_status = 'draft'`, D-019).
  Six regions have no greeting yet (Andaman & Nicobar, Arunachal Pradesh, Goa, Jammu & Kashmir, Lakshadweep, Nagaland)
  and Ladakh/Manipur have only a Latin form. **The founder fills and approves them.** The six launch regions (D-059) have
  drafted taglines and stories (still `draft`); images and accent colours are empty on purpose.
- `categories.sql`: 16 clothing + 9 food (`food`, D-110) + 3 home categories, **proposed** for founder review.
- `demo.sql`: **dev only.** `is_placeholder = true`, 4 clothing products in Kerala/Rajasthan/Punjab, placeholder domestic delivery
  days, `dev_preview = true`. Never run against production.
- `catalogue.sql`: **dev only, generated** from `catalogue/data/` by `scripts/build-catalogue.mjs` (D-059,
  `catalogue/README.md`). The launch regions' items as listings: clothing live with colour × size variants, pantry as
  drafts (D-032); prices and pieces are placeholders (`is_placeholder = true`). Product
  ids are `md5('iwc-catalogue:' || slug)`, so `pnpm catalogue:apply` can reload it into a running local DB without a reset.
- `search.sql`: builds search's vocabulary from the seeded listings (`refresh_search_words()`, D-160; migrations run
  before the seed). After `pnpm catalogue:apply`, run it again (or wait for the 6-hourly job).
