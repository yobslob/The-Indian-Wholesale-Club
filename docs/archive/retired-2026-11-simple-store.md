# Retired with the simple store (D-187, 2026-11)

Moved whole from the living docs, nothing rewritten: how the 7-day store, vendors, cycles, payouts, Express, the
house models table and the rest worked before D-187. History only: none of this exists in the code any more
(`docs/archive/simple-store-plan.md` §3 lists what went). Paths and § numbers are as they were.

---

# From flows.md

## 1. The cycle (one round every 20–23 days, D-005)
```
open ──cutoff──► collecting ──► packed ──► exported ──► arrived ──► fulfilling ──► closed
 (orders join)   (COO picks up  (COO packs  (in transit   (founder    (founder ships
                  from vendors)  the export)  to the US)    receives)   each order)
```
- Exactly one cycle is `open` (INV-5). **At its cutoff it closes by itself** (pickups created, as an admin cutoff does)
  **and the next one opens** with its cutoff, estimated export and estimated arrival moved forward by the "days between
  cutoffs" setting, or by the gap between the last two cutoffs while that is unset (D-045, D-063). `roll_cycles()` does it
  every minute (pg_cron) and `create_order` does it first, so no order joins a cycle after its cutoff. Between a cutoff
  and the roll, the store and checkout already show the next cycle's window. An admin can still cut off early (the
  next cycle opens too) and corrects the new cycle's dates on its page. With neither the setting nor an earlier cycle to
  copy, no cycle opens and Today says so.
- A payment priced before a cutoff that completes just after it joins the cycle that just closed, with its pickups,
  while that cycle is still collecting; after that it is refused and refunded in full (D-065).
- An admin can correct a cycle's dates (the cutoff only while open). There are no fixed lead times (D-026), so nothing is
  hard-coded.
- After the cutoff, status changes are admin actions: `advance_cycle()` one step at a time. The cutoff writes a
  customer-visible `preparing` event per order; `advance_cycle()` writes internal ones.

## 2. Listing a product (India desk, usually on a phone)
1. Choose a vendor. The region comes from the vendor.
2. Take photos, then pick the type and category, then fill the name and details. `attributes` are validated per type.
3. Add variants with their options and the quantity the shop has (`qty_listed`).
4. Enter the shop price in ₹. The system suggests a USD price from `pricing_settings` (landed cost + margin), and an admin sets the final `price_cents`.
   While those settings hold Claude's researched estimates (D-047, C6), the suggestion says "based on estimates".
5. Save as `draft`. An admin reviews it and sets it `live`. Food goes live only while "Food is cleared" is on (D-074, D-110).
- `qty_confirmed_at` records when the shop last confirmed quantities. The admin sees listings not confirmed within N days
  (N is set in `pricing_settings`) so they can re-check with the shop.
- **Built (C3):** steps 1–5 on a phone (app admin → Listings → New listing: camera or photo library, photos shrunk to
  2,400 px and uploaded after the draft is saved, failed photos can be sent again) and on the web; both go through
  `admin_create_listing` (one transaction) and the shared `listingInputSchema`. Publishing a clothing draft works in
  the app and on the web. The re-check list is on Today and Listings (web) and Today (app). Offline drafts: later (F-3).

## 2b. Pilot: a listing imported from an online shop (D-110)
1. The admin imports a product page (`admin.md` §Import from shops): photos, words and the shop's price come from the
   page; the admin confirms the state, type, category and details. The listing belongs to that shop's online vendor in
   that state, and its shop price is the shop's price, so the dollar price follows D-109.
2. It sells like any piece: the order joins the open cycle and its window comes from cycle data (D-008).
3. At the cutoff it gets a pickup like any piece. The India desk opens "Order it online", orders it to the hub (1–10
   days, the founder's figure), marks it picked once it arrives, and it is flown to the US with the export (8–11 days).
4. Importing the page again before an order updates the price and the sizes in stock; a size the shop no longer has
   stops selling, and pieces already ordered stay reserved.

## 4. Pickups (India desk)
1. At cutoff, the system creates one `pickup` per ordered piece, grouped by vendor into a per-shop checklist.
2. The COO visits each shop and marks every piece `picked` (optional photo) or `unavailable`. Pieces without a cycle
   (express, D-070, and the made-to-order pilot, D-115) are marked on their order's page (web and app).
2a. Weighing (D-130): with a piece in hand the desk may type its weight (one piece, packed) next to Picked, or under a
   picked piece. `admin_weigh_pickup()` makes it the option's weight (`weighed`, D-129), the same piece's other sizes
   that only guessed follow (`similar`, never a pack), the listing is repriced for the next customer (D-128; a hand-set
   price stays), and the pickup keeps the note ("Weighed 310 g (listed 450 g, -31%): price now $25.30, was $17.33").
3. `picked` → stock moves from reserved to picked, and the shop price is added to that vendor's payable.
4. `unavailable` → the piece is written off (the shop no longer has it: `qty_listed` and the reservation both drop, ledger reason
   `unavailable`), the order item becomes `unavailable`, and the customer is refunded for that item and notified
   (no substitutes, D-030). The admin refunds it from the order page: the item's price after its share of any discount +
   its share of the tax; the last piece of an order refunds everything left (D-042). The customer message never mentions shops (D-003).

## 5. Payouts (India desk) [D-005]
- A vendor's payable is the sum of their `picked` pickups not yet covered by a payout.
- The COO records a payout (amount ₹, method, reference, optional receipt photo, D-029) linked to the pickups it covers.

## 6. Export → arrival → US fulfilment
1. `packed`: the COO generates the packing list and commercial invoice from the cycle's picked items (cycle page →
   Packing list and commercial invoice: print or save as PDF from the browser, or download CSV). The invoice lists the
   goods; its exporter, consignee, HS codes, declared value and Incoterms stay blank and marked until Q-30 is answered.
2. `exported`: AWB and forwarder are recorded, with the freight, duty and exchange rate actually paid (cycle page,
   from `packed` on; the page warns while the AWB or forwarder is missing after export).
3. `arrived`: the founder marks the export received and checks off each order's picked pieces as they come out of the
   box (`check_off_arrival`, website and app; a tick can be undone).
4. `fulfilling`: for each arrived order, the founder packs it, picks the carrier (USPS, UPS or FedEx give the customer
   a tracking link, D-066; another carrier is typed) and enters the tracking number: `ship_order()`, the order becomes
   `shipped` (the admin is warned while a piece is not checked off as arrived). Then `deliver_order()`: `delivered`.
4a. **Two shipments (D-154):** an order whose 7-day pieces travel apart has two, each shipped from the order page with
   its own carrier, tracking number and email (`ship_shipment`, `deliver_shipment`). The 7-day one leaves the hub by
   courier once its pieces are there (bought within 2 hours, shipped the next day); so does any shipment of an order
   without a cycle (the made-to-order pilot, D-115; until 2026-10-24 such an order could not be marked shipped). The
   order is Shipped once nothing is left to send and Delivered once everything sent has arrived; a shipment whose
   pieces all became unavailable is cancelled by itself and the other goes on.
5. `closed`: all orders in the cycle are delivered, refunded or cancelled.

## 6b. Moving an order to another cycle (D-045, D-064)
- An admin moves an order to the cycle it really travels with (web admin, order page). The whole order moves, all its
  pieces, since it reaches the customer as one parcel (interpretation, proposed). Only before it leaves India
  (`confirmed`, `collecting`, `packed`), into a cycle that is open, collecting or packed. Its pieces follow it on the
  pickup lists (created if it joins a cycle past its cutoff), and its status follows the cycle.
- **Later** (it missed the export): the promised window changes if the new one ends later, with a customer-visible
  "New delivery estimate" (INV-6, D-008). The delay notice with its cancel option is C5.
- **Earlier** (squeezed into an earlier export): nothing changes for the customer yet. Once that export has left, the
  admin confirms on the cycle page that the order went with it. The customer is then offered the earlier window for
  the "faster-delivery offer" price in Settings (D-064); while that price is unset, no offer is made. They see it on
  their order page (website and app) and pay there; the server checks the payment with Stripe (browser, app or the
  webhook, whichever comes first) and the window moves to the offered one. A payment for an offer that closed
  meanwhile is refunded in full. If they don't, the promised window stays, and when the order ships in the US they
  are told it is coming sooner. Nothing says why (D-003).

---

# From product.md

| **vendor** | a shop in India that supplies pieces. **Admin only** (D-003) | `vendors`, `vendor_id` | never shown | supplier, seller, merchant, shop (in code) |

| **online vendor** | the vendor row that stands for an online shop in one state (D-110). **Admin only** | `vendors.online_site` | never shown | marketplace (in code) |
| **vendor account** | the sign-in of a vendor's owner (D-102): uploads their own pieces, sees only their own | `profiles.role = 'vendor'`, `vendor_accounts`, `is_vendor()`, `vendor_*` functions, `/vendor` | never shown (vendor copy: "your shop") | retailer, partner, seller account |
| **house model** | one of the founder's 10 AI-generated, licensed models (6 women, 4 men) who wear the pieces in AI photos, each in two poses: front and back (D-101, D-104) | `house_models` | never named | mannequin, avatar |
| **photo job** | one queued run of the photo pipeline for one product view (D-103) | `photo_jobs` | never shown | task |
| **cycle** | one round: take orders → cutoff → collect from vendors → export → arrive in the US → deliver. One export every 20–23 days (D-005). **Admin only** | `cycles`, `cycle_id` | never shown. Customers only see dates | batch, shipment |
| **cutoff** | the last moment an order joins the current cycle | `cycles.cutoff_at` | "Order by <date>" (D-035) | deadline |
| **export** | the physical India → US consignment of a cycle (AWB, customs) | fields on `cycles` | never shown | shipment (reserved for the US parcel) |
| **pickup** | collecting one ordered piece from its vendor. **Admin only** | `pickups` | never shown | collection, sourcing |
| **payout** | a payment in INR to a vendor for collected pieces. **Admin only** | `vendor_payouts` | never shown | settlement |

| **bulk saving** | from the free-shipping line up, a % of the amount over the line taken off the bag, up to a cap; after the cap, pieces add at full price (D-119) | `bulk_saving_pct`, `bulk_saving_cap_cents`, `orders.bulk_saving_cents` |
| **small-food shelf** | light, cheap food (up to ₹200 and 250 g by default) priced on whole-dollar steps, $1.99 – $3.99, carrying half its shipping share (D-120); not used while food has a margin band (D-126) | `small_food_*` in `pricing_settings`, rule `small` in `autoPrice` |

| **7-day piece** | a live listing whose every option on sale is bought from a quick-delivery shop (Blinkit, BigBasket, Zepto, Instamart), so a bag of only such pieces arrives in the 7-day days from Settings; one other piece makes it a normal bag (D-148) | `_quick_listings()`, `quick_days`, `store_quick_bag`, `sourcing_shops.quick_delivery`, `quick_delivery_days_*` | "In 7 days", "7-day delivery" | express (that is the courier, D-070), fast delivery (that is the faster-delivery offer, D-064) |

| **food weight** | retired (D-125): the part of Shipping that carried food's flight when prices carried less of it (D-123, D-124) | unused `food_off_*` settings |
| **beta pricing** | the fixed formula during the beta, the founder's exact rules: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ 0.80 food / 0.60 clothing / 0.50 home & gifts ÷ ₹92, to the cent (D-127, D-128) | `pricing_settings.beta_pricing`, `BETA_PRICING`, rule `beta` in `autoPrice` |
| **food margin band** | food priced 17–20% on its cost, without the profit guard or the small-food shelf; the bag's Shipping covers a piece that cannot pay its duty (D-126) | `margin_food_pct` (bottom), `food_margin_max_pct` (top), `_band_price`, rule `band` in `autoPrice` |

| **coming soon** (piece) | a listing archived for admins but shown to customers with "Coming soon" and the heart instead of a price and Add; today: liquids, which are not sent (D-135) | `products.coming_soon`, `store_products.coming_soon`, `liquidReason`, `pnpm sourcing liquids` |

| **profit guard** | the floor under every automatic price: the margin must pay US duty and the card fee and still leave the type's minimum profit (D-119) | `duty_<type>_pct`, `min_profit_*`, `guard_card_fee_pct` |
| **shipment** | the US domestic parcel sent to a customer (with tracking number) | `orders.tracking_number`, status `shipped` | "Shipped" | export |
| **delivery window** | the from/to dates promised before payment (D-008) | `orders.est_delivery_from/_to` | "Arrives Oct 30 – Nov 4" | ETA (in customer copy) |

| **shop price** | what IWC pays the vendor per piece, in paise. **Admin only** | `*_paise` | never shown | cost (ambiguous) |
| **landed cost** | shop price × FX + share of freight and duty | pricing module | never shown | — |

---

# From pilot-numbers.md

## 6. Cycles and offers (Settings → Cycles and offers)
| Variable | Placeholder | Basis |
|---|---|---|
| Days between cutoffs | 21 | D-005: 20–23 days |
| Faster-delivery offer | $6.00 | Below the express fee (D-064) |
| Re-check shop quantities after | 14 days | Half a cycle |

---

# From monitoring.md

| Timers | the pg_cron jobs (cycles, email outbox, FX, search words, payment sweep) ran in the last hour | query C below |
| Exchange rate | refreshed today (D-075) | query E; Admin → Settings (the exchange rate) |

| Exchange-rate service down | prices keep the last rate; a jump over 10% is held for an admin (D-075) | query E | nothing; check Settings |

---

# From admin.md

| **Today** | what needs doing now: pickups due, stale listings, payouts due / exports to receive, orders to ship, delay warnings | both | ✓ | ✓ |

| **Vendors** | onboard a shop in about a minute (name, owner, phone/WhatsApp, region, payment method, licences, photo), history; its vendor accounts with the one-time QR / link, the screens' language, switch off (D-102); "Join as a vendor?" requests | India | ✓ | ✓ |
| **Listings** | add products with the camera (`flows.md` §2), confirm quantities, drafts → live | India | ✓ (incl. the re-check list) | ✓ (new listing with the camera, publish, confirm qty; 50 with "Show more", D-067) |
| **Cycles** | current cycle timeline and dates, cutoff, per-shop pickup checklists, packing list + commercial invoice export, export/arrival | both | ✓ (closes and opens by itself, D-045; dates corrected on the cycle; orders moved in, confirmed as shipped (D-064); export details; arrival check-off; packing list + commercial invoice (print/PDF and CSV; Q-30 fields marked)) | ✓ (pickups, cutoff, next step, arrival check-off) |
| **Payouts** | payable per vendor, record payouts | India | ✓ | ✓ |

| **Insights** | sales by state, category and shop (with what the shops were paid), for 30 days, 90 days or all time; searches that found nothing (what to list next; since D-160 also those that found only some of their words), top searches, most saved pieces; D-160: **found after a spelling fix** (the customer's words search read as the nearest listed word) with **Add … = …** (web only), which makes the customer's word a synonym (`admin_add_synonym`); D-154: **7-day delivery**: orders with a 7-day shipment and split ones, where the 7-day pieces stop against the $49.99 line, on time per kind of shipment against the date promised at order (late ones with their notice sent first, ones still open past their day), 7-day pieces refunded as unavailable, the split's extra courier cost. Real numbers only, computed in SQL (`admin_sales`, `admin_demand`, `admin_quick_insights`, `admin_search_fixes`) | both | ✓ | — |
| **Vendor pieces** | pieces vendors sent (D-102, D-103): their real photos, the AI candidates per pose, pick, name, care, price (empty = from the shop price), publish; or make a pose again on another model, ask for new photos, decline (§Vendor screens) | both | ✓ | — |
| **House models** | the founder's models (D-104): front and back pose each, switch on / off | both | ✓ | — |
| **Settings** | pricing settings, each estimate labelled with its source and date until the founder saves their own (D-047); the pilot price's two recipes, the courier rate card, the profit guard, the bulk saving and the small-food shelf ($1.99 – $3.99, D-120), with a **profit check** under them that reprices sample pieces and bags as the numbers are typed (web, D-119); **7-day delivery: Pause / Switch back on** (D-154: paused, no 7-day tags, page or split; placed orders keep their dates) (admins are managed in the DB + `ADMIN_EMAILS`, `ops.md`) | both | ✓ | — |

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

- **Today in the made-to-order pilot (D-140, A2):** with no cycle open (D-115) there is no "customers cannot check out"
  warning; the India desk's queue starts with Pieces to order (and how long the oldest has waited), Ordered on the way
  to the hub, At the hub to weigh and Prices held for you; cycle pickups and the hand re-check of shop quantities show
  only while a cycle is open (imported listings are re-checked by the runner, D-118); the US desk's first job is Orders
  in the US to send on.
- **Times** in the admin's desk zone (`profiles.desk`; none set → New Jersey first) with the other zone beside them,
  never UTC (`time.ts`); cycle cutoffs are typed in that zone.

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

## Payment test (web, 2026-11-03)
`/admin/settings/payment-test`, linked from nowhere, admin only (the panel's server check): whether the Stripe account
behind the deployment's keys is live, can take payments and pay out, where payouts go (bank or debit card, last four),
its balance and what Stripe still asks for; then **Make a $1 test payment** through the store's own card form
(`PaymentForm`, so the domain's security rules and the live publishable key are tested too) and the result read back
from Stripe: status, card brand and last four, **Refund this $1** (Stripe keeps its fee). Test payments carry
`metadata.kind = 'admin_test'`: the webhook skips them (the kind lives in `features/checkout/test-payment.ts`) (no order, no "Paid, but no order" alert), the payment sweep
never sees them (no stored checkout), and only this page refunds them.

- **Where it lives.** A listing of the shop's online vendor for that state (`vendors.online_site`, made on first use),
  with `products.source_url`, `source_site`, `source_checked_at`, `source_in_stock` (admin only).

- **When one sells.** The cycle's pickup cards (web and app) show "Order it online" for an imported piece: the India
  desk orders it there to the hub, then marks it picked as usual. The product's page lists **Where to order it**: every
  shop item each variant can be ordered as, the one in use first ("ordered from here", D-118).

- **7-day delivery (D-148).** `sourcing_shops.quick_delivery` marks the shops whose pieces reach the hub within the
  hour (Blinkit, BigBasket, Zepto, Instamart; set by the migration, no screen yet); a live listing whose every option
  on sale is bought there is a 7-day piece on the store. Settings → Standard delivery → "7-day delivery: days from the
  order" holds the promise (7 and 7; empty switches it off). The first batch: `tools/sourcing-runner/out/blinkit-7-day.csv`
  (gitignored; 113 Blinkit targets, up to 2,972 listings, only what can be sent: no dairy, meat, eggs, frozen food,
  liquids, honey, oils, electronics, lights, batteries, cow dung, feathers, fireworks, camphor, loose powders, lighters
  or matches), added through Add targets from a CSV and run with `pnpm sourcing run --type food` / `--type home`.
  **Bought there (D-162):** a listing that can be bought whole from the quick shops (every option with a usable source
  has one there: in stock, no price held, inside the delivery limit) is bought there, even when a backup elsewhere is
  cheaper, when it is added and at every weekly check (`_sourcing_settle`); a quick shop sold out or held hands the
  piece to its backup and the tag goes. Listings settled before: `pnpm quick:sources` (`ops.md` §Sourcing runner).

- **Liquids are not sent (D-135).** The runner checks every food and home listing once (each new one as it adds it,
  the rest at the end of each run; alone: `pnpm sourcing liquids --dry`): a liquid (a juice, sharbat, soda, oil,
  syrup, sauce, attar, rose water, anything sold by the ml or litre, or a page saying "Item Form: Liquid"; never
  pickles, pastes or powders) is archived and shown to customers as **coming soon**: no price, no Add, the heart to
  save it. Products → Archived marks it "coming soon on the store"; its page says why and has **Hide it from the
  store** / **Show it as coming soon**. Publishing it again ends its coming soon, and the check never undoes that.

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

---

# From storefront.md

| `/` | **the hero (D-182 – D-185), one screen at every size, behind the nav bar:** the 7-day store's poster (`public/images/home-hero-7day.avif`, the founder's Diwali picture with no words of its own; the whole poster a link to `/7-day-delivery`): on its dark wall, in the poster's own type (D-185: Cormorant Garamond and Montserrat, Home only, `hero-font.ts`), the Diwali date ("Diwali · Sun, Nov 8" with a hairline, `diwali-hooks.ts`), "Mithai. Masala." and *Memories.* in gold italic, "From India to your door in 7 days (on food)." (D-186) and a small gold button that is the free line ("FREE DELIVERY" over "from $49.99") (words in `hero-words.ts`, Claude's draft kept by the founder; the days and the free line from Settings; while 7-day delivery is off the poster opens Food with the store's days and "Shop the store"). Under it on portrait screens, beside it on landscape ones, a dark panel: "Indian Wholesale Club" (the page's h1, Cormorant Garamond) and four doors (Clothing, Food, Home & gifts, States), nothing else; the header's logo always shows; `e2e/home-hero.spec.ts` holds all of it inside a phone's first screen. Then the album of all of India (the region pages' drifting mosaic; since D-169 only the founder's own Home photos, in the order set in the admin's Home photos; it opens with the clip-and-scale reveal and a gentle parallax, D-113), the Diwali windows (D-174: a Diwali night with the flight inside, "Host your Diwali under $99", and three arch windows in a row under a toran (D-177; about 1 : 1.56 on phones since D-183, the diya left off there), Clothing from $11.45, Snacks from $0.39, Get snacks from your neighbourhood, each with the founder's photo and a button (D-175, D-176); since D-179 the arches sit right under the hero, before the album, and the night stays after the album; `features/home/diwali-windows.tsx`, words in `diwali-hooks.ts`), Pick your home (India map + stamps, in pages of 6 from 7 open states, + names; D-080), then Just listed (D-113): since D-140 one heading and a row per type (Clothing, Food, Home & gifts), each with its own See all, a type with fewer than four pieces left out; pieces published at the same moment take turns by shop and category (D-140, L8). D-154: while the 7-day store is open, one row "Arrives in 7 days" (the days from Settings; See all → `/7-day-delivery`) just before Just listed, its cards without the tag | static, cached `store_home()` |

| `/states/[region]/[product]` | product page: gallery, options, price (D-155: a heavy piece's option adds the tag "Heavy-item shipping" and "+ $65.21, added at checkout"), availability (live), save, delivery window, origin line; an all-India listing lives at /states/india/<slug> (D-121; `india` is no state's slug and has no page of its own) | static on first visit + live stock island |
| `/clothing`, `/food`, `/home-and-gifts` (D-106, D-110; the old /spices address redirects to /food) | the **See all** page behind every row (D-062): low to high (D-144; with a state, its own pieces before the all-India ones under every sort, D-140 L2, D-181); on Clothing with no category one of each category, then the next of each, with Accessories and Turbans & Headwear in a velvet drawer after the second row of every 24 cards (12 a drawer, See all → accessories), filters in the address (`?state=`, `?category=`, `?for=women|men` (D-140), `?delivery=7-day` (D-154: "Delivery: in 7 days", the first filter group while the type has 7-day pieces, with their count), `?min=` / `?max=` in dollars, `?size=` repeated, `?sort=price-asc|price-desc|new`), 24 cards, then the next 24 each time the screen's bottom reaches the row above the last (D-166, replacing D-136's Show more; the 24 after them read ahead; the address never changes; a loading circle if the shopper gets there first). D-136 replaced D-084's state and category pill rows with the left filter panel; below 1024 px one Filter bar (a round icon once scrolled) opens the same groups in a side panel that stays open until "Show n pieces" | built once per address and served from the cache like the state pages: `next.config.js` rewrites each address and its filters to `app/(store)/see-all/[type]/[state]/[category]/[show]/[for]` (the browser keeps `/clothing?state=…`; canonical is the public address); one cached `store_browse()` read (the cards drawn, the total, the filter counts; D-068). Price, size and sort are read in the browser (`features/catalog/use-browse.ts`), from `GET /api/browse` (the same cached read; in-memory rate limit) |
| `/7-day-delivery` | D-154: **the 7-day store's front page** (D-148's page, kept; D-166: pictures, not paragraphs): "Home is 7 days away." beside a parcel's address label (From India, To your door, "Order today, open it Sat, Oct 31.": the real next date, today + the 7-day days from Settings, worked out again in the browser so a cached page never shows yesterday's; duties ticked; a stamp with the weekday) and the founder's photo (`slots.ts`), the flight towing "Free delivery from $49.99" (or the festival's last order day), the category tiles (a photo each: the founder's own from `features/seven-day/tile-photos.ts` when set, else the category's newest piece, 2026-11-03; no shelf under them since 2026-10-31; a tile opens its category's 7-day See all page), the rows What everyone missed this week (by units ordered, never shown), The kirana counter (under $5), the seasonal poster, New this week, then a row per type (Food, Home & gifts: "11 pieces in 7 days") with See all, as the IWC store's Home ends (founder, 2026-10-24: "the same aesthetics for 7-day store as the main one"). "From your state" is not built: the site keeps no chosen state. No shop is ever named. 404 while 7-day delivery is off or paused | cached `store_quick_front()`, `store_quick_browse()` (the categories' types) and each type's first `store_browse(p_quick)` page (the same entries as its See all page) |
| `/7-day-delivery/food`, `/7-day-delivery/home-and-gifts` (`?category=`) | the 7-day store's **See all** pages (founder, 2026-10-24): the IWC store's See all (`browse-view.tsx`: the filter panel with Category, State, Price and Pack or Size, chips, Sort by, the endless scroll, the Filter bar on phones) with only 7-day pieces, always: no Delivery filter or chip, no tag on the cards, the address without `?delivery=` (`BrowseQuery.inQuick`). At the top the same frosted switch as the IWC store's types: Everything (the front page) · Food · Home & gifts. The tiles and the header's 7-day categories open them. `next.config.js` rewrites the address to the route `7-day-delivery/[type]/[category]` (cached per type and category, every category built with the deploy, D-156; the other filters are read in the browser). A tap shows the page's shape and the running stitch at once (`loading.tsx`, as every See all page does). 404 while 7-day delivery is off | cached `store_browse(..., p_quick)` |
| `/7-day-delivery/search` | D-154: the 7-day store's search: only 7-day pieces, no states; nothing found → "Search the whole IWC store"; D-160 as `/search` (no state filter, suggestions without states or categories) | dynamic (no auth), `store_search_page(..., p_quick)` |

| `/search` | search products and regions; 24 results at a time with "Show more" (`?show=`, D-067), through `store_search_page` (D-160: English stems, synonyms, spelling fixes, "some of the words", buyable first), which records the words (not who searched) for the admin's Insights. D-085: the count with the words, matching states as stamps (coming-soon ones by name; also a state the words name: "punjabi"), no words or no results → the open states and Just listed; phones: a round search icon in the box. D-160: "No pieces match “kurtha”. Showing pieces for “kurta”."; with some words only, those pieces under "No products match …"; the type pills with counts (`?type=`), the categories found (`?category=`), "Only from Kerala" when the words name a state (`?state=`, its all-India pieces too), Sort by (Best match, price both ways, Newest; `?sort=`), all plain links; suggestions while typing in every search box (`features/search/`, below); `noindex` and kept out of robots.txt; a caller searching faster than a person (60 a minute, per server) is asked to wait. D-154: while 7-day delivery is on, a "Delivery: in 7 days" pill under the box (`?delivery=7-day`, only 7-day pieces, no states) | dynamic (no auth) |

| `/cart` | the bag ("Bag" in the UI; on-device state). D-111, D-112: under the subtotal, the fixed Shipping and Retailer charges (struck through at $0.00 from the free-shipping line up; checkout shows them from its first step); D-155: with a heavy piece, **Heavy-item shipping** (paid below the line; from the free-shipping or 7-day line 20% off, the whole struck through, its saving in "You're saving"; checkout the same, on express too) and how much more makes them free, from `GET /api/bag-charges`; every other store page shows the free-delivery bar once the bag has a piece. D-119: from the line up, the **bulk saving** (a % of the amount over the line, up to a cap) shows as its own line, and the bar refills with it ("Saving $5 · add more, save more" until "BIGGEST SAVING"); checkout takes it off the goods before tax. D-125: Shipping is one number, at least $18.79 and more when the bag's pieces cannot pay for its parcel (one masala), struck through and free from the line up; the Retailer charges are 1.5% of the goods, at least $0.99. D-086: a photo on each line, − / number / + (1 – 10), an empty bag shows the open states as stamps and Just listed; the header's bag icon opens the same bag as a side panel (it stays a link to `/cart` for new tabs and without JavaScript) | static shell |

| `/checkout`, `/checkout/success` | D-114: signed in, the saved addresses are offered above the delivery form (the default picked and filled in, its phone too, so it opens at Delivery; "A new address" empties it), and a paid order's address is saved to the account (the first becomes the default). D-087: phone (+1, required, no code) → delivery (name, email, ZIP with the city and state filled in from our own list through `GET /api/zip`, D-098; street, apartment, promo code) → server-priced total + Standard (free) / Express with each delivery window (D-041) → payment (Stripe) → order (D-038); finished steps fold to a line with Edit; the bag beside the steps (a bar on phones); `/checkout` sits in the quiet frame of the `(checkout)` route group (logo and Back to bag, a one-line footer). The thank-you page adds the pieces, the total and the delivery window from this tab's priced bag (sessionStorage) | dynamic |
| `/orders/lookup`, `/orders/[number]` | order tracking. The signed-in owner sees the order directly; anyone else confirms the order email first, in a centred card (D-088). The order opens with a status card (number, status, delivery window, Track the parcel once shipped, D-066) holding the timeline with each reached step's date, and a photo on each item (D-088). An open faster-delivery offer (D-064) shows above the timeline: `POST /api/orders/faster` (order number + email) → Stripe Payment Element, loaded only when taken → `POST /api/orders/faster/confirm`. The customer's choices (cancel before cutoff, D-042; keep or cancel after a delay, D-008) through `POST /api/orders/choice` (number + email, refund shown first) | dynamic |

7. A **coming-soon** piece (D-135: a liquid, not sent; archived for admins) is shown like any other: its card says "Coming soon" instead of the price, with the heart instead of the + (the app card: a "Coming soon" pill), and its page says "Coming soon. Save it with the heart to find it again." instead of Add to bag. It cannot be bought (no options in `store_variants`).

- **F5:** from the free-delivery line up, Shipping shows struck through at the Settings figure "Shipping shown when
  free" × the bag's packed kg (never below the $18.79 it is below the line; empty = $18.79), and **You're saving $X**
  (the struck Shipping and retailer charges and the bulk saving) shows in the brand colour above the total in the bag,
  the bag panel, checkout and the thank-you page. Display only: what is charged, Express and every price are unchanged
  (founder, D-140); the figure is never charged, stored or sent to Stripe; customers never see grams. Claude flagged
  that a struck figure never charged can read as a fictitious former price (FTC 16 CFR 233.1); the founder chose it.

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
  by Fri, Oct 30", the bar full; any other bag → "Add $X more for FREE DELIVERY"; past the free line the bar keeps its
  full part to the house and grows a short second part to a price tag: four grey dollar signs that turn dollar-bill green
  one by one as the bulk saving fills its cap (founder 2026-10-31) ("FREE DELIVERY + saving $1.40"; the pill widens from
  440 to 520 px for the words), never back to the start (founder 2026-10-30). The goal follows the bag as
  it is now from the first draw: the two lines come from Settings with the page (`days.tsx`), each line remembers whether
  it was a 7-day piece when added, and an answer for an earlier bag never decides it (`charges.ts`, the app's
  `charges.tsx`; founder 2026-10-30: "now only the 7 day items exist but the bag was still showing 99"). The app keeps
  the bar full past the line and says the saving in words. When a change crosses a line the pill (on
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
  browser's (`features/shell/store-switch.tsx`, CSS `.store-*` in globals.css): "IWC" with the gold India outline and
  "7-day store" with a brand-colour 7, nothing under them (D-166). Phones: the strip 46 px (42 px from 768 px), the tabs sharing the width; from 768 px 500 px
  from the left gutter. The open tab is the header's own colour and runs into it through curved feet: ivory in the IWC
  store; in the 7-day store (every page under `/7-day-delivery`) the header takes a warm brand tint (12% of the brand
  colour) with no line under it (founder 2026-10-30: "two horizontal lines under the categories, remove them"). The IWC
  tab returns to the address the shopper saw (`/food`, not its rewritten route). On Home the open tab is light glass over the
  photo; past the photo the strip turns ink and the open tab ivory. The strip is part of the page and stays at the top
  with the header on every store page (founder 2026-10-31: "fixed not dynamic for all pages except the checkout page";
  checkout's own frame has no tabs), so `--top-h` counts it. A tap moves the open tab at
  once (320 ms with a slight spring, the mark pops once; at once with reduced motion) and opens the other store's front
  page; the IWC tab returns to the page left (this tab's sessionStorage). Plain links in a "Store" nav, the open one
  `aria-current="page"`. Inside the 7-day store the header's type links become All and its biggest categories (two
  below 1280 px, four above; each opens its 7-day See all page) and Search finds only 7-day pieces
  (`/7-day-delivery/search`).

Tabs on the app's own cream tab bar (a brand bar over the active tab, the bag count as a brand pill): **Home** (the photo
with "Indian Wholesale Club" on its wall and "Miss local market? Start here." (D-148: "Want in 7 days? Click here." to the
7-day screen while 7-day delivery is on; D-154: the store switch at the top of the content and the "Arrives in 7 days"
row while the 7-day store is open), the demo strip on top, Just listed, Pick

| Home, Explore, Bag, Saved, Profile | `(customer)/…` | `store_home()`, `store_type_rows()`, search, on-device bag, `wishlists` (signed in), own orders as cards (`listMyOrderCards`), `store_policy()` for the help sheet and Home's 7-day line, `store_bag_charges()` for the Bag's charges and shipments |
| 7-day delivery | `7-day-delivery` (D-148: the web page's header with the days, category pills with counts, a two-column grid 24 at a time like `browse`; the cards without the tag; nothing to show while the days are empty. D-154: the 7-day store's front page: the store switch on top (no shared header in the app, so on Home and here; IWC goes back), "Order today, arrives by …", the line, the rows Most ordered this week, Under $5 and New this week) | `store_quick_browse()`, `store_quick_front()` |

| Region, product | `region/[slug]`, `product/[region]/[slug]` (same sections as the web pages above: the region photo first and jump pills; on the product page the photos edge to edge with a full-screen viewer, the buy bar, reviews as a row, and "Write a review" as a sheet with the D-090 form, D-095) | `store_region_page()`, `store_product_page()` + live availability |
| Checkout | `checkout` | phone → delivery (the ZIP fills the city and state through the website's `GET /api/zip`) → payment, as on the web (D-087); the website's server API: `POST /api/checkout` (server-priced quote + Standard / Express, D-041) → Stripe PaymentSheet → `POST /api/orders` (D-038). The phone never sends prices |
| Order | `order/[number]` (signed-in owner, `store_my_order`) · `order/lookup` (number + checkout email via `POST /api/orders/lookup`, rate-limited, one answer for any mismatch); the faster-delivery offer (D-064) through the same API as the website, paid with the PaymentSheet; cancel / keep through `POST /api/orders/choice` | |

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

**Guard rails (built in C1: `apps/web/features/shell/motion.tsx`, tested in `e2e/motion-keyboard.spec.ts`):** motion is progressive enhancement. Lenis and the scroll effects load as one small
client module after the page is interactive; with `prefers-reduced-motion` they are off entirely (native scroll, no
parallax, images simply visible); keyboard, find-in-page, anchor links and screen readers keep working; content is fully
readable with JavaScript off. The speed budgets still hold (`engineering.md`: first-load JS ≤ 160 KB, cached pages
≤ 100 ms), and images use `next/image` with explicit sizes so the large photos don't slow the first paint. On mobile
the effects are lighter. The app follows the same look with native motion (Reanimated), not Lenis.

### The homesick promises (D-161, `docs/archive/plan-homesick.md`)
- **The wait is the proof:** a date and a day name, never an apology and never "fast". The seven promises (7 days
  from India to your door, the 12 – 16 day window, free 7-day delivery from $49.99, free delivery from $99.99, duties
  paid and nothing to pay at your door, right to your door, the pack from back home) each come from Settings or the
  order, worked out in the browser for cached pages (`packages/shared/src/domain/homesick.ts`,
  `apps/web/features/shell/days.tsx`).
- **One promise per screen, inside something the page already has** (a header line, a card tag, the pill, a summary
  line): no banners, pop-ups or tickers (except Home's Diwali windows, D-174), no countdown, no blog. Where each one sits: D-161.
- **Pictures, not paragraphs (D-166):** a promise is drawn before it is written: the flight (founder 2026-10-30: a small
  band, India's outline and the US with its states, a straight dashed line between them, a side-view plane towing the
  free line or the festival's last order day across at one steady speed, again and again, on a small light cloth with a
  hairline wine border and wine words (founder 2026-10-31); paused off screen and resumed
  from the same spot, parked with reduced motion; `features/visuals/flight.tsx`, the map from
  `scripts/build-us-map.mjs`), the 7-day store's address label and
  stamp, the duties stamp, the week strip. No new lines of copy on pages; the jokes stay in the emails, the
  pill, the empty bag and the thank-you page. The founder's photos go in the slots of `features/visuals/slots.ts` (each
  with its size and what it wants; an empty slot shows a labelled frame off the live site and nothing on it): the
  7-day store's photo and seasonal poster, Home's wide picture, and (founder 2026-10-31: "think creatively of what we
  can put in the whitespaces") on wide screens beside the one narrow column of Sign in and Create an account, About us,
  How it works, Contact, the empty bag and Page not found (`picture-beside.tsx`; phones keep the column alone), and one in each of Home's Diwali windows (D-175).
- Say "Duties paid. Nothing to pay at your door.", never "no tariffs"; every such line follows `DUTIES_PAID` (Q-46).
  Shops are "India's own shops", never named (D-003). The festival clock shows only while an order can arrive the
  day before (Q-45).
- The words are Claude's drafts until the founder approves them (D-019, D-059).

6. **Motion:** as §Direction (D-049): Lenis smooth scroll + reveal/parallax, the only motion library allowed on the
   storefront (no framer-motion), off for `prefers-reduced-motion`. Everything else CSS.
   **Polish pass (D-116, D-117):** the free-delivery bar fills sideways with a glowing head (`.fd-bar`); phones have
   Search where wider screens have Saved (`phone-search.tsx`); the page clips sideways overflow. Lenis's velocity is `--sv` on `<html>`; `.drift` grids and rows float apart by column while
   the page scrolls fast. Element motion lives in `globals.css` (`.fd-*` free-delivery meter, `.press`, `.rise-in`,
