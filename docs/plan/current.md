# Where things stand

Short on purpose: **replace** this page when something changes, don't append. The history up to 2026-10-11 (every
phase's sub-steps and every verification run) is in `docs/archive/status-log-to-2026-10-11.md`; `git log` has the rest.

## Built
- **Storefront, admin, app, vendor accounts:** everything in the coding plan (C1 – C8), the pilot steps, the design pass
  (B1 – B8, D-079 – D-098) and vendor accounts (V1 – V6, D-102 – D-105). Production runs on Vercel + Supabase
  (us-east-1) since 2026-10-06; the Android app is built by EAS.
- **Pilot pricing (D-109, D-111):** prices follow the shop's own price with the type's margin (clothing 50%, food 25%,
  home 60%); below $149.99 a bag pays Shipping + Retailer charges (struck through as free from $149.99 up); the
  free-delivery bar on the website and above the app's tabs.
- **Import from shops (D-110, 2026-10-12):** `/admin/import` with the Add to IWC bookmark, pasted links, the review
  form, re-import to update price and sizes, "Order it online" on the pickup cards (web and app) (`admin.md` §Import from shops).
- **Food (D-110):** the product type `spice` is now `food` (page `/food`; `/spices` redirects).

## Next for the founder
1. Run `node scripts/check.mjs`, push, then run the Deploy workflow: it applies migrations `20261012090000_food_type`,
   `20261012100000_sourced_listings` and `20261012120000_pilot_charges` to production.
2. Clear the 2,880 placeholder listings: `pnpm demo:clear … --allow-remote`, then with `--apply` (`ops.md`).
3. On `/admin/import`, drag **Add to IWC** to the bookmarks bar, open a product on Myntra or Amazon and click it.
4. Decide: the small-order margin (10%) and retailer charges (₹150 per parcel), both estimates in Settings (D-111);
   the name "Food" and 5 pieces per size by default (D-110 proposals); D-105's vendor-screen drafts; the four
   men house models (D-104); Q-35 (US stores).
5. Before launch: Q-3 (US carrier), Q-9 (domain and support email), Q-32 (holding a piece while paying).

## Last verification
| Date | Commit | Where | Result |
|---|---|---|---|
| 2026-10-12 | D-110 commits | Claude, cloud sandbox with the founder's `node_modules` (no Docker, no network) | tsc web/db/shared clean · unit tests shared 84/84, web 37/37 · all 39 migrations + seeds applied and 37/37 SQL test files passed on plain Postgres 16 with a Supabase stand-in · the bookmark run in Chromium on Amazon- and Myntra-shaped pages. **Not run:** `next build`, ESLint with the Next plugin, e2e, a real shop page. Run `node scripts/check.mjs` before pushing. |

## Known leftovers
- App bundle ids are still `com.indianwholesaleclub.app` (`apps/app/app.json`); they change with the domain (Q-9).
- `supabase/config.toml` uses the deprecated `[inbucket]` section (a harmless CLI warning).
