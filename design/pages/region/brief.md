# region: a state's page (website + app)

**Surface:** website `/states/[region]` + app `region/[slug]` · **Code:** `apps/web/app/(store)/states/[region]/page.tsx`,
`apps/web/features/regions/`, `apps/web/features/catalog/product-row.tsx`, `curated-card.tsx`; app
`apps/app/app/region/[slug].tsx` · **Status:** mockup, round 1

## The page's job
The core page (`storefront.md` §The region page): greet the visitor in their own script, show the place, and lay out
everything from that state, newest first, then by category.

## What it shows (D-019, D-051, D-056, D-062)
Breadcrumb · greeting in the region's script with its transliteration and meaning · the state's name · tagline · story ·
the region photo · jump pills (New arrivals, each category with its count, Spices) · New arrivals · Picked for you
(curated, D-056) · one sideways row per category, biggest first (D-062) · Spices. Most wanted, the album and Leaving soon
appear when a state has the data (Kerala on production has none of them yet).

## Today (production, Kerala, 2026-10-08; `today/top-*.jpg`)
- The page is 8,755 px at 1440: hero, pills, New arrivals, Picked for you, then 10 category rows and Spices.
- The jump pills run off the right edge with no hint that more follow.
- Picked for you is 4 small fixed cards that leave the right half of its box empty on desktop.
- On phones the first screen is all text; the photo comes after the story.
- Card names squeezed by "Choose": fixed everywhere by D-080 (the + on the photo).

## Founder's direction (2026-10-08, asked as options)
State name font: "Cinzel (Recommended)". Fixes: "Arrows on the jump pills", "Picked for you as a row", and "Something
else" (not yet said what). Not chosen: photo first on phones, merging tiny categories.

## Design (round 1)
Today's layout in the D-079 / D-080 fonts (state name Cinzel, section headings Syne, the rest Karla), with:
- **Jump pills:** the arrows of the product rows at either end, each hidden at its end and on phones (swipe there).
- **Picked for you:** the same box, its cards now the standard row (full-size cards filling the width, arrows when they
  overflow) instead of four small fixed cards.

## Needs
- The founder's "Something else".

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
