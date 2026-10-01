# Catalogue: the launch regions' listings and their photos

The six launch regions (Delhi, Punjab, Rajasthan, Assam, Maharashtra, Kerala, D-059) and every item from
`docs/iwc-live-regions-catalogue.md`, as listings with their colours, sizes and pack sizes.

## Adding photos (on your machine)

1. Make the folders once (and again after adding items): `pnpm catalogue:folders`
   This creates `catalogue/photos/<region>/<product>/` for every listing, plus `catalogue/photos/<region>/_region/`.
2. Drop photos in (`.jpg`, `.jpeg`, `.png`, `.webp`):
   - **A product:** `catalogue/photos/kerala/kasavu-saree/`. Photos show in file-name order and the first one is the
     main photo, so name them `1-main.jpg`, `2-front.jpg`, `3-back.jpg`, `4-closeup.jpg`.
   - **Alt text** (what a screen reader says; required for accessibility): an `alt.txt` in the same folder, one line
     per photo: `1-main.jpg: Kasavu saree with its gold border, spread out on the grass`. Photos without a line get
     "<product name>, photo 2 of 4", which is better than nothing but not good.
   - **A region:** `catalogue/photos/kerala/_region/`. The first photo is the region's main photo; the rest go into its album (the
     sliding mosaic on the region page, shown once there are three). Album photos get alt text from `alt.txt` too.
3. Load them into your local store: `pnpm dev:photos`. Running it again replaces a product's photos with what's in
   its folder.

The photos folder is **not in git** (it would get huge). Keep your own backup of `catalogue/photos/`.
For the hosted site, upload through the admin (Catalog → a product → Photos; Regions → a region).

## Changing the listings

Each region is a file in `catalogue/data/` (`delhi.mjs`, …). One line per listing:

```js
c('Kasavu saree', 'sarees', 'kasavu', 'free', 'Off-white cotton with the gold kasavu border.', { launch: 1 })
p('Chammanthi podi', 'pickles-and-chutneys', 'small', 'Dry roasted coconut chutney powder.')
```

`c(...)` is clothing (name, category, colours, sizes, one line for the card, extras), `p(...)` is pantry (name,
category, pack sizes, line, extras). Colour, size and pack sets are in `sets.mjs`; you can also write your own list,
e.g. `['Red', 'Green']`. Extras: `launch` (the region's launch-pick order: launch picks are the newest, and the first
four are Curated for you), `from` (town, admin only, never shown), `tier` (`premium` or `bridal` for the placeholder
price band).

Then `pnpm catalogue` rewrites `supabase/seed/catalogue.sql`, and `pnpm catalogue:apply` loads it into your local
database without a reset (same listings, photos and pieces kept). Commit the data file and the seed together;
`check.mjs docs` fails if they differ.

## What is real and what is a placeholder

- **Real (from the catalogue):** the items, their names, the one-line descriptions, the categories, and which region they
  belong to. The descriptions are Claude-written drafts in the founder's voice rule (`docs/design.md` §Voice).
- **Placeholders until shops are signed up** (`is_placeholder = true`, D-012): prices, pieces in stock, the shop,
  the colours on offer and the sizes. Placeholders show only in development (`dev_preview`), never in production.
- **Pantry items are drafts:** spices cannot go live until the FDA question is settled (D-032, Q-10). They are in
  the admin Catalog, not on the store.

## Left out, and why

| Item | Why |
|---|---|
| Oxidised silver jewellery (Delhi), silver payal (Punjab), Rajputi jewellery set, Assamese gohona (gamkharu, jonbiri, dholbiri and the rest), Kerala temple jewellery and vadamalar jhumkas, Kolhapuri saaj, nath | Gold and silver jewellery is a separate product type and a founder decision (catalogue appendix) |
| MDH masalas, and shop names in product names (Chitale, Laxmi Narayan, Maganlal, Kayani, Kanwarji, Chaina Ram, Ghantewala, LMB, Gore Bandhu, Budhani) | The store never names shops (D-003). The products themselves are in, under their own names (Puneri bakarwadi, Pune poha chivda…). No brand names (D-061) |
| Pashmina and Kashmiri shawls (Delhi), Kashmiri aari-work suits (Punjab) | Made in Kashmir: they belong on Jammu and Kashmir's page, not Delhi's or Punjab's (D-004) |
| Kolhapuri chappals under Delhi | Made in Maharashtra; they are on Maharashtra's page |
| Khari Baoli dry fruits (Delhi) | Almonds, dates and figs are traded in Delhi, not grown there (D-004) |
| Thrift / export-surplus finds (Delhi) | Second-hand, no steady supply to list |
| Dilli Haat pan-India handloom | A market with a new stall every fortnight, not a product |
| Ichalkaranji, Bhiwandi, Malegaon textiles | Towns and industries, not products |

Items loved in one state but woven in another (Lucknowi chikan under Delhi; Ilkal, Narayanpet and khun under
Maharashtra) are in, and their description says where they are made. They stay on that state's page (D-060).
