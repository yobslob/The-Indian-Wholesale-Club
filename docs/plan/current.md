# Current status

## Resume here
**R5 code is committed and Claude-verified** (typecheck, lint, unit tests, SQL tests; see the log). The web is rebuilt on the
new schema: storefront routes (`storefront.md`), hidden admin, checkout on `create_order`, migration 3. **Waiting on the
founder:** the steps at the bottom, then the hosted dev DB reset (announced there). The mobile app still reads the old
schema until R6, so it breaks against a reset hosted DB until then.

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done | commit `d5342ae`, tag `pre-restructure`. Baseline timings recorded 2026-09-28 (log) |
| R1 Docs system | ✅ done, approved (D-023) | |
| R2 Remove dead paths | ✅ done | commit `c22656b`. One leftover (unused `Ionicons` import in the app) was caught by the founder's run and fixed in the R4 fix commit |
| R3 DB baseline | ✅ done | commit `96b964c`. Applied and tested on real local Supabase (log) |
| R4 Packages | ✅ done | commit `7d7c525` + fix commit (generated `database.types.ts`, lockfile, `check.mjs --continue`) |
| R5 Web reshape + speed | ✅ done (founder run 2026-09-28; typecheck fix in the R5 close commit) · hosted dev DB reset still pending | sub-steps below |
| R6 – R8 | not started | — |

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

**Not verified by anyone yet:** a delivered email (needs a verified sender, Q-9) and the admin screens in a browser.

## Waiting on the founder (in this order, from `C:\kod\root`, Docker + local Supabase running)
1. `pnpm install`: links `@repo/db` into the web, drops the removed web dependencies (framer-motion, lucide-react, clsx,
   tailwind-merge, class-variance-authority, tailwindcss-animate) and updates `pnpm-lock.yaml`.
2. `npx supabase db reset`: applies migration 3 (`20260928000003_checkout.sql`) locally, with the seeds.
3. `pnpm db:types`: regenerates `packages/db/src/database.types.ts` (Claude patched it by hand for migration 3; the diff
   should be formatting only).
4. Create `apps/web/.env.local` pointing the web at local Supabase (`ops.md` §Environment variables: URL
   `http://127.0.0.1:54321` + the local anon and service-role keys from `npx supabase status`). The build now reads the DB,
   and the hosted DB still has the old schema.
5. `node scripts/check.mjs`, then tell Claude. Claude commits the regenerated types + lockfile.
6. Optional click-through with `pnpm --filter web dev`: `/`, a region, the demo product, add to bag, checkout with the
   Stripe test card `4242 4242 4242 4242`; `/admin` after the admin bootstrap in `ops.md` (once, in the local DB).
7. **Announcement:** after a green run, the next step is resetting the **hosted dev DB** to the new schema (`ops.md`
   §Database workflow). It deletes everything in the hosted dev project. Run it only when you're ready; the mobile app
   does not work against it until R6.

## Known leftovers (tracked, not forgotten)
- "ROOT" still appears in the mobile app and the old `packages/shared/src/constants` → R6 (D-009). The web is rebranded.
- Old hand-written types (`packages/shared/src/types`) + the app's query layer (`apps/app/lib/queries`) → deleted in R6.
- The old hosted dev DB keeps the old schema and its holes (B-1, B-14) until the reset above.
- `supabase/config.toml` uses the deprecated `[inbucket]` section (CLI warning, harmless) → fix when touching config.
- Founder's `apps/web/.env` has unused `RAZORPAY_*` / `TRACKING_PROXY_*` lines (safe to delete. Claude never edits `.env`).

## Session notes (environment facts, re-check each session)
- Claude's sandboxes get **403 from the npm registry**, and GitHub is unreachable from the VM. The cloud sandbox has
  PostgreSQL 16 for SQL checks, and type definitions can be copied from the founder's `node_modules/.pnpm` (real folders;
  the symlinks under `apps/*/node_modules` are not readable from the VM).
- Deleting files in `C:\kod\root` needs the founder's permission **per session** (git needs it too).
- The repo sets `core.fileMode=false`. `.gitattributes` normalises line endings to LF.
