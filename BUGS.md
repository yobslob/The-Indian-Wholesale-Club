# ROOT - Full Codebase Audit: Bugs, Errors & Architectural Mistakes

**Scope:** entire repository (`apps/web`, `apps/app`, `packages/shared`, `supabase/`, `scripts/`, `.github/`, `docs/`).
**Rule followed:** findings only - no fixes implemented. Each item lists location (`file:line`) and impact.
**Reference:** architecture summary in `AUDIT_NOTES.md` (docs pass). Schema source of truth: `supabase/migrations/*`.
**Status verification (2026-09-26):** every finding below is kept and marked in place as `SOLVED`, `PARTIAL` or `NOT SOLVED`, re-verified against the current working tree after the Phase 7 fix batches (A-R). Nothing was deleted. DB-side fixes (C5/N4/N11/N13 and the order-number entropy, webhook-idempotency, promo-guard/dashboard-stats and newsletter migrations) depend on `20260925000005` and `20260926000001`-`20260926000005` having been applied to the live database; the repo cannot prove that, so they are marked SOLVED with that caveat.

Severity legend:
- **CRITICAL** - exploitable now, or silently corrupts money/inventory/security posture.
- **HIGH** - broken/misleading functionality, data loss, or major security weakness.
- **MEDIUM** - incorrect behavior, drift, operability gaps, injection/robustness risks.
- **LOW** - code quality, cosmetics, minor inconsistencies.

---

## 1. CRITICAL

### C1. Zero authentication or authorization anywhere in the API
> **Status: SOLVED** (verified 2026-09-26) - all 9 /api/admin/* routes call requireAdmin() (auth.getUser + profiles.role admin/staff; fails closed with 403 when migration 20260926000001 is missing), lib/auth/admin.ts is imported everywhere it is needed, the admin layout guards with requireAdminRedirect('/login'), and /login exists. Public storefront routes stay intentionally open for guest checkout; order PII is tracked separately in C2.
- No route handler in `apps/web/app/api/**` ever calls `auth.getUser()` for access control. The only `auth.getUser()` in the codebase is optional user attribution in `apps/web/app/api/orders/create/route.ts:37`.
- All admin endpoints are fully public and use the service-role client (bypasses RLS):
  - `apps/web/app/api/admin/orders/route.ts` (list all orders), `.../orders/[id]/route.ts` (GET/PATCH any order), `apps/web/app/api/admin/stats/route.ts`, `.../products/route.ts`, `.../products/[id]/route.ts` (DELETE), `.../inventory/route.ts` (PATCH stock), `.../promo-codes/route.ts` (POST/PATCH), `.../tracking/route.ts` (POST - advances order status).
- Admin UI has no guard either: `apps/web/app/admin/layout.tsx:14-46` is a pure layout with no session check; no `redirect('/login')` exists anywhere in the admin tree.
- **Impact:** anyone who can reach the site can read every customer order/PII, change order statuses, delete products, rewrite stock, create promo codes, and forge tracking events.
- `docs/STATUS.md:77` claims "Admin Authentication & Role-Based Access Control ... Admin shell guard" - no such code exists (see D2).

### C2. Order PII / IDOR leak through multiple unauthenticated order endpoints
> **Status: SOLVED** (verified 2026-09-26) - GET /api/orders/[id] requires a matching email or an authenticated session, order-status/[id] and checkout/success both gate full order details behind an email-verification step (canViewOrder), raw tracking fields are dropped from API responses (N9), and order numbers are now 10 hex chars (40 bits) via migration 20260926000002. Caveat: the entropy migration must be applied to the live DB for existing 4-hex numbers to be retired.
- `apps/web/app/api/orders/[id]/route.ts:24-25` - UUID branch fetches via `supabaseAdmin`, returns full order (address, email, totals, tracking) with no verification.
- `apps/web/app/api/orders/[id]/route.ts:28-36` - order_number branch returns the full order when no `email` query param is supplied (verification only happens if the caller voluntarily passes one; `getOrderByNumber` at `apps/web/lib/queries/orders.ts:369` is bypassed).
- `apps/web/app/(public)/order-status/[id]/page.tsx:51-69` - server component: UUID -> `getOrderById(supabaseAdmin, ...)`; order_number -> direct query; no email check. Renders full shipping address (`:75-84`).
- `apps/web/app/(public)/checkout/success/page.tsx:43-55` - order_number -> full receipt + address + email, no session/token check.
- Order numbers are enumerable: `supabase/migrations/20260924000003_create_triggers.sql:97` generates `ORD-YYYYMMDD-` + 4 hex chars = 65,536 possibilities/day (`order_number` is UNIQUE: `20260924000001_create_schema.sql:147`).
- Stealth side effect: these responses include `tracking_events` including raw carrier `raw_status` (`api/orders/[id]/route.ts:32`, `order-status/[id]/page.tsx:57`).
- **Impact:** harvestable customer PII + order status by guessing/enumerating order numbers; raw status leak undermines the "stealth" origin-masking design.

### C3. Payment is never verified - free orders
> **Status: SOLVED** (verified 2026-09-26) - orders/create validates the payload via Zod (paymentIntentId inside createPaymentIntentSchema), retrieves the PaymentIntent and enforces status, amount, USD currency and livemode in production; mock/pi_test_ intents are rejected whenever Stripe is configured, the stripe_simulator provider is rejected in production, and an intent can only ever pay for one order (idempotent 409 reconcile). 'processing' is accepted only as a pre-webhook state; marking paid requires payment_intent.succeeded.
- `apps/web/app/api/orders/create/route.ts:77-85` always inserts with `status: 'confirmed'`; `apps/web/lib/queries/orders.ts:256` maps that to `payment_status: 'paid'`.
- `paymentIntentId` is read from raw JSON (`orders/create/route.ts:28`), outside the Zod schema (`createPaymentIntentSchema`), and is never checked against Stripe (no retrieve, no amount/currency comparison, no `payment_status === 'succeeded'`).
- No idempotency: submitting the endpoint twice creates two paid orders.
- **Impact:** any client can `POST /api/orders/create` and receive a fully "paid/confirmed" order without paying anything; duplicate submissions double-order.

### C4. Live payment flow is a dead end; test flow confirms nothing
> **Status: PARTIAL** (re-verified 2026-09-26) - the live path is genuinely fixed: payment-step.tsx imports loadStripe (line 3), mounts a real Payment Element on the clientSecret (:61-83), confirms with confirmPayment (:90-123) and renders a real pay button (:312-353); @stripe/stripe-js is a declared dependency. Still open: test mode still "pays" via an 800 ms setTimeout then onSuccess(..., 'stripe_simulator') (:146-148) without ever confirming anything with Stripe, and the hard-coded "256-bit SSL Encryption" / "PCI-DSS Level 1 Compliant" marketing footer is untouched (:361-365).
- `apps/web/components/checkout/payment-step.tsx:210-215` - when `isTestMode === false` the UI renders only a static "Stripe Elements container mounted" placeholder: **no card form and no pay button**, so real checkout is impossible. `clientSecret` is not even destructured from props (`:27`) and is unused.
- `payment-step.tsx:39-54` - test mode: an 800 ms `setTimeout` then `onSuccess(paymentIntentId, 'stripe_simulator')`; the server-side PaymentIntent (if any) is never confirmed with Stripe.
- `@stripe/stripe-js` is declared in `apps/web/package.json` but never imported anywhere (grep: only a text label in `payment-step.tsx:213`). No `PaymentElement` exists in the repo.
- Security claims in the footer ("PCI-DSS Level 1", "256-bit SSL", `payment-step.tsx:219-232`) are hard-coded marketing text.
- **Impact:** live payments cannot complete; test mode mints "paid" orders; documentation/UI misrepresents payment readiness.

### C5. Inventory is never deducted (and can never be restored)
> **Status: SOLVED** (verified 2026-09-25) - migration 20260925000005 drops the dead orders trigger and adds AFTER INSERT ON order_items stock deduction plus restock on cancel/refund with transition guards (lines 16-64). Caveat: scripts/apply-migration-05.ts exists but the repo cannot prove it was executed against the live database.
- Orders are **inserted** already `'confirmed'`: `apps/web/app/api/orders/create/route.ts:84` -> `apps/web/lib/queries/orders.ts:247`.
- The deduct trigger is `AFTER UPDATE ... IF NEW.status = 'confirmed' AND OLD.status != 'confirmed'` (`supabase/migrations/20260924000003_create_triggers.sql:74,85-88`). On insert no UPDATE fires; when the Stripe webhook later updates, `OLD.status` is already `'confirmed'`, so the condition never holds.
- There is no `ELSE` branch: cancelling never restocks, and cancelled->re-confirmed deducts a second time (double deduction).
- Stock is only checked (not reserved) at intent/order time via `verifyVariantStock` (`apps/web/lib/queries/orders.ts:152-214`) - concurrent checkouts both pass.
- The misleading comment at `orders/create/route.ts:76` and `orders.ts:217-221` claims "triggers handle stock deduction".
- **Impact:** stock counts never move -> systematic overselling; cancel flows corrupt inventory; `getAdminInventory` numbers are fictional after the first sale.

### C6. Carrier webhook is completely unauthenticated
> **Status: SOLVED** (verified 2026-09-26) - the webhook enforces HMAC-SHA256/bearer authentication when CARRIER_WEBHOOK_SECRET is set and returns 503 in production when it is unset (fail closed; a logged dev-only fallback remains for local runs), status writes are gated by the monotonic canTransitionOrder, mapTrackingMilestoneToOrderStatus returns null for unknown milestones (no silent default to in_transit), insert/update errors are checked, and unknown tracking numbers are logged and rejected without pretending success.
- `apps/web/app/api/webhooks/carrier/route.ts:11-85` performs no signature verification; `carrierWebhookPayloadSchema.signature` exists in `packages/shared/src/schemas` but is never checked.
- Anyone can POST with a guessed `trackingNumber` to: insert tracking events (`:49-57`) and overwrite `orders.status` (`:66-73`, errors unchecked).
- Status mapping has no monotonic guard: `apps/web/lib/logistics/stealth-sanitizer.ts:216-234` maps **any unknown milestone to `'in_transit'`**, including "Order Cancelled"/"Order Refunded" - so a webhook can regress a delivered or cancelled order back to `in_transit`.
- Same non-monotonic map is used by admin tracking insertion (`apps/web/lib/queries/admin.ts:789-798`, order update result unchecked).
- **Impact:** forged lifecycle states, customer-visible status regression, inventory/ refund logic driven by attacker-controlled state.

### C7. Live secrets committed in the working tree
> **Status: SOLVED** (verified 2026-09-26) - scripts/apply-seed.ts reads DATABASE_URL from the environment (no hardcoded connection string), .env.example files exist for web and app, .gitignore covers .env*, and apps/web/.env holds no live-mode Stripe key (sk_live absent). Local gitignored .env files carrying dev credentials are expected, not a leak.
- `scripts/apply-seed.ts:4-6` hard-codes a full Supabase Postgres connection string including username and password; SSL verification disabled (`ssl: { rejectUnauthorized: false }`, `:13`).
- `apps/web/.env` contains `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (with password), `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, and Razorpay keys in plaintext. No `.env.example` exists for safe onboarding.
- **Impact:** database takeover / data exfiltration if this tree is ever pushed anywhere; violates the "never commit secrets" baseline.

### C8. Stripe webhook: masked misconfiguration, no amount check, no idempotency
> **Status: SOLVED** (verified 2026-09-26) - the webhook returns 503 when Stripe is unconfigured, verifies the stripe-signature HMAC, deduplicates by event id via the webhook_events table (migration 20260926000003), fails closed on amount and currency mismatch, only promotes pending -> confirmed (no regression of shipped/delivered), checks update errors, and logs every failure path via lib/logger.
- `apps/web/app/api/webhooks/stripe/route.ts:10-15` returns **HTTP 200** when Stripe is unconfigured, so failed payment events are silently swallowed (masks a broken payment pipeline).
- `:42-53` - on `payment_intent.succeeded` the order is marked `paid`/`confirmed` without verifying `amount`, `currency`, or that the amount matches `order.total_cents`.
- No event-id store -> retried deliveries duplicate work; update errors are unchecked (silent failure).
- The update unconditionally sets `status: 'confirmed'` (`:49`), which can regress an order already moved to `processing`/`shipped`.
- **Impact:** under/over-payment accepted as paid; status regressions; webhook failures invisible.

### C9. Admin surface is "demo" but presents fabricated data as real
> **Status: SOLVED** (verified 2026-09-26) - admin analytics reads real stats via getAdminDashboardStats (aggregated in SQL by the admin_dashboard_stats RPC, honest zero fallback, real period-over-period comparisons), the admin.ts catch-alls return zeros instead of invented numbers, the fabricated 7-day sales trend is gone, the "Demo Admin Session" badge was removed, and getAdminLogisticsOverview KPI counts are now real head-count queries (no more hardcoded deliveredCount: 38).
- `apps/web/app/admin/analytics/page.tsx:12-28` - `CATEGORY_BREAKDOWN` and `TOP_PRODUCTS` are hard-coded; `:45,54` fake deltas ("+14.8%", "+16.2%"); `:61-62` hard-coded conversion rate "3.42%"; `:69` hard-coded refund rate; `:56` net profit computed as `revenue * 0.67`.
- `apps/web/lib/queries/admin.ts:100` - `totalRevenueCents || 1285000` ("Demo fallback if DB is pristine"); `:103` `pendingShipments || 5`; `:111-116` catch-all returns fabricated stats (`pendingShipments: 6`, ...).
- `apps/web/components/admin/admin-header.tsx:32-35` shows a "Demo Admin Session" badge for a session that does not exist (see C1).
- **Impact:** stakeholders cannot distinguish real KPIs from fiction; dashboards lie silently instead of failing loudly.

### C10. Mobile app is a non-functional demo shell
> **Status: PARTIAL** (re-verified 2026-09-26) - the mobile checkout now POSTs /api/orders/create with a real payload (server verifies stock/promo/totals and sends the receipt email), the catalog queries live Supabase (fallback only when EXPO_PUBLIC_* env is absent), the bag starts empty and promos are server-validated - but profile.tsx still renders a fabricated "Alex Morgan" / ORD-94821 session, apps/app has no auth screens at all, and the bag hardcodes `paymentProvider: 'stripe_simulator'` (bag/checkout.tsx:105) which the server rejects with 402 in production (orders/create/route.ts:101-106), so mobile checkout still cannot complete for real.
- `apps/app/app/bag/checkout.tsx:55-79` - `handlePlaceOrder` is a 1200 ms `setTimeout` producing a random `ORD-#####`, then navigates to confirmation. **No API call, no payment, no order record.** The confirmation screen then claims "confirmation receipt ... sent to ..." (`apps/app/app/bag/confirmation.tsx:44-47`).
- `apps/app/lib/queries/catalog.ts:609-643` - `fetchProducts` operates on `FALLBACK_PRODUCTS` only (no DB query); `:685-787` `fetchOrderDetails` returns hard-coded mock items and mock tracking events.
- `apps/app/lib/supabase.ts:6-7` - falls back to `https://mock.supabase.co` / `mock-anon-key`, so misconfiguration fails silently at runtime.
- `apps/app/app/(tabs)/profile.tsx:21-61` - hard-coded user "Alex Morgan", hard-coded active order `ORD-94821`.
- Cart is pre-seeded with a demo item and promo codes are hard-coded in the store (`WELCOME10`, `ROOT20`, `STEALTH15` - the latter two do not exist in `supabase/seed.sql`).
- **Impact:** shipping the mobile app ships a simulator that fabricates orders and receipts.

---

## 2. HIGH

### H1. Client and server compute different totals (money bug)
> **Status: SOLVED** (verified 2026-09-25) - packages/shared/src/utils/checkout.ts is now the single calculateCheckoutBreakdown, re-exported by orders.ts:107 and consumed by the checkout page (all 4 local copies removed), the cart page, and the mobile cart store; no 599/1299/7500/0.08 magic numbers remain in the web cart/checkout paths.
Server source of truth: `apps/web/lib/queries/orders.ts:110-147` (tax = 8% of *discounted subtotal + shipping*; free shipping on *discounted* subtotal or `FREESHIP`).

Divergent client copies:
- `apps/web/app/(public)/checkout/page.tsx:53-63` - initial breakdown: tax on **subtotal only** (no shipping), ignores discount.
- `checkout/page.tsx:77-91`, `:122-143` - re-implemented formula with literal `1299/7500/599/0.08`.
- `checkout/page.tsx:151-165` (`handleRemovePromo`) - tax on base subtotal, **discount not applied**.
- `apps/web/app/(public)/cart/page.tsx:43-49` - tax on subtotal only; `isFreeShipping` ignores promo codes entirely; `FREESHIP` shows "Free shipping code applied!" (`:63-64`) but shipping is never zeroed (`:44`).
- Magic numbers `599 / 1299 / 7500 / 0.08` duplicated across `checkout/page.tsx`, `cart/page.tsx`, while `DEFAULT_SHIPPING_CENTS` / `FREE_SHIPPING_THRESHOLD_CENTS` exist in `packages/shared/src/constants/index.ts:36-37`.
- Mobile: `apps/app/lib/store/cart.ts:149-170` computes tax on subtotal-discount **excluding shipping** - a third variant.
- **Impact:** the number a customer sees and the number the server charges/displays later disagree; support disputes and refund math break.

### H2. Cart-page promo codes are client-side fiction
> **Status: SOLVED** (verified 2026-09-25) - the cart page now POSTs /api/checkout/validate-promo (cart/page.tsx:119-124) instead of hard-coding WELCOME10/FREESHIP, the applied promo persists in the cart store and via a ?promo= query param, and checkout re-validates server-side.
- `apps/web/app/(public)/cart/page.tsx:51-68` - `WELCOME10` always yields 10%, `FREESHIP` shows success text, everything else is invalid. No call to `/api/checkout/validate-promo`; DB rules (min order 5000 cents, `max_uses`, validity window - `supabase/seed.sql:237-239`, `apps/web/lib/queries/orders.ts:40-105`) are not enforced until checkout, where the discount silently disappears instead of erroring (see H5).
- **Impact:** cart shows discounts that checkout won't honor.

### H3. Order line items priced from the client, totals from the server
> **Status: SOLVED** (verified 2026-09-25) - orders/create/route.ts:112-118 maps serverPriceCents into the line items passed to createOrderInDb, so unit prices now match the server-verified totals.
- Totals use server-verified prices (`orders/create/route.ts:54-57` via `verifyVariantStock`), but `createOrderInDb` writes `unit_price_cents: item.priceCents` from the request payload (`apps/web/lib/queries/orders.ts:272-280`).
- **Impact:** receipt line items can sum to a value different from `orders.total_cents`; refunds/reconciliation based on line items are wrong.

### H4. Order items and tracking events can be silently lost
> **Status: SOLVED** (verified 2026-09-26) - order_items insert failure rolls the order back, the initial tracking event failure is logged loudly without blocking the order (documented trade-off), and every admin status/tracking write checks its result and surfaces errors to the caller. No checked write fails silently anymore.
- `apps/web/lib/queries/orders.ts:287-289` - `order_items` insert failure is only `console.error`'d; the order is still returned as success (customer sees "Order items summary available" on `checkout/success/page.tsx:241`), inventory trigger would have nothing to deduct, and the order has no line items.
- `orders.ts:292-299` - initial `tracking_events` insert result unchecked.
- `apps/web/lib/queries/admin.ts:297-305` - tracking event insert on status update unchecked; `:795-798` - order status update result unchecked.
- **Impact:** partial writes succeed silently; status/ tracking UI then contradicts reality.

### H5. Promo-code integrity problems
> **Status: SOLVED** (verified 2026-09-26) - redemptions go through the increment_promo_uses() RPC (single UPDATE enforcing max_uses + validity window atomically, migration 20260926000004) and its result is checked; an invalid promo at intent/order time returns 400 instead of being silently ignored; FREESHIP is seeded with discount_value 0 and zeroed explicitly in the shared calculator, so the double discount cannot occur.
- Non-atomic redemption counter: `orders.ts:302-315` reads `current_uses` then writes `+1` (read-modify-write) -> concurrent checkouts overshoot `max_uses`.
- Invalid promo at order/intent time is **silently ignored** (`orders/create/route.ts:61-67`, `checkout/create-intent/route.ts:49-55`) instead of failing the request.
- `FREESHIP` semantics are inconsistent three ways: seed defines it as a **fixed 599-cent discount** (`supabase/seed.sql:239`), while code special-cases the literal string `'FREESHIP'` for free shipping (`orders.ts:124`, `checkout/page.tsx:81,125,266-267`) - so it grants **free shipping plus a $5.99 discount**; and the cart page treats it as a no-op (H2).
- **Impact:** promo abuse, wrong totals, hard-coded business logic scattered across client and server.

### H6. No login/signup exists, yet the whole UI links to it
> **Status: SOLVED** (verified 2026-09-26) - /login, /signup, /account, /account/orders and /account/addresses all exist as real pages, so every previously 404 link resolves; the profiles trigger fires on signup (profiles stays no longer structurally empty), and getAdminCustomers has real rows to find once users register.
- No `/login`, `/signup`, `/register`, `/account`, or `/account/orders` route exists in `apps/web/app` (page inventory confirmed). Linked anyway from:
  - `apps/web/components/layout/mobile-nav.tsx:130`, `components/layout/header.tsx:111`, `components/checkout/contact-shipping-step.tsx:67`, `app/(public)/order-lookup/page.tsx:130`, `app/(public)/checkout/success/page.tsx:209`.
- Consequences: every account link is a 404; `profiles` stays empty (trigger `20260924000003:47-63` never fires); `cart_items`/`wishlists` tables and their RLS policies (`20260924000002:82-113`) are unusable; `getAdminCustomers` (`admin.ts:693-752`) queries `profiles` -> always ~0 customers; guest orders (`user_id IS NULL`) never appear there anyway.
- **Impact:** account/loyalty/customer-management features are structurally dead.

### H7. Account pages are fakes; account/cart query modules are dead code
> **Status: PARTIAL** (re-verified 2026-09-26) - the addresses page is real now (getAddresses/createAddress/updateAddress/deleteAddress against Supabase, no more DEMO_ADDRESS/400 ms setTimeout) and account.ts is imported and called by the account pages, but queries/cart.ts is still never called (it is only re-exported by the barrel lib/queries/index.ts:2; no file invokes getCartItems/addToWishlist) and the wishlist remains localStorage-only (lib/store/wishlist.ts persist key `root_wishlist_storage`, so the wishlists DB table + RLS stay unused).
- `apps/web/app/(public)/account/addresses/page.tsx:13-39` - `DEMO_ADDRESS` local state, 400 ms `setTimeout` "API delay"; never persists anything.
- `apps/web/lib/queries/account.ts` and `apps/web/lib/queries/cart.ts` are imported by **no file** (verified by repo-wide grep) - the real address/wishlist/cart helpers are dead code.
- Wishlist is localStorage-only: `apps/web/lib/store/wishlist.ts` (zustand `persist`), so `wishlists` DB table + RLS are unused.
- **Impact:** users "save" addresses that vanish; DB design implies features the app doesn't implement.

### H8. Contact/newsletter forms silently discard submissions
> **Status: SOLVED** (verified 2026-09-26) - the contact form POSTs to /api/contact (real Resend email), /api/newsletter persists to the subscribers table (migration 20260926000005) with logged failures, and both newsletter clients check res.ok and render the server error instead of unconditional success.
- `apps/web/app/(public)/contact/page.tsx:17-20` - `handleSubmit` only sets `isSubmitted = true`; no network call, no email.
- `apps/web/components/layout/footer.tsx:113` - newsletter form `onSubmit={(e) => e.preventDefault()}`; `components/home/newsletter-signup.tsx:11-13` - `preventDefault` + `// TODO: Wire to newsletter API`.
- **Impact:** customer inquiries and newsletter signups are lost while the UI reports success.

### H9. Customer-search and admin-search use raw string interpolation into PostgREST `or()` filters
> **Status: SOLVED** (verified 2026-09-26) - every PostgREST or()/ilike input path (orders, products, inventory, customers, and the shared product search used by /api/search, shop and sitemap) strips commas, parens, quotes, backslashes and %/_ wildcards before building filters.
- `apps/web/lib/queries/admin.ts:172-173` (orders: `order_number.ilike.%${search}%`, `shipping_address->>email...`), `:359` (products), `:524` (inventory), `:711` (customers).
- `search` is user input. Characters `,`, `)`, `(` alter the PostgREST filter grammar (filter injection / errors); `%` and `_` are unescaped wildcards.
- `apps/web/lib/queries/products.ts:108` - `ilike('name', '%${search}%')` likewise unescaped (used by `/api/search`, shop, sitemap).
- **Impact:** crafted queries can alter intended filters or cause 500s; also a data-scoping risk once C1 is fixed naively.

### H10. Unauthenticated `/api/health` discloses environment/configuration
> **Status: SOLVED** (verified 2026-09-25) - api/health/route.ts:22-30 now returns only status and timestamp in production; uptime, environment and integration flags are dev-only.
- `apps/web/app/api/health/route.ts:35-46` - returns `NODE_ENV`, process uptime, latency, and `stripe: 'live'|'test_simulator'`, `resend: 'configured'|'simulator'` to any caller.
- **Impact:** recon aid for attackers (which integrations are real), plus availability probing.

### H11. No rate limiting / abuse controls anywhere
> **Status: PARTIAL** (re-verified 2026-09-26) - apps/web/middleware.ts applies in-process sliding-window rate limits (lib/rate-limit) to /api/orders/create, /api/checkout/*, /api/contact, /api/newsletter, /api/admin/* and the order-status/lookup pages, with X-RateLimit headers emitted on the 429. Still unlimited: **/login** (the `/api/auth/` rule at rate-limit.ts:60 matches no existing route - login/signup call Supabase directly from the browser), `/api/search`, `/api/health` and `/api/webhooks/*`; docs/01:215 now describes the real in-process limiter instead of the Vercel KV/Upstash claim, but its "login" wording overstates coverage.
- No middleware, route, or Supabase-side throttle on `/api/orders/create`, `/api/checkout/*`, `/api/search`, `/api/health`, webhooks, or admin endpoints (`apps/web/lib/supabase/middleware.ts` only refreshes sessions).
- `docs/01-architecture-and-stack.md:215` claims "API Rate Limiting ... Vercel KV / Upstash" on checkout, login and tracking lookup - none of that code exists.
- Combined with C3 (free orders) and C6 (open webhook), this is directly abusable for spam orders and data hammering.
- **Impact:** business logic can be scripted at will; DB/email costs unbounded.

### H12. Security headers incomplete: no CSP, SVG allowed
> **Status: SOLVED** (verified 2026-09-25) - next.config.js:33-43 now sets a Content-Security-Policy header for all routes and dangerouslyAllowSVG was removed. Residual note: script-src still permits unsafe-inline and unsafe-eval.
- `apps/web/next.config.js:27-50` sets HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy but **no `Content-Security-Policy`**; `images.dangerouslyAllowSVG: true` (`:9`) serves user-adjacent SVG through `/_next/image`.
- Docs claim CSP exists: `docs/01-architecture-and-stack.md:214` ("middleware injects strict CSP headers"), `docs/09-launch-checklist-and-runbook.md:59`, `docs/STATUS.md:105`.
- **Impact:** XSS blast radius unmitigated; doc-driven reviewers will assume protection that isn't there.

### H13. Order-status state machine exists only in tests, not in production code
> **Status: SOLVED** (verified 2026-09-26) - a real state machine lives in packages/shared/src/utils/order-state-machine.ts and is enforced in updateAdminOrderStatus, addAdminTrackingEvent and the carrier webhook (monotonic guard), and ORDER_STATUSES no longer contains the DB-invalid 'returned' value.
- `packages/shared/tests/order-state-machine.test.ts:8-23` defines `ALLOWED_TRANSITIONS` **inside the test file**; `canTransition` has no counterpart in `src/`.
- Production has no transition validation: `apps/web/lib/queries/admin.ts:246-314` writes any status the (unauthenticated, C1) caller sends; carrier webhook writes any mapped status (C6).
- Related type drift: `ORDER_STATUSES` includes `'returned'` (`packages/shared/src/constants/index.ts:5-17`) which is **not** in the DB enum (`20260924000001:14-17`); any UI writing that value would fail at the DB.
- **Impact:** lifecycle integrity is unenforced; tests validate a fiction.

### H14. Email pipeline is fragile and injection-prone
> **Status: PARTIAL** (re-verified 2026-09-26) - email address fields are now passed through escapeHtml (resend.ts:37-45, applied to product names, variant labels, order number and every shipping-address field at :68, :71, :91, :104, :156-159) and the from address is env-driven with a production guard (resend.ts:19-30), but order emails remain fire-and-forget - orders/create/route.ts:205-208 does `.catch(console.error)` and ignores the returned `{success:false}` - with no queue, outbox or retry anywhere in apps/web.
- `apps/web/lib/email/resend.ts:121-124` - `shippingAddress.fullName/line1/city/...` interpolated raw into HTML -> HTML/content injection into the confirmation email (attacker-controlled order -> attacker-controlled markup in mail sent to themselves or, via CC-ish flows, others).
- Send is fire-and-forget with `console.error` only (`orders/create/route.ts:88-91`); no queue/retry/outbox -> a Resend hiccup permanently loses receipts.
- **Impact:** spoofable-looking emails (phishing risk for your own customers), silently missing receipts.

### H15. `supabaseAdmin` degrades silently on misconfiguration
> **Status: SOLVED** (verified 2026-09-26) - the web supabaseAdmin client throws with an actionable message when env vars are missing (no localhost/placeholder fallback; .env.example documents both), and the mobile client throws for production builds when EXPO_PUBLIC_* vars are absent - the local-Supabase fallback only exists in development.
- `apps/web/lib/supabase/admin.ts:16-18` - falls back to `http://127.0.0.1:54321` and the literal `'placeholder-service-role-key'` when env vars are missing.
- Mobile equivalent: `apps/app/lib/supabase.ts:6-7` (`https://mock.supabase.co` / `mock-anon-key`).
- **Impact:** missing env in production produces confusing "empty" data or auth errors instead of a hard startup failure; combined with C9's fallbacks, dashboards show fake numbers rather than an outage.

---

## 3. MEDIUM

### M1. Scripts directory is broken/orphaned
> **Status: SOLVED** (verified 2026-09-26) - root package.json now declares dotenv/stripe/resend/@supabase/supabase-js and references every script (db:seed, script:connections, script:checkout-intent, script:health), so the operational scripts execute; apply-seed reads credentials from the environment (see C7).
- `scripts/apply-seed.ts`, `scripts/test-connections.ts`, `scripts/test-checkout-intent.ts`, `scripts/test-health.ts` import `dotenv`, `stripe`, `resend`, `@supabase/supabase-js` - **none are dependencies of the root package** (`package.json` has only `pg`, `tsx`, eslint/prettier/turbo...). No root script references `scripts/*`.
- `scripts/test-checkout-intent.ts` imports Next.js route handlers directly outside a Next runtime (will not run as-is).
- `scripts/apply-seed.ts` bypasses migrations/RLS with the leaked superuser connection (see C7).
- **Impact:** documented operational scripts cannot execute; the one that can (seed) uses a leaked credential.

### M2. CI/CD gaps
> **Status: SOLVED** (verified 2026-09-26) - ci.yml runs an independent test job (pnpm turbo test) alongside lint/typecheck/build, web has a test suite of its own (13 tests), and deploy.yml no longer deploys non-existent edge functions and installs with `pnpm install --frozen-lockfile` instead of npm.
- `.github/workflows/ci.yml` runs lint/typecheck/build only - **no test job**, despite `docs/STATUS.md:129` advertising "18/18 tests passed" and a `turbo test` task existing.
- Only `packages/shared` defines a `test` script (`packages/shared/package.json:6`); `web` and `app` have no tests at all (checkout, webhooks, queries: 0 coverage).
- `.github/workflows/deploy.yml` uses `npm install` while the repo pins `packageManager: pnpm@9.12.0`, and runs `supabase functions deploy ...` for edge functions that don't exist (no `supabase/functions/` directory; `docs` still describe `payment-webhook`, `tracking-proxy`, `send-email` as edge functions).
- **Impact:** regressions merge freely; deploy workflow fails or deploys nothing.

### M3. Analytics/inventory query scalability and correctness
> **Status: SOLVED** (verified 2026-09-26) - dashboard stats are computed in SQL by the admin_dashboard_stats RPC (no full-table fetch into JS), the low-stock filter runs in the query before .range() pagination, and customer totalSpent counts paid orders only. Caveat: the RPC lives in migration 20260926000004 which must be applied to the live DB.
- `apps/web/lib/queries/admin.ts:33-60` - dashboard stats pull **all** orders (no date window, no pagination) and aggregate in JS; unbounded as order count grows.
- `admin.ts:527` paginates inventory but `admin.ts:565` applies `lowStockOnly` **after** pagination -> wrong page sizes/empty pages when filtered.
- `admin.ts:727` - customer `totalSpent` sums all orders including unpaid/cancelled.
- **Impact:** wrong admin numbers at scale; performance cliff.

### M4. Delivery-window and shipping-label inconsistencies
> **Status: SOLVED** (verified 2026-09-26) - every customer-facing surface reads the shared SHIPPING_RATES labels: success page uses windowLabel (express-aware), order emails use the shared constants, mobile confirmation uses SHIPPING_RATES.standard.windowLabel, estimated_delivery_date picks windowDays by tier, and the docs were corrected in Batch R (D6).
- `packages/shared/src/constants/index.ts:25-29` - labels promise "5-7 business days" standard / "2-3" express; success page fallback and confirmation email/screen say "7-14 Business Days" (`apps/web/app/(public)/checkout/success/page.tsx:117`, `apps/app/app/bag/confirmation.tsx`), and `docs` describe 7-14 / 5-9.
- `apps/web/lib/queries/orders.ts:260-262` - `estimated_delivery_date` is always now+10 days regardless of shipping tier (express customers get the same estimate as standard).
- **Impact:** customer-facing SLA promises contradict each other; express is effectively unfulfillable by the estimate logic.

### M5. Status/stealth duplication drift
> **Status: SOLVED** (verified 2026-09-26) - apps/web/lib/logistics/ was deleted; every web production path now imports the tested shared sanitizer from @repo/shared/utils, including mapTrackingMilestoneToOrderStatus (C6 shared copy).
- Two independent sanitizers: `packages/shared/src/utils/stealth-sanitizer.ts` and `apps/web/lib/logistics/stealth-sanitizer.ts` (different type definitions joined via `as unknown as` casts - e.g. `apps/web/lib/queries/admin.ts:790-793`, `webhooks/carrier/route.ts:60-64`).
- Tests only exercise the **shared** copy (`packages/shared/tests/stealth-sanitizer.test.ts`); the copy actually used in production paths (web) is untested and can drift silently.
- `mapTrackingMilestoneToOrderStatus` lives only in the web copy, has a catch-all default (`stealth-sanitizer.ts:232-233`) and no ordering guard (see C6).
- **Impact:** fixes applied to one copy won't reach the other; the tested file isn't the shipped file.

### M6. RLS/permission design holes
> **Status: PARTIAL** (verified 2026-09-26) - the role system now exists (profiles.role + is_admin() helper) and storage policies are re-keyed to it in migration 20260926000001 (Q2), but the orders/order_items/tracking_events RLS still assumes service-role-only writes.
- `supabase/migrations/20260924000004_create_storage.sql:30` - product-image writes require `auth.jwt() ->> 'role' = 'admin'`, but **no role system exists anywhere** (no `role` column, no JWT claim setter) -> real users can never upload.
- `20260924000002:120-122` - `orders` INSERT requires `auth.uid() = user_id`, so the guest checkout everyone actually uses only works because the server uses the service role; any future client-side insert path breaks.
- No UPDATE/DELETE policies for `orders`, `order_items`, `tracking_events` - fine only while *everything* goes through service role (fragile under C1: service role is reachable from open endpoints).
- **Impact:** future features (admin uploads, client edits) will fail mysteriously; the "secure by RLS" claim is hollow while C1 stands.

### M7. Webhook/ops observability is console-only
> **Status: PARTIAL** (verified 2026-09-26) - failures in webhooks, orders/create, contact, newsletter and admin writes now go through structured lib/logger events (including carrier fail-closed 503s and stripe idempotency errors), and the carrier order-not-found path is logged and deliberately 2xx so carriers stop retrying unapplicable events - but a few query helpers still console.* only and there is no alerting or dead-lettering.
- All failure paths are `console.error`/`console.warn` (`webhooks/*`, `orders/create:91,101`, admin routes) with no structured logs, alerting, or dead-lettering; webhook handlers return 200 even for "order not found" (`webhooks/carrier/route.ts:32-38`).
- **Impact:** failed payments/emails/status updates are invisible until a customer complains.

### M8. Sitemap/SEO weaknesses
> **Status: SOLVED** (verified 2026-09-26) - sitemap paginates the full product list (offset loop over PRODUCT_PAGE_SIZE), a null/invalid updated_at can no longer invalidate the dynamic section (safeLastModified), and robots.txt disallows both /order-status/ and /order-lookup/.
- `apps/web/app/sitemap.ts:60` - only the first 100 products are included (`limit: 100`).
- `:75-77` - `new Date(prod.updated_at)` with a null/undefined `updated_at` yields Invalid Date -> thrown inside the try -> **entire** dynamic portion silently falls back to static routes.
- Robots (`apps/web/app/robots.ts`) disallows `/account/`, `/checkout/`, `/admin/`, `/api/` but **not** `/order-status/` or `/order-lookup/` -> the IDOR pages in C2 are indexable.
- **Impact:** indexing gaps + crawler-friendliness for the PII leak path.

### M9. Search is not what the UI/docs promise
> **Status: PARTIAL** (verified 2026-09-26) - product search now covers name, slug, description and long_description with sanitized inputs and /api/search returns up to 20 products, but tags and full-text (tsvector) search are still absent, so the roadmap promise remains open.
- `apps/web/lib/queries/products.ts:107-109` - single-column `ilike` on `name` only; no slug/description/tag/full-text search (roadmap still lists "full-text search via Supabase" as an open task: `docs/08-roadmap-and-phases.md:85`).
- `/api/search` (`apps/web/app/api/search/route.ts`) returns max 6 products; the header search modal and `/search` page have their own result handling -> inconsistent results for the same query.
- **Impact:** weaker discovery; empty results for common queries ("cotton", "hoodie" if not in `name`).

### M10. Checkout error handling gaps
> **Status: SOLVED** (verified 2026-09-26) - handlePaymentSuccess has its own try/catch with a reconcile path (409 + orderNumber returns the owner's existing order -> success page; 500/network -> safe-retry message, server idempotency check now runs for every provider), and the three 500 handlers return generic messages while logging details via lib/logger.ts.
- `apps/web/app/(public)/checkout/page.tsx:213-234` - `handlePaymentSuccess` has no try/catch of its own (relies on `PaymentStep`'s), and there is no handling for "order created but email failed" or "payment succeeded but order insert failed" -> no reconciliation path; a failed `orders/create` after a real Stripe charge leaves a paid intent with no order.
- Server 500s echo raw internal messages to clients (`orders/create/route.ts:100-102`, `create-intent/route.ts:105-108`, `api/orders/[id]/route.ts:43-46`).
- **Impact:** money/ order mismatches with no recovery path; internal details leaked to callers.

### M11. Mobile/web tax & promo divergence recap (cross-app)
> **Status: SOLVED** (verified 2026-09-26) - tax/shipping/discount bases are unified through the shared helpers, the mobile bag sends its promo to /api/orders/create for server-side validation (the hard-coded WELCOME10/ROOT20/STEALTH15 set is gone; only a placeholder hint remains), and ROOT20 is seeded so the database covers every code the tooling mentions.
- Tax bases differ in three places (server: subtotal+shipping after discount; web cart: subtotal; mobile: subtotal-discount) - see H1.
- Mobile promo set (`WELCOME10`, `ROOT20`, `STEALTH15`) != seeded set (`WELCOME10`, `FREESHIP`).
- **Impact:** the same cart totals differently on every surface.

### M12. Seed data & fixture issues
> **Status: SOLVED** (verified 2026-09-26) - seed.sql is UTF-8 clean (0 replacement chars), product images now use deterministic picsum.photos URLs (next.config.js whitelist + CSP updated to match, placehold.co removed), FREESHIP is seeded with discount_value 0 (matching migration 20260925000005), and ROOT20 is seeded so the promo set covers everything the tooling references.
- `supabase/seed.sql` contains mojibake in comments (`(U+FFFD)?"` sequences, e.g. `:147,154,161`) - file encoding is not UTF-8 clean.
- Seed images all point at `placehold.co` placeholders (`:208-232`); `via.placeholder.com` (defunct service) is still whitelisted in `next.config.js:26`.
- Seed promo `FREESHIP` semantics conflict with code (H5).
- **Impact:** broken/ugly imagery in any environment seeded from this file; encoding suggests non-UTF8 tooling in the pipeline.

### M13. Minor type/lint escape hatches
> **Status: SOLVED** (verified 2026-09-26) - products/account/cart query helpers use the fully typed Client alias from lib/supabase/types.ts (single boundary cast in server.ts/client.ts documents the @supabase/ssr signature mismatch), and shipping_address is inserted through the ShippingAddressPayload type alias with no cast (orders.ts).
- `apps/web/lib/queries/products.ts:10-11` - `type Client = SupabaseClient<any, any, any>` with an `eslint-disable` for `no-explicit-any`.
- `shipping_address` is inserted via `as unknown as ...Insert['shipping_address']` (`orders.ts:257-258`) - the JSON shape is effectively untyped at the DB boundary.
- **Impact:** schema mismatches won't be caught by TypeScript where it matters most.

---

## 4. LOW

- **L1** `apps/web/app/admin/promo-codes/promo-codes-client.tsx:26-45` - toggle handler ignores non-OK responses (no user feedback on failure).  **[Status: SOLVED]** the promo toggle handler now surfaces non-OK/network failures in an error banner above the table (promo-codes-client.tsx).
- **L2** `apps/web/lib/queries/products.ts:178-182` - `getProductById` doesn't filter `is_active`; harmless for the admin edit page today, but it will leak inactive products if reused.  **[Status: SOLVED]** getProductById now filters is_active by default; only the admin edit page passes includeInactive: true (products.ts, admin/products/[id]/edit/page.tsx).
- **L3** `apps/web/app/api/checkout/create-intent/route.ts:98-101` - dev fallback mint IDs (`pi_test_...`, `mock_secret_...`) look real enough to be mistaken for live intents in logs/metrics.  **[Status: SOLVED]** the simulator now mints clearly-fake `mock_pi_*` / `mock_secret_*` ids (only when Stripe is unconfigured, never in production), so they cannot be mistaken for live intents.
- **L4** `apps/web/components/checkout/payment-step.tsx:35-37` - test card fields are prefilled and editable but completely ignored (no validation of number/expiry/CVC), which will confuse testers.  **[Status: SOLVED]** payment-step.tsx:131-143 now validates card number length, MM/YY format and CVC before simulating the charge.
- **L5** `apps/web/app/(public)/checkout/page.tsx:264-267` - `isFreeShipping` recomputed with yet another variant of the free-shipping rule (fourth copy).  **[Status: SOLVED]** the fourth isFreeShipping copy is gone; checkout/page.tsx:282 derives it from breakdown.shippingCents === 0.
- **L6** `packages/shared/src/constants/index.ts:4` - `SUPPORT_EMAIL = 'support@root.com'` hard-coded (likely placeholder domain) in footer/emails/success page.  **[Status: SOLVED]** SUPPORT_EMAIL now reads NEXT_PUBLIC_CONTACT_EMAIL/CONTACT_EMAIL with support@root.com only as last-resort default; both vars are documented in .env.example.
- **L7** `apps/app` source files contain mojibake in user-visible strings (`2 Items (U+FFFD)? Total`, `7?14 Business Days` in `app/bag/confirmation.tsx`, `app/(tabs)/profile.tsx`) - encoding broken at source.  **[Status: SOLVED]** no U+FFFD replacement characters remain anywhere in apps/app sources; the profile and confirmation strings are clean.
- **L8** `apps/web/app/api/admin/orders/[id]/route.ts:40-46` - any update failure returns 500 with a generic message while the UI shows no rollback/toast contract.  **[Status: SOLVED]** invalid transitions return 409 with a conflict flag; the order detail page shows a success/error toast and rolls back selectedStatus/trackingCode/carrier on failure (api/admin/orders/[id]/route.ts, order-detail-client.tsx).
- **L9** `turbo.json` - `lint` depends on `^build`, making lint require full dependency builds (CI time cost).  **[Status: SOLVED]** the lint task no longer declares dependsOn (turbo.json lint is {}), so lint runs without building dependencies first.
- **L10** `apps/web/next.config.js:14-24` - `deviceSizes`/`imageSizes` include duplicates of defaults; harmless noise.  **[Status: SOLVED]** the redundant deviceSizes/imageSizes overrides were removed (Batch O); next.config.js only carries the deliberate picsum/CSP changes.
- **L11** `docs/02` vs migrations drift: doc shows `first_name/last_name`, `PAID`, `stripe_session_id`, `tracking_number`, `occurred_at` - actual schema uses `full_name`, `paid`, `payment_intent_id`, `tracking_code`, `event_timestamp` (treat migrations as truth).  **[Status: SOLVED]** docs/02 matches the migrations (full_name, 'paid', payment_intent_id, tracking_code, event_timestamp) and the same wrong names in docs/04's examples were corrected too.
- **L12** `docs/04`/`docs/06` still describe edge functions (`payment-webhook`, `tracking-proxy`, `send-email`) that don't exist - those responsibilities live in Next API routes instead (see M2).  **[Status: SOLVED]** docs/04 section 4 now lists the implemented Next.js route handlers (no edge functions), docs/06 documents the API route groups, and the tracking/email responsibilities are described where they actually run.

---

## 5. TEST COVERAGE GAPS (T)

- **T1** `packages/shared/tests/checkout-calculator.test.ts:11-21` - the test **re-implements** shipping/tax/discount logic locally instead of importing `calculateCheckoutBreakdown`; it therefore proves nothing about production code and actually encodes a *different* tax rule (tax excludes shipping vs. server includes shipping, `orders.ts:129`).  **[Status: SOLVED]** checkout-calculator.test.ts now imports calculateCheckoutBreakdown, calculateShipping and calculateTax from ../src/utils instead of re-implementing them.
- **T2** `packages/shared/tests/order-state-machine.test.ts:8-23` - same pattern: transitions defined inside the test; no production function is exercised (see H13).  **[Status: SOLVED]** order-state-machine.test.ts now imports ALLOWED_ORDER_TRANSITIONS and canTransitionOrder from ../src/utils; the shared suite passes 21/21.
- **T3** No tests for: any API route, Stripe/carrier webhooks, `verifyVariantStock`, `createOrderInDb`, promo validation, RLS policies, the trigger functions (inventory/order number), email rendering, or the mobile app.  **[Status: PARTIAL]** web now tests validatePromoCode and verifyVariantStock (apps/web/tests/orders-queries.test.ts) and shared covers the calculator, state machine, sanitizer, address schemas, delivery windows and the order-number migration contract - but API routes, webhooks, RLS, trigger execution, email rendering and the mobile app remain untested.
- **T4** `docs/STATUS.md:107,109,129` claims "100% test pass rate across all monorepo packages" - only `@repo/shared` has tests; two of its four suites are self-referential (T1/T2).  **[Status: SOLVED]** the 100% claims are gone; STATUS now states the real suite (44 tests: 31 shared + 13 web) and how it is verified (pnpm turbo lint typecheck test).
- **T5** No CI test job (M2), so even the 18 shared tests never run on push.  **[Status: SOLVED]** ci.yml has an independent `test` job running `pnpm turbo test` on every push/PR (Batch N).

---

## 6. DOCS vs. CODE DRIFT (D) - for orientation, not defects per se

- **D1** `docs/01-architecture-and-stack.md:214` / `docs/09:59` / `docs/STATUS.md:105` - CSP claimed; none configured (H12).  **[Status: SOLVED]** a CSP is now configured in next.config.js, so the docs claim is no longer a drift.
- **D2** `docs/STATUS.md:77` - admin RBAC claimed; none exists (C1).  **[Status: SOLVED]** docs/STATUS.md Phase 4 Task 1 now describes reality: requireAdmin() server-side guard (session + profiles.role), admin layout guard, no dev bypass.
- **D3** `docs/STATUS.md:105` - claims headers include CSP in `next.config.js`; the file has no CSP entry.  **[Status: SOLVED]** the STATUS header claim now matches next.config.js, which really does set those headers including CSP.
- **D4** Docs describe Supabase Edge Functions for payment webhook/tracking proxy/email; implemented as Next.js API routes; `deploy.yml` still deploys the non-existent functions (M2).  **[Status: SOLVED]** deploy.yml no longer deploys edge functions (Batch N), and docs/01/04/05/06 now describe the Next.js route handlers, shared sanitizer, and in-process rate limiter that actually exist.
- **D5** `docs/05-stealth-logistics-and-checkout.md:81` claims dynamic state-by-state tax via Stripe Tax/TaxJar; tax is a hard-coded `0.08` in `orders.ts:129` and three client copies (H1).  **[Status: SOLVED]** docs/05 (prose and checkout diagram) now states the actual behavior: flat 8% on discounted subtotal + shipping via the shared calculator, with Stripe Tax explicitly listed as not yet integrated.
- **D6** Shipping windows inconsistent across `SHIPPING_RATES`, success page, email templates, docs (M4).  **[Status: SOLVED]** all surfaces now read the shared SHIPPING_RATES labels (5-7 standard / 2-3 express) and Batch R corrected the remaining docs (05, 09, 10) to match.
- **D7** `docs/04` schema examples don't match migrations (L11).  **[Status: SOLVED]** docs/04 examples now use the real column/function names (full_name, payment_intent_id, payment_status 'paid', tracking_code, event_timestamp) and the webhook example matches the implemented payment_intent.succeeded flow.

---

## 7. QUICK COUNTS & AUDIT SUMMARY

| Category | Count | Primary Themes |
|---|---|---|
| Critical (C1-C10) | 10 | Zero API/Admin auth, order PII/IDOR leaks, fake payments, dead-end live payments, inventory never deducted, open carrier webhooks, secrets in repo, fabricated admin stats, mobile demo simulator |
| High (H1-H15) | 15 | Financial total divergence, cart promo fiction, line item vs total mismatch, unhandled write failures, promo abuse, missing auth routes, fake contact/newsletter forms, PostgREST filter injection, health info disclosure, lack of rate limits, missing CSP, unexercised state machine, email injection, silent config fallbacks |
| Medium (M1-M13) | 13 | Orphaned operational scripts, CI test gaps, dashboard query scalability, delivery SLA drift, sanitizer duplication, RLS policy holes, console-only observability, sitemap invalid dates, weak catalog search, checkout reconciliation gap, mojibake seed encoding, type escape hatches |
| Low (L1-L12) | 12 | UI toggle feedback, inactive product queries, simulated ID formats, prefilled test card confusion, redundant constant definitions, placeholder contact email, UI mojibake, unhandled generic 500s |
| Tests (T1-T5) | 5 | Self-referential test logic, unexercised production code, 0% test coverage for API/queries/triggers/mobile |
| Doc Drift (D1-D7) | 7 | Fabricated CSP claims, fictitious RBAC, phantom edge functions, missing tax engine, shipping window discrepancies |
| **New Deep Audit Findings (N1-N19)** | **19** | Category FK crash on product creation, fire-and-forget child inserts, non-functional product edit page, inventory trigger execution flaw, cart promo persistence loss, `FREESHIP` cart discrepancy & double-discounting, broken inventory pagination, header metric pagination flaw, stealth tracking leaks, webhook/order race conditions, Resend sandbox domain restriction, missing payment intent unique constraint, zero-value dashboard fabrication, soft-delete variant leakage, unaggregated stock verification, transient ISR 404 caching, mobile catalog backend bypass, shared checkout calculator missing |
| **Total Issues Identified** | **81** | Comprehensive monorepo audit across database, backend APIs, storefront, admin dashboard, and mobile client |

### Verification roll-up (2026-09-26, after Phase 7 batches A-R)

| Status | Count | Findings |
|---|---|---|
| **SOLVED** | **72** | C1, C2, C3, C4, C5, C6, C7, C8, C9, H1, H2, H3, H4, H5, H6, H8, H9, H10, H11, H12, H13, H15, M1, M2, M3, M4, M5, M8, M10, M11, M12, M13, L1-L12, T1, T2, T4, T5, D1-D7, N1-N9, N11, N13-N19 |
| **PARTIAL** | **8** | C10, H7, H14, M6, M7, M9, T3, N12 |
| **NOT SOLVED** | **1** | N10 |

Highlights of what is still open: the Stripe webhook still cannot create a missing order after the client race (N10), mobile has no auth screens and the profile tab still shows a fabricated session (C10), `queries/cart.ts` is dead code and the wishlist is localStorage-only (H7), order emails are fire-and-forget with no retry queue (H14), the orders/order_items/tracking_events RLS policies remain service-role-only (M6), some query helpers still log to console without alerting/dead-lettering (M7), search lacks tags/full-text (M9), `RESEND_FROM_EMAIL` is unset so local sends still use the Resend sandbox sender (N12), and API routes/webhooks/RLS/triggers/email/mobile have no test coverage (T3).

**The six foundational pillars to fix first (everything else depends on them):**
1. **Auth & RBAC (C1)**: Implement session guards and role enforcement on all API routes and `/admin`.
2. **Payment Lifecycle & Verification (C3, C4, C8, N10, N13)**: Mount real Stripe Elements, enforce webhook idempotency, verify payment amounts before order confirmation, and add unique constraint on `payment_intent_id`.
3. **Database Inventory & Trigger Integrity (C5, N4, N16)**: Re-architect stock reservation and deduction to execute atomically on line item insertion or via a PostgreSQL RPC function (`create_order_atomic`).
4. **Logistics & Origin Masking Enforcement (C6, N9)**: Authenticate carrier webhooks, enforce monotonic order status state machine, and sanitize customer-facing tracking views.
5. **Single Financial Source of Truth (H1, N5, N6, N11, N19)**: Centralize `calculateCheckoutBreakdown` in `@repo/shared` and consume universally across web checkout, cart, mobile app, and backend validation.
6. **Admin Catalog Operability (N1, N2, N3, N7, N15)**: Fix category UUIDs, enforce transactional product/variant creation, build interactive product editing, and fix low-stock database pagination.

---

## 8. DEEP CODEBASE AUDIT FINDINGS (NEW BUGS & ARCHITECTURAL GAPS)

### N1. Hardcoded Non-Existent Category UUIDs in Admin Product Creation Form (Foreign Key Crash)
> **Status: SOLVED** (verified 2026-09-25) - the new-product form now fetches /api/admin/categories and uses real IDs (products/new/page.tsx:37-46, 238-242); the four fake UUIDs are gone.
- **Location:** `apps/web/app/admin/products/new/page.tsx:226-229`
- **Defect:** The `<select>` element in the admin product creation form hardcodes four category UUIDs:
  - `4f8f4a7c-5d1e-4b6a-9f2d-3c8e7b1a0d5f` ("Tees & Tops")
  - `6a2b8c9d-0e1f-4a3b-8c5d-7e9f1a2b3c4d` ("Hoodies & Fleece")
  - `8b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e` ("Pants & Bottoms")
  - `0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b` ("Outerwear")
  None of these UUIDs exist in the database (actual seeded category IDs are `11111111-1111-1111-1111-111111111111` through `88888888-8888-8888-8888-888888888888`, see `supabase/seed.sql:9-19`).
- **Impact:** Any attempt by an admin to create a new product with an assigned category crashes with a PostgreSQL foreign key violation: `insert or update on table "products" violates foreign key constraint "products_category_id_fkey"`. Product creation is completely broken whenever a category is chosen.
- **Recommended Fix:** Fetch categories dynamically via `getCategories()` or provide a `/api/admin/categories` endpoint to populate `<select>` options dynamically with real database IDs, identical to `apps/web/app/admin/products/page.tsx:81-85`.

---

### N2. Silent Child Insertion Failures & Lack of Transaction in `createAdminProduct`
> **Status: SOLVED** (verified 2026-09-25) - createAdminProduct now checks variant and image insert errors and deletes the parent rows on failure (admin.ts:469-493).
- **Location:** `apps/web/lib/queries/admin.ts:443, 456`
- **Defect:** Variant and image insertions are executed with:
  ```ts
  await client.from('product_variants').insert(variantsToInsert);
  await client.from('product_images').insert(imagesToInsert);
  ```
  Neither call destructs `{ error }` or checks for failure. PostgREST does **not** throw a JavaScript exception on constraint violations (e.g. duplicate SKU on `product_variants_sku_key` or invalid `size_enum` value); it resolves to `{ data: null, error: { message: ... } }`.
- **Impact:**
  1. The enclosing `try / catch` block does not catch the failure.
  2. The function proceeds to return `{ success: true, productId }` even if all variants and images failed to insert.
  3. The product is left as an orphaned shell in the database without SKUs or images.
  4. There is no rollback mechanism to delete the parent product if child insertions fail.
- **Recommended Fix:** Destructure `{ error }` on variant and image inserts. Roll back parent product creation if child inserts fail, or ideally encapsulate product creation into a single transactional PostgreSQL function (`create_admin_product_atomic`).

---

### N3. Read-Only Non-Functional Admin Product Edit Page & Missing PATCH/PUT Route
> **Status: SOLVED** (verified 2026-09-25) - PATCH is exported from api/admin/products/[id] (route.ts:10-37) and product-edit-form.tsx is a real editable form that submits updates.
- **Location:** `apps/web/app/admin/products/[id]/edit/page.tsx:57-98` and `apps/web/app/api/admin/products/[id]/route.ts:9-26`
- **Defect:**
  1. The page titled "Edit: {product.name}" renders all attributes (base price, compare-at price, status, description, and assigned variants) as static read-only text cards and table rows. There are no `<input>`, `<textarea>`, `<select>`, or `<button type="submit">` elements anywhere on the page.
  2. The corresponding API route handler at `apps/web/app/api/admin/products/[id]/route.ts` only exports a `DELETE` function. No `PUT` or `PATCH` method exists.
- **Impact:** Admins cannot edit, update prices, change descriptions, update stock thresholds, or modify variants for any existing product in the catalog.
- **Recommended Fix:** Convert `apps/web/app/admin/products/[id]/edit/page.tsx` into an editable form component (or hook into Server Actions), and implement `PATCH /api/admin/products/[id]` supporting updates to product metadata and variants.

---

### N4. Critical Schema & Trigger Timing Flaw Preventing Inventory Deduction
> **Status: SOLVED** (verified 2026-09-25) - duplicate of C5: the new AFTER INSERT ON order_items trigger deducts stock as line items are written.
- **Location:** `supabase/migrations/20260924000003_create_triggers.sql:68-88` and `apps/web/lib/queries/orders.ts:243-285`
- **Defect:**
  1. The trigger `trigger_deduct_inventory` is attached as:
     ```sql
     CREATE TRIGGER trigger_deduct_inventory
         AFTER UPDATE ON orders
         FOR EACH ROW
         EXECUTE FUNCTION deduct_inventory_on_order();
     ```
     with trigger condition:
     ```sql
     IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
         FOR item IN SELECT variant_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
             UPDATE product_variants SET inventory_count = inventory_count - item.quantity WHERE id = item.variant_id;
         END LOOP;
     END IF;
     ```
  2. In `createOrderInDb` (`orders.ts:243-265`), orders are **inserted directly with `status: 'confirmed'`**. Because this is an `INSERT`, no `AFTER UPDATE` trigger fires.
  3. Furthermore, even if an `AFTER INSERT ON orders` trigger were created, `order_items` are inserted *after* `orders` (`orders.ts:282-285`). At the instant `orders` is inserted, `order_items` has 0 rows for `order_id = NEW.id`.
- **Impact:** Inventory is structurally impossible to deduct via the database trigger under the current execution order. Variant stock never decrements, leading to unbounded overselling.
- **Recommended Fix:** Either attach the trigger to `AFTER INSERT ON order_items` to deduct stock immediately as each line item is created:
  ```sql
  CREATE TRIGGER trigger_deduct_stock_on_item_insert
      AFTER INSERT ON order_items
      FOR EACH ROW
      EXECUTE FUNCTION deduct_stock_for_line_item();
  ```
  Or move order creation and inventory deduction into a single atomic PostgreSQL RPC function (`create_order_atomic`).

---

### N5. Cart Page Promo Code State Discarded on Navigation to Checkout
> **Status: SOLVED** (verified 2026-09-25) - the cart promo now persists in the zustand store and travels via ?promo= to checkout, which re-validates it server-side.
- **Location:** `apps/web/app/(public)/cart/page.tsx:285-291`
- **Defect:** Applying a promo code on `/cart` updates only local component React state (`promoDiscountCents`, `promoSuccess`). The "Proceed to Checkout" button is a plain navigation link:
  ```tsx
  <Link href="/checkout" className="...">
    Proceed to Checkout
  </Link>
  ```
  No query parameters are passed (`/checkout?promo=...`), and `useCartStore` (the Zustand store with localStorage persistence) does not store applied promo codes.
- **Impact:** When a customer applies a promo code on the cart page and proceeds to checkout, the discount is completely discarded. The checkout page loads with full prices, forcing the customer to re-enter the code or mistakenly pay full price, causing checkout friction and abandoned carts.
- **Recommended Fix:** Store the active promo code inside `useCartStore` (with persistence) so it persists across cart and checkout, or append `?promo=${encodeURIComponent(code)}` to the checkout link and read it via `useSearchParams()` on the checkout page.

---

### N6. `FREESHIP` Displays Success Message on Cart Page but Charges $5.99 Shipping
> **Status: SOLVED** (verified 2026-09-25) - FREESHIP now genuinely zeroes shipping through the shared calculation, so the cart success message is truthful.
- **Location:** `apps/web/app/(public)/cart/page.tsx:43-44, 63-64`
- **Defect:** When a user enters `FREESHIP` on `/cart`, line 63-64 calls `setPromoSuccess('Free shipping code applied!')`. However:
  - Line 43 calculates `isFreeShipping = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;`
  - Line 44 sets `shippingCents = items.length === 0 ? 0 : isFreeShipping ? 0 : DEFAULT_SHIPPING_CENTS;`
  `shippingCents` does not check for the `FREESHIP` promo code.
- **Impact:** The cart page displays a green success confirmation ("Free shipping code applied!"), but the order summary still adds $5.99 shipping to the customer's total, causing immediate confusion and distrust.
- **Recommended Fix:** Include promo code logic in the cart shipping calculation or, ideally, call the centralized `calculateCheckoutBreakdown` function directly.

---

### N7. Broken In-Memory Pagination in `getAdminInventory`
> **Status: SOLVED** (verified 2026-09-25) - lowStockOnly is applied in the SQL query before .range() (admin.ts:625-629). Residual: the filter hardcodes 5 instead of each row low_stock_threshold.
- **Location:** `apps/web/lib/queries/admin.ts:527, 565-567`
- **Defect:**
  1. `getAdminInventory` executes database pagination first:
     ```ts
     query = query.order('inventory_count', { ascending: true }).range(offset, offset + limit - 1);
     const { data, count, error } = await query;
     ```
  2. Then it filters for low-stock items in memory:
     ```ts
     const filtered = lowStockOnly ? items.filter((i) => i.isLowStock || i.isOutOfStock) : items;
     const totalCount = count || filtered.length;
     const totalPages = Math.ceil(totalCount / limit) || 1;
     ```
- **Impact:** When filtering for low-stock items (`lowStockOnly=true`), page 1 may show only 2 items (out of 25 queried), while `totalPages` and `totalCount` reflect the entire unfiltered catalog. Page 2 might show 0 items, while Page 3 has items. Database pagination is completely broken when low-stock filtering is active.
- **Recommended Fix:** Apply the low-stock condition directly in the PostgreSQL query before `.range()`:
  ```ts
  if (lowStockOnly) {
    query = query.or('inventory_count.lte.low_stock_threshold,inventory_count.eq.0');
  }
  ```

---

### N8. Header Inventory Metrics Only Sum the First 25 Paginated Items
> **Status: SOLVED** (verified 2026-09-25) - inventory KPI cards now use global aggregates over all active variants (admin.ts:599-610, 682-683) instead of the current page slice.
- **Location:** `apps/web/app/admin/inventory/page.tsx:34-35, 53-61`
- **Defect:** The KPI cards at the top of `/admin/inventory` display:
  - "Tracked SKUs: {totalCount}" (correct database count)
  - "Total Units: {totalUnits}" (calculated from `inventory.reduce(...)`)
  - "Low Stock: {lowStockCount}" (calculated from `inventory.filter(...)`)
  `inventory` is only the current page's slice (default 25 items).
- **Impact:** If the warehouse has 120 SKUs and 10,000 units, the dashboard displays "Tracked SKUs: 120" next to "Total Units: 340", displaying false warehouse inventory statistics.
- **Recommended Fix:** Fetch global aggregate counts (`sum(inventory_count)`, `count(low_stock)`) using a dedicated SQL aggregate query or RPC function.

---

### N9. Customer-Facing Tracking Page Leaks Raw Carrier Status & Hub Locations
> **Status: SOLVED** (verified 2026-09-25) - order-status sanitizes every event through sanitizeTrackingEvent and renders only customer-facing fields (page.tsx:193-218); raw_status is dropped from the API response.
- **Location:** `apps/web/app/(public)/order-status/[id]/page.tsx:194, 197, 203`
- **Defect:** In the shipment activity timeline:
  ```tsx
  <div className="text-xs font-semibold text-neutral-900">
    {event.customer_facing_status || event.status}
  </div>
  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
    {event.description}
  </p>
  {event.location && <span>. {event.location}</span>}
  ```
  If `customer_facing_status` is empty, it falls back to raw carrier `status`. Furthermore, it renders `event.description` and `event.location` directly from the database row without passing through `sanitizeTrackingEvent`.
- **Impact:** If unmasked carrier events (e.g. "Mumbai Air Cargo Hub", "Delhi Export Terminal", "Customs Inspection") are written to the database, they are displayed verbatim on the public tracking portal, defeating the core stealth origin masking requirement.
- **Recommended Fix:** Always run tracking events through `sanitizeTrackingEvent` or display strictly sanitized fields (`customer_facing_status`, `customer_facing_description`, `customer_facing_location`), never falling back to unmasked carrier fields.

---

### N10. Race Condition Between Stripe Webhook and Client Order Creation
> **Status: NOT SOLVED** (verified 2026-09-26) - the webhook now returns 409 (retry) instead of 200 when no order matches, so Stripe redelivers while the client is still creating the order, but there is still no metadata-driven order creation or reconciliation queue: if the browser never completes POST /api/orders/create, the charge exists with no order and nothing creates it.
- **Location:** `apps/web/app/api/webhooks/stripe/route.ts:42-53` and `apps/web/app/api/orders/create/route.ts:77-85`
- **Defect:** Stripe's `payment_intent.succeeded` webhook fires asynchronously upon card authorization. In `route.ts:45-51`:
  ```ts
  await supabaseAdmin
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('payment_intent_id', paymentIntent.id);
  ```
  If the webhook arrives before the client browser invokes `POST /api/orders/create`, the `UPDATE` statement updates 0 rows and returns 200 OK. If the customer closes the browser, loses internet connection, or encounters a client error before `orders/create` completes, the order is never inserted into the database.
- **Impact:** Customers are charged on Stripe without an order ever existing in the database. Customer support receives complaints about missing receipts and missing orders that cannot be found by order lookup.
- **Recommended Fix:** Handle order fulfillment idempotently: attach full checkout payload in Stripe PaymentIntent metadata, and allow the `payment_intent.succeeded` webhook to insert the order if it does not yet exist, or record successful charges in a reconciliation queue.

---

### N11. Double Discount Flaw for `FREESHIP` Promo Code in Checkout Breakdown
> **Status: SOLVED** (verified 2026-09-25) - the shared calculation zeroes the FREESHIP fixed discount (checkout.ts:56-58) and migration 05 sets discount_value = 0, so the double discount cannot occur.
- **Location:** `supabase/seed.sql:239`, `apps/web/lib/queries/orders.ts:97, 124`
- **Defect:**
  1. In `seed.sql`, `FREESHIP` is seeded as a fixed discount:
     ```sql
     ('FREESHIP', 'fixed', 599, 0, NULL, true, 'Free standard shipping on any order')
     ```
  2. In `validatePromoCode` (`orders.ts:97`), fixed discounts subtract from the product subtotal:
     `discountCents = Math.min(subtotalCents, promo.discount_value);` -> returns `599`.
  3. In `calculateCheckoutBreakdown` (`orders.ts:124`), `promo?.code === 'FREESHIP'` sets `shippingCents = 0`.
- **Impact:** Customers using `FREESHIP` receive **both** a $5.99 discount deducted from their items subtotal **and** $0.00 free shipping. A $10 order with $5.99 shipping ends up totaling ~$4.33 instead of $10.80, doubling the promotional cost to the business.
- **Recommended Fix:** Set `discount_value = 0` for `FREESHIP` in the database, or add a dedicated `'free_shipping'` discount type enum value in the schema.

---

### N12. Resend Email Fails in Production Due to Hardcoded Sandbox Sender Address
> **Status: PARTIAL** (verified 2026-09-26) - the from address is driven by RESEND_FROM_EMAIL (documented in .env.example with an `orders@your-domain.com` placeholder) and send failures are logged, but the variable is not set in apps/web/.env so the resend.dev sandbox fallback is still active locally, and there is still no retry/queue (see H14).
- **Location:** `apps/web/lib/email/resend.ts:152`
- **Defect:** `sendOrderConfirmationEmail` sends from:
  ```ts
  from: `${SITE_NAME} <orders@resend.dev>`
  ```
  Resend strictly prohibits sending emails from `resend.dev` to external recipient domains-it only delivers to the single email address associated with the Resend developer account.
- **Impact:** All order confirmation emails sent to real customers (`toEmail`) fail with a Resend 403 Forbidden API error in production. Because `orders/create/route.ts:91` uses a detached `.catch(...)` without checking the returned `{ success: false, error }`, this failure is silent and no receipts are delivered.
- **Recommended Fix:** Use a verified custom sender domain configured via `RESEND_FROM_EMAIL` environment variable (e.g. `orders@mail.rootapparel.com`) and log/handle API error responses.

---

### N13. Missing Unique Constraint on `orders.payment_intent_id` (Duplicate Order Risk)
> **Status: SOLVED** (verified 2026-09-25) - migration 05 adds a partial unique index on orders(payment_intent_id) (lines 67-69) plus an app-level pre-check in orders.ts:214-227. Same applied-to-DB caveat as C5.
- **Location:** `supabase/migrations/20260924000001_create_schema.sql:156`
- **Defect:** `payment_intent_id TEXT` on the `orders` table has no `UNIQUE` constraint or unique index.
- **Impact:** Rapid double-clicking of the payment button or client retries of `POST /api/orders/create` with the same `paymentIntentId` creates multiple distinct orders in the database for a single Stripe charge.
- **Recommended Fix:** Add a unique index to `orders(payment_intent_id)` where `payment_intent_id IS NOT NULL`, and enforce idempotency in `createOrderInDb`.

---

### N14. Dashboard Zero-Value Falsy Fallbacks Fabricate Metrics When Store Has 0 Orders
> **Status: SOLVED** (verified 2026-09-25) - the falsy-zero fallbacks were converted to ?? (admin.ts:102-106), so legitimate zeroes now display as zeroes (the fabricated catch-all remains tracked under C9).
- **Location:** `apps/web/lib/queries/admin.ts:100-104`
- **Defect:** Uses JavaScript `||` operator for numeric fallbacks:
  ```ts
  totalRevenueCents: totalRevenueCents || 1285000,
  totalOrders: totalOrders || 42,
  averageOrderValueCents: averageOrderValueCents || 8500,
  pendingShipments: pendingShipments || 5,
  lowStockCount: lowStockCount || 3,
  ```
  In JavaScript, `0 || 1285000` evaluates to `1285000`.
- **Impact:** When a store legitimately has 0 orders, 0 revenue, 0 low-stock items, or 0 pending shipments, the admin dashboard displays fabricated numbers ($12,850 revenue, 42 orders, 5 shipments) instead of 0.
- **Recommended Fix:** Use nullish coalescing `??` instead of `||`, ensuring legitimate zero values are preserved.

---

### N15. Soft-Deleted Products Leave Orphaned Variants Visible in Admin Inventory Matrix
> **Status: SOLVED** (verified 2026-09-25) - deleteAdminProduct now cascades is_active=false to child product_variants (admin.ts:546-560). Residual: that cascade result is not error-checked.
- **Location:** `apps/web/lib/queries/admin.ts:474-478, 521, 550`
- **Defect:** `deleteAdminProduct` only sets `products.is_active = false`. It does not deactivate associated `product_variants`. `getAdminInventory` queries `product_variants.eq('is_active', true)`.
- **Impact:** Variants belonging to soft-deleted products remain in the inventory list indefinitely, displayed with the placeholder title `"Unknown Product"`.
- **Recommended Fix:** Cascade soft-deletion by setting `is_active = false` on all child `product_variants` when a product is deactivated.

---

### N16. Lack of Duplicate Variant Quantity Aggregation in `verifyVariantStock`
> **Status: SOLVED** (verified 2026-09-25) - verifyVariantStock aggregates requested quantities per variantId before comparing against inventory_count (orders.ts:137-164).
- **Location:** `apps/web/lib/queries/orders.ts:164, 183-195`
- **Defect:** If an order payload contains the same `variantId` across multiple line items (e.g. split line items), `verifyVariantStock` checks each line item's quantity independently against `variant.inventory_count` instead of checking the sum of quantities for that variant.
- **Impact:** A buyer can bypass stock limits by submitting multiple separate line items for the same variant, causing overselling.
- **Recommended Fix:** Aggregate requested quantities by `variantId` before comparing against `inventory_count`.

---

### N17. Transitory Network Failures in Product Detail Page Cause Long-Cached 404s
> **Status: SOLVED** (verified 2026-09-25) - product/[slug] now rethrows database errors (page.tsx:69-72) instead of swallowing them into a cacheable notFound().
- **Location:** `apps/web/app/(public)/product/[slug]/page.tsx:69-74`
- **Defect:** In `ProductDetailPage`, the database fetch is wrapped in:
  ```ts
  try {
    productDetails = await getProductBySlug(supabase, slug);
  } catch {
    // Fallback if DB unavailable
  }
  if (!productDetails) notFound();
  ```
  If Supabase times out or encounters a temporary connection error, `productDetails` is null, which immediately triggers `notFound()`.
- **Impact:** Combined with `revalidate = 3600`, Next.js ISR may cache a 404 page for 1 hour for a valid product due to a momentary 500ms network blip during generation.
- **Recommended Fix:** Throw an error instead of swallowing the exception in `catch`, allowing Next.js to serve the stale cached version or return 500 rather than caching a false 404.

---

### N18. Mobile Catalog Queries Completely Bypass Supabase Backend
> **Status: SOLVED** (verified 2026-09-26) - fetchProducts/fetchProductById query live Supabase (products/categories/variants/images) whenever EXPO_PUBLIC_SUPABASE_URL is set, with the hard-coded catalog used only as an explicit env-absent fallback; orders go through /api/orders/create instead of a mock.
- **Location:** `apps/app/lib/queries/catalog.ts:638-650, 676-679, 685-790`
- **Defect:** `fetchProducts`, `fetchProductById`, and `fetchOrderDetails` operate entirely on hardcoded in-memory arrays (`FALLBACK_PRODUCTS`, mock order for "Alex Morgan"). No network requests are made to Supabase.
- **Impact:** The mobile app does not reflect any live inventory, new products, updated prices, or real user orders.
- **Recommended Fix:** Connect `fetchProducts` and `fetchProductById` to live Supabase queries using the Supabase client, matching web functionality.

---

### N19. Single Source of Truth Gap for Checkout Breakdown (Multiple Divergent Copies)
> **Status: SOLVED** (verified 2026-09-25) - duplicate of H1: the shared checkout.ts is now the single breakdown source consumed by web checkout, web cart, mobile cart and the server.
- **Location:**
  - `apps/web/lib/queries/orders.ts:110-147` (Server calculation)
  - `apps/web/app/(public)/checkout/page.tsx:53-63, 122-143` (Web checkout copy)
  - `apps/web/app/(public)/cart/page.tsx:43-49` (Web cart copy)
  - `apps/app/lib/store/cart.ts:149-170` (Mobile cart copy)
  - `packages/shared/src/utils/` (Missing shared implementation)
- **Defect:** The core e-commerce financial calculation (`calculateCheckoutBreakdown`) is implemented independently in 4 different places with divergent tax bases, discount formulas, and shipping conditions.
- **Impact:** Customers see different totals on cart vs. checkout vs. mobile vs. server receipt.
- **Recommended Fix:** Export `calculateCheckoutBreakdown` from `@repo/shared/utils` and consume it universally across all client and server code.

