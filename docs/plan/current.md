# Where things stand

Short on purpose: **replace** this page when something changes, don't append. The history up to 2026-10-11 (every
phase's sub-steps and every verification run) is in `docs/archive/status-log-to-2026-10-11.md`; `git log` has the rest.

## Built
- **Storefront, admin, app, vendor accounts:** everything in the coding plan (C1 – C8), the pilot steps, the design pass
  (B1 – B8, D-079 – D-098) and vendor accounts (V1 – V6, D-102 – D-105). Production runs on Vercel + Supabase
  (us-east-1) since 2026-10-06; the Android app is built by EAS.
- **Pilot pricing (D-109, D-111, D-112):** prices follow the shop's own price with the type's margin (clothing 50%,
  food 25%, home 60%; the margins cover card fees); below $149.99 a bag pays Shipping $18.79 + Retailer charges $1.99
  (struck through at $0.00 from $149.99 up); the free-delivery bar on the website and above the app's tabs.
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

## Next for the founder
1. Run `node scripts/check.mjs`, push, then run the Deploy workflow: it applies the new migrations (the latest is
   `20261012150000_home_album`, D-113) to production.
2. Clear the 2,880 placeholder listings: `pnpm demo:clear … --allow-remote`, then with `--apply` (`ops.md`).
3. On `/admin/import`, drag **Add to IWC** to the bookmarks bar, open a product on Myntra or Amazon and click it.
4. Decide: the name "Food" and 5 pieces per size by default (D-110 proposals); D-105's vendor-screen drafts; the four
   men house models (D-104); Q-35 (US stores).
5. Before launch: Q-3 (US carrier), Q-9 (domain and support email), Q-32 (holding a piece while paying).

## Last verification
| Date | Commit | Where | Result |
|---|---|---|---|
| 2026-10-12 | b4df0f0 + uncommitted (D-117 fixes) | Claude Code, founder's Windows machine with Docker | docs 1.4s, typecheck 18.0s, lint 24.1s, test 2.7s, db 88.8s, build 80.4s, http 3.2s, bundle 17.5s: OK. e2e first 18/23 (a leftover `next start` of Claude's on port 3000 served the old build while `.next` was rebuilt, so checkout hung at "Checking your bag"); re-run alone on a free port 150.7s, 23/23 OK. No route over budget (11 – 57 ms, 123 – 132 KB). |

## Known leftovers
- App bundle ids are still `com.indianwholesaleclub.app` (`apps/app/app.json`); they change with the domain (Q-9).
- `supabase/config.toml` uses the deprecated `[inbucket]` section (a harmless CLI warning).
