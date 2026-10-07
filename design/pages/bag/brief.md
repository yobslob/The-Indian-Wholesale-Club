# bag: the bag page and the bag panel (website + app Bag tab)

**Surface:** website `/cart` and (new) the bag panel from the header's bag icon + app `(customer)/bag` · **Code:**
`apps/web/app/(store)/cart/page.tsx`, `apps/web/features/cart/` · **Status:** approved D-086 (2026-10-08), not built yet

## The page's job
Show what is about to be bought, let the visitor change it, and get them to checkout. The bag lives on the device (no
account needed); prices are checked again by the server at checkout (D-038).

## What it shows
"Your bag" · one line per piece (name, option · state, quantity, price, Remove) · Subtotal · "Shipping, tax and delivery
dates are shown at checkout." · Checkout. Empty: "Your bag is empty. Find something from home."

## Today (production, 2026-10-08)
- Lines are text only (no photo), quantity is a 1 – 10 dropdown.
- The bag icon opens a separate page.
- Empty: one sentence, then a blank page.

## Founder's direction (2026-10-08, asked as options)
"Photo on each line", "− 1 + instead of a dropdown", "Bag slides in as a panel", "Empty bag isn't blank".

## Design (round 1)
Today's page in the D-079 / D-080 fonts (heading in Syne, the rest in Karla), with:
- **Photo on each line:** a small 3 : 4 photo; it and the name open the product.
- **Quantity:** − / number / + (44 px targets), the same 1 – 10 limit as today's dropdown.
- **Bag panel:** the header's bag icon opens the bag as a side panel over the page from the right, with the menu's motion
  (D-079): "Your bag (2)", the lines, then Subtotal, the shipping line, Checkout and "View bag" (the /cart page).
- **Empty bag (page):** today's sentence, then the open states as the D-080 stamps and the Just listed row. The empty
  panel keeps to the sentence and its link (a panel is too narrow for the rest).

## Needs
None.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
| 2026-10-08 | — | "approved, move to next" | approved as D-086 |
