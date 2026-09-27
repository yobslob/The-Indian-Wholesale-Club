# Roadmap: restructure (R0–R8), then the coding phase

Status lives in `current.md`. This file lists what each step does and how "done" is proven.
Every step ends with a commit and a founder-run `node scripts/check.mjs` (D-021). Without that it is "done, unverified".

| Step | Size | Goal | Done when |
|---|---|---|---|
| **R0** Safety net | S | git baseline before any change | commit `d5342ae` + tag `pre-restructure` pushed · baseline `check.mjs` numbers recorded |
| **R1** Docs system | M | CLAUDE.md + new `docs/`; old docs and audit files removed (they stay in git history) | docs committed · **founder review checkpoint passed** |
| **R2** Remove dead paths | S | delete the stealth layer, payment simulator, carrier webhook, Razorpay/tracking-proxy env, mobile fallback catalog, legacy scripts, and tests of removed code | searching the code for `stealth\|sanitiz\|simulator\|mock_pi_\|razorpay\|TRACKING_PROXY` finds nothing · check green |
| **R3** DB baseline | L | one new migration implementing `data-model.md`: `store_*` views, RLS (INV-1/2/7/8), stock ledger + conditional reservation (INV-3/4), cycles (INV-5), storage buckets. Seed 36 regions (draft content, D-019) + categories + dev demo. Plain-SQL tests for INV-1…INV-9 (`supabase/tests/`). Built and tested on **local Supabase in Docker** (D-031). The hosted dev DB is untouched until R5 | Claude: migration + tests pass on local Postgres 16 with a Supabase stub · founder: `node scripts/check.mjs db` passes on local Supabase |
| **R4** Packages | M | `packages/db` (generated types via `pnpm db:types`, zod-validated `store/*`, `admin/*`, `server/*`), one-round-trip store functions (migration 2), `packages/shared/src/domain` + unit tests (node:test, D-037), `packages/tokens` wired to Tailwind + NativeWind. The old hand-written types and duplicate query layers are deleted in R5/R6, when the apps switch over (deleting them now would break the running app) | typecheck green in all workspaces · unit + DB tests pass |
| **R5** Web reshape + speed | L | routes from `storefront.md` + `admin.md` as working skeletons on real data (plain styling). Performance rules PR-1…PR-8. Hidden admin (separate sign-in, 404 for non-admins, lazy bundle). Import-boundary lint. Remove the old generic pages. **Reset the hosted dev DB to the new schema** (D-013, D-031, announced first) | every route renders · storefront ≤ 1 DB round trip per page · `check.mjs http` numbers vs baseline recorded |
| **R6** App reshape | M | customer tabs per `storefront.md`, `store_*` queries, shared tokens, lazy admin mode (server-confirmed role), existing auth + PaymentSheet adapted | app typecheck + lint green · founder smoke-tests on a device |
| **R7** Tests, tooling, CI | M | Playwright smoke (3 flows, `engineering.md`), Vitest everywhere, drop duplicate lint/typecheck from `next build`, CI mirrors `check.mjs`, review `deploy.yml` | full `check.mjs` green · build/test times vs baseline recorded |
| **R8** Hand-off | S | docs match code (every route and table checked), `current.md` → "restructure done" | founder sign-off, then write the **coding plan** |

## Coding phase (planned after R8, order to be agreed)
1. Design mockups (Home, Region, Product, admin Listing) → founder review → tokens finalised.
2. Region pages + content approval flow (greetings, stories).
3. Field listing flow on phone (camera, drafts, qty confirmation).
4. Cycles: cutoff, pickups checklist, payouts, export docs, arrival, US packing & shipping.
5. Delivery windows + delay notices (D-008). Customer emails.
6. Insights. Later ideas only with founder approval (`product.md` §Later ideas).
