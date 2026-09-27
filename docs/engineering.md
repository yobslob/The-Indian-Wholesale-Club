# Engineering: performance, tests, layout, conventions

Stack (kept, D-015): Turborepo + pnpm · Next.js (storefront + admin) · Expo (app) · Supabase · Stripe · Resend · Tailwind /
NativeWind · zustand · zod. Exact versions: each `package.json` (don't restate them here).

## Diagnosis of the old code's slowness (D-011)
From reading baseline `d5342ae` on 2026-09-27. **Timings are not measured yet** (npm is blocked for Claude, D-021).
Baseline numbers come from the founder's first `node scripts/check.mjs` run and get recorded in `plan/current.md`.
| # | Cause | Where |
|---|---|---|
| P1 | Middleware runs on almost every request and calls `supabase.auth.getUser()`, a network call to Supabase Auth, for signed-in users on every page, API call and navigation | `apps/web/middleware.ts`, `apps/web/lib/supabase/middleware.ts:29` |
| P2 | Storefront pages build the Supabase client via `cookies()`, which forces dynamic rendering. Their `revalidate = 3600` therefore never applies, and every page view hits the DB | `apps/web/lib/supabase/server.ts:9`, used by `app/(public)/page.tsx:32` etc. |
| P3 | Query waterfalls + over-fetching. The product page fetches the product twice (metadata l.20-21 and page l.52-53), then variants/images/category, then related products (l.56), then their images (l.63): about 6 round trips, 4 of them sequential. The category page is 4 sequential, the home page 2. `select('*')` everywhere, `count: 'exact'` on lists | `apps/web/app/(public)/product/[slug]/page.tsx`, `apps/web/app/(public)/category/[slug]/page.tsx`, `apps/web/lib/queries/products.ts` |
| P4 | A Framer Motion page transition wraps every storefront page: client JS everywhere, delayed first paint | `app/(public)/layout.tsx:14` |
| P5 | In dev, the machine is in India and the DB is in the US (the old docs said US-East, unverified), so every round trip above is intercontinental | — |
| P6 | Tests don't test behaviour. The "RLS tests" assert on migration SQL *text*, and they passed while customers could edit their own orders. Route tests mock the DB | `apps/web/tests/rls-and-triggers.test.ts` (deleted in R3, replaced by `supabase/tests/`) |
| P7 | `next build` re-runs ESLint and the type-check after turbo already ran them (not disabled in `next.config.js`). Cost to be measured | `apps/web/next.config.js` |
| P8 | (correctness) The rate limiter is an in-memory `Map`: per instance, reset on cold start, ineffective on serverless | `apps/web/lib/rate-limit.ts:14` |

## Performance rules (apply from R5 on)
- **PR-1 Cacheable storefront:** storefront reads use a cookie-less anon client with no `cookies()`. They are cached and tagged, and admin publish
  calls `revalidateTag`. Only cart, checkout, account and order pages are dynamic.
- **PR-2 One round trip per page:** each storefront page or endpoint gets its data from one `store_*` view or function returning exactly
  what it renders. Checkout allows at most 2.
- **PR-3 No over-fetching:** explicit column lists, never `select('*')`, no `count: 'exact'` on customer paths.
- **PR-4 Narrow middleware:** runs only on `/admin`, `/account`, `/checkout`, `/api/admin` and the auth callback. Prefer local JWT
  verification (`getClaims()` with asymmetric signing keys) over a `getUser()` network call. Confirm SDK support in R5.
- **PR-5 Server-first:** Server Components by default. Client components only for real interaction (add to cart, variant
  picker, live stock). No animation libraries on the storefront.
- **PR-6 Assets:** `next/image` with explicit `sizes`. Fonts via `next/font`, subset. Script fonts only on their region page.
- **PR-7 Realtime only where it matters:** product availability, and the admin orders/stock feed.
- **PR-8 Dependencies cost:** every new dependency is justified in its commit message (size + reason).

**Budgets (targets. Verified only by `check.mjs` numbers, never by assumption):**
DB round trips per page: storefront ≤ 1, checkout ≤ 2 · storefront first-load JS ≤ 150 KB gzip · cached storefront
response ≤ 100 ms on a local production build · `turbo build --filter=web` ≤ 2 min clean · typecheck + lint ≤ 60 s · unit tests ≤ 15 s.

## Testing strategy (replaces the old suites)
A test must **fail when the rule it protects breaks**. Never assert on source-code or SQL text.
| Layer | Tool | What | Where |
|---|---|---|---|
| Unit | `node:test` via `tsx` (D-037) | pure logic: pricing, delivery window, status labels, attribute schemas, token preset | `packages/shared/tests`, `packages/tokens/tests` |
| DB | plain SQL (`supabase/tests/*.test.sql`), run by `check.mjs db` → `scripts/db-test.mjs` against local Supabase (D-031) | invariants INV-1…INV-9 and the business functions, as anon / customer / admin (`request.jwt.claims`), each file rolled back | `supabase/tests/` |
| E2E smoke | Playwright | (1) region → product → cart → checkout (Stripe test card) → order page · (2) admin sign-in → list product → publish → visible on the storefront · (3) a customer gets 404 on `/admin`, and page source has no vendor fields | `apps/web/e2e` |
The old suites (stealth, SQL-text RLS, mocked routes) are deleted in R2/R3/R7. Everything runs through `node scripts/check.mjs`.

**Claude can verify SQL itself:** its sandbox has plain PostgreSQL 16 but no Docker/npm. `supabase/tests/_stub/supabase_stub.sql`
emulates the few Supabase pieces the schema needs (roles, `auth.uid()`, storage tables, realtime publication). Apply stub →
migrations → seeds → `_helpers.sql` → each `*.test.sql` with `psql -v ON_ERROR_STOP=1`. After adding a test, break the rule
on purpose and confirm the test fails (mutation check). The founder's run on real local Supabase (Postgres 15) is still
the evidence of record. Keep SQL PG15-compatible.
**Claude can type-check too:** the founder's `node_modules/.pnpm` holds real package folders (TypeScript 5.9.3, supabase-js
2.117.1, zod, @types/node). Claude copies their type definitions into its sandbox and runs the repo's own `tsc` on
`packages/*`. Until `pnpm db:types` has been run, Claude type-checks `@repo/db` against an approximate
`database.types.ts` generated from its local Postgres (not committed; the official file replaces it).
**Migrations:** never edit an applied migration. Every new function gets explicit grants (Supabase grants all by default), or `schema.test.sql` fails.

## Layout (target)
```
apps/web/app/(store)/…     customer routes (storefront.md)       apps/web/app/admin/…   hidden admin (admin.md)
apps/web/features/<name>/  regions, catalog, cart, checkout, orders, account, admin/<section>
apps/web/components/ui/    design-system primitives only          apps/web/lib/          infra: supabase, stripe, email, auth, log
apps/app/app/(customer)/…  customer tabs                           apps/app/app/(admin)/… admin mode (lazy)
packages/db       generated DB types (`pnpm db:types`) + typed queries: store/* (customer-safe, zod) · admin/* · server/*
packages/shared   pure domain logic + zod schemas (no I/O)         packages/tokens  design tokens → Tailwind + NativeWind
supabase/migrations  one baseline (R3) + small increments          supabase/seed/  regions, categories, demo (dev only)
```

## Code conventions
- Names come from `glossary.md`. One concept = one word across DB, code, routes.
- **Import boundaries (lint-enforced):** storefront code and customer app screens can't import `features/admin`,
  `app/admin` or `@repo/db/admin`. Server-only modules start with `import 'server-only'`.
- Validate with zod at every boundary (forms, API input, JSON attributes). No `any`. Files ≤ ~250 lines. Split by feature.
- Money: integers (`*_cents`, `*_paise`). Time: `timestamptz`, ISO strings in JSON.
- Errors: structured logger (`lib/logger.ts`, kept). User-facing messages are generic. No silent `.catch(() => {})`.
- Every commit leaves typecheck + lint + tests green (verified by `check.mjs` at step boundaries).

## Tooling changes (planned, measure first)
Test runner stays `node:test` + `tsx` (D-037: baseline test step 1.8 s, no new dependency). Remove the duplicate lint and type-check from `next build` once turbo runs them in CI. If
the baseline shows lint is slow, evaluate Biome as a *proposal* (needs a decision entry). CI runs `check.mjs`-equivalent steps.
