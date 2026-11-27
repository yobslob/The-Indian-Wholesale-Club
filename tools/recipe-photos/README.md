# Recipe photos (D-214)

Finds a good-looking photo for every drafted recipe on the founder's laptop, and its credit:
- **Openverse** (the default, free, no key): the open-source search over openly licensed photos, most from Flickr and
  Wikimedia Commons. Only licences that allow a shop's use are asked for: CC0, the Public Domain Mark, CC BY and CC BY-SA
  (never NC or ND). CC BY and BY-SA ask for credit: each photo's title, author, page and licence go to `credits.csv`
  and, pushed with the photos, to the recipe page under the photo.
- **The GPU picker** (`judge.mjs`): the laptop's vision model (Ollama, `qwen3-vl:8b-instruct`, the label reader's) looks
  at each dish's best four results and keeps the best-looking one that shows the dish as the main subject, with no
  people, text, logo or clutter. A recipe whose photos all score under the floor gets none.
- Other sources, without the picker: **Pixabay** (`--source pixabay`, a free key; its image links refuse quick
  downloads, so one photo every 15 s), **Pexels** (`--source pexels`, new keys paused since 2026-11), **Magnific
  Stock** (`--source magnific`, paid API credits; its website is never read instead).

Not built (founder asked, 2026-11-27): a scraper of Google, Bing or Pinterest results. Those photos belong to their
photographers, and a store selling the ingredients would use them commercially without leave.

Nothing here writes to the photo store or the database: the run ends with a folder of photos named by recipe and
`credits.csv`, and **Admin → Recipes → Add photos by name** is the push.

## Once
1. Ollama with the vision model (already there for the label reader): `ollama pull qwen3-vl:8b-instruct`.
2. Only for the other sources, their keys in `tools/recipe-photos/.env` (not in git): `PIXABAY_API_KEY=…`,
   `PEXELS_API_KEY=…`, `MAGNIFIC_API_KEY=…`.

## Each run (from `C:\kod\root`, Ollama running)
| Command | What it does |
|---|---|
| `pnpm photos:recipes --limit 20` | a first try: 20 recipes, to look at the picks |
| `pnpm photos:recipes` | every recipe in `catalogue/recipes-drafts-*.json` without a photo in `out/` yet (about 50 s each: all 925 take about 13 hours; it carries on where it stopped) |
| `pnpm photos:recipes --only samosa,pav-bhaji --again` | these recipes again (another pick replaces the file; delete the old file first when you want none) |
| `pnpm photos:recipes --look 6` | show the model more photos a recipe (slower, sometimes better) |
| `pnpm photos:recipes --no-judge` | without the model: the result whose title and tags hold every word of the dish, most downloaded first |
| `pnpm photos:recipes --term "{name} curry"` | other search words (`{name}` is the recipe's name) |

Each recipe prints what the model said of every photo it saw (its score, or x: not the dish, one dish of several, or
under the floor) and the one kept. Openverse allows 1,000 searches a day: past that the run stops and the next day's
carries on. Settings: `IWC_PHOTO_MODEL` (default the label reader's model), `OLLAMA_HOST`.

- `out/credits.csv`: each photo's source, id, title, author, page and licence.
- `out/not-found.txt`: the recipes with no good photo of the dish (try `--look 6`, `--term`, or a photo of your own).

## The push
Open **Admin → Recipes → Add photos by name** and choose every `.jpg` in `tools/recipe-photos/out/` **and
`credits.csv`**. Each photo goes to the recipe its name names, as two AVIF copies, with its credit (the list shows it);
a live recipe's page refreshes. **It replaces a recipe's earlier photo**, so first delete from `out/` the files of
recipes that already have a photo of your own. Look through the folder before the push: the model can be wrong.

Tests: `node --test tools/recipe-photos/pick.test.mjs tools/recipe-photos/judge.test.mjs`.
