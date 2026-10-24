# Storefront: customer web, the app's customer side, and the design system

The web exists since R5 and the app since R6. Both carry the approved design since C1 (§Design system): the web all pages,
the app Home, Region and Product (other app screens use the restyled shared parts). The code is the truth for what
exists (`apps/web/app/(store)/`, `apps/app/app/`).

## What a customer may see (whitelist, D-003 + D-004 + D-008)
Anything not on this list stays off customer surfaces: pages, app, emails, API responses, meta tags, page source, and
JSON sent to the browser.
- **Region:** name, greeting (approved text only, D-019), tagline, story, image, accent colour.
- **Product:** name, summary, description, story, craft/style name (e.g. "Kanjeevaram silk"), type, category, attributes
  (fibre and care, or food's net quantity as its label states it ("400 g", D-133), ingredients, allergens and shelf
  life), photos, price, variants (one row of choices per option that differs: colour, flavour, type, pack, size;
  each variant can have its own price, D-118), availability count, and
  **"Made in India" / "Imported"**, and its state when it has one (D-121: an all-India listing names no state; nothing
  says "no state" either).
- **Delivery:** the estimated delivery window, and "order by <date>" (D-035).
- **Own orders:** number, items, totals, customer-facing status (`flows.md` §8), delivery window, US carrier + tracking link.

**Never shown:** vendor or shop anything, the shop's town, shop price or cost, cycle codes, pickups, payouts, export or AWB
details, admin names, the COO, or anything about India-side operations.
Enforcement: customer code reads catalog and order data only through `store_*` (D-017), and INV-1/INV-8 tests (`data-model.md`).

## Web routes (`apps/web/app/(store)/…`, built in R5)
| Route | Purpose | Rendering (see `engineering.md`) |
|---|---|---|
| `/` | the full-screen photo hero (behind the nav bar too) with only the stacked brand name on the white wall and "Miss local market? Start here." (D-079, `design/pages/shell/`; otherwise D-050 – D-055; since D-148, while 7-day delivery is on, "Want in 7 days? Click here." to `/7-day-delivery`, the days from Settings), the album of all of India (the region pages' drifting mosaic: the states' album photos, then their newest pieces' main photos; it opens with the clip-and-scale reveal and a gentle parallax, D-113), Pick your home (India map + stamps, in pages of 6 from 7 open states, + names; D-080), then Just listed (D-113): since D-140 one heading and a row per type (Clothing, Food, Home & gifts), each with its own See all, a type with fewer than four pieces left out; pieces published at the same moment take turns by shop and category (D-140, L8). D-154: while the 7-day store is open, one row "Arrives in 7 days" (the days from Settings; See all → `/7-day-delivery`) just before Just listed, its cards without the tag | static, cached `store_home()` |
| `/states` | Pick your home as its own page (D-083): all 36 regions, alphabetical, with no state/UT distinction (D-002) | static (same cached read as `/`) |
| `/states/[region]` | **the core page:** greeting in the region's script, story, accent theme, the album, Most wanted and Picked for you, then the state's inventory: Clothing · Food · Home & gifts as a switch, each with See all's filters (D-157) | static per region (36 built at build time), plus each type's cached `store_browse()` page |
| See all (`/clothing`, `/food`, `/home-and-gifts`) | D-122: a frosted-glass switch between the three types at the top, keeping the chosen state; a food card shows its pack size on its photo. D-136: the filter panel on the left from 1024 px (D-140: For first on clothing, Women · Men with counts, unisex under both, no Kids at launch; Category, State, Price with a slider and four ranges, Size / Pack boxes grouped as Tops & kurtas, Waist, Footwear, Bangles, Kids' ages, One size, each shown only when the pieces in view use it; "One Size", "Free size" and a piece without a size read One size, "L-XL" reads L/XL), /clothing's two large Women · Men tiles under the heading, chips with × and Clear all, Sort by; filters and Show more change only the cards (`GET /api/browse`), never load the page, and Back from a product restores the cards and the scroll | cached `store_browse()` |
| `/states/[region]/[product]` | product page: gallery, options, price (D-155: a heavy piece's option adds the tag "Heavy-item shipping" and "+ $65.21, added at checkout"), availability (live), save, delivery window, origin line; an all-India listing lives at /states/india/<slug> (D-121; `india` is no state's slug and has no page of its own) | static on first visit + live stock island |
| `/clothing`, `/food`, `/home-and-gifts` (D-106, D-110; the old /spices address redirects to /food) | the **See all** page behind every row (D-062): low to high (D-144; with a state, its own pieces before the all-India ones, D-140 L2); on Clothing with no category one of each category, then the next of each, with Accessories and Turbans & Headwear in a velvet drawer after the second row of every 24 cards (12 a drawer, See all → accessories), filters in the address (`?state=`, `?category=`, `?for=women|men` (D-140), `?delivery=7-day` (D-154: "Delivery: in 7 days", the first filter group while the type has 7-day pieces, with their count), `?min=` / `?max=` in dollars, `?size=` repeated, `?sort=price-asc|price-desc|new`), 24 cards then "Show more" (`?show=`), which appends in place (D-136). D-136 replaced D-084's state and category pill rows with the left filter panel; below 1024 px one Filter bar (a round icon once scrolled) opens the same groups in a side panel that stays open until "Show n pieces" | built once per address and served from the cache like the state pages: `next.config.js` rewrites each address and its filters to `app/(store)/see-all/[type]/[state]/[category]/[show]/[for]` (the browser keeps `/clothing?state=…`; canonical is the public address); one cached `store_browse()` read (the cards drawn, the total, the filter counts; D-068). Price, size and sort are read in the browser (`features/catalog/use-browse.ts`), from `GET /api/browse` (the same cached read; in-memory rate limit) |
| `/7-day-delivery` | D-154: **the 7-day store's front page** (D-148's page, kept): "Order today, arrives by Fri, Oct 30" (the real next date: today + the 7-day days from Settings, worked out again in the browser so a cached page never shows yesterday's) and "Comes in 7 days with $49.99 of 7-day pieces", the category tiles (a photo each; a tile opens its category's 7-day See all page), the rows Most ordered this week (by units ordered, never shown), Under $5 and New this week, then a row per type (Food, Home & gifts: "11 pieces in 7 days") with See all, as the IWC store's Home ends (founder, 2026-10-24: "the same aesthetics for 7-day store as the main one"). "From your state" is not built: the site keeps no chosen state. No shop is ever named. 404 while 7-day delivery is off or paused | cached `store_quick_front()`, `store_quick_browse()` (the categories' types) and each type's first `store_browse(p_quick)` page (the same entries as its See all page) |
| `/7-day-delivery/food`, `/7-day-delivery/home-and-gifts` (`?category=`) | the 7-day store's **See all** pages (founder, 2026-10-24): the IWC store's See all (`browse-view.tsx`: the filter panel with Category, State, Price and Pack or Size, chips, Sort by, Show more, the Filter bar on phones) with only 7-day pieces, always: no Delivery filter or chip, no tag on the cards, the address without `?delivery=` (`BrowseQuery.inQuick`). At the top the same frosted switch as the IWC store's types: Everything (the front page) · Food · Home & gifts. The tiles and the header's 7-day categories open them. `next.config.js` rewrites the address to the route `7-day-delivery/[type]/[category]` (cached per type and category, every category built with the deploy, D-156; the other filters are read in the browser). A tap shows the page's shape and the running stitch at once (`loading.tsx`, as every See all page does). 404 while 7-day delivery is off | cached `store_browse(..., p_quick)` |
| `/7-day-delivery/search` | D-154: the 7-day store's search: only 7-day pieces, no states; nothing found → "Search the whole IWC store" | dynamic (no auth), `store_search(..., p_quick)` |
| `/search` | search products and regions; 24 results at a time with "Show more" (`?show=`, D-067), through `store_search`, which records the words (not who searched) for the admin's Insights. D-085: the count with the words ("24+ pieces" when Show more has more), matching open states as stamps (coming-soon ones by name), no words or no results → the open states and Just listed; phones: a round search icon in the box. D-154: while 7-day delivery is on, a "Delivery: in 7 days" pill under the box (`?delivery=7-day`, only 7-day pieces, no states) | dynamic (no auth) |
| `/cart` | the bag ("Bag" in the UI; on-device state). D-111, D-112: under the subtotal, the fixed Shipping and Retailer charges (struck through at $0.00 from the free-shipping line up; checkout shows them from its first step); D-155: with a heavy piece, **Heavy-item shipping** (paid below the line; from the free-shipping or 7-day line 20% off, the whole struck through, its saving in "You're saving"; checkout the same, on express too) and how much more makes them free, from `GET /api/bag-charges`; every other store page shows the free-delivery bar once the bag has a piece. D-119: from the line up, the **bulk saving** (a % of the amount over the line, up to a cap) shows as its own line, and the bar refills with it ("Saving $5 · add more, save more" until "BIGGEST SAVING"); checkout takes it off the goods before tax. D-125: Shipping is one number, at least $18.79 and more when the bag's pieces cannot pay for its parcel (one masala), struck through and free from the line up; the Retailer charges are 1.5% of the goods, at least $0.99. D-086: a photo on each line, − / number / + (1 – 10), an empty bag shows the open states as stamps and Just listed; the header's bag icon opens the same bag as a side panel (it stays a link to `/cart` for new tabs and without JavaScript) | static shell |
| `/checkout`, `/checkout/success` | D-114: signed in, the saved addresses are offered above the delivery form (the default picked and filled in, its phone too, so it opens at Delivery; "A new address" empties it), and a paid order's address is saved to the account (the first becomes the default). D-087: phone (+1, required, no code) → delivery (name, email, ZIP with the city and state filled in from our own list through `GET /api/zip`, D-098; street, apartment, promo code) → server-priced total + Standard (free) / Express with each delivery window (D-041) → payment (Stripe) → order (D-038); finished steps fold to a line with Edit; the bag beside the steps (a bar on phones); `/checkout` sits in the quiet frame of the `(checkout)` route group (logo and Back to bag, a one-line footer). The thank-you page adds the pieces, the total and the delivery window from this tab's priced bag (sessionStorage) | dynamic |
| `/orders/lookup`, `/orders/[number]` | order tracking. The signed-in owner sees the order directly; anyone else confirms the order email first, in a centred card (D-088). The order opens with a status card (number, status, delivery window, Track the parcel once shipped, D-066) holding the timeline with each reached step's date, and a photo on each item (D-088). An open faster-delivery offer (D-064) shows above the timeline: `POST /api/orders/faster` (order number + email) → Stripe Payment Element, loaded only when taken → `POST /api/orders/faster/confirm`. The customer's choices (cancel before cutoff, D-042; keep or cancel after a delay, D-008) through `POST /api/orders/choice` (number + email, refund shown first) | dynamic |
| `/account`, `/account/saved`, `/account/addresses`, `/account/details` | the profile (D-089): one page, four sections (Orders · Saved · Addresses · Your details; a list on desktop, pill tabs on phones), Sign out at the foot. Orders are cards (the first piece's photo with "+n", number, placed date and window, status label, total); Saved uses the standard cards with a filled heart that removes; addresses are cards with Default / Make default and a pencil and a minus in the corner (`?edit=`, `?add=1` open the form). Signed out, the same address shows the sign-in card. `/account/orders` redirects to `/account` ("Save for later" on product pages fills `saved`) | dynamic |
| `/account/reviews/[productId]` | write a review (D-051, D-056): rating + text; photos only for verified buyers; pending until an admin approves it. D-090: "Write a review" on the product page opens the same form as a side panel over the product (signed out, the sign-in card first, in the panel); the piece at the top, five large stars (tap or arrow keys, "n of 5"), photo tiles with previews for verified buyers (× removes, + hides at 4); this address keeps the form for links from outside | dynamic |
| `/login`, `/signup`, `/account/password` | customer auth (D-091): the profile's sign-in card centred, with an eye on passwords, "Forgot password?" (Supabase sends a reset link back through `apps/web/app/auth/callback/route.ts` to `/account/password`, "Set a new password" typed twice) and "Email me a sign-in code" (six digits in six boxes; existing accounts only); `?link=expired` notes a used link. **No admin mention anywhere** (D-006) | dynamic (reads `?next=`), no DB call |
| `/about`, `/how-it-works`, `/faq`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` | info pages; their wording lives in `packages/shared/src/info/` (blocks, one source with the app's help sheet, D-095) and the numbers come from `store_policy()`. Opened from any store page they show as a glass panel over it (D-092; intercepting routes in the `@info` slot); a direct visit shows the page. `/shipping-returns` and `/faq` are Claude drafts from D-070 – D-073 and D-076 whose numbers come from `store_policy()` (cached, awaiting approval); `/privacy` and `/terms` are drafts from what the code does and the decisions (a lawyer reviews them); `/how-it-works` is a draft too; the rest need founder input (Q-9, legal text) and say "being written" | static (shipping-returns, faq: cached store read) |

Why `/states` in URLs: it's the founder's own word for the concept. UTs live under it too (D-002). Headings that list all 36
avoid calling them "states" (e.g. "Pick your home").

**Removed from the old storefront:** `/shop`, `/category/[slug]`, `/size-guide` (size info moves onto product pages),
the duplicate `/wishlist` (→ `/account/saved`), `/order-lookup` + `/order-status/[id]` (→ `/orders/…`), and the
Framer Motion page transitions (speed, `engineering.md`).

## The region page (core experience)
1. Greeting in the region's own script, large, with its Latin transliteration and meaning beneath.
2. Tagline and a short story: why this place feels like home.
3. The accent colour re-themes the page (one CSS variable from `regions.accent_color`).
4. **The state's inventory is See all (D-157):** under the hero, the album, Most wanted and Picked for you (rows that
   scroll sideways, D-062), **Clothing · Food · Home & gifts** as the See all pages' frosted switch with each type's
   count (`features/regions/region-type-tabs.tsx`; three equal cells with the count under the name on phones; ← and →
   move). Each type is drawn as See all draws it (`browse-view.tsx`): the filter panel from 1024 px, the Filter bar
   below it, the chips, Sort by, the grid, Show more; the state is the page's (no State filter or chip; Clear all keeps
   it; the heading is the type or the chosen category). The address stays the state's and carries the type and the
   filters (`/states/punjab?type=food&category=sweets`; Clothing has no `type`), so Back, a refresh and a shared link
   open the same view (`BrowseQuery.inState`). The page is one cached build: each type's first 24 cards and counts
   from one cached `store_browse()` read per type, refreshed with the state (a sale shows "Sold out" there at once);
   the other filters read in the browser (`/api/browse`). Its option picker (the + ribbon and sheet) loads on the
   first touch of a +, as on every page. A
   switch is instant and brings a reader who had scrolled down back to the top of the inventory. It opens on Clothing,
   or the first type the state has.
5. **All-India listings fill every state (D-121):** a listing without a state (a Myntra kurta from no state in
   particular) shows on every state's page and under every state in See all, after the state's own pieces, with no
   state on its card. New arrivals, the first row, is the state's own pieces only (D-122).
6. Regions with no live products show "Coming soon" (`regions.is_live = false`). Anything more, like a notify-me feature, needs founder approval.
7. A **coming-soon** piece (D-135: a liquid, not sent; archived for admins) is shown like any other: its card says "Coming soon" instead of the price, with the heart instead of the + (the app card: a "Coming soon" pill), and its page says "Coming soon. Save it with the heart to find it again." instead of Add to bag. It cannot be bought (no options in `store_variants`).
**Target (D-051; built in C1 and C2; the lists are rows, D-062; the album shows once a region has three album photos):** below the hero (greeting, tagline, story, image): Clothing / Food filter pills, then
**New arrivals → Most wanted → a photo album that scrolls sideways by itself (not interactive) → Curated for you (a card)
→ Leaving soon** (almost out of stock). Curated for you = admin picks per region, Leaving soon = 1–2 left (D-056); Most wanted = most pieces ordered in the last 30 days (D-058); the album has no pause control (founder, D-052).

## The product page
Gallery → name, price → variant picker → availability (live) → **delivery window** → add to cart → details: description,
craft, attributes, care or storage → origin line: "Made in India · from <Region> · Imported" ("Made in India · Imported"
for an all-India listing, D-121).
**D-100 (built):** clothing photos are Front, Back (worn by an AI-generated model, D-101) and the Material
close-up, which is always the original photo; Details (above the Size chart) say how to wash it (Care), where it is
from (Made in: India, from <Region>) and, when a photo is AI-generated, that the model photos are; one builder for the
website and the app (`@repo/shared/domain` `detailRows`). The wording is Claude's draft (D-012) until the founder
approves it.
**D-082 (built in B2):** tablets (768 – 1099 px) two columns (photos left, the small ones in a row under the big one);
any photo opens a full-size viewer over the page (swipe, arrows, arrow keys, Escape); on phones a buy bar slides up
once Add to bag has scrolled away above the screen, and the review cards are a sideways row.
**D-051:** from 1100 px one full-length photo no taller than the screen with three stacked photos beside it; a
heart beside the name saves the product; Details and Size chart open and close with + / −; then Reviews (rating + text; photos only from verified buyers; an admin checks each, D-052, D-056), Similar
items and Curated for you as rows of smaller cards (D-062; Similar items' See all opens its category).
**D-140 (L3, F8):** no size (or option) is chosen until the customer taps one: the legend says "choose one", the
button says "Choose a size" and takes them to the sizes with a short glow; a colour may start chosen. The chosen
option says how many of it are already in the bag.

## Feel (D-140, plan F5, F7, L4 – L7)
- **F5:** from the free-delivery line up, Shipping shows struck through at the Settings figure "Shipping shown when
  free" × the bag's packed kg (never below the $18.79 it is below the line; empty = $18.79), and **You're saving $X**
  (the struck Shipping and retailer charges and the bulk saving) shows in the brand colour above the total in the bag,
  the bag panel, checkout and the thank-you page. Display only: what is charged, Express and every price are unchanged
  (founder, D-140); the figure is never charged, stored or sent to Stripe; customers never see grams. Claude flagged
  that a struck figure never charged can read as a fictitious former price (FTC 16 CFR 233.1); the founder chose it.
- **F7:** the thank-you page sews a running stitch from India to the customer's state ending in a stitched check
  (about 1.4 s, once; finished at once with reduced motion), the message on the left and the order on the right on
  wide screens, "View your order" for everyone (guests still confirm their email there); confirming shows the stitch
  running; the order page's progress track is the same stitch. Customers print invoice A from their order page.
- **L4:** a summary that is the shop's run of specs, or the description again, is not shown; such specs read as a list
  in Details; the importer and the runner pick a plain line. **L5:** the product title is 30 – 36 px, two lines at
  most. **L6:** the bag panel adds "Goes well with" (four small cards of the last piece's type from its state, each with
  its +) under its lines. **L7:** Home's band under Just listed: when an order placed today arrives, where delivery
  turns free and the return window, from the store's data.

## Cards (D-140, plan F6, F8, F9)
- **Tap anywhere on a card but its buttons → the product page.**
- **7-day tag (D-148):** a 7-day piece's card says "In 7 days" (brand colour, top left of the photo; the days from
  Settings, `quick_days`); not inside the 7-day store (its rows and list) or Home's "Arrives in 7 days" row, which say it
  once. Its product page has no tag: its delivery line gives the normal window and "Comes in 7 days with $49.99 of 7-day
  pieces." (D-154; the days and the line from Settings).
- **Two shipments (D-154, step 3):** once the bag holds 7-day pieces, the bag (page and panel, web and app) shows its
  lines under their dates, from `/api/bag-charges` (`quick_ids`, `dates`, `shipments`; no weight leaves the database):
  "Shipment 1 · Arrives by Fri, Oct 30" over the 7-day pieces and "Shipment 2 · Arrives Nov 3 – Nov 7" over the rest
  when they are worth the 7-day line ($49.99), one "Arrives by …" group for a bag of only them (Shipping struck through,
  "You're saving"), and under the line one group in the normal window with "Add $12.40 of 7-day pieces and they arrive
  by Fri, Oct 30" and **Shop the 7-day store** (a bag of only 7-day pieces says it once, in its summary's goal); each date
  "for most US addresses". **One goal, one bar (D-156, `bag-goal.ts`)** in the pill, the summary and the app: only 7-day
  pieces under $49.99 → "Add $12.40 more for FREE 7-DAY DELIVERY"; only 7-day pieces from $49.99 → "FREE 7-DAY DELIVERY ·
  by Fri, Oct 30", the bar full; any other bag → "Add $X more for FREE DELIVERY", then the bulk saving. When a change crosses a line the pill (on
  `/cart` the summary) says so for three seconds: "Your 7-day pieces now arrive by …", "That opened a second shipment:
  …", "Your 7-day pieces now travel with the rest: …", or, when a normal piece ends a free 7-day bag's free Shipping,
  "Shipping is now $46.55 until $99.99." with **Undo** beside the pill (six seconds; Undo puts the bag back). Checkout,
  after the address: one window or Shipment 1 and Shipment 2 with their pieces, the "Add …" line (naming the promo code
  when it is the reason), and for an address outside the 48 states and DC "7-day delivery reaches the 48 mainland states
  and DC, so everything here comes together in one shipment." No Express with a 7-day shipment. The order page (and its
  emails) shows each shipment's date, status, Track the parcel and pieces; a late shipment's notice offers to keep it or
  cancel just that shipment. Shared logic: `packages/shared/src/domain/bag-shipments.ts`.
- **The store tabs (D-154 step 4; D-156 replaced the floating pill):** while the 7-day store is open (days in Settings, not
  paused, at least one piece), a dark strip along the very top of every store page with the two stores as tabs, like a
  browser's (`features/shell/store-switch.tsx`, CSS `.store-*` in globals.css): "IWC store · All 36 states" with the gold
  India outline, and "7-day store · arrives by Fri, Oct 30" with a brand-colour 7 (the date worked out in the browser).
  Phones: the line under the name, the strip 46 px (42 px from 768 px), the tabs sharing the width; from 768 px 500 px
  from the left gutter. The open tab is the header's own colour and runs into it through curved feet: ivory in the IWC
  store; in the 7-day store (every page under `/7-day-delivery`) the header takes a warm brand tint (12% of the brand
  colour) and its bottom edge becomes the jewellery drawer's gold stitch. On Home the open tab is light glass over the
  photo. The strip is part of the page: `.site-top` sticks one strip-height up, so it scrolls away and the header stays
  (`--top-h` is the header's height alone); on Home it slides up as the hero's words fade. A tap moves the open tab at
  once (320 ms with a slight spring, the mark pops once; at once with reduced motion) and opens the other store's front
  page; the IWC tab returns to the page left (this tab's sessionStorage). Plain links in a "Store" nav, the open one
  `aria-current="page"`. Inside the 7-day store the header's type links become All and its biggest categories (two
  below 1280 px, four above; each opens its 7-day See all page) and Search finds only 7-day pieces
  (`/7-day-delivery/search`).
- **Phones, smaller cards (founder, 2026-10-24):** below 640 px a row's cards are 148 px wide (176 px above), and See
  all's food and home grids (both stores) show three to a row with a 32 px heart and +, smaller chips and words
  (`data-dense`, globals.css); clothing keeps two to a row, its photos need the width.
- **The +:** a piece with one choice is added at once and flies to the bag; one with sizes, packs or flavours opens a
  ribbon across the bottom of the photo (frosted, unrolling from the +, chips arriving one after another; colours
  first when there are several; sold-out chips struck; a dot for "only a few left"; one tap adds and rolls it back),
  or a bottom sheet with the photo, the name and each option with its own − n + when a step has more than eight
  chips or the card is narrower than 160 px. Escape, a tap outside or the card leaving the screen closes it; arrow
  keys move between chips. Each card carries its options (`options`: variant, label, options, price, what is left;
  See all's as fresh as its cached page, checkout re-checks stock).
- **In the bag:** the + becomes − n + (n = every size of the piece in the bag, read from the bag on the device, in
  every tab); with one size − and + change it (− at 1 takes it out; + past what is left shakes and says "Only n
  left", L9), with several they open the sheet.
- **The heart, top right of every card's photo** (the product page's too): it fills the moment it is pressed with a
  short pop and is never disabled; the database follows a moment later (quick on/off sends only the last state) and
  a refusal puts it back with "Couldn't save". The page reads a signed-in visitor's saved pieces once, not once per
  card. Signed out, the piece is saved on this device ("Saved on this device. Sign in to keep them on every device",
  once) and joins the account after sign-in. A coming-soon card says "Save it, we'll show it in Saved when it's back"
  beside its heart (S7).

## Mobile app (customer side, `apps/app`, built in R6, redesigned in B6 on D-095)
Tabs on the app's own cream tab bar (a brand bar over the active tab, the bag count as a brand pill): **Home** (the photo
with "Indian Wholesale Club" on its wall and "Miss local market? Start here." (D-148: "Want in 7 days? Click here." to the
7-day screen while 7-day delivery is on; D-154: the store switch at the top of the content and the "Arrives in 7 days"
row while the 7-day store is open), the demo strip on top, Just listed, Pick
your home with stamp pages from 7) · **Explore** (search with the count, States · Clothing · Food · Home & gifts; states as stamps) ·
**Bag** (photos, − / + , the empty bag shows stamps and Just listed; the bag is a tab, so no bag panel; D-154: its lines
under their shipments' dates with the one goal and bar (D-156), as on the website; not yet the pill's notes) · **Saved** (cards
with a filled heart that removes) · **Profile** (Orders · Addresses · Your details as pill tabs, Track an order, About us &
help, Sign out; signed out, the sign-in card). Tab roots have a large Syne title, pushed screens a back bar. The screens
follow the web pages above, read the same `store_*` data through `@repo/db/store` (one call per screen, D-017) and share
the tokens (§Design system). About us & help is the D-092 panel as a sheet with the seven tabs; its wording comes from
`packages/shared/src/info/` (one source with the website's info pages).
| Screen | File (`apps/app/app/…`) | Data |
|---|---|---|
| Home, Explore, Bag, Saved, Profile | `(customer)/…` | `store_home()`, `store_type_rows()`, search, on-device bag, `wishlists` (signed in), own orders as cards (`listMyOrderCards`), `store_policy()` for the help sheet and Home's 7-day line, `store_bag_charges()` for the Bag's charges and shipments |
| 7-day delivery | `7-day-delivery` (D-148: the web page's header with the days, category pills with counts, a two-column grid 24 at a time like `browse`; the cards without the tag; nothing to show while the days are empty. D-154: the 7-day store's front page: the store switch on top (no shared header in the app, so on Home and here; IWC goes back), "Order today, arrives by …", the line, the rows Most ordered this week, Under $5 and New this week) | `store_quick_browse()`, `store_quick_front()` |
| Region, product | `region/[slug]`, `product/[region]/[slug]` (same sections as the web pages above: the region photo first and jump pills; on the product page the photos edge to edge with a full-screen viewer, the buy bar, reviews as a row, and "Write a review" as a sheet with the D-090 form, D-095) | `store_region_page()`, `store_product_page()` + live availability |
| Checkout | `checkout` | phone → delivery (the ZIP fills the city and state through the website's `GET /api/zip`) → payment, as on the web (D-087); the website's server API: `POST /api/checkout` (server-priced quote + Standard / Express, D-041) → Stripe PaymentSheet → `POST /api/orders` (D-038). The phone never sends prices |
| Order | `order/[number]` (signed-in owner, `store_my_order`) · `order/lookup` (number + checkout email via `POST /api/orders/lookup`, rate-limited, one answer for any mismatch); the faster-delivery offer (D-064) through the same API as the website, paid with the PaymentSheet; cancel / keep through `POST /api/orders/choice` | |
| Addresses, sign-in | `addresses` (the add / edit form), `auth/login`, `auth/signup` | own `addresses` rows · Supabase Auth: the sign-in card with the eye, Forgot password (the link opens the website's "Set a new password") and the email code (D-091) |
Every list in the app is a sideways row (a horizontal `FlatList`) with **See all** → the **Browse** screen
(`app/browse.tsx`: one type, optional region and category, a virtualized two-column grid that loads 24 at a time as it
nears the end, each page and the total from one `store_browse()` call, D-068), as on the web (D-062). Explore's Clothing and Food read only each
category's first 12 cards (`store_type_rows`); its search shows 24 with "Show more" (D-067).
Signing in with an admin account switches the app to admin mode (`admin.md`). Nothing in the customer UI hints at this (D-006).

## Emails (customer)
Order confirmed (with delivery window) · preparing (optional) · shipped (tracking) · delivered · item unavailable + refund ·
delay notice with cancel option (D-008). All go through `email_outbox` and follow the same whitelist. **Built (C5):** all of
these, plus cancelled, refund, the faster-delivery offer and its confirmation, and "coming sooner" (D-064). The copy is in
`apps/web/lib/email/order-update.ts` (drafted in the D-059 voice; the founder may rewrite it). Sent with Resend's test
sender until launch (D-046).
**D-094 (built in B5):** every email sits in one frame (`apps/web/lib/email/frame.ts`): the cream page, the logo as an
image (`apps/web/public/email/logo.png`, the header's logo at 2x), the message in a card under a heading, Syne / Karla
served from our own site (`apps/web/public/email/`) where the email app allows web fonts, the brand-colour button, small
photos of the pieces (the confirmation and the item-unavailable email; 128 px copies through the site's image
resizer), and a footer: Track your order · Shipping & returns · Contact, "You're getting this because you ordered from
The Indian Wholesale Club. These emails are about your order only." and the support email (Q-9). The shipped email's
button opens our order page, which links on to the carrier (D-088).

## Design system: brand, voice, visual system (was §Design system)

> **Status:** direction set on 2026-09-29 (D-049); the mockup was approved on 2026-09-30 (D-055) and its tokens and fonts
> are in `packages/tokens` and `apps/web/app/fonts.ts`. Code uses the token roles, never raw hex.
> **Direction chosen (2026-09-30, D-050):** A, reworked: the hero keeps its format, everything below it is a symmetric
> full-width grid, no dark mode, fonts below. Mockup: `design/mockups/index.html` (palette with contrast, the map source,
> the founder's remaining choices). Tokens go into `packages/tokens` in C1 step 2.
> **Since 2026-10-08 (D-079, D-080; built in B1 and B2 of the design pass build):** the shell and the Home hero from the
> design pass: **Cinzel** (headlines), **Syne** (headings below the hero) and **Karla** (everything else) replace the five
> fonts below, the logo stays Georgia; header Search (a visible pill that grows into a long search bar once the page scrolls, D-113) · Clothing (Women · Men on hover or focus) · Food · Home & gifts · States (D-140; below 1024 px the types are in the menu and About us lives in the menu and footer) + saved / bag / profile icons; phone
> side panel; the hero name held on the photo's white wall at every size in #1D1A17; on the Home photo the header stays
> as before (white links over a dark band, smooth fade to cream); soft blur is fine, harsh blur is not; the card's add
> button is a round + on its photo; Open now stamps page in sixes. Approved mockups: `design/pages/shell/`,
> `design/pages/home/`. Where the sections below still describe the older build, these lines win.
> **Design pass (since 2026-10-07):** every page is designed again, one at a time; the register, the workflow and each
> page's brief and mockup are in `design/pages/`. Until a page's mockup is approved, this file and the code stay as they are.

### Direction (founder, D-049; layout below the hero and fonts changed by D-050)
**D-050 (2026-09-30):** Direction A. The hero keeps A's asymmetric, image-led format and motion; **everything below the
hero sits on a symmetric grid** (four equal columns of 3 : 4 rounded product photos with name, price and "Add" (a + on the photo since D-080), equal
two-panel rows), full width with small side gutters. **Fonts:** Helvetica Neue for the hero and the section headings
(D-051; TeX Gyre Heros where it is not installed, D-052), Georgia for the logo, product title and origin line (Gelasio
where it is not installed), Poppins for paragraphs, Montserrat for interface text (navigation, buttons, labels, product
names on cards), Inter for the footer only. No dark mode. **Replaced by D-079 / D-080 (built 2026-10-08):** Cinzel (the
Home name, state names, product titles, stamps), Syne (page and section headings), Karla (everything else), Georgia for
the logo text only.
**Home hero (D-052 – D-054):** the founder's photo fills the first screen edge to edge, behind the nav bar too; "Indian Wholesale Club" (D-077) stands on its white wall,
one word per line, right-aligned, with the label "Clothing and spices from home" under it and nothing else (D-055; **target**
D-079: "Miss local market? Start here.", the name sized and placed on the white wall at every width); the
photo is AI-generated and IWC holds the rights; scrolling fades the words out while the header logo fades in. The earlier hero is archived in `design/mockups/archive/a-gallery-v3.html`.
The D-049 bullets below still apply to the hero and to motion; their asymmetric layout rules no longer apply below it.
The storefront reads like a **premium editorial magazine / contemporary gallery wall** built from large photographs:
- **Layout:** asymmetric, image-led compositions. Large photographs at varying vertical positions, varied widths,
  offsets and overlaps; images may break the grid and extend between sections; floating compositions.
- **Density (the founder's 4th prompt refines the first three):** no large empty gaps. Bigger images, sections that fill
  more of the viewport, elements closer together, clean alignment, consistent breathing room. Immersive, not sparse.
- **Motion:** Lenis smooth scrolling; subtle vertical (and some horizontal) parallax tied to scroll velocity; images
  reveal as they enter the viewport through gentle clipping, slow scale and opacity transitions.
- **Typography:** minimal, clean, luxury-magazine; photographs carry the page.
**Guard rails (built in C1: `apps/web/features/shell/motion.tsx`, tested in `e2e/motion-keyboard.spec.ts`):** motion is progressive enhancement. Lenis and the scroll effects load as one small
client module after the page is interactive; with `prefers-reduced-motion` they are off entirely (native scroll, no
parallax, images simply visible); keyboard, find-in-page, anchor links and screen readers keep working; content is fully
readable with JavaScript off. The speed budgets still hold (`engineering.md`: first-load JS ≤ 150 KB, cached pages
≤ 100 ms), and images use `next/image` with explicit sizes so the large photos don't slow the first paint. On mobile
the effects are lighter. The app follows the same look with native motion (Reanimated), not Lenis.
**Photography dependency:** the direction lives on photographs. Until real product and region photos exist (listing, C3;
region images, C2), mockups and dev pages use clearly marked placeholders, never stock photos presented as products.

### Brand [D-009]
- Name: **The Indian Wholesale Club**. Short form **IWC**. Logo text (website header, D-077): "Indian Wholesale Club", its I
  inside a gold outline of India cut open on the east (`apps/web/features/shell/logo.tsx`).
- What we sell: the feeling of home (D-001). Every design choice should make a homesick person feel recognised.

### Voice
- Warm, specific and a little nostalgic, like a friend from your hometown. Never kitsch, never a stereotype.
- Specific over generic: "Kasavu mundu, the one for Onam" beats "Traditional ethnic wear".
- Honest: real origin (D-004) and real delivery windows (D-008). No fake urgency or fake scarcity.
- IWC speaks as the seller ("we"), and never about shops or India-side operations (D-003).
- Cultural facts in copy (festival names, greetings, craft history) must be accurate. Claude-written text is `draft`
  until the founder approves it (D-019).
- **The founder's rule for drafted copy (D-059):** "Not a single word should give away the AI tone or AI slop, be human,
  be relateable, be creative, be out of the box, be frank, be natural." In practice: short sentences, plain words, a
  joke where a person would make one; no "vibrant", "rich heritage", "timeless", "curated with love", no stacked
  adjectives, no "whether you're…", no em-dash asides. Read it aloud; if it sounds like an ad, rewrite it.

### Visual system (principles)
1. **Neutral, warm base with one brand colour.** Content and photos carry the colour.
2. **Per-region accent:** each region has `accent_color`, applied through one CSS variable (`--region-accent`) on its pages.
   It must meet WCAG AA contrast against the base. **Not checked yet:** the admin form only checks the hex format; a
   contrast check comes with the design (coding phase).
3. **Scripts:** greetings render in the region's own script (Devanagari, Bengali, Gujarati, Gurmukhi, Odia, Tamil,
   Telugu, Kannada, Malayalam, Meetei Mayek, Ol Chiki, Latin for several north-eastern languages…). Use Noto Sans for
   the specific script, **subset and loaded only on that region's page** (speed, D-011).
4. **India map:** use a map consistent with **India's official boundaries**. This audience will notice immediately.
   The map must be a static SVG (no map library) and lightweight. Source: DataMeet's state boundaries (CC BY 4.0, credit shown
   under the map and in the footer), about 27 KB gzipped (approved, D-052).
5. **Photography:** real product photos taken at listing time, consistent aspect ratio (decided with the mockups). No
   stock photos presented as products.
6. **Motion:** as §Direction (D-049): Lenis smooth scroll + reveal/parallax, the only motion library allowed on the
   storefront (no framer-motion), off for `prefers-reduced-motion`. Everything else CSS.
   **Polish pass (D-116, D-117):** the free-delivery bar fills sideways with a glowing head (`.fd-bar`); phones have
   Search where wider screens have Saved (`phone-search.tsx`); the page clips sideways overflow. Lenis's velocity is `--sv` on `<html>`; `.drift` grids and rows float apart by column while
   the page scrolls fast. Element motion lives in `globals.css` (`.fd-*` free-delivery meter, `.press`, `.rise-in`,
   `.draw-check`, `.quick-add`, `.live-dot`, `.write-in`, panel stagger) and `features/cart/fly-to-bag.ts` (Web Animations);
   the app uses Reanimated (`free-delivery-pill.tsx`, `meter-line.tsx`, the tab bar). Loops animate transform or opacity only.
7. **Light only:** no dark mode on customer pages (D-050).
8. **The running stitch (D-140, plan §3):** the brand's one motif, dashes like thread: the thank-you page's India-to-door
   line (`features/checkout/stitch.tsx`), "Confirming your order…", the order page's progress track, the admin's
   loading line (`.stitch-loading`). Tap feedback lands in the same frame (the heart, the card's +, − n +); micro
   motion 150 – 250 ms, reveals 300 – 600 ms; everything off with reduced motion.

### Tokens (`packages/tokens`)
One source for web (Tailwind preset) and app (NativeWind): `packages/tokens/tokens.js` → `preset.js`. Components use
roles, never raw hex. **Final values since C1 (2026-09-30)**, taken from the approved mockup (D-050 – D-055); the
unit test `packages/tokens/tests` fails if a text colour drops below WCAG AA on a page background.
| Role | Tailwind name | Use |
|---|---|---|
| page background | `canvas` | `bg-canvas` |
| panels, cards | `surface` | `bg-surface` |
| pills, inputs, lightest layer | `paper` | `bg-paper` |
| main / secondary text | `ink`, `ink-muted` | `text-ink`, `text-ink-muted` |
| borders | `line` | `border-line` |
| IWC brand + text on it | `brand`, `on-brand` | primary buttons |
| region accent (fallback) | `region` | overridden per region by `regions.accent_color` |
| map regions not open yet | `land` | the India map |
| status | `positive`, `caution`, `danger` | alerts, badges |
Also `rounded-sm/md/lg/pill`, `duration-fast/base/slow` and the font roles `font-display` (Cinzel), `font-heading`
(Syne), `font-body`, `font-ui`, `font-foot` (all Karla) and `font-logo` (Georgia) (D-079, D-080; the web maps them to its self-hosted fonts in `apps/web/app/fonts.ts`, the app to
the fonts it loads in `apps/app/lib/fonts.ts`, with one class per weight). The names
avoid the old theme's keys (`primary`, `accent`, `success`, …); a test keeps them from coming back.

### Accessibility (non-negotiable)
WCAG 2.2 AA: contrast, focus states, keyboard navigation, alt text on every product image (entered at listing),
touch targets ≥ 44 px (both admin and customer, since admins work on phones).
**Accepted exception (founder, D-052):** the region album moves by itself with no pause control (WCAG 2.2.2); it stops
for "reduce motion" and when off screen.

### Admin look
Plain, dense and fast. The same tokens, no brand decoration. Phone layouts for field jobs (`admin.md`).
Since B7 the web admin follows the approved admin design (D-096, `design/pages/admin/`; the class strings in
`apps/web/features/admin/styles.ts`, the parts in `ui.tsx`, the frame in `frame.tsx`): Syne page titles (codes such as
order and cycle numbers in Karla), Karla for everything else, paper panels, ink primary buttons, plain status chips in
words and colours (`chips.tsx`), small uppercase group labels. A sidebar grouped by job with counts of what waits; a top
bar with quick find (Ctrl+K), the desk's clock in both zones and the live dot; on phones a top bar with the menu, the
page title and find. Times are in the admin's desk zone with the other zone beside them, never UTC (`time.ts`).
