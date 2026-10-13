# Admin: hidden web panel + app admin mode

Users: founder (US desk) and COO (India desk), both `role = 'admin'` with the same access (D-007, D-027).
Vendors' owners have their own sign-in to upload their pieces (D-102, built V1 – V6, `vendor.md`); every vendor upload
waits for an admin. Pilot listings are imported from online shops (D-110, §Import from shops).

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
- Only if the server says yes does it mount the admin navigator (since B8, D-097: Today · Orders · Cycle · Listings · More) in
  place of the customer tabs; anyone else opening `/admin` is sent to the store. The admin's Today screen has "View the
  store"; the Profile tab then shows "Back to admin", rendered only for that server-confirmed admin.
- Admin screens are bundled in the app binary (mobile apps can't hide code), so all protection is server-side, as on the web (D-043):
  every admin read and write goes through `@repo/db/admin` with the user's own session, and RLS refuses non-admins (INV-7).
  The customer screens can't import admin code (lint rule in `apps/app/.eslintrc.js`).
- The app admin writes straight to the database, so it cannot refresh the website's cache: storefront pages pick up app
  changes (stock after a pickup, a confirmed quantity) within the 5-minute cache fallback (`engineering.md` PR-1).

## Desks (D-007)
`profiles.desk` orders Today (C7): the admin's own desk's jobs first (India: pickups, payouts, drafts, re-checks; US:
confirmed orders, orders to ship), the other desk's below. Both admins can open every section (D-027). Today also shows
new orders and order status changes live (Supabase Realtime on `orders`, PR-7), website and app, and a "Needs
attention" card when there are recent server errors, payments to check or stuck customer emails (B-8). App admin
writes refresh the website's store pages at once (`POST /admin/revalidate`, B-17).

## Sections (web skeleton since R5: working screens on real data, plain styling)
| Section | Job | Main desk | Web | App |
|---|---|---|---|---|
| **Today** | what needs doing now: pickups due, stale listings, payouts due / exports to receive, orders to ship, delay warnings | both | ✓ | ✓ |
| **Vendors** | onboard a shop in about a minute (name, owner, phone/WhatsApp, region, payment method, licences, photo), history; its vendor accounts with the one-time QR / link, the screens' language, switch off (D-102); "Join as a vendor?" requests | India | ✓ | ✓ |
| **Listings** | add products with the camera (`flows.md` §2), confirm quantities, drafts → live | India | ✓ (incl. the re-check list) | ✓ (new listing with the camera, publish, confirm qty; 50 with "Show more", D-067) |
| **Cycles** | current cycle timeline and dates, cutoff, per-shop pickup checklists, packing list + commercial invoice export, export/arrival | both | ✓ (closes and opens by itself, D-045; dates corrected on the cycle; orders moved in, confirmed as shipped (D-064); export details; arrival check-off; packing list + commercial invoice (print/PDF and CSV; Q-30 fields marked)) | ✓ (pickups, cutoff, next step, arrival check-off) |
| **Payouts** | payable per vendor, record payouts | India | ✓ | ✓ |
| **Orders** | all orders, detail + internal timeline, pack & ship once arrived (carrier with tracking link, D-066), refunds, delay notices, move to another cycle (D-045) | US | ✓ | ✓ (pack & ship) |
| **Regions** | edit and approve region content (greeting and its script, tagline, story, accent, image, `is_live`; changing approved text sends it back to draft, enforced in the database); the main photo uploads to `product-media/regions/<slug>/`; album photos (each with alt text, removable) to `regions/<slug>/album/` (`region_photos`, D-051); an accent below WCAG AA on the page backgrounds is refused | both | ✓ | — |
| **Catalog** | products, categories, prices, bulk edits; "Curated for you" picks per product (D-056); product photos (upload with alt text, main photo, remove) to `product-media/products/<id>/`; 50 to a page (D-067) | both | ✓ | — |
| **Reviews** | approve or reject customer reviews before they appear (D-052, D-056); "verified buyer" is set by the database | both | ✓ | — |
| **Customers** | customer list, orders per customer | US | ✓ | — |
| **Promotions** | promo codes (kept from the old admin) | US | ✓ | — |
| **Insights** | sales by state, category and shop (with what the shops were paid), for 30 days, 90 days or all time; searches that found nothing (what to list next), top searches, most saved pieces. Real numbers only, computed in SQL (`admin_sales`, `admin_demand`) | both | ✓ | — |
| **Vendor pieces** | pieces vendors sent (D-102, D-103): their real photos, the AI candidates per pose, pick, name, care, price (empty = from the shop price), publish; or make a pose again on another model, ask for new photos, decline (`vendor.md`) | both | ✓ | — |
| **House models** | the founder's models (D-104): front and back pose each, switch on / off | both | ✓ | — |
| **Settings** | pricing settings, each estimate labelled with its source and date until the founder saves their own (D-047); the pilot price's two recipes, the courier rate card, the profit guard and the bulk saving, with a **profit check** under them that reprices sample pieces and bags as the numbers are typed (web, D-119) (admins are managed in the DB + `ADMIN_EMAILS`, `ops.md`) | both | ✓ | — |

The order page refunds unavailable pieces and cancels orders before cutoff, with the amounts from the D-042 rules shown on
the buttons (Stripe first, then the database). **Web only:** refunds need the Stripe secret key, which lives on the server;
the app's order list marks unavailable pieces "to refund on the web panel".

**App admin mode, what each screen does (B8, D-097, on the web's look):** five tabs with counts of what waits
(Orders to ship, Pickups to do, Drafts, Shops owed) and a search button on each that opens **quick find**; times in the
desk's zone and plain chips (`@repo/shared/admin`, one source with the web panel). **Today**: the cycle countdown,
totals and progress, Needs attention, the desk's queue with one big button per job, live orders, View the store.
**Orders**: search, chips with counts, cards; a long press selects, with Mark shipped… (a sheet, one tracking number
each) and Delivered (asks first). **Order**: pieces with photos and pickup state, Call / Text / Email, the timeline, the
one main action at the bottom (Pack & ship sheet, Mark delivered); express pieces picked there; refunds, cancels and new
delivery dates on the web panel. **Cycle** tab: the cycle being worked on, its progress and next step (Cut off asks
first), pickups by shop (Call, WhatsApp, Map, Picked / Unavailable, which asks first), the arrival check-off, other
cycles. **Listings**: New (Take photos or many from the gallery, the photo grid, live $ price, Save draft / Publish), Add
many (one draft card per photo, Join the draft above, the shop, category, fabric and care set once), Drafts / Live /
Paused with what each draft still needs; a listing's screen publishes, pauses and confirms pieces. **More**: Payouts
(Record payout asks first in a sheet with the amount), Vendors (Add a vendor as a sheet with a shop photo, kept in the
private `vendor-docs` bucket), View the store, Sign out. Creating cycles and editing a listing's words stay on the web
panel.

**Not built yet** (coding phase): photo upload for receipts and licences (products: web admin since C1, the phone camera since C3; a shop's photo in the app since B8), customer emails for
refunds and cancellations, delay warnings on Today, live (Realtime) order/stock feed, packing list +
commercial invoice export, bulk edits of products (orders: bulk ship / deliver since B7), category editing. In the app: cycle creation, refunds, editing a listing's text.

## The web admin's look and daily screens (B7, D-096)
Built 2026-10-09 from `design/pages/admin/` (code in `apps/web/features/admin/`):
- **Frame** (`frame.tsx`): the sidebar grouped Daily · Catalog · People with counts of what waits (`getWaitingCounts`);
  the top bar with **quick find** (Ctrl+K: `adminQuickFind`, five each of orders, products, customers, shops), the
  desk's clock in both zones and the live dot (one Realtime channel for the whole admin, `live-feed.tsx`). Phones: menu,
  title, find.
- **Times** in the admin's desk zone (`profiles.desk`; none set → New Jersey first) with the other zone beside them,
  never UTC (`time.ts`); cycle cutoffs are typed in that zone.
- **Chips** in plain words (`chips.tsx`). **Today**: the open cycle's countdown, totals and progress, Needs attention,
  each desk's queue. **Orders**: search, chips with counts, ticked rows → Mark shipped… (one carrier and tracking
  number each) / Mark delivered, pages of 50. **Order page**: only the actions that apply; every refund and cancel (and
  a return's refund, and Record payout) asks first in a box with the amount and, for the customer's, the email they get
  (`confirm.tsx`). Marking a piece Unavailable at pickup asks first too, since the customer is emailed.
- **Cycle**: the progress bar with the next step as the main button; pickups as one card per shop (Call, WhatsApp, Map).
- **New listing in one step** (`listing/`): photos shrink to 2400 px in the browser and upload as soon as they are
  dropped, with the admin's session, to `product-media/products/drafts/<batch>/`; saving records them on the product.
  Photos dropped on a form that is then abandoned stay in that folder (unused, not shown anywhere). **Add many**: one
  draft per photo row; the shop, the fabric and the care are typed once for the batch (every draft needs them, ops.md
  §Compliance) and can be changed per piece on its page. Clothing only.

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

## Import from shops (D-110)
`/admin/import` (web only; sidebar: Catalog → Import from shops). Code: `apps/web/features/admin/import/`, the parsing
in `packages/shared/src/sourcing/`, the reads and writes in `packages/db/src/admin/sourcing.ts`.
- **Bring products in.** The **Add to IWC** bookmark (dragged once to the bookmarks bar) reads the product page the
  admin has open (Myntra's pdpData, Amazon's title, price, photos and details, any shop's schema.org JSON-LD and meta
  tags) and opens the importer in one reused tab. Big shops refuse servers, so this runs in the admin's browser.
  **Paste links** (up to 20) has the server read the pages; it works for shops that allow it and says which need the
  bookmark. Products wait in a queue (kept in that browser) and are checked one at a time.
- **Check and save.** Pre-filled, never silently decided: the state (a guess only from well-known craft and food
  names, D-004), type and category, name, summary and description (the shop's own words), the details customers must
  see (fabric and care; ingredients, allergens and shelf life; material), the photos (pick and order; copied into our
  storage on save, never loaded from the shop on a customer page, D-003), pieces per size (5 by default: a cap, the
  shop's stock is unknown), packed weight and the price on the shop in ₹, with the dollar price worked out live
  (D-109, D-119). Save draft or Publish.
- **Where it lives.** A listing of the shop's online vendor for that state (`vendors.online_site`, made on first use),
  with `products.source_url`, `source_site`, `source_checked_at`, `source_in_stock` (admin only).
- **Keeping prices right.** Importing a page again finds its listing by the cleaned address: the price, the sizes in
  stock and the check date are updated (sizes the shop no longer has stop selling; pieces already ordered stay); tick
  "Also replace" to take the new name, words and photos too. The page lists every imported listing, the one checked
  longest ago first, with a link to open it.
- **When one sells.** The cycle's pickup cards (web and app) show "Order it online" for an imported piece: the India
  desk orders it there to the hub, then marks it picked as usual. The product's page lists **Where to order it**: every
  shop item each variant can be ordered as, the one in use first ("ordered from here", D-118).
- **Variants with their own prices (D-118).** A page with a variation picker (Amazon's flavours or packs, Flipkart's
  options, Myntra's sizes, a Shopify shop's colours and sizes) is saved as one listing with a variant per item, each
  priced from its own shop price; the form lists them. Every import also records its shop items, so the weekly check
  covers it.

## Auto-sourcing (D-118)
`/admin/import/auto` (web only; linked from Import from shops). Code: `apps/web/features/admin/import/auto/`, the
rules in `packages/shared/src/sourcing/auto/`, the reads and writes in `packages/db/src/admin/auto-sourcing.ts`, the
runner in `tools/sourcing-runner/` (its README says how to set it up on the PC at the hub).
- **Targets.** "Add targets from a CSV" takes the state bestseller list as it is (columns Product, Type, IWC category,
  IWC region slug; optionally Tier, Search words, Must match); a row already there for that state is skipped. Each
  target shows its state: waiting, being searched, found (how many listings), nothing fit (with why), paused; Search
  again, Pause, Remove.
- **Found and waiting.** What the runner adds arrives as drafts (in Products → Drafts) unless "go live by themselves"
  is on. **Publish the ready** publishes every found draft with a photo and every detail customers must see (food only
  once it is cleared, D-074); the product page has **Details customers see** to finish the others.
- **Prices held for you.** A price that jumped beyond the rule stops that shop item and waits here: accept the new
  price, or stop using that shop (the next cheapest in-stock source takes over).
- **Shops.** Each shop the runner searches, the types it sells, the delivery days used when its page shows none, on or
  off, its last good run and its last problem (a shop that changed its page shows up here first).
- **Rules.** Delivery limit (days), listings per target, how often listings are checked, pieces on sale per variant,
  targets per run, the price-jump guard, and whether new listings go live by themselves.
- **Recent runs.** What each run did: targets searched, listings added, listings checked, prices and stock changed,
  prices held, problems.

