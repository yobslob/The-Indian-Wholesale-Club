# search: the results page (website + app Explore search)

**Surface:** website `/search?q=` (where Enter in the header's search pill leads, D-079) + the search in app
`(customer)/explore` · **Code:** `apps/web/app/(store)/search/page.tsx` · **Status:** mockup, round 1

## The page's job
Answer "do you have …?" fast: matching states first, then pieces; never leave the visitor at a dead end.

## What it shows (D-067, store_search)
Heading · the search box with its button · States that match (name, greeting, tagline) · Products that match, 24 at a time
with Show more (D-067). The words are recorded for the admin's Insights, not who searched.

## Today (production, 2026-10-08)
- With results: heading, box, then the States and Products sections; nothing says how many came back.
- No results ("zzqx"): "No products match “zzqx”." and nothing else, a dead end.
- No words yet (`/search`): only the heading and the box, an empty page.
- Phones: the Search button takes a third of the row next to the box.

## Founder's direction (2026-10-08, asked as options)
"Count with the words", "No dead end on no results", "Something to start with", "Icon button on phones".

## Design (round 1)
Today's layout in the D-079 / D-080 fonts (headings in Syne, the rest in Karla, the + on every card), with:
- **Count:** under the box, "24 pieces for “saree”", or "1 state and 6 pieces for “kerala”" when states match too
  (draft wording, D-059).
- **No results:** today's message, then the open states (as search's own state cards) and the Just listed row.
- **No words yet:** the same two blocks under the box.
- **Phones:** the Search button becomes a round search icon inside the right end of the box.

## Needs
None (the count line is draft copy for approval).

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
