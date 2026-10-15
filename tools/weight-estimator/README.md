# Weight estimator (D-131)

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
pnpm weights run --dry --limit 20    look first: 20 listings, every estimate printed, nothing written
pnpm weights run                     every option with no weight, never estimated before
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
