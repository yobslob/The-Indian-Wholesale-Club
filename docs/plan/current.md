# Current status

## Resume here
**R3 (new DB baseline) is committed. Claude verified it on local Postgres 16. It is waiting for the founder's run on local Supabase**
(`node scripts/check.mjs db`). R2 is also unverified by the founder. Next: **R4** (packages: `@repo/db` with generated types
+ `store/*` / `admin/*` queries, domain logic in `@repo/shared`, `@repo/tokens`).
Important: the web/app code still reads the **old** schema on the hosted dev DB. The new schema lives only in migrations +
local Supabase until R5 switches the app over and resets the hosted DB (D-031).

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done · baseline timings **pending** | commit `d5342ae`, tag `pre-restructure`, pushed 2026-09-27 |
| R1 Docs system | ✅ done, approved 2026-09-28 (D-023) | commits "docs: R1 …", "docs: founder approvals …" |
| R2 Remove dead paths | ✅ committed · **unverified by founder** | commit "refactor: R2 …". The dead-path search matches only the test asserting old `mock_pi_` ids are rejected. 25 edited TS/TSX files compile-checked by Claude (syntax + undefined names, no dependency types): 0 problems |
| R3 DB baseline | ✅ committed · Claude-verified · **founder run pending** | commit "feat(db): R3 …" (2026-09-28). See the verification log |
| R4 – R8 | not started | — |

## Verification log (facts only. Add a row per run)
| Date | Commit | Who / where | What | Result |
|---|---|---|---|---|
| 2026-09-28 | R3 commit | Claude, PostgreSQL 16.13 + `supabase/tests/_stub` | stub → baseline migration → seeds (with and without `demo.sql`) → `_helpers.sql` → 7 test files | **7/7 files pass, 103 assertions** |
| 2026-09-28 | R3 commit | Claude, same | mutation check: 14 deliberate rule breaks (e.g. old customer-order-update hole, reservations editable, vendor_id in a store view, second open cycle, admin without allowlist, window editable, profile role self-edit, ledger trigger dropped, `create_order` granted to customers, guessable order numbers) | **every break caught** by at least one test. Two first attempts didn't truly open the hole (RLS read rules still blocked them). Re-done faithfully, both caught |
| 2026-09-28 | R3 commit | Claude, same | `scripts/db-test.mjs` flow via a psql-backed `pg` stand-in | 7/7 pass, `tests` schema cleaned up, non-local URL refused |
| — | — | founder | `node scripts/check.mjs` (typecheck, lint, test, build, http, db) | **not run yet** |

## Invariant tests (`data-model.md`)
INV-1 … INV-9: **implemented + passing on Claude's Postgres 16 stub run** (see log). Pending: the founder's run on real local
Supabase (Postgres 15).

## Waiting on the founder
1. `git push`.
2. **Baseline, old code:** `git checkout 11127d8` → `node scripts/check.mjs typecheck lint test build http` →
   `git checkout main`. Copy `.checks/latest.json` to `.checks/baseline.json`.
3. **Admin access (needed since R3):** add `ADMIN_EMAILS=<your email>` to `apps/web/.env`. The admin guard now needs your
   profile role **and** this list, or `/admin` will refuse you.
4. **Local Supabase (one time):** with Docker Desktop running, `npx supabase start`.
5. **Current code:** `node scripts/check.mjs`. Then tell Claude, who reads `.checks/latest.json`.
6. **Review content drafts** (no rush, not blocking): region greetings in `supabase/seed/regions.sql` (6 regions still empty),
   the proposed categories in `supabase/seed/categories.sql`, and answer **Q-15** (pricing settings values).

## Known leftovers (tracked, not forgotten)
- Brand strings still say "ROOT" (`SITE_NAME`, footers, emails, app header) → rebrand sweep in R5/R6 (D-009).
- Old `SHIPPING_RATES` windows (5–7 / 2–3 days) are still shown by the old app. They are replaced by cycle windows (D-008) in R4/R5.
- The old hosted dev DB still has the old schema and its holes (B-1, B-14) until the R5 reset. The app-side admin guard is already fixed.
- The founder's local `apps/web/.env` has unused `RAZORPAY_*` / `TRACKING_PROXY_*` lines, which are safe to delete (Claude never edits `.env`).

## Session notes (environment facts, re-check each session)
- Claude's sandboxes get **403 from the npm registry**, and GitHub is unreachable from the VM (2026-09-27). The cloud sandbox has
  PostgreSQL 16 (`/usr/lib/postgresql/16/bin`) for SQL verification (`engineering.md` §Testing).
- Deleting files in `C:\kod\root` needs the founder's permission **per session** (git needs it too).
- The VM mounts `C:\kod\root` with every file mode `rwx`, so the repo sets `core.fileMode=false`. `.gitattributes` normalises line endings to LF.
