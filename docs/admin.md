# Admin: hidden web panel and app admin mode

Users: founder (US desk) and COO (India desk), both `role = 'admin'` with the same access (D-007, D-027).
Listings are imported from online shops (D-110, §Import from shops) and by the sourcing runner (D-118, §Auto-sourcing).
Vendor screens, cycles, payouts and the rest that went with D-187: `docs/archive/retired-2026-11-simple-store.md`.

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
- Only if the server says yes does it mount the admin navigator (Today · Orders · Listings · More, D-097, D-187) in
  place of the customer tabs; anyone else opening `/admin` is sent to the store. The admin's Today screen has "View the
  store"; the Profile tab then shows "Back to admin", rendered only for that server-confirmed admin.
- Admin screens are bundled in the app binary (mobile apps can't hide code), so all protection is server-side, as on the web (D-043):
  every admin read and write goes through `@repo/db/admin` with the user's own session, and RLS refuses non-admins (INV-7).
  The customer screens can't import admin code (lint rule in `apps/app/.eslintrc.js`).
- The app admin writes straight to the database, then names what moved in `POST /admin/revalidate`, and the website
  refreshes only those pages (D-189, `engineering.md` §Caching). Anything else catches up within the day's fallback.

## Desks (D-007)
`profiles.desk` orders Today (C7): the admin's own desk's jobs first (India: food shipments, pieces to order, on the way, to
weigh, prices held, drafts, re-checks; US: orders to ship, returns), the other desk's below. Both admins can open every
section (D-027). Today also shows new orders and order status changes live (Supabase Realtime on `orders`, PR-7), website
and app, and a "Needs attention" card when there are recent server errors, payments to check, open disputes or stuck
customer emails (B-8). App admin writes refresh the website's store pages at once (`POST /admin/revalidate`, B-17).

## Sections (web skeleton since R5: working screens on real data, plain styling)
| Section | Job | Main desk | Web | App |
|---|---|---|---|---|
| **Today** | what needs doing now: the food watch (food shipments not bought within 2 hours, not shipped by the next day), pieces to order, on the way, to weigh, prices held, drafts, stale listings (always shown since D-187; the pilot hid them), orders to ship, returns, payments to check, disputes | both | ✓ | ✓ |
| **To order** (D-140) | `/admin/to-order`: every sold piece of a paid, open order not yet ordered from its shop, one card per shop, oldest first, with the shop item in use (the variant's source, D-118), its price at sale and now, stock and delivery days; **Order all from this shop** (Amazon's add-to-cart link, a Shopify shop's `/cart/` link; other shops open each piece) and **Mark all ordered** (one shop order number and one bill for the lot, what was paid per piece). Tabs **On the way to the hub** (At the hub with its weight, or Not ordered after all) and **At the hub, to weigh** (D-130). **Food comes first** in its own lane, each piece with "buy in …" (2 hours from the order, red once late) and "ship in …" (the next day) (D-154, D-187). A piece with no site groups under "Shop not known". The card answers at once and comes back with a line if the server refuses | India | ✓ | ✓ (Order it online / Mark ordered on the order screen) |
| **Listings** | `/admin/listings`: the Re-check tab, live variants not re-confirmed within the stale-listing days, 50 at a time. New listings come from the importer and the runner (plan §10 Y-4: no camera, no New listing, no Add many); a listing's own page edits it. Drafts are under Products | India | ✓ | ✓ (Drafts / Live / Paused; a listing's screen publishes, pauses and confirms pieces) |
| **Orders** | all orders, detail + internal timeline, pack & ship (carrier with tracking link, D-066), refunds, delay notices | US | ✓ | ✓ (pack & ship) |
| **Regions** | edit and approve region content (greeting and its script, tagline, story, accent, image, `is_live`; changing approved text sends it back to draft, enforced in the database); the main photo uploads to `product-media/regions/<slug>/`; album photos (each with alt text, removable) to `regions/<slug>/album/` (`region_photos`, D-051); an accent below WCAG AA on the page backgrounds is refused | both | ✓ | — |
| **Home photos** | D-169: the only photos in Home's drifting mosaic (`home_photos`, up to 60): choose many at once, each with its line (alt text, started from the file's name), uploaded one by one to `product-media/home/album/` (8 MB each); the grid is Home's own layout: drag a photo onto another tile or move it earlier, later, first or last, then Save order; change a line or remove a photo (its files too); Home's cache entry refreshed once per batch | both | ✓ | — |
| **Catalog** | products, categories, prices, bulk edits; a product's **Heavy-item shipping** yes/no (D-155: priced on half its weight, the other half added in the bag; every home piece named a cooker starts as yes); Settings → Bag charges has its % off from the $99.99 line (20); a product's state may be empty (All states, D-121; the import form offers it); **filters** within every tab (type, state or All-India, category, shop (`source_site`, the shops of `sourcing_shops`), a US price range, sort: recently updated, newest added, price both ways, name; a select applies at once without a page load, D-136); **Categories to check** (D-159: `/admin/catalog/categories`): food and home listings whose names plainly say another category of their type, with that category ticked and changeable (Move the ticked), and the ones not their type at all (pet food, hair oil, rakhis, Mysore pak under Home & gifts) to archive; the sourcing runner skips such results; **Names to tidy** (D-140, L1: `/admin/catalog/names`): imported clothing and home listings whose names still carry
a brand or shop (guessed per shop from a start three names share, or a leading all-capital name; never a count, a
material or a product word, nor words that also turn up inside other names), beside IWC's name for them, each editable
and ticked; Rename keeps the old name as the shop title (admin only); **Rename all** (D-146) renames every proposal on every page, 250 a batch; a name that would be only a shop word ("Collections") is never proposed. D-143: only the brand or shop goes, every other
word stays; a name the first D-140 rules cut down is made again from the shop's title. New imports and the runner name
pieces this way from the start (`cleanTitle`); food keeps its brand (D-139). **For** (D-140): who a clothing piece is for, a filter (with "not set yet") and a picker in each row that saves at once; the importer (pre-filled from Myntra's gender or the name) asks for it, and a clothing listing cannot go live without it; **Download Excel** (every tab: name, Indian price, category, weight, US price and margin of that view, its filters included, D-128, D-136); a **Weight** column and the **Weights to check** tab (options with no weight, a matching item's, one recorded before sources were kept, an unusual one for the category, or a shop's weight the weight estimator doubts; weigh it or type it per option or for all sizes at once, the box already holding the estimator's suggestion; a listing goes live only when every option has its weight, D-129, D-131); **Publish all drafts** on the Drafts tab (D-120, D-146: first gives every option without a weight one, as Assign all does, then publishes every draft with a photo, an option and a piece to sell, 400 a batch; it says how many went live, what held the rest and how many still lack details customers see) and **Archive the drafts that can't go live** (no photo, no active option or nothing to sell; nothing is deleted), so Drafts holds only the next batch; **Assign all and publish** on Weights to check (D-146: clothing by class, food by its label, the rest the middle weight of the 7 most similar pieces weighed before, else the category's usual weight, marked Estimated; every weight the tab shows accepted; then Publish all drafts; batches of 40 listings with the count on screen); "Curated for you" picks per product (D-056); product photos (upload with alt text, main photo, remove) to `product-media/products/<id>/`; the pager (D-140). **Names to tidy and Rename all stay until production's count is 0** (plan Y-11: the founder's call) | both | ✓ | — |
| **Reviews** | approve or reject customer reviews before they appear (D-052, D-056); "verified buyer" is set by the database | both | ✓ | — |
| **Customers** | customer list, orders per customer | US | ✓ | — |
| **Promotions** | promo codes (kept from the old admin) | US | ✓ | — |
| **Insights** | sales by state, category and shop (the shop is the site, `products.source_site`), for 30 days, 90 days or all time; searches that found nothing (what to list next; since D-160 also those that found only some of their words), top searches, most saved pieces. Searches are kept for 90 days (`iwc-tidy`, plan Y-13), so the search section says so; sales come from orders and keep All time; D-160: **found after a spelling fix** (the customer's words search read as the nearest listed word) with **Add … = …** (web only), which makes the customer's word a synonym (`admin_add_synonym`). Real numbers only, computed in SQL (`admin_sales`, `admin_demand`, `admin_search_fixes`) | both | ✓ | — |
| **Settings** | one list (`features/admin/settings-fields.ts`, `pilot-numbers.md`): Prices, Bag charges (Free shipping from, Bulk saving and heavy-item discount from), Delivery (food and clothing/home delivery days, "business days"; Already in the US, calendar days), After the sale, Listings. A save writes only what changed, and an unchanged form refreshes no store page (admins are managed in the DB + `ADMIN_EMAILS`, `ops.md`) | both | ✓ | — |

**The order page (D-140):** each piece says where it stands (To order → Ordered → At the hub; the "In the US" chip stays
only for old rows, `flows.md` §4; a piece with no pickup reads Already in the US), with **Order it ↗** (the shop item in use) and **Mark ordered…** (paid ₹, the shop's order
number, a bill photo or PDF; Undo while it is not at the hub), and its cost and margin under its price. **Shop bill ·
invoice C** below the pieces: a row per piece at the price paid, Delivery, extra rows (a packing fee, a coupon as a
minus), the total as it is typed, a note; photos of the bill dropped, picked, taken with the camera or pasted (Ctrl+V),
kept in the private `vendor-docs` bucket; Save draft, Mark final (locked), Reopen (logged). **Money** adds our landed
cost (invoice B: shop ₹ ÷ 0.90 + weight × ₹2 a gram, × quantity, from the cost snapshot; provisional until every piece
is weighed at the hub), the shop bill, and the margins A − B (not shown until every piece has a cost) and A − C, on
what was paid less tax and refunds. **Print A / B / C** (`/admin/orders/<id>/invoice/a|b|c`): numbered A-, B-, C- and
the order number, to print or save as PDF; refunds show on A as a credit note. The customer prints invoice A from their
order page (the page prints only the invoice).
**Two shipments (D-154, D-187):** a split order carries a chip (Orders list and page) and, on its page, a **Shipments**
panel, Food and Clothing and home (old orders: Express): each shipment with its pieces, promised dates and the days left,
its Shipping share, the food one's buy-by and ship-by while open, its own **Pack & ship** (once its pieces are at the hub)
and **Mark delivered**, its own **New dates…** (the delay notice) and its own **Cancel shipment N…** (the customer asked,
or because of us, with the amount first; a food shipment only until its pieces are bought). The order-wide date change and
the bulk ship stop for such an order; the whole-order cancel "because the customer asked" disappears once the food pieces
are bought. The timeline names the shipment. **Today** (India desk, first): food shipments to send, with how many were not
bought within 2 hours or not shipped by the next day. The app's order screen sends an order of two shipments to the web
admin. Emails: the confirmation lists Shipment 1 (food) and Shipment 2 with their dates and pieces; each shipment's shipped,
delivered, new-date and cancelled email names it and shows its pieces.
**New orders (D-140, A1):** every paid order emails each admin on the allowlist (`admin_new_order`: number, pieces,
total, where it goes, a button to it); an open admin panel shows a toast with a short chime. App push notifications are
not built (no `expo-notifications` yet).
The order page refunds unavailable pieces and cancels orders before they ship, with the amounts from the D-042 rules shown on
the buttons (Stripe first, then the database). Since D-140 (A5) the app's order screen refunds an unavailable piece too, through the website's `POST /admin/refund` (the
admin's own token; the Stripe key stays on the server); cancels stay on the web panel.

**App admin mode, what each screen does (D-097, D-187, on the web's look):** four tabs with counts of what waits (Orders to
ship, Drafts) and a search button on each that opens **quick find** (`find`: orders, products, customers); times in the
desk's zone and plain chips (`@repo/shared/admin`, one source with the web panel). **Today**: Needs attention, the desk's
queue with one big button per job, live orders, View the store. **Orders**: search, chips with counts, cards; a long press
selects, with Mark shipped… (a sheet, one tracking number each; the database refuses unpicked ones and the sheet reports them)
and Delivered (asks first). **Order** (`order/[id]`): pieces with photos and where each stands, Order it / Mark ordered, at the
hub and weigh (`hub-weigh.tsx`, `piece-order.tsx`), Call / Text / Email, the timeline, the one main action at the bottom
(Pack & ship sheet, Mark delivered); refunds of an unavailable piece through the website; cancels and new delivery dates on
the web panel. **Listings**: Drafts / Live / Paused with what each draft still needs; a listing's screen (`listing/[id]`)
publishes, pauses and confirms pieces. **More**: View the store, Sign out. No camera listing (web and runner only; the
camera permission is off in app 1.1.0). **The old app 1.0.0's admin mode breaks with this release** (`docs/release-simple-store.md`).

**Not built yet:** customer emails for refunds and cancellations from the app, delay warnings on Today, bulk edits of
products (orders: bulk ship / deliver since B7), category editing, a queue of hub orders ready to ship (`flows.md` §6). In the
app: refunds other than an unavailable piece, editing a listing's text.

## The web admin's look and daily screens (B7, D-096)
Built 2026-10-09 from the approved admin mockups (code in `apps/web/features/admin/`; the mockups are in `C:\kod\iwc-removed-2026-11-04\design.zip`):
- **Frame** (`frame.tsx`): the sidebar grouped Daily · Catalog · People with counts of what waits (`getWaitingCounts`);
- **Frame** (`frame.tsx`): the sidebar grouped Daily · Catalog · People with counts of what waits (`getWaitingCounts`);
  the top bar with **quick find** (Ctrl+K: `adminQuickFind`, five each of orders, products, customers), the
  title, find.
- **Today (D-140, A2, D-187):** the India desk's queue starts with food shipments to send (the food watch), then Pieces to
  order (and how long the oldest has waited), Ordered on the way to the hub, At the hub to weigh, Prices held for you, drafts
  and the re-check of quantities; the US desk's first job is Orders in the US to send on. That count is status `arrived`,
  which only US-clearance orders reach: a hub order ready to go is found on its order page (`flows.md` §6).
- **Times** in the admin's desk zone (`profiles.desk`; none set → New Jersey first) with the other zone beside them,
  never UTC (`time.ts`).
- **The pager (D-140, `pager/`)** on every list (Products and its tabs, Imported listings, Targets, Prices held,
  Orders, Customers, Reviews, Returns): "1–50 of 3,412" from an exact count of the filtered rows, page
  numbers with gaps, Previous / Next, Go to page, 25 / 50 / 100 a page (remembered per list in a cookie), ← / → turn
  pages when no field has focus; `?page=` and `?size=` sit in the address with the filters, so Back and links work.
  Paging is a soft navigation (the scroll stays) with the running stitch along the top while it loads; table headers
  stay under the top bar on wide screens. Search runs on the server over every row. No list stops silently at a
  limit (the API's 1,000-row cap included: target counts are head counts).
- **Pages that never break (2026-10-31):** the frame shows at once; the sidebar's counts stream in and a failed count
  only leaves its number off. A page whose reads fail keeps the frame and says "This page did not load … Load again"
  (`(panel)/error.tsx`; before, any failed read anywhere gave the bare "Something went wrong / Try again" page); opening
  a page shows "Loading…" inside the frame at once (`(panel)/loading.tsx`). The slow parts of Products (tab counts,
  rows, Weights to check, Names to tidy, Categories to check) and Listings (tab counts, Re-check, now paged) each load
  in their own `Section` (`features/admin/section.tsx`): heading, tabs and filters show first, and a part whose read
  fails says so with **Load again** while the rest stays (tabs fall back to tabs without numbers). New slow parts go in a
  `Section`; a part takes the client from `requireAdminPage()` (one check per request), never as a prop.
- **Chips** in plain words (`chips.tsx`). **Today**: Needs attention, each desk's queue. **Orders**: search, chips with
  counts, ticked rows → Mark shipped… (one carrier and tracking number each; only `arrived` orders) / Mark delivered, pages of
  50. **Order page**: only the actions that apply; every refund and cancel (and a return's refund) asks first in a box with the
  amount and, for the customer's, the email they get (`confirm.tsx`). Marking a piece Unavailable asks first too, since the
  customer is emailed.
- **Weighing at the hub (D-130)**: a weight box (g, one piece, packed; optional) next to At the hub (the order page and To
  order's At the hub, to weigh; web and app) and "Weigh it" under a piece not yet weighed; the card then shows what it changed
  (the weight it replaced and the new price).


## Payment test (web, 2026-11-03; kept by D-188)
`/admin/settings/payment-test`, linked from nowhere, admin only (the panel's server check): whether the Stripe account
behind the deployment's keys is live, can take payments and pay out, where payouts go (bank or debit card, last four),
its balance and what Stripe still asks for; then **Make a $1 test payment** through the store's own card form
(`PaymentForm`, so the domain's security rules and the live publishable key are tested too) and the result read back
from Stripe: status, card brand and last four, **Refund this $1** (Stripe keeps its fee). Test payments carry
`metadata.kind = 'admin_test'`: the webhook skips them (the kind lives in `features/checkout/test-payment.ts`) (no order, no "Paid, but no order" alert), the payment sweep
never sees them (no stored checkout), and only this page refunds them.

## Design principles for the admin
1. **One screen per job.** To order is one list per shop, not a table with filters.
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
- **Where it lives.** A listing with `products.source_url`, `source_site`, `source_checked_at`, `source_in_stock` (admin
  only). The importer sends the state (or none), source link and site; there is no vendor row (D-187).
- **Keeping prices right.** Importing a page again finds its listing by the cleaned address: the price, the sizes in
  stock and the check date are updated (sizes the shop no longer has stop selling; pieces already ordered stay); tick
  "Also replace" to take the new name, words and photos too. **Imported listings** (`/admin/import/listings`, its own
  tab since D-140) lists every imported listing with the pager, search and filters (shop, state, type, status, not
  checked for a week / a month), the one checked longest ago first unless sorted otherwise, with a link to open it.
- **When one sells.** To order (web and app) shows the piece under its shop with its link: the India desk orders it there to
  the hub. The product's page lists **Where to order it**: every shop item each variant can be ordered as, the one in use
  first ("ordered from here", D-118).
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
  shop (119 targets, up to 1,410 listings; dairy products, meat, frozen food and liquids left out). D-162:
  `diwali-home-gifts.csv` is Diwali's home & gifts (100 targets, up to 1,515 listings, every name "Diwali: …"): 25 on
  the four fast shops (no band), 36 all-India and 39 state crafts on Amazon and Flipkart (₹1 – ₹900); Must
  match leaves out lit, battery and plug pieces, fireworks, camphor, matches, cow dung, feathers, loose colours, samagri
  kits, hampers, food and pure silver coins; a state only for a handmade craft the title names (Q-47). D-167:
  `diwali-outfits.csv` is Diwali's clothing (63 targets, up to 860 listings, every name "Diwali: …"), as the Myntra list:
  Myntra, ₹600 – ₹1,600, footwear ₹400 – ₹900: women's, men's and kids' festive wear and 22 state weaves and crafts, a
  state only for a handloom or hand-made piece whose title names it and never says style, art silk or print (Q-48). D-171:
  `savana.csv` (418 targets) and `newme.csv` (237 targets) are those two shops whole, 40 listings a row, no band: Search
  words name a department (Savana: its activity id, `collection:12825 pages:1-3`, 20 pieces a page) or collection
  (NEWME: `collection:dresses pages:1-2`, 30 a page) and its pages, best sellers first. On these two shops only, a piece
  whose page says another country (China) is listed with it and shows customers "Imported" (D-004 elsewhere); Savana's
  pages have no care: it is given from the fabric where certain and the rest is left out (D-172). Amazon and
  Flipkart searches use the shop's own price filter and read one result page per 10 listings a target wants (up to
  four). Zepto and Instamart are read from their own search answer (one page) and their item pages' data, each pack an
  option (D-152). For a Shopify shop, Search words may name one of its collections, `collection:kurtis`:
  the whole collection (up to 250 pieces; Shopify's search stops at 10) is the target, every piece in it matches, and
  several targets on one collection take the next 40 each (run one after another). A target whose search failed on
  every shop (blocked, "too many requests") goes back to the queue; the Nothing fit view has **Search all again**. A
  shop's robot check only fails that page; no shop rests or is paced (D-158): a target left empty by a refusal goes
  back to the queue, a refused listing keeps its price and stock, nothing is marked nothing fit or out of stock (D-149,
  the runner's README). One run takes every queued target, a claim of Targets per run at a time, until none is left. A target uploaded again is
  not added twice but takes the row's shops it lacked, never fewer (D-150: the Blinkit targets, Blinkit only, then
  `7-day-four-shops.csv`, a file name from before D-187). Each
  target shows its state: waiting, being searched, found (how many listings), nothing fit (with why), paused; Search
  again, Pause, Remove.
- **Found and waiting.** What the runner adds arrives as drafts (in Products → Drafts) unless "go live by themselves"
  is on. **Publish the ready** publishes every found draft with a photo and every detail customers must see; the product
  page has **Details customers see** to finish the others.
- **Prices held for you.** A price that jumped beyond the rule stops that shop item and waits here: accept the new
  price, or stop using that shop (the next cheapest in-stock source takes over).
- **Fast shops (D-148, D-162, D-187; admin only).** `sourcing_shops.quick_delivery` marks the shops whose pieces reach the
  hub within the hour (Blinkit, BigBasket, Zepto, Instamart; set by a migration, no screen yet). Food is bought from them
  when it can be, which is what makes 7 delivery days true: a listing that can be bought whole from the fast shops (every
  option with a usable source has one there: in stock, no price held, inside the delivery limit) is bought there, even when a
  backup elsewhere is cheaper, when it is added and at every weekly check (`_sourcing_settle`, `_quick_sourceable`, which
  covers home listings too, so their prices don't move); a fast shop sold out or held hands the piece to its backup. Listings
  settled before: `pnpm quick:sources` (`ops.md` §Sourcing runner). The first batch's CSV was
  `tools/sourcing-runner/out/blinkit-7-day.csv` (gitignored), added through Add targets from a CSV and run with
  `pnpm sourcing run --type food` / `--type home`. **Every food listing promises 7 delivery days whichever shop it comes from**
  (plan §7): Today's food watch flags late buys.
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
- **Liquids are not sent (D-135, D-187).** The runner checks every food and home listing once (each new one as it adds it,
  the rest at the end of each run; alone: `pnpm sourcing liquids --dry`): a liquid (a juice, sharbat, soda, oil,
  syrup, sauce, attar, rose water, anything sold by the ml or litre, or a page saying "Item Form: Liquid"; never
  pickles, pastes or powders) is archived as **coming soon**, and every store read leaves it out: its product page answers
  404 (plan Y-9). Products → Archived marks it, read-only (the Show/Hide toggle went). Publishing it again ends its coming
  soon, and the check never undoes that.
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

## Looks: whose photo it is (D-194)
Products → a listing → Photos: on a listing with 2+ looks, each photo has a **For**: "Every look" or one look. Save sets `variant_id` to that look's first variant, and the product page shows the photo with that look. The rule is in `docs/storefront.md`. `pnpm sourcing looks` does this in bulk (`tools/sourcing-runner/README.md`), and query L3 (`monitoring.md` §6) counts the looks still without a photo.
