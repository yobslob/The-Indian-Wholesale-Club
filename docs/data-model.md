# Data model (target)

> **Status:** this is the *target* model, implemented as one new baseline migration in roadmap step R3 (D-020), built on local Supabase first (D-031).
> Until R3 lands, the actual schema is the old one in `supabase/migrations/`. Check `plan/current.md`.
> This doc lists tables, purpose, visibility and invariants. Column types and constraints live in the migration, not here.

## Visibility levels (D-003, D-017)
| Level | Who can read | How |
|---|---|---|
| **store** | anyone (anon + customers) | only through `store_*` views/functions exposing whitelisted columns |
| **owner** | the signed-in customer, own rows only | RLS `auth.uid() = user_id`, read via `store_*` where the table also holds ops columns |
| **admin** | founder + COO | RLS `is_admin()` (role `admin` + email allowlist, D-006) |
| **service** | server code only (webhooks, jobs) | service-role key, never shipped to clients |

Customer-facing code (storefront, customer screens in the app) may query **only** `store_*` objects. Base tables are never queried directly from customer code.

## Tables
`*` = admin-only column (never in a `store_*` view).

**Places**
| Table | Purpose | Visibility |
|---|---|---|
| `regions` | the 36 regions (D-002): slug, name, sort, `is_live`, greeting (native script + script code + Latin + meaning), languages, tagline, story, hero image, accent colour, `content_status` (D-019) | store (approved text only) / admin |

**People**
| Table | Purpose | Visibility |
|---|---|---|
| `profiles` | one per auth user: name, phone, `role` (`customer`/`admin`), `desk`* (`us`/`india`, D-007) | owner / admin |
| `addresses` | US shipping addresses | owner |

**Catalog**
| Table | Purpose | Visibility |
|---|---|---|
| `categories` | browse groups per product type, optional parent | store / admin |
| `products` | region, category, `product_type`, name, slug, summary, description, story, craft/style, `attributes` (JSON, zod-validated per type: fibre + care / ingredients + allergens + shelf life), `price_cents`, `status` (draft/live/paused/archived), search vector; `vendor_id`*, `shop_price_paise`*, `origin_town`*, `is_placeholder`* | store (live only) / admin |
| `product_variants` | `options` JSON (`{size, colour}` or `{weight_g}`), SKU, price override, `weight_g`, `qty_listed`*, `qty_reserved`, `qty_confirmed_at`* → store exposes `available` | store / admin |
| `product_media` | images in Supabase Storage bucket `product-media` (uploaded from a phone, never pasted URLs) | store / admin |

**Supply (all admin-only, D-003)**
| Table | Purpose |
|---|---|
| `vendors` | shop + owner name, phone/WhatsApp, address, town, region, payment method + reference, licences (GSTIN, FSSAI, FDA reg.), status, notes |
| `cycles` | code (`C-2026-10`), status, `cutoff_at`, estimated/actual export and arrival dates, AWB, forwarder, freight, duty, FX rate |
| `pickups` | one per ordered piece: order item, vendor, cycle, status (`pending`/`picked`/`unavailable`), shop price, who/when, photo, payout |
| `vendor_payouts` | INR paid to a vendor: amount, method, reference, who/when, receipt photo, pickups covered |
| `stock_movements` | append-only ledger: `listed`, `adjusted`, `reserved`, `released`, `picked`, `unavailable` with actor + reference |
| `pricing_settings` | single row: FX, freight per kg, duty %, target margin, domestic delivery days (used for suggested prices and delivery windows) |

**Orders**
| Table | Purpose | Visibility |
|---|---|---|
| `orders` | number, customer or guest email, internal `status`, `cycle_id`*, `fulfilment_mode` (only `order_first` for now, D-024), `est_delivery_from/_to` (D-008), money totals (cents, USD), Stripe ids, shipping address snapshot, `tracking_number`, carrier, `notes`* | owner via `store_orders` / admin |
| `order_items` | variant + snapshot (product name, variant label, region name), qty, unit price, status (`active`/`unavailable`/`refunded`) | owner via `store_*` / admin |
| `order_events` | timeline: `customer_message` (shown) or internal note* (admin only) | owner (customer rows only) / admin |
| `promo_codes` | codes, limits, validity. Validated server-side only | admin |
| `wishlists` | saved products | owner |

**Operations (service only, kept from the old schema)**
`webhook_events` (Stripe idempotency) · `pending_orders` + `failed_reconciliations` (orphan-payment recovery) ·
`email_outbox` (durable email) · `admin_error_events` · `newsletter_subscribers`.

**Dropped from the old schema:** `cart_items` (never used, the cart stays on-device), `tracking_events` (→ `order_events`),
`reviews` (re-add with the reviews feature), the `size_enum` type (→ `options` JSON).

**Later (founder approval needed):** `home_requests`, `region_waitlist`, `bundles` (see `product.md` §Later ideas).

## Invariants
Each invariant must be enforced by the DB and covered by a test that **fails if the rule is broken** (not a grep of SQL
text). "Test" = planned location. `current.md` records whether each one exists yet.

| ID | Invariant | Enforced by | Test |
|---|---|---|---|
| INV-1 | anon/customer can't read any admin-only table or column (vendors, pickups, payouts, cycles, stock ledger, pricing, `*` columns) | RLS + `store_*` views | `supabase/tests/rls_visibility.test.sql` |
| INV-2 | customers can never UPDATE/DELETE orders, items or events. Orders are created only by the server after payment verification (fixes the hole in old migration `20260926000007`) | RLS | `rls_orders.test.sql` |
| INV-3 | no overselling: a reservation is one conditional statement, and `qty_listed − qty_reserved ≥ 0` is a CHECK | SQL function + CHECK | `stock.test.sql` |
| INV-4 | every stock change writes one `stock_movements` row. Totals are trigger-maintained | trigger | `stock.test.sql` |
| INV-5 | at most one cycle is `open` | partial unique index | `cycles.test.sql` |
| INV-6 | an order's delivery window is fixed at payment. Any change adds an `order_event` + customer notice (D-008) | server + event | `orders_window.test.sql` |
| INV-7 | admin = `role = 'admin'` **and** email in `ADMIN_EMAILS` (D-006) | `is_admin()` + server guard | `rls_admin.test.sql` |
| INV-8 | draft region text and placeholder products never appear in `store_*` output | view filters | `rls_visibility.test.sql` |
| INV-9 | money columns are integers (`*_cents` USD, `*_paise` INR) | column types | `schema.test.sql` |

## Seed (R3)
- `supabase/seed/regions.sql`: all 36 regions. Names and slugs are factual. Greetings, stories and taglines are Claude-drafted
  → `content_status = 'draft'` (D-019).
- `supabase/seed/categories.sql`: the initial tree per product type (proposed, founder reviews).
- `supabase/seed/demo.sql`: **dev only**, `is_placeholder = true`, a few products in 3 regions. Never run against production.
