# AUDIT_NOTES.md — High-Level System Summary

> Source: documentation only (`docs/01`–`docs/10`, `docs/STATUS.md`). No source code was read.
> Purpose: establish a baseline understanding of architecture, data flow, and core assumptions before any code audit.

---

## 1. What the system is

ROOT is a cross-border (India → US) apparel e-commerce platform presented as a US-native brand. It ships as three deliverables from one Turborepo/pnpm monorepo:

- **Web storefront** — Next.js App Router (`apps/web`), Shadcn/Tailwind, deployed on Vercel (US-East).
- **Mobile app** — Expo / React Native with Expo Router + NativeWind (`apps/app`), distributed via EAS (TestFlight / Play Beta).
- **Admin dashboard** — route group `/admin` inside the web app (orders, logistics, inventory, analytics).

Backend is **Supabase (US-East)**: Postgres + RLS, Auth, Storage, Realtime, and Deno Edge Functions. Third parties: Stripe (payments, with Razorpay as an alternate), Resend (transactional email), and a custom Tracking Proxy (logistics origin masking).

---

## 2. System architecture

```
Clients ── Web (Next.js/Vercel) ── Mobile (Expo)
   │              │
   │        Vercel Edge (CDN, ISR cache, CSP/rate-limit middleware)
   │              │
   └──────► Supabase (US-East)
              ├─ Auth (JWT, cookie/session via @supabase/ssr)
              ├─ PostgreSQL (13 tables, RLS on everything)
              ├─ Storage (product-images public, user-avatars private)
              ├─ Edge Functions (Deno): payment webhook, tracking proxy, send-email
              └─ Realtime (CDC → client WebSockets)

External: Stripe/Payments · Resend (email) · Tracking Proxy API (origin masking)
```

Key structural choices:

- **Monorepo sharing**: `packages/shared` is the single source of truth for Zod schemas, generated DB types, constants, and currency/date utils, consumed by both web and mobile as `@repo/shared`.
- **Two-tier data access**: clients use the anon key constrained by RLS; server routes and edge functions may use `SUPABASE_SERVICE_ROLE_KEY` (admin client, never exposed to clients).
- **Money is integer cents** (`*_cents` columns, `INTEGER`), currency hard-coded to `USD`.
- **CI/CD**: GitHub Actions → lint/typecheck/test on PR; migrations via `supabase db push`; Vercel for web; EAS for mobile; Turborepo orchestrates builds.
- **Environment matrix**: dev (local Supabase on 127.0.0.1) → staging → prod, with separate Supabase projects and key sets per environment.

---

## 3. Data model (core entities)

13 tables, 4 enums, 10 indexes:

- **Identity**: `profiles` (mirrors `auth.users` via `handle_new_user` trigger), `addresses` (US-only format: 2-char state, 5/9-digit ZIP).
- **Catalog**: `categories` (self-referencing hierarchy), `products`, `product_variants` (size enum, color, SKU, `inventory_count`), `product_images`.
- **Commerce**: `cart_items` and `wishlists` (per-user, unique constraints), `orders` + `order_items` (denormalized line items with `variant_id` set null on delete), `promo_codes`.
- **Post-purchase**: `tracking_events` (raw carrier status + sanitized customer-facing status), `reviews` (approved-gated public read).

Notable integrity/automation mechanisms (DB triggers):

1. `updated_at` auto-touch on the main tables.
2. Profile auto-created on signup (`SECURITY DEFINER`).
3. **Inventory deduction on order confirmation** — decrements `product_variants.inventory_count` when status transitions to `confirmed`.
4. Order-number generation (`ORD-YYYYMMDD-XXXX` from md5 of random).

**RLS posture**: everything enabled; users see only their own rows (profiles, addresses, cart, wishlist, orders, order items, tracking); catalog and active promos are public-read; approved reviews public-read; admin writes rely on the service-role bypass or a `role = 'admin'` JWT claim. Storage: public-read/admin-write for product images, folder-scoped read/write for avatars.

---

## 4. Data flow

### 4.1 Browse / storefront
Client → Vercel edge (ISR caching for catalog/marketing pages) → Supabase (anon key + RLS) → product/category/variant data. Images served from Supabase Storage through Next.js `<Image />` (AVIF/WebP). Client-side UI state (cart, wishlist) lives in **Zustand with persistence**, mirrored against DB tables for logged-in users.

### 4.2 Checkout & payment
1. Cart (guest or authenticated) → multi-step checkout (Shipping → Delivery → Payment).
2. US address validation/standardization (SmartyStreets/USPS), tax via Stripe Tax/TaxJar by ZIP, flat-rate shipping tiers ($5.99 standard, $12.99 express, free over $75).
3. `POST /api/checkout/create-intent` → Stripe PaymentIntent (Elements or test-mode simulator) → client confirms.
4. Success → `POST /api/orders/create` writes the order (+ server-side stock re-check) → `POST /api/webhooks/stripe` verifies signature and updates payment state → confirmation email (Resend) → `/checkout/success`.
5. Guest checkout is first-class: orders are creatable without an account; `/order-lookup` retrieves them.

Order lifecycle state machine: `PENDING_PAYMENT → PROCESSING → SHIPPED → IN_TRANSIT → (CUSTOMS_HOLD) → OUT_FOR_DELIVERY → DELIVERED`, with `RETURN_*`/`REFUNDED` branches; the customer-facing enum in the DB schema uses a related set (`pending/confirmed/processing/shipped/in_transit/out_for_delivery/delivered/cancelled/refunded`).

### 4.3 Stealth logistics (origin masking)
- Raw carrier events land in `tracking_events` with `raw_status`/`location`.
- A sanitizer layer (Tracking Proxy API / `sanitizeTrackingEvents`) maps them to benign customer-facing statuses, scrubs any "India"/customs/export wording, and reformats timestamps to US time zones.
- Customers only ever see `/order-status/[id]` with the sanitized timeline; emails are sent from the US domain with a US return address; admin can manually override states via `/admin/logistics`.

### 4.4 Orders, fulfillment & support
Admin dashboard consumes the same DB: order list/detail with status transitions, inventory adjustments, product CRUD, analytics. Emails (order confirmation, shipping, delivery, refund) are triggered from order state changes via Resend/Edge Functions.

### 4.5 Mobile parity
Expo app mirrors web flows (catalog, PDP, cart, checkout with US address validation + payment simulator, order tracking) against the same Supabase backend, sharing `@repo/shared` schemas; Zustand stores; EAS profiles for dev/preview/prod.

---

## 5. Core assumptions

1. **US-only market**: shipping, addresses (2-char state / ZIP), tax, currency (USD), and payment methods are US-specific; country is effectively fixed to `US`.
2. **Stealth origin is a hard requirement**: every customer touchpoint (tracking, emails, packaging, support scripts, footer address) must hide the India origin; only legally required customs/tag data (US FTC "Made in India") may reveal it.
3. **Supabase is the system of record**; clients are trusted to read only what RLS permits, and writes that matter (pricing, stock, payment state) must be re-validated server-side.
4. **Pricing is authoritative on the server**: prices come from the DB, not from client-submitted totals; all amounts are integer cents.
5. **Inventory is deducted once**, on the `pending → confirmed` transition, implying a prior reservation/check step during order creation to avoid overselling.
6. **Payment success is webhook-driven** (`/api/webhooks/stripe` with signature verification), with the order-creation API as the complementary path — i.e., order state correctness depends on both.
7. **Guest checkout must work with zero mandatory signups**, so orders cannot assume a valid `user_id` (nullable, `ON DELETE SET NULL`).
8. **Return addresses and logistics are domestic-US** (US virtual address / 3PL); returns never ship back to India.
9. **The shared package is authoritative** for validation and types across web/mobile; drift between clients is prevented by Zod schemas in `packages/shared`.
10. **Security baseline**: strict CSP/security headers from Next.js config, service-role key server-only, strict CORS, edge rate limiting on checkout/login/tracking, and admin access via role claim or demo bypass.
11. **Docs describe intent + claimed status**: `STATUS.md` asserts all 7 phases complete with 0 lint/type errors and 18/18 tests passing — this was **not verified** in this pass (no code, no commands run).

---

## 6. Observations & risks to check in the code audit

- **Docs vs. schema drift**: `docs/04` shows illustrative snippets that don't match `docs/02` (e.g. `first_name`/`last_name` vs `full_name`; `orders.status = 'PAID'` vs `order_status_enum`; `stripe_session_id`/`tracking_number` vs `payment_intent_id`/`tracking_code`; `event.occurred_at` vs `event_timestamp`). Treat `docs/02` as the schema of record and verify against actual migrations.
- **Two order-creation paths** (webhook insert vs. `/api/orders/create`) risk duplicates — check idempotency/order-number uniqueness handling.
- **Inventory deduction trigger** fires on status transition to `confirmed` — check whether re-confirmations or admin status changes can double-deduct, and whether guest/admin paths can set `confirmed` without stock validation.
- **RLS gaps to verify**: `orders` allows `INSERT` by any authenticated user (and possibly guest flows); no explicit UPDATE policy is documented for orders — check how status/payment updates are performed (service role vs. client).
- **Client-side cart/checkout totals** (Zustand-persisted) must be re-derived server-side; verify tax/shipping/discount recomputation at order creation.
- **Stealth sanitizer completeness**: verify raw carrier strings can't leak via API responses, emails, admin-shared links, or mobile payloads.
- **Secrets**: confirm `SUPABASE_SERVICE_ROLE_KEY` and Stripe/Resend secrets never reach client bundles (`NEXT_PUBLIC_` prefix discipline).
- **Admin demo bypass** (noted in `STATUS.md` Phase 4) — verify it cannot be enabled in production.
- **"Large media attachments removed" note**: any image/PDF docs referenced earlier were dropped from context during compaction; if they contain architecture-relevant material, re-attach them as smaller files.

---

## 7. Sources read

| File | Coverage |
| --- | --- |
| `docs/01-architecture-and-stack.md` | Full — architecture diagram, directory layout, shared package, env matrix, deployment, perf/security |
| `docs/02-database-schema-and-rls.md` | Full — DDL, RLS, triggers, storage, seed data |
| `docs/04-backend-api-and-integrations.md` | Full — clients, auth, API routes, edge functions, tracking sanitizer, email, errors |
| `docs/05-stealth-logistics-and-checkout.md` | Full — checkout flow, origin masking playbook, timelines, returns, state machine |
| `docs/STATUS.md` | Full — phase completion claims and verification results |
| `docs/03, 06–10` | Structure/headings only (design system, web/mobile plans, roadmap, runbook, user guide) |
| Source code | **Not read** (per instructions) |
