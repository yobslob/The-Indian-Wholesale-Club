# Catalogue: the local test data

The six launch regions (Delhi, Punjab, Rajasthan, Assam, Maharashtra, Kerala, D-059) as listings with their colours, sizes
and pack sizes: the local database's test catalogue (`supabase/seed/catalogue.sql`). Nothing here goes to production.

**Real listings** come from Indian online shops through the admin's Import from shops page (D-110) and the sourcing
runner, not from here.

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
  belong to. The descriptions are Claude-written drafts in the founder's voice rule (`docs/storefront.md` §Voice).
- **Placeholders** (`is_placeholder = true`, D-012): prices, pieces in stock, the shop, the colours on offer and the
  sizes. Placeholders show only in demo mode (`dev_preview`), which is development.
- **Pantry items are drafts:** they are in the admin Catalog, not on the store.

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
