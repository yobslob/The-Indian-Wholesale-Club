# Flows: how stock, cycles, orders, pickups and payouts move

Target behaviour (implemented from R3 on). Business source: D-005 (order-first), D-008 (delivery windows), D-003 (what
customers may see). Open points are marked with Q-ids. **Don't fill those gaps with guesses.**

## 1. The cycle (one round every 20–23 days, D-005)
```
open ──cutoff──► collecting ──► packed ──► exported ──► arrived ──► fulfilling ──► closed
 (orders join)   (COO picks up  (COO packs  (in transit   (founder    (founder ships
                  from vendors)  the export)  to the US)    receives)   each order)
```
- Exactly one cycle is `open` (INV-5). When a cycle hits its cutoff, the next cycle opens immediately. Its dates are entered by an admin.
- An admin sets each cycle's `cutoff_at`, estimated export and estimated arrival dates. Typical lead times are unknown (Q-3), so nothing is
  hard-coded.
- Status changes are manual admin actions. Each one writes an internal `order_event` for every affected order.

## 2. Listing a product (India desk, usually on a phone)
1. Choose a vendor. The region comes from the vendor.
2. Take photos, then pick the type and category, then fill the name and details. `attributes` are validated per type.
3. Add variants with their options and the quantity the shop has (`qty_listed`).
4. Enter the shop price in ₹. The system suggests a USD price from `pricing_settings` (landed cost + margin), and an admin sets the final `price_cents`.
5. Save as `draft`. An admin reviews it and sets it `live`. Spices stay unpublished until Q-10 is answered.
- `qty_confirmed_at` records when the shop last confirmed quantities. The admin sees listings not confirmed within N days
  (N is set in `pricing_settings`) so they can re-check with the shop.

## 3. Placing an order (customer)
1. The cart holds variants. At checkout, the server computes totals: subtotal, promo, shipping, tax (flat 8% estimate, Q-11).
2. The server computes the **delivery window** from the open cycle's estimated arrival plus domestic delivery days. It is shown before payment
   (D-008).
3. Payment: a Stripe PaymentIntent (USD). After confirmation, the server verifies amount, currency and status, and only then
   creates the order (kept from the old code, including `pending_orders` reconciliation by webhook).
4. In one transaction: create the order and items, **reserve** stock (a conditional update, INV-3), write `stock_movements`, attach
   the order to the open cycle, store the delivery window, and queue the confirmation email in `email_outbox`.
5. If the reservation fails (sold out meanwhile), no order is created and the payment is refunded or cancelled. The customer is told the item sold out.

## 4. Pickups (India desk)
1. At cutoff, the system creates one `pickup` per ordered piece, grouped by vendor into a per-shop checklist.
2. The COO visits each shop and marks every piece `picked` (optional photo) or `unavailable`.
3. `picked` → stock moves from reserved to picked, and the shop price is added to that vendor's payable.
4. `unavailable` → stock is released, the order item becomes `unavailable`, and the customer is refunded for that item and notified
   (default. Substitutes are an open question, Q-7). The customer message never mentions shops (D-003).

## 5. Payouts (India desk) [D-005]
- A vendor's payable is the sum of their `picked` pickups not yet covered by a payout.
- The COO records a payout (amount ₹, method, reference, optional receipt photo, Q-6) linked to the pickups it covers.

## 6. Export → arrival → US fulfilment
1. `packed`: the COO generates the packing list and commercial invoice (CSV/PDF) from the cycle's picked items.
2. `exported`: AWB and forwarder are recorded.
3. `arrived`: the founder marks the export received and checks off each order's pieces.
4. `fulfilling`: for each order, the founder packs it, enters the carrier and tracking number (the order becomes `shipped`), then `delivered`.
5. `closed`: all orders in the cycle are delivered, refunded or cancelled.

## 7. Delays (D-008)
If a cycle's estimated arrival moves past an order's `est_delivery_to`, the admin gets a warning. The customer gets a
notice with the new estimate and the option to **cancel for a full refund**. The customer's choice is recorded as an
`order_event`. The old window is never silently overwritten (INV-6).

## 8. Order statuses: internal vs what the customer sees [D-003]
| Internal (`orders.status`) | Customer sees |
|---|---|
| `pending_payment` | (no order yet) |
| `confirmed` (paid, in open cycle) | **Confirmed** |
| `collecting`, `packed`, `in_transit`, `arrived` | **Preparing your order** (wording pending Q-12) |
| `shipped` | **Shipped** + carrier tracking link |
| `delivered` | **Delivered** |
| `cancelled` / `refunded` / partly refunded | **Cancelled** / **Refunded** (with amounts) |
Every customer-visible change sends an email through `email_outbox`. Estimated delivery dates are always shown.

## 9. Stock numbers
- `available = qty_listed − qty_reserved`. This is what the storefront shows, updated live via Supabase Realtime (D-010).
- Every change is a `stock_movements` row (INV-4). Manual corrections use reason `adjusted` plus a note.
