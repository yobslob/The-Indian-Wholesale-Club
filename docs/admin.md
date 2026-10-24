# Admin: hidden web panel, app admin mode, vendor accounts

Users: founder (US desk) and COO (India desk), both `role = 'admin'` with the same access (D-007, D-027).
Vendors' owners have their own sign-in to upload their pieces (D-102, built V1 – V6, §Vendor screens); every vendor upload
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
| **To order** (D-140) | `/admin/to-order`: every sold piece of a paid, open order not yet ordered from its shop, one card per shop, oldest first, with the shop item in use (the variant's source, D-118), its price at sale and now, stock and delivery days; **Order all from this shop** (Amazon's add-to-cart link, a Shopify shop's `/cart/` link; other shops open each piece) and **Mark all ordered** (one shop order number and one bill for the lot, what was paid per piece). Tabs **On the way to the hub** (At the hub with its weight, or Not ordered after all) and **At the hub, to weigh** (D-130). **7-day pieces come first** in their own lane, each with "buy in …" (2 hours from the order, red once late) and "ship in …" (the next day) (D-154). The card answers at once and comes back with a line if the server refuses | India | ✓ | ✓ (Order it online / Mark ordered on the order screen) |
| **Vendors** | onboard a shop in about a minute (name, owner, phone/WhatsApp, region, payment method, licences, photo), history; its vendor accounts with the one-time QR / link, the screens' language, switch off (D-102); "Join as a vendor?" requests | India | ✓ | ✓ |
| **Listings** | add products with the camera (`flows.md` §2), confirm quantities, drafts → live | India | ✓ (incl. the re-check list) | ✓ (new listing with the camera, publish, confirm qty; 50 with "Show more", D-067) |
| **Cycles** | current cycle timeline and dates, cutoff, per-shop pickup checklists, packing list + commercial invoice export, export/arrival | both | ✓ (closes and opens by itself, D-045; dates corrected on the cycle; orders moved in, confirmed as shipped (D-064); export details; arrival check-off; packing list + commercial invoice (print/PDF and CSV; Q-30 fields marked)) | ✓ (pickups, cutoff, next step, arrival check-off) |
| **Payouts** | payable per vendor, record payouts | India | ✓ | ✓ |
| **Orders** | all orders, detail + internal timeline, pack & ship once arrived (carrier with tracking link, D-066), refunds, delay notices, move to another cycle (D-045) | US | ✓ | ✓ (pack & ship) |
| **Regions** | edit and approve region content (greeting and its script, tagline, story, accent, image, `is_live`; changing approved text sends it back to draft, enforced in the database); the main photo uploads to `product-media/regions/<slug>/`; album photos (each with alt text, removable) to `regions/<slug>/album/` (`region_photos`, D-051); an accent below WCAG AA on the page backgrounds is refused | both | ✓ | — |
| **Catalog** | products, categories, prices, bulk edits; a product's **Heavy-item shipping** yes/no (D-155: priced on half its weight, the other half added in the bag; every home piece named a cooker starts as yes); Settings → Bag charges has its % off from the line (20); a product's state may be empty (All states, D-121; the import form offers it); **filters** within every tab (type, state or All-India, category, shop, a US price range, sort: recently updated, newest added, price both ways, name; a select applies at once without a page load, D-136); **Names to tidy** (D-140, L1: `/admin/catalog/names`): imported clothing and home listings whose names still carry
a brand or shop (guessed per shop from a start three names share, or a leading all-capital name; never a count, a
material or a product word, nor words that also turn up inside other names), beside IWC's name for them, each editable
and ticked; Rename keeps the old name as the shop title (admin only); **Rename all** (D-146) renames every proposal on every page, 250 a batch; a name that would be only a shop word ("Collections") is never proposed. D-143: only the brand or shop goes, every other
word stays; a name the first D-140 rules cut down is made again from the shop's title. New imports and the runner name
pieces this way from the start (`cleanTitle`); food keeps its brand (D-139). **For** (D-140): who a clothing piece is for, a filter (with "not set yet") and a picker in each row that saves at once; the new-listing form, Add many (per batch) and the importer (pre-filled from Myntra's gender or the name) ask for it, and a clothing listing cannot go live without it; **Download Excel** (every tab: name, Indian price, category, weight, US price and margin of that view, its filters included, D-128, D-136); a **Weight** column and the **Weights to check** tab (options with no weight, a matching item's, one recorded before sources were kept, an unusual one for the category, or a shop's weight the weight estimator doubts; weigh it or type it per option or for all sizes at once, the box already holding the estimator's suggestion; a listing goes live only when every option has its weight, D-129, D-131); **Publish all drafts** on the Drafts tab (D-120, D-146: first gives every option without a weight one, as Assign all does, then publishes every draft with a photo, an option and a piece to sell, 400 a batch; it says how many went live, what held the rest and how many still lack details customers see) and **Archive the drafts that can't go live** (no photo, no active option or nothing to sell; nothing is deleted), so Drafts holds only the next batch; **Assign all and publish** on Weights to check (D-146: clothing by class, food by its label, the rest the middle weight of the 7 most similar pieces weighed before, else the category's usual weight, marked Estimated; every weight the tab shows accepted; then Publish all drafts; batches of 40 listings with the count on screen); "Curated for you" picks per product (D-056); product photos (upload with alt text, main photo, remove) to `product-media/products/<id>/`; the pager (D-140) | both | ✓ | — |
| **Reviews** | approve or reject customer reviews before they appear (D-052, D-056); "verified buyer" is set by the database | both | ✓ | — |
| **Customers** | customer list, orders per customer | US | ✓ | — |
| **Promotions** | promo codes (kept from the old admin) | US | ✓ | — |
| **Insights** | sales by state, category and shop (with what the shops were paid), for 30 days, 90 days or all time; searches that found nothing (what to list next), top searches, most saved pieces; D-154: **7-day delivery**: orders with a 7-day shipment and split ones, where the 7-day pieces stop against the $49.99 line, on time per kind of shipment against the date promised at order (late ones with their notice sent first, ones still open past their day), 7-day pieces refunded as unavailable, the split's extra courier cost. Real numbers only, computed in SQL (`admin_sales`, `admin_demand`, `admin_quick_insights`) | both | ✓ | — |
| **Vendor pieces** | pieces vendors sent (D-102, D-103): their real photos, the AI candidates per pose, pick, name, care, price (empty = from the shop price), publish; or make a pose again on another model, ask for new photos, decline (§Vendor screens) | both | ✓ | — |
| **House models** | the founder's models (D-104): front and back pose each, switch on / off | both | ✓ | — |
| **Settings** | pricing settings, each estimate labelled with its source and date until the founder saves their own (D-047); the pilot price's two recipes, the courier rate card, the profit guard, the bulk saving and the small-food shelf ($1.99 – $3.99, D-120), with a **profit check** under them that reprices sample pieces and bags as the numbers are typed (web, D-119); **7-day delivery: Pause / Switch back on** (D-154: paused, no 7-day tags, page or split; placed orders keep their dates) (admins are managed in the DB + `ADMIN_EMAILS`, `ops.md`) | both | ✓ | — |

**The order page (D-140):** each piece says where it stands (To order → Ordered → At the hub → In the US; a shop's piece
in a cycle reads To pick), with **Order it ↗** (the shop item in use) and **Mark ordered…** (paid ₹, the shop's order
number, a bill photo or PDF; Undo while it is not at the hub), and its cost and margin under its price. **Shop bill ·
invoice C** below the pieces: a row per piece at the price paid, Delivery, extra rows (a packing fee, a coupon as a
minus), the total as it is typed, a note; photos of the bill dropped, picked, taken with the camera or pasted (Ctrl+V),
kept in the private `vendor-docs` bucket; Save draft, Mark final (locked), Reopen (logged). **Money** adds our landed
cost (invoice B: shop ₹ ÷ 0.90 + weight × ₹2 a gram, × quantity, from the cost snapshot; provisional until every piece
is weighed at the hub), the shop bill, and the margins A − B (not shown until every piece has a cost) and A − C, on
what was paid less tax and refunds. **Print A / B / C** (`/admin/orders/<id>/invoice/a|b|c`): numbered A-, B-, C- and
the order number, to print or save as PDF; refunds show on A as a credit note. The customer prints invoice A from their
order page (the page prints only the invoice).
**Two shipments (D-154):** an order whose 7-day pieces travel apart carries a **7-day** chip (Orders list and page) and,
on its page, a **Shipments** panel: each shipment with its pieces, promised dates and the days left, its Shipping share,
the 7-day one's buy-by and ship-by while open, its own **Pack & ship** (from the hub once its pieces are there) and
**Mark delivered**, its own **New dates…** (the delay notice) and its own **Cancel shipment N…** (the customer asked,
or because of us, with the amount first; a 7-day shipment only until its pieces are bought). The order-wide date
change and the bulk ship stop for such an order; the whole-order cancel "because the customer asked" disappears once
the 7-day pieces are bought. The timeline names the shipment. **Today** (India desk, first): 7-day shipments to send,
with how many were not bought within 2 hours or not shipped by the next day. The app's order screen sends an order of
two shipments to the web admin. Emails: the confirmation lists Shipment 1 and Shipment 2 with their dates and pieces;
each shipment's shipped, delivered, new-date and cancelled email names it and shows its pieces.
**New orders (D-140, A1):** every paid order emails each admin on the allowlist (`admin_new_order`: number, pieces,
total, where it goes, a button to it); an open admin panel shows a toast with a short chime. App push notifications are
not built (no `expo-notifications` yet).
The order page refunds unavailable pieces and cancels orders before cutoff, with the amounts from the D-042 rules shown on
the buttons (Stripe first, then the database). Since D-140 (A5) the app's order screen refunds an unavailable piece too, through the website's `POST /admin/refund` (the
admin's own token; the Stripe key stays on the server); cancels stay on the web panel.

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
- **Today in the made-to-order pilot (D-140, A2):** with no cycle open (D-115) there is no "customers cannot check out"
  warning; the India desk's queue starts with Pieces to order (and how long the oldest has waited), Ordered on the way
  to the hub, At the hub to weigh and Prices held for you; cycle pickups and the hand re-check of shop quantities show
  only while a cycle is open (imported listings are re-checked by the runner, D-118); the US desk's first job is Orders
  in the US to send on.
- **Times** in the admin's desk zone (`profiles.desk`; none set → New Jersey first) with the other zone beside them,
  never UTC (`time.ts`); cycle cutoffs are typed in that zone.
- **The pager (D-140, `pager/`)** on every list (Products and its tabs, Imported listings, Targets, Prices held,
  Orders, Customers, Reviews, Returns, Vendor pieces): "1–50 of 3,412" from an exact count of the filtered rows, page
  numbers with gaps, Previous / Next, Go to page, 25 / 50 / 100 a page (remembered per list in a cookie), ← / → turn
  pages when no field has focus; `?page=` and `?size=` sit in the address with the filters, so Back and links work.
  Paging is a soft navigation (the scroll stays) with the running stitch along the top while it loads; table headers
  stay under the top bar on wide screens. Search runs on the server over every row. No list stops silently at a
  limit (the API's 1,000-row cap included: target counts are head counts).
- **Chips** in plain words (`chips.tsx`). **Today**: the open cycle's countdown, totals and progress, Needs attention,
  each desk's queue. **Orders**: search, chips with counts, ticked rows → Mark shipped… (one carrier and tracking
  number each) / Mark delivered, pages of 50. **Order page**: only the actions that apply; every refund and cancel (and
  a return's refund, and Record payout) asks first in a box with the amount and, for the customer's, the email they get
  (`confirm.tsx`). Marking a piece Unavailable at pickup asks first too, since the customer is emailed.
- **Cycle**: the progress bar with the next step as the main button; pickups as one card per shop (Call, WhatsApp, Map).
- **Weighing at the hub (D-130)**: a weight box (g, one piece, packed; optional) next to every Picked (cycle cards and the
  order page, web and app) and "Weigh it" under a picked piece not yet weighed; the card then shows what it changed
  (the weight it replaced and the new price). The order page also shows Picked for pieces without a cycle (the pilot).
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
  storage on save, never loaded from the shop on a customer page, D-003; a picture the shop shows twice is kept once,
  full size, D-142), pieces per size (5 by default: a cap, the
  shop's stock is unknown), packed weight and the price on the shop in ₹, with the dollar price worked out live
  (D-109, D-119). The weight says where it came from (the page's packed, item or net weight, an item's pack, or typed)
  and what on the page contradicts it; without one it saves as a draft (D-129). Save draft or Publish.
- **Where it lives.** A listing of the shop's online vendor for that state (`vendors.online_site`, made on first use),
  with `products.source_url`, `source_site`, `source_checked_at`, `source_in_stock` (admin only).
- **Keeping prices right.** Importing a page again finds its listing by the cleaned address: the price, the sizes in
  stock and the check date are updated (sizes the shop no longer has stop selling; pieces already ordered stay); tick
  "Also replace" to take the new name, words and photos too. **Imported listings** (`/admin/import/listings`, its own
  tab since D-140) lists every imported listing with the pager, search and filters (shop, state, type, status, not
  checked for a week / a month), the one checked longest ago first unless sorted otherwise, with a link to open it.
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
- **Targets.** "Add targets from a CSV" takes the state bestseller list as it is (columns Product, Type, IWC category;
  optionally IWC region slug, Tier, Search words, Must match, Shops, Min ₹, Max ₹, Listings); a row already there for
  that state is skipped. D-121: an empty state or "all" is **all states** (its listings carry no state and fill every
  state's page); Shops limits it to those shops ("myntra"); Min ₹ / Max ₹ keep only shop prices inside the band (colours
  outside it are left out); Listings is how many to make instead of the setting. A page that names another country of
  origin is never listed (D-004). `tools/sourcing-runner/targets/myntra-600-1600.csv` is the Myntra ₹600 – ₹1,600
  clothing list (79 targets, about 1,170 listings; footwear ₹400 – ₹900, D-122); `food-by-state.csv` is the food of every
  state from the founder's list (753 targets, 6 listings each, D-122); `nishorama.csv` is Nishorama's whole catalogue
  (18 targets, 40 listings each). D-137 (drafts to review before uploading): `food-under-300.csv` is food ₹1 – ₹300
  without dairy (172 targets, about 2,950 listings; Must match leaves out titles naming milk, ghee, paneer and the
  like), `home-amazon-flipkart.csv` home & gifts on Amazon and Flipkart (94 targets, about 1,990 listings). D-138:
  `home-festive-amazon-900.csv` is home & gifts on Amazon only, ₹1 – ₹900, festivals first (185 targets, up to 3,790
  listings; Must match leaves out lit, battery, cow dung and feather pieces, fireworks and food hampers). D-139:
  `food-branded-200.csv` is branded snacks, biscuits, chocolates, instant food, masalas and tea, ₹1 – ₹200, every food
  shop (119 targets, up to 1,410 listings; dairy products, meat, frozen food and liquids left out). Amazon and
  Flipkart searches use the shop's own price filter and read one result page per 10 listings a target wants (up to
  four). Zepto and Instamart are read from their own search answer (one page) and their item pages' data, each pack an
  option (D-152). For a Shopify shop, Search words may name one of its collections, `collection:kurtis`:
  the whole collection (up to 250 pieces; Shopify's search stops at 10) is the target, every piece in it matches, and
  several targets on one collection take the next 40 each (run one after another). A target whose search failed on
  every shop (blocked, "too many requests") goes back to the queue; the Nothing fit view has **Search all again**. A
  shop's robot check only fails that page; no shop rests or is paced (D-158): a target left empty by a refusal goes
  back to the queue, a refused listing keeps its price and stock, nothing is marked nothing fit or out of stock (D-149,
  the runner's README). One run takes every queued target, a claim of Targets per run at a time, until none is left. A target uploaded again is
  not added twice but takes the row's shops it lacked, never fewer (D-150: the 7-day targets, Blinkit only, then
  `7-day-four-shops.csv`). Each
  target shows its state: waiting, being searched, found (how many listings), nothing fit (with why), paused; Search
  again, Pause, Remove.
- **Found and waiting.** What the runner adds arrives as drafts (in Products → Drafts) unless "go live by themselves"
  is on. **Publish the ready** publishes every found draft with a photo and every detail customers must see (food only
  once it is cleared, D-074); the product page has **Details customers see** to finish the others.
- **Prices held for you.** A price that jumped beyond the rule stops that shop item and waits here: accept the new
  price, or stop using that shop (the next cheapest in-stock source takes over).
- **7-day delivery (D-148).** `sourcing_shops.quick_delivery` marks the shops whose pieces reach the hub within the
  hour (Blinkit, BigBasket, Zepto, Instamart; set by the migration, no screen yet); a live listing whose every option
  on sale is bought there is a 7-day piece on the store. Settings → Standard delivery → "7-day delivery: days from the
  order" holds the promise (7 and 7; empty switches it off). The first batch: `tools/sourcing-runner/out/blinkit-7-day.csv`
  (gitignored; 113 Blinkit targets, up to 2,972 listings, only what can be sent: no dairy, meat, eggs, frozen food,
  liquids, honey, oils, electronics, lights, batteries, cow dung, feathers, fireworks, camphor, loose powders, lighters
  or matches), added through Add targets from a CSV and run with `pnpm sourcing run --type food` / `--type home`.
- **Shops.** Each shop the runner searches, the types it sells, the delivery days used when its page shows none, on or
  off, its last good run and its last problem (a shop that changed its page shows up here first).
- **Rules.** Delivery limit (days), listings per target, how often listings are checked, pieces on sale per variant,
  targets per run, the price-jump guard, and whether new listings go live by themselves.
- **Recent runs.** What each run did: targets searched, listings added, listings checked, prices and stock changed,
  prices held, problems.
- **Weights (D-129).** Each run ends by filling the weights listings lack (`pnpm sourcing run --weights` does only
  that): the listing's own shop pages first, then the same item on Amazon and Flipkart (two pages must agree). It never
  overwrites a weighed or typed weight, and a shop's own page replaces an estimate; what it cannot find waits in
  Products → Weights to check.
- **Clothing classes (D-132).** Every run sorts new clothing by the name rules into the founder's classes (light
  350 g, medium 750 g, pants and footwear 800 g, heavy 1.5 kg); on the laptop `pnpm weights classes` sorts all
  clothing (the model sorts a name no rule reads) and writes `clothing-classes.csv` for review. A weighed or typed
  weight stays; the product page shows "Clothing class (D-132)" and why.
- **Food's net weight (D-133, D-135).** Every food option is priced on the net quantity its label states, no
  packaging: read from its options, label, the shop page's net quantity or its name, unit by unit ("2 × 200 g" is
  400 g), millilitres by density. The order: the hub's scale, then an admin's weight, then this. New food gets it when
  the runner adds it; each run (and `pnpm sourcing food`, `--all` to redo every one) works out every food listing not
  yet done; `pnpm weights food --dry` on the laptop writes `food-weights.csv` (every option, its net quantity, old and
  new weight). An option no label states keeps what it has (the page search above, then the hub). An admin's typed
  weight cannot replace one weighed at the hub: the weight box asks to weigh it again. The product page shows the
  source "Net weight on its label (D-135)" and where it was read.
- **Liquids are not sent (D-135).** The runner checks every food and home listing once (each new one as it adds it,
  the rest at the end of each run; alone: `pnpm sourcing liquids --dry`): a liquid (a juice, sharbat, soda, oil,
  syrup, sauce, attar, rose water, anything sold by the ml or litre, or a page saying "Item Form: Liquid"; never
  pickles, pastes or powders) is archived and shown to customers as **coming soon**: no price, no Add, the heart to
  save it. Products → Archived marks it "coming soon on the store"; its page says why and has **Hide it from the
  store** / **Show it as coming soon**. Publishing it again ends its coming soon, and the check never undoes that.
- **Home & gifts from their own pages (D-134).** Each run (and `pnpm sourcing home`, `--dry` for the sheet
  `tools/sourcing-runner/home-weights.csv`) reads every home option's own page (on Amazon each size and colour is its
  own item, with its "Item details" and "Measurements" dropdowns, now read by the capture too): the packed weight
  (Item Package Weight, Package Dimensions "…; 640 g") as it is, else the piece's own weight (Item Weight, Product
  Dimensions) plus its packing by what it is made of (glass, ceramic, terracotta, marble: a box with wrapping; art and
  frames: a flat box; textiles: a poly bag; wood and metal: a box). Every reading is checked: a package lighter than
  its piece, or a weight impossible for its box size (a "1 g" brass lamp), is not priced and is marked for the hub.
  An option without its own page takes another option's (similar); a listing no page weighs is looked up on Amazon and
  Flipkart (two must agree). The box's weight by size is kept in the note for Q-36. The hub's scale, then an admin's
  weight, come first; customers never see a home weight.
- **The weight estimator (D-131), food and home & gifts.** On the founder's laptop: `pnpm weights run` gives every option without a weight a
  packed weight from a local model on the GPU, checked against the most similar weights IWC knows (weighed at the hub
  first). A sure one becomes the weight (source "Estimated"); an unsure one is a suggestion in Weights to check.
  `--audit` compares the shops' weights, `--redo` re-estimates after many weighings, `eval` says how close it comes
  (`tools/weight-estimator/README.md`).

## Vendor screens: a shop's own sign-in (D-102, D-103; was §Vendor screens)

Users: a vendor's owner (the founder's "retailer"; glossary: **vendor account**). They upload their own pieces and
see only their own: never a customer, another vendor, the customer price or IWC's costs (INV-10). Every vendor read is
a `vendor_*` database function filtered by the caller's vendor (`data-model.md`); the base tables stay admin-only.

### Access
- **Web** `/vendor` (`apps/web/app/vendor/`, code in `features/vendor/`): never linked from the store, `noindex`, its
  own route group (its code loads only there). Lint keeps vendor code out of the storefront and admin code out of
  vendor pages (`apps/web/.eslintrc.js`).
- **Sign-in:** an admin makes the account on the Vendors page and shows its one-time QR code / link (works once, 7
  days; a new one replaces the old). Opening it signs the phone in: the website's server redeems the code
  (`/vendor/api/sign-in`, rate-limited, service role) and hands back a token the browser turns into a session. No
  password, no SMS. Every page checks `is_vendor()` on the server (`features/vendor/guard.ts`).
- **"Join as a vendor?"** only on the vendor sign-in page (`/vendor/join`, never on a customer surface, D-003): shops in
  India pick their state; a US store's request waits for Q-35. Requests land on the admin's Vendors page.
- **App** (`apps/app/app/vendor/`, `features/vendor/`): the same screens as a vendor mode, mounted only after the
  server confirms `is_vendor()` (`lib/session.tsx`); the customer tabs send a vendor there. Sign-in by the code on
  `vendor-login` (opened by the app link `iwc://vendor-login?code=…`, or typed), redeemed by the website's server
  (D-043); never linked from a customer screen. Photos from the camera or the gallery, checked on the phone like the
  website (`jpeg-js` reads the pixels). The language switch is kept on the phone. Lint keeps vendor and customer
  code apart (`apps/app/.eslintrc.js`).

### Screens (phone first: one job per screen, pictures before words, 44 px+ targets)
| Screen | Route | What |
|---|---|---|
| Home | `/vendor` | four tiles: Add a piece, Keep ready (count), My pieces (retakes asked), Money (₹ owed) |
| Add a piece | `/vendor/new` | what it is (category tiles) and who wears it → front, back, close-up photos one at a time with an outline, each checked at once on the phone (`@repo/shared/vendor` `checkPhoto`: size, light, blur) and sent as soon as it is taken → sizes with + / −, the shop price in ₹, optional fabric / care / colour → Send |
| My pieces | `/vendor/pieces`, `/vendor/pieces/[id]` | what was sent and what is in the store, with a picture of its state; a piece IWC asked about opens the same steps with what it has, so only the needed photos are taken again |
| Keep ready | `/vendor/ready` | ordered pieces IWC will collect: piece, size, how many, "after <cutoff>" (never who bought them) |
| Money | `/vendor/money` | owed in ₹ for collected pieces, the latest collected pieces, payouts |

**Languages (D-102, D-105):** English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi,
Odia and Assamese (`@repo/shared/vendor` `messages/`); a region whose language is not among them gets Hindi. The
switch on every screen offers English, Hindi and the shop's region language (kept in a cookie on the web, on the
phone in the app). Every language but English is a Claude draft until someone fluent checks it; a unit test keeps
every word and its {placeholders} in each.

### Photos (D-100, D-101, D-104)
The vendor's photos go to the private `vendor-uploads` bucket, shrunk to 2400 px on the phone. The GPU worker
(`tools/photo-worker`) makes three candidates per pose on a house model; the admin picks on **Vendor pieces**
(`/admin/vendor-pieces`), writes the English name and care, and publishes. The picked photos and the real close-up are
copied to `product-media` (the AI ones flagged `is_ai`, so the product's Details say so); the candidates and the raw
photos are then deleted.
