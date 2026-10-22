# The Indian Wholesale Club (IWC): read this first

The only file to read at the start of a session. Read other docs only when the table below sends you there.
Rules cite decision IDs (`D-xxx`, index in `docs/decisions.md`).

## What it is
- A US storefront (web + Android app, iOS later; one Supabase backend) for Indians in the US and Americans who love India,
  who miss home. [D-001] The customer picks one of India's **36 regions** (states and UTs, shown alike) and buys its
  **clothing, food and home & gifts**. [D-002, D-106, D-110]
- **Live since 2026-10-06, real orders since mid-October (pilot, made to order):** listings are imported from Indian
  online shops (Myntra, Amazon India, Blinkit…) by the admin's importer and the sourcing runner; a sold piece is
  ordered to the hub (1–10 days) and flown to the US (8–11 days). Prices follow the shop's price by the founder's
  beta rules. [D-110, D-115, D-118, D-128]
- **Target (retailer model):** shops in India are signed up, list their pieces (vendor accounts), orders are collected
  from them and exported together every 20–23 days. [D-005, D-102]
- Two operators: the **founder** (US side) and the **COO** (India side). [D-007]
- **Hosting (D-147):** a new Vercel account (Hobby) and a new Supabase project (free) since 2026-10-21/22, photos in
  Cloudflare R2. The first accounts hit their free limits; every limit now has a budget (`docs/monitoring.md`). Any
  change that adds page-cache writes, database size or egress says so in its commit.

## Non-negotiables (stop and ask before breaking one)
1. **No operations info on any customer surface:** no shops, sources, pickups, payouts, weights or India logistics in
   pages, the app, emails, API responses or page source. IWC is the seller. [D-003, D-017]
2. **Honest origin:** show "Made in India" and the state when the listing has one (an all-India listing has none);
   never invent or mask where goods come from. [D-004, D-121]
3. **Invisible admin:** no links or hints; access checked on the server (role + email allowlist). [D-006]
4. **Delivery dates come from cycle data**, or in the made-to-order pilot from its delivery days in Settings; never
   hard-coded. [D-008, D-115]
5. **Money is an integer:** USD in `*_cents`, INR in `*_paise`. Prices: never change the pricing rules unasked. [D-128, D-140]
6. **Speed and free limits are features:** read `docs/engineering.md` §Performance before adding a query, dependency
   or client component, and `docs/monitoring.md` §1 before anything that refreshes pages or reads in bulk. [D-011, D-145]

## Don't invent [D-012]
Business rules, prices, fees, delivery times, policy text, product facts and regional content come from the founder.
Unknown → `docs/questions.md`, else ask. In code: `TODO(founder): Q-xx`. Fake rows: `is_placeholder = true`.
Claude-drafted text: `content_status = 'draft'`. Code is the truth for what exists, `docs/decisions.md` for what
should be; report a mismatch instead of picking a side. "Done/works/fixed" needs a check you actually ran.

## Read only what the task needs
| Task | Read |
|---|---|
| where things stand, what's next, last verification | `docs/status.md` (short) |
| what IWC is, the words to use (glossary) | `docs/product.md` |
| schema, queries, RLS, seed | `docs/data-model.md` (+ the migration itself) |
| cycles, orders, pickups, stock, payouts | `docs/flows.md` |
| customer pages (web or app), brand, voice, tokens, motion | `docs/storefront.md` |
| admin (web or app), importing, auto-sourcing, vendor accounts | `docs/admin.md` |
| prices, fees, every pricing number and where it is set | `docs/pilot-numbers.md` |
| performance, tests, tooling, code style | `docs/engineering.md` |
| accounts and limits, env vars, deploy, DB, the founder's tools, legal | `docs/ops.md` |
| production metrics, budgets, health checks, failure playbook | `docs/monitoring.md` |
| why a rule exists | `docs/decisions.md` (index + recent in full) |
| a decision's full text, old plans ("plan F10" = `docs/archive/plan-design-v6.md`), history | search in `docs/archive/` (not read otherwise) |

## Repo map
`apps/web` Next.js store `app/(store)` + hidden admin `app/admin` + vendor `app/vendor`, code in `features/` ·
`apps/app` Expo app · `packages/shared` pure logic (`domain`, `sourcing`, `info`, `vendor`) · `packages/db` typed
queries (`store`/`account`/`admin`/`server`/`vendor`) · `packages/tokens` design tokens · `supabase/` migrations, seed,
SQL tests · `scripts/` (`check.mjs` = verification, `docs-audit.mjs`, the founder's one-off and ops scripts) ·
`tools/` the founder's machines: `sourcing-runner` (India PC), `weight-estimator` (laptop GPU), `photo-worker` (GPU) ·
`catalogue/` the demo catalogue behind the local seed. `design/` (mockups the dev scripts still read) and
`docs/archive/` are history; `.ignore` keeps them out of searches.

## Working here
- Repo `C:\kod\root` (Windows 11, Docker Desktop, pnpm 9). Verify with `node scripts/check.mjs` (all, ~5 min) or
  named steps (`docs typecheck lint test`); it writes `.checks/latest.json`. The `db` step resets the **local**
  database (`pnpm dev:admin <email> <password>` recreates an admin). A cloud session without Docker can run the SQL
  tests on plain Postgres with `supabase/tests/_stub/supabase_stub.sql` and say what it did not run.
- **Never:** edit `.env` files, read production secrets, reset or write to a hosted database, run the Deploy workflow,
  force-push. Ask before `git push`. Allowed commands: `.claude/settings.json`. Skills: `/check`, `/record-answer`.
- Production dumps and pulled env files (`*.sql` dumps, `*.env`) never live in this folder (`ops.md` §Moving).
- Small commits that say what and why. Update `docs/status.md` (replace, don't append) and any doc whose rule
  changed in the same commit. New decision → `docs/decisions.md`; new unknown → `docs/questions.md`.

## Conventions
- Glossary words everywhere (`docs/product.md` §Glossary). An Indian state/UT is a `region` in code, "state" in UI
  copy. [D-016]
- Customer code reads only `store_*` views/functions (plus own rows under RLS). [D-017] Storefront never imports
  admin code. zod at every boundary. No `any`. Files under ~250 lines. Short comments: say why, cite the D-id once.
- Bulk admin work runs in batches the page repeats, each well inside the database's 8 s statement limit (D-146).
