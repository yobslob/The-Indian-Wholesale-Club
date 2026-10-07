# account: the profile (orders, saved, addresses, details) and signing in there (website + app Profile tab)

**Surface:** website `/account`, `/account/orders`, `/account/addresses`, `/account/saved` (and `/login`, `/signup` when
reached from the profile icon) + app `(customer)/profile`, `addresses`, `(customer)/saved` · **Code:**
`apps/web/app/(store)/account/`, `apps/web/features/account/`, `apps/web/features/auth/auth-form.tsx` · **Status:**
mockup, round 1

## The page's job
The one place a customer deliberately goes for their own things: past orders, saved pieces, addresses, their details.
Nothing here is pushed at visitors elsewhere (D-087).

## What it shows today
`/account`: "Your account", underlined links to Orders, Addresses, Saved, the email, Full name and Phone with Save, Sign
out. Orders: rows of number, date, status, total (each opens the order page). Saved: the product grid with "Remove" under
each card. Addresses: the list (label or name, Default, Make default / Remove) and "Add an address". Signed out, the
profile icon opens `/login` (email, password, "New here? Create an account" → `/signup` with full name).

## Founder's direction (2026-10-08, asked as options)
"One profile page, sections", "Orders as cards", "Heart to unsave", "Sign in on the profile page".

## Design (round 1)
In the D-079 / D-080 fonts:
- **One profile page** with four sections, Orders · Saved · Addresses · Your details: a list on the left on desktop,
  pill tabs on phones (each section keeps its own address, so links and the back button work), Sign out at the foot.
- **Orders as cards:** the first piece's photo (and "+1 more"), the order number and date, the status as a label, the
  estimated delivery window, the total; the card opens the order page (D-088).
- **Saved:** the standard cards (D-080) with a filled heart on the photo that removes the piece; "Nothing saved yet."
- **Addresses:** each address as a card with Default, and Edit / Make default / Remove as buttons (like D-087's Edit);
  "Add an address" opens today's form.
- **Your details:** the email, Full name, Phone, Save.
- **Signed out:** the profile page itself shows a sign-in card (email, password, Sign in, "New here? Create an
  account", which turns the card into account creation with full name), instead of a jump to `/login`.

## Needs
- The sign-in card's one-line leads ("To see your orders, saved pieces and addresses.", "Save pieces and see every
  order in one place.") are draft wording (D-059).
- Orders, dates and addresses in the mockup are samples.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
