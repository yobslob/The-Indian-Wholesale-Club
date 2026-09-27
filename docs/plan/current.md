# Current status

## Resume here
**R1 approved (D-023). R2 committed, unverified: waiting for a founder `check.mjs` run.** Next: **R3** (new DB baseline on local Supabase).

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done · baseline timings **pending** | commit `d5342ae`, tag `pre-restructure`, pushed by founder 2026-09-27 (`git status -sb` → `main...origin/main`) |
| R1 Docs system | ✅ done, approved 2026-09-28 (D-023) | commits "docs: R1 …", "docs: founder approvals …" |
| R2 Remove dead paths | ✅ committed · **unverified** (no `check.mjs` run yet) | commit "refactor: R2 …" (2026-09-28). Proof: the dead-path search (roadmap R2) matches only `apps/web/tests/api-routes.test.ts`, which asserts old `mock_pi_` ids are rejected. All 25 edited TS/TSX files compile-checked by Claude (syntax + undefined names, no dependency types) with 0 problems |
| R3 – R8 | not started | — |

## Verification log (facts only. Add a row per `check.mjs` run)
| Date | Commit | Steps | Result | Key numbers |
|---|---|---|---|---|
| — | — | — | no run yet | — |

## Invariant tests (`data-model.md`)
INV-1 … INV-9: **not implemented** (planned in R3).

## Waiting on the founder
1. `git push`.
2. **Baseline** (old code, before R2): `git checkout 11127d8` → `node scripts/check.mjs` → `git checkout main`.
   Then copy `.checks/latest.json` to `.checks/baseline.json`.
3. **After R2:** `node scripts/check.mjs`. Then tell Claude, who reads `.checks/latest.json` and fills the verification log.

## Known leftovers (tracked, not forgotten)
- Brand strings still say "ROOT" (`SITE_NAME`, footers, emails, app header) → rebrand sweep in R5/R6 (D-009).
- Old `SHIPPING_RATES` windows (5–7 / 2–3 days) are still shown. They are replaced by cycle-based windows (D-008) in R4/R5.
- The founder's local `apps/web/.env` still has unused `RAZORPAY_*` / `TRACKING_PROXY_*` lines, which are safe to delete (Claude never edits `.env`).

## Session notes (environment facts, re-check each session)
- Claude's sandboxes (cloud and the VM on the founder's PC) get **403 from the npm registry**, and GitHub is unreachable from the VM
  (2026-09-27). Claude can't install, build, test or push. See `CLAUDE.md` §Verification.
- Deleting files in `C:\kod\root` needs the founder's permission **per session** (git also needs it for its temp files).
- The VM mounts `C:\kod\root` with every file mode `rwx`, so the repo sets `core.fileMode=false`. `.gitattributes` normalises line endings to LF.
