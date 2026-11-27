# Plan: Cook at home, recipes with a one-tap kit (handoff for the next agent)

*Built on 2026-11-23 (D-203); D-204 changed it the same day: Home's arches gave way to a Cook at home row, a recipe publishes without a photo and with the cheapest listing by default (Publish all), 100 more recipes (`catalogue/recipes-101-200.csv`) and dry swaps for fresh herbs. Where this plan and D-204 differ, D-204 holds. On 2026-11-25 the founder asked for 300 more (§7: `catalogue/recipes-201-500.csv`).*

*Written 2026-11-23 by Claude from the repo at `main` (da3f727) and the founder's idea of the same day; updated the same
day with the founder's answers to §10 (now binding, folded into every section). Status: **nothing built.** Read all of
it, then `CLAUDE.md`. The 100 dishes are in `catalogue/recipes-100.csv` (§7). Each phase ships alone and leaves the store working. The mockups (Home's
windows on a phone and a desktop, the recipe shelf, a recipe page with its kit, the admin editor) are on the founder's
design canvas: https://claude.ai/artifact/QM5mp4Q6YRaUqF2v68QKVK. §4 describes them in words, so the canvas is a
picture of this plan and not a second source of rules.*

The founder, verbatim (2026-11-23), to be filed with `/record-answer` as the next D-number before Phase 1:
> "The idea is that most people find indian dishes and snacks expensive in cafes and restaurants so they decide to make it
> themselves, now they find different things in different stores and then the recipe on the web, instead Our IWC will
> show an option of a tasty looking snack or dish or some prospect fitting this description, then when they click on it
> they get the recipe and which will give option of adding the items in a bundle. I want to add it in the windows
> section, so clothing window on the left, snacks window on the right instead of middle, and whatever you design of this
> will be in the middle."

His answers to §10's questions, verbatim (2026-11-23), to be filed with it (one D-entry for the idea and its answers):
> "1. three is good, middle one is the main one. 2. yeah 3. find the most loved, most search and most famous 100
> dishes/snacks/items fitting this description all over india, and put them. 4. I will add them acc to their names once
> you add their names, no ai label. 5. we have to do the thing that we were doing with the strike through products, we
> have to apply that to every single bundle/kit. 6. nothing start unticked, we will add products that we dont have from
> the reciepe but blinkit does. 7. yes"

---

## 1. The idea in one paragraph

A customer who wants pav bhaji at home today hunts the masalas across three stores and the recipe on a blog. IWC puts
both on one page. Home's middle window shows a tasty dish with what its kit costs; a tap opens the recipe; the recipe
page lists the pantry pieces IWC sells (ticked, with their live prices) and the fresh things to buy locally (listed, not
sold); one button puts the ticked pieces in the bag as ordinary lines. Nothing about pricing, checkout or shipping
changes: a kit is a shortcut to products the store already sells.

## 2. The rules (binding; each cites where it comes from)

1. **Windows:** three, Clothing left, Cook at home middle, Snacks right; **the middle one is the main one** (founder,
   answer 1): about a third wider than the others (`1fr 1.32fr 1fr` at every width), about 10 % taller, a soft shadow,
   a filled brand button where the others have outline buttons. It replaces "Get snacks from your neighbourhood" (Pick
   your home stays further down Home and the hero keeps its States door). Until at least one recipe is live, Home keeps
   today's three windows exactly as they are (ship dark).
2. **Every kit is struck through** (founder, answer 5, the D-190 rule): wherever a kit price shows (the window, the
   shelf's cards, the kit card, the sticky bar, More to cook) the struck figure stands beside it: the kit's price × food's
   factor (`wasCents(kit, 'food')`, 1.2), drawn through `Money` with `wasOf="food"` so abroad it is worked out from the
   shown price (D-198). Display only: never charged, stored or sent to Stripe. The kit's rows show each piece's price
   plain (the struck figure belongs to the kit); a piece's own card elsewhere keeps its own offer rule. The same FTC
   caution the founder accepted for struck products (D-140) applies to kits.
3. **No other price changes** (non-negotiable 5, D-140 rule 0.2): a kit's price is the sum of its ticked pieces' current
   store prices. No kit SKU, no kit line in the bag, no change to Shipping, the free line, the bulk saving or coupons.
   The bag and checkout treat kit pieces like any other piece. Checkout still re-prices on the server (D-038).
4. **Only what we can send:** a recipe line is either **IWC** (a dry pantry item, mapped to a live food variant) or
   **local** (fresh produce, dairy, oil, ghee, eggs, meat, anything liquid: D-135 says liquids are not sent). Local lines
   are listed under "From your local store" with an amount and no price, link or photo. **Every IWC line starts ticked;
   there are no optional lines** (founder, answer 6). **A pantry item IWC doesn't list yet is sourced from Blinkit**
   (answer 6): §5.6's pantry list.
5. **No operations info** (non-negotiable 1, D-003, D-017): recipe reads go through new `store_*` functions that expose
   the same customer-safe columns the cards already show. No shop, source, shop price or billed weight in any recipe
   payload or page source.
6. **Honest** (D-004, D-008): a recipe's state is shown only when it has one ("All of India" otherwise, like an
   all-India listing, D-121). Delivery says "7 – 12 delivery days" from Settings' food days (non-negotiable 4), never a date.
   **Dish photos are the founder's, with no AI label** (answer 4): he adds them by the dish's name (§5.3).
7. **Words are drafts** (D-012, D-019, D-059): every recipe's name, line, ingredient amounts and steps are Claude's
   draft (`content_status = 'draft'`) until the founder approves them in the admin. The voice rule applies: short, plain,
   frank, no "authentic", "rich", "vibrant", "aromatic journey". A recipe can't go live with unapproved words. The
   window's words are approved as drafted (answer 7): "Cook at home", "<dish> kit", "Get the recipe", "Recipe's on us."
8. **Speed and limits** (non-negotiable 6, D-011, D-145): recipe pages are cached store pages like product pages; their
   client parts stay small; every refresh is narrow; any commit that adds page-cache writes or database size says so.
9. **Abroad** (D-197, D-198): every price on a recipe page and in the window goes through `Money`/`useMoney`
   (`apps/web/features/shell/market.tsx`); the free-delivery line stays in `$`.
10. **Mobile web first** (D-190): design and test at 390 px first; the app follows later (§9).

## 3. What the code already has (checked)

| Fact | Where |
|---|---|
| The three arches are data: `ARCHES` (clothing, snacks, nearby) with kicker, lead, big, `cents`, href, tone, art, cta, tag, slot | `apps/web/features/home/homecoming-hooks.ts` |
| The arches are server-drawn; `HomecomingArches()` takes no props today; tones `pumpkin`, `olive`, `paper` are written out in `TONE` (Tailwind keeps only whole class names) | `apps/web/features/home/homecoming-windows.tsx` |
| Window drawings (`kurta`, `cone`, `india`), the arch shape and the pumpkin | `apps/web/features/home/homecoming-art.tsx` |
| Window colours under `.hc` (`.hc-arch--paper` is the cream one, brand-coloured words) | `apps/web/app/globals.css` |
| Each window has a founder photo slot (`homecoming-clothing`, `homecoming-snacks`, `homecoming-nearby`); an empty slot shows the drawing | `apps/web/features/visuals/slots.ts` |
| Home is one cached `store_home()` call; `HomecomingArches` sits right under the hero | `app/(store)/page.tsx`, `getHome` in `packages/db/src/store/index.ts` |
| The bag lives on the device (zustand, persisted as `iwc-cart`); `add(line, qty)` merges by variant and caps at `MAX_QTY_PER_LINE`; a line needs variant and product ids, names, slugs, region, label, `unitPriceCents`, `imagePath`, `productType` | `apps/web/features/cart/store.ts` |
| Cards build that line with `bagLine()`; the fly-to-bag animation exists | `apps/web/features/catalog/card-options.ts`, `apps/web/features/cart/fly-to-bag.ts` |
| A store read hides placeholders outside dev: `not p.is_placeholder or public.dev_preview()` | `supabase/migrations/20261111090100_subcategories_popular_packs.sql` |
| Admin edits refresh only their own pages (D-145) | `apps/web/features/admin/refresh-listings.ts` |
| Admin search for a listing, reusable as a picker | `apps/web/features/admin/quick-find.tsx` |
| Photos go to R2 as two AVIF copies with an `s/` path (D-141) | `apps/web/lib/photo-store.ts` |
| Product URLs | `packages/shared/src/domain/product-path.ts` |
| Sitemap data | `apps/web/app/sitemaps/sitemap-data.ts` |
| The docs audit fails on an unlisted storefront route, an undocumented table or function, a missing backticked path, or an undefined D/Q id | `scripts/docs-audit.mjs` |

## 4. The design (what the canvas shows)

### 4.1 Home's windows
- **Order:** Clothing (pumpkin) · **Cook at home (paper, the cream tone)** · Snacks (olive). Same arch shape, garland
  and hover as today; the row stays three across at every width (D-177). The middle window is the main one: columns
  `1fr 1.32fr 1fr`, the row's items aligned to the bottom so the middle stands about 10 % taller, a soft drop shadow,
  its button filled in the brand colour.
- **The middle window** shows the dish the admin pinned to Home (§5.3):
  - kicker "Cook at home";
  - the dish photo in the arch's top (the same place the founder's photos sit), falling back to slot
    `homecoming-recipes`, then to a new line drawing `kadai` (a kadai with three wisps of steam);
  - lead "<dish> kit" when the name is 12 characters or fewer, else "the whole kit"; big = the kit price through `Money`,
    the kit's struck figure small beside it (rule 2);
  - button "Get the recipe"; a paper chit "Recipe's on us." (the snacks window keeps "Sorry for being this good.");
  - on wide screens only, the dish name in Cinzel and "<one line> · <state>" under the photo;
  - the whole window links to `/recipes/<slug>`; its accessible name reads "Cook pav bhaji at home: recipe and kit,
    $8.97".
- Phones keep the side windows near today's 1 : 1.56 (D-183); the middle one is wider and taller as above, and its words
  must fit at 340 px. `e2e/home-hero.spec.ts` must still pass.

### 4.2 `/recipes`, the shelf
Header kicker "Cook at home", heading "What you'd order out, made in your kitchen", one line ("The recipe is free. The
masalas and dals come from India, all in one tap. You bring the onions."). Chips: All · Snacks · Breakfast · Dinner ·
Sweets · Chai & drinks (only kinds with a live recipe show). A two-column grid of recipe cards: photo (4 : 5) with the
time on it, name (Cinzel), "<state> · serves n", "~~$y~~ **Kit $x** · n pieces" (rule 2). A small "How a kit works" card at the end
(open a dish, untick what you have, add the rest; food arrives in 7 – 12 delivery days). Chips filter without a reload
(D-136), through `?kind=`.

### 4.3 `/recipes/<slug>`, a recipe
Top to bottom on a phone:
1. Dish photo, full width, about 300 px; no caption.
2. Chips: the state (links to its state page) and the kind. Name (Cinzel, 30 px). One line. Three facts: Time, Serves,
   Effort (easy, medium, weekend).
3. **The kit from IWC** card: "7 – 12 delivery days" (Settings); "Untick what's already in your kitchen."; one row per IWC
   line: checkbox (44 px target), the listing's photo, its name, "<pack> · uses <amount>", its price, "Other packs" when
   the product has more than one live variant (opens the existing option sheet). A row already in the bag shows the
   card's − n + instead of a checkbox (D-140). Every line starts ticked. An unavailable line shows "Not available right
   now", unticked and disabled. Under the rows: "n pieces" and the struck figure beside the total (rule 2), then the
   free-delivery gap line
   computed like the bag's ("$x more and delivery is free."), then **Add n pieces to bag**. After adding: "In your bag.
   Happy cooking." with View bag.
4. **From your local store**: a dashed card, two columns of "<thing> · <amount>", one line saying fresh things, butter
   and oil are left to the store down the road.
5. **Method**: numbered steps in cards, each with its minutes as a chip; a "Cook mode" toggle that keeps the screen on
   (Screen Wake Lock API; hidden where unsupported).
6. **More to cook**: a sideways row of other recipes (same kind first, then same state).
7. A sticky bar at the bottom: "<dish> kit · n pieces", the struck figure and the total, Add to bag (it hides once the kit card is on screen,
   like the product page's buy bar).

### 4.4 Admin → Recipes
A list (one pager, D-140) with status, words approved or not, kit health, On Home. The editor (desktop, works on a
phone): photo (its file name shown; set by Add photos by name or by hand), name, slug, state (or All of India), kind,
minutes, soak hours, serves, effort, the one line, steps; an ingredients table (ingredient, amount, IWC or Local, the
listing in the kit with its status and price, or "Not on IWC yet · on the Blinkit pantry list", Change / Pick a
listing); the kit price with its struck figure; buttons **Match listings again**, **Approve the words**, **Publish**, and an
**On Home's window** switch. A kit-health strip on top says what blocks publishing.

## 5. How it is built

### 5.1 Data (one migration, e.g. `20261124090000_recipes.sql`, any date after the newest)
- **`recipes`**: `id`, `slug` (unique), `name`, `region_id` (null = All of India), `kind`
  (`snacks|breakfast|dinner|sweets|drinks`), `blurb`, `minutes`, `soak_hours` (null), `serves`, `effort`
  (`easy|medium|weekend`), `photo_path` (R2 `s/` path, null), `steps` (jsonb array of
  `{text, minutes}`, checked by a constraint for shape), `status` (`draft|live|archived`), `content_status`
  (`draft|approved`), `home_rank` (int, null = not on Home), `sort`, `is_placeholder`, `created_at`, `updated_at`,
  `published_at`.
- **`recipe_ingredients`**: `id`, `recipe_id` (cascade), `sort`, `label`, `amount` (text, "2½ tbsp"), `source`
  (`iwc|local`), `product_id` and `variant_id` (null; `on delete set null`; a check that local lines have neither; an
  IWC line's listing must be a food listing), `match_words` (text, the search words used to suggest a listing, and the
  row's search words on the pantry list), `grams_used` (numeric, null; for §8's later cost-per-plate line). No
  optional flag: every IWC line is part of the kit.
- RLS on both: admins read and write (`is_admin()`); no customer select. Indexes on `recipe_ingredients(recipe_id)` and
  `(product_id)` (the refresh lookup in §5.4).
- **Store functions** (security definer, the `store_*` pattern, placeholders as the rule in §3):
  - `store_recipes(p_kind text default null)`: live recipes with approved words and at least one available IWC line:
    card fields plus `kit_cents` and `kit_count` (available IWC lines). The struck figure is not stored or sent: the
    page draws it from `kit_cents` (rule 2).
  - `store_recipe(p_slug text)`: one recipe and its lines. An IWC line carries exactly what `bagLine()` needs (variant
    and product ids, product name and slug, region slug and name, variant label, price in cents, primary photo path,
    product type, pack) plus `available` and `option_count`; nothing else from the product.
  - `store_home()` gains `recipe`: `{slug, name, blurb, region_name, photo_path, kit_cents}` for the live recipe with the
    lowest `home_rank` that `store_recipes` would show, else null. Keep the addition small: Home is cached once.
  - Admin functions for publish checks and matching go in `packages/db` admin queries as the admin's other writes do.
- **Publish rule (in the database, not only the form):** live needs approved words, a photo, at least one IWC line, and
  every IWC line on a live, active food variant (a line still waiting for its Blinkit listing holds the recipe back). Later breakage (a listing archived or sold out) doesn't unpublish:
  the line shows unavailable, the kit price drops it, and Today lists the recipe under a new attention item "Recipes
  with a missing piece".
- `packages/db`: zod schemas and typed queries (`getRecipes`, `getRecipe`, the `recipe` field on `HomeData`), cached
  readers beside `getHomeCached` in `features/catalog/data.ts`.
- Local seed: four placeholder recipes (`is_placeholder = true`) on the demo catalogue, for dev and e2e.

### 5.2 Shared logic (`packages/shared`, pure, unit-tested)
A small recipe-kit module: the kit total, its struck figure (`wasCents(total, 'food')`, the existing function in
`packages/shared/src/domain/pricing.ts`) and count from lines and ticks; turning a store line into a `CartLine`; the
merge rule for **Add**: a ticked line not in the bag goes in with quantity 1; a line already in the bag is left as it is
(never doubled); unavailable lines are skipped. The window's lead text rule (≤ 12 characters).

### 5.3 Admin (`apps/web/features/admin/recipes/…`, route `app/admin/(panel)/recipes`)
- List and editor as §4.4. The listing picker reuses `quick-find.tsx`, limited to live food listings.
- **Match listings:** for each IWC line without a listing, suggest live, in-stock food listings whose names contain its
  `match_words` (and its category when given), cheapest first; the admin ticks one. Never auto-publishes.
- **Add drafts from a file:** upload a JSON file of drafted recipes (§7); it creates draft recipes and runs Match.
- **Add photos by name** (founder, answer 4): the founder picks many image files at once (JPEG, PNG, WebP or AVIF)
  named by each dish's slug from `catalogue/recipes-100.csv` (`pav-bhaji.jpg`, `chicken-biryani.png`). Each file goes to
  the recipe with that slug (letter case, spaces and underscores ignored), through `photo-store.ts` (two AVIF copies in
  R2, no original kept, D-141), replacing any earlier photo. The page then lists what matched and which files matched no
  recipe. Batches of a few files a call (D-146). A photo can also be set by hand in the editor.
- **On Home's window:** one recipe at a time sets `home_rank = 1` (others cleared); a second pinned one is a later idea.
- Publishing, unpublishing, editing a live recipe and changing On Home refresh: the recipe page, `/recipes`, Home
  (when the recipe is on Home or the kit price shown there changes) and the sitemap. Nothing else.
- Today: the "Recipes with a missing piece" count with a link.

### 5.4 Storefront (`apps/web/features/recipes/…`)
- Routes `app/(store)/recipes/page.tsx` and `app/(store)/recipes/[slug]/page.tsx`: static, cached, built from the
  store functions; `generateStaticParams` for live recipes; not-found for anything else.
- Client parts only where needed: the kit card (ticks, total, Add, the − n + rows, fly-to-bag once from the button) and
  Cook mode. The method, local list and shelf are server-drawn. First-load JS ≤ 150 KB (`check.mjs http`).
- **Prices stay fresh:** extend `refresh-listings.ts` so a listing change also refreshes the recipe pages that use it
  (one lookup on `recipe_ingredients.product_id`, capped like the rest of D-145) and Home when the Home recipe uses it.
  The checkout re-price stays the safety net.
- **Search engines:** schema.org `Recipe` JSON-LD on each recipe page (name, image, totalTime, recipeYield,
  recipeIngredient from every line, recipeInstructions from the steps); recipes in the sitemap. People search "pav bhaji
  recipe" far more than "pav bhaji masala"; this is the feature's free traffic.
- Site search: not in this plan (§8).

### 5.5 Home's windows
- `homecoming-hooks.ts`: a `recipeArch(recipe)` that builds the middle window from `store_home().recipe`; `ARCHES`
  becomes clothing, recipe, snacks when a recipe exists, else today's clothing, snacks, nearby. New `Art` value
  `kadai`; the middle window uses tone `paper`.
- `homecoming-windows.tsx`: `HomecomingArches({ recipe })`, the recipe photo in the arch top through the store's photo
  component (AVIF `/media/s/…`, sized for the arch, `fetchpriority` low), the slot as fallback.
- `homecoming-art.tsx`: the `kadai` drawing. `slots.ts`: `homecoming-recipes` with its brief ("a plate of the dish on a
  home kitchen counter, top half of the frame"). `globals.css`: only what the dish photo and the wide-screen name need.
- `app/(store)/page.tsx`: pass `home.recipe`.

### 5.6 The Blinkit pantry list (founder, answer 6)
- After the drafts are in (§7), every IWC line that Match can't fill from a live listing goes on a sourcing list. Claude
  writes it as a target CSV for the runner, tools/sourcing-runner/targets/recipe-pantry.csv (new), in the same columns as
  `tools/sourcing-runner/targets/food-quick-shops.csv`: one row per distinct pantry item across all 100 recipes (not per
  recipe), name "Pantry: <item>", type `food`, the item's IWC category, region `all`, Shops `blinkit`, a narrow Must
  match on the item's words that leaves out dairy, liquids, frozen food and meat as D-200's list does, a ₹ band and a
  small Listings count (3 – 5: we need the item, not a shelf of it). A unit test beside the other target tests checks
  every row parses and no row matches a liquid.
- Before writing it, Claude asks the founder for a recent Products → Download Excel (or a food export) so the list
  holds only what IWC doesn't already sell; without one, it lists every pantry item and Match drops the ones already
  live.
- The founder adds it through Admin → Import → Auto-sourcing → Add targets from a CSV and runs the food runner as usual
  (`docs/ops.md` §Tools). New listings go through the usual weights and photo work (D-168, D-202), then
  **Match listings again** on the recipes fills their lines.

### 5.7 Docs in the same commits (the audit checks most of these)
`docs/storefront.md` (Home's order, the two routes, the recipe page section, the voice), `docs/data-model.md` (both
tables, the three functions, the publish rule, invariants), `docs/product.md` glossary (**recipe**, **kit**, **IWC line**,
**local line**), `docs/admin.md` (Recipes, Today's new item), `docs/monitoring.md` §1 if the budgets need a line, the new
D-entry and open questions (§10) through `/record-answer`, `docs/status.md` (replace, don't append).

## 6. Phases

| Phase | What | Done when |
|---|---|---|
| 0 | File the founder's words as the next D-number; add §10's questions to `docs/questions.md` | docs audit OK |
| 1 | Migration, store functions, publish rule, SQL tests, `packages/db` queries, local placeholders, shared kit module with unit tests | `check.mjs db test typecheck` OK |
| 2 | Admin: list, editor, picker, Match, drafts from a file, photos, publish, On Home, Today's item, refreshes | an admin can build, approve and publish a placeholder recipe locally; `admin.spec.ts` gains it |
| 3 | `/recipes` and `/recipes/<slug>`, kit card, Cook mode, JSON-LD, sitemap, listing-change refresh | e2e below passes; ≤ 100 ms cached, ≤ 150 KB JS |
| 4 | Home's windows swap, ship dark until a recipe is live | `home-hero.spec.ts` and the new window spec pass at 390, 340 and 1280 px |
| 5 | All 100 recipes drafted (§7) in five files of 20, and the Blinkit pantry list (§5.6), handed to the founder to import, photograph and approve on production | the founder has the files and the steps |
| 6 | Full verification on the Windows machine (`node scripts/check.mjs`), `status.md` updated, the founder runs the Deploy workflow for the migration | every step OK or explained |

**Tests to add:** a new SQL test file, recipes.test.sql, beside the others in supabase/tests (customers can't read the tables; store functions hide drafts,
unapproved words, archived and placeholder recipes outside dev; an unavailable line drops out of `kit_cents`; publish
refuses a recipe without a photo, words or a mapped required line; local lines can't carry a listing; `store_recipe`
returns no shop, source or shop price columns; an IWC line can't point at a non-food listing). Unit tests for the kit
module (the struck figure is the total × 1.2). e2e `recipes.spec.ts`: Home's middle window is the widest and opens the
recipe; every line starts ticked; the kit total and its struck figure agree in the window, the card and the page; untick
one line, Add, the bag count and lines match the ticked rows; Add again doesn't double;
an unavailable line is skipped; `?market=ca` shows CA$ in the kit and its struck figure and `$` on the free line; Cook
mode button present.
`a11y.spec.ts` covers both new pages.

## 7. The 100 recipes (Phase 5)
- **The list is chosen** (founder, answer 3: "the most loved, most search and most famous 100"): `catalogue/recipes-100.csv`,
  researched 2026-11-23. Columns: `rank`, `slug` (the recipe's address and **the photo's file name**), `name`, `kind`,
  `state` (a region's name, or All of India where the dish belongs to no one state or its home is disputed, such as
  rasgulla), `signal` (why it is on the list), `iwc_pantry` (the dry items a kit needs, as search words) and `local`
  (what the customer buys locally). Sources behind `signal`: Swiggy's How India Swiggy'd 2025 (biryani the most ordered
  dish for the tenth year, then burgers, pizza and dosa; idli the top breakfast; gulab jamun the top quick dessert; chai
  three times other drinks), Google's Year in Search India 2024 and 2025 (idli, modak, thekua and kanji in 2025;
  shankarpali in 2024), TasteAtlas' 2025 rankings (butter garlic naan, Amritsari kulcha, butter chicken, Hyderabadi
  biryani, shahi paneer, dal makhani, phirni, misal pav, paratha, chole bhature, parotta, palak paneer, shrikhand,
  tandoori chicken, tikka), what US Indian restaurants sell most (biryani, butter chicken, tikka masala, samosa, saag
  paneer, garlic naan, korma, mango lassi), and the best-known street food of each state. Burgers, pizza and cakes are
  left out: they are not Indian dishes and IWC has nothing special for them.
- **Mix:** 41 dinner, 22 snacks, 17 breakfast, 15 sweets, 5 drinks; 18 states and All of India. The founder may swap any
  row; the slug then changes with it.
- **Drafting:** Claude drafts all 100 as JSON for Add drafts from a file, in five files of 20 (ranks 1 – 20 first), at
  catalogue/recipes-drafts-1.json to -5.json (new). Each draft: name, kind, state, one line, minutes, soak hours, serves,
  effort, ingredients (label, amount, IWC or local, `match_words`), steps. The `iwc_pantry` and `local` columns are the
  starting point; every liquid, fresh, dairy or meat ingredient is local (rule 4). Amounts and steps follow well-known
  home versions of each dish; nothing regional is invented (D-012), and all of it stays a draft until approved.
- **The founder:** imports each file, adds photos named by slug (§5.3), checks the matches, approves the words,
  publishes, pins one to Home. The agent never writes to the hosted database (CLAUDE.md).
- **300 more** (founder, 2026-11-25: "give me 300 more recipes/snacks/kits that fit the description"): Claude's picks,
  `catalogue/recipes-drafts-11.json` to `-25.json` (ranks 201 – 500, 20 a file), listed in `catalogue/recipes-201-500.csv`
  with the same columns. Dishes and states the first 200 left out (30 states and All of India; Lakshadweep, Mizoram,
  Tripura and Nagaland new among them), same rules: D-204's dry swaps, local lines for anything fresh, dairy, oily,
  meaty or liquid, words drafts until approved. Pantry items they need that the Blinkit list lacked were added to it
  (cloves, masoor dal, ragi flour, jowar atta, makhana and 27 more).
- **425 snacks** (D-213, founder 2026-11-27: "Find 500 more most loved snacks recipe", then "fill the 306 more with
  popular variants"): Claude's picks, `catalogue/recipes-drafts-26.json` to `-47.json` (ranks 501 – 925), listed in
  `catalogue/recipes-501-925.csv`. Ranks 501 – 694: every well-known Indian snack the first 500 left out (pakoras and
  vadas, chaats and street food, namkeen and chips, the coasts' fries and cutlets, kebabs and tikkas, Indo-Chinese
  starters, fasting snacks). Ranks 695 – 925: the popular variants menus sell under their own names (paneer, chicken and
  kurkure momos; kathi rolls; fish, mushroom and egg 65; soya chaap four ways; samosa pav, cheese vada pav). 75 short of
  500: past these, variants are invented combinations. One new pantry row (methi khakhra).

## 8. Later (not in this plan; founder decides)
A "about $x a plate" line from `grams_used` and each pack's net quantity; recipes in site search; recipe rows on state
pages; a recipe link on a pantry product's page ("Make pav bhaji with this"); kits in the Android app; counting kit adds
in Insights; seasonal recipe windows (Diwali sweets, Holi thandai); "Ask for it from home" (`product.md` Later ideas).

## 9. The app
Unchanged in this plan. The app reads the same backend, so a later pass can add the shelf and the recipe page there.

## 10. The founder's answers (2026-11-23; were questions R-1 – R-7)

| # | Question | Answer (binding) |
|---|---|---|
| R-1 | Three windows or four? | Three; the middle one is the main one (rule 1) |
| R-2 | The name "Cook at home" and `/recipes`? | Yes |
| R-3 | Which dishes? | The 100 most loved, searched and famous across India: `catalogue/recipes-100.csv` (§7) |
| R-4 | Dish photos? | The founder adds them by the dish's name; no AI label (§5.3, rule 6) |
| R-5 | A kit discount? | Every kit struck through by the struck-products rule (rule 2) |
| R-6 | Optional lines unticked? | Nothing starts unticked; missing pantry items come from Blinkit (rule 4, §5.6) |
| R-7 | The window's words? | Approved as drafted (rule 7) |

Still open, ask when convenient (add to `docs/questions.md` in Phase 0): which recipe goes on Home first (until he picks,
the live recipe with the lowest rank in the CSV); whether a kit that includes a piece already struck on its own card
should show that piece's struck price in its row too (until he says, rows are plain, rule 2).
