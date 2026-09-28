# Data model

> **Status:** implemented in `supabase/migrations/` (R3 baseline, D-020; R4 store page functions; R5 checkout + cycle steps).
> Built and tested on local Supabase first (D-031). The web app uses it since R5; the mobile app switches in R6.
> See `plan/current.md`. This doc lists tables, purpose, visibility and invariants. Column types and constraints live in the
> migration, so read it for details and don't copy them here.

## Visibility levels (D-003, D-017)
| Level | Who can read | How |
|---|---|---|
| **store** | anyone (anon + customers) | only through `store_*` views/functions exposing whitelisted columns |
| **owner** | the signed-in customer, own rows only | RLS `auth.uid() = user_id` (profiles, addresses, wishlists), or `store_*` views filtered by `auth.uid()` (orders) |
| **admin** | founder + COO | RLS `is_admin()`: `profiles.role = 'admin'` **and** email in `admin_emails` (D-006) |
| **service** | server code only (webhooks, jobs, order creation) | service-role key, never shipped to clients |

Customer-facing code (storefront, customer screens in the app) may query **only** `store_*` objects. Base tables are
never queried directly from customer code.

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
| | `pricing_settings` | one row: FX, freight/kg, duty %, margin %, domestic delivery days, stale-listing days, shipping charge + free-shipping threshold (R5). **Starts all NULL** (values: Q-15, Q-16) | admin |
| Orders | `orders` | number `IWC-YYMMDD-<10 hex>`, email, internal `status`, `cycle_id`*, `fulfilment_mode` (`order_first`, D-024), `est_delivery_from/_to` (D-008), totals in cents (USD only, D-036), Stripe ids, address snapshot, tracking, carrier, `notes`* | owner via `store_orders` / admin |
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
`store_order_items`, `store_order_events`. Functions: `store_next_delivery()` ("order by" + next window, D-035), and
one-round-trip page reads (PR-2, migration 2) that read **only** the views: `store_home()`, `store_region_page(slug)`,
`store_product_page(region, slug)`, `store_my_order(number)` (signed-in). `guest_order_lookup(number, email)` returns the
same shape for guests and is **service-only** (the server route rate-limits it). A test keeps its fields identical to the views'.
`checkout_context(variant_ids, promo_code)` (migration 3, **service-only**) returns what the server needs to price a bag in
one round trip: the variants as customers can buy them (through `store_*`), the promo if usable now, the shipping settings
and the next window (D-038).
They run with the owner's rights and expose only whitelisted columns (`storefront.md`). `store_orders.customer_status`
collapses internal statuses into what customers see (`flows.md` §8).

## Business functions (the only way to do these things)
| Function | Who | Does (flows.md) |
|---|---|---|
| `create_order(jsonb)` | service (server, after Stripe verification) | §3: checks prices + subtotal, reserves stock atomically, attaches the open cycle, stores the window. Raises `no_open_cycle`, `delivery_window_unconfigured`, `variant_unavailable`, `price_mismatch`, `insufficient_stock`, `subtotal_mismatch` |
| `cutoff_cycle(cycle)` | admin | §4.1: closes the cycle, creates one pickup per piece |
| `advance_cycle(cycle)` | admin | §1/§6: collecting → packed → exported → arrived → fulfilling → closed, moving its orders with it and writing internal events. Refuses `open` (use cutoff) and closing while an order is unfinished |
| `mark_pickup(pickup, status, photo, note)` | admin | §4.2–4: picked / unavailable (+ D-030 refund flag + customer event) |
| `record_payout(vendor, pickups[], method, …)` | admin | §5: computes the amount from pickups, one payout per pickup |
| `change_delivery_window(order, from, to, note)` | admin | §7: the only way to move a window (INV-6) |
| `increment_promo_uses(promo)` | service | guarded promo redemption |
| `checkout_context(variant_ids, promo)` | service | §3 step 1: pricing inputs for a bag (read-only) |
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
| INV-3 | no overselling: conditional reservation + `qty_reserved ≤ qty_listed` CHECK. Reservations change only via functions | function + CHECK + guard trigger | `stock.test.sql` |
| INV-4 | every stock change writes one `stock_movements` row. The ledger sums to current stock | trigger | `stock.test.sql` |
| INV-5 | at most one `open` cycle | partial unique index | `cycles.test.sql` (+ `cycle_advance.test.sql` for the later steps) |
| INV-6 | a promised delivery window changes only via `change_delivery_window`, which adds a customer-visible event | guard trigger + function | `orders_window.test.sql` |
| INV-7 | admin = role `admin` **and** allowlisted email, in the DB (`is_admin()`) and in the app (`apps/web/lib/auth/admin.ts`) | function + server guard | `rls_admin.test.sql` |
| INV-8 | draft region text and placeholder products never appear in `store_*` output (unless `dev_preview`) | view filters | `rls_visibility.test.sql`, `checkout.test.sql` (not buyable either) |
| INV-9 | money columns are integers (`*_cents` USD, `*_paise` INR) | column types | `schema.test.sql` |

## Seed (`supabase/seed/`, applied by `supabase db reset`, local only)
- `regions.sql`: all 36 regions. Names and slugs are factual. Greetings are Claude drafts (`content_status = 'draft'`, D-019).
  Six regions have no greeting yet (Andaman & Nicobar, Arunachal Pradesh, Goa, Jammu & Kashmir, Lakshadweep, Nagaland)
  and Ladakh/Manipur have only a Latin form. **The founder fills and approves them.** Taglines, stories, images and accent colours are empty on purpose.
- `categories.sql`: 7 clothing + 3 spice categories, **proposed** for founder review.
- `demo.sql`: **dev only.** `is_placeholder = true`, 4 clothing products in Kerala/Rajasthan/Punjab, one open cycle,
  placeholder delivery days (3–7) and shipping charge (0), `dev_preview = true`. Never run against production.
