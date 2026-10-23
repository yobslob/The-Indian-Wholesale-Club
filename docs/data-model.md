# Data model

> **Status:** implemented in `supabase/migrations/` (R3 baseline, D-020; R4 store page functions; R5 checkout + cycle steps;
> migration 4: shipping options + refunds, D-041/D-042).
> Built and tested on local Supabase first (D-031). The web app uses it since R5, the mobile app since R6.
> See `status.md`. This doc lists tables, purpose, visibility and invariants. Column types and constraints live in the
> migration, so read it for details and don't copy them here.

## Visibility levels (D-003, D-017)
| Level | Who can read | How |
|---|---|---|
| **store** | anyone (anon + customers) | only through `store_*` views/functions exposing whitelisted columns |
| **owner** | the signed-in customer, own rows only | RLS `auth.uid() = user_id` (profiles, addresses, wishlists), or `store_*` views filtered by `auth.uid()` (orders) |
| **admin** | founder + COO | RLS `is_admin()`: `profiles.role = 'admin'` **and** email in `admin_emails` (D-006) |
| **vendor** | a vendor's owner, own vendor only (D-102) | `vendor_*` functions filtered by `my_vendor_id()` (role `vendor` + an active `vendor_accounts` row); no base table (INV-10) |
| **worker** | the photo worker's account on the founder's laptop (D-103) | `worker_*` functions and the photo buckets (role `worker`) |
| **service** | server code only (webhooks, jobs, order creation) | service-role key, never shipped to clients |

Customer-facing code (storefront, customer screens in the app) reads catalog and order data **only** through `store_*`
objects. The only base tables it touches are the customer's own rows under owner RLS (`profiles`, `addresses`,
`wishlists`) and the public `variant_availability` mirror (live stock, visible products only). Tables with vendor, cost or
operations data are never queried from customer code.

## Tables
`*` = admin-only column (never in a `store_*` view).

| Group | Table | Purpose | Visibility |
|---|---|---|---|
| People | `profiles` | one per auth user (created by trigger): name, phone, `role`, `desk`* (D-007). Users may edit only `full_name`, `phone` | owner / admin |
| | `admin_emails` | the DB copy of the admin allowlist, the second gate of `is_admin()` (INV-7). Mirrors the `ADMIN_EMAILS` env var | service |
| | `addresses` | US shipping addresses (one default per user) | owner |
| | `vendor_accounts` | a vendor's sign-in: the user, its vendor, the screens' language, active (D-102) | own row / admin |
| | `vendor_sign_in_codes` | one-time QR / link codes, stored only as a hash, used once, expiring | functions only |
| | `vendor_applications` | "Join as a vendor?" requests (country IN or US, Q-35), status | admin |
| Places | `regions` | the 36 regions (D-002): slug, name, sort, `is_live`, greeting (native + ISO 15924 script + Latin + meaning), languages, tagline, story, hero image, accent colour, `content_status` (D-019) | store (text only if approved) / admin |
| Catalog | `categories` | browse groups per product type. A child always has its parent's type | store / admin |
| | `products` | region, category, `product_type`, name, slug, summary, description, story, craft, `attributes` (customer-safe JSON), `price_cents`, `status`, search vector; `vendor_id`*, `shop_price_paise`*, `origin_town`*, `has_origin_label`*, `is_placeholder`*; `wears` (women, men, kids, unisex: who it is for, D-140; filled from the name or category on save, required for clothing to go live); `shop_title`* (an imported piece's own title on the shop, D-140 L1). **Spices are `live` only while "Spices are cleared" is on** (`pricing_settings.spices_cleared`, D-074; on since D-107) | store (live only) / admin |
| | `product_variants` | `options` JSON (colour, flavour, style = "Type", pack, size: D-118), SKU*, label, price override, `weight_g`* with `weight_source`* and `weight_note`* (D-129), `weight_estimate_g`*, `weight_estimate_note`*, `weight_estimated_at`* (D-131), `weight_checked_at`* (D-146), `net_qty` (food, D-133), `qty_listed`*, `qty_reserved`*, `qty_confirmed_at`*, `shop_price_paise`*, `source_id`* | store (`available`, food's `net_qty`) / admin |
| | `product_sources` | the shop items a variant can be ordered as, checked weekly (D-118) | admin / worker via functions |
| | `variant_availability` | public mirror `variant_id → available`, trigger-maintained, in the Realtime publication (live "only 2 left", D-010) | store (visible products) |
| | `product_media` | Storage paths (bucket `product-media`), alt text, one primary per product, `is_ai` (an AI-generated model photo, D-100: the product's Details say so) | store / admin |
| Supply | `vendors` | shop + owner, phone/WhatsApp, address, town, region, payment method + reference (D-029), licences, status, notes, photo; `online_site` = an online shop's host for imported listings (one vendor per shop and state, D-110) | admin |
| | `cycles` | code, status, `cutoff_at`, est. export/arrival, actual dates, AWB, forwarder, freight, duty, FX | admin |
| | `pickups` | one per ordered piece: vendor, cycle, variant, qty, shop price (the variant's own when it has one), status, who/when, photo, payout; `source_id` (the shop item in use), `ordered_at`, `ordered_by`, `paid_paise`, `shop_order_ref`, `shop_bill_path` (ordered from the shop, D-140) | admin |
| | `shop_bills`, `shop_bill_lines`, `shop_bill_photos` | invoice C, one per order (D-140): the shop bill's rows (a piece at its price paid, delivery, extras such as a coupon as a minus), its photos in `vendor-docs/shop-bills/`, draft or final (a final bill's rows and photos are locked by trigger) | admin |
| | `vendor_payouts` | INR paid to a vendor. The amount is computed from the pickups it covers | admin |
| | `vendor_submissions` | a piece a vendor sent: category, who wears it (women / men / kids / unisex: picks the house model; kids are never shown on a model), details in their words, sizes, shop price in ₹, status (adding → waiting → photos_ready → approved, or needs_retake / declined), the product it became | vendor via `vendor_*` / admin |
| | `vendor_submission_photos` | front, back, close-up in bucket `vendor-uploads` (`<vendor>/<submission>/<file>`) with the phone's checks | vendor via functions / admin |
| | `house_models` | the founder's models (D-104): wears women / men, the front and back pose in `product-media/house-models/<slug>/` | admin |
| | `photo_jobs` | the GPU worker's queue: one per view of a clothing piece, candidates in bucket `photo-candidates` | worker via functions / admin |
| | `sourcing_settings`, `sourcing_shops`, `sourcing_targets`, `sourcing_runs` | auto-sourcing's rules, shops, targets and run log (D-118) | admin / worker via functions |
| | `stock_movements` | append-only ledger, written by trigger only (INV-4) | admin (read) |
| | `pricing_settings` | one row: FX, freight/kg, duty %, margin %, domestic delivery days, stale-listing days, standard shipping + free threshold, express shipping + express days. Price-suggestion values and days start NULL (Q-15, Q-18); shipping prices set by migration 4 (D-041) | admin |
| Orders | `orders` | number `IWC-YYMMDD-<10 hex>`, email, internal `status`, `cycle_id`*, `fulfilment_mode` (`order_first`, D-024), `shipping_method` (D-041), `est_delivery_from/_to` (D-008), totals in cents (USD only, D-036), `refunded_cents` (D-042), Stripe ids, address snapshot, tracking, carrier, `notes`* | owner via `store_orders` / admin |
| | `order_items` | snapshot (product, variant label, region name), qty, unit price, status (`active`/`unavailable`/`refunded`); the cost snapshot taken when it is placed (D-140): `shop_price_paise`*, `weight_g`*, `weight_source`*, `inr_per_usd`*, `pricing_rule`* | owner via `store_order_items` / admin |
| | `order_events` | timeline: `kind` + `visible_to_customer`. The app turns `kind` into copy (no customer text stored in SQL). `internal_note`* | owner (visible rows) / admin |
| | `promo_codes` | codes, limits, validity. Redeemed via `increment_promo_uses()` | admin |
| | `wishlists` | saved products | owner |
| Settings | `app_settings` | `dev_preview` (true only via `seed/demo.sql`: store shows placeholders + draft text) | admin |
| Ops | `webhook_events`, `pending_orders`, `failed_reconciliations`, `email_outbox`, `admin_error_events`, `newsletter_subscribers` | kept from the old schema | service |

**Dropped from the old schema:** `cart_items`, `tracking_events` (→ `order_events`), `reviews` (re-added with the reviews
feature), `product_images` (→ `product_media`), the `size_enum` type (→ `options` JSON).
**Later (founder approval needed):** `home_requests`, `region_waitlist`, `bundles` (`product.md` §Later ideas).

## Store read path (`store_*`, D-017)
Views: `store_regions`, `store_categories`, `store_products`, `store_variants`, `store_media`, `store_orders`,
`store_order_items` (with each item's product photo, `image_path`, since D-088; `guest_order_lookup` returns the same keys), `store_order_events`. Functions: `store_next_delivery()` ("order by" + next window, D-035), and
one-round-trip page reads (PR-2, migration 2) that read **only** the views: `store_home()`, `store_region_page(slug)`,
`store_product_page(region, slug)`, `store_my_order(number)` (signed-in). Since C1 (migration 5, the approved design):
`store_home()` adds `just_listed` (the four newest live products), region-page cards come newest first with
`published_at`, and `store_product_page()` adds `similar` (up to five other live products in the same category, own
region first). All product cards come from the internal helper `_store_product_card(product_id)` (not callable by
anon or customers), which adds `available` and `quick_add` (the variant, only when a product has exactly one and it is
in stock, so a card's "Add" needs no choice). Migration 6 (D-056): `products.is_curated` (an admin's pick) and
`pricing_settings.leaving_soon_max` (default 2); `store_region_page()` adds `curated` (up to four picks) and `leaving_soon`
(up to four live pieces with 1 to `leaving_soon_max` left, read by the internal `_leaving_soon_max()`), and
`store_product_page()` adds `curated` (the region's other picks). Migration 7 (reviews, D-051, D-056): `reviews`
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
leave it alone). Migration 12 (C3, flows.md §2): `admin_create_listing(jsonb)`
creates a draft product (region from its shop) and its variants in one transaction, quantities stamped as confirmed;
`admin_stale_variants()` lists live variants not re-confirmed within `pricing_settings.stale_listing_days` (nothing
while that is unset, D-047). Both refuse non-admins and run as the caller. Migration 13 (C4, D-045, D-063, D-065):
`pricing_settings.cycle_days` (days between cutoffs, unset until the founder sets it); `store_next_delivery()` and
`checkout_context()` show the cycle an order would really join (the open one, or the one about to open in the minute
between a cutoff and the roll), through the internal `_store_cycle()` and `_next_cycle_dates(cycle)`. Migration 14 (C4, D-064): `order_moves` (each
move of an order to another cycle, its shipped confirmation and the faster-delivery offer; admin read-only, written
by the functions below), `pricing_settings.fast_offer_cents`, and `store_my_order()` / `guest_order_lookup()` add
`offer` (price and window only, from the internal `_order_offer(order)`). Internal helpers: `_window_from(order, cycle)`
(the window an order would get from a cycle) and `_set_window(...)` (the INV-6 window change with its visible event).
A trigger on an order becoming `shipped` lapses an open offer and adds the "coming
sooner" event. Migration 15: `pickups.arrived_at` / `arrived_by` (picked pieces only). Migration 16: shipping and delivering go
through `ship_order()` / `deliver_order()`. Migration 17 (C5): a trigger queues an `order_update` email for every
customer-visible order event (`_queue_order_email`); `store_my_order()` / `guest_order_lookup()` add `actions` (cancel and
delay choices with their refunds, from `_order_actions`, `_delay_open`, `_cancel_refund_cents`); `_kick_email_outbox()` is
the every-minute timer (pg_net, Vault secrets). Migration 18 (D-067): `store_type_rows(type)`, one row per category
with its total and its first 12 cards (the app's Explore). Migration 19 (C6, D-047): `pricing_estimates` (which pricing
settings hold Claude's researched estimates, with source, link and date; admin-only); a trigger drops a setting's row
when its value changes (`_pricing_estimate_replaced`); `_load_pricing_estimates()` fills only empty settings (dev seed). Migration 20 (C7): `admin_sales(since)` and
`admin_demand(since)` (admin only; real numbers computed in SQL); `search_queries` (the words searched and the number of
matches, no user or address; admin read) written by `store_search(q, offset, limit)`, which the website and app search
now call. Migration 21 (B-3): `rate_limit_hits` (unlogged; keyed-hash caller + rule, one-minute windows) and
`rate_limit_hit()` (service only). Migration 22 (B-8): `admin_attention()` (counts of recent server errors, payments to
check and stuck emails, for Today; the tables stay service-only). Migration 23 (D-068, speed audit): product cards
carry no `summary` or `craft` and read their variants once; `store_region_page()`'s `products` holds only the cards the
page draws (the newest 12 and each category's first 12) plus `category_counts` (every category with its total);
`store_browse(type, region, category, offset, limit)` returns one page of light cards (no stock) for See all with its
total and the per-state and per-category counts; `store_search(..., p_record)` records only when asked (the website's
"Show more" re-reads without recording) and serves pages of up to 500; `create_order` shares the open-cycle lock and
reserves pieces in variant-id order (PR-9); the `variant_availability` trigger fires only on stock columns and skips
writes that change nothing; the minute timer (`_kick_email_outbox`) also runs in the two minutes after a cycle closes
(the website then refreshes its cached "order by" time, `engineering.md` §Caching); indexes for
`order_items.variant_id`, `wishlists.product_id` and newest-live-first. Migration 24 (D-075, D-069, D-074): the pricing
engine. Every cost is a `pricing_settings` column (labelled in `pricing_estimates` while a placeholder);
`_auto_price_cents(shop paise, weight g)` is the one price formula (`docs/pilot-numbers.md`), `products.price_auto` says
whether a product follows it, and triggers reprice when a setting, a variant weight or a category's
`default_weight_g` changes; `admin_price_preview()` lets admins preview it; `admin_create_listing()` prices a listing
without a price. `_fx_refresh()` (pg_cron every 10 minutes, pg_net) fetches the ECB rate once a day through
`fx_fetches` and refuses implausible jumps. `categories.tax_class` (clothing, food, general; D-073). `business_details`
(exporter, importer, broker, FDA, contact: placeholders until saved; admin-only). `pricing_settings.spices_cleared` (now `food_cleared`, D-110) gates
live food (trigger `_food_cleared_check` since D-110). Migration 25 (D-073, D-070): `tax_rates`
(one row per state where IWC is registered, with the classes it taxes; New Jersey 6.625% on general goods; no row = no
tax; admin-only); `checkout_context(variant_ids, promo, state)` adds each line's tax class and courier cost (never its
weight), the state's rule and express as courier pricing with a window from today; express orders have no cycle, a
window from the order date and their pickups at once (`pickups.cycle_id` may be null); `ship_order` sends an express
order by courier once picked; a cancel refunds the tax (`_cancel_refund_cents`). Migration 26 (D-071, D-072): after the
sale. `products.is_us_stock` marks US clearance pieces (in `store_products`; `store_product_page()` adds `ships_from_us`,
today + the US delivery days); an order of only such pieces is `arrived` at once, outside the cycle, and the cutoff makes
no pickups for them. `_to_clearance(item, why)` turns a returned or cancelled piece into a draft clearance product at
`clearance_discount_pct` off what was paid. `_in_india(order)` decides the customer's cancel; `returns` (one per order
line: reason, status, the refund fixed when asked, % kept; admin-only) with `_return_quote(item, reason)` and
`_delivered_at(order)`; `_order_actions()` adds `returns`. New settings: the cancel fee, the after-export deduction, the
claim window, three change-of-mind tiers and the clearance discount. Migration 27: `store_policy()` (anon) returns the
terms the Shipping & returns page states (shipping, express and US delivery days, the cancel fee, the claim window and
return tiers, the tax states and classes), never a cost, margin or customer-care deduction. Migration 28:
`checkout_context()` adds `us_delivery` (a bag of only US pieces: today + the US delivery days) and offers express only
for bags with no US piece; trigger `_express_has_no_us_stock` on `order_items` refuses an express order with one
(`express_unavailable`). Migration 29 (D-078, the demo round): `product_media.credit` (a free-licence photo's
attribution, in `store_media`); `reviews.is_placeholder` (a demo review, written only by the service role, shown only in
demo mode, in `store_reviews` as `is_demo` so the store labels it). `guest_order_lookup(number, email)` returns the
same shape for guests and is **service-only** (the server route rate-limits it). A test keeps its fields identical to the views'.
Migration 31 (D-099, the second speed audit): `admin_order_counts()` (every order by status, express orders still to
send, shops owed for picked pieces) and `admin_cycle_totals(cycle)` (the cycle card's orders, pieces, shops and sales),
admin only, counted in SQL because the API sends at most 1,000 rows; indexes for orders by status and newest, pickups
by status, what each shop is owed, and a payout's pieces.
Migration 70 (D-136): `store_browse()` takes `p_min_cents`, `p_max_cents` (pieces with a shown price), `p_sizes`
('|'-separated option values; food's `pack` counts as a size) and `p_sort` ('price-asc', 'price-desc', else newest)
and adds `states_total`, `sizes` (value, pieces) and `prices` (min, max, quartiles), each counted with the other
filters applied (`regions` and `categories` keep their meaning, so the app reads as before); `store_home()` adds
`just_listed_types` (the twelve newest of each type); `admin_price_sheet()` takes the Products filters (type, region
or none, category, vendor, price). Tests: `browse_filters.test.sql`.
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
state's own pieces first in the newest order and mixes pieces published at the same moment by shop and category (never
returning the shop); `store_home()` mixes the same way in Just listed; `store_region_page()` puts the state's own pieces
first in Most wanted, Curated and Leaving soon too. Tests: `wears_and_rows.test.sql` (older test files that make generic
"Test" clothing switch the wears trigger off inside their own transaction).
Migration 73 (D-140, L1): `products.shop_title` (admin only, backfilled from the names of imported listings);
`tests.forbidden_keys()` adds it and the order line's cost snapshot keys.
Migration 74 (D-140, F8, F9): `_store_card_options(product)` (up to 20 of a piece's variants: id, label, options, price,
available, from `store_variants`); `_store_product_card()` and `store_browse()` cards add `options` (null when coming
soon).
Migration 75 (D-140, F5): `pricing_settings.shown_shipping_cents_per_kg` ("Shipping shown when free", $ a kg, the
founder's number) and `store_bag_charges()`'s `shown_shipping_cents` (the bag's packed kg × it, at least the small-order
Shipping; null while empty). Display only: never charged, stored or sent to Stripe.
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
Migration `20261022120000_seven_day_delivery` (D-148): `pricing_settings.quick_delivery_days_min/_max` (7 and 7; empty
= off) and `sourcing_shops.quick_delivery` (Blinkit, BigBasket, Zepto, Instamart). `_quick_listings()` (no SET clause,
so it is inlined: live, not US stock, every active option's source in use, else the listing's `source_site`, on a
quick-delivery shop) and `_quick_days(product)` (internal). Customers: `store_quick_bag(variant ids)` (`{days_min,
days_max}` when every piece is a 7-day piece, else null) and `store_quick_browse(category, offset, limit)` (the 7-day
page: days, totals, categories with counts, light cards). `_store_product_card` and `store_browse` add `quick_days`;
`store_product_page` adds `quick_delivery`; `store_policy` the two days; `checkout_context` adds `quick_delivery` and
gives such a bag no Express; `create_order` gives a standard 7-day bag that window, no cycle and its pickups at once.
No answer names a shop or a source. Tests: `seven_day.test.sql`.
Migration `20261023120000_seven_day_shipments` (D-154, step 1): `pricing_settings.quick_delivery_min_cents` (4999, the
7-day line), `shipping_cents_per_kg` (1862) and `quick_delivery_paused` (no 7-day pieces while true; `_quick_listings`
reads it); the pilot window set to 12 – 16. `order_shipments` (an order's one or two shipments: `seq` 1 | 2, `kind`
quick | standard | express, dates, `shipping_cents` its share, `status` open | shipped | delivered | cancelled, carrier,
tracking, `shipped_at`; admin read, written by `create_order`; every older order got one, carrying its tracking) and
`order_items.shipment_id`. `_bag_shipments(items, discount, state, line1)` (internal): the 7-day pieces after the
promo against the line, `quick_only` / `split` / `gap_cents`, `outside` (not the 48 states or DC, or a PO box / APO),
`billed_grams`, `shipping_cents` (one parcel) and `quick_shipping_cents` (its share by weight). `store_bag_charges(items,
discount, state, line1)` returns Shipping at the $ a kg (else the fixed small-order Shipping), `past_line_cents` 0,
`shown_shipping_cents` the same figure, `quick_free` and `shipments`; `create_order` stores the shipments it works
out the same way (Express never splits). Tests: `shipments.test.sql`, `bag_charges.test.sql`.
Migration `20261024090000_shipment_admin` (D-154, step 2): shipments run one at a time. `order_events.shipment_id`
(the event is about that shipment; its `order_update` email row carries `shipment`, its seq). `ship_shipment(shipment,
carrier, tracking)`: from the hub (a 7-day shipment; Express; any order without a cycle, the pilot) once its pieces
are picked, else once the order's export has `arrived`; `deliver_shipment(shipment)`. The order follows its shipments
(`_settle_order`, also after any piece's status changes): a shipment with nothing left to send is cancelled; the order
is `shipped` once nothing is open, `delivered` once nothing is on its way, with the latest tracking. `ship_order` and
`deliver_order` work on an order of one shipment (`order_has_two_shipments` otherwise), and so does
`change_delivery_window`; an order of one shipment copies its window to it. `change_shipment_window(shipment, from,
to, note)`: the delay notice for one shipment (the order's window spans its shipments); `_delay_shipment(order)` and
`_delay_refund_cents(order)` (internal) scope `_delay_open` / `cancel_after_delay` to that shipment.
`shipment_cancel_cents(shipment, reason)` and `admin_cancel_shipment(shipment, reason, amount, ref)`: one of two
shipments cancelled (a 7-day one until its pieces are ordered or at the hub, the other until it leaves India): its
pieces after their discount share, its Shipping share and their tax back (the cancel fee for the customer's own once at
the hub). `customer_cancel` refuses (`quick_bought`), and `_order_actions.can_cancel` is false, once a 7-day shipment's
pieces are bought; `_order_actions.delay_shipment`. `admin_to_order()` adds `buy_by` / `ship_by` (2 hours, 1 day) for a
7-day piece; `admin_quick_watch()` counts open 7-day shipments, `not_bought` (2 hours) and `not_shipped` (a day).
`_order_shipments_json(order)` (internal): `guest_order_lookup` and `store_my_order` add `shipments` (seq, kind,
status, dates, Shipping share, carrier, tracking, `item_ids`); `store_order_events` and their events add `shipment`.
Tests: `shipment_admin.test.sql`.
Migration `20261025090000_bag_shipments` (D-154, step 3): `store_bag_charges` adds `quick_ids` (the asked options that
are 7-day pieces) and `dates` (`quick_from` / `quick_to` from the 7-day days, `standard_from` / `standard_to` from
`store_next_delivery()`), and its `shipments` no longer carries `billed_grams`, `quick_shipping_cents` or the option ids
(step 1's answer had sent the bag's billed grams to the browser). Tests: `shipments.test.sql`.
Migration `20261026090000_seven_day_store` (D-154, step 4): `store_browse(..., p_quick)` (last argument) keeps only
7-day pieces and adds `quick_total` (the "Delivery: in 7 days" count, every other filter applied; `all_total` stays the
whole type); `store_search(..., p_quick)` the same for search; `store_quick_front()` (null while 7-day delivery is off
or paused) gives the 7-day front page: days, the line (`min_cents`), the categories with a photo each, and the rows
`most_ordered` (units in paid orders this week, never shown), `under_5` and `new_this_week` (light cards, 12 each);
`store_policy()` adds `quick_delivery_min_cents` and `quick_delivery_on`. Tests: `seven_day_store.test.sql`.
Migration 80 (D-141, the photo store): a photo in Cloudflare R2 is recorded with an `s/` path
(`products/<id>/s/<name>.jpg`, packages/shared media.ts). `worker_sourcing_media` accepts `products/<id>/s/<name>` as
well as `products/<id>/<name>`; album photos may be `regions/<slug>/album/s/<name>`.
Migration 69 (D-135): `products.coming_soon`, `coming_soon_note`, `liquid_checked_at`; trigger `products_coming_soon`
(any status but archived ends it); `store_products` and `store_media` include archived coming-soon listings and
`store_products` ends with `coming_soon`; `_store_product_card` and `store_browse` send it (no quick add for it).
Worker only: `worker_liquid_plan(after, limit, all)` (food and home listings not yet checked) and
`worker_set_liquids(items)` (marks each checked; archives a liquid as coming soon; returns how many). Tests:
`coming_soon.test.sql`.
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
Migration 54 (D-125): `store_bag_charges` works out Shipping per bag: the pieces' contribution (price less shop cost,
duty, card fee, 2% returns) against the parcel's courier (first kg, each further half kg, box and clearance); below the
line at least `small_order_shipping_cents`, past it `past_line_cents` (what a bag still needs, normally 0). The
small-food shelf never prices under the guard on its whole cost. `food_ship_share_pct` empty again; the D-123 food
weight columns are unused. Tests: `bag_charges.test.sql`, `pricing_engine.test.sql`.
Migration 53 (D-123): `pricing_settings.retailer_pct`, `food_off_step_cents`, `food_off_step_pct`, `food_off_max_pct`;
`store_bag_charges` also returns `retailer_pct`, `food_weight_cents` (the bag's food at the rate card × billed % × (1 −
the food's share) ÷ the effective rate, by its weights) and the three food steps; checkout and the bag apply them with
`bagChargesAt()` (packages/shared). Tests: `bag_charges.test.sql`.
Migration 52 (D-122): `pricing_settings.food_ship_share_pct` (the share of its courier a food piece carries, empty =
all); `_auto_price_cents` applies it; footwear's `default_weight_g` 600; `_store_pack(product, name, type)` and the cards
(`_store_product_card`, `store_browse`) carry `pack`; `store_browse` returns `all_total`. Tests: `food_cards.test.sql`,
`pricing_engine.test.sql`.
Migration 50 (D-121): `products.region_id`, `order_items.region_name`, `sourcing_targets.region_id` and an online
shop's `vendors.region_id` may be empty (an all-India listing; `vendors_region_or_online`: a shop in person still has
its state; one all-India vendor per online shop). `store_products` left-joins the state; `store_region_page` and
`store_browse` add the all-India pieces to every state after its own (counts too); `store_product_page` finds them under
`india`; `create_order` and `admin_demand` keep them without a state. `sourcing_targets` gains `sites`,
`min_price_paise`, `max_price_paise`, `listings` (and its name is unique per state or all states); the runner's plan
returns them. `pricing_settings.home_est_g_per_rupee`, `home_est_min_g` and `_fallback_weight_g(type, shop, category)`:
home & gifts without a weight is priced at shop ₹ × g per rupee (at least the minimum, at most the category's weight)
in `_product_auto_price`, `_reprice_products` and `worker_sourcing_add`. Tests: `all_india.test.sql`.
Migrations 48 – 49 (D-120): `pricing_settings` gains the small-food shelf, `small_food_max_shop_paise`,
`small_food_max_g`, `small_food_ship_share_pct`, `small_food_floor_cents`, `small_food_ceiling_cents` (ceiling ≥
floor); `_auto_price_cents` puts small food on whole-dollar steps from the floor to the ceiling (half its shipping
share, the guard on its goods, never above its own recipe). `admin_publish_drafts()` (admin only) publishes every
ready draft one by one and returns how many went live and what held the rest (`no_photo`, `no_option`, `no_stock`,
`refused`, `live_missing_details`). Tests: `pricing_engine.test.sql`, `publish_drafts.test.sql`.
Migration 47 (D-119): the pilot price in two recipes. `pricing_settings` gains, for clothing and home & gifts,
`shop_divisor`, `ship_paise_per_100g`, `margin_clothing_min_pct` / `margin_home_min_pct` and the taper's
`taper_<type>_from_cents` / `_to_cents` (the type margins are now a margin of the price, cost ÷ (1 − margin)); for food,
`food_fee_paise`, `food_parcel_kg`, `food_billed_pct` (with `india_handling_pct` and the markup `margin_food_pct`); the
courier rate card `courier_first_kg_paise`, `courier_next_kg_paise`, `parcel_fixed_paise`; the profit guard
`duty_<type>_pct`, `min_profit_<type>_cents`, `min_profit_pct`, `min_profit_food_pct`, `guard_card_fee_pct`; the bulk
saving `bulk_saving_pct`, `bulk_saving_cap_cents`. `_auto_price_cents(shop, weight, type)` applies the type's recipe,
then lifts a price to the guard, then the .29/.49/.79/.99 ending (`_tapered_margin` is its helper; D-126 adds the .69
ending, and `food_margin_max_pct` with `_band_price(cost, lo, hi)` prices food in its 17–20% band without the guard
or the shelf). Migration 56 (D-127): `beta_pricing` puts the fixed beta formula in front of all of it (migration 57: to the cent; migration 58: converted at a fixed ₹92; migration 59, D-128: the founder's exact rules; migration 60: `admin_price_sheet()` for Products → Download Excel; see
`docs/archive/pricing-full-formula.md` for the full one);
`ship_alloc_paise_per_kg` is no longer read. `store_bag_charges` also returns the two bulk numbers;
`orders.bulk_saving_cents` is the part of `discount_cents` that was the bulk saving (admin view). Tests:
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
sources, the items already listed), `worker_sourcing_add(target, listing)` (a draft listing of the shop's vendor for the
target's state, `_online_vendor`, with its variants, sources and backups; an item already listed returns that listing),
`worker_sourcing_media(product, media, publish)` (photos once, under `products/<id>/`; storage allows the upload only
where `worker_may_add_photos(product)` says), `worker_sourcing_target_done(target, note)`,
`worker_sourcing_checked(product, results)` (prices and stock follow the shop, a jump beyond the guard is held, new items
become variants, then `_sourcing_settle`: each variant takes its best usable source, its shop price and a top-up of
pieces, or stops selling) and `worker_sourcing_log(run)`. Admins decide a held price with
`admin_sourcing_review(source, accept)`. `admin_create_listing` takes a variant's `shop_price_paise`. Tests:
`supabase/tests/auto_sourcing.test.sql`.
Migration 43 (D-115): `pricing_settings.pilot_delivery_days_min/max` (the made-to-order pilot, 12 – 18); while both are
set, `store_next_delivery()` returns today + those days with a null `order_by`, and a standard `create_order` needs no
cycle (no `cycle_id`, window from today, pickups at once like express). Both empty = the cycle model.
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
Migrations 38 – 39 (D-110): the type `spice` renamed `food` (`food_cleared`, trigger `_food_cleared_check`); imported
listings: `products.source_url` (unique, https), `source_site`, `source_checked_at`, `source_in_stock` and
`vendors.online_site`, all admin-only (no `store_*` object reads them; `supabase/tests/sourced_listings.test.sql`).
Migrations 36 – 37 (D-106): the product type `home` (Home & gifts) with its three categories, taxed as general goods by
the category trigger, and the business detail `hs_home` for its shipping documents.
Migrations 32 – 35 (D-102, D-103, vendor accounts): roles `vendor` and `worker`; `my_vendor_id()`, `is_vendor()`,
`is_worker()`, the internal `_vendor_or_raise()` (refuses non-vendors); `admin_vendor_sign_in_code(user, days)` (a one-time code shown once; older unused ones stop working) and
the service-only `_link_vendor_account(user, vendor, language, by)` and `_redeem_vendor_code(code)`. A vendor reads
`vendor_me()`, `vendor_keep_ready()` (ordered pieces not yet collected: piece, size, count and the cycle's cutoff, never
who bought it), `vendor_money()` (owed and paid in ₹), `vendor_pieces(offset, limit)` and `vendor_submission(id)`, and
writes through `vendor_new_submission(type)`, `vendor_add_photo(...)`, `vendor_submit(id, details)` (checks photos,
category, sizes and price, then queues the photo jobs) and `vendor_delete_submission(id)`; storage allows uploads only
where `vendor_may_upload(path)` says. Admins review with `admin_approve_submission(id, listing, media)` (a draft
product through `admin_create_listing`), `admin_request_retake`, `admin_decline_submission`, `admin_rerun_photo_job`.
The worker uses `worker_claim_job()` (oldest queued, or one left running for 30 minutes; failed after 3 tries) and
`worker_finish_job(job, candidates, error)`.
`checkout_context(variant_ids, promo_code)` (migration 3, **service-only**) returns what the server needs to price a bag in
one round trip: the variants as customers can buy them (through `store_*`), the promo if usable now, the shipping settings
and the next window (D-038).
They run with the owner's rights and expose only whitelisted columns (`storefront.md`). `store_orders.customer_status`
collapses internal statuses into what customers see (`flows.md` §8). Two small helpers are callable by visitors:
`dev_preview()` (is the dev preview on) and `is_product_visible(product)` (the one "may a customer see this product"
rule, used by the `variant_availability` read policy so the live stock feed never reveals hidden products).

## Business functions (the only way to do these things)
| Function | Who | Does (flows.md) |
|---|---|---|
| `create_order(jsonb)` | service (server, after Stripe verification) | §3: rolls a cycle past its cutoff first, checks prices + subtotal, reserves stock atomically, attaches the open cycle (or, D-065, the cycle that closed after the customer was priced, while it is collecting, with its pickups), stores the window. Raises `cycle_closed` (priced for a cycle that is already packed), `no_open_cycle`, `delivery_window_unconfigured`, `variant_unavailable`, `price_mismatch`, `insufficient_stock`, `subtotal_mismatch`, `express_unavailable`, `order_has_no_items` |
| `cutoff_cycle(cycle)` | admin | §4.1: closes the cycle (the cutoff becomes the real closing time), creates one pickup per piece, opens the next cycle (D-045) |
| `roll_cycles()` | service, pg_cron every minute | §1: closes the open cycle once its cutoff has passed and opens the next with its dates moved forward by `cycle_days` (else the last gap, D-063). Internal helpers `_cutoff_cycle`, `_open_next_cycle` |
| `advance_cycle(cycle)` | admin | §1/§6: collecting → packed → exported → arrived → fulfilling → closed, moving its orders with it and writing internal events. Refuses `open` (use cutoff) and closing while an order is unfinished |
| `move_order(order, cycle, note)` | admin | §6b: the order and its pieces join another cycle; a later one changes the window visibly (INV-6). Raises `order_cannot_move`, `cycle_not_accepting`, `same_cycle` |
| `confirm_move_shipped(move)` | admin | §6b: the order left with that export; an earlier move makes the D-064 offer when its price is set. Raises `move_not_pending`, `move_superseded`, `cycle_not_exported` |
| `accept_fast_offer(move, payment_intent)` | service (after Stripe verification) | §6b: the window moves to the one offered. Raises `offer_not_open` (the server refunds) |
| `check_off_arrival(pickup, arrived)` | admin | §6.3: a picked piece arrived in the US (or the tick undone), once its cycle has arrived. Raises `pickup_not_picked`, `cycle_not_arrived` |
| `ship_order(order, carrier, tracking)` | admin | §6.4: an arrived order ships (visible "Shipped" event). Raises `order_not_arrived`, `invalid_tracking` |
| `deliver_order(order)` | admin | §6.4: a shipped order is delivered (visible event). Raises `order_not_shipped` |
| `keep_after_delay(order)` | service (customer through the server), admin | §7: the customer keeps the order after a window change. Raises `no_open_delay` |
| `cancel_after_delay(order, amount, ref)` | service, admin | §7: full refund after a window change (D-008), stock released for pieces not collected, collected ones to US clearance (D-072). Raises `no_open_delay`, `refund_amount_mismatch` |
| `customer_cancel(order, amount, ref)`, `_customer_cancel_cents(order)` | service (customer through the server), admin | §7b: the customer's cancel until the order leaves India (D-072): everything back minus `cancel_fee_pct` once pieces are collected; pieces not collected back to stock, collected ones to clearance. Raises `order_left_india`, `refund_amount_mismatch` |
| `admin_cancel_after_export_cents(order)`, `admin_cancel_after_export(order, amount, ref)` | admin | §7b: customer care cancels after it left India: all but `export_cancel_deduction_pct`, every piece to clearance. Raises `order_still_in_india_or_done`, `refund_amount_mismatch` |
| `request_return(order, item, reason)` | service (customer through the server), admin | §7c (D-071): a delivered piece, the refund fixed by `_return_quote` now. Raises `not_returnable`, `item_not_in_order` |
| `admin_return_received(return)`, `admin_return_refunded(return, amount, ref)`, `admin_return_rejected(return, note)` | admin | §7c: the piece is back (it becomes a clearance draft), refunded (Stripe first; the amount must be the fixed one), or rejected. Raise `return_not_open`, `return_not_received`, `refund_amount_mismatch` |
| `mark_pickup(pickup, status, photo, note)` | admin | §4.2–4: picked / unavailable (+ D-030 refund flag + customer event) |
| `record_payout(vendor, pickups[], method, …)` | admin | §5: computes the amount from pickups, one payout per pickup |
| `change_delivery_window(order, from, to, note)` | admin | §7: the only way to move a window (INV-6) |
| `increment_promo_uses(promo)` | service | guarded promo redemption |
| `checkout_context(variant_ids, promo)` | service | §3 step 1: pricing inputs for a bag, incl. the express option when set up (read-only) |
| `item_refund_cents(item)`, `cancel_refund_cents(order, reason)` | admin | D-042 refund amounts (the only place the rules live) |
| `refund_order_item(item, amount, ref)` | admin | §4.4: records the Stripe refund of an unavailable piece; re-checks the amount |
| `cancel_order(order, reason, amount, ref)` | admin | §7b: cancels before cutoff (admin), releases stock, records the refund; re-checks the amount |
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
| INV-5 | at most one `open` cycle | partial unique index | `cycles.test.sql` (+ `cycle_advance.test.sql` for the later steps) |
| INV-6 | a promised delivery window changes only via `change_delivery_window`, which adds a customer-visible event | guard trigger + function | `orders_window.test.sql` |
| INV-7 | admin = role `admin` **and** allowlisted email, in the DB (`is_admin()`) and in the website (`apps/web/features/admin/guard.ts`) | function + server guard | `rls_admin.test.sql` |
| INV-8 | draft region text and placeholder products never appear in `store_*` output (unless `dev_preview`) | view filters; a trigger re-drafts edited text | `rls_visibility.test.sql`, `region_content.test.sql`, `checkout.test.sql` (not buyable either) |
| INV-9 | money columns are integers (`*_cents` USD, `*_paise` INR) | column types | `schema.test.sql` |
| INV-10 | a vendor account reads only its own vendor, only through `vendor_*` functions, and never a buyer, an order number, a customer price, a cost or an admin note; sign-in codes work once (D-102, D-103) | `my_vendor_id()` filters + no base-table RLS + `vendor_may_upload` | `vendor_accounts.test.sql` |

## Seed (`supabase/seed/`, applied by `supabase db reset`, local only)
- `regions.sql`: all 36 regions. Names and slugs are factual. Greetings are Claude drafts (`content_status = 'draft'`, D-019).
  Six regions have no greeting yet (Andaman & Nicobar, Arunachal Pradesh, Goa, Jammu & Kashmir, Lakshadweep, Nagaland)
  and Ladakh/Manipur have only a Latin form. **The founder fills and approves them.** The six launch regions (D-059) have
  drafted taglines and stories (still `draft`); images and accent colours are empty on purpose.
- `categories.sql`: 16 clothing + 9 food (`food`, D-110) + 3 home categories, **proposed** for founder review.
- `demo.sql`: **dev only.** `is_placeholder = true`, 4 clothing products in Kerala/Rajasthan/Punjab, one open cycle,
  placeholder domestic delivery days (3–7) and express days (1–2), `dev_preview = true`. (The $0 standard / $8 express
  prices are real settings from migration 4, D-041.) Never run against production.
- `catalogue.sql`: **dev only, generated** from `catalogue/data/` by `scripts/build-catalogue.mjs` (D-059,
  `catalogue/README.md`). The launch regions' items as listings: clothing live with colour × size variants, pantry as
  drafts (D-032); prices, pieces and the per-region placeholder shop are placeholders (`is_placeholder = true`). Product
  ids are `md5('iwc-catalogue:' || slug)`, so `pnpm catalogue:apply` can reload it into a running local DB without a reset.
