# Recipe photos (D-213)

Finds a photo for every drafted recipe in **Magnific Stock** (formerly Freepik), through Magnific's own API, on the
founder's computer. The founder has Magnific's permission for this (their office documents); the API key is theirs.
Nothing here writes to the photo store or the database: the run ends with a folder of photos named by recipe, and
**Admin → Recipes → Add photos by name** is the push.

## Once
1. Get an API key in your Magnific account (API → Dashboard).
2. Write it in `tools/recipe-photos/.env` (not in git):
   ```
   MAGNIFIC_API_KEY=your-key
   ```

## Each run (from `C:\kod\root`)
| Command | What it does |
|---|---|
| `pnpm photos:recipes --limit 20` | a first try: 20 recipes, to check the picks before spending more credits |
| `pnpm photos:recipes` | every recipe in `catalogue/recipes-drafts-*.json` without a photo in `out/` yet |
| `pnpm photos:recipes --only samosa,pav-bhaji --again` | these recipes again (another pick replaces the file) |
| `pnpm photos:recipes --term "{name} snack"` | other search words (`{name}` is the recipe's name; default `{name} indian food`) |

For each recipe it searches photos only, without people, takes the result whose title holds the most of the dish's
words (then the most downloaded, then a square or wide frame; `pick.mjs`), and saves it at 1,500 px as
`out/<slug>.jpg`. It carries on where the last run stopped. Each search and each download spends API credits; a wrong
key or an empty balance stops the run at the first recipe.

- `out/credits.csv`: each photo's Magnific id, title, author, page and licence links. Keep it: a free (freemium)
  photo asks for credit to its author; a premium plan does not.
- `out/not-found.txt`: the recipes with no photo of the dish (try `--term`, or a photo of your own).

## The push
Open **Admin → Recipes → Add photos by name**, choose every `.jpg` in `tools/recipe-photos/out/` and wait for the list.
Each file goes to the recipe its name names, as two AVIF copies, and a live recipe's page refreshes. **It replaces a
recipe's earlier photo**, so first delete from `out/` the files of recipes that already have a photo of your own.
Look through the folder before the push: the pick is by title, and a title can be wrong about a dish.

Test: `node --test tools/recipe-photos/pick.test.mjs`.
