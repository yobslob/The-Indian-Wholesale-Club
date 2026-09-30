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

## Performance rules (apply from R5 on; where each lives in the web code since R5)
- **PR-1 Cacheable storefront:** storefront reads use a cookie-less anon client with no `cookies()`. They are cached and tagged, and admin publish
  calls `revalidateTag`. Only cart, checkout, account, order, search, login and signup pages are dynamic. *Web:* `lib/supabase/store.ts` +
  `features/catalog/data.ts` (`unstable_cache`, tag `store`, 5-minute fallback). Region pages are built at build time,
  product pages on first visit. So **`next build` reads the database** (the new schema must be there).
- **PR-2 One round trip per page:** each storefront page or endpoint gets its data from one `store_*` view or function returning exactly
  what it renders. Checkout allows at most 2.
- **PR-3 No over-fetching:** explicit column lists, never `select('*')`, no `count: 'exact'` on customer paths.
- **PR-4 Narrow middleware:** runs only on `/admin`, `/account`, `/checkout` and `/orders` (`apps/web/middleware.ts`; there
  are no admin API routes). It uses `getClaims()`: a local JWT check with asymmetric signing keys, one Auth call with the
  legacy shared secret (local Supabase and old hosted projects use the shared secret). Rate limits run inside the routes.
- **PR-5 Server-first:** Server Components by default. Client components only for real interaction (add to cart, variant
  picker, live stock). No animation libraries on the storefront (framer-motion removed in R5) except Lenis smooth scrolling,
  which the founder asked for (D-049, `design.md` §Direction: one small client module, off for reduced motion). Fonts (D-050 – D-052):
  Helvetica Neue and Georgia as system fonts with self-hosted fallbacks (TeX Gyre Heros, Gelasio) that load only where the
  system font is missing; Poppins, Montserrat and Inter (footer only) via `next/font`, self-hosted and subset.
- **PR-6 Assets:** `next/image` with explicit `sizes`. Fonts via `next/font`, subset. Script fonts only on their region page.
- **PR-7 Realtime only where it matters:** product availability, and the admin orders/stock feed.
- **PR-8 Dependencies cost:** every new dependency is justified in its commit message (size + reason).

**Budgets (targets. Verified only by `check.mjs` numbers, never by assumption):**
DB round trips per page: storefront ≤ 1, checkout ≤ 2 · storefront first-load JS ≤ 150 KB gzip · cached storefront
response ≤ 100 ms on a local production build · `turbo build --filter=web` ≤ 2 min clean · typecheck + lint ≤ 60 s · unit tests ≤ 15 s.
**Enforced since C1:** the `http` step fails when a cached storefront page's median is over 100 ms (search and
`/api/health` read the DB per request and are exempt) or when any page's first-load JS is over 150 KB gzip, measured
from the script tags the page actually loads (`nomodule` polyfills skipped; lazily imported code not counted), so it
matches Next's own build table. The step times (build, typecheck, lint, tests) are recorded, not enforced: CI runners
are slower than the founder's machine and would fail at random.

## Testing strategy (replaces the old suites)
A test must **fail when the rule it protects breaks**. Never assert on source-code or SQL text.
| Layer | Tool | What | Where |
|---|---|---|---|
| Unit | `node:test` via `tsx` (D-037) | pure logic: pricing, delivery window, status labels, attribute schemas, token preset, the web's email/site/rate-limit helpers, the app's bag and checkout request | `packages/shared/tests`, `packages/tokens/tests`, `apps/web/tests`, `apps/app/tests` |
| DB | plain SQL (`supabase/tests/*.test.sql`), run by `check.mjs db` → `scripts/db-test.mjs` against local Supabase (D-031) | invariants INV-1…INV-9 and the business functions, as anon / customer / admin (`request.jwt.claims`), each file rolled back | `supabase/tests/` |
| E2E smoke | Playwright (`check.mjs e2e`, after `build`) | (1) region → product → bag → checkout (Stripe test card) → thank-you → order page after the email check · (2) admin sign-in → new listing → variant → publish → visible on the storefront · (3) signed out, `/admin` → its sign-in page with `noindex`; a signed-in customer gets a plain 404 (no "admin" in page or title); no admin link, robots or sitemap entry; customer pages carry no vendor, cost or cycle fields · (4) motion and keyboard (C1): with reduced motion no Lenis, nothing hidden, no parallax; with motion Lenis runs and a card below the fold reveals when scrolled to; skip link first, the hidden Home logo shows when focused, Pick your home search + focus highlight, product page +/− and heart by keyboard | `apps/web/e2e` |
| App bundle | Expo CLI (`check.mjs bundle`) | the app bundles for Android and iOS: every import resolves in Metro and every file compiles with Babel (bugs `tsc` can't see) | `apps/app` |

The E2E run starts its own production server (`next start`, port 3101) and refuses anything but local Supabase and
Stripe test keys (`apps/web/e2e/env.ts`). Its setup creates two local accounts (`e2e-admin@iwc.test`, an admin for that
server process only, and `e2e-customer@iwc.test`) and tops up the demo product's stock; teardown archives the products
it listed. Without Stripe test keys the checkout flow is skipped, not failed. The old suites (stealth, SQL-text RLS,
mocked routes) are deleted. Everything runs through `node scripts/check.mjs`, and CI runs the same script (§Tooling).

**Claude Code on the founder's machine** runs all of this directly: `node scripts/check.mjs` is the one command.
The two paragraphs below describe how a **cloud-sandbox session** (no npm, no Docker) verified work before that.

**Cloud sandbox, SQL:** its sandbox has plain PostgreSQL 16 but no Docker/npm. `supabase/tests/_stub/supabase_stub.sql`
emulates the few Supabase pieces the schema needs (roles, `auth.uid()`, storage tables, realtime publication). Apply stub →
migrations → seeds → `_helpers.sql` → each `*.test.sql` with `psql -v ON_ERROR_STOP=1`. After adding a test, break the rule
on purpose and confirm the test fails (mutation check). The founder's run on real local Supabase (Postgres 15) is still
the evidence of record. Keep SQL PG15-compatible.
**Cloud sandbox, TypeScript and lint:** the founder's `node_modules/.pnpm` holds real package folders. Since R5 Claude copies
the web's whole dependency closure (computed from `pnpm-lock.yaml`), rebuilds the pnpm links in its sandbox and runs the
repo's own `tsc` (web, app, packages) and ESLint (web, app), runs the unit tests with its own `tsx`, bundles the app with
the repo's Expo CLI and loads the Playwright specs (`playwright test --list`). Not possible there: `next build` (no Linux
SWC binary), so no E2E run, and running the app on a device: the founder's runs are the evidence for those. The founder's `check.mjs`
stays the evidence of record. After a migration, Claude patches `database.types.ts` by hand to match and the founder's
`pnpm db:types` regenerates it (the diff should be formatting only).
**Migrations:** never edit an applied migration. Every new function gets explicit grants (Supabase grants all by default), or `schema.test.sql` fails.

## Layout (web: actual since R5; app: actual since R6)
```
apps/web/app/(store)/…     customer routes (storefront.md)       apps/web/app/admin/…   hidden admin (admin.md)
apps/web/features/<name>/  shell (header, footer), home, catalog, regions (incl. the India map), cart, checkout,
                           orders, account, auth, info, admin (guard, actions, ui)
apps/web/lib/              infra: env, supabase (store / session / browser / service clients), stripe, email, logger, rate limit
apps/app/app/(customer)/…  customer tabs; region/, product/, checkout, order/, auth/, addresses (storefront.md)
apps/app/app/admin/…       admin mode, mounted only after is_admin() (admin.md)
apps/app/features/<name>/  home, regions, catalog, reviews, cart, checkout, orders, auth, admin
apps/app/lib/              supabase, api, session, use-query, fonts, stripe (+ web stand-ins)
packages/db       generated DB types (`pnpm db:types`) + typed queries: store/* (customer-safe, zod) · admin/* · server/*
packages/shared   pure domain logic + zod schemas (no I/O)         packages/tokens  design tokens → Tailwind + NativeWind
supabase/migrations  one baseline (R3) + small increments          supabase/seed/  regions, categories, demo (dev only)
scripts/build-india-map.mjs  regenerates packages/shared/src/india-map/india-map.json (web + app) from DataMeet's boundaries (D-052)
```

## App specifics (since R6)
- The app calls the website's server for anything that needs a secret (D-043): checkout, order confirmation, guest order lookup
  (`apps/app/lib/api.ts` → `EXPO_PUBLIC_API_URL`). A signed-in user's access token goes along as `Authorization: Bearer`,
  verified on the server only to link the order to the account (`apps/web/lib/request-user.ts`). The HTTP contract is typed
  once in `packages/shared/src/domain/checkout-api.ts`.
- Metro resolves `@repo/<pkg>/<entry>` through each package's `exports` (`apps/app/metro.config.js`), because the packages
  ship TypeScript sources. The same file maps `@/…` to the app folder and sends every `react`, `react-dom` and
  `react-native` import to the app's own copy: the web uses React 19, the app React 18, and a bundle must hold one React.
- Metro's tsconfig-paths support is off (`app.json` `experiments.tsconfigPaths`): the app's `tsconfig.json` maps `react`
  to its React 18 type package for `tsc`, and Metro would follow that mapping to a package with no code.
- pnpm hoists every package to the root `node_modules` (`.npmrc` `shamefully-hoist=true`): Expo SDK 52's own packages load
  packages they don't declare (`babel-preset-expo`, `expo-asset`, `@babel/plugin-transform-react-jsx`), and expo-router 4.0
  needs `query-string`, which newer React Navigation no longer installs (so the app declares it).
- Expo Router typed routes are off (they need files generated by a dev-server run); hrefs are plain strings.
- Claude bundles the app in its sandbox with the repo's own Expo CLI (`expo export --platform android|ios`), using the
  app's dependency closure copied from the founder's `node_modules/.pnpm` and root-level links that mimic the hoisting.
  Its sandbox has no Linux build of `lightningcss`, so CSS comes out empty there: the check proves that every import
  resolves and compiles, not how screens look.
- Screens load data with `lib/use-query.ts` (one `@repo/db` call per screen, pull to refresh) and never show raw errors to
  customers; admin screens show the SQL refusal code (`features/admin/use-action.ts`).
- **Look and motion (C1 1.4):** the same tokens and font roles as the website (`tailwind.config.js`, `lib/fonts.ts`). A
  native font file is one weight, so weights are classes (`font-ui-semibold`). iOS uses its built-in Helvetica Neue and
  Georgia; Android loads TeX Gyre Heros (`assets/fonts`) and Gelasio. The splash screen stays until the fonts are loaded.
  Motion is Reanimated (Home hero word fade on scroll, cards fading in), off when the phone asks for reduced motion.
  The India map is shared with the website (`@repo/shared/india-map`) and drawn with `react-native-svg`.
- **Web preview** (`.claude/launch.json` `app-web`, port 8081): lets Claude check screens in a browser. It is not a
  product. `lib/stripe.web.tsx` and `lib/auth-storage.web.ts` stand in for Stripe and the keychain there (payment works only
  on phones). The preview reads local Supabase (`127.0.0.1`) instead of the phone's LAN address in `.env`. Two traps:
  a platform file must share its sibling's extension (`stripe.tsx` + `stripe.web.tsx`), because Metro tries every
  platform variant of one extension before the next extension; and `nativewind/theme`'s `platformSelect` gives no CSS on
  web, so `tailwind.config.js` gives the web a plain font stack.

## Code conventions
- Names come from `glossary.md`. One concept = one word across DB, code, routes.
- **Import boundaries (lint-enforced):** storefront code and customer app screens can't import `features/admin`,
  `app/admin` or `@repo/db/admin` (`no-restricted-imports` overrides in `apps/web/.eslintrc.js` and
  `apps/app/.eslintrc.js`; the app also blocks `@repo/db/server`). Server-only modules
  start with `import 'server-only'` (Next.js resolves it; never import such a module from a unit test). A `'use client'`
  module's exports are client references on the server: shared constants live in plain modules (e.g. `features/cart/limits.ts`).
- Validate with zod at every boundary (forms, API input, JSON attributes). No `any`. Files ≤ ~250 lines. Split by feature.
- Money: integers (`*_cents`, `*_paise`). Time: `timestamptz`, ISO strings in JSON.
- Errors: structured logger (`lib/logger.ts`, kept). User-facing messages are generic. No silent `.catch(() => {})`.
- Every commit leaves typecheck + lint + tests green (verified by `check.mjs` at step boundaries).

## Tooling (since R7)
- `node scripts/check.mjs` runs, in this order: docs (`scripts/docs-audit.mjs`: paths, decision ids, routes, schema, env
  vars in the docs still match the code), typecheck, lint, unit tests, `db` (local reset + SQL tests), build, http
  (route timings), e2e, bundle. The founder runs it; **CI runs the same script** on every push and pull request to `main`
  (`.github/workflows/ci.yml`) against a throwaway local Supabase in the runner, so CI needs no database secrets
  (Stripe test keys are optional repository secrets; without them the checkout flow is skipped).
- `next build` no longer repeats lint and typecheck (`apps/web/next.config.js`; they ran twice, P7). CI is the gate: never
  deploy a commit whose CI run isn't green.
- Deploys are manual (`.github/workflows/deploy.yml`, D-044): migrations to production, the Vercel hook, EAS builds without
  store submission.
- Test runner stays `node:test` + `tsx` (D-037: baseline test step 1.8 s, no new dependency). Biome stays a possible
  *proposal* only if lint time becomes a problem (it needs a decision entry).
