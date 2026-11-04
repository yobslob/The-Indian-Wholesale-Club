# Flows: how an order moves, from the customer to the online shop to the door

The simple store (D-187). Business source: D-187 (delivery days, the two shipments), D-008 (honest dates), D-003 (what
customers may see), D-115 (made to order). Open points are marked with Q-ids. **Don't fill those gaps with guesses.**
How cycles, vendor pickups, payouts and exports worked before: `docs/archive/retired-2026-11-simple-store.md`.

## 1. The whole way (D-187, D-115)
```
customer orders ──► we buy it from the online shop ──► at the hub ──► flight ──► the customer's door
 (paid, confirmed)    To order → Ordered                 weighed       shipment by shipment, tracked
```
- **We buy from online shops and resell** (Myntra, Amazon India, Blinkit…; the shop is `product_sources.site` or
  `products.source_site`, admin only). Nothing is held in India: a piece is bought when it sells.
- **A delivery day is a working day, Monday to Friday, counted from the order day.** Weekends do not count; US public
  holidays do (the founder may change that later); a late flight is not part of the promise, and we email a new date
  (§7). Food takes 7 delivery days, clothing and home & gifts 12 – 16 (Settings, in business days;
  `_add_business_days` in SQL, its twin `addBusinessDays` in `packages/shared/src/domain/delivery.ts`, tested against the
  same 20 cases). Already in the US (§7d) stays in calendar days.
- **A bag with food and other pieces is always two shipments:** 1 = food, 2 = clothing and home & gifts. An address outside
  the 48 states and DC, a PO box or an APO gets one shipment, 12 – 16 delivery days.

## 2. Listing a product
Listings come from the importer and the sourcing runner (`admin.md` §Import from shops, §Auto-sourcing); there is no
listing with the camera any more (plan §10 Y-4). Editing a listing stays. A listing goes live only when every option has a
weight (D-129); clothing also needs who it is for and its care. Food follows its status.

## 2b. An imported listing (D-110)
1. The admin imports a product page (`admin.md` §Import from shops): photos, words and the shop's price come from the
   page; the admin confirms the state (or none, all India), type, category and details. The shop price is the shop's
   price, so the dollar price follows D-128.
2. It sells like any piece: its window comes from Settings' delivery days (D-187).
3. Importing the page again before an order updates the price and the sizes in stock; a size the shop no longer has
   stops selling, and pieces already ordered stay reserved.

## 3. Placing an order (customer)
1. The cart holds variants. At checkout, the server computes totals from the catalog (never from the browser): subtotal,
   promo, the bag's charges (`pilot-numbers.md`: free shipping from $49.99, bulk saving and the heavy-item discount from
   $99.99) and sales tax by the delivery state (D-073: only where IWC is registered, New Jersey, and only on taxed
   classes; clothing and food are exempt there, so most orders carry none). Standard is the only shipping; an order
   placed with Express before D-187 keeps its dates and its label.
   **Stock (plan §10 Y-3):** when checkout opens (`POST /api/checkout/stock`) and on every re-price, `checkout_context`
   answers each line's stock. A line sold out, with fewer left than the bag asks, or no longer on sale is listed at the top
   of checkout: "Not available right now" or "Only 2 left", with Remove or Keep 2. The form and payment stay closed until
   each is sorted; fixing the last re-prices at once and moves the same payment.
2. The server computes the **delivery window** from today and Settings' days, in business days: food, and the rest. It is
   shown before payment as "Estimated delivery" (D-008), with both shipments for a split bag. Store pages say only
   "7 delivery days" and "12 – 16 delivery days", never a calendar date (founder, plan §10 Y-5). Pickups, the buy list,
   are made as the order is created (§4).
3. Payment: a Stripe PaymentIntent (USD) for exactly that total. The priced checkout is stored in `pending_orders` with it.
   After payment the server verifies amount, currency and status with Stripe, then creates the order **from the stored
   checkout** (D-038). The customer's device (website or app, D-043) and the Stripe webhook both trigger this; the
   second finds the existing order. The website pays with Stripe's Payment Element, the app with Stripe's payment sheet.
   **Safety nets (launch QA F-1, F-2):** the webhook claims each event (`webhook_events`, `processing` → `done` once
   handled); a claim left `processing` by a killed function is taken over by Stripe's retry after 2 minutes. If both
   the device and the webhook fail, the **payment sweep** (`POST /api/internal/payment-sweep`, called by pg_cron every
   10 minutes only when a checkout is due) asks Stripe about each unreconciled checkout 10 minutes to 2 days old (each
   at most hourly, 20 a run) and creates the order for a succeeded payment, never for one already refunded in Stripe; a
   cancelled payment, or one finalize refused, is not looked at again (`sweep_note`).
   Every server database call gives up after 8 s (F-0): a route answers 503 "We're busy right now…" with
   `Retry-After: 30` (`lib/supabase/busy.ts`), and a cached store page keeps showing the copy built before.
   **One PaymentIntent per checkout visit (website):** a re-price (details edited, a stock line fixed, a refresh at
   Payment) sends back the payment's client secret and the server moves that payment's amount and rewrites its stored
   checkout instead of creating another; if storing fails, the amount is put back or the payment cancelled, so the
   stored checkout always matches what can be paid. Creating one carries an Idempotency-Key (the priced bag, details,
   total and a 10-minute window). **A paid customer never stays on the form:** if confirming fails or is slow, the
   thank-you page asks again with back-off for about a minute (2, 4, 8, 16, 30 s), then says the payment went through
   and the number will follow by email, with the support address. A failed 3-D Secure check goes back to Payment with
   the reason and the bag kept.
4. In one transaction (`create_order`): create the order and items, **reserve** stock (a conditional update, INV-3), write
   `stock_movements`, make the shipments and the pickups, and store the delivery window. Then the server queues the
   confirmation email in `email_outbox`.
5. If `create_order` refuses (sold out meanwhile, price changed), no order is created, the payment is refunded
   in full and recorded in `failed_reconciliations` (one open row per payment, however many of the device, webhook and
   sweep reach it; the founder is alerted once, F-3). The customer is told an item sold out. This is the rare race the
   checkout's own stock check (step 1) leaves. A created order's number is
   added to the PaymentIntent's metadata (with `source: iwc` and the checkout's hash from creation, F-6), so support
   finds it in Stripe.
6. **After payment (F-3, the same webhook and claims):** a refund made in the Stripe dashboard (`charge.refunded`) brings
   the order's refunded total up to Stripe's and emails the customer (the `item_refunded` update), unless the admin's
   own refund already counted it (a fresh event waits 30 s for that record); a dispute (`charge.dispute.created`,
   `.closed`) is kept in `payment_disputes` and alerts the founder at once; a failed payment
   (`payment_intent.payment_failed`) is logged with its codes and the checkout stays open (the customer may try another
   card), the sweep asking Stripe again an hour later. Alerts go to `ADMIN_ALERT_WEBHOOK_URL` (`monitoring.md` §5);
   Today shows payments to check and open disputes in red.

## 4. Buying (India desk): To order → Ordered → At the hub
In the made-to-order store a **pickup is the buy list**: one per ordered piece, made by `create_order` (none for a piece
already in the US, D-072). The shop comes from the piece's source, the pickup's `site` or the listing's `source_site`.
1. **To order** (`admin_to_order`, `/admin/to-order`): every sold piece of a paid, open order not yet ordered, one card per
   shop, oldest first. **Food comes first:** bought within 2 hours of the order, shipped by the next day (Today's food watch,
   `admin_food_watch`). The sourcing runner prefers the fast shops for food (`_quick_sourceable`), which is what makes 7
   days true.
2. **Ordered** (`admin_mark_ordered`): what was paid per piece, the shop's order number, a bill. Undo while it is not at the
   hub. The money side (invoices A, B, C, `shop_bills`) is in `admin.md`.
3. **At the hub** (`mark_pickup`): the piece is picked, stock moves from reserved to picked.
3a. **Weighing (D-130):** with a piece in hand the desk may type its weight (one piece, packed). `admin_weigh_pickup()` makes
   it the option's weight (`weighed`, D-129), the same piece's other sizes that only guessed follow (`similar`, never a
   pack), the listing is repriced for the next customer (D-128; a hand-set price stays), and the pickup keeps the note
   ("Weighed 310 g (listed 450 g, -31%): price now $25.30, was $17.33").
4. **Unavailable:** the piece is written off (`qty_listed` and the reservation both drop, ledger reason `unavailable`), the
   order item becomes `unavailable`, and the customer is refunded for that item and notified (no substitutes, D-030). The
   admin refunds it from the order page: the item's price after its share of any discount + its share of the tax; the last
   piece of an order refunds everything left (D-042). The customer message never mentions shops (D-003).
A piece ends At the hub and ships from there. The "In the US" chip stays only for old rows: nothing sets `pickups.arrived_at`
any more (it was so in the pilot too; the old setter went with cycles).

## 6. Shipping (`ship_shipment`, `ship_order`)
1. Every shipment leaves from the hub once its pieces are picked; `pieces_not_picked` otherwise. The desk picks the carrier
   (USPS, UPS or FedEx give the customer a tracking link, D-066; another carrier is typed) and enters the tracking number.
2. **Two shipments:** each is shipped from the order page with its own carrier, tracking number and email
   (`ship_shipment`, `deliver_shipment`). The order is Shipped once nothing is left to send and Delivered once everything
   sent has arrived; a shipment whose pieces all became unavailable is cancelled by itself and the other goes on.
3. An order of one shipment can also use `ship_order` and `deliver_order`. An order of only US pieces is `arrived` at once
   and ships from the US desk (§7d). "Orders to ship" on Today and in the sidebar counts `arrived`, so only those: a hub
   order ready to go has no queue of its own and is found on its order page (it was so in the pilot too).

## 7. Delays (D-008)
When a date moves (a late flight, a shop's delay), the admin sets new dates (`change_delivery_window`, or
`change_shipment_window` for one of two shipments). The customer gets an email with the new estimate, and their order page
(website and app) offers **keep my order** or **cancel for a full refund** until it ships (`keep_after_delay`,
`cancel_after_delay`, through `POST /api/orders/choice`). The choice is recorded as an `order_event`. The old window is never
silently overwritten (INV-6). Pieces already collected for an order cancelled this way become US clearance drafts (D-072).
Today shows no delay warning (not built). An order of two shipments gets new dates per shipment: the customer may keep that
shipment or cancel only it, for its pieces, its Shipping share and their tax.

## 7b. Cancelling (D-042, D-072)
- **Until the order leaves India** (`confirmed`, `collecting`, `packed`; an old Express order until its courier leaves), the
  customer's order page (website and app) offers "Cancel my order" with the refund shown first: everything back, minus
  `cancel_fee_pct` of the goods once pieces are being collected (0 for the pilot). `POST /api/orders/choice` refunds
  Stripe, then `customer_cancel()` records it and re-checks the amount. Pieces not collected go back to the listing's stock
  (`released` in the ledger); collected ones become US clearance drafts (§7d).
- Before it ships an admin can also cancel (`cancel_order()`, on the customer's request or because of IWC: everything back).
- **Two shipments:** once the hub has bought a food shipment's pieces (ordered from the shop, or at the hub) the order
  cannot be cancelled as a whole (food cannot go back; `customer_cancel` raises `food_bought`). Customer care can cancel the
  other shipment alone until it leaves India (`admin_cancel_shipment`): its pieces, its Shipping share and their tax back.
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
- Its product page says it is already in the US, with today + the US delivery days (calendar days: this stays as it was
  under D-187). An order of only US pieces is ready to ship at once (`arrived`), with no pickup, and checkout shows that
  window before payment. Mixed with pieces from India, it travels with them. A card does not know a piece is in the US, so
  a clearance piece's card says the standard days; its page and checkout are right.

## 8. Order statuses: internal vs what the customer sees [D-003]
| Internal (`orders.status`) | Customer sees |
|---|---|
| `pending_payment` | (no order yet) |
| `confirmed` (paid) | **Confirmed** |
| `collecting`, `packed`, `in_transit`, `arrived` | **Preparing your order** (D-034) |
| `shipped` | **Shipped** + carrier tracking link |
| `delivered` | **Delivered** |
| `cancelled` / `refunded` / partly refunded | **Cancelled** / **Refunded** (with amounts) |
Every customer-visible change sends an email through `email_outbox` (C5): the confirmation from the checkout server, every
other visible order event through a database trigger (`order_update` rows). The website sends them right after its own
actions; a pg_cron job calls the outbox job every minute for the rest (the app's admin actions), once the site URL and the
job's secret are in Supabase Vault (`ops.md`). Estimated delivery dates are always shown on an order.

## 9. Stock numbers
- `available = qty_listed − qty_reserved`. Store pages show the stock their cached page was built with, nothing live;
  checkout checks it (§3, plan §10 Y-3), and `create_order`'s own check (INV-3) and its refund stay for the rare race.
- Every change is a `stock_movements` row (INV-4). Manual corrections use reason `adjusted` plus a note.
