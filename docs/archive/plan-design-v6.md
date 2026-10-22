# Design & ergonomics plan (storefront + admin), v6

**Status:** written by Claude on 2026-10-18 from the latest code, `main` at `b10bb8b` (the founder's machine; GitHub is
2 sourcing commits behind), read file by file, and the live site (https://the-indian-wholesale-club.vercel.app) walked at 1440 px and 375 px on
2026-10-18 (§6). v5 folds in the founder's answers of 05:31, 06:16 and 06:23 the same day. Scope: design and ergonomics only. Every "now" below names the file it was read in.
v1 of this plan was written from old project docs and is replaced: most of v1 (filters, See all, the free-delivery
bar, the add-to-bag flight, saved addresses, both time zones in admin) **already exists**.

Labels: **[F]** = the founder asked for it · **[C]** = Claude found it · **[Q]** = waits on the founder.
Severity: 🔴 costs orders or hours now · 🟠 friction every visit · 🟡 polish.

---

## 0. Rules for every change below

1. **The screen answers in the same frame; the server catches up.** Every tap that changes state (heart, +, filters,
   quantity, admin status buttons) changes the screen at once and syncs in the background, rolling back only if the
   server refuses. Never optimistic for money (payment, refunds, order creation). [F]
2. **Pricing is fixed; this plan changes no price, fee, margin or the Express option** (founder, 2026-10-18). The only
   money-display change is F5's struck figure, a display number the founder sets in Settings.
3. **No operations info on customer surfaces** (D-003): shops, shop prices, weights and invoices B and C are admin-only.
4. **Rows on Home, grids on See all, one strict 4px spacing scale**; no empty band taller than 96 px desktop / 48 px
   phone (D-049 prompt 4 made testable).
5. **Pilot first.** Admin screens must work for made-to-order orders with no cycle (D-115), which is how orders
   arrive today.
6. Speed budgets stay (engineering.md: first-load JS ≤ 150 KB, cached pages ≤ 100 ms). Tap targets ≥ 44 px.
   Everything respects `prefers-reduced-motion`.

---

## ⚠ Before anything else: product photos are broken on the live site 🔴
Found 2026-10-18: on Home and See all most cards show a beige box with the alt text. Every photo goes through Vercel's
resizer (`/_next/image`), which now answers **402 `OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`**: the plan's
image-optimisation allowance is used up (thousands of imported listings × several widths). Photos already cached still
show; new ones don't.
- **Today:** raise the Vercel plan or its image allowance (the founder's account; nothing to code).
- **Lasting fix:** stop resizing per view. When a photo is saved (import, runner, admin upload), write fixed copies
  (e.g. 320, 640, 1280 px, WebP) next to it in `product-media`, and give `next/image` a custom loader that picks the
  copy for the `sizes` the card already declares (`product-card.tsx` `SIZES`). One backfill over existing photos.
  Cost per view: none; speed: same or better (served from Supabase's CDN).
- **Guard:** the http step of `check.mjs` fetches one card image from production and fails on anything but 200.

## 1. The founder's items

### F1 · Home: three Just listed rows, not a switch 🟠 [F]
**Now:** `features/home/just-listed-switch.tsx`: one row at a time behind Clothing · Food · Home & gifts tabs (D-136).
All three rows are already server-rendered (`home.just_listed_types`) and hidden with `hidden`.
**Change:** drop the tabs; render three `ProductStrip` rows under one "Just listed" heading, each with its own small
heading ("Clothing", "Food", "Home & gifts") and **See all →** to `/clothing`, `/food`, `/home-and-gifts`. A row with
fewer than 4 pieces is left out (no "coming soon" line in the middle of Home). No new query; the client island goes away
(less JS).
**Done when:** three rows on Home at 375 px and 1440 px, each See all opens its type, e2e `rows.spec.ts` updated.
Supersedes D-136's Home switch only; See all keeps its type switch.

### F2 · Clothing filters: Women · Men (no Kids at launch), and sizes that make sense 🔴 [F]
**Now:** clothing has no "who wears it". `supabase/seed/categories.sql` mixes it into categories (`kurtas`,
`shirts-and-tops`, `footwear` hold both; `kids` is a category). The filter panel offers Category, State, Price,
Size / Pack (`features/catalog/filter-panel.tsx`). Myntra's page already says it: the importer reads `gender` and throws
it into free-text hints (`packages/shared/src/sourcing/normalize.ts`, line 113). Vendor submissions already use
`wears ∈ women · men · kids · unisex` (`20261010120200_vendor_submissions.sql`).
**Change:**
- `products.wears` (same four values). Filled by: Myntra's `gender`; name rules like D-132's ("women's", "men's",
  "boys", "girls", "unisex"); the import form (a required pick for clothing); a backfill with a CSV to review, as
  `pnpm weights classes` does.
- See all → Clothing: a **For** group first in the panel (**Women · Men**; unisex pieces show under both), plus two
  large tiles (Women · Men) above the grid on `/clothing`. In the address: `?for=women`. **No Kids at launch**
  (founder, 2026-10-18): kids' pieces get `wears = kids` but no tile, no filter and no menu entry. *[Q]* the 33 live
  listings in the Kids category (seen live): unpublish them until Kids opens, or leave them under the category?
- Header and phone menu: Clothing opens Women · Men (§2 S1).
- Sizes: a piece with no size options shows and filters as "One size" (sarees, dupattas, shawls).
**Done when:** every live clothing listing has `wears` (a SQL test refuses publishing clothing without it), the
filter counts add up, e2e covers `?for=`.
- **Sizes need cleaning too (seen live):** `/clothing`'s Size group lists about 100 values in one block: XXS – 8XL,
  waist 28 – 50, kids' ages (0-3M … 15-16Y), UK shoe sizes, bangle sizes (2.2 – 2.8), "L-XL", "L/XL", "S/M", and both
  "One size" and "One Size". Normalise at import (one spelling, `L/XL` = `L-XL`) and group the panel: Tops & kurtas
  (XXS – 8XL) · Waist (26 – 50) · Footwear (UK) · Bangles · One size; a group shows only when the category in view
  uses it.

### F3 · Admin: order a sold piece from its shop in one tap 🔴 [F]
**Now:** a pilot order has no cycle (D-115), so its pieces never reach the cycle's pickup cards, the only place
with **Order it online** (`features/admin/pickup-cards.tsx:99`). The order page's Pieces table shows the shop name and
₹ price but no link (`features/admin/order-pieces.tsx`). And the link it does have uses `products.source_url`, the page
first imported, not the variant's shop item in use (`product_sources`, D-118), so it can open the wrong size or colour,
or a dearer or sold-out shop. Today's "Pickups still to do" links to `/admin/cycles` (`app/admin/(panel)/page.tsx`).
**Change:**
- **On the order page, per piece:** **Order it ↗** to the variant's in-use `product_sources.item_url` (fallback
  `source_url`), with the shop, its ₹ price now vs. at sale, in stock, delivery days. Then **Mark ordered**: amount
  paid (₹), the shop's order number, optional photo of the shop bill. The piece moves To order → Ordered → At the hub
  (Picked, weighed, D-130) → In the US → Shipped.
- **A "To order" screen** (sidebar, Daily) for every unordered piece of every open order, **grouped by shop**, oldest
  first, with each shop's total. **Order all from this shop** puts every piece in that shop's cart at once where the
  shop allows it: Amazon's add-to-cart link with several items (`/gp/aws/cart/add.html?ASIN.1=…&Quantity.1=…`; test on amazon.in first), a
  Shopify shop's `/cart/<variant>:<qty>,…` (Nishorama); for other shops (Myntra, Flipkart) it opens each piece in its
  own tab. Then **Mark all ordered** with one order number and one bill. The ASINs and Shopify variant ids come from
  the item URLs the runner already stores; a shop without one falls back to tabs.
- **Today:** "Pieces to order" (count, oldest age) as the India desk's first job, linking there.
- Same on the app's order screen (one button per piece).
**Done when:** a pilot order's pieces are all ordered from its admin page with no visit to the product page.

### F4 · Three invoices per order 🔴 [F]
Founder, 2026-10-18: invoice B is the Indian cost + handling + shipping with no margin; invoice C "shows only the
ordered cart with delivery, all the costs are counted in margin".

| | A · Customer invoice | B · Our cost (landed) | C · Shop bill |
|---|---|---|---|
| Who sees it | customer + admin | admin only | admin only |
| Answers | what the customer paid | what sending it cost us | what the shops' cart cost |
| Lines | pieces, Shipping, Retailer charges, bulk saving, promo, tax, total (USD) | per piece: shop ₹ ÷ 0.90 (handling) + weight g × ₹2 (shipping) × qty; total ₹ and ÷ ₹92 USD | the ordered pieces at the shop's price + delivery, as the desk fills it in (₹) |
| Built from | the order (exists) | the beta formula before its margin divisor: `betaSubtotalInr()` in `packages/shared/src/domain/pricing.ts` (D-128) | **a form** (below) |

- The admin order page shows **Margin = A − B** (and A − C, "over the shop bill") per order and per piece.
- **Snapshot at order time.** `order_items` keeps only the customer's price (baseline migration), so an order's cost
  changes when a piece is reweighed (D-130) or its shop price moves. Add to `order_items`: `shop_price_paise`,
  `weight_g` and its source, `inr_per_usd`, `pricing_rule`. B is **provisional** until every piece is weighed at the hub,
  then **final** (labelled either way).
- **Invoice C is a form** (founder, 2026-10-18), one per order, on the admin order page and in the app:
  - pre-filled rows, one per ordered piece (name, size, qty, the shop's price at sale), each editable: price paid,
    the shop, its order number; a Delivery row; extra rows can be added (a shop's packing fee, a coupon as a minus);
    the total adds up live; Save keeps a draft, **Mark final** locks it (an admin can reopen it, logged).
  - **Photos of the shop's bill:** drop files, pick from the gallery / take one with the camera on a phone, or
    **paste** a screenshot straight from the clipboard (Ctrl+V / long-press Paste) anywhere on the form. Thumbnails
    with × to remove and a full-size viewer; stored in the private `vendor-docs` bucket (as shop photos are, B8),
    never public.
  - Filling F3's **Mark ordered** fills the matching rows here, so nothing is typed twice.
- PDFs with numbers per kind (A-, B-, C-). A goes with the confirmation email and on the customer's order page; B and
  C only in admin. Refunds show as credit notes on A.

### F5 · A higher struck-through Shipping figure + "You're saving $X" 🟠 [F]
Founder, 2026-10-18: "we do need to show big numbers as struck through and that is an order" … "don't mess with any
pricing, it is fixed the express remains how it is, don't overcomplicate things I will balance everything physically
you put higher prices on shipping when its cut."
**Now:** below the free-delivery line a bag pays Shipping $18.79 + Retailer charges; at the line both show struck
through with $0.00 and a bulk saving comes off (`features/cart/charge-lines.tsx`, D-111, D-112, D-119, D-125).
**Change (display only):**
- Settings gets one number, **"Shipping shown when free"**, in dollars per kg of the bag, set by the founder (D-012:
  the number is the founder's). At the line the struck Shipping figure = the bag's packed weight × that number
  (e.g. $22 a kg: a 5.5 kg bag shows ~~$121.00~~, 9.3 kg ~~$205.00~~), never below today's $18.79. Empty setting →
  today's ~~$18.79~~.
- Nothing else moves: what is charged below the line, Retailer charges, bulk saving, Express, every price and the
  checkout server's totals stay exactly as they are. The figure is never charged, stored on an order or sent to Stripe.
- **"You're saving $X"** in brand colour above the total = the struck Shipping + struck Retailer charges + bulk
  saving, in the bag, the bag panel, checkout, the thank-you page and invoice A (as a note; totals stay exact).
- Weights stay hidden: the customer sees a dollar figure, never grams (D-132).
- Recorded as the founder's decision; Claude flagged on 2026-10-18 that a struck figure never charged can be read as a
  fictitious former price (FTC 16 CFR 233.1) and the founder chose to show it.

### F6 · The heart answers instantly 🟠 [F]
**Now:** `features/account/save-button.tsx` waits for the server action before filling, disables the button and dims
it to 60% while waiting, has no animation; signed out, it sends you to `/login` and the save is lost after sign-in.
Hearts exist only on the product page and on coming-soon cards.
**Change:**
- Fill on pointer-down in the same frame (a 180 ms scale pop, CSS only); never disabled; the request goes out after,
  debounced (quick on/off sends only the last state); on failure the heart reverts with a small "Couldn't save" note.
- Signed out: save to the device at once; after sign-in, saved pieces merge into the account
  (`/login?next=…&save=<id>`). The first signed-out save shows a one-line "Sign in to keep them on every device".
- A heart on **every** card (top right of the photo), not only on coming-soon pieces. Card hearts read their state
  from one request per page, not one per card.
- Same pattern for **+**, quantity − / +, filter chips and admin's Picked / Mark ordered.
- E2E: the heart is filled before any response arrives (network slowed).

### F7 · Order-placed animation and filling the gaps 🟡 [F]
**Now:** the thank-you page is a 720 px column of text on a wide screen; while confirming it shows the bare line
"Confirming your order…"; it tells signed-in customers they need their email to track (`features/checkout/checkout-success.tsx`).
**Change:**
- **A running-stitch line** (dashes, like thread): a short dashed path sews itself from a small India outline to the
  customer's US state and ends in the stitched check the site already uses (`.draw-check`, `step.tsx`). About 1.4 s,
  once; the order number, delivery window and buttons are visible from the first frame. SVG `stroke-dashoffset`,
  no library; reduced motion shows it finished.
- The same stitch while confirming (instead of the bare line), as the order page's timeline track, as section dividers
  and on the free-delivery meter, so it reads as the brand's one motif, not a one-off.
- Desktop thank-you in two columns: the message and the stitch on the left, the order (photos, total, "You saved")
  on the right; signed-in customers get "View your order", not the email note.
- **Gaps:** filled in this order: tighten first; then a wide photo band from the region album (`region_photos`);
  then a thin texture strip (weave, embroidery, spice close-up); then the state's motif at low contrast. Decorative
  images `aria-hidden`, lazy, never the largest paint. The exact gaps come from the live walk (§6).

---

### F8 · Cards remember the bag: − n + instead of + 🟠 [F]
Founder, 2026-10-18: "If I added a piece in my bag and if I see it again somewhere while browsing I should see it as
-1+ instead of add button. not necessarily 1 but however many I've added."
**Now:** the card's + shows a tick for a moment after adding, then forgets (`features/catalog/quick-add.tsx` keeps it
in component state); the bag itself already lives on the device (`features/cart/store.ts`, persisted, lines keyed by
variant with `productId`).
**Change:** every card (Home rows, state rows, See all, search, Similar items, Saved, the app's cards) reads the bag:
- not in the bag → the round **+**;
- in the bag → a pill **− n +** on the photo, n = all of that piece's sizes / variants in the bag together. One
  variant in the bag: − and + change it (− at 1 removes it, the pill shrinks back to +). Several sizes: − and + open
  F9's picker showing each size with its own count.
- Same on the product page (the size picked shows its count) and in the app.
- Instant (rule 0.1): the bag is local, so this is free; the cards are server-rendered and only the pill is a client
  island, as the + is now. It updates across tabs (the store's storage event).

### F9 · + picks the size (or the variant) right on the card 🔴 [F]
Founder, 2026-10-18: "When + is clicked anywhere in clothing the sizes should pop up in a creative way in food the
variants should [be] see[n], if its a single item with no choice then it should be just added instead of opening the
product page (this should be opened whenever anything is clicked instead of + on the card)."
**Now:** + adds only a piece with exactly one variant in stock; anything with sizes or colours is a link to the
product page (`quick-add.tsx`), so on most clothing + does what tapping the card does.
**Change:**
- **Tap anywhere on the card except + / the pill → the product page** (as now).
- **One choice only** (a single pack, one-size shawl) → + adds at once, the flight to the bag (D-116) and the card
  turns into − 1 +.
- **Clothing → the size ribbon.** + unrolls a ribbon from the + across the bottom of the photo, like a measuring tape
  pulled out (frosted band, 250 ms, the chips arriving one after another in a short stagger): every size as a round
  chip, sold-out ones struck through and not tappable, "Only 2 left" as a dot on a chip. Tap a size → the chip
  flies to the bag, the ribbon rolls back into − n +. Colours, when a piece has them, show as swatches on a first
  row above the sizes. More than 8 sizes or a card narrower than 160 px (phone rows) → the same chips in a short
  bottom sheet with the piece's photo and name, so nothing gets cramped.
- **Food and home & gifts → the variant ribbon:** the same ribbon with each pack / flavour / type and its own price
  ("200 g · $4.29", "500 g · $9.49"); one tap adds.
- Escape, a tap outside or scrolling the row away closes it; arrow keys move between chips; reduced motion → it simply
  appears. No size is ever pre-chosen (L3).
- **Data:** the card payload gains a compact `options` list (variant id, label, price, available), so the ribbon
  opens with no request; at most 24 cards × a few options per page, checked against the 150 KB budget. `quick_add`
  stays for the one-choice case.
- E2E: + on a kurta opens the ribbon, M adds M, the card shows − 1 +, the bag has M; + on a single masala adds it
  directly.

### F10 · Real pagination on every admin list 🔴 [F]
Founder, 2026-10-18: "do pagination in admin products and Import from shops, that is so badly designed, 1000 items on
one page loading?"
**Now (read in the code):**
- **Products** (`app/admin/(panel)/catalog/page.tsx`): 50 a page, but only "← Previous · Page n · Next →": no total, no
  page numbers, no way to jump to page 40 of a few thousand listings.
- **Import from shops** (`app/admin/(panel)/import/page.tsx`): the importer and the whole Imported list on one page;
  the list is cut at 100 rows without saying so (`listSourcedProducts(limit = 100)`) while its heading prints
  "Imported (100)", so the count is wrong and the rest can't be reached.
- **Auto-sourcing** (`import/auto`): targets cut at 200 (`listTargets(limit = 200)`) with 1,000+ targets loaded from
  the CSVs; found drafts cut at 200; the cut is silent there too.
**Change: one pager for every admin list** (`features/admin/pager.tsx`, used by Products and all its tabs, Imported,
Targets, Found drafts, Prices held, Orders, Customers, Reviews, Vendor pieces):
- Pages of **50** (25 / 50 / 100 to choose, remembered per list), fetched on the server with `range()` and an exact
  count only for the filtered set; `?page=` in the address with the filters, so Back and links work.
- Above and below the table: **"1–50 of 3,412"**, page numbers with gaps (1 2 3 … 68 69), Previous / Next, a "Go to
  page" box; ← / → keys turn pages when no field has focus.
- Only the table changes when paging, filtering or sorting (as See all does since D-136): the frame, filters and scroll
  stay; the table's header is sticky; a thin stitch line shows while the next page loads.
- **Search on every list** (name, shop, order number), on the server, so it covers all rows, not just the page.
- Bulk actions: ticks on the page, plus "Select all 3,412 matching" for actions that take a filter (Publish all
  drafts, Download Excel, Search again, Pause).
- Thumbnails 64 px, lazy (and from the fixed copies once the photo fix lands), so a page of 50 stays light.
- **Import from shops splits in two:** the importer stays at `/admin/import`, fast; the imported listings move to
  their own tab `/admin/import/listings` with the pager, filters (shop, state, type, checked before…) and "price
  checked longest ago first" as one of the sorts. Headings always show the real total.
- No silent caps anywhere: a query with a limit always pages; a test fails if a list's heading count differs from its
  total.
**Done when:** Products, Imported and Targets open in under a second with 3,000+ rows on production data, every row is
reachable, and e2e pages forward, jumps to a page and comes Back to the same page and filters.

### F11 · Low to high by default, with the jewellery drawer 🟠 [F, 2026-10-21]
Founder: "I want the customer to see low to high prices by default but in clothing only accessories comes up first";
on Claude's proposal: "I really like the jewellery drawer".
**Now:** See all defaults to Newest (`features/catalog/browse-query.ts`, `sort … .catch('new')`); a plain low-to-high
on `/clothing` opens with four accessories and two turbans ($6 – $22.71) before the first kurta ($24.82), seen live.
**Change:**
- **Default sort = low to high** on every See all page and state page list (`?sort=` absent means it; "Newest" stays a
  choice). On Clothing the default is **"one of each, then step up"**: each category's cheapest first, then each one's
  second cheapest… (in `store_browse`'s `row_number()`: `rank() over (partition by category order by price)` before
  the price), so the first screen shows the whole wardrobe climbing in price. Sort by → "Price: low to high" stays a
  strict ascending list.
- **The jewellery drawer:** on Clothing's default view, Accessories and Turbans & headwear leave the price order and
  open as a drawer after the second row of the grid: a dark, velvet-toned band (the inside of a jewellery box), a
  thin gold stitch along its top edge, "Finishing touches · from $6", a sideways row of smaller cards with + / − n +,
  and See all → `/clothing?category=accessories`. Each "Show more" can bring the next drawer (the next 12 by price).
  On a phone the drawer is full width between rows 2 and 3 (two cards and a peek). Reduced motion: no slide-in.
- Inside the Accessories category, or with any category filter, there is no drawer and plain low to high applies.
- Footwear: [Q] in the drawer or in the clothing order (proposed: clothing order; Q-40). Built 2026-10-21 as D-144.
- Data: `store_browse` returns `drawer` (the 12 cheapest finishing touches in view, with options) beside `products`
  when the type is clothing, no category is chosen and the sort is the default; the main list leaves those categories
  out and its total says so ("652 pieces · 12 finishing touches").
- Tests: SQL (one of each order, drawer only on the default, counts add up), e2e (drawer after row 2 at 375 and 1280,
  its See all, + in the drawer adds to the bag).

## 2. Holes Claude found

### Storefront
| # | Hole | Where (now) | Fix |
|---|---|---|---|
| S1 🔴 | **No Clothing / Food / Home & gifts in the header.** Only Search, States, About us; shopping by type is reachable only via Home's Just listed → See all | `features/shell/site-header.tsx`, `site-menu.tsx` | Header: Clothing (Women · Men) · Food · Home & gifts · States · Search; the phone menu the same, with the type tiles first |
| S3 🟠 | **Size chart has only size names**, no measurements; US customers can't choose | `features/catalog/product-details.tsx` `sizeChart()` | Import the shop's size chart where its page has one (check what Myntra's page data holds) into the listing; show inches first, cm beside; until then a line "Sizes follow Indian brands, usually a size smaller than US" only if the founder approves it [Q] |
| S4 🟠 | **Saving needs a product page** (no heart on cards) | `product-card.tsx` | F6 |
| S6 🟡 | Thank-you page | `checkout-success.tsx` | F7 |
| S7 🟡 | Coming-soon pieces: a heart but nothing that says what saving does | `product-card.tsx` (D-135) | "Save it, we'll show it in Saved when it's back" under the heart's label |

### Admin
| # | Hole | Where (now) | Fix |
|---|---|---|---|
| A1 🔴 | **Nobody is told when an order arrives.** No admin email, no app push (no `expo-notifications` anywhere); only the live dot if an admin already has the panel open | `apps/web/lib/email/`, `features/admin/live-feed.tsx` | On every paid order: an email to both admins (number, pieces, total, link) and an app push; a sound and toast on an open panel |
| A2 🔴 | **Today is built for cycles; the pilot has none.** "Orders confirmed in the open cycle: nothing to do until cutoff" is wrong for made-to-order; "Pickups still to do" opens `/admin/cycles`; "Quantities to re-check with the shops" is the runner's job for imported listings | `app/admin/(panel)/page.tsx` | When no cycle is open (D-115): US desk "Orders to send on", India desk "Pieces to order" (F3), "At the hub, to weigh", "Prices held for you" (auto-sourcing); cycle jobs only when a cycle is open |
| A3 🔴 | **Order it online opens the first imported page**, not the variant's shop item in use | `pickup-cards.tsx:99` | F3 (use `product_sources` per variant) |
| A4 🟠 | **No money view per order** (cost, margin) and no cost snapshot | `order_items` (baseline migration) | F4 |
| A5 🟡 | Refunds only on the web panel (the Stripe key lives on the server) | admin.md | App calls a server route for refunds, as checkout does |

### Data the design needs
- `products.wears` (F2) · `order_items`: `shop_price_paise`, `weight_g`, `weight_source`, `inr_per_usd`,
  `pricing_rule` (F4) · per order piece: `ordered_at`, `paid_paise`, `shop_order_ref`, `shop_bill_path` (F3, invoice C) ·
  size chart measurements on clothing listings (S3) · admin push tokens (A1).

---

## 3. Design system, strict
Keeps D-050 / D-079 (Cinzel, Syne, Karla; tokens in `packages/tokens`). Adds:

| Area | Rule |
|---|---|
| Spacing | 4 px scale only: 4 8 12 16 24 32 48 64 96; no ad-hoc `clamp()` gaps outside the hero |
| Gaps | no empty band > 96 px desktop / 48 px phone (a test measures it on Home, a state page, See all, product, bag, thank-you) |
| Rows | card widths stay `product-row.tsx`'s; every row has a heading and See all at the same place |
| Motion | ≤ 16 ms tap feedback (state change in the same frame), 150–200 ms micro, 300–600 ms reveals; the stitch is the one brand motif |
| States | every list and button: loading (stitch), empty, error, offline |
| Savings | money saved always in `positive`, money charged in `ink`, struck amounts in `ink-muted` |

---

## 4. Order of work

| Step | What | Why first | Waits on |
|---|---|---|---|
| **0** | ⚠ broken photos: raise the Vercel allowance today; then fixed-size copies + custom loader | customers see no photos | founder's Vercel account |
| **1** | F3 order from the shop + invoice C form + A1 new-order alerts + A2 Today for the pilot + cost snapshot on `order_items` + **F10 admin pagination** | real orders are arriving and admin lists cost the founder hours | — |
| **2** | F4 invoices A and B, margin on the order page | every order needs its numbers | — |
| **3** | L1 titles without brands, F2 `wears` + size groups, S1 header, F1 three rows, L2 own pieces first | how customers find things | backfill review |
| **4** | F9 size / variant ribbon on +, F8 − n + on cards, F6 instant heart + hearts on cards, L3 no default size | fewer taps, fewer wrong sizes | — |
| **5** | F5 struck figure + "You're saving", F7 stitch + thank-you, L6 bag panel, L7 Home, S3 size charts | feel | F5's $ per kg in Settings |

Each step ends with `node scripts/check.mjs` and a browser check at 375 px and 1440 px (CLAUDE.md).

---

## 5. Decisions

Founder, 2026-10-18 (to file with `/record-answer` as the next D-entries, verbatim):
- Product types are three: clothing, food, home & gifts (matches D-106 / D-110; nothing to change).
- Invoice C: "shows only the ordered cart with delivery, all the costs are counted in margin"; "should be fillable
  like a form with uploadable and pastable photos".
- Like button: "the like button latency on the frontend should be very low of animation, let it take its time on the
  backend".
- Home's Just listed: three scrollable rows with their See all (replaces D-136's Home switch).
- "keep the you're saving x and no we do need to show big numbers as struck through and that is an order."
- "no kids at launch." · "the checkout steps are good." (D-087 stays.)
- "When a state is opened its own pieces should be top of the horizontal rows." (L2)
- Cards keep the bag: "-1+ instead of add button … however many I've added." (F8)
- + picks sizes (clothing) or variants (food) on the card; a single choice is added at once; the rest of the card
  opens the product page. (F9)
- "don't mess with any pricing, it is fixed the express remains how it is, don't overcomplicate things … you put higher
  prices on shipping when its cut." (F5, rule 0.2)
- "do pagination in admin products and Import from shops" (F10)

Waiting on the founder:
1. **F5:** the dollars per kg for "Shipping shown when free" (typed in Settings; until then today's $18.79 shows).
2. **F2:** the 33 live Kids listings: unpublish until Kids opens, or keep under the Kids category?
3. **S3:** an interim size line, or wait for real size charts?

---

## 6. What the live walk found (2026-10-18, 1440 px and 375 px)
Pages: Home, `/clothing`, a product (`/states/india/aaliya-halterneck-kurti-dc0d`), the bag panel with 3 pieces.
Checkout was not paid through (it would place an order on production); admin was read in the code, not opened.

| # | Found | Fix |
|---|---|---|
| ⚠ | Product photos broken: `/_next/image` answers 402 (above) | above |
| L1 🔴 | **Shop and brand names in product titles**: "House of Pataudi Embroidered Mandarin Collar Kurta", "TWINS LADY Women Ethnic Motifs Embroidered Regular Thread Work Kurta with Trousers & With Dupatta", "The Wallet Store Ishq-E-Jhumka…". IWC is the seller (D-003), and the titles read like a marketplace's SEO | Title rules at import and a one-off clean-up: drop the brand / shop prefix (the importer already knows the brand field), drop "Women", "Regular", "With"; at most ~6 words; the full shop title kept admin-only. A lint in the runner refuses a title that starts with the shop's brand |
| L2 🟠 | **A state's own pieces don't always come first.** Founder, 2026-10-18: "When a state is opened its own pieces should be top of the horizontal rows." The state page's rows already sort own first (`20261014140000_all_india_and_bands.sql`, `order by (p.region_id is null)`) **except Most wanted**; See all with `?state=` lost it in D-136 (`20261016210000_browse_filters.sql` sorts only by date and name), so newer all-India pieces sit above the state's own | Own first in every row and list that has a state: Most wanted, See all `?state=` (the `row_number()` gets `(region_id is null)` before the date), Similar items on a state's product, search within a state. A SQL test per list |
| L3 🟠 | **The first size is pre-selected** (XXS on a kurti): a quick Add buys the smallest size | No size chosen until tapped; Add says "Choose a size" and scrolls to the sizes. Sold-out sizes stay visible, struck, and can't be picked |
| L4 🟠 | **Product summary is the shop's spec dump** run together ("Composition: 100% Cotton Gauze Fit: Fitted at bust… Technical Details: …"), repeated word for word in Details; no Care | The summary is one plain sentence (drafted, `content_status = 'draft'`, D-019); the specs only in Details as a list; Care required before publish (as D-129 does for weight) |
| L5 🟡 | **Title is 52 px Cinzel over 3 lines** on desktop (156 px tall for "Aaliya Halterneck Kurti"), pushing price and sizes down | Title 32–36 px, 2 lines max; price and the size row above the fold at 1440 × 900 |
| L6 🟠 | **Bag panel on a phone**: one line at the top, totals at the bottom, ~400 px of empty cream between | Fill it with the free-delivery stitch and "You're saving", then a "Goes well with" row (same state or type, 4 small cards with +) |
| L7 🟠 | **Home is four sections** (hero 812 px, album 343, Pick your home 1,172, Just listed 618 on a phone); nothing says how long delivery takes, how it works, or that food and home & gifts exist before the bottom row | After Pick your home: F1's three rows; a slim band "Delivered in 12 – 18 days · free from $X · returns" (numbers from `store_policy()`); one editorial photo band per type. On phones the map shrinks to half a screen with the search box first (the stamps are the tap targets) |
| L8 🟡 | **See all "Newest" is one shop's catalogue in A–Z** (Aabh, Aabha, Aaliya, Aani…: a whole collection imported at the same moment) | Ties on the date are mixed by shop and category so a page isn't 24 near-identical pieces from one shop |
| L9 🟡 | Quantity + stops silently at stock (3) | "Only 3 left" pulses once when + is refused |
