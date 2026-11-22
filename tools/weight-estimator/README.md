# Weight estimator (D-131), clothing classes (D-132) and food weights (D-133)

**Clothing is weighed by class (D-132):** `pnpm weights classes` gives every clothing option the founder's weight
for its class: light 350 g (headwear, jewellery, kurtis, plain kurtas, tops, salwar, gamosas, kaftans, dresses,
skirts), medium 750 g (light sarees, dupattas, potlis, heavier kurtas, dhotis, jackets, co-ords), pants, jeans and
footwear 800 g, heavy 1.5 kg (a kids' or baby set is medium)
(shawls, very heavy sarees, lehengas, sherwanis, any set). Name rules sort it
(`packages/shared/src/sourcing/estimate/classes.ts`), then its category, then the local model for a name neither
reads. Every listing goes in `clothing-classes.csv` (open it in Excel; "Look at it" marks the ones sorted by
category or by the model). Which weight wins: the hub's scale, then an admin's, then the class; the hub's scale
later replaces a class weight. Customers never see any of it: the weights are for pricing only. About 278 listings in 12 s. The estimator below weighs **food and home & gifts** only (food: what its label does not state, D-133; home: what no page states, D-134).

**Food weighs its label's net quantity (D-133, D-135):** `pnpm weights food` gives every food option the real weight
its label states (its option, its label, the shop page's reading, its name; "2 × 200 g" is 400 g; a litre of ghee
910 g), with no packaging. No model, no Ollama: about 1,000 listings in 4 s. Which weight wins: the hub's scale, then
an admin's, then this. An option whose net quantity nothing states keeps what it has. Every option goes in
`food-weights.csv` (net quantity, where it was read, the weight before and after); "Look at it" marks a weight that
moves by more than a third and an option with no net quantity. Customers see the net quantity.
```
pnpm weights food --dry     write the sheet only (works before the deploy too: it reads through the estimator's plan)
pnpm weights food           write each option's net weight and net quantity (the weights it replaces are kept in
                            food-weights-before.jsonl; needs migration 20261016160000 on the database)
pnpm weights food --all     work them all out again (after the rules change)
```

**Food labels and the price check (D-202):** about half the food listings had only an estimate, and an estimate from
similar names is often far off (Deepak Jau Sattu: 140 g estimated, 500 g on its label; priced $5.12 instead of $14.90).
Customers no longer see an estimate; these two give food its real weight.

`pnpm weights labels` reads the net quantity printed on each listing's own photos with a vision model on this GPU.
For each photo (its 1200-pixel copy, read through the site like any visitor; no R2 key):
1. the vision model is asked for the net quantity as printed ("500 g", "200 g x 2"), never a serving size or per 100 g;
2. where it sees one, every word on the photo is written out (the second reader) and read by the same rule as a shop
   page: only a number right after "Net Wt.", "Net Weight", "Net Quantity", शुद्ध भार, नेट वजन or कुल मात्रा;
3. a weight is written only when both agree (within 2%) and none of the checks holds it back; it goes in as the
   label's weight (source packed: shown and priced). Held back, on the sheet with why:
   - the listing may hold several packs: "combo", "twin pack", "2 pouches", or "Pack of 2" in the name that its
     option does not count (one pack's label would price it below cost: the first eval's main miss);
   - the name states another weight ("Coconut Chutney, 200 gm" with a 50 g sachet's label);
   - the price check doubts it: a kilo over 1.8 times dearer than similar labelled items (`LABEL_DEARER`, Q-62:
     the side a single pack's label falls on) or under a quarter.
It stops at the first photo that gives it (most listings: the second photo), leaves several sizes that share photos
alone (unless a photo is tagged with its option), and counts an option "Pack of 3" three times. Every photo's two
readings are kept in `.cache/label-readings.jsonl`: a second run (the eval after a check changes, `--all`) reads only
photos it has not seen, in seconds, with no GPU and no download.
```
ollama pull qwen3-vl:8b-instruct     once, about 6 GB (the plain qwen3-vl:8b tag is the slower "thinking" model)
pnpm weights labels --eval --limit 200
                    measure first: listings whose weight their own words state, with the checks a real run uses
                    (except the name's weight: these listings' known weights come from it). It says how many a real
                    run would write and how many of those differ from the known weight, and how many the checks
                    held back; label-eval.csv says why per listing. Write only when "a different one" is rare.
pnpm weights labels --dry --limit 200     the sheet label-weights.csv only (weight and price before and after)
pnpm weights labels                       every food listing not read yet (overnight; stop and start any time:
                                          read listings are marked); --all reads them all again
pnpm weights labels --dry --cached        the sheet and summary from the photos read so far (seconds, no GPU):
                                          what was read, held back and why, the drops over 40% to look at, how
                                          many listings are not read yet. Without --dry it writes those (minutes).
```
The sheet is rewritten after every 25 listings, so a run that stops keeps what it read, and a network blip from the
database is tried again for 8 minutes before the run gives up.
```
pnpm weights prices --dry                 the price check's sheet price-check.csv
pnpm weights prices                       write the corrections (estimates, not shown to customers)
```
Settings (optional): `IWC_LABEL_MODEL` (default `qwen3-vl:8b-instruct`; `qwen3-vl:4b-instruct` if 8 GB runs out),
`IWC_OCR_MODEL` (another model for the second reader, e.g. a small OCR model, so the two are more independent;
default the label model), `IWC_SITE_URL` (where photos are read; default the live site). Weights replaced are kept in
`label-weights-before.jsonl` and `price-check-before.jsonl`. Every written weight reprices the listing at once (D-128).
The price check (no GPU) learns what a kilo costs from options with a label, weighed or typed weight, finds the three
to seven labelled items most like each estimated one (the same words in the name, its category first), and replaces
an estimate that makes a kilo cost over twice or under half theirs with the shop's price ÷ their price a gram, rounded
to a pack size. Run it after the label reader, for what the photos could not give.

**Labels: speed.** The vision model fits the 4060's 8 GB only with Ollama answering one question at a time: with
`OLLAMA_NUM_PARALLEL=8` (set for `pnpm weights run`) Ollama keeps room for eight answers, a third of the model runs on
the CPU and a listing takes 100 – 200 s; at 2 it already spills. For a labels run, quit Ollama (tray icon → Quit) and
start it in a PowerShell window with one slot (the other two settings carry over), then run labels in another window:
```
$env:OLLAMA_NUM_PARALLEL=1; ollama serve
```
Close that window and start Ollama from the Start menu again for `pnpm weights run`. `labels` says `SLOW` after its
first listing when the model is not all on the GPU. It reads one listing at a time (the next photo downloads while
the GPU reads one; at most one photo a listing is downloaded and not read), and the transcription stops at the line
that states the net quantity (the first statement decides, so what follows changes nothing). Measured 2026-11-20, the
first 20 `--eval` listings: 57 s a listing at 8 slots (the slowest 285 s), **16 s** at one slot with the early stop,
the same verdict on every listing.


Gives every listing a realistic packed weight, on the founder's laptop GPU (RTX 4060, 8 GB), quickly enough for
thousands of listings. The price is worked out from the weight (D-128), so a guessed weight is a guessed price.

It signs in as the **worker** account (the sourcing runner's, never a service key), reads the listings whose options
have no weight, and for each one:
1. **Finds the most similar items IWC already knows** (weighed at the hub, typed by an admin, or stated on a shop's
   page), with a small embedding model (`nomic-embed-text`). Three near-identical ones that agree (the same piece in
   another colour, listed apart) give the weight at once, without asking the model.
2. **Asks a local model** (`qwen2.5:7b`) for one unit as shipped, **part by part** (kurta, pyjama, dupatta, then the
   packing; food's contents, then its jar), with a range it is 90% sure of. The code adds the parts up. The question
   shows the listing's name, fabric or material, size, description, its options (all sizes of the piece once, each
   pack on its own) and up to six of those known weights.
3. **Decides** (`packages/shared/src/sourcing/estimate/decide.ts`). The weight is **sure** when:
   - the range is within ±25%;
   - the similar known items (if there are some) are within 25% of it (then it meets them halfway);
   - it is not below a pack's stated net weight;
   - it is not far from its category's usual weight.

   A sure weight becomes the option's weight (source `estimated`): the listing is priced on it and can go live. Any
   other weight stays a **suggestion** in Products → Weights to check, filled in the box so Save weight accepts it.

It never changes a weight a person weighed or typed, or one a shop's page stated. A shop's page (the sourcing runner)
and the hub's scale (D-130) replace an estimate. Every estimate is kept (`weight_estimate_g`), also after the piece is
weighed, so `eval` can say how close it came. The more pieces the hub weighs, the better its references get.

## Setup (once)
1. **Ollama** (https://ollama.com, MIT): `winget install Ollama.Ollama`. It starts with Windows and uses the GPU.
   Then the three settings under **Speed** below, or it answers one listing at a time (3.4 s instead of 1.0 s).
2. **The models** (about 5 GB):
   ```
   ollama pull qwen2.5:7b
   ollama pull nomic-embed-text
   ```
3. **Settings:** the sourcing runner's `tools/sourcing-runner/.env` is read as well, so on a laptop that has it there
   is nothing more to write. Otherwise `tools/weight-estimator/.env` (not in git) needs `IWC_SUPABASE_URL`,
   `IWC_SUPABASE_ANON_KEY`, `IWC_WORKER_EMAIL` and `IWC_WORKER_PASSWORD`. Optional settings:
   - `IWC_WEIGHT_MODEL` (default `qwen2.5:7b`) and `IWC_EMBED_MODEL` (default `nomic-embed-text`);
   - `IWC_WEIGHT_PARALLEL` (default 4: how many listings are asked at once);
   - `OLLAMA_HOST` (default `http://127.0.0.1:11434`).
4. `pnpm weights doctor` checks Ollama, the models, a timed question and the sign-in.

## Run
```
pnpm weights classes --dry          clothing: write the sheet only, nothing in the database
pnpm weights classes                clothing: every option not yet sorted gets its class weight (the weights it
                                    replaces are kept in clothing-classes-before.jsonl)
pnpm weights classes --all          clothing: sort them all again (after the rules change)
pnpm weights classes --fast         clothing: rules and category only, no model
pnpm weights run --dry --limit 20    look first: 20 listings, every estimate printed, nothing written
pnpm weights run                     food and home: every option with no weight, never estimated before
pnpm weights run --redo              also re-estimate estimated weights (after many hub weighings)
pnpm weights run --audit             also compare the shops' weights (kept as estimates; big differences listed)
pnpm weights try "Banarasi silk saree with blouse piece" --type clothing --category Sarees
pnpm weights eval --limit 200        how close it comes to the weights IWC knows (each left out in turn)
```
It logs to the console and `estimator.log`. Embeddings are kept in `.cache/` (not in git), so a second run spends
its time on the model only. Stop it at any point: what it has written stays, and the next run carries on.

## Speed
Each listing is two questions (the careful one and the one-number second look), and `IWC_WEIGHT_PARALLEL` (default 8)
listings are asked at once. Ollama answers them together only when it is told to. Once, in Windows: Settings → System →
About → Advanced system settings → Environment Variables → New (user variables):
- `OLLAMA_NUM_PARALLEL` = `8`;
- `OLLAMA_FLASH_ATTENTION` = `1`;
- `OLLAMA_KV_CACHE_TYPE` = `q8_0`.

Then quit Ollama (tray icon → Quit) and start it again. `pnpm weights doctor` says whether it answers several at once.

Measured on the RTX 4060 laptop (2026-10-15, 120 listings, `qwen2.5:7b`):

| Ollama | Seconds per listing | 3,000 listings |
|---|---|---|
| as installed (one at a time) | 3.4 | about 3 hours |
| the three settings above, 8 at once | **1.0** (5.6 GB of the GPU's 8) | about 50 minutes |

Listings that three near-identical known items already agree on take no model time, so runs get faster as the hub
weighs more. Don't raise `OLLAMA_NUM_PARALLEL` past 8 on 8 GB: at 8 with leftover processes the model spilled to the
CPU and slowed to 12 s a listing. A smaller model (`IWC_WEIGHT_MODEL=qwen2.5:3b`) is faster and less careful: try it
with `eval` first.
