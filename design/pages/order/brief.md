# order: order lookup and the order page (website + app)

**Surface:** website `/orders/lookup`, `/orders/[number]` + app `order/lookup`, `order/[number]` · **Code:**
`apps/web/app/(store)/orders/`, `apps/web/features/orders/` (`lookup-form.tsx`, `order-view.tsx`, `faster-offer.tsx`,
`order-choices.tsx`, `return-choices.tsx`), `packages/shared/src/domain/order-status.ts` · **Status:** mockup, round 1

## The page's job
Answer "where is my order, and when does it arrive?" in one look, and offer the choices the customer has (faster
delivery, cancel or keep after a delay, returns).

## What it shows (flows.md §8, D-008, D-034, D-042, D-064, D-066, D-071, D-072)
Lookup: "Track your order", order number, "Email used for the order", "Find my order" (the signed-in owner goes straight
to the order). Order: "Order <number>", the customer status (Payment pending, Confirmed, Preparing your order, Shipped,
Delivered, Cancelled, Refunded), the estimated delivery window, tracking (a link for USPS, UPS, FedEx), the faster-delivery
offer, the cancel / keep and return choices, the four-step timeline, the items, the totals, Updates.

## Today (production, 2026-10-08)
- The status is a line of text; the timeline is four small outlined boxes with no dates.
- Items are text only.
- The lookup form sits bare on the page.

## Founder's direction (2026-10-08, asked as options)
"A real timeline", "Status card on top", "Photo on each item", "Lookup in a card".

## Design (round 1)
Today's content in the D-079 / D-080 fonts, with:
- **Status card on top:** "Order IWC-…", the status in the heading font, the estimated delivery window under it, and a
  "Track the parcel" button (the carrier's link, D-066) once shipped.
- **Timeline:** Confirmed → Preparing → Shipped → Delivered as a line with dots that fills to the current step; each
  reached step shows its date (from the order's updates). Cancelled and refunded orders show no timeline, as today.
- **Items** with a small photo, like the bag.
- **Lookup in a card**, centred, with "Both are in your order confirmation email." under the button (draft wording).
- The offer, choices and returns blocks are unchanged (their own pages of the pass come with Account).

## Needs
None. Dates, numbers and tracking in the mockup are samples.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
