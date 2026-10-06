# Flows: how stock, cycles, orders, pickups and payouts move

Target behaviour (implemented from R3 on). Business source: D-005 (order-first), D-008 (delivery windows), D-003 (what
customers may see). Open points are marked with Q-ids. **Don't fill those gaps with guesses.**

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
5. Save as `draft`. An admin reviews it and sets it `live`. Spices stay unpublished until Q-10 is answered (D-032).
- `qty_confirmed_at` records when the shop last confirmed quantities. The admin sees listings not confirmed within N days
  (N is set in `pricing_settings`) so they can re-check with the shop.
- **Built (C3):** steps 1–5 on a phone (app admin → Listings → New listing: camera or photo library, photos shrunk to
  2,400 px and uploaded after the draft is saved, failed photos can be sent again) and on the web; both go through
  `admin_create_listing` (one transaction) and the shared `listingInputSchema`. Publishing a clothing draft works in
  the app and on the web. The re-check list is on Today and Listings (web) and Today (app). Offline drafts: later (F-3).

## 3. Placing an order (customer)
1. The cart holds variants. At checkout, the server computes totals from the catalog (never from the browser): subtotal,
   promo, shipping (Standard free with the next export, D-041; Express by courier from Mumbai to the door, priced per
   order + per piece, D-070) and sales tax by the delivery state (D-073: only where IWC is registered, New Jersey, and
   only on taxed classes; clothing and food are exempt there, so most orders carry none).
2. The server computes the **delivery window**: standard = the open cycle's estimated arrival + the US delivery days;
   express = today + 15 to 18 days (D-048, D-070). It is shown before payment (D-008). An express order has no cycle: its
   pieces go on a pickup list at once and it is sent by courier from India once picked (`ship_order`).
3. Payment: a Stripe PaymentIntent (USD) for exactly that total. The priced checkout is stored in `pending_orders` with it.
   After payment the server verifies amount, currency and status with Stripe, then creates the order **from the stored
   checkout** (D-038). The customer's device (website or app, D-043) and the Stripe webhook both trigger this; the
   second finds the existing order. The website pays with Stripe's Payment Element, the app with Stripe's payment sheet.
4. In one transaction (`create_order`): create the order and items, **reserve** stock (a conditional update, INV-3), write
   `stock_movements`, attach the order to the open cycle and store the delivery window. Then the server queues the
   confirmation email in `email_outbox`.
5. If `create_order` refuses (sold out meanwhile, price changed, no open cycle), no order is created, the payment is refunded
   in full and recorded in `failed_reconciliations`. The customer is told an item sold out.

## 4. Pickups (India desk)
1. At cutoff, the system creates one `pickup` per ordered piece, grouped by vendor into a per-shop checklist.
2. The COO visits each shop and marks every piece `picked` (optional photo) or `unavailable`.
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

## 7. Delays (D-008)
If a cycle's estimated arrival moves past an order's `est_delivery_to`, the admin gets a warning (not built yet: Today
shows no delay warning). When the window changes (`change_delivery_window`, or a move to a later cycle), the customer
gets an email with the new estimate, and their order page (website and app) offers **keep my order** or **cancel for a
full refund** until it ships in the US (`keep_after_delay`, `cancel_after_delay`, through `POST /api/orders/choice`).
The choice is recorded as an `order_event`. The old window is never silently overwritten (INV-6). Pieces already
collected for an order cancelled this way become US clearance drafts (D-072).

## 7b. Cancelling (D-042, D-072)
- **Until the order leaves India** (`confirmed`, `collecting`, `packed`; an express order until its courier leaves), the
  customer's order page (website and app) offers "Cancel my order" with the refund shown first: everything back, minus
  `cancel_fee_pct` of the goods once pieces are being collected (0 for the pilot). `POST /api/orders/choice` refunds
  Stripe, then `customer_cancel()` records it and re-checks the amount. Pieces not collected go back to the shop's stock
  (`released` in the ledger); collected ones become US clearance drafts (§7d).
- Before cutoff an admin can also cancel (`cancel_order()`, on the customer's request or because of IWC: everything back).
- **After it left India** the button is gone. Only customer care cancels (the admin order page,
  `admin_cancel_after_export()`): everything back except `export_cancel_deduction_pct` of the goods, and every piece
  becomes a US clearance draft.
- Stripe is always refunded first. The customer sees "Order cancelled" and the refunded amount, never why or where.

## 7c. Returns (D-071)
- A delivered piece can be returned from the order page: **damaged or wrong** (checked against the courier's handover
  photos), reported within `return_claim_days`, gets everything back, its share of shipping included; a **change of
  mind**, for unworn and unaltered clothing, keeps `return_tierN_pct` by days since delivery (three windows; after the
  last, no returns). Food is final sale. The refund is fixed when the customer asks (`POST /api/orders/return`,
  `request_return()`); they get an email, and an admin books a courier to collect it from their door, the way it was
  delivered, with handover photos (D-076).
- Admin Returns page: **Received** (the piece is at the US warehouse; it becomes a clearance draft), then **Refund**
  (Stripe first, `admin_return_refunded()` with the fixed amount), or **Reject** with an internal note (the customer is
  told it was not accepted and to reply).

## 7d. US clearance stock (D-072)
- A returned or cancelled piece becomes a draft product (`products.is_us_stock`), photos reused, priced
  `clearance_discount_pct` below what was paid. Admins check the piece in hand and publish it (Catalog → US clearance).
- Its product page says it is already in the US, with today + the US delivery days. An order of only US pieces skips the
  cycle: it is ready to ship at once (`arrived`). Mixed with pieces from India, it travels with them.

## 8. Order statuses: internal vs what the customer sees [D-003]
| Internal (`orders.status`) | Customer sees |
|---|---|
| `pending_payment` | (no order yet) |
| `confirmed` (paid, in open cycle) | **Confirmed** |
| `collecting`, `packed`, `in_transit`, `arrived` | **Preparing your order** (D-034) |
| `shipped` | **Shipped** + carrier tracking link |
| `delivered` | **Delivered** |
| `cancelled` / `refunded` / partly refunded | **Cancelled** / **Refunded** (with amounts) |
Every customer-visible change sends an email through `email_outbox` (C5): the confirmation from the checkout server, every
other visible order event through a database trigger (`order_update` rows). The website sends them right after its own
actions; a pg_cron job calls the outbox job every minute for the rest (the app's admin actions, the automatic cutoff),
once the site URL and the job's secret are in Supabase Vault (`ops.md`). Estimated delivery dates are always shown.

## 9. Stock numbers
- `available = qty_listed − qty_reserved`. This is what the storefront shows, updated live via Supabase Realtime (D-010).
- Every change is a `stock_movements` row (INV-4). Manual corrections use reason `adjusted` plus a note.
