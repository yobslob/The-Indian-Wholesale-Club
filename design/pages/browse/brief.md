# browse: Clothing and Spices, the See all page (website + app)

**Surface:** website `/clothing`, `/spices` (`?state=`, `?category=`, `?show=`) + app `browse` · **Code:**
`apps/web/app/(store)/clothing/page.tsx`, `spices/page.tsx`, `apps/web/features/catalog/browse-by-type.tsx`,
`product-card.tsx` (ProductGrid) · **Status:** approved D-084 (2026-10-08), not built yet

## The page's job
Everything of one type, newest first, narrowed by state and category; where every row's See all leads (D-062).

## What it shows (D-062, D-067, D-068)
Heading (type, plus " · <state>" when filtered) · state pills with counts · category pills with counts · the grid, 24 at a
time with "Showing 24 of 216" and Show more. Spices today: "Spices are coming soon."

## Today (production, 2026-10-08)
- Both pill rows run off the right edge with nothing to say more follow (the category row at every width).
- The pills scroll away with the page; to change a filter you scroll back to the top.
- Phones: two sideways pill rows above the grid; card names squeezed by "Choose" (fixed by D-080's + on the photo).
- The grid is 2 columns below 1280 px and 4 from 1280 (`ProductGrid`), so the page is 9,657 px tall at 1024. Not
  raised as a change (the founder kept the rest as today).

## Founder's direction (2026-10-08, asked as options)
"the things that run off edge, give them a very very little soft blur, not too harsh", "Filters stay on screen", "One
Filter button on phones". Not chosen: arrows on the pills.

## Design (round 1)
Today's layout in the D-079 / D-080 fonts (heading in Syne, the rest in Karla, the + on every card), with:
- **Soft edge:** where a pill row runs off the screen, its last 56 px fade into the page under a very light blur (1.5 px),
  on whichever side has more; nothing when the row fits.
- **Filters stay on screen:** the pill rows pin under the header while the grid scrolls.
- **Phones:** one pinned bar with a Filter button (and what is chosen, e.g. "Kerala · Everything") that opens a side panel
  from the right, with the same motion as the menu (D-079): State and Category as lists with their counts, the chosen
  ones ticked, and Clear. Choosing a row applies it (the page's links, as today) and closes the panel.

## Needs
None.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
| 2026-10-08 | 2 | "I don't want both the regions and categories to pin but just the region. In phone, when the user scrolls down the filter panel changes to a circular button of the icon only. Rest approved, move onto next" | only the state row pins; on phones the Filter bar shrinks to a round icon button once scrolled; approved as D-084 |
