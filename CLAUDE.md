# The Indian Wholesale Club (IWC): read this first

This file is the only one to read at the start of every session. Everything else is loaded on demand
(see "Before touching X, read Y"). Rules are tagged with decision IDs (`D-xxx`) from `docs/decisions.md`.

## What we are building
- A US storefront (web + iOS/Android app on one Supabase backend) for Indians living in the US, and Americans
  who love India, who miss home. [D-001]
- The customer picks one of India's **36 regions** (28 states + 8 union territories, shown the same way) and buys that
  region's **clothing and spices**. [D-002]
- **Order-first supply:** shops in India are signed up in person, and their pieces are listed as IWC's own inventory. Customers order,
  then the ordered pieces are collected from the shops. Everything ships together every 20–23 days and is then delivered in the
  US. [D-005]
- Two operators: the **founder** runs the US side and the **COO** runs the India side. [D-007]

## Non-negotiables (if a task would break one, stop and ask)
1. **No operations info on any customer surface.** No shops/vendors, sourcing, pickups, payouts, staff or India-side
   logistics in web pages, the app, emails, API responses or page source. IWC is the seller. [D-003, D-017]
2. **Honest origin.** Show the region and "Made in India" / "Imported". Never mask or rewrite where goods come from. [D-004]
3. **Invisible admin.** No links or hints, and not indexed. Admin code never loads for customers. Access is enforced on the
   server (role + email allowlist), never by hiding alone. [D-006]
4. **Delivery dates come from cycle data.** Never hard-code a delivery promise. [D-008]
5. **Money is always an integer:** USD in `*_cents`, INR in `*_paise`.
6. **Speed is a feature.** Read `docs/engineering.md` §Performance before adding a query, a dependency or a client component. [D-011]

## Anti-hallucination rules [D-012]
- **Do not invent** business rules, prices, fees, delivery times, legal or policy text, product facts, shop details,
  or regional/cultural content presented as fact. If you need one: check `docs/questions.md`. If it is unanswered there,
  ask the founder. In code, use `TODO(founder): Q-xx`. In seed data, set `is_placeholder = true` (fake rows) or
  `content_status = 'draft'` (Claude-drafted text awaiting founder approval).
- **Every rule in the docs cites a decision ID.** A rule without an ID is unconfirmed. Don't build on it without asking.
- **Code is the truth for what exists. `decisions.md` is the truth for what should be.** When they disagree, report
  the mismatch. Don't silently pick one side.
- **No claim without evidence.** "Done", "works", "fast" and "fixed" need a `.checks/latest.json` result or a command you actually
  ran, recorded in `docs/plan/current.md` with the date and commit. Otherwise write "unverified".
- **Don't copy code into docs** (column lists, props, env values). Link the file path instead, because copies go stale.
- **Docs describe the target, code describes the present.** Where they differ, the doc says so ("Target", "Today", "Not
  built yet"), and `docs/plan/current.md` says what has landed. `node scripts/check.mjs docs` checks the mechanical part.

## Where each kind of truth lives
| Fact | Single source |
|---|---|
| The business, users, principles | `docs/product.md` |
| Vocabulary (and forbidden synonyms) | `docs/glossary.md` |
| Decisions (founder, approved, proposed) | `docs/decisions.md` |
| Unanswered questions | `docs/questions.md` |
| DB schema (actual) | `supabase/migrations/` (generated types in `packages/db` after R4) |
| Routes (actual) | `apps/web/app/`, `apps/app/app/` |
| Status, next step, verification evidence | `docs/plan/current.md` |
| What gets built next (phases C1–C8) | `docs/plan/coding-plan.md` |

## Before touching X, read Y
| Task | Read |
|---|---|
| anything | this file + `docs/plan/current.md` |
| schema, queries, RLS, seed | `docs/data-model.md` |
| cycles, orders, pickups, stock, payouts | `docs/flows.md` |
| customer pages (web or app) | `docs/storefront.md` + `docs/design.md` |
| admin (web or app) | `docs/admin.md` |
| performance, tests, tooling, code style | `docs/engineering.md` |
| env vars, deploy, DB reset, legal/compliance | `docs/ops.md` |

## Repo map
`apps/web` Next.js storefront (`app/(store)`) + hidden admin (`app/admin`), code by feature in `features/` · `apps/app` Expo app (customer tabs + admin mode after `is_admin()`, code by feature in `features/`; checkout via the web's API) ·
`packages/shared` pure domain logic (`src/domain`) · `packages/db` typed DB access (`store`/`account`/`admin`/`server`) ·
`packages/tokens` design tokens · `packages/*-config` tooling presets · `supabase/` migrations + seed + SQL tests ·
`scripts/` dev scripts (`check.mjs` = verification) · `docs/` everything above.
The layout (web and app) is in `docs/engineering.md` §Layout.

## How verification works (Claude cannot install npm packages)
Claude's sandboxes are blocked from the npm registry, so Claude can't install packages or run `next build`. Therefore:
- Claude edits and commits in the founder's working copy (`C:\kod\root`) through the device bridge. The founder pushes to
  GitHub (`yobslob/The-Indian_Wholesale-Club`, branch `main`).
- To verify, the founder runs `node scripts/check.mjs` (or named steps, e.g. `node scripts/check.mjs test`) and tells
  Claude. Claude reads `.checks/latest.json` and records the numbers in `docs/plan/current.md`.
- Claude *can* run git, `node --check`, dependency-free Node scripts, **SQL on a local Postgres 16** with the Supabase
  stub, and the repo's own `tsc` + ESLint on the web, the app and the packages, the unit tests (with `tsx`), an Expo bundle of the app and a load check of the Playwright specs, using the
  dependency folders copied from the founder's `node_modules` (`engineering.md` §Testing). Claude cannot run `next build`.
  DB changes and code are checked by Claude before the founder's run.

## Session ritual
1. Read this file, then the "Resume here" section of `docs/plan/current.md`.
2. Read only the docs the table above points to.
3. Make small commits. The message says what changed and why.
4. In the same commit, update `docs/plan/current.md` (done / evidence / next) and any doc whose rule changed.
5. New decision → append to `docs/decisions.md`. New unknown → append to `docs/questions.md`.

## Conventions (details in `docs/engineering.md`)
- Glossary terms everywhere: DB = code = folders = routes. An Indian state/UT is a `region` in code, and "state" or "home" in UI copy. [D-016]
- Customer-side reads use only `store_*` views/functions (plus the customer's own rows under RLS). Base tables holding vendor or
  cost data are admin-only. [D-017]
- Storefront code must never import from admin code. Validate with zod at every boundary. No `any`. Keep files under ~250 lines.
