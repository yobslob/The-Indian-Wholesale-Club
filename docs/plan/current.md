# Where things stand

Short on purpose: **replace** this page when something changes, don't append. The history up to 2026-10-11 (every
phase's sub-steps and every verification run) is in `docs/archive/status-log-to-2026-10-11.md`; `git log` has the rest.

## Built
- **Storefront, admin, app, vendor accounts:** everything in the coding plan (C1 – C8), the pilot steps, the design pass
  (B1 – B8, D-079 – D-098) and vendor accounts (V1 – V6, D-102 – D-105). Production runs on Vercel + Supabase
  (us-east-1) since 2026-10-06; the Android app is built by EAS.
- **Pilot pricing (D-119, 2026-10-14):** two recipes. Clothing and home & gifts: (shop ₹ ÷ 0.90 + g ÷ 100 × ₹146) ÷
  rate, ÷ (1 − margin), the margin easing on dear pieces (clothing 50% → 38%, home 60% → 45%). Food: (shop ₹ + ₹15) ×
  1.10 + billed kg × the courier rate card over a 5 kg parcel, × 1.25. A profit guard lifts any price whose margin can't
  pay US duty and the card fee and leave a minimum profit. Below $149.99 a bag pays Shipping $18.79 + Retailer charges
  $1.99; from $149.99 up they show $0.00 and a bulk saving (10% of the amount over the line, up to $25) comes off, shown
  in the bag, checkout and the free-delivery bar (web and app). Settings has every number and a profit check.
- **Import from shops (D-110, 2026-10-12):** `/admin/import` with the Add to IWC bookmark, pasted links, the review
  form, re-import to update price and sizes, "Order it online" on the pickup cards (web and app) (`admin.md` §Import from shops).
- **Home and header (D-113, 2026-10-12):** Home runs hero → the album of all of India (the states' drifting mosaic)
  → Pick your home → Just listed; the header's Search is a visible pill first in the links that grows into a search
  bar on scroll.
- **Made-to-order pilot (D-115, 2026-10-12):** no cycles or cutoff; delivery is today + 12 – 18 days (Settings →
  Standard delivery); a standard order needs no cycle and its pieces go on the pickup list at once.
- **Saved addresses at checkout (D-114, 2026-10-12):** signed in, checkout offers the saved addresses (default filled
  in) and a paid order saves its address to the account.
- **Polish pass (D-116, 2026-10-12):** the free-delivery pill with a glowing meter (web and app), the add-to-bag
  flight and Added state, velocity drift on grids and rows, heading reveals, section pills that follow the reader,
  smooth Details, the app's gliding tab marker; layouts unchanged.
- **Fixes after launch check (D-117, 2026-10-12):** the pill's bar fills sideways; phones get Search in the header (Saved
  in the menu); no sideways bleed, no album fade, the footer ends every page; info links open the glass panel on
  Vercel again (the panel routes render on request).
- **Food (D-110):** the product type `spice` is now `food` (page `/food`; `/spices` redirects).
- **Auto-sourcing and the weekly check (D-118, 2026-10-13):** targets (`/admin/import/auto`, added from the state
  bestseller CSV); `tools/sourcing-runner` on a PC in India searches Blinkit, Zepto, Instamart, BigBasket, Amazon,
  Flipkart, Myntra, Oyela, Nishorama and Offduty, adds listings that reach the hub within 3 days with every variant
  (colour, flavour, type, pack, size, each with its own price) and backup sources, and re-reads every sourced listing
  weekly (price, stock, cheapest source; jumps held for an admin). The bookmark import keeps variants and prices too.
- **Small food on $1.99 – $3.99, Publish all drafts (D-120, 2026-10-14):** food up to ₹200 and 250 g is priced on the
  steps $1.99 / $2.99 / $3.99 (half its shipping share; Settings → Small food shelf, with the profit check); Products →
  Drafts has **Publish all drafts** (every draft with a photo, an option and a piece to sell; it reports the rest).
- **All-India listings, Myntra ₹600 – ₹1,600, home weights (D-121, 2026-10-14):** a listing's state is optional (none
  shown; it fills every state's page after the state's own, at `/states/india/<slug>`); targets take shops, a price band
  and their own number of listings; the Myntra clothing list (79 targets, `tools/sourcing-runner/targets/`); home &
  gifts without a weight priced from its shop price (a ₹200 basket $17.99, not $62.29).
- **Food by weight, footwear, cards, See all, food list (D-122, 2026-10-14):** food carries 70% of its courier (200 g
  $3.99, 400 g $8.49, 1 kg $20.49); footwear at 600 g; pack size on food cards; the type switch on See all; New arrivals
  is the state's own; `tools/sourcing-runner/targets/food-by-state.csv` (753 targets).
- **No bag loses (D-125, 2026-10-14):** every piece carries its whole cost again (bhujia 400 g $11.29, 1 kg $27.49;
  small masalas $1.99 – $3.99); Shipping below $149.99 is at least $18.79 and more when a bag's pieces cannot pay for
  its parcel; free from the line up. D-123 / D-124's food weight is retired.

- **Courier ₹2,000 a kg, food band, .69 (D-126, 2026-10-15):** the courier at ₹2,000 a kg all in; clothing 42%, home
  50% (prices about the same); food packed at 110% and priced 17–20% on its cost (masala $4.29, bhujia 1 kg $31.29);
  endings .29/.49/.69/.79/.99. Shipping still keeps every bag whole: heavy food bags past $149.99 pay some Shipping.

- **Beta pricing (D-127, D-128, 2026-10-15):** every automatic price is the founder's exact rules, (shop ₹ ÷ 0.90 +
  g × ₹2) ÷ 0.80 food / 0.60 clothing / 0.50 home ÷ ₹92, to the cent, fixed in code; the full formula is archived
  (`docs/archive/pricing-full-formula.md`) and returns when `beta_pricing` is set false. Products → **Download Excel**
  exports name, Indian price, category, weight, US price and margin for the page's view.

- **Weights you can trust (D-129, 2026-10-15):** every option's weight says where it came from (weighed, typed, the
  shop's page, a matching item); a listing cannot go live while an option has no weight (its price would be a guess);
  the importer and the runner read weights properly ("1,000 g", "Pack of 2", Amazon's packed weight) and clothing now
  gets the weight its page states; `pnpm sourcing run` ends by finding missing weights on the listing's own pages,
  then Amazon and Flipkart (two must agree); Products shows a Weight column and **Weights to check**.

- **Weighing at the hub (D-130, 2026-10-15):** a weight box next to every Picked (cycle cards and order page, web and
  app) and "Weigh it" under a picked piece; the scale's weight becomes the option's weight (weighed), the listing is
  repriced and the card says what changed. Pilot orders (no cycle) can now be marked picked on their order page.

- **See all pages cached (2026-10-15):** `/clothing`, `/food` and `/home-and-gifts` with their filters are served from
  the cache like the state pages (rewrites to `app/(store)/see-all/…`; the addresses are unchanged); `/clothing` went
  from 61 – 169 ms (twice over the 100 ms budget) to 7 – 13 ms.

- **Weight estimator (D-131, 2026-10-15):** `pnpm weights run` on the founder's laptop gives every option without a
  weight a packed weight from a local model on the GPU (Ollama, `qwen2.5:7b`), part by part, with a second look and
  the most similar known weights (weighed at the hub first); about 1 s a listing. Sure ones become weights (source
  "Estimated"), the rest are suggestions in Weights to check, filled in the weight box; `--audit` flags a shop's weight
  it doubts; shop pages and the hub's scale replace estimates; `pnpm weights eval` measures it against known weights.
  Since D-132 it weighs food and home & gifts only.
- **Clothing by class (D-132, 2026-10-16):** every clothing option gets the founder's weight for its class (light
  350 g incl. gamosas, kaftans, dresses and skirts; medium 750 g; pants, jeans and footwear 800 g; heavy 1.5 kg;
  source "Clothing class"), sorted by name rules (sets before single pieces), then the category, then the model.
  The hub's scale wins, then an admin's weight, then the class. Every sourcing run sorts the clothing not yet sorted
  (after the deploy: all of it); `pnpm weights classes` on the laptop also sorts the names no rule reads, with a CSV
  to review. Weights are for pricing only: customers never see one.
- **Food by its net weight (D-133, D-135, 2026-10-16):** every food option is priced on the net quantity its label
  states, unit by unit ("100 g (Pack of 3)" is 300 g; many were priced as one), no packaging (D-135 removed D-133's
  pack; source shown as "Net weight on its label"). The hub's scale wins, then an admin's weight (a typed weight can
  no longer replace a weighed one), then this. The runner weighs new food this way when it adds it and each run works
  out the food not yet done; on production all 1,146 options were rewritten to their net weight the same day.
  Customers see the net quantity ("Net quantity" in Details, web and app; the card's pack size).
- **Liquids are not sent (D-135, 2026-10-16):** the runner checks every food and home listing once (new ones as it
  adds them, the rest at the end of each run, `pnpm sourcing liquids`); a liquid (juice, sharbat, soda, oil, syrup,
  attar, anything sold by the ml; never pickles) is archived and shown to customers as **coming soon**: no price, the
  heart instead of Add. Products → Archived marks it; its page can hide it or show it again.
- **Home & gifts from their own pages (D-134, 2026-10-16):** the capture now reads Amazon's "Product details" dropdowns
  (Item details, Measurements); every run (and `pnpm sourcing home`) reads each home option's own page: the packed
  weight as stated, else the piece's weight plus its packing by material (fragile, flat art, textiles, the rest),
  each checked against its box size and the listing's other packs; impossible readings go to the hub, not into a
  price. The hub's scale, then an admin, come first. Customers never see a home weight; each box's weight by size is
  kept for Q-36 (does the courier bill by size?).

## Next for the founder
1. Run the Deploy workflow: it applies the new migrations (the latest is `20261016200000_coming_soon`) to
   production. Then `pnpm sourcing liquids --dry` (the 16 liquids found on 2026-10-16: juices, sea buckthorn pulp, a
   soda, coconut and kernel oils, a sharbat, kokum agal, three attars, two ghees sold by the ml) and
   `pnpm sourcing liquids`; say whether ghee and honey sold by the litre count as liquids (D-135 says yes). Pull the
   code on the hub PC before its next `pnpm sourcing run` (an older runner adds D-133's packaging to new food).
   Home (D-134): `pnpm sourcing home --dry` writes `tools/sourcing-runner/home-weights.csv`; then
   `pnpm sourcing home` (40 listings a go; repeat, or let each `pnpm sourcing run` do it). Answer Q-36 with the
   courier. Food is done (D-135: every option on its net weight). Confirm with the courier that ₹2,000 includes the
   box and clearance, and whether it bills by box size; correct Settings → Courier rate card if not.
2. Done 2026-10-16: all 339 live clothing listings (2,993 options) have their class weight (`pnpm weights classes` on
   production; none had a weight before; the old values are in `tools/weight-estimator/clothing-classes-before.jsonl`).
   New clothing is sorted by each `pnpm sourcing run`, or alone by `pnpm sourcing classes` (no shops, nothing added).
   Two runners at once (after the Deploy workflow, migration `20261016120000_runner_by_type`): one terminal
   `pnpm sourcing run --type clothing --shops nishorama.com`, another `pnpm sourcing run --type food`. Clothing
   listings sourced on other shops (Myntra) are then re-checked only by a plain `pnpm sourcing run --checks`.
   The clothing runner needs Nishorama targets: Admin → Import → Auto-sourcing → Add targets from a CSV with
   `tools/sourcing-runner/targets/nishorama.csv` (18 targets reading its collections, about 450 pieces); raise
   "targets per run" if a run should take more of them. The first try (2026-10-16) was refused by Nishorama (429) and
   marked all 18 "nothing fit": after the deploy, Auto-sourcing → Nothing fit → **Search all again**, then run again
   (the runner now reads Shopify through its browser tab, waits out a 429, and puts a failed target back).
   Kids' and baby sets are medium (750 g) since the founder's answer the same day (35 listings, 646 options).
   Clothing drafts held for a missing weight (D-129) can now be published (Products → Drafts → Publish all drafts). Then
   home & gifts: `pnpm weights run --dry --limit 20`, read the estimates, `pnpm weights run` (food is D-133's now; the
   estimator only suggests for food no label states). Decide whether a sure estimate may price a live home listing
   without an admin's look (D-131 lets it).
   At the hub, weigh each piece as it is marked picked (one piece, packed, in grams). On the hub PC: `pnpm sourcing run --weights` (repeat: 40 listings a run) to read the weights drafts lack (food's net quantity becomes its packed weight in the same run); then
   Admin → Products → **Weights to check**: weigh what is left (tick "weighed"), starting with live listings.
   Customers see food's net quantity (D-133); clothing and home weights stay admin-only (D-132).
3. Then Admin → Products → Drafts → **Publish all drafts**; it says how many went live, what held the rest and how
   many still lack details customers see (fibre and care, ingredients and allergens).
4. Replace the D-119 / D-120 estimates in Settings with real bills (one courier invoice, one duty bill): the per-parcel
   cost, US duty by type, the food fee, parcel kg, billed weight, the small-food limits and share; watch the profit
   check (a bag of only $2.99 packets past $149.99 loses money, D-120).
5. Toward 3,000 listings: Admin → Import → Auto-sourcing → Add targets from a CSV with
   `tools/sourcing-runner/targets/myntra-600-1600.csv` (all states, Myntra, ₹600 – ₹1,600); check Myntra's delivery
   days under Shops (3 or less, or nothing is added); try one first: `pnpm sourcing try "kurta set women" --type
   clothing --shops myntra.com --min 600 --max 1600`; raise targets per run (79 targets) and keep `pnpm sourcing run`
   daily on the hub PC. Then the same with `food-by-state.csv` (753 food targets, specialties first).
6. Clear the 2,880 placeholder listings: `pnpm demo:clear … --allow-remote`, then with `--apply` (`ops.md`).
7. Decide: the name "Food" and 5 pieces per size by default (D-110 proposals); D-118's proposals (3 listings per
   target, the 60% rise / 50% fall guard, drafts until published, 40 targets a day); D-120's proposals (₹200, 250 g,
   half the shipping share); D-105's vendor-screen drafts; the four men house models (D-104); Q-35 (US stores).
8. Before launch: Q-3 (US carrier), Q-9 (domain and support email), Q-32 (holding a piece while paying).

## Last verification
| Date | Commit | Where | Result |
|---|---|---|---|
| 2026-10-16 | D-135 commit | Claude Code, founder's Windows machine with Docker | `check.mjs` all nine steps OK (db from a fresh reset: 52/52 SQL test files incl. new `coming_soon.test.sql`: worker only, a liquid archived and shown as coming soon, no options to buy, its photos, card and See all marked, a checked listing not checked again, putting it on sale ends it, a plain archived listing hidden); shared unit tests 263 incl. new `liquids.test.ts`. In the browser on `next dev` with a local demo drink made coming soon: its page says "Coming soon" with the heart and no Add, its See all card the heart and "Coming soon" instead of the price, no console errors. On production: `pnpm weights food --all` wrote 1,146 food options to their net weight (a second dry run: nothing left); a read-only liquid preview found 16 liquids in 1,072 listings. **Not run:** the liquid check on production (needs the migration), the app on a phone. |
| 2026-10-16 | D-134 commit | Claude Code, founder's Windows machine with Docker | `check.mjs` all nine steps OK (db from a fresh reset: 51/51 SQL test files incl. new `home_weights.test.sql`: worker only, home only, never over weighed or typed, a similar weight never over a page's own, repriced, no home weight or net quantity in the store, the runner's packed home weight kept; build, http, e2e, bundle OK); shared unit tests 266 incl. new `home-weights.test.ts`. `pnpm sourcing home --dry` against production (before the deploy, through D-129's plan; nothing written): 35 home listings missing a weight, 65 options, 147 pages read on Amazon, Flipkart and Blinkit with none failed; 42 options weighed (35 from their own page, 7 from another option's or two matching items), 23 state no weight (mostly Blinkit pooja items), the rest marked for the hub (fragile pieces, a weight impossible for its box, packs out of order). **Not run:** writing on production (needs the migration), the 66 unrecorded and 12 estimated home weights (read after the deploy), the importer with a real Amazon page. |
| 2026-10-16 | D-133 commit | Claude Code, founder's Windows machine with Docker | `check.mjs` all nine steps OK (db from a fresh reset: 50/50 SQL test files incl. new `food_weights.test.sql`: worker only, food only, never over weighed or typed, net quantity kept, repriced, not replaced by shop pages or estimates, a typed weight refused over a weighed one, `net_qty` in the store without forbidden keys, the runner's packed weight kept; e2e OK; build, http, bundle OK); after a last fix docs, typecheck, lint, test (shared 257 incl. new `food-weights.test.ts`, 26) OK again. `pnpm weights food --dry` read production (before the deploy, through the estimator's plan; nothing written): 940 food listings, 1,684 options in 16 s; about 1,100 get a packed weight, 586 state no net quantity. **Not run:** writing on production (needs the migration), the app on a phone, the runner's add path on live shops, a hub weighing of food. |
| 2026-10-16 | D-132 commit | Claude Code, founder's Windows machine with Docker | `check.mjs` all nine steps OK; after the founder's review (gamosa, kaftan, dresses and skirts light; all weight fields in the forbidden store keys) docs, typecheck, lint, test (class tests 58) and db (48/48) OK again (db from a fresh reset: 48/48 SQL test files incl. new `clothing_classes.test.sql`, 16 assertions: class weights, never on food or a weighed or typed option, repriced, not replaced by shop pages or estimates; e2e 23/23). Shared unit tests incl. new `clothing-classes.test.ts` (53: real Myntra and catalogue titles per class). The rules sorted 299 of 301 real Myntra titles (the other two, a Patiala and a pattu pavadai, after a fix); on the local database `pnpm weights classes` sorted all 278 demo clothing listings in 12 s (249 by name, 22 by category, 7 fabrics by the model) and wrote 4,374 options. **Not run:** against production. |
| 2026-10-15 | D-131 commit | Claude Code, founder's Windows machine with Docker, RTX 4060 | `check.mjs` all nine steps OK (db from a fresh reset: 47/47 SQL test files; http `/clothing` 19 ms; e2e 23/23; bundle OK). Shared unit tests incl. new `estimate.test.ts` (14), db 47/47 SQL test files (new `weight_estimates.test.sql`, 22 assertions; `weigh_at_hub` now checks a second weighing keeps the sizes `similar`). The estimator on the local database (577 demo listings made real for the test): 120 listings in 121 s, 8 at once (3.4 s a listing with Ollama as installed), 97% of options sure, written and read back; Weights to check and the product page show the suggestion and a doubted shop weight in the browser. Its estimates look right for common pieces (kasavu saree 550 g, Pathani suit 480 g, kurta 230 g); it was wrong and sure on some regional sets (a Bikaner poshak 230 g, a bridal kasavu counted as its blouse only, Kota Doria fabric by the metre 1.55 kg). **Not run:** against production, `eval` (no weighed items yet), the app. |
| 2026-10-15 | See all cached | Claude Code, founder's Windows machine with Docker | build OK (the three See all pages pre-built); http three runs in a row OK (`/clothing` 7, 8, 13 ms; was 61 – 169 ms); e2e 23/23 (incl. rows: See all by state and category, 24 then 48 cards; sold-out on cached pages); bundle OK. Filters, Show more, invalid filters, canonicals and a 404 for an unknown type checked with curl on `next start`. |
| 2026-10-15 | D-130 commit | Claude Code, founder's Windows machine with Docker | typecheck (incl. the app), lint, test, docs: OK; db from a fresh reset: 46/46 SQL test files (new `weigh_at_hub.test.sql`: hand-set price kept, $34.62 → $41.87 on a reweigh, sizes follow, typed weights kept, admins only). In the browser on local e2e pilot orders: Picked with 820 g, then Picked and Weigh it 950 g ("listed 820 g, +16%"). Then build OK; http first `/clothing` 169 ms (budget 100; it renders on each request, unchanged since before D-129), e2e 22/23 (Stripe's test payment stalled after Pay, no error); re-run: http OK (`/clothing` 61 ms), e2e 23/23. **Not run:** the app on a phone (its screens only typechecked). |
| 2026-10-15 | D-129 commit | Claude Code, founder's Windows machine with Docker | docs, typecheck, lint, test (shared 150 incl. new `weight.test.ts`, and `pricing-band`/`pricing-beta`, which the test script had skipped), db (fresh reset, 45/45 SQL test files incl. new `weights.test.sql`), build, bundle: OK. http first 153 ms on `/clothing` (budget 100), e2e 21/23 (the admin flow published a listing without a weight, refused by design; fixed the test; checkout hung at "Checking your bag" once); re-run of http and e2e alone: OK, 23/23. The Weights to check tab, the Weight column, the weight forms (all sizes, weighed) and the publish refusal checked in the browser on two local test listings (removed). **Not run:** the runner's weight step against live shops, the app build. |
| 2026-10-15 | D-128 commit | Claude, cloud sandbox | all 61 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 44/44 SQL test files (`pricing_engine`: the founder's example $4.23 and table; new `price_sheet`: admins only, the cheapest option, tabs and search) · unit tests shared 133/133, web 40/40 (new `price-sheet`: the six columns, 20/40/50 margins, a valid zip) · a sample sheet opened in openpyxl and LibreOffice · tsc shared, db, web clean · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. |
| 2026-10-15 | D-127 ₹92 | Claude, cloud sandbox | all 59 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 43/43 SQL test files (`pricing_engine`: the beta at ₹92, unmoved by the day's rate) · unit tests shared 132/132 · tsc shared, db, web clean · every profit-check sample bag profitable (the least: one masala, +$2.09) · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. |
| 2026-10-15 | D-127 exact cents | Claude, cloud sandbox | all 58 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 43/43 SQL test files (`pricing_engine`: the beta to the cent) · unit tests shared 132/132 (`pricing-beta`: each type exactly at its margin) · tsc shared, db, web clean · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. |
| 2026-10-15 | D-127 commit | Claude, cloud sandbox | all 57 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 43/43 SQL test files (`pricing_engine` with the beta formula) · unit tests shared 132/132 (new `pricing-beta`), web 37/37, app 10/10 · tsc shared, db, web clean; app no new errors against the sandbox baseline · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. |
| 2026-10-15 | D-126 commit | Claude, cloud sandbox | all 56 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 43/43 SQL test files (`pricing_engine` with the band, the .69 ending and the founder's table) · unit tests shared 129/129 (new `pricing-band`: the band, every sample bag profitable), web 37/37, app 10/10 · tsc shared, db, web clean; app no new errors against the sandbox baseline · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. |
| 2026-10-14 | D-125 commit | Claude, cloud sandbox | all 55 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 43/43 SQL test files (`bag_charges` with the parcel rule; mutation-checked) · unit tests shared 124/124 (no sample bag loses, also with food at 30%), web 37/37, app 10/10 · tsc shared, db, web clean; app no new errors against the sandbox baseline · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. |
| 2026-10-14 | D-124 commit | Claude, cloud sandbox | unit tests shared 124/124 (the D-124 rule), web 37/37, app 10/10 · tsc shared, db, web clean; app no new errors against the sandbox baseline · 43/43 SQL test files (no SQL change) · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. |
| 2026-10-14 | D-123 commit | Claude, cloud sandbox with the founder's `node_modules` (no Docker) | all 54 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 43/43 SQL test files pass (`bag_charges` with the food weight) · unit tests shared 124/124, web 37/37, app 10/10 · tsc shared, db, web clean; app no new errors against the sandbox baseline · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. Run `node scripts/check.mjs` before pushing. |
| 2026-10-14 | D-122 commit | Claude, cloud sandbox with the founder's `node_modules` (no Docker) | all 53 migrations + seeds on plain Postgres 16 with the Supabase stand-in: 43/43 SQL test files pass (new: `food_cards`) · unit tests shared 123/123, web 37/37, app 10/10 · tsc shared, db, web, runner clean; app no new errors against the sandbox baseline · both target CSVs read with no errors · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build. Run `node scripts/check.mjs` before pushing. |
| 2026-10-14 | D-121 commit | Claude, cloud sandbox with the founder's `node_modules` (no Docker) | all 52 migrations + seeds applied on plain Postgres 16 with the Supabase stand-in: 42/42 SQL test files pass (new: `all_india`; mutation check: reordering the state's page fails it) · unit tests shared 122/122, web 37/37, app 10/10 · tsc shared, db, web and runner clean; the app shows no new errors against the sandbox's baseline (no React Native types there) · docs audit OK. **Not run:** ESLint with the Next plugin, `next build`, e2e, http, the app build, a run at the hub (Myntra's price filter in the search address is untested; results are checked against the band anyway). Run `node scripts/check.mjs` before pushing. |
| 2026-10-14 | D-120 commit | Claude, cloud sandbox with the founder's `node_modules` (no Docker) | all 51 migrations + seeds applied on plain Postgres 16 with the Supabase stand-in: 41/41 SQL test files pass (new: `publish_drafts`; `pricing_engine` with the shelf) · shared unit tests 117/117 · tsc shared, db and web clean. **Not run:** ESLint (its Next plugin does not load in the sandbox), `next build`, e2e, http, the app. Run `node scripts/check.mjs` before pushing. |
| 2026-10-14 | D-119 commit | Claude, cloud sandbox with the founder's sources and type definitions (no Docker, no npm) | all 49 migrations + seeds applied on plain Postgres 16 with the Supabase stand-in: 39/40 SQL test files pass (`customer_messages` needs Supabase Vault, absent there; it fails the same without D-119), `pricing_engine` fails as it should when the guard is removed (mutation check) · shared unit tests 113/113 · tsc shared clean; db, web and app show no new errors against the same sandbox's baseline (its missing Supabase and NativeWind types leave known errors in both) · docs audit OK. **Not run:** ESLint, `next build`, e2e, the app bundle, a real Supabase reset. Run `node scripts/check.mjs` before deploying. |
| 2026-10-13 | D-118 commit | Claude, cloud sandbox with the founder's `node_modules` (no Docker, no shop access) | tsc web/db/shared/runner clean · unit tests shared 106/106 (auto-sourcing 20), web 37/37 · all 48 migrations + seeds applied and 40/40 SQL test files passed on plain Postgres 16 with a Supabase stand-in · the page readers run in the founder's browser on live Amazon, Flipkart, Myntra, Blinkit and BigBasket pages · `pnpm sourcing try` started and logged each shop (no shop reachable from the sandbox). **Not run:** `next build`, ESLint with the Next plugin, e2e, a full run at the hub, Zepto and Instamart pages. Run `node scripts/check.mjs` before pushing. |
| 2026-10-12 | b4df0f0 + uncommitted (D-117 fixes) | Claude Code, founder's Windows machine with Docker | docs 1.4s, typecheck 18.0s, lint 24.1s, test 2.7s, db 88.8s, build 80.4s, http 3.2s, bundle 17.5s: OK. e2e first 18/23 (a leftover `next start` of Claude's on port 3000 served the old build while `.next` was rebuilt, so checkout hung at "Checking your bag"); re-run alone on a free port 150.7s, 23/23 OK. No route over budget (11 – 57 ms, 123 – 132 KB). |

## Known leftovers
- App bundle ids are still `com.indianwholesaleclub.app` (`apps/app/app.json`); they change with the domain (Q-9).
- `supabase/config.toml` uses the deprecated `[inbucket]` section (a harmless CLI warning).
