# Storefront: customer web + customer side of the app

The web exists since R5 and the app since R6. Both carry the approved design since C1 (`design.md`): the web all pages,
the app Home, Region and Product (other app screens use the restyled shared parts). The code is the truth for what
exists (`apps/web/app/(store)/`, `apps/app/app/`).

## What a customer may see (whitelist, D-003 + D-004 + D-008)
Anything not on this list stays off customer surfaces: pages, app, emails, API responses, meta tags, page source, and
JSON sent to the browser.
- **Region:** name, greeting (approved text only, D-019), tagline, story, image, accent colour.
- **Product:** name, summary, description, story, craft/style name (e.g. "Kanjeevaram silk"), type, category, attributes
  (fibre and care, or ingredients, allergens and shelf life), photos, price, variants (size/colour/weight), availability count, and
  **"Made in India" / "Imported"**.
- **Delivery:** the estimated delivery window, and "order by <date>" (D-035).
- **Own orders:** number, items, totals, customer-facing status (`flows.md` §8), delivery window, US carrier + tracking link.

**Never shown:** vendor or shop anything, the shop's town, shop price or cost, cycle codes, pickups, payouts, export or AWB
details, admin names, the COO, or anything about India-side operations.
Enforcement: customer code reads catalog and order data only through `store_*` (D-017), and INV-1/INV-8 tests (`data-model.md`).

## Web routes (`apps/web/app/(store)/…`, built in R5)
| Route | Purpose | Rendering (see `engineering.md`) |
|---|---|---|
| `/` | today: "Where's home?" and the list of all 36 regions with a delivery-window teaser. **Target (D-050 – D-055):** the full-screen photo hero (behind the nav bar too) with only the stacked brand name and the label "Clothing and spices from home", Just listed, Pick your home (India map + stamps + names) | static, cached `store_home()` |
| `/states` | all 36 regions, alphabetical, with no state/UT distinction (D-002) | static (same cached read as `/`) |
| `/states/[region]` | **the core page:** greeting in the region's script, story, accent theme, Clothing · Spices sections | static per region (36 built at build time) |
| `/states/[region]/[product]` | product page: gallery, options, price, availability (live), save, delivery window, origin line | static on first visit + live stock island |
| `/clothing`, `/spices` | the **See all** page behind every row (D-062): newest first, `?state=` and `?category=` pills, 24 cards then "Show more" (`?show=`) | dynamic render over one cached read, filtered on the server |
| `/search` | search products and regions | dynamic (no auth) |
| `/cart` | the bag ("Bag" in the UI; on-device state) | static shell |
| `/checkout`, `/checkout/success` | details → server-priced total + Standard (free) / Express ($8) with each delivery window (D-041) → payment (Stripe) → order (D-038) | dynamic |
| `/orders/lookup`, `/orders/[number]` | order tracking. The signed-in owner sees the order directly; anyone else confirms the order email first. An open faster-delivery offer (D-064) shows above the timeline: `POST /api/orders/faster` (order number + email) → Stripe Payment Element, loaded only when taken → `POST /api/orders/faster/confirm`. The customer's choices (cancel before cutoff, D-042; keep or cancel after a delay, D-008) through `POST /api/orders/choice` (number + email, refund shown first) | dynamic |
| `/account`, `/account/orders`, `/account/addresses`, `/account/saved` | signed-in customer ("Save for later" on product pages fills `saved`) | dynamic |
| `/account/reviews/[productId]` | write a review (D-051, D-056): rating + text; photos only for verified buyers; pending until an admin approves it | dynamic |
| `/login`, `/signup` | customer auth. **No admin mention anywhere** (D-006) | dynamic (reads `?next=`), no DB call |
| `/about`, `/how-it-works`, `/faq`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` | info pages. Text needs founder input (Q-5, Q-9); until then they say "being written" | static |

Why `/states` in URLs: it's the founder's own word for the concept. UTs live under it too (D-002). Headings that list all 36
avoid calling them "states" (e.g. "Pick your home").

**Removed from the old storefront:** `/shop`, `/category/[slug]`, `/size-guide` (size info moves onto product pages),
the duplicate `/wishlist` (→ `/account/saved`), `/order-lookup` + `/order-status/[id]` (→ `/orders/…`), and the
Framer Motion page transitions (speed, `engineering.md`).

## The region page (core experience)
1. Greeting in the region's own script, large, with its Latin transliteration and meaning beneath.
2. Tagline and a short story: why this place feels like home.
3. The accent colour re-themes the page (one CSS variable from `regions.accent_color`).
4. **Every list is a row that scrolls sideways** (D-062; arrows for a mouse, swipe on a phone). Jump pills at the top
   (New arrivals, each clothing category with its count, Spices). One row per clothing category, biggest first, up to 12
   cards, with **See all** → `/clothing?state=<region>&category=<category>`.
5. Regions with no live products show "Coming soon" (`regions.is_live = false`). Anything more, like a notify-me feature, needs founder approval.
**Target (D-051; built in C1 and C2; the lists are rows, D-062; the album shows once a region has three album photos):** below the hero (greeting, tagline, story, image): Clothing / Spices filter pills, then
**New arrivals → Most wanted → a photo album that scrolls sideways by itself (not interactive) → Curated for you (a card)
→ Leaving soon** (almost out of stock). Curated for you = admin picks per region, Leaving soon = 1–2 left (D-056); Most wanted = most pieces ordered in the last 30 days (D-058); the album has no pause control (founder, D-052).

## The product page
Gallery → name, price → variant picker → availability (live) → **delivery window** → add to cart → details: description,
craft, attributes, care or storage → origin line: "Made in India · from <Region> · Imported".
**Target (D-051, not built yet):** one full-length photo no taller than the screen with three stacked photos beside it; a
heart beside the name saves the product; Details and Size chart open and close with + / −; then Reviews (rating + text; photos only from verified buyers; an admin checks each, D-052, D-056), Similar
items and Curated for you as rows of smaller cards (D-062; Similar items' See all opens its category).

## Mobile app (customer side, `apps/app`, built in R6)
Tabs: **Home** (photo hero whose brand name fades on scroll, Just listed, Pick your home: the tappable map, search, stamps
and names, as on the web) · **Explore** (regions, clothing, spices, search) · **Bag** · **Saved** ·
**Profile** (orders, addresses, sign-in, track an order). The screens mirror the web pages above, read the same `store_*`
data through `@repo/db/store` (one call per screen, D-017) and share the tokens (`design.md`).
| Screen | File (`apps/app/app/…`) | Data |
|---|---|---|
| Home, Explore, Bag, Saved, Profile | `(customer)/…` | `store_home()`, `listProducts`, on-device bag, `wishlists` (signed in), own orders |
| Region, product | `region/[slug]`, `product/[region]/[slug]` (same sections as the web pages above; on the product page one photo with three thumbnails, and "Write a review" opens the website) | `store_region_page()`, `store_product_page()` + live availability |
| Checkout | `checkout` | the website's server API: `POST /api/checkout` (server-priced quote + Standard / Express, D-041) → Stripe PaymentSheet → `POST /api/orders` (D-038). The phone never sends prices |
| Order | `order/[number]` (signed-in owner, `store_my_order`) · `order/lookup` (number + checkout email via `POST /api/orders/lookup`, rate-limited, one answer for any mismatch); the faster-delivery offer (D-064) through the same API as the website, paid with the PaymentSheet; cancel / keep through `POST /api/orders/choice` | |
| Addresses, sign-in | `addresses`, `auth/login`, `auth/signup` | own `addresses` rows · Supabase Auth (email + password, as on the web) |
Every list in the app is a sideways row (a horizontal `FlatList`) with **See all** → the **Browse** screen
(`app/browse.tsx`: one type, optional region and category, a virtualized two-column grid), as on the web (D-062).
Signing in with an admin account switches the app to admin mode (`admin.md`). Nothing in the customer UI hints at this (D-006).

## Emails (customer)
Order confirmed (with delivery window) · preparing (optional) · shipped (tracking) · delivered · item unavailable + refund ·
delay notice with cancel option (D-008). All go through `email_outbox` and follow the same whitelist. **Built (C5):** all of
these, plus cancelled, refund, the faster-delivery offer and its confirmation, and "coming sooner" (D-064). The copy is in
`apps/web/lib/email/order-update.ts` (drafted in the D-059 voice; the founder may rewrite it). Sent with Resend's test
sender until launch (D-046).
