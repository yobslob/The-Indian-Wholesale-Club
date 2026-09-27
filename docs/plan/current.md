# Current status

## Resume here
**R4 is done** (founder run 2026-09-28: all 8 SQL test files pass on real local Supabase; the one red item, an unused
import left by R2, is fixed). **R5 (web reshape + speed) is in progress**: new routes on `@repo/db/store`, hidden admin,
performance rules, delete the old web types/queries, reset the hosted dev DB. See the R5 sub-steps below.
The web/app code still reads the **old** schema on the hosted dev DB until R5/R6.

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done | commit `d5342ae`, tag `pre-restructure`. Baseline timings recorded 2026-09-28 (log) |
| R1 Docs system | ✅ done, approved (D-023) | |
| R2 Remove dead paths | ✅ done | commit `c22656b`. One leftover (unused `Ionicons` import in the app) was caught by the founder's run and fixed in the R4 fix commit |
| R3 DB baseline | ✅ done | commit `96b964c`. Applied and tested on real local Supabase (log) |
| R4 Packages | ✅ done | commit `7d7c525` + fix commit (generated `database.types.ts`, lockfile, `check.mjs --continue`) |
| R5 Web reshape + speed | 🔄 in progress | sub-steps below |
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

## Invariant tests (`data-model.md`)
INV-1 … INV-9: implemented and passing on Claude's Postgres 16 runs and on real local Supabase, Postgres 15 (see log).

## R5 sub-steps
| # | Sub-step | Status |
|---|---|---|
| 5.0 | Close R4: remove the unused import, `check.mjs` runs turbo with `--continue` (every package reports), commit generated types + lockfile | ✅ this commit |
| 5.1 | Web on `@repo/db`: server Supabase clients, `features/` layout, storefront routes (`storefront.md`) | next |
| 5.2 | Hidden admin (`admin.md` access model), lazy admin bundle | — |
| 5.3 | Cart + checkout on `createOrder`, order pages, guest lookup | — |
| 5.4 | Performance rules PR-1 … PR-8, import-boundary lint, delete the old web types/queries, rebrand | — |
| 5.5 | `check.mjs` routes → new routes. Founder: reset the hosted dev DB (announced first), then measure against the baseline | — |

## Known leftovers (tracked, not forgotten)
- Brand strings still say "ROOT" → rebrand sweep in R5/R6 (D-009).
- Old `SHIPPING_RATES` windows still shown by the old app → replaced by cycle windows (D-008) in R5.
- Old hand-written types (`packages/shared/src/types`) + old query layers (`apps/web/lib/queries`, `apps/app/lib/queries`)
  → deleted in R5/R6 when the apps switch to `@repo/db`.
- The old hosted dev DB keeps the old schema and its holes (B-1, B-14) until the R5 reset. The app-side admin guard is already fixed.
- `supabase/config.toml` uses the deprecated `[inbucket]` section (CLI warning, harmless) → fix when touching config.
- Founder's `apps/web/.env` has unused `RAZORPAY_*` / `TRACKING_PROXY_*` lines (safe to delete. Claude never edits `.env`).

## Session notes (environment facts, re-check each session)
- Claude's sandboxes get **403 from the npm registry**, and GitHub is unreachable from the VM. The cloud sandbox has
  PostgreSQL 16 for SQL checks, and type definitions can be copied from the founder's `node_modules/.pnpm` (real folders;
  the symlinks under `apps/*/node_modules` are not readable from the VM).
- Deleting files in `C:\kod\root` needs the founder's permission **per session** (git needs it too).
- The repo sets `core.fileMode=false`. `.gitattributes` normalises line endings to LF.
