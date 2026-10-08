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
| `/` | the full-screen photo hero (behind the nav bar too) with only the stacked brand name on the white wall and "Miss local market? Start here." (D-079, `design/pages/shell/`; otherwise D-050 – D-055), Just listed, Pick your home (India map + stamps, in pages of 6 from 7 open states, + names; D-080) | static, cached `store_home()` |
| `/states` | Pick your home as its own page (D-083): all 36 regions, alphabetical, with no state/UT distinction (D-002) | static (same cached read as `/`) |
| `/states/[region]` | **the core page:** greeting in the region's script, story, accent theme, Clothing · Spices sections | static per region (36 built at build time) |
| `/states/[region]/[product]` | product page: gallery, options, price, availability (live), save, delivery window, origin line | static on first visit + live stock island |
| `/clothing`, `/spices` | the **See all** page behind every row (D-062): newest first, `?state=` and `?category=` pills, 24 cards then "Show more" (`?show=`). D-084: the state row pins under the header (a soft fade at its ends, no blur, D-098), the category row scrolls away (fade + a very light blur); phones get one Filter bar (a round icon once scrolled) and a side panel | dynamic render over one cached `store_browse()` read (the cards drawn, the total, the filter counts; D-068) |
| `/search` | search products and regions; 24 results at a time with "Show more" (`?show=`, D-067), through `store_search`, which records the words (not who searched) for the admin's Insights. D-085: the count with the words ("24+ pieces" when Show more has more), matching open states as stamps (coming-soon ones by name), no words or no results → the open states and Just listed; phones: a round search icon in the box | dynamic (no auth) |
| `/cart` | the bag ("Bag" in the UI; on-device state). D-086: a photo on each line, − / number / + (1 – 10), an empty bag shows the open states as stamps and Just listed; the header's bag icon opens the same bag as a side panel (it stays a link to `/cart` for new tabs and without JavaScript) | static shell |
| `/checkout`, `/checkout/success` | D-087: phone (+1, required, no code) → delivery (name, email, ZIP with the city and state filled in from our own list through `GET /api/zip`, D-098; street, apartment, promo code) → server-priced total + Standard (free) / Express with each delivery window (D-041) → payment (Stripe) → order (D-038); finished steps fold to a line with Edit; the bag beside the steps (a bar on phones); `/checkout` sits in the quiet frame of the `(checkout)` route group (logo and Back to bag, a one-line footer). The thank-you page adds the pieces, the total and the delivery window from this tab's priced bag (sessionStorage) | dynamic |
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
4. **Every list is a row that scrolls sideways** (D-062; since D-081 the jump pills get the same arrows and Picked for you
   is a standard row of full-size cards; arrows for a mouse, swipe on a phone; the pills pin under the header). Jump pills at the top
   (New arrivals, each clothing category with its count, Spices). One row per clothing category, biggest first, up to 12
   cards, with **See all** → `/clothing?state=<region>&category=<category>`.
5. Regions with no live products show "Coming soon" (`regions.is_live = false`). Anything more, like a notify-me feature, needs founder approval.
**Target (D-051; built in C1 and C2; the lists are rows, D-062; the album shows once a region has three album photos):** below the hero (greeting, tagline, story, image): Clothing / Spices filter pills, then
**New arrivals → Most wanted → a photo album that scrolls sideways by itself (not interactive) → Curated for you (a card)
→ Leaving soon** (almost out of stock). Curated for you = admin picks per region, Leaving soon = 1–2 left (D-056); Most wanted = most pieces ordered in the last 30 days (D-058); the album has no pause control (founder, D-052).

## The product page
Gallery → name, price → variant picker → availability (live) → **delivery window** → add to cart → details: description,
craft, attributes, care or storage → origin line: "Made in India · from <Region> · Imported".
**D-082 (built in B2):** tablets (768 – 1099 px) two columns (photos left, the small ones in a row under the big one);
any photo opens a full-size viewer over the page (swipe, arrows, arrow keys, Escape); on phones a buy bar slides up
once Add to bag has scrolled away above the screen, and the review cards are a sideways row.
**D-051:** from 1100 px one full-length photo no taller than the screen with three stacked photos beside it; a
heart beside the name saves the product; Details and Size chart open and close with + / −; then Reviews (rating + text; photos only from verified buyers; an admin checks each, D-052, D-056), Similar
items and Curated for you as rows of smaller cards (D-062; Similar items' See all opens its category).

## Mobile app (customer side, `apps/app`, built in R6, redesigned in B6 on D-095)
Tabs on the app's own cream tab bar (a brand bar over the active tab, the bag count as a brand pill): **Home** (the photo
with "Indian Wholesale Club" on its wall and "Miss local market? Start here.", the demo strip on top, Just listed, Pick
your home with stamp pages from 7) · **Explore** (search with the count, States · Clothing · Spices; states as stamps) ·
**Bag** (photos, − / + , the empty bag shows stamps and Just listed; the bag is a tab, so no bag panel) · **Saved** (cards
with a filled heart that removes) · **Profile** (Orders · Addresses · Your details as pill tabs, Track an order, About us &
help, Sign out; signed out, the sign-in card). Tab roots have a large Syne title, pushed screens a back bar. The screens
follow the web pages above, read the same `store_*` data through `@repo/db/store` (one call per screen, D-017) and share
the tokens (`design.md`). About us & help is the D-092 panel as a sheet with the seven tabs; its wording comes from
`packages/shared/src/info/` (one source with the website's info pages).
| Screen | File (`apps/app/app/…`) | Data |
|---|---|---|
| Home, Explore, Bag, Saved, Profile | `(customer)/…` | `store_home()`, `store_type_rows()`, search, on-device bag, `wishlists` (signed in), own orders as cards (`listMyOrderCards`), `store_policy()` for the help sheet |
| Region, product | `region/[slug]`, `product/[region]/[slug]` (same sections as the web pages above: the region photo first and jump pills; on the product page the photos edge to edge with a full-screen viewer, the buy bar, reviews as a row, and "Write a review" as a sheet with the D-090 form, D-095) | `store_region_page()`, `store_product_page()` + live availability |
| Checkout | `checkout` | phone → delivery (the ZIP fills the city and state through the website's `GET /api/zip`) → payment, as on the web (D-087); the website's server API: `POST /api/checkout` (server-priced quote + Standard / Express, D-041) → Stripe PaymentSheet → `POST /api/orders` (D-038). The phone never sends prices |
| Order | `order/[number]` (signed-in owner, `store_my_order`) · `order/lookup` (number + checkout email via `POST /api/orders/lookup`, rate-limited, one answer for any mismatch); the faster-delivery offer (D-064) through the same API as the website, paid with the PaymentSheet; cancel / keep through `POST /api/orders/choice` | |
| Addresses, sign-in | `addresses` (the add / edit form), `auth/login`, `auth/signup` | own `addresses` rows · Supabase Auth: the sign-in card with the eye, Forgot password (the link opens the website's "Set a new password") and the email code (D-091) |
Every list in the app is a sideways row (a horizontal `FlatList`) with **See all** → the **Browse** screen
(`app/browse.tsx`: one type, optional region and category, a virtualized two-column grid that loads 24 at a time as it
nears the end, each page and the total from one `store_browse()` call, D-068), as on the web (D-062). Explore's Clothing and Spices read only each
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
