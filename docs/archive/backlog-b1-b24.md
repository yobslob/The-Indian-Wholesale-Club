# Backlog

Known problems and deferred work. The source is marked so nothing is taken on trust:
`[code]` = Claude verified it in the code on the date given · `[audit]` = from the old BUGS.md/findings.txt (removed in R1,
recoverable from tag `pre-restructure`), not re-verified.

## Carried over from the old codebase
| ID | Item | Source | Resolved in |
|---|---|---|---|
| B-1 | RLS lets signed-in customers UPDATE/DELETE their own orders (incl. `status`, `payment_status`), order items and tracking events | [code] 2026-09-27, `supabase/migrations/20260926000007_backend_hardening.sql` | ✅ R3 in the new schema (INV-2, tested). Old hosted DB keeps the hole until the R5 reset |
| B-2 | Oversell race: stock is read (`app/api/orders/create/route.ts:57` → `verifyVariantStock`), then the order is written (l.194) and a trigger deducts without a lock, clamping with `GREATEST(0, …)` | [code] 2026-09-27, `20260925000005_fix_triggers_and_constraints.sql` | ✅ R3 `create_order` (INV-3, tested). App switches to it in R5 |
| B-3 | Rate limiter is an in-memory `Map` (per instance, resets on cold start). Login (Supabase Auth, its own limits) and search are not limited by us | [code] `apps/web/lib/rate-limit.ts` (R5: applied inside checkout, orders and guest lookup) | ✅ C8 (migration 21: `rate_limit_hit`, shared across instances, IP kept only as a keyed hash; in-memory fallback) |
| B-4 | `GET /api/orders/[id]` returns 404 before the auth check (reveals whether an order exists) | [audit] | ✅ R5: route deleted. `/orders/[number]` shows an order only to its owner or after the email check, with one answer for "wrong email" and "no such order" |
| B-5 | Dev payment simulator: fake `mock_pi_` intents, `stripe_simulator` provider value | [code] `app/api/checkout/create-intent/route.ts:137`, `packages/shared/src/schemas/index.ts:82` | ✅ gone with R2 (checked 2026-10-07: no `mock_pi_` or `stripe_simulator` left in the code) |
| B-6 | Wishlist is localStorage-only, the `wishlists` table is unused | [audit] | ✅ R5: web "Save for later" writes `wishlists` (`/account/saved`); since 2026-10-07 the heart shows an already-saved state and a second tap removes it |
| B-7 | Search has no full-text index | [audit] | ✅ R3 (`products.search` + GIN index). Used from R5 |
| B-8 | No alerting / dead-letter for server errors beyond logs | [audit] | ✅ C8 (migration 22: `admin_attention`, Today shows recent server errors, payments to check and stuck emails; errors were already stored in `admin_error_events`) |
| B-9 | Mobile app on Expo SDK 52 (old). It forces workarounds: pnpm hoisting (`.npmrc`), Stripe pinned to 0.38.6 (Expo Go 52's native module; it was `^0.78.0`), `query-string` declared for expo-router 4.0 | [code] 2026-09-29 `apps/app/package.json`, `.npmrc` | coding phase (separate upgrade step; then drop the workarounds) |
| B-10 | Mobile `apps/app/lib/queries/catalog.ts` (857 lines) duplicates web queries with a hard-coded fallback catalog | [code] | ✅ R6: deleted; the app reads `@repo/db/store` |
| B-11 | 996-line hand-written DB types | [code] `packages/shared/src/types/index.ts` | ✅ R4 generated types; R6 deleted the old types, schemas, utils and constants with their tests |
| B-12 | `apps/web/lib/queries/admin.ts` is 1,022 lines | [code] | ✅ R5: deleted; admin data access is `@repo/db/admin` + `features/admin/actions/*` |
| B-13 | Tests don't test behaviour (SQL-text RLS "tests", mocked routes) | [code] `apps/web/tests/rls-and-triggers.test.ts` | ✅ R3 DB invariant tests (mutation-checked), R4–R7 unit tests, R7 Playwright E2E + app bundle check (`engineering.md` §Testing) |
| B-14 | Privilege escalation: the old "update own profile" RLS policy had no column limits, so any signed-in user could set `profiles.role = 'admin'`. The old admin guard accepted role **or** allowlisted email, which gave full admin API access | [code] 2026-09-28, baseline `20260924000002_create_rls_policies.sql` + `apps/web/lib/auth/admin.ts` | ✅ R3: column grants (users edit only name/phone) + `is_admin()` needs the allowlist (tested). App guard needs role **and** `ADMIN_EMAILS`. The old hosted DB keeps the policy until R5 |

| B-15 | CI (`.github/workflows/ci.yml`) builds the web against the hosted DB secrets; since R5 the build reads the DB (static pages), so CI needs the new schema there | [code] 2026-09-28 | ✅ R7: CI runs `check.mjs` on a local Supabase in the runner (no hosted DB, no DB secrets) |
| B-16 | The app's bag lives in memory only: closing the app empties it (the web keeps it in the browser) | [code] 2026-09-28, `apps/app/features/cart/store.ts` | ✅ C8 (the bag persists on the device with AsyncStorage, unit-tested) |
| B-17 | App admin writes go straight to the DB, so they can't refresh the website's cache; the storefront shows them within the 5-minute fallback | [code] 2026-09-28 (`admin.md` §Access model) | ✅ C8 (`POST /admin/revalidate`, admin bearer only; the app calls it after every admin write) |
| B-18 | The app's "Save" button doesn't show an already-saved state (same as the web, B-6) | [code] 2026-09-28 | ✅ 2026-10-07: shows it, a second tap removes it |
| B-19 | Nothing happens at a cycle's `cutoff_at`: orders keep joining the open cycle until an admin runs the cutoff, and the store keeps showing the past "order by" date | [code] 2026-09-29 (R8 audit), `create_order`, `store_next_delivery` | ✅ C4 4.1 (migration 13, D-045, D-063; `cycle_roll.test.sql`) |
| B-20 | Only the order-confirmation email exists; shipped, delivered, item-unavailable/refund, cancellation and delay emails are not built | [code] 2026-09-29 (R8 audit), `packages/db/src/server/checkout.ts` `EmailKind` | ✅ C5 5.1 (migration 17, `customer_messages.test.sql`, `order-update.test.ts`) |
| B-21 | PR-2 says checkout makes at most 2 DB round trips; since B-3's shared limiter it makes 3 (`rate_limit_hit`, `checkout_context`, `pending_orders`), plus an Auth call for an app token. Either the budget says 3 or the limit is counted inside `checkout_context` | [code] 2026-10-06 (speed audit), `apps/web/app/api/checkout/route.ts` | founder: which is preferred (no behaviour change either way) |
| B-22 | The live stock feed uses Realtime `postgres_changes`, which checks the read policy (`is_product_visible`) once per open product page for every change: fine now, the documented limit as audiences grow. Move to Realtime Broadcast from the stock trigger when product pages have hundreds of viewers at once | [code] 2026-10-06 (speed audit), `features/catalog/use-live-availability.ts` (web, app) | when traffic needs it |
| B-23 | `search_queries` keeps every search forever and Insights' "all time" reads all of it. Needs a retention period (a founder decision: how long are searches useful?) and then a nightly delete | [code] 2026-10-06 (speed audit), migration 20 | founder |
| B-24 | Review photos (`review-media`) are shown as uploaded on the app (64-point thumbnails); they could go through the same resizer as product photos (D-068) | [code] 2026-10-06, `apps/app/features/reviews/reviews-section.tsx` | coding phase (few photos today) |

## Deferred features (need a question answered or founder approval)
| ID | Item | Blocked by |
|---|---|---|
| F-1 | US shipping labels / carrier integration | Q-3 |
| F-2 | Stripe Tax instead of the flat 8% estimate | founder decision (D-033) |
| F-3 | Offline drafts for field listing on weak networks | coding phase |
| F-4 | Returns / exchanges flow | Q-5 |
| F-5 | Faster-delivery option (US stock or express) | founder decision (D-024) |
| F-6 | "Ask for it from home" requests, notify-me, gift boxes (reviews: wanted, D-051, rules D-056, built in C1) | founder approval |
