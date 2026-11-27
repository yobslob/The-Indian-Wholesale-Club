# Recipe photos (D-214)

Finds a photo for every drafted recipe on the founder's computer, through a photo library's own API:
- **Pexels** (the default, free): a free key; its licence lets a business use the photos without paying or crediting.
- **Magnific Stock** (formerly Freepik, `--source magnific`): spends the account's paid API credits. The website's own
  pages are not read: downloading its stock without the API would go round what Magnific charges for.

Nothing here writes to the photo store or the database: the run ends with a folder of photos named by recipe, and
**Admin → Recipes → Add photos by name** is the push.

## Once
1. Get a free Pexels key: https://www.pexels.com/api/ (sign up, then **Your API key**). For Magnific: API → Dashboard.
2. Write it in `tools/recipe-photos/.env` (not in git):
   ```
   PEXELS_API_KEY=your-key
   MAGNIFIC_API_KEY=your-key   (only for --source magnific)
   ```

## Each run (from `C:\kod\root`)
| Command | What it does |
|---|---|
| `pnpm photos:recipes --limit 20` | a first try: 20 recipes, to check the picks before spending more credits |
| `pnpm photos:recipes` | every recipe in `catalogue/recipes-drafts-*.json` without a photo in `out/` yet |
| `pnpm photos:recipes --only samosa,pav-bhaji --again` | these recipes again (another pick replaces the file) |
| `pnpm photos:recipes --term "{name} snack"` | other search words (`{name}` is the recipe's name; default `{name} indian food`) |
| `pnpm photos:recipes --source magnific` | Magnific Stock instead of Pexels (paid credits) |

For each recipe it searches photos (Magnific: without people), takes the result whose title (Pexels: its description)
holds the most of the dish's words, then the most downloaded, then a square or wide frame (`pick.mjs`), and saves it
at 1,500 px as `out/<slug>.jpg`. It carries on where the last run stopped. Pexels allows 200 searches an hour and
20,000 a month (the runner waits when told to); Magnific spends credits. A wrong key, an empty balance or a plan
without the API stops the run at the first recipe.

- `out/credits.csv`: each photo's source, id, title, author, page and licence. Keep it: a Magnific freemium photo asks
  for credit to its author; Pexels and a Magnific premium plan do not.
- `out/not-found.txt`: the recipes with no photo of the dish (try `--term`, or a photo of your own).

## The push
Open **Admin → Recipes → Add photos by name**, choose every `.jpg` in `tools/recipe-photos/out/` and wait for the list.
Each file goes to the recipe its name names, as two AVIF copies, and a live recipe's page refreshes. **It replaces a
recipe's earlier photo**, so first delete from `out/` the files of recipes that already have a photo of your own.
Look through the folder before the push: the pick is by title, and a title can be wrong about a dish.

Test: `node --test tools/recipe-photos/pick.test.mjs`.
