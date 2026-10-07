# product: a product's page (website + app)

**Surface:** website `/states/[region]/[product]` + app `product/[region]/[slug]` · **Code:**
`apps/web/app/(store)/states/[region]/[product]/page.tsx`, `apps/web/features/catalog/product-gallery.tsx`,
`add-to-cart.tsx`, `product-details.tsx`, `apps/web/features/reviews/`; app `apps/app/app/product/[region]/[slug].tsx` ·
**Status:** approved D-082 (2026-10-08), not built yet

## The page's job
Show the piece well enough to buy it from far away: photos, price, options, honest origin and delivery, reviews.

## What it shows (D-004, D-008, D-051, D-052, D-056, D-062)
Photos (one full-length, three beside it) · breadcrumb (state · type · category) · name with the heart (save) · summary
· price · options · availability · delivery window (or "not announced yet") · quantity + Add to bag · Size chart (+ / −)
· origin line "Made in India · from <state> · Imported" · Reviews (summary + cards, Write a review) · Similar items and
Picked for you as rows of small cards.

## Today (production, Kasavu saree, 2026-10-08)
- **Bug, 768 – 1100 px:** the photo column is as tall as the screen (up to 900 px) and so 825 px wide at 768: the info box
  is squeezed to about 120 px, one word per line ("Add / to / bag"), and the page scrolls sideways by 259 px at 768
  and 16 px at 1024.
- Phones: Add to bag is about 1,470 px down the page; the three review cards stack (about 550 px).
- A small photo, when clicked, swaps into the big spot; there is no way to see a photo larger.

## Founder's direction (2026-10-08, asked as options)
Tablet fix: "Photos left, info right (Recommended)". Also: "regardless of screen size clicking a photo opens a panel
showing full size image providing both swipe and arrow to move in these photos of the particular product.", "Add to
bag stays in view", "Reviews as a row on phones". Not chosen: swipe photos on phones (the gallery itself stays).

## Design (round 1)
Today's layout in the D-079 / D-080 fonts (name in Cinzel, section headings in Syne, the rest in Karla), with:
- **Tablets (768 – 1099):** two columns, the big photo with the three small ones in a row under it on the left, the info
  box on the right. 1100 and up as today; phones as today.
- **Photo viewer, every size:** clicking any photo opens a full-screen panel over the page with that photo at full size;
  swipe or the arrows move through the product's photos; a count ("2 / 4"), a close button, Escape and the arrow keys.
- **Phones:** a slim bar with the name, price and Add to bag slides up from the bottom once the page's own Add to bag
  has scrolled out of view, and slides away when it is back.
- **Phones:** the review cards become a sideways row under the rating summary.
*Interpretation:* "clicking a photo" includes the small ones, so they open the viewer at that photo instead of swapping
into the big spot; the origin line moves from Georgia italic to Cinzel (the display font, D-079), which has no italic.

## Needs
None.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
| 2026-10-08 | — | "approved, move to next" | approved as D-082 |
