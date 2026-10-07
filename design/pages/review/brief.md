# review: writing a review (website; the app opens the website)

**Surface:** website `/account/reviews/[productId]` (and, new, a panel over the product page) · **Code:**
`apps/web/app/(store)/account/reviews/[productId]/page.tsx`, `apps/web/features/reviews/` · **Status:** approved D-090 (2026-10-08), not built yet

## The page's job
Let a signed-in customer rate a piece and say why, add photos if they bought it, and know it will be read first.

## What it shows today (D-051, D-052, D-056)
The product's name (link) · state · "Write a review" · Your rating (five pill buttons, 5 to 1 stars) · Your review
(up to 2,000 characters) · Name to show (their first name filled in) · Photos (up to 4, optional) for verified buyers,
or "Photos can be added by customers who received this piece." · Send review · "We read every review before it appears
on the page." After sending: "Thank you. We read every review before it appears on the page. Back to <product>".
Already reviewed: "You have already reviewed <product>."

## Founder's direction (2026-10-08, asked as options)
"Tap the stars", "The piece at the top", "Photo tiles", "Opens as a panel".

## Design (round 1)
In the D-079 / D-080 fonts:
- **Opens as a panel:** "Write a review" on the product page opens the form as a side panel over the product with the
  menu's motion; signed out, it shows the sign-in card there first (D-089). The `/account/reviews/…` page stays for
  links that arrive from outside (same form).
- **The piece at the top:** its photo, name and state in a small card.
- **Tap the stars:** one row of five large stars (tap or arrow keys), "4 of 5" beside them.
- **Photo tiles** for verified buyers: up to 4 tiles with previews and a × to remove, and a "+ Add photo" tile.
- Everything else (fields, limits, texts, the thank-you and already-reviewed states) as today.

## Needs
None.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
| 2026-10-08 | — | "approved, move to next" | approved as D-090 |
