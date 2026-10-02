# Admin: hidden web panel + app admin mode

Users: founder (US desk) and COO (India desk), both `role = 'admin'` with the same access (D-007, D-027).
Shops never get logins. The founder and COO enter all shop data (D-018).

## Access model (D-006)
**Web**
- Lives only under `/admin`. `/admin/login` is its own sign-in page. The customer `/login` never mentions admin.
- Never linked from the storefront, the sitemap, `robots.txt` or emails (naming it would advertise it, D-039). Pages send
  `noindex` (response header + page metadata).
- Admin code is a separate route group, so its JavaScript is only downloaded when someone opens `/admin`. The storefront
  must never import admin code (a lint rule enforces this, `engineering.md`).
- Every admin page and every server action checks on the server (`apps/web/features/admin/guard.ts`): signed in **and**
  `profiles.role = 'admin'` **and** email in `ADMIN_EMAILS`. The admin's tab title is the plain site name, so a refused
  visitor's 404 looks like any other 404. Each page calls the guard itself; a layout check alone is not
  enough in Next.js. Opening `/admin` while signed out → the admin sign-in page `/admin/login` (as the founder asked).
  Signed in as a non-admin → a plain 404, also for server actions. There are no admin API routes (R5 uses server actions).
- RLS uses the same check (`is_admin()`, INV-7). Even with a stolen UI, the DB refuses.

**App** (built in R6: `apps/app/app/admin/`)
- One app for everyone and one sign-in screen. After sign-in, the app asks the database `is_admin()` (role **and** email
  in `admin_emails`, `apps/app/lib/session.tsx`). The phone never decides this itself.
- Only if the server says yes does it mount the admin navigator (Today · Orders · Cycles · Payouts · Listings · Vendors) in
  place of the customer tabs; anyone else opening `/admin` is sent to the store. The admin's Today screen has "View the
  store"; the Profile tab then shows "Back to admin", rendered only for that server-confirmed admin.
- Admin screens are bundled in the app binary (mobile apps can't hide code), so all protection is server-side, as on the web (D-043):
  every admin read and write goes through `@repo/db/admin` with the user's own session, and RLS refuses non-admins (INV-7).
  The customer screens can't import admin code (lint rule in `apps/app/.eslintrc.js`).
- The app admin writes straight to the database, so it cannot refresh the website's cache: storefront pages pick up app
  changes (stock after a pickup, a confirmed quantity) within the 5-minute cache fallback (`engineering.md` PR-1).

## Desks (D-007)
`profiles.desk` is meant to pick the default "Today" screen. **Not used yet:** both admins get the same Today. Both admins
can open every section (D-027).

## Sections (web skeleton since R5: working screens on real data, plain styling)
| Section | Job | Main desk | Web | App |
|---|---|---|---|---|
| **Today** | what needs doing now: pickups due, stale listings, payouts due / exports to receive, orders to ship, delay warnings | both | ✓ | ✓ |
| **Vendors** | onboard a shop in about a minute (name, owner, phone/WhatsApp, region, payment method, licences, photo), history | India | ✓ | ✓ |
| **Listings** | add products with the camera (`flows.md` §2), confirm quantities, drafts → live | India | ✓ (incl. the re-check list) | ✓ (new listing with the camera, publish, confirm qty) |
| **Cycles** | current cycle timeline and dates, cutoff, per-shop pickup checklists, packing list + commercial invoice export, export/arrival | both | ✓ (closes and opens by itself, D-045; dates corrected on the cycle; orders moved in, confirmed as shipped (D-064); export details; arrival check-off; packing list + commercial invoice (print/PDF and CSV; Q-30 fields marked)) | ✓ (pickups, cutoff, next step, arrival check-off) |
| **Payouts** | payable per vendor, record payouts | India | ✓ | ✓ |
| **Orders** | all orders, detail + internal timeline, pack & ship once arrived (carrier with tracking link, D-066), refunds, delay notices, move to another cycle (D-045) | US | ✓ | ✓ (pack & ship) |
| **Regions** | edit and approve region content (greeting and its script, tagline, story, accent, image, `is_live`; changing approved text sends it back to draft, enforced in the database); the main photo uploads to `product-media/regions/<slug>/`; album photos (each with alt text, removable) to `regions/<slug>/album/` (`region_photos`, D-051); an accent below WCAG AA on the page backgrounds is refused | both | ✓ | — |
| **Catalog** | products, categories, prices, bulk edits; "Curated for you" picks per product (D-056); product photos (upload with alt text, main photo, remove) to `product-media/products/<id>/` | both | ✓ | — |
| **Reviews** | approve or reject customer reviews before they appear (D-052, D-056); "verified buyer" is set by the database | both | ✓ | — |
| **Customers** | customer list, orders per customer | US | ✓ | — |
| **Promotions** | promo codes (kept from the old admin) | US | ✓ | — |
| **Insights** | sales by region/category/vendor, demand signals (searches, saved items) → what to list next | both | ✓ (sales by region only so far) | — |
| **Settings** | pricing settings (admins are managed in the DB + `ADMIN_EMAILS`, `ops.md`) | both | ✓ | — |

The order page refunds unavailable pieces and cancels orders before cutoff, with the amounts from the D-042 rules shown on
the buttons (Stripe first, then the database). **Web only:** refunds need the Stripe secret key, which lives on the server;
the app's order list marks unavailable pieces "to refund on the web panel".

**App admin mode (R6), what each screen does:** Today (the same counts as the web, each opening its screen) · Orders (filter
by status → detail: items with pickup state, internal timeline, mark shipped with carrier + tracking, mark delivered) ·
Cycles (list → one cycle: cut off, move to the next status, per-shop pickup checklist with Picked / Unavailable) · Payouts
(what each shop is owed, record a payout; the amount is computed in SQL) · Listings (draft / live / paused, confirm each
variant's quantity with the shop) · Vendors (list, add a shop). Adding a product with the camera and publishing it work in the app since C3; creating cycles and editing a
listing's text stay on the web panel.

**Not built yet** (coding phase): photo upload for vendors/receipts (products: web admin since C1, the phone camera since C3), customer emails for
refunds and cancellations, delay warnings on Today, live (Realtime) order/stock feed, packing list +
commercial invoice export, bulk edits, category editing. In the app: cycle creation, refunds, editing a listing's text.

## Design principles for the admin
1. **One screen per job.** "Pick up at Shop X" is one checklist, not a table with filters.
2. **Phone-first for field work:** big tap targets, camera upload, works on weak networks (drafts saved locally
   and synced later is a coding-phase feature).
3. **Keyboard-friendly tables on desktop:** search, bulk select, inline edits.
4. **Live:** new orders and stock changes appear without refresh (Supabase Realtime, D-010).
5. **No dead ends:** every warning on "Today" links to the screen that fixes it.

## Kept from the old admin (moved, adapted)
The order list/detail with status changes, the promo code manager and the inline stock adjuster (now it writes `stock_movements`).
Today's counts are plain queries now (`getTodaySummary` in `packages/db/src/admin/commerce.ts`).
**Removed:** Logistics / "stealth" simulator, the stealth preview card, and fabricated analytics.
