# Where things stand

Short on purpose: **replace** this page when something changes, don't append. The history up to 2026-10-11 (every
phase's sub-steps and every verification run) is in `docs/archive/status-log-to-2026-10-11.md`; `git log` has the rest.

## Built
- **Storefront, admin, app, vendor accounts:** everything in the coding plan (C1 – C8), the pilot steps, the design pass
  (B1 – B8, D-079 – D-098) and vendor accounts (V1 – V6, D-102 – D-105). Production runs on Vercel + Supabase
  (us-east-1) since 2026-10-06; the Android app is built by EAS.
- **Pilot pricing (D-119, 2026-10-14):** two recipes. Clothing and home & gifts: (shop ₹ ÷ 0.90 + g ÷ 100 × ₹146) ÷
  rate, ÷ (1 − margin), the margin easing on dear pieces (clothing 50% → 38%, home 60% → 45%). Food: (shop ₹ + ₹15) ×
  1.10 + billed kg × the courier rate card over a 5 kg parcel, × 1.25. A profit guard lifts any price whose margin can't
  pay US duty and the card fee and leave a minimum profit. Below $149.99 a bag pays Shipping $18.79 + Retailer charges
  $1.99; from $149.99 up they show $0.00 and a bulk saving (10% of the amount over the line, up to $25) comes off, shown
  in the bag, checkout and the free-delivery bar (web and app). Settings has every number and a profit check.
- **Import from shops (D-110, 2026-10-12):** `/admin/import` with the Add to IWC bookmark, pasted links, the review
  form, re-import to update price and sizes, "Order it online" on the pickup cards (web and app) (`admin.md` §Import from shops).
- **Home and header (D-113, 2026-10-12):** Home runs hero → the album of all of India (the states' drifting mosaic)
  → Pick your home → Just listed; the header's Search is a visible pill first in the links that grows into a search
  bar on scroll.
- **Made-to-order pilot (D-115, 2026-10-12):** no cycles or cutoff; delivery is today + 12 – 18 days (Settings →
  Standard delivery); a standard order needs no cycle and its pieces go on the pickup list at once.
- **Saved addresses at checkout (D-114, 2026-10-12):** signed in, checkout offers the saved addresses (default filled
  in) and a paid order saves its address to the account.
- **Polish pass (D-116, 2026-10-12):** the free-delivery pill with a glowing meter (web and app), the add-to-bag
  flight and Added state, velocity drift on grids and rows, heading reveals, section pills that follow the reader,
  smooth Details, the app's gliding tab marker; layouts unchanged.
- **Fixes after launch check (D-117, 2026-10-12):** the pill's bar fills sideways; phones get Search in the header (Saved
  in the menu); no sideways bleed, no album fade, the footer ends every page; info links open the glass panel on
  Vercel again (the panel routes render on request).
- **Food (D-110):** the product type `spice` is now `food` (page `/food`; `/spices` redirects).
- **Auto-sourcing and the weekly check (D-118, 2026-10-13):** targets (`/admin/import/auto`, added from the state
  bestseller CSV); `tools/sourcing-runner` on a PC in India searches Blinkit, Zepto, Instamart, BigBasket, Amazon,
  Flipkart, Myntra, Oyela, Nishorama and Offduty, adds listings that reach the hub within 3 days with every variant
  (colour, flavour, type, pack, size, each with its own price) and backup sources, and re-reads every sourced listing
  weekly (price, stock, cheapest source; jumps held for an admin). The bookmark import keeps variants and prices too.
- **Small food on $1.99 – $3.99, Publish all drafts (D-120, 2026-10-14):** food up to ₹200 and 250 g is priced on the
  steps $1.99 / $2.99 / $3.99 (half its shipping share; Settings → Small food shelf, with the profit check); Products →
  Drafts has **Publish all drafts** (every draft with a photo, an option and a piece to sell; it reports the rest).

## Next for the founder
1. Run `node scripts/check.mjs` (Docker Desktop and `npx supabase start` first), push, then the Deploy workflow: it
   applies the new migrations (the latest is `20261014120100_publish_drafts`, D-120; it and D-119 reprice every
   listing) to production.
2. Then Admin → Products → Drafts → **Publish all drafts**; it says how many went live, what held the rest and how
   many still lack details customers see (fibre and care, ingredients and allergens).
3. Replace the D-119 / D-120 estimates in Settings with real bills (one courier invoice, one duty bill): the per-parcel
   cost, US duty by type, the food fee, parcel kg, billed weight, the small-food limits and share; watch the profit
   check (a bag of only $2.99 packets past $149.99 loses money, D-120).
4. Toward 3,000 listings: add more targets (Admin → Import → Auto-sourcing), raise targets per run and listings per
   target, and keep `pnpm sourcing run` scheduled daily on the hub PC (`tools/sourcing-runner/README.md`).
5. Clear the 2,880 placeholder listings: `pnpm demo:clear … --allow-remote`, then with `--apply` (`ops.md`).
6. Decide: the name "Food" and 5 pieces per size by default (D-110 proposals); D-118's proposals (3 listings per
   target, the 60% rise / 50% fall guard, drafts until published, 40 targets a day); D-120's proposals (₹200, 250 g,
   half the shipping share); D-105's vendor-screen drafts; the four men house models (D-104); Q-35 (US stores).
7. Before launch: Q-3 (US carrier), Q-9 (domain and support email), Q-32 (holding a piece while paying).

## Last verification
| Date | Commit | Where | Result |
|---|---|---|---|
| 2026-10-14 | D-120 commit | Claude, cloud sandbox with the founder's `node_modules` (no Docker) | all 51 migrations + seeds applied on plain Postgres 16 with the Supabase stand-in: 41/41 SQL test files pass (new: `publish_drafts`; `pricing_engine` with the shelf) · shared unit tests 117/117 · tsc shared, db and web clean. **Not run:** ESLint (its Next plugin does not load in the sandbox), `next build`, e2e, http, the app. Run `node scripts/check.mjs` before pushing. |
| 2026-10-14 | D-119 commit | Claude, cloud sandbox with the founder's sources and type definitions (no Docker, no npm) | all 49 migrations + seeds applied on plain Postgres 16 with the Supabase stand-in: 39/40 SQL test files pass (`customer_messages` needs Supabase Vault, absent there; it fails the same without D-119), `pricing_engine` fails as it should when the guard is removed (mutation check) · shared unit tests 113/113 · tsc shared clean; db, web and app show no new errors against the same sandbox's baseline (its missing Supabase and NativeWind types leave known errors in both) · docs audit OK. **Not run:** ESLint, `next build`, e2e, the app bundle, a real Supabase reset. Run `node scripts/check.mjs` before deploying. |
| 2026-10-13 | D-118 commit | Claude, cloud sandbox with the founder's `node_modules` (no Docker, no shop access) | tsc web/db/shared/runner clean · unit tests shared 106/106 (auto-sourcing 20), web 37/37 · all 48 migrations + seeds applied and 40/40 SQL test files passed on plain Postgres 16 with a Supabase stand-in · the page readers run in the founder's browser on live Amazon, Flipkart, Myntra, Blinkit and BigBasket pages · `pnpm sourcing try` started and logged each shop (no shop reachable from the sandbox). **Not run:** `next build`, ESLint with the Next plugin, e2e, a full run at the hub, Zepto and Instamart pages. Run `node scripts/check.mjs` before pushing. |
| 2026-10-12 | b4df0f0 + uncommitted (D-117 fixes) | Claude Code, founder's Windows machine with Docker | docs 1.4s, typecheck 18.0s, lint 24.1s, test 2.7s, db 88.8s, build 80.4s, http 3.2s, bundle 17.5s: OK. e2e first 18/23 (a leftover `next start` of Claude's on port 3000 served the old build while `.next` was rebuilt, so checkout hung at "Checking your bag"); re-run alone on a free port 150.7s, 23/23 OK. No route over budget (11 – 57 ms, 123 – 132 KB). |

## Known leftovers
- App bundle ids are still `com.indianwholesaleclub.app` (`apps/app/app.json`); they change with the domain (Q-9).
- `supabase/config.toml` uses the deprecated `[inbucket]` section (a harmless CLI warning).
