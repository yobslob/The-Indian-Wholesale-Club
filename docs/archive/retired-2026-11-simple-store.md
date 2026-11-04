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

---

# From data-model.md

| **vendor** | a vendor's owner, own vendor only (D-102) | `vendor_*` functions filtered by `my_vendor_id()` (role `vendor` + an active `vendor_accounts` row); no base table (INV-10) |
| **worker** | the photo worker's account on the founder's laptop (D-103) | `worker_*` functions and the photo buckets (role `worker`) |

| | `vendor_accounts` | a vendor's sign-in: the user, its vendor, the screens' language, active (D-102) | own row / admin |
| | `vendor_sign_in_codes` | one-time QR / link codes, stored only as a hash, used once, expiring | functions only |
| | `vendor_applications` | "Join as a vendor?" requests (country IN or US, Q-35), status | admin |

| Supply | `vendors` | shop + owner, phone/WhatsApp, address, town, region, payment method + reference (D-029), licences, status, notes, photo; `online_site` = an online shop's host for imported listings (one vendor per shop and state, D-110) | admin |
| | `cycles` | code, status, `cutoff_at`, est. export/arrival, actual dates, AWB, forwarder, freight, duty, FX | admin |
| | `pickups` | one per ordered piece: vendor, cycle, variant, qty, shop price (the variant's own when it has one), status, who/when, photo, payout; `source_id` (the shop item in use), `ordered_at`, `ordered_by`, `paid_paise`, `shop_order_ref`, `shop_bill_path` (ordered from the shop, D-140) | admin |

| | `vendor_payouts` | INR paid to a vendor. The amount is computed from the pickups it covers | admin |
| | `vendor_submissions` | a piece a vendor sent: category, who wears it (women / men / kids / unisex: picks the house model; kids are never shown on a model), details in their words, sizes, shop price in ₹, status (adding → waiting → photos_ready → approved, or needs_retake / declined), the product it became | vendor via `vendor_*` / admin |
| | `vendor_submission_photos` | front, back, close-up in bucket `vendor-uploads` (`<vendor>/<submission>/<file>`) with the phone's checks | vendor via functions / admin |
| | `house_models` | the founder's models (D-104): wears women / men, the front and back pose in `product-media/house-models/<slug>/` | admin |
| | `photo_jobs` | the GPU worker's queue: one per view of a clothing piece, candidates in bucket `photo-candidates` | worker via functions / admin |

| | `pricing_settings` | one row: FX, freight/kg, duty %, margin %, domestic delivery days, stale-listing days, standard shipping + free threshold, express shipping + express days. Price-suggestion values and days start NULL (Q-15, Q-18); shipping prices set by migration 4 (D-041) | admin |

leave it alone). Migration 12 (C3, flows.md §2): `admin_create_listing(jsonb)`
creates a draft product (region from its shop) and its variants in one transaction, quantities stamped as confirmed;
`admin_stale_variants()` lists live variants not re-confirmed within `pricing_settings.stale_listing_days` (nothing
while that is unset, D-047). Both refuse non-admins and run as the caller. Migration 13 (C4, D-045, D-063, D-065):
`pricing_settings.cycle_days` (days between cutoffs, unset until the founder sets it); `store_next_delivery()` and
`checkout_context()` show the cycle an order would really join (the open one, or the one about to open in the minute
between a cutoff and the roll), through the internal `_store_cycle()` and `_next_cycle_dates(cycle)`. Migration 14 (C4, D-064): `order_moves` (each
move of an order to another cycle, its shipped confirmation and the faster-delivery offer; admin read-only, written
by the functions below), `pricing_settings.fast_offer_cents`, and `store_my_order()` / `guest_order_lookup()` add
`offer` (price and window only, from the internal `_order_offer(order)`). Internal helpers: `_window_from(order, cycle)`
(the window an order would get from a cycle) and `_set_window(...)` (the INV-6 window change with its visible event).
A trigger on an order becoming `shipped` lapses an open offer and adds the "coming
sooner" event. Migration 15: `pickups.arrived_at` / `arrived_by` (picked pieces only). Migration 16: shipping and delivering go

with its total and its first 12 cards (the app's Explore). Migration 19 (C6, D-047): `pricing_estimates` (which pricing
settings hold Claude's researched estimates, with source, link and date; admin-only); a trigger drops a setting's row
when its value changes (`_pricing_estimate_replaced`); `_load_pricing_estimates()` fills only empty settings (dev seed). Migration 20 (C7): `admin_sales(since)` and

"Show more" re-reads without recording) and serves pages of up to 500; `create_order` shares the open-cycle lock and
reserves pieces in variant-id order (PR-9); the `variant_availability` trigger fires only on stock columns and skips
writes that change nothing; the minute timer (`_kick_email_outbox`) also runs in the two minutes after a cycle closes
(the website then refreshes its cached "order by" time, `engineering.md` §Caching); indexes for
`order_items.variant_id`, `wishlists.product_id` and newest-live-first. Migration 24 (D-075, D-069, D-074): the pricing
engine. Every cost is a `pricing_settings` column (labelled in `pricing_estimates` while a placeholder);
`_auto_price_cents(shop paise, weight g)` is the one price formula (`docs/pilot-numbers.md`), `products.price_auto` says
whether a product follows it, and triggers reprice when a setting, a variant weight or a category's
`default_weight_g` changes; `admin_price_preview()` lets admins preview it; `admin_create_listing()` prices a listing
without a price. `_fx_refresh()` (pg_cron every 10 minutes, pg_net) fetches the ECB rate once a day through
`fx_fetches` and refuses implausible jumps. `categories.tax_class` (clothing, food, general; D-073). `business_details`
(exporter, importer, broker, FDA, contact: placeholders until saved; admin-only). `pricing_settings.spices_cleared` (now `food_cleared`, D-110) gates
live food (trigger `_food_cleared_check` since D-110). Migration 25 (D-073, D-070): `tax_rates`
(one row per state where IWC is registered, with the classes it taxes; New Jersey 6.625% on general goods; no row = no
tax; admin-only); `checkout_context(variant_ids, promo, state)` adds each line's tax class and courier cost (never its
weight), the state's rule and express as courier pricing with a window from today; express orders have no cycle, a
window from the order date and their pickups at once (`pickups.cycle_id` may be null); `ship_order` sends an express
order by courier once picked; a cancel refunds the tax (`_cancel_refund_cents`). Migration 26 (D-071, D-072): after the

terms the Shipping & returns page states (shipping, express and US delivery days, the cancel fee, the claim window and
return tiers, the tax states and classes), never a cost, margin or customer-care deduction. Migration 28:
`checkout_context()` adds `us_delivery` (a bag of only US pieces: today + the US delivery days) and offers express only
for bags with no US piece; trigger `_express_has_no_us_stock` on `order_items` refuses an express order with one
(`express_unavailable`). Migration 29 (D-078, the demo round): `product_media.credit` (a free-licence photo's

Migration 31 (D-099, the second speed audit): `admin_order_counts()` (every order by status, express orders still to
send, shops owed for picked pieces) and `admin_cycle_totals(cycle)` (the cycle card's orders, pieces, shops and sales),
admin only, counted in SQL because the API sends at most 1,000 rows; indexes for orders by status and newest, pickups
by status, what each shop is owed, and a payout's pieces.

Migration 75 (D-140, F5): `pricing_settings.shown_shipping_cents_per_kg` ("Shipping shown when free", $ a kg, the
founder's number) and `store_bag_charges()`'s `shown_shipping_cents` (the bag's packed kg × it, at least the small-order
Shipping; null while empty). Display only: never charged, stored or sent to Stripe.

Migration `20261022120000_seven_day_delivery` (D-148): `pricing_settings.quick_delivery_days_min/_max` (7 and 7; empty
= off) and `sourcing_shops.quick_delivery` (Blinkit, BigBasket, Zepto, Instamart). `_quick_listings()` (no SET clause,
so it is inlined: live, not US stock, every active option's source in use, else the listing's `source_site`, on a
quick-delivery shop; since `20261108090500_browse_reads` one pass over the active options grouped by listing, the same
set, 46,345 → 2,513 buffers on a production-sized copy; since `20261108090600_quick_by_type` it is
`_quick_listings_of(null)`, and `store_browse` reads `_quick_listings_of(its type)` and gives its cards their 7-day
days from that set) and `_quick_days(product)` (internal). Customers: `store_quick_bag(variant ids)` (`{days_min,
days_max}` when every piece is a 7-day piece, else null) and `store_quick_browse(category, offset, limit)` (the 7-day
page: days, totals, categories with counts, light cards). `_store_product_card` and `store_browse` add `quick_days`;
`store_product_page` adds `quick_delivery`; `store_policy` the two days (D-161, migration `20261031090000_policy_days`: also `delivery_days_min` / `_max`, the pilot's standard days, null in cycle mode); `checkout_context` adds `quick_delivery` and
gives such a bag no Express; `create_order` gives a standard 7-day bag that window, no cycle and its pickups at once.
No answer names a shop or a source. Tests: `seven_day.test.sql`.

Migration `20261101090000_quick_sources` (D-162): `_quick_sourceable(product)` (internal: 7-day days set and every
active option with a usable source has one on a quick-delivery shop); `_sourcing_settle` then picks the quick shop's
source first, else the cheapest. `ops_quick_sources(apply, limit)` (service role only: the listings bought elsewhere
that would switch, then the switch in batches, each listing's `source_checked_at` kept; `pnpm quick:sources`). Tests:
`quick_sources.test.sql`.

Migration `20261023120000_seven_day_shipments` (D-154, step 1): `pricing_settings.quick_delivery_min_cents` (4999, the
7-day line), `shipping_cents_per_kg` (1862) and `quick_delivery_paused` (no 7-day pieces while true; `_quick_listings`
reads it); the pilot window set to 12 – 16. `order_shipments` (an order's one or two shipments: `seq` 1 | 2, `kind`
quick | standard | express, dates, `shipping_cents` its share, `status` open | shipped | delivered | cancelled, carrier,
tracking, `shipped_at`; admin read, written by `create_order`; every older order got one, carrying its tracking) and
`order_items.shipment_id`. `_bag_shipments(items, discount, state, line1)` (internal): the 7-day pieces after the
promo against the line, `quick_only` / `split` / `gap_cents`, `outside` (not the 48 states or DC, or a PO box / APO),
`billed_grams`, `shipping_cents` (one parcel) and `quick_shipping_cents` (its share by weight). `store_bag_charges(items,
discount, state, line1)` returns Shipping at the $ a kg (else the fixed small-order Shipping), `past_line_cents` 0,
`shown_shipping_cents` the same figure, `quick_free` and `shipments`; `create_order` stores the shipments it works
out the same way (Express never splits). Tests: `shipments.test.sql`, `bag_charges.test.sql`.

Migration `20261024090000_shipment_admin` (D-154, step 2): shipments run one at a time. `order_events.shipment_id`
(the event is about that shipment; its `order_update` email row carries `shipment`, its seq). `ship_shipment(shipment,
carrier, tracking)`: from the hub (a 7-day shipment; Express; any order without a cycle, the pilot) once its pieces
are picked, else once the order's export has `arrived`; `deliver_shipment(shipment)`. The order follows its shipments
(`_settle_order`, also after any piece's status changes): a shipment with nothing left to send is cancelled; the order
is `shipped` once nothing is open, `delivered` once nothing is on its way, with the latest tracking. `ship_order` and
`deliver_order` work on an order of one shipment (`order_has_two_shipments` otherwise), and so does
`change_delivery_window`; an order of one shipment copies its window to it. `change_shipment_window(shipment, from,
to, note)`: the delay notice for one shipment (the order's window spans its shipments); `_delay_shipment(order)` and
`_delay_refund_cents(order)` (internal) scope `_delay_open` / `cancel_after_delay` to that shipment.
`shipment_cancel_cents(shipment, reason)` and `admin_cancel_shipment(shipment, reason, amount, ref)`: one of two
shipments cancelled (a 7-day one until its pieces are ordered or at the hub, the other until it leaves India): its
pieces after their discount share, its Shipping share and their tax back (the cancel fee for the customer's own once at
the hub). `customer_cancel` refuses (`quick_bought`), and `_order_actions.can_cancel` is false, once a 7-day shipment's
pieces are bought; `_order_actions.delay_shipment`. `admin_to_order()` adds `buy_by` / `ship_by` (2 hours, 1 day) for a
7-day piece; `admin_quick_watch()` counts open 7-day shipments, `not_bought` (2 hours) and `not_shipped` (a day).
`_order_shipments_json(order)` (internal): `guest_order_lookup` and `store_my_order` add `shipments` (seq, kind,
status, dates, Shipping share, carrier, tracking, `item_ids`); `store_order_events` and their events add `shipment`.
Tests: `shipment_admin.test.sql`.

Migration `20261025090000_bag_shipments` (D-154, step 3): `store_bag_charges` adds `quick_ids` (the asked options that
are 7-day pieces) and `dates` (`quick_from` / `quick_to` from the 7-day days, `standard_from` / `standard_to` from
`store_next_delivery()`), and its `shipments` no longer carries `billed_grams`, `quick_shipping_cents` or the option ids
(step 1's answer had sent the bag's billed grams to the browser). Tests: `shipments.test.sql`.
Migration `20261026090000_seven_day_store` (D-154, step 4): `store_browse(..., p_quick)` (last argument) keeps only
7-day pieces and adds `quick_total` (the "Delivery: in 7 days" count, every other filter applied; `all_total` stays the
whole type); `store_search(..., p_quick)` the same for search; `store_quick_front()` (null while 7-day delivery is off
or paused) gives the 7-day front page: days, the line (`min_cents`), the categories with a photo each, and the rows
`most_ordered` (units in paid orders this week, never shown), `under_5` and `new_this_week` (light cards, 12 each);
`store_policy()` adds `quick_delivery_min_cents` and `quick_delivery_on`. Tests: `seven_day_store.test.sql`.
Migration `20261027090000_seven_day_insights` (D-154, step 5): `order_shipments.promised_to` (the last day promised when
the order was placed, set by the `order_shipments_promise` trigger, `_shipment_promise()`; a delay moves
`est_delivery_to`, never this). `admin_quick_insights(since)` (admin only): paid orders, those with a 7-day shipment and
those split, the 7-day pieces after the promo against the line (within $5, $5 – $15, more), per kind of shipment due /
on time / late / late with a delay notice sent before the promised day / open past it (delivered = its `delivered`
event, on the US Eastern calendar), 7-day pieces refunded as unavailable, and the split's extra courier cost in paise
(`_courier_paise(grams)`: Settings' first and next kg, at least 1 kg then by the half kg). Tests:
`seven_day_insights.test.sql`.

Migration `20261029100000_quick_speed`: `store_quick_browse()` and `store_quick_front()` read the 7-day listings once
into their own list before they meet `store_products` (joined straight to the view, the planner multiplied options by
categories: 1.3 – 1.7 s with 5,100 7-day pieces on a production copy, now about 0.2 s), and the front page builds the
cards of its three rows only. Same answers (checked against the old functions on the copy).

Migration 69 (D-135): `products.coming_soon`, `coming_soon_note`, `liquid_checked_at`; trigger `products_coming_soon`
(any status but archived ends it); `store_products` and `store_media` include archived coming-soon listings and
`store_products` ends with `coming_soon`; `_store_product_card` and `store_browse` send it (no quick add for it).
Worker only: `worker_liquid_plan(after, limit, all)` (food and home listings not yet checked) and
`worker_set_liquids(items)` (marks each checked; archives a liquid as coming soon; returns how many). Tests:
`coming_soon.test.sql`.

Migration 54 (D-125): `store_bag_charges` works out Shipping per bag: the pieces' contribution (price less shop cost,
duty, card fee, 2% returns) against the parcel's courier (first kg, each further half kg, box and clearance); below the
line at least `small_order_shipping_cents`, past it `past_line_cents` (what a bag still needs, normally 0). The
small-food shelf never prices under the guard on its whole cost. `food_ship_share_pct` empty again; the D-123 food
weight columns are unused. Tests: `bag_charges.test.sql`, `pricing_engine.test.sql`.
Migration 53 (D-123): `pricing_settings.retailer_pct`, `food_off_step_cents`, `food_off_step_pct`, `food_off_max_pct`;
`store_bag_charges` also returns `retailer_pct`, `food_weight_cents` (the bag's food at the rate card × billed % × (1 −
the food's share) ÷ the effective rate, by its weights) and the three food steps; checkout and the bag apply them with
`bagChargesAt()` (packages/shared). Tests: `bag_charges.test.sql`.
Migration 52 (D-122): `pricing_settings.food_ship_share_pct` (the share of its courier a food piece carries, empty =
all); `_auto_price_cents` applies it; footwear's `default_weight_g` 600; `_store_pack(product, name, type)` and the cards
(`_store_product_card`, `store_browse`) carry `pack`; `store_browse` returns `all_total`. Tests: `food_cards.test.sql`,
`pricing_engine.test.sql`.

Migration 50 (D-121): `products.region_id`, `order_items.region_name`, `sourcing_targets.region_id` and an online
shop's `vendors.region_id` may be empty (an all-India listing; `vendors_region_or_online`: a shop in person still has
its state; one all-India vendor per online shop). `store_products` left-joins the state; `store_region_page` and

Migrations 48 – 49 (D-120): `pricing_settings` gains the small-food shelf, `small_food_max_shop_paise`,
`small_food_max_g`, `small_food_ship_share_pct`, `small_food_floor_cents`, `small_food_ceiling_cents` (ceiling ≥
floor); `_auto_price_cents` puts small food on whole-dollar steps from the floor to the ceiling (half its shipping
share, the guard on its goods, never above its own recipe). `admin_publish_drafts()` (admin only) publishes every
ready draft one by one and returns how many went live and what held the rest (`no_photo`, `no_option`, `no_stock`,
`refused`, `live_missing_details`). Tests: `pricing_engine.test.sql`, `publish_drafts.test.sql`.
Migration 47 (D-119): the pilot price in two recipes. `pricing_settings` gains, for clothing and home & gifts,
`shop_divisor`, `ship_paise_per_100g`, `margin_clothing_min_pct` / `margin_home_min_pct` and the taper's
`taper_<type>_from_cents` / `_to_cents` (the type margins are now a margin of the price, cost ÷ (1 − margin)); for food,
`food_fee_paise`, `food_parcel_kg`, `food_billed_pct` (with `india_handling_pct` and the markup `margin_food_pct`); the
courier rate card `courier_first_kg_paise`, `courier_next_kg_paise`, `parcel_fixed_paise`; the profit guard
`duty_<type>_pct`, `min_profit_<type>_cents`, `min_profit_pct`, `min_profit_food_pct`, `guard_card_fee_pct`; the bulk
saving `bulk_saving_pct`, `bulk_saving_cap_cents`. `_auto_price_cents(shop, weight, type)` applies the type's recipe,
then lifts a price to the guard, then the .29/.49/.79/.99 ending (`_tapered_margin` is its helper; D-126 adds the .69
ending, and `food_margin_max_pct` with `_band_price(cost, lo, hi)` prices food in its 17–20% band without the guard
or the shelf). Migration 56 (D-127): `beta_pricing` puts the fixed beta formula in front of all of it (migration 57: to the cent; migration 58: converted at a fixed ₹92; migration 59, D-128: the founder's exact rules; migration 60: `admin_price_sheet()` for Products → Download Excel; see
`docs/archive/pricing-full-formula.md` for the full one);
`ship_alloc_paise_per_kg` is no longer read. `store_bag_charges` also returns the two bulk numbers;
`orders.bulk_saving_cents` is the part of `discount_cents` that was the bulk saving (admin view). Tests:
`pricing_engine.test.sql`, `bag_charges.test.sql`.

Migration 43 (D-115): `pricing_settings.pilot_delivery_days_min/max` (the made-to-order pilot, 12 – 18); while both are
set, `store_next_delivery()` returns today + those days with a null `order_by`, and a standard `create_order` needs no
cycle (no `cycle_id`, window from today, pickups at once like express). Both empty = the cycle model.

Migrations 38 – 39 (D-110): the type `spice` renamed `food` (`food_cleared`, trigger `_food_cleared_check`); imported
listings: `products.source_url` (unique, https), `source_site`, `source_checked_at`, `source_in_stock` and
`vendors.online_site`, all admin-only (no `store_*` object reads them; `supabase/tests/sourced_listings.test.sql`).

Migrations 32 – 35 (D-102, D-103, vendor accounts): roles `vendor` and `worker`; `my_vendor_id()`, `is_vendor()`,
`is_worker()`, the internal `_vendor_or_raise()` (refuses non-vendors); `admin_vendor_sign_in_code(user, days)` (a one-time code shown once; older unused ones stop working) and
the service-only `_link_vendor_account(user, vendor, language, by)` and `_redeem_vendor_code(code)`. A vendor reads
`vendor_me()`, `vendor_keep_ready()` (ordered pieces not yet collected: piece, size, count and the cycle's cutoff, never
who bought it), `vendor_money()` (owed and paid in ₹), `vendor_pieces(offset, limit)` and `vendor_submission(id)`, and
writes through `vendor_new_submission(type)`, `vendor_add_photo(...)`, `vendor_submit(id, details)` (checks photos,
category, sizes and price, then queues the photo jobs) and `vendor_delete_submission(id)`; storage allows uploads only
where `vendor_may_upload(path)` says. Admins review with `admin_approve_submission(id, listing, media)` (a draft
product through `admin_create_listing`), `admin_request_retake`, `admin_decline_submission`, `admin_rerun_photo_job`.
The worker uses `worker_claim_job()` (oldest queued, or one left running for 30 minutes; failed after 3 tries) and
`worker_finish_job(job, candidates, error)`.

| `create_order(jsonb)` | service (server, after Stripe verification) | §3: rolls a cycle past its cutoff first, checks prices + subtotal, reserves stock atomically, attaches the open cycle (or, D-065, the cycle that closed after the customer was priced, while it is collecting, with its pickups), stores the window. Raises `cycle_closed` (priced for a cycle that is already packed), `no_open_cycle`, `delivery_window_unconfigured`, `variant_unavailable`, `price_mismatch`, `insufficient_stock`, `subtotal_mismatch`, `express_unavailable`, `order_has_no_items` |
| `cutoff_cycle(cycle)` | admin | §4.1: closes the cycle (the cutoff becomes the real closing time), creates one pickup per piece, opens the next cycle (D-045) |
| `roll_cycles()` | service, pg_cron every minute | §1: closes the open cycle once its cutoff has passed and opens the next with its dates moved forward by `cycle_days` (else the last gap, D-063). Internal helpers `_cutoff_cycle`, `_open_next_cycle` |
| `advance_cycle(cycle)` | admin | §1/§6: collecting → packed → exported → arrived → fulfilling → closed, moving its orders with it and writing internal events. Refuses `open` (use cutoff) and closing while an order is unfinished |
| `move_order(order, cycle, note)` | admin | §6b: the order and its pieces join another cycle; a later one changes the window visibly (INV-6). Raises `order_cannot_move`, `cycle_not_accepting`, `same_cycle` |
| `confirm_move_shipped(move)` | admin | §6b: the order left with that export; an earlier move makes the D-064 offer when its price is set. Raises `move_not_pending`, `move_superseded`, `cycle_not_exported` |
| `accept_fast_offer(move, payment_intent)` | service (after Stripe verification) | §6b: the window moves to the one offered. Raises `offer_not_open` (the server refunds) |
| `check_off_arrival(pickup, arrived)` | admin | §6.3: a picked piece arrived in the US (or the tick undone), once its cycle has arrived. Raises `pickup_not_picked`, `cycle_not_arrived` |
| `ship_order(order, carrier, tracking)` | admin | §6.4: an arrived order ships (visible "Shipped" event). Raises `order_not_arrived`, `invalid_tracking` |
| `deliver_order(order)` | admin | §6.4: a shipped order is delivered (visible event). Raises `order_not_shipped` |

| `mark_pickup(pickup, status, photo, note)` | admin | §4.2–4: picked / unavailable (+ D-030 refund flag + customer event) |
| `record_payout(vendor, pickups[], method, …)` | admin | §5: computes the amount from pickups, one payout per pickup |

| INV-5 | at most one `open` cycle | partial unique index | `cycles.test.sql` (+ `cycle_advance.test.sql` for the later steps) |

| INV-10 | a vendor account reads only its own vendor, only through `vendor_*` functions, and never a buyer, an order number, a customer price, a cost or an admin note; sign-in codes work once (D-102, D-103) | `my_vendor_id()` filters + no base-table RLS + `vendor_may_upload` | `vendor_accounts.test.sql` |

- `demo.sql`: **dev only.** `is_placeholder = true`, 4 clothing products in Kerala/Rajasthan/Punjab, one open cycle,
  placeholder domestic delivery days (3–7) and express days (1–2), `dev_preview = true`. (The $0 standard / $8 express
  prices are real settings from migration 4, D-041.) Never run against production.

  `catalogue/README.md`). The launch regions' items as listings: clothing live with colour × size variants, pantry as
  drafts (D-032); prices, pieces and the per-region placeholder shop are placeholders (`is_placeholder = true`). Product
  ids are `md5('iwc-catalogue:' || slug)`, so `pnpm catalogue:apply` can reload it into a running local DB without a reset.
- `search.sql`: builds search's vocabulary from the seeded listings (`refresh_search_words()`, D-160; migrations run
  before the seed). After `pnpm catalogue:apply` or `demo:load`, run it again (or wait for the 6-hourly job).

---

# From engineering.md

  "Sold out" right after the last piece is bought. Within the page, the product page's buy button also follows Realtime
  stock (PR-7). Similar items on *other* product pages catch up within the fallback; their Add is re-checked at checkout.
- Cancels (`app/api/orders/choice/route.ts`, admin refunds) put pieces back: everything is refreshed (rare).
- The cutoff (D-008): `roll_cycles()` closes a cycle by itself; the every-minute timer calls the website's job
  (`app/api/internal/email-outbox/route.ts`) in the two minutes after any cycle closes, and the job refreshes the store
  once the cached "order by" time has passed (`revalidateIfCutoffPassed`). Needs the Vault settings (`ops.md`).

---

# From ops.md

- **Launch check (C8):** `pnpm launch:check` lists what still blocks going live (estimates, settings, placeholder or demo
  data, unapproved state text, a dev cycle, the timers and Vault settings, stuck emails, open launch questions,
  TODO(founder) markers on customer pages). Read-only. For production: `pnpm launch:check --url=<db url> --allow-remote`.
- **Pricing estimates (D-047, C6):** `pnpm dev:estimates` loads Claude's researched estimates (`supabase/seed/estimates.sql`,
  each with its source and date) into the local database without a reset, filling only empty settings; a local reset
  loads them too. For the hosted dev database, run that file in the SQL editor. In production the pilot runs on them
  (D-069): `pnpm prod:seed` loads them once with the regions and categories (below), and Settings shows each as a
  placeholder until the founder saves their own number.
  creates or refreshes the account with the role and the `admin_emails` row. Run it again after every `check.mjs db`
  (the reset deletes local accounts). The website also needs the email in `ADMIN_EMAILS` in `apps/web/.env.local`.

   `select cron.schedule('iwc-roll-cycles', '* * * * *', 'select public.roll_cycles()');`,
   `select cron.schedule('iwc-email-outbox', '* * * * *', 'select public._kick_email_outbox()');`,
   `select cron.schedule('iwc-fx-refresh', '*/10 * * * *', 'select public._fx_refresh()');`, and since search (D-160)
   `select cron.schedule('iwc-search-words', '17 */6 * * *', 'select public.refresh_search_words()');` (the payment
   sweep's `iwc-payment-sweep` comes with its migration when it runs on the new project; restored after it, schedule
   it too: `select cron.schedule('iwc-payment-sweep', '*/10 * * * *', 'select public._kick_payment_sweep()');`); check

## Demo round and placeholders (D-078, D-108; done)
Production has no placeholder listings left (checked on the copy of 2026-10-21). The demo round and the placeholder
clearing are in `docs/archive/ops-demo-round.md`; `pnpm demo:load` / `demo:clear` still work against a local database.

### Photo worker (D-101, D-103; the founder runs every step on production)
The AI product photos are made on the founder's laptop by `tools/photo-worker` (its README has setup and running).
For production, once:
1. Supabase dashboard (production) → Authentication → Add user: an email of your choice (e.g. a `+worker` alias)
   and a long password, "Auto confirm". Then SQL editor: `update public.profiles set role = 'worker' where email =
   '<that email>';`. The account can only take photo jobs and use the two photo buckets (`data-model.md`).
2. `tools/photo-worker/.env` (you write it, never committed): `IWC_SUPABASE_URL` and `IWC_SUPABASE_ANON_KEY` (the
   production project's public URL and anon key, as in the app), `IWC_WORKER_EMAIL`, `IWC_WORKER_PASSWORD`.
3. The chosen house models (6 – 7, D-102) uploaded to `product-media/house-models/<slug>/front.jpg` and `back.jpg` with
   a `house_models` row each (the admin screen comes with V3).
4. Start it with Windows (README, Task Scheduler). When the laptop is off, pieces wait in the queue; nothing breaks.
Locally, `pnpm dev:photo-e2e <front> <back> <close-up> --house=<front>,<back>` makes the worker account, signs in as a
vendor, uploads a piece through the vendor's storage rules and queues its jobs.

audit). Once: run the Deploy workflow (migration `20261102090000_photo_redo`), give the laptop the sourcing runner's
`.env` (or `tools/photo-redo/.env` with the same keys), and keep the house models as one folder each in
`C:\kod\iwc-photo-models\house-models\` (`w-1\front.jpg` …; `m-1\` … for men). Start with `--limit 30` per type and look at the review page.

5. **7-day sources (D-162), once after the Deploy workflow has applied `20261101090000_quick_sources`:** on any PC with
   the repo, `pnpm quick:sources -- --env=C:\iwc\move.env --allow-remote` (the same file as `photos:move`:
   `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` of production; it writes nothing and lists how many
   listings would be bought from the quick shops instead of a cheaper backup, a sample with both prices, and sites that
   look like a quick shop but are not marked one), then the same with `--apply` (batches of 100 until none is left;
   safe to run again). New and re-checked listings need nothing: the runner's database functions choose the quick shop.
