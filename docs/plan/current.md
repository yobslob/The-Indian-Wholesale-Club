# Current status

## Resume here
**R4 (packages) is committed and Claude-verified. It is waiting for the founder's run** (steps below: `pnpm install`,
`pnpm db:types`, `node scripts/check.mjs`). Then commit the generated `packages/db/src/database.types.ts` + updated
`pnpm-lock.yaml`. Next: **R5** (web reshape + speed: new routes on `@repo/db/store`, hidden admin, performance
rules, delete the old types/queries, reset the hosted dev DB).
The web/app code still reads the **old** schema on the hosted dev DB until R5/R6.

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done | commit `d5342ae`, tag `pre-restructure`. Baseline timings recorded 2026-09-28 (log) |
| R1 Docs system | ✅ done, approved (D-023) | |
| R2 Remove dead paths | ✅ committed · founder `check.mjs` pending | commit `c22656b`. Claude: shared package type-checks with real `tsc` 5.9.3 (2026-09-28) |
| R3 DB baseline | ✅ committed · **applied on real local Supabase** by the founder (`supabase start`, 2026-09-28) · DB tests pending | commit `96b964c` |
| R4 Packages | ✅ committed · Claude-verified · founder run pending | commit "feat: R4 …" (2026-09-28). See the log |
| R5 – R8 | not started | — |

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
| — | — | founder | `node scripts/check.mjs` on current code (incl. `db`) | **not run yet** |

## Invariant tests (`data-model.md`)
INV-1 … INV-9: implemented and passing on Claude's Postgres 16 runs (see log). Pending: the founder's `check.mjs db` on real
local Supabase (Postgres 15).

## Waiting on the founder (in this order, from `C:\kod\root`, Docker + local Supabase running)
1. `git pull` is not needed (Claude commits in your folder). Just run `pnpm install`: it links the new `@repo/db` and
   `@repo/tokens` packages and updates `pnpm-lock.yaml`.
2. `npx supabase db reset`: applies the new migration 2 (store page functions) locally.
3. `pnpm db:types`: writes the official `packages/db/src/database.types.ts`.
4. `node scripts/check.mjs`: typecheck, lint, test, build, http (old app vs hosted DB) and db (SQL tests on local Supabase).
5. Tell Claude. Claude reads `.checks/latest.json`, fixes anything red, and commits `database.types.ts` + `pnpm-lock.yaml`.

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
