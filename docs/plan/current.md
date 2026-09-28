# Current status

## Resume here
**R6 (app reshape):** the founder's `check.mjs` on `b0a00cd` is all green and the web works. The app did not bundle
on the founder's machine (Expo SDK 52 + pnpm's strict layout, see the log). The fix (pnpm hoisting, Metro resolver, pinned
Stripe, missing dependencies) is committed and bundles for Android and iOS in Claude's sandbox. **Waiting on the founder:**
the clean reinstall and the phone smoke test at the bottom. The hosted dev DB reset is still pending (announced there).
Next after that: R7 (tests, tooling, CI).

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done | commit `d5342ae`, tag `pre-restructure`. Baseline timings recorded 2026-09-28 (log) |
| R1 Docs system | ✅ done, approved (D-023) | |
| R2 Remove dead paths | ✅ done | commit `c22656b`. One leftover (unused `Ionicons` import in the app) was caught by the founder's run and fixed in the R4 fix commit |
| R3 DB baseline | ✅ done | commit `96b964c`. Applied and tested on real local Supabase (log) |
| R4 Packages | ✅ done | commit `7d7c525` + fix commit (generated `database.types.ts`, lockfile, `check.mjs --continue`) |
| R5 Web reshape + speed | ✅ done (founder run 2026-09-28; typecheck fix in the R5 close commit) · hosted dev DB reset still pending | sub-steps below |
| R6 App reshape | ◐ code committed · founder `check.mjs` green (2026-09-29) · app bundling fix committed, phone smoke test pending | sub-steps below |
| R7 – R8 | not started | — |

## Verification log (facts only. Add a row per run)
| Date | Commit | Who / where | What | Result |
|---|---|---|---|---|
| 2026-09-28 | `11127d8` (old app code) | founder, Windows 11, 16 CPU, 16 GB, Node 24.19, pnpm 9.12 | **baseline** `check.mjs typecheck lint test build http` (`.checks/baseline.json`) | typecheck OK 9.1 s · **lint FAIL** 21.9 s (1 import/order warning in `apps/app/app/(tabs)/profile.tsx`; turbo stopped, so web lint was not reported) · test OK 1.8 s · build OK 45.8 s · pages (prod build, median of 3): `/` 428 ms, `/shop` 420 ms, `/search` 398 ms, `/api/search` 414 ms, `/api/health` 239 ms |
| 2026-09-28 | `96b964c` | founder, local Supabase (Postgres 15.8.1.085) | `npx supabase start` | baseline migration + all 3 seeds applied, no errors |
| 2026-09-28 | R3 | Claude, PostgreSQL 16.13 + stub | 7 SQL test files, 99 assertions. Mutation check: 15 rule breaks | all pass. All 15 breaks caught |
| 2026-09-28 | R4 | Claude, PostgreSQL 16.13 + stub | **8 SQL test files, 129 assertions** (with and without `demo.sql`). Mutation check on the new store functions: 9 breaks (base-table read, region-slug bypass, ownership bypass ×2, missing admin check, shop name in home, guest lookup: `cycle_id` leak, email ignored, internal events shown) | all pass. All 9 caught |
| 2026-09-28 | R4 | Claude, `tsc` 5.9.3 + supabase-js 2.117.1 + zod 3.25.76 types copied from the founder's `node_modules` | typecheck `packages/shared` (src + tests), `packages/db` (against approximate DB types) | 0 errors. This fixed 2 latent type errors in the old `checkout-calculator.test.ts` |
| 2026-09-28 | R4 | Claude, same | real store payloads (demo data) parsed with the `@repo/db/store` zod schemas | 6/6 payloads valid. An injected `vendor_id`/`shop_price_paise` is stripped |
| 2026-09-28 | R4 | Claude, Node 22 | unit tests: `packages/shared` (compiled with `tsc`), `packages/tokens` | 39/39 + 3/3 pass |
| 2026-09-28 | `7d7c525` (+ uncommitted generated types, lockfile) | founder, same machine, local Supabase running | `node scripts/check.mjs` (all steps) | typecheck **FAIL** 5.0 s and lint **FAIL** 5.4 s, both from one unused import in `apps/app/app/profile/orders/[id].tsx` (turbo stopped there, so web was not reported) · test OK 2.0 s · build OK 42.8 s · pages (old app vs hosted DB): `/` 420 ms, `/shop` 427 ms, `/search` 440 ms, `/api/search` 411 ms, `/api/health` 230 ms · **db OK 38.8 s: 8/8 SQL test files pass on real Supabase (Postgres 15)** |
| 2026-09-28 | R4 fix | Claude, `tsc` 5.9.3 | typecheck `packages/db` against the **official** generated `database.types.ts` | 0 errors |
| 2026-09-28 | R5 | Claude, PostgreSQL 16.13 + stub | **10 SQL test files, 160 assertions** (with and without `demo.sql`), incl. new `checkout.test.sql` (15) and `cycle_advance.test.sql` (16). Mutation check: 12 breaks (`checkout_context`: anon grant, customer grant, base-table variants, max uses ignored, expiry ignored, vendor_id leak, inactive promo; `advance_cycle`: no admin check, close with open orders, events visible, orders not moved, open advances) | all pass. All 12 caught |
| 2026-09-28 | R5 | Claude, real `tsc` 5.9.3 + ESLint 8.57.1 with the web's full dependency closure copied from the founder's `node_modules/.pnpm` (453 packages, pnpm links rebuilt from `pnpm-lock.yaml`) | typecheck `apps/web`, `packages/db`, `packages/shared`; lint `apps/web` (`--max-warnings 0`), incl. a probe that the import-boundary rule rejects admin imports from storefront files | 0 errors, 0 warnings. The probe fails as intended |
| 2026-09-28 | R5 | Claude, Node 22 (tests compiled with `tsc`) | unit tests: `packages/shared` (all 5 files), `apps/web/tests` (3 new files), `packages/tokens` | 48/48, 10/10, 3/3 pass. Mutation check: open-redirect guard and HTML escaping broken on purpose → caught |
| 2026-09-28 | `a0aa811` (+ regenerated types, lockfile) | founder, same machine, web on **local** Supabase (`.env.local`) | `node scripts/check.mjs` (all steps) | typecheck **FAIL** 11.5 s: only stale `.next/types/validator.ts` from the old app's build naming deleted routes (fixed: `next typegen` runs before `tsc`) · lint OK 37.8 s · test OK 2.4 s · build OK 51.7 s · **pages (prod build, median of 3): `/` 10 ms, `/states` 15 ms, `/states/kerala` 16 ms, product page 10 ms, `/clothing` 11 ms, `/search?q=saree` 39 ms, `/api/health` 57 ms** (baseline `/` 428 ms). Not like-for-like: the baseline read the hosted DB and the new run a local DB; the cached pages make no DB call per request, the search page and health make one · db OK 43.6 s (all SQL test files pass on Postgres 15) |
| 2026-09-28 | `a0aa811` | founder, `pnpm --filter web dev` + Stripe test card | click-through: region → product → bag → checkout → pay → thank-you page → order page (email check) | order `IWC-260928-127BA2716C` created and tracked. The confirmation email was not sent: Resend refused the placeholder sender domain (`RESEND_FROM_EMAIL`, Q-9); the email stays in the outbox and is retried |
| 2026-09-28 | R5 close | Claude | `pnpm db:types` output vs Claude's hand patch for migration 3 (both formatted the same way) | identical |
| 2026-09-28 | R5.6 | Claude, PostgreSQL 16.13 + stub | **11 SQL test files, 187 assertions** (with and without `demo.sql`), incl. new `shipping_refunds.test.sql` (26). Mutation check: 10 breaks (no tax share, no last-piece rule, customer cancel refunds tax, no stock release, cancel after cutoff, refund without admin, amounts readable by customers, express without days, express window from standard days, guest lookup drifting from `store_orders`) | all pass. All 10 caught |
| 2026-09-28 | R5.6 | Claude, `tsc` 5.9.3 + ESLint 8.57.1 + Node 22 | typecheck web/db/shared, lint web, unit tests (shared `domain.test.ts` 26, web 10) | 0 errors, 0 warnings, all pass |
| 2026-09-28 | R6 | Claude, `tsc` 5.9.3 + ESLint 8.57.1 (the app's dependency closure copied from the founder's `node_modules/.pnpm`) + Node 22 | typecheck app, web, db, shared; lint app + web (`--max-warnings 0`), incl. a probe that app customer files can't import admin code or `@repo/db/admin`; unit tests (shared 26, web 10) | 0 errors, 0 warnings, all pass. The probe fails as intended (2 errors). **Not run by Claude:** the app itself (no Expo / device) |
| 2026-09-29 | `b0a00cd` (+ founder's `pnpm install`, migration 4 applied) | founder, same machine, local Supabase | `node scripts/check.mjs` (all steps) | **all OK**: typecheck 19.2 s · lint 43.5 s · test 2.3 s · build 52.7 s · http 3.8 s · db 43.5 s · pages (median of 3): `/` 8 ms, `/states` 16 ms, `/states/kerala` 17 ms, product page 15 ms, `/clothing` 15 ms, `/search?q=saree` 58 ms, `/api/health` 30 ms. Founder: "Web is working perfectly fine" |
| 2026-09-29 | `b0a00cd` | founder, `expo start` | start the app | **bundling failed**: the Stripe config plugin crashed without options (founder added `merchantIdentifier` / `enableGooglePay` in `app.json`), then `query-string` not found from expo-router, `@babel/runtime` and `@expo/metro-runtime` not found; with a trial `.npmrc`, `react` resolved to `@types/react` (the tsconfig `paths` entry, followed by Metro) |
| 2026-09-29 | app fix | Claude, the repo's Expo CLI 0.22.28 + Metro 0.81.5 with the app's full dependency closure copied from the founder's `node_modules/.pnpm` | `expo export --platform android` and `ios` | the founder's errors reproduced (Stripe plugin, then undeclared modules one after another). After the fix: **Android 1,365 modules, iOS 1,368 modules bundled**; the source map holds one React (18.3.1) and no React 19; app `tsc` + ESLint clean. **Not covered:** `query-string` was a stand-in (it is not in the store yet), Stripe 0.38.6 and `react-dom` 18.3.1 are not in the store (bundled with 0.78.0), CSS is empty (no Linux `lightningcss`), and nothing ran on a device |
| 2026-09-29 | `fa631f4` (after a clean reinstall) | founder, Android emulator + web | app smoke test, first try | the app **bundled and opened** Home; the web kept working. Home showed "Could not load": `apps/app/.env` pointed Supabase at the example's IP (`192.168.1.10`, not the computer's) and the website API at Metro's port 8081 instead of 3000. Fix: the founder's `.env` (Claude never edits it). The app now logs both addresses and the real load error in the Metro terminal (development only), reports an unreachable server as "No connection", and the example uses `YOUR-LAN-IP` |

## Invariant tests (`data-model.md`)
INV-1 … INV-9: implemented and passing on Claude's Postgres 16 runs and on real local Supabase, Postgres 15 (see log).

## R5 sub-steps
| # | Sub-step | Status |
|---|---|---|
| 5.0 | Close R4: remove the unused import, `check.mjs` runs turbo with `--continue` (every package reports), commit generated types + lockfile | ✅ `97fadaf` |
| 5.1 | Web on `@repo/db`: server Supabase clients, `features/` layout, storefront routes (`storefront.md`) | ✅ committed |
| 5.2 | Hidden admin (`admin.md` access model), its own route group | ✅ committed (gaps listed in `admin.md`) |
| 5.3 | Checkout on `create_order` (D-038), order pages, guest lookup, account pages | ✅ committed |
| 5.4 | Performance rules (`engineering.md` says where each lives), import-boundary lint, old web code deleted, web rebrand | ✅ committed |
| 5.5 | `check.mjs` routes → new routes (✅). Founder run on local Supabase (✅, log). Hosted dev DB reset | ⏳ founder, when ready |
| 5.6 | Founder answers (D-041 shipping options, D-042 refunds): migration 4, checkout shipping picker, admin refund + cancel, Settings | ✅ committed · Claude-verified (log) · founder run pending |

## R6 sub-steps
| # | Sub-step | Status |
|---|---|---|
| 6.1 | App config: rebrand (name, slug, scheme `iwc`; bundle ids wait for the domain, Q-9), `@repo/db` + `@repo/tokens`, Metro resolver for package exports, NativeWind on the tokens, import-boundary lint | ✅ committed |
| 6.2 | Customer tabs, region and product screens on `store_*` (old screens, query layer and stores deleted) | ✅ committed |
| 6.3 | Sign-in, checkout on the website's API with the payment sheet (D-038), order + guest lookup (new `POST /api/orders/lookup`), addresses. The checkout HTTP types moved to `packages/shared` | ✅ committed |
| 6.4 | Admin mode after `is_admin()`: Today, Orders, Cycles, Payouts, Listings, Vendors, "View the store" (`admin.md`) | ✅ committed |
| 6.5 | Old shared code deleted (hand-written types, schemas, utils, constants and their 4 tests; `domain.test.ts` covers the replacements) | ✅ committed |
| 6.6 | Founder: `check.mjs` | ✅ 2026-09-29, all green (log) |
| 6.7 | App bundling on the founder's machine: `.npmrc` hoisting, Metro resolver (`@/`, one React), tsconfig paths off in Metro, Stripe 0.38.6, `query-string` + `react-dom` declared | ✅ committed · Claude bundled Android + iOS (log) |
| 6.8 | Founder: clean reinstall + smoke test on a phone | ⏳ |

**Not verified by anyone yet:** a delivered email (needs a verified sender, Q-9), the admin screens in a browser, and any
app screen on a device.

## Waiting on the founder (in this order, from `C:\kod\root`, Docker + local Supabase running)
1. **Clean reinstall** (the new `.npmrc` changes how pnpm lays out `node_modules`), in PowerShell:
   `Remove-Item -Recurse -Force node_modules, apps\app\node_modules, apps\web\node_modules, packages\*\node_modules`
   then `pnpm install` (it also updates `pnpm-lock.yaml`: Stripe 0.38.6, `query-string`, `react-dom` 18.3.1 for the app).
2. `node scripts/check.mjs`, then tell Claude (the web must stay green with the new layout). Claude commits the lockfile.
3. **Phone smoke test** (`ops.md` §Running the app: `apps/app/.env` with your computer's LAN IP, the local anon key and the
   Stripe test key). `pnpm --filter web dev` in one terminal; in another, `cd apps\app` then `npx expo start --clear`, and
   open it in Expo Go on the phone (not the browser: the app's web target is not used).
   Home → a region → the demo product → Add to bag → Bag → Checkout (card `4242 4242 4242 4242`) → Thank you → Track this
   order. Then Profile → Sign in → your orders. Then sign in with the admin account: admin mode should open on Today;
   check Orders (the new order), Cycles (the open cycle) and "View the store". Tell Claude what breaks (a screenshot helps).
4. **Announcement (unchanged):** the next step after that is resetting the **hosted dev DB** to the new schema
   (`ops.md` §Database workflow). It deletes everything in the hosted dev project. Run it only when you're ready.

## Known leftovers (tracked, not forgotten)
- The app's bundle ids are still `com.root.app` (`apps/app/app.json`): they change with the domain (Q-9). Everything else
  is rebranded (D-009).
- Still open from R5.6: express days (Q-18) and the accountant check on keeping tax (Q-19).
- The old hosted dev DB keeps the old schema and its holes (B-1, B-14) until the reset above.
- `supabase/config.toml` uses the deprecated `[inbucket]` section (CLI warning, harmless) → fix when touching config.
- Founder's `apps/web/.env` has unused `RAZORPAY_*` / `TRACKING_PROXY_*` lines (safe to delete. Claude never edits `.env`).

## Session notes (environment facts, re-check each session)
- Claude's sandboxes get **403 from the npm registry**, and GitHub is unreachable from the VM. The cloud sandbox has
  PostgreSQL 16 for SQL checks, and type definitions can be copied from the founder's `node_modules/.pnpm` (real folders;
  the symlinks under `apps/*/node_modules` are not readable from the VM).
- Deleting files in `C:\kod\root` needs the founder's permission **per session** (git needs it too).
- The repo sets `core.fileMode=false`. `.gitattributes` normalises line endings to LF.
