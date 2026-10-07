# checkout: checkout and the thank-you page (website + app checkout)

**Surface:** website `/checkout`, `/checkout/success` + app `checkout` (PaymentSheet) · **Code:**
`apps/web/app/(store)/checkout/`, `apps/web/features/checkout/` (`checkout-flow.tsx`, `order-summary.tsx`,
`shipping-picker.tsx`, `payment-form.tsx`, `checkout-success.tsx`) · **Status:** mockup, round 1

## The page's job
Take the details we need to deliver, show the exact total and delivery window before paying (D-008, D-038), take the
payment, and say clearly that the order is in.

## What it shows today (D-038, D-041, D-070)
Step 1, one form: email, full name, street, apartment, city, state, ZIP, phone (optional), promo code (optional),
"Continue to payment", "US addresses only. You will see the total and delivery window before paying." Step 2: the
server-priced summary (lines, subtotal, discount, shipping, sales tax, total, estimated delivery), Standard / Express
with each window, Stripe's payment form, "Change details". Thank-you: "Thank you!", the order number, "We have emailed
your confirmation with the estimated delivery window.", a link to the order page, "Keep browsing".

## Today (production, 2026-10-08)
- Nothing shows what is being bought until the address is sent; the right half of the page is empty.
- The full menu and footer stay on screen during payment.
- The thank-you page is three lines of text.

## Founder's direction (2026-10-08)
"I don't want to shove the signin or any details from the customer anywhere on the website, I only want it when the user
deliberately goes to profile or if the user checks out, so we will show it like a part of the process, first we will
only ask for number putting the us +1 with flag by default, when number is done we will ask for name pincode(fetch us
city automatically by pincode) and address, when both are done then we will show payment methods." Also chosen: "Bag
beside the form", "Quiet header", "Fuller thank-you page". Then: email "Ask email in step 2 (Recommended)"; phone
"No code, just the number (Recommended)".

## Design (round 1)
- **Three steps on one page**, each opening when the one before is done; a finished step folds to one line with Change:
  1. **Phone:** +1 with the US flag by default, the number, Continue. No code is sent.
  2. **Delivery:** full name, email, ZIP code (city and state fill in from it, editable), street address, apartment
     (optional), promo code (optional, behind "Add a promo code"); "Continue to payment" prices the bag on the server.
  3. **Payment:** Standard / Express with each window, Stripe's payment form (as today), "Pay $…".
- **Bag beside the steps** from the start (photos, lines, subtotal); once priced it shows shipping, tax, total and the
  estimated delivery. On phones, a "Bag (1) · $114.99" bar at the top opens it.
- **Quiet header** on checkout only: the logo and "Back to bag"; a one-line footer.
- **Thank-you page:** today's text, then the pieces with photos, the total and the estimated delivery window.
- No sign-in or personal-detail prompt anywhere else on the website (Profile and checkout only).

## Needs
- ZIP → city: a source for the lookup (a bundled US ZIP list or a lookup service); decided when built.
- Phone becomes required (today optional): used for delivery contact only.
- Numbers in the mockup (tax, express price, delivery dates) are samples; the real ones come from the server and cycle
  data (D-008, D-041, D-070, D-073).

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the direction above | first proposal |
