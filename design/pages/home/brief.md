# home: everything below the hero (website + app Home)

**Surface:** website `/` + app `(customer)/index` · **Code:** `apps/web/app/(store)/page.tsx`,
`apps/web/features/catalog/product-row.tsx` + `product-card.tsx` + `quick-add.tsx`, `apps/web/features/regions/pick-home*.tsx`;
app `apps/app/app/(customer)/index.tsx` · **Status:** mockup, round 2

The first screen (photo, name on the wall, header, scroll fade) is settled by D-079 and is not reopened here.

## The page's job
Show that the shop is alive (what came in lately) and get a homesick visitor to their own state in one or two taps.

## What it shows (`storefront.md` §Web routes, D-050 – D-052, D-062, D-079)
- **Just listed:** the newest pieces as a sideways row with See all (D-062), each card a 3 : 4 photo, name, price, state.
- **Pick your home:** the India map (DataMeet, credit shown, D-052), the open states as postage stamps whose postmark
  carries the delivery window from cycle data (D-008), every other state by name, and a search that filters them. A
  name lights its state on the map after 700 ms (D-051).
- The footer (D-079).

## Today (production, 2026-10-08; `today/below-hero-*.jpg`)
1. **Just listed cards:** the "Choose" pill sits beside the name and squeezes it: "Japan- / fit / baggy / jeans" on four
   lines at 390, three lines at 768 and 1024. Cards end up different heights.
2. **Pick your home below 1440:** the map and the list stack, and the map panel alone is about 540 px tall at 1024; the
   section runs to 2,380 px at 1024 and 1,600 px at 390.
3. **1440:** the map panel is stretched to the list's height, so a big empty band sits under the map.
4. **Stamps:** the round postmarks spill past the stamp and, at 1024, past the panel edge. On phones the stamps are
   three to a row and tiny (about 70 px of photo).
5. **Coming soon:** 31 names as a long two- or three-column list (16 rows on a phone).
6. **Hero photo:** its "31 03 2025" date stamp shows in the bottom corner on tablets and phones.

## Founder's direction
"let's finalize and go to next steps" (2026-10-08). Refine what's approved (2026-10-07).

## Design (round 1 proposal)
Kept: the row with See all, 3 : 4 photos, the map + stamps + names idea, stamps with a postmark, the search.
- **Cards:** name on its own (two lines at most), "price · state" under it; the add button becomes a round + on the
  photo's corner, so it never squeezes the name (a piece with sizes opens its options, as "Choose" does today).
  4 cards and a peek of the 5th at 1440, 3 at 1024, 2 at 768, 1½ on phones. Row arrows sit in the section header.
- **Pick your home, 1024 and up:** two equal panels side by side; the map fills its panel (no empty band).
- **768:** the map panel shorter (it scales to the width), then the list.
- **Phones:** a two-way switch "Names | Map" at the top of the section, names first, so the section is about half as long.
- **Stamps:** two to a row on phones, three on wider screens; the postmark stays inside the stamp.
- **Coming soon:** the names flow as one wrapped block, spaced, no dots.
- Section titles in Cinzel, everything else in Karla (D-079).

## Needs
None. (The hero's date stamp stays: "let the date be as is".)

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | — | first proposal |
| 2026-10-08 | 2 | "Things we finalized are good such as cinzel and karla, placement of the hero heading etc etc rest should be like it was before(such as before when the header moved down the hero image its bg became colored but smoothly fading in now it harshly switches colors and also the haeding were in white)" · on the date stamp: "let the date be as is" | header on the photo back to today's look: white links over the dark band at the top (amends D-079's black nav and "no fades" for the header only), the 0.35 s cross-fade to cream once the photo has passed (as `globals.css`); the photo's date stamp stays |
