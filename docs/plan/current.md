# Current status

## Resume here
**R1 (docs system) is committed and waiting at the founder review checkpoint.** No application code has changed since
baseline `d5342ae`. Next: the founder reviews the docs (see the list below) and runs the baseline check. After approval, start **R2**.

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done · baseline timings **pending** | commit `d5342ae`, tag `pre-restructure`, pushed by founder 2026-09-27 (`git status -sb` → `main...origin/main`) |
| R1 Docs system | ✅ committed · ⏸ awaiting founder review | commit "docs: R1 – new docs system for IWC" (2026-09-27) |
| R2 – R8 | not started | — |

## Verification log (facts only. Add a row per `check.mjs` run)
| Date | Commit | Steps | Result | Key numbers |
|---|---|---|---|---|
| — | — | — | no run yet | — |

## Invariant tests (`data-model.md`)
INV-1 … INV-9: **not implemented** (planned in R3).

## Waiting on the founder
1. Push the R1 commit.
2. Run the baseline on the unchanged app code: `node scripts/check.mjs` from `C:\kod\root` (needs `pnpm install` done and
   `apps/web/.env` present). Then tell Claude, who reads `.checks/latest.json`.
3. Review, in order: `docs/decisions.md` (especially the **proposed** entries and the D-003 interpretation) →
   `docs/questions.md` (answer what you can) → `docs/product.md` → `docs/flows.md` → `docs/storefront.md` → `docs/admin.md`.

## Session notes (environment facts, re-check each session)
- Claude's sandboxes (cloud and the VM on the founder's PC) get **403 from the npm registry**, and GitHub is unreachable from the VM
  (2026-09-27). Claude can't install, build, test or push. See `CLAUDE.md` §Verification.
- Deleting files in `C:\kod\root` needs the founder's permission **per session** (git also needs it for its temp files).
- The VM mounts `C:\kod\root` with every file mode `rwx`, so the repo sets `core.fileMode=false`. `.gitattributes` normalises line endings to LF.
