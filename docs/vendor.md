# Vendor screens: a shop's own sign-in (D-102, D-103)

Users: a vendor's owner (the founder's "retailer"; glossary: **vendor account**). They upload their own pieces and
see only their own: never a customer, another vendor, the customer price or IWC's costs (INV-10). Every vendor read is
a `vendor_*` database function filtered by the caller's vendor (`data-model.md`); the base tables stay admin-only.

## Access
- **Web** `/vendor` (`apps/web/app/vendor/`, code in `features/vendor/`): never linked from the store, `noindex`, its
  own route group (its code loads only there). Lint keeps vendor code out of the storefront and admin code out of
  vendor pages (`apps/web/.eslintrc.js`).
- **Sign-in:** an admin makes the account on the Vendors page and shows its one-time QR code / link (works once, 7
  days; a new one replaces the old). Opening it signs the phone in: the website's server redeems the code
  (`/vendor/api/sign-in`, rate-limited, service role) and hands back a token the browser turns into a session. No
  password, no SMS. Every page checks `is_vendor()` on the server (`features/vendor/guard.ts`).
- **"Join as a vendor?"** only on the vendor sign-in page (`/vendor/join`, never on a customer surface, D-003): shops in
  India pick their state; a US store's request waits for Q-35. Requests land on the admin's Vendors page.
- **App:** the same screens as a vendor mode after the server confirms `is_vendor()` (V5, not built yet).

## Screens (phone first: one job per screen, pictures before words, 44 px+ targets)
| Screen | Route | What |
|---|---|---|
| Home | `/vendor` | four tiles: Add a piece, Keep ready (count), My pieces (retakes asked), Money (₹ owed) |
| Add a piece | `/vendor/new` | what it is (category tiles) and who wears it → front, back, close-up photos one at a time with an outline, each checked at once on the phone (`@repo/shared/vendor` `checkPhoto`: size, light, blur) and sent as soon as it is taken → sizes with + / −, the shop price in ₹, optional fabric / care / colour → Send |
| My pieces | `/vendor/pieces`, `/vendor/pieces/[id]` | what was sent and what is in the store, with a picture of its state; a piece IWC asked about opens the same steps with what it has, so only the needed photos are taken again |
| Keep ready | `/vendor/ready` | ordered pieces IWC will collect: piece, size, how many, "after <cutoff>" (never who bought them) |
| Money | `/vendor/money` | owed in ₹ for collected pieces, the latest collected pieces, payouts |

**Languages (D-102):** English and the vendor's region's language (`@repo/shared/vendor` `i18n.ts`, a switch on every
screen, kept in a cookie). Every language but English is a Claude draft until someone fluent checks it.

## Photos (D-100, D-101, D-104)
The vendor's photos go to the private `vendor-uploads` bucket, shrunk to 2400 px on the phone. The GPU worker
(`tools/photo-worker`) makes three candidates per pose on a house model; the admin picks on **Vendor pieces**
(`/admin/vendor-pieces`), writes the English name and care, and publishes. The picked photos and the real close-up are
copied to `product-media` (the AI ones flagged `is_ai`, so the product's Details say so); the candidates and the raw
photos are then deleted.
