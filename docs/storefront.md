# Storefront: customer web + customer side of the app

Target structure. Skeletons are built in R5 (web) and R6 (app), and visual design comes in the coding phase (`design.md`).

## What a customer may see (whitelist, D-003 + D-004 + D-008)
Anything not on this list stays off customer surfaces: pages, app, emails, API responses, meta tags, page source, and
JSON sent to the browser.
- **Region:** name, greeting (approved text only, D-019), tagline, story, image, accent colour.
- **Product:** name, summary, description, story, craft/style name (e.g. "Kanjeevaram silk"), type, category, attributes
  (fibre and care, or ingredients, allergens and shelf life), photos, price, variants (size/colour/weight), availability count, and
  **"Made in India" / "Imported"**.
- **Delivery:** the estimated delivery window, and "order by <date>" (Q-13).
- **Own orders:** number, items, totals, customer-facing status (`flows.md` §8), delivery window, US carrier + tracking link.

**Never shown:** vendor or shop anything, the shop's town, shop price or cost, cycle codes, pickups, payouts, export or AWB
details, admin names, the COO, or anything about India-side operations.
Enforcement: customer code reads only `store_*` (D-017), and INV-1/INV-8 tests (`data-model.md`).

## Web routes (`apps/web/app/(store)/…`)
| Route | Purpose | Rendering (see `engineering.md`) |
|---|---|---|
| `/` | "Where's home?": India map + list of all 36 regions, delivery-window teaser, how it works | static, revalidated on publish |
| `/states` | all 36 regions, alphabetical, with no state/UT distinction (D-002) | static |
| `/states/[region]` | **the core page:** greeting in the region's script, story, accent theme, Clothing · Spices tabs | static per region |
| `/states/[region]/[product]` | product page: gallery, options, price, availability (live), delivery window, origin line | static + live stock island |
| `/clothing`, `/spices` | browse across regions with a region filter | static + client filtering |
| `/search` | search products and regions | dynamic (no auth) |
| `/cart` | cart (on-device state) | static shell |
| `/checkout`, `/checkout/success` | address → delivery window → payment (Stripe) | dynamic |
| `/orders/lookup`, `/orders/[number]` | guest order tracking with email check (kept from old code) | dynamic |
| `/account`, `/account/orders`, `/account/addresses`, `/account/saved` | signed-in customer | dynamic |
| `/login`, `/signup` | customer auth. **No admin mention anywhere** (D-006) | static |
| `/about`, `/how-it-works`, `/faq`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` | info pages. Policy text needs founder input (Q-5 and more) | static |

Why `/states` in URLs: it's the founder's own word for the concept. UTs live under it too (D-002). Headings that list all 36
avoid calling them "states" (e.g. "Pick your home").

**Removed from the old storefront:** `/shop`, `/category/[slug]`, `/size-guide` (size info moves onto product pages),
the duplicate `/wishlist` (→ `/account/saved`), `/order-lookup` + `/order-status/[id]` (→ `/orders/…`), and the
Framer Motion page transitions (speed, `engineering.md`).

## The region page (core experience)
1. Greeting in the region's own script, large, with its Latin transliteration and meaning beneath.
2. Tagline and a short story: why this place feels like home.
3. The accent colour re-themes the page (one CSS variable from `regions.accent_color`).
4. Tabs: **Clothing · Spices**, each a grid of product cards (photo, name, price, availability).
5. Regions with no live products show "Coming soon" (`regions.is_live = false`). Anything more, like a notify-me feature, needs founder approval.

## The product page
Gallery → name, price → variant picker → availability (live) → **delivery window** → add to cart → details: description,
craft, attributes, care or storage → origin line: "Made in India · from <Region> · Imported".

## Mobile app (customer side, `apps/app`)
Tabs: **Home** (map + list) · **Explore** (regions, clothing, spices, search) · **Bag** · **Saved** · **Profile** (orders,
addresses, sign-in). The screens mirror the web pages above, read the same `store_*` data, and share tokens (`design.md`).
Signing in with an admin account switches the app to admin mode (`admin.md`). Nothing in the customer UI hints at this (D-006).

## Emails (customer)
Order confirmed (with delivery window) · preparing (optional) · shipped (tracking) · delivered · item unavailable + refund ·
delay notice with cancel option (D-008). All go through `email_outbox` and follow the same whitelist.
