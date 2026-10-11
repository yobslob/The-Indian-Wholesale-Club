# The Indian Wholesale Club (IWC): read this first

The only file to read at the start of a session. Read other docs only when the table below sends you there.
Rules cite decision IDs (`D-xxx`, index in `docs/decisions.md`).

## What it is
- A US storefront (web + iOS/Android app, one Supabase backend) for Indians in the US and Americans who love India,
  who miss home. [D-001] The customer picks one of India's **36 regions** (states and UTs, shown alike) and buys its
  **clothing, food and home & gifts**. [D-002, D-106, D-110]
- **Today (pilot):** listings are imported from Indian online shops (Myntra, Amazon India…) at `/admin/import`; a sold
  piece is ordered to the hub (1–10 days) and flown to the US (8–11 days). Prices follow the shop's price. [D-109, D-110]
- **Target (retailer model):** shops in India are signed up, list their pieces (vendor accounts), orders are collected
  from them and exported together every 20–23 days. [D-005, D-102]
- Two operators: the **founder** (US side) and the **COO** (India side). [D-007]

## Non-negotiables (stop and ask before breaking one)
1. **No operations info on any customer surface:** no shops, sources, pickups, payouts or India logistics in pages,
   the app, emails, API responses or page source. IWC is the seller. [D-003, D-017]
2. **Honest origin:** show the region and "Made in India"; never invent or mask where goods come from. [D-004]
3. **Invisible admin:** no links or hints; access checked on the server (role + email allowlist). [D-006]
4. **Delivery dates come from cycle data**, never hard-coded. [D-008]
5. **Money is an integer:** USD in `*_cents`, INR in `*_paise`.
6. **Speed is a feature:** read `docs/engineering.md` §Performance before adding a query, dependency or client component. [D-011]

## Don't invent [D-012]
Business rules, prices, fees, delivery times, policy text, product facts and regional content come from the founder.
Unknown → `docs/questions.md`, else ask. In code: `TODO(founder): Q-xx`. Fake rows: `is_placeholder = true`.
Claude-drafted text: `content_status = 'draft'`. Code is the truth for what exists, `docs/decisions.md` for what
should be; report a mismatch instead of picking a side. "Done/works/fixed" needs a check you actually ran.

## Read only what the task needs
| Task | Read |
|---|---|
| where things stand, what's next | `docs/plan/current.md` (short) |
| schema, queries, RLS, seed | `docs/data-model.md` (+ the migration itself) |
| cycles, orders, pickups, stock, payouts | `docs/flows.md` |
| customer pages (web or app) | `docs/storefront.md` + `docs/design.md` |
| admin (web or app), importing from shops | `docs/admin.md` |
| vendor accounts, the photo worker | `docs/vendor.md` |
| performance, tests, tooling, code style | `docs/engineering.md` |
| env vars, deploy, DB reset, legal | `docs/ops.md` |
| words (DB = code = UI) | `docs/glossary.md` |
| a decision's full text / old history | search its ID in `docs/archive/` (not read otherwise) |

## Repo map
`apps/web` Next.js store `app/(store)` + hidden admin `app/admin`, code in `features/` · `apps/app` Expo app ·
`packages/shared` pure logic (`domain`, `sourcing`, `info`, `vendor`) · `packages/db` typed queries
(`store`/`account`/`admin`/`server`/`vendor`) · `packages/tokens` design tokens · `supabase/` migrations, seed, SQL
tests · `scripts/` (`check.mjs` = verification) · `tools/photo-worker` GPU photo worker · `catalogue/` the six
launch regions' listings. `design/` and `docs/archive/` are history; `.ignore` keeps them out of searches.

## Working here
- Repo `C:\kod\root` (Windows 11, Docker Desktop, pnpm 9). Verify with `node scripts/check.mjs` (all, ~5 min) or
  named steps (`docs typecheck lint test`); it writes `.checks/latest.json`. The `db` step resets the **local**
  database (`pnpm dev:admin <email> <password>` recreates an admin).
- **Never:** edit `.env` files, reset or push to a hosted database, run the Deploy workflow, force-push. Ask before
  `git push`. Allowed commands: `.claude/settings.json`. Skills: `/check`, `/record-answer`.
- Small commits that say what and why. Update `docs/plan/current.md` (replace, don't append) and any doc whose rule
  changed in the same commit. New decision → `docs/decisions.md`; new unknown → `docs/questions.md`.

## Conventions
- Glossary words everywhere. An Indian state/UT is a `region` in code, "state" in UI copy. [D-016]
- Customer code reads only `store_*` views/functions (plus own rows under RLS). [D-017] Storefront never imports
  admin code. zod at every boundary. No `any`. Files under ~250 lines. Short comments: say why, cite the D-id once.
