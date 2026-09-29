---
name: check
description: Run the project's verification (scripts/check.mjs), read .checks/latest.json and log the result in docs/plan/current.md. Use before calling any work done, and when the user asks to check, verify or test.
argument-hint: "[steps, e.g. docs typecheck lint test]"
---

# Verify and log (CLAUDE.md §How work and verification run)

1. Make sure local Supabase is running (`npx supabase status`; if not, `npx supabase start`). The `db`, `build`, `http`
   and `e2e` steps need it. Never point anything at a hosted database.
2. Run `node scripts/check.mjs $ARGUMENTS` (no arguments = all steps: docs, typecheck, lint, test, db, build, http,
   e2e, bundle, about 5 minutes). Steps always run in that order.
3. Read `.checks/latest.json`. For each failing step, read its `outputTail`; E2E failures also leave a screenshot, a
   trace and `error-context.md` in `.checks/e2e-results/`. Fix the cause, not the test, unless the test is wrong, and
   say which it was.
4. Add one row to the verification log in `docs/plan/current.md`: date, commit (`git rev-parse --short HEAD`, note
   uncommitted changes), "Claude Code, <machine>", what ran, and the facts: each step OK/FAIL with seconds, route
   timings from the `http` step, E2E passed/total. Facts only; nothing is "done" or "fast" without this row (D-012).
5. Remember: the `db` step resets the **local** database, which deletes local accounts. Tell the user to run
   `pnpm dev:admin <email> <password>` if they need their admin account back.
