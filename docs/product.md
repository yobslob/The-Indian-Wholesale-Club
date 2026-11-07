# Product: The Indian Wholesale Club (IWC)

Last reviewed 2026-11-05 for D-187 (the glossary is at the end). Every rule cites `decisions.md`. Unknowns live in `questions.md`, not here.

## The problem [D-001, D-022]
Indians living in the US miss home, and specifically the clothing, food and things of *their* region. Today they either:
- wait for international couriers, which take a long time and are very expensive for Indians living abroad, or
- ask a relative or friend travelling from India, and carry the feeling of owing them a favour.

## Who it's for [D-001]
- **Primary:** Indians living in the US.
- **Secondary:** US citizens who love India.

## What we sell [D-001, D-002]
- **The feeling of home**, through each region's own clothing, food, and home & gifts.
- **36 regions:** all 28 states and 8 union territories, presented identically. There is no "state vs UT" anywhere in the UI.
- **Product types:** `clothing`, `food` (masalas, namkeen, sweets, pickles, staples) and `home` (D-106, D-110). New types only by founder decision.

## How it works

**What the customer sees** (the whole customer-side story, D-003):
1. Pick your home region.
2. Browse its clothing, food and gifts, then order and pay in USD.
3. Receive it in the US: food in 7 delivery days, clothing and home & gifts in 12 – 16. Checkout shows the estimated dates
   before payment (D-008, D-187).

**What happens behind the scenes** (admin only, never on a customer surface, D-003 and D-187):
1. Listings are imported from Indian online shops by the admin's importer and the sourcing runner; prices follow the
   shop's price by the founder's beta rules (D-128).
2. When a piece sells, the India desk buys it from that online shop, to the hub (1 – 10 days).
3. It is weighed at the hub and flown to the customer's door (8 – 11 days), food as its own shipment.

## Team [D-007]
| Person | Side | Owns |
|---|---|---|
| Founder | US | customers, returns, US clearance stock |
| COO | India | buying from the online shops, the hub, weighing, sending the parcels |

## Brand [D-009]
Name: **The Indian Wholesale Club** (short: IWC). A US-based site, hosted in the US (D-003).
Retail to consumers. "Wholesale Club" is only the name, with no B2B or membership (D-025). Voice and look: `storefront.md`.

## Principles
1. **Emotion first.** Each region page should feel like that place: its greeting, its colours, its story. (D-002)
2. **Honest.** Real origin (D-004), real delivery windows (D-008).
3. **Seamless for customers.** IWC is the seller, and operations stay invisible (D-003).
4. **Instant.** Speed was the founder's first complaint about the old code (D-011). Budgets are in `engineering.md`.
5. **Built for two operators.** The admin must let two people run everything, often from a phone (D-006, D-007).

## Surfaces [D-006, D-010]
| Surface | Who | Notes |
|---|---|---|
| Web storefront | everyone | `storefront.md` |
| Mobile app (iOS/Android) | everyone | the same app; admin mode unlocks after an admin signs in |
| Web admin `/admin` | founder, COO | hidden, loaded only after admin sign-in (`admin.md`) |
| App admin mode | founder, COO | Today, Orders, Listings, More: the buying and shipping jobs on a phone (`admin.md`) |

## Not decided yet (see `questions.md`)
US carrier (Q-3) · returns policy (Q-5) · domain, support email and hosting (Q-9) · food compliance details (D-074).

## Later ideas (not scheduled, founder must approve)
- **"Ask for it from home":** a customer requests an item from a region and the team sources it. This directly replaces asking a relative.
- **Notify me** when a region gets new pieces.
- **Gift boxes** per region.

## Glossary: one word per concept, everywhere (was the glossary below)

Use these exact words in the DB, code, folders, routes, tests and docs. The "Don't use" column lists synonyms that cause
confusion. If you need a concept that isn't here, add it (and a decision if it's a business rule).

| Term | Meaning | In code / DB | Customer copy | Don't use |
|---|---|---|---|---|
| **region** | one of India's 28 states or 8 UTs, all treated the same (D-002) | `regions`, `region_id`, `/states/[region]` | the region's name; "state", "home" | `state` in code (clashes with React state and the US address field), province |
| **product** | a sellable item as customers see it ("Kasavu saree") | `products` | product name | item, listing |
| **variant** | one buyable option of a product (size/colour or weight), with its own SKU and stock | `product_variants` | size / weight picker | SKU as a synonym for variant |
| **product type** | `clothing`, `food` or `home` (D-106, D-110). Decides which attributes and options apply | `product_type` | "Clothing", "Food", "Home & gifts" | kind, spice (renamed food, D-110) |
| **category** | a browse group inside a type (Sarees, Kurtas, Masalas…) | `categories` | category name | collection |
| **source** | the online shop's product page an imported pilot listing was copied from (D-110). **Admin only** | `products.source_url`, `source_site`, `source_checked_at` | never shown | link, origin (origin is the region, D-004) |
| **pickup** | one ordered piece on the buy list, from To order to At the hub (D-187: a pickup **is** the buy list). **Admin only** | `pickups` | never shown | collection, sourcing |
| **food shipment** | the part of an order that is food: its own parcel, 7 delivery days, bought within 2 hours and shipped by the next day (D-187) | `order_shipments.kind = 'food'`, `food_ids` | "Shipment 1 · Food" | 7-day shipment, quick shipment |
| **delivery day** | a working day, Monday to Friday, counted from the order day; flight delays are not part of the promise; said on store pages instead of a date and explained only in the FAQ (D-187) | `_add_business_days`, `addBusinessDays`, `food_delivery_days_*`, `delivery_days_*` | "7 delivery days", "12 – 16 delivery days" | business day (in customer copy), working day (in customer copy) |
| **model folder** | a model for the face swap on new clothing photos: only a folder on the laptop, `IWC_MODELS/house-models/w-1…, m-1…` (w = women, m = men), with its `front.jpg` (D-187) | `tools/photo-worker` | never named | mannequin, avatar |
| **small-order charges** | below the free-shipping line, a bag's **Shipping**, struck through at $0.00 from the line up (D-111, D-112); **Retailer charges** always paid (D-191; Settings) | `store_bag_charges()`, `orders.retailer_charge_cents` | "Shipping", "Retailer charges" | small order fee, surcharge |
| **bulk saving** | from its own line up ($99.99, D-187), a % of the amount over the line taken off the bag, up to a cap; after the cap, pieces add at full price (D-119) | `bulk_saving_from_cents`, `bulk_saving_pct`, `bulk_saving_cap_cents`, `orders.bulk_saving_cents` |
| **all-India listing** | a listing with no state (`products.region_id` null): the store names no state for it, it fills every state's page after the state's own pieces and lives at `/states/india/<slug>` (D-121) | `region_id is null`, `ALL_INDIA_SLUG`, `productPath()` |
| **pack** | a food piece's pack size on its card ("200 g"), from its option or its name (D-122) | `_store_pack()`, `pack` on cards |
| **beta pricing** | the one price formula, the founder's exact rules: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ 0.80 food / 0.60 clothing / 0.50 home & gifts ÷ ₹92, to the cent (D-127, D-128). The paused full formula went with D-187 | `autoPrice`, `_auto_price_cents`, `BETA_PRICING` |
| **weight source** | where an option's weight came from: weighed, admin (typed), shop (its own page), similar (a matching item or another size), estimated (the weight estimator, when sure, D-131), class (clothing by the founder's four classes, D-132), packed (food: its label's net quantity, D-135; home: the piece's own weight plus its packing, D-134); a listing goes live only when every option has a weight (D-129) | `product_variants.weight_source`, `weight_note`, `WEIGHT_SOURCES` |
| **clothing class** | the founder's four clothing weights: light 350 g, medium 750 g, pants and footwear 800 g, heavy 1.5 kg (a kids' set medium); read from the listing's name, then its category (D-132) | `classifyClothing`, `CLASS_GRAMS`, `pnpm weights classes` |
| **net quantity** | food's net quantity is what its label states ("400 g", "2 × 200 g"), shown to customers; since D-135 it is also the weight the price uses (no packaging; D-133 had added the pack) | `product_variants.net_qty`, `weighFood`, `pnpm weights food` |
| **coming soon** (piece) | a listing archived for admins and left out of every store read: today, liquids, which are not sent (D-135, D-187 plan Y-9). The admin still sees it | `products.coming_soon`, `liquidReason`, `pnpm sourcing liquids` | never shown | — |
| **weight estimator** | the laptop tool that gives listings a packed weight from a local model and the most similar known weights; a sure one becomes the weight, an unsure one a suggestion (D-131) | `tools/weight-estimator`, `pnpm weights`, `product_variants.weight_estimate_g` |
| **shipment** | a parcel sent to a customer, with tracking number; an order has one or two (food, then the rest) | `order_shipments`, `orders.tracking_number`, status `shipped` | "Shipment 1", "Shipped" | export |
| **delivery window** | the from/to dates of an order, shown at checkout and on the order page, never on other store pages (D-008, D-187) | `orders.est_delivery_from/_to` | "Estimated delivery" | ETA (in customer copy) |
| **desk** | which side an admin works: `us` or `india` (D-007) | `profiles.desk` | never shown | team, side |
| **store view** | a DB view or function that exposes only customer-safe columns (D-017) | `store_*` | — | public table |
| **shop price** | what IWC pays the online shop per piece, in paise. **Admin only** | `*_paise` | never shown | cost (ambiguous) |
| **draft content** | text drafted by Claude, awaiting founder approval (D-019) | `content_status = 'draft'` | hidden until approved | — |
| **placeholder** | fake dev/demo data, must never reach production | `is_placeholder = true` | — | mock, dummy |
| **founder / COO** | the two admins (D-007) | `role = 'admin'` + `desk` | never shown | staff, owner |
