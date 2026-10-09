# Data model

> **Status:** implemented in `supabase/migrations/` (R3 baseline, D-020; R4 store page functions; R5 checkout + cycle steps;
> migration 4: shipping options + refunds, D-041/D-042).
> Built and tested on local Supabase first (D-031). The web app uses it since R5, the mobile app since R6.
> See `plan/current.md`. This doc lists tables, purpose, visibility and invariants. Column types and constraints live in the
> migration, so read it for details and don't copy them here.

## Visibility levels (D-003, D-017)
| Level | Who can read | How |
|---|---|---|
| **store** | anyone (anon + customers) | only through `store_*` views/functions exposing whitelisted columns |
| **owner** | the signed-in customer, own rows only | RLS `auth.uid() = user_id` (profiles, addresses, wishlists), or `store_*` views filtered by `auth.uid()` (orders) |
| **admin** | founder + COO | RLS `is_admin()`: `profiles.role = 'admin'` **and** email in `admin_emails` (D-006) |
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
| Places | `regions` | the 36 regions (D-002): slug, name, sort, `is_live`, greeting (native + ISO 15924 script + Latin + meaning), languages, tagline, story, hero image, accent colour, `content_status` (D-019) | store (text only if approved) / admin |
| Catalog | `categories` | browse groups per product type. A child always has its parent's type | store / admin |
| | `products` | region, category, `product_type`, name, slug, summary, description, story, craft, `attributes` (customer-safe JSON), `price_cents`, `status`, search vector; `vendor_id`*, `shop_price_paise`*, `origin_town`*, `has_origin_label`*, `is_placeholder`*. **Spices cannot be `live`** (CHECK, D-032) | store (live only) / admin |
| | `product_variants` | `options` JSON, SKU*, label, price override, `weight_g`*, `qty_listed`*, `qty_reserved`*, `qty_confirmed_at`* | store (`available` only) / admin |
| | `variant_availability` | public mirror `variant_id → available`, trigger-maintained, in the Realtime publication (live "only 2 left", D-010) | store (visible products) |
| | `product_media` | Storage paths (bucket `product-media`), alt text, one primary per product | store / admin |
| Supply | `vendors` | shop + owner, phone/WhatsApp, address, town, region, payment method + reference (D-029), licences, status, notes, photo | admin |
| | `cycles` | code, status, `cutoff_at`, est. export/arrival, actual dates, AWB, forwarder, freight, duty, FX | admin |
| | `pickups` | one per ordered piece: vendor, cycle, variant, qty, shop price, status, who/when, photo, payout | admin |
| | `vendor_payouts` | INR paid to a vendor. The amount is computed from the pickups it covers | admin |
| | `stock_movements` | append-only ledger, written by trigger only (INV-4) | admin (read) |
| | `pricing_settings` | one row: FX, freight/kg, duty %, margin %, domestic delivery days, stale-listing days, standard shipping + free threshold, express shipping + express days. Price-suggestion values and days start NULL (Q-15, Q-18); shipping prices set by migration 4 (D-041) | admin |
| Orders | `orders` | number `IWC-YYMMDD-<10 hex>`, email, internal `status`, `cycle_id`*, `fulfilment_mode` (`order_first`, D-024), `shipping_method` (D-041), `est_delivery_from/_to` (D-008), totals in cents (USD only, D-036), `refunded_cents` (D-042), Stripe ids, address snapshot, tracking, carrier, `notes`* | owner via `store_orders` / admin |
| | `order_items` | snapshot (product, variant label, region name), qty, unit price, status (`active`/`unavailable`/`refunded`) | owner via `store_order_items` / admin |
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
(exporter, importer, broker, FDA, contact: placeholders until saved; admin-only). `pricing_settings.spices_cleared` gates
live spices (trigger `_spices_cleared_check`, replacing the old constraint). Migration 25 (D-073, D-070): `tax_rates`
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
breaking it and watching the test fail ("mutation check", `current.md`).

| ID | Invariant | Enforced by | Test (`supabase/tests/`) |
|---|---|---|---|
| INV-1 | anon/customers can't read admin-only tables or columns | grants + RLS + `store_*` | `rls_visibility.test.sql`, `schema.test.sql` |
| INV-2 | customers can never create/update/delete orders, items, events. Only `create_order` (service) creates orders | RLS + grants | `rls_orders.test.sql` |
| INV-3 | no overselling: conditional reservation + `qty_reserved ≤ qty_listed` CHECK. Reservations change only via functions. Concurrent orders run side by side and lock pieces in variant-id order (PR-9) | function + CHECK + guard trigger | `stock.test.sql` (concurrency checked by hand, `plan/current.md` 2026-10-06) |
| INV-4 | every stock change writes one `stock_movements` row. The ledger sums to current stock | trigger | `stock.test.sql` |
| INV-5 | at most one `open` cycle | partial unique index | `cycles.test.sql` (+ `cycle_advance.test.sql` for the later steps) |
| INV-6 | a promised delivery window changes only via `change_delivery_window`, which adds a customer-visible event | guard trigger + function | `orders_window.test.sql` |
| INV-7 | admin = role `admin` **and** allowlisted email, in the DB (`is_admin()`) and in the website (`apps/web/features/admin/guard.ts`) | function + server guard | `rls_admin.test.sql` |
| INV-8 | draft region text and placeholder products never appear in `store_*` output (unless `dev_preview`) | view filters; a trigger re-drafts edited text | `rls_visibility.test.sql`, `region_content.test.sql`, `checkout.test.sql` (not buyable either) |
| INV-9 | money columns are integers (`*_cents` USD, `*_paise` INR) | column types | `schema.test.sql` |

## Seed (`supabase/seed/`, applied by `supabase db reset`, local only)
- `regions.sql`: all 36 regions. Names and slugs are factual. Greetings are Claude drafts (`content_status = 'draft'`, D-019).
  Six regions have no greeting yet (Andaman & Nicobar, Arunachal Pradesh, Goa, Jammu & Kashmir, Lakshadweep, Nagaland)
  and Ladakh/Manipur have only a Latin form. **The founder fills and approves them.** The six launch regions (D-059) have
  drafted taglines and stories (still `draft`); images and accent colours are empty on purpose.
- `categories.sql`: 16 clothing + 9 pantry (`spice`) categories, **proposed** for founder review.
- `demo.sql`: **dev only.** `is_placeholder = true`, 4 clothing products in Kerala/Rajasthan/Punjab, one open cycle,
  placeholder domestic delivery days (3–7) and express days (1–2), `dev_preview = true`. (The $0 standard / $8 express
  prices are real settings from migration 4, D-041.) Never run against production.
- `catalogue.sql`: **dev only, generated** from `catalogue/data/` by `scripts/build-catalogue.mjs` (D-059,
  `catalogue/README.md`). The launch regions' items as listings: clothing live with colour × size variants, pantry as
  drafts (D-032); prices, pieces and the per-region placeholder shop are placeholders (`is_placeholder = true`). Product
  ids are `md5('iwc-catalogue:' || slug)`, so `pnpm catalogue:apply` can reload it into a running local DB without a reset.
