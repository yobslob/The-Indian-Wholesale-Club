# Backlog

Known problems and deferred work. The source is marked so nothing is taken on trust:
`[code]` = Claude verified it in the code on the date given · `[audit]` = from the old BUGS.md/findings.txt (removed in R1,
recoverable from tag `pre-restructure`), not re-verified.

## Carried over from the old codebase
| ID | Item | Source | Resolved in |
|---|---|---|---|
| B-1 | RLS lets signed-in customers UPDATE/DELETE their own orders (incl. `status`, `payment_status`), order items and tracking events | [code] 2026-09-27, `supabase/migrations/20260926000007_backend_hardening.sql` | ✅ R3 in the new schema (INV-2, tested). Old hosted DB keeps the hole until the R5 reset |
| B-2 | Oversell race: stock is read (`app/api/orders/create/route.ts:57` → `verifyVariantStock`), then the order is written (l.194) and a trigger deducts without a lock, clamping with `GREATEST(0, …)` | [code] 2026-09-27, `20260925000005_fix_triggers_and_constraints.sql` | ✅ R3 `create_order` (INV-3, tested). App switches to it in R5 |
| B-3 | Rate limiter is an in-memory `Map` (per instance, resets on cold start). Login and search are unlimited | [code] `apps/web/lib/rate-limit.ts:14` + [audit] | coding phase (shared store) |
| B-4 | `GET /api/orders/[id]` returns 404 before the auth check (reveals whether an order exists) | [audit] | R5 (route rebuilt) |
| B-5 | Dev payment simulator: fake `mock_pi_` intents, `stripe_simulator` provider value | [code] `app/api/checkout/create-intent/route.ts:137`, `packages/shared/src/schemas/index.ts:82` | R2 |
| B-6 | Wishlist is localStorage-only, the `wishlists` table is unused | [audit] | coding phase (decide cross-device "Saved") |
| B-7 | Search has no full-text index | [audit] | ✅ R3 (`products.search` + GIN index). Used from R5 |
| B-8 | No alerting / dead-letter for server errors beyond logs | [audit] | coding phase |
| B-9 | Mobile app on Expo SDK 52 (old) | [code] `apps/app/package.json` | coding phase (separate upgrade step) |
| B-10 | Mobile `apps/app/lib/queries/catalog.ts` (857 lines) duplicates web queries with a hard-coded fallback catalog | [code] | R2 (fallback) + R4/R6 (shared queries) |
| B-11 | 996-line hand-written DB types | [code] `packages/shared/src/types/index.ts` | R4 (generated) |
| B-12 | `apps/web/lib/queries/admin.ts` is 1,022 lines | [code] | R5 (split by feature) |
| B-13 | Tests don't test behaviour (SQL-text RLS "tests", mocked routes) | [code] `apps/web/tests/rls-and-triggers.test.ts` | ◐ R3: DB invariant tests (real SQL, mutation-checked). SQL-text tests deleted. Unit (R4) + E2E (R7) pending |
| B-14 | Privilege escalation: the old "update own profile" RLS policy had no column limits, so any signed-in user could set `profiles.role = 'admin'`. The old admin guard accepted role **or** allowlisted email, which gave full admin API access | [code] 2026-09-28, baseline `20260924000002_create_rls_policies.sql` + `apps/web/lib/auth/admin.ts` | ✅ R3: column grants (users edit only name/phone) + `is_admin()` needs the allowlist (tested). App guard needs role **and** `ADMIN_EMAILS`. The old hosted DB keeps the policy until R5 |

## Deferred features (need a question answered or founder approval)
| ID | Item | Blocked by |
|---|---|---|
| F-1 | US shipping labels / carrier integration | Q-3 |
| F-2 | Stripe Tax instead of the flat 8% estimate | founder decision (D-033) |
| F-3 | Offline drafts for field listing on weak networks | coding phase |
| F-4 | Returns / exchanges flow | Q-5 |
| F-5 | Faster-delivery option (US stock or express) | founder decision (D-024) |
| F-6 | "Ask for it from home" requests, notify-me, gift boxes, reviews | founder approval |
