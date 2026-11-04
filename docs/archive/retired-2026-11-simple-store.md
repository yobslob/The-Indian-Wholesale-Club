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
