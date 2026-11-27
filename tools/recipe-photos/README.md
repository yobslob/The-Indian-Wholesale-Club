# Recipe photos (D-214)

Finds a photo for every drafted recipe on the founder's computer, through a photo library's own API:
- **Pixabay** (the default, free): a free key; its Content License lets a business use the photos without paying or
  crediting. Its API rules are kept: searches cached for a day (`out/.cache`), one search a second at most, only the
  picked photo downloaded, and kept on our own store (never hotlinked).
- **Pexels** (`--source pexels`, free): new keys are paused (2026-11); usable only with a key already issued.
- **Magnific Stock** (formerly Freepik, `--source magnific`): spends the account's paid API credits. The website's own
  pages are not read: downloading its stock without the API would go round what Magnific charges for.

Nothing here writes to the photo store or the database: the run ends with a folder of photos named by recipe, and
**Admin → Recipes → Add photos by name** is the push.

## Once
1. Get a free Pixabay key: sign up at https://pixabay.com, then open https://pixabay.com/api/docs/ (the key is shown
   under **Parameters → key** once logged in). For Magnific: API → Dashboard.
2. Write it in `tools/recipe-photos/.env` (not in git):
   ```
   PIXABAY_API_KEY=your-key
   PEXELS_API_KEY=your-key     (only with a key Pexels already gave)
   MAGNIFIC_API_KEY=your-key   (only for --source magnific)
   ```

## Each run (from `C:\kod\root`)
| Command | What it does |
|---|---|
| `pnpm photos:recipes --limit 20` | a first try: 20 recipes, to check the picks before spending more credits |
| `pnpm photos:recipes` | every recipe in `catalogue/recipes-drafts-*.json` without a photo in `out/` yet |
| `pnpm photos:recipes --only samosa,pav-bhaji --again` | these recipes again (another pick replaces the file) |
| `pnpm photos:recipes --term "{name} snack"` | other search words (`{name}` is the recipe's name; default `{name} indian food`) |
| `pnpm photos:recipes --source magnific` | Magnific Stock instead of Pixabay (paid credits); `--source pexels` for Pexels |

For each recipe it searches photos (Magnific: without people), takes the result whose title (Pixabay: its tags; Pexels: its description)
holds the most of the dish's words, then the most downloaded, then a square or wide frame (`pick.mjs`), and saves it
at 1,500 px as `out/<slug>.jpg`. It carries on where the last run stopped. Pixabay searches by its photos' tags, so a
regional dish often has none: the runner then searches the name alone, and what still has none goes to
`not-found.txt`. Pixabay allows 100 searches a minute (the runner makes one a second); Pexels 200 an hour;
Magnific spends credits. A wrong key, an empty balance or a plan
without the API stops the run at the first recipe.

- `out/credits.csv`: each photo's source, id, title, author, page and licence. Keep it: a Magnific freemium photo asks
  for credit to its author; Pixabay, Pexels and a Magnific premium plan do not.
- `out/not-found.txt`: the recipes with no photo of the dish (try `--term`, or a photo of your own).

## The push
Open **Admin → Recipes → Add photos by name**, choose every `.jpg` in `tools/recipe-photos/out/` and wait for the list.
Each file goes to the recipe its name names, as two AVIF copies, and a live recipe's page refreshes. **It replaces a
recipe's earlier photo**, so first delete from `out/` the files of recipes that already have a photo of your own.
Look through the folder before the push: the pick is by title, and a title can be wrong about a dish.

Test: `node --test tools/recipe-photos/pick.test.mjs`.
