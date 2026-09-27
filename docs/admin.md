# Admin: hidden web panel + app admin mode

Users: founder (US desk) and COO (India desk), both `role = 'admin'` with the same access (D-007, D-027).
Shops never get logins. The founder and COO enter all shop data (D-018).

## Access model (D-006)
**Web**
- Lives only under `/admin`. `/admin/login` is its own sign-in page. The customer `/login` never mentions admin.
- Never linked from the storefront, the sitemap or emails. `robots.txt` disallows it and pages send `noindex`.
- Admin code is a separate route group, so its JavaScript is only downloaded when someone opens `/admin`. The storefront
  must never import admin code (a lint rule enforces this, `engineering.md`).
- Every admin page, server action and API route checks on the server: signed in **and** `profiles.role = 'admin'` **and** email in
  `ADMIN_EMAILS`. Opening `/admin` while signed out → the admin sign-in page (as the founder asked). Signed in as a
  non-admin → a plain 404. Admin API routes return 404 (not 401/403) to anyone who isn't an admin.
- RLS uses the same check (`is_admin()`, INV-7). Even with a stolen UI, the DB refuses.

**App**
- One app for everyone and one sign-in screen. After sign-in, the app asks the server for the user's role.
- Only if the server says `admin` does it lazily load the admin navigator in place of the customer tabs.
- Admin screens are bundled in the app binary (mobile apps can't hide code), so all protection is server-side, as on the web.

## Desks (D-007)
`profiles.desk` picks the default "Today" screen. Both admins can open every section (D-027).

## Sections
| Section | Job | Main desk | Web | App |
|---|---|---|---|---|
| **Today** | what needs doing now: pickups due, stale listings, payouts due / exports to receive, orders to ship, delay warnings | both | ✓ | ✓ |
| **Vendors** | onboard a shop in about a minute (name, owner, phone/WhatsApp, region, payment method, licences, photo), history | India | ✓ | ✓ |
| **Listings** | add products with the camera (`flows.md` §2), confirm quantities, drafts → live | India | ✓ | ✓ (add, confirm qty) |
| **Cycles** | current cycle timeline and dates, cutoff, per-shop pickup checklists, packing list + commercial invoice export, export/arrival | both | ✓ | ✓ (pickups, arrival check-off) |
| **Payouts** | payable per vendor, record payouts | India | ✓ | ✓ |
| **Orders** | all orders, detail + internal timeline, pack & ship (tracking no.), refunds, delay notices | US | ✓ | ✓ (pack & ship) |
| **Regions** | edit and approve region content (greeting, story, accent, image, `is_live`) | both | ✓ | — |
| **Catalog** | products, categories, prices, bulk edits | both | ✓ | — |
| **Customers** | customer list, orders per customer | US | ✓ | — |
| **Promotions** | promo codes (kept from the old admin) | US | ✓ | — |
| **Insights** | sales by region/category/vendor, demand signals (searches, saved items) → what to list next | both | ✓ | — |
| **Settings** | pricing settings, admin list | both | ✓ | — |

## Design principles for the admin
1. **One screen per job.** "Pick up at Shop X" is one checklist, not a table with filters.
2. **Phone-first for field work:** big tap targets, camera upload, works on weak networks (drafts saved locally
   and synced later is a coding-phase feature).
3. **Keyboard-friendly tables on desktop:** search, bulk select, inline edits.
4. **Live:** new orders and stock changes appear without refresh (Supabase Realtime, D-010).
5. **No dead ends:** every warning on "Today" links to the screen that fixes it.

## Kept from the old admin (moved, adapted)
The order list/detail with status changes, the promo code manager, the inline stock adjuster (now it writes `stock_movements`) and the
dashboard SQL aggregate pattern (`admin_dashboard_stats()`).
**Removed:** Logistics / "stealth" simulator, the stealth preview card, and fabricated analytics.
