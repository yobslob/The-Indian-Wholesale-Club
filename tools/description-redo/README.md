# Description redo (D-178)

Writes every listing's summary and description again on the founder's laptop (RTX 4060, 8 GB), with a local model
and no cloud service: new wording in the store's voice (`docs/storefront.md` §Voice), every product fact kept, none
added, and nothing a customer must never read (prices, MRP, offers, shops, sellers, brands, links, phone numbers,
shipping, returns, India logistics, emojis; D-003). Every new text passes deterministic checks before anyone sees it,
then the review page, then a publish that writes only where the listing's words are still the ones read. Nothing
runs on Vercel.

| Step | Command (from `C:\kod\root`) | Uses |
|---|---|---|
| 1. fetch | `pnpm descriptions:redo fetch --limit 500` (`--type food`, `--again`) | the database: a page of 25 listings per call |
| 2. make | `pnpm descriptions:redo make` (`--retry` the flagged, `--again` all not yet approved) | the GPU through Ollama |
| 1 + 2 | `pnpm descriptions:redo run --limit 2000` | fetches 100, writes them, the next 100, until the limit or the end |
| 3. review | `pnpm descriptions:redo review` → http://127.0.0.1:4319 | this machine only: the shop's words and the new ones side by side; Approve (A), Reject (R), Edit; **Approve all … that passed** |
| 4. publish | `pnpm descriptions:redo publish` (`--auto`: also the ones that passed and were not rejected) | one small database write per listing |
| status | `pnpm descriptions:redo status` | how many listings are at each step, tries and tokens per listing |
| try | `pnpm descriptions:redo try --limit 20 --out <a scratch folder>` | before the deploy: live listings from the store's public view, never published |

Every step can stop and carry on: the work sits in `out/<type>/<product id>/` (not in git): `item.json` (the words as
read), `result.json` (the new words and the checks) and `decision.json` (the review). `fetch` carries on from the last
listing it read; `fetch --again` starts over and takes only new listings and ones whose words changed. `make` writes
the listings not written yet and the rejected ones (each time with new seeds); `--retry` adds the flagged ones.
Once a listing is live, `publish` deletes its `result.json` and `decision.json`; `item.json` stays (the shop's old
words, the only copy kept, about 2 KB a listing), so `fetch` never takes it again. A listing whose words changed while
it waited (an admin edit) is left alone and fetched again as it is now. `redo.log` becomes `redo.log.1` past 5 MB.
Every command takes `--out <folder>` (or `IWC_DESC_OUT`).

**What each listing gets.** One question to the model, answered as JSON in three parts: a summary line, a short
paragraph (two or three sentences) and up to seven facts as label and value. The code puts them together as the
store shows them (`apps/web/features/catalog/product-details.tsx`): the paragraph, then one `• Label: value` line
per fact, plain text, no markdown. The summary replaces the shop's (it is shown under the name and is the page's
meta description). The model never sees the shop's sentences about money, links, selling, disclaimers or its own
photos: they are cut first, so no number from them can come back. Facts the page already shows under the words
(fabric, care, material, ingredients…) are not repeated as lines. A few ad words a 7B model keeps writing however
often it is told ("perfect for", "beautiful", "for special occasions") are made plain by the code, and empty,
praise-only or repeated fact lines are dropped; the code never adds a word.

**The checks** (`packages/shared/src/sourcing/describe/checks.ts`). Refused outright, even in the founder's edit: a
price or money word (₹, Rs, INR, $, MRP, % off, discount, offer, sale, price), a link, email or phone number, an
emoji or symbol, a shop or marketplace name, selling or shipping words (seller, delivery, returns, stock…), the
listing's shop and, for clothing and home, its brand (D-143; food keeps its brand, D-139). Then, for the model's text:
every number must be in the listing (none worked out: two 100 g packs stay 2 x 100 g); every measure the shop states
must be kept; ingredients, allergens, care and shelf life kept unless the page shows them; no material, food,
allergen, claim (handmade, organic, authentic…), occasion or place the listing does not state; every fact line's
words from the listing (an ingredients line word for word); "India" or "Indian" only for a piece made in India
(D-171); no health claims; the store's format and lengths; no ad words; and new wording: at most 20 % of the summary
and paragraph's four-word runs and at most 7 words in a row may match the shop's text (a fact line may keep a fact's
words, not a sentence of the shop's prose). A text that fails is asked again with the reasons, up to three times in
all; the best one then waits on the review page as **flagged**, with the reasons shown. The checks cannot catch every
soft invention in the paragraph (the trial had a jacket "light and breathable"), so look before `publish --auto`.

**The model: `qwen2.5:7b`** (Qwen 2.5 7B Instruct, 4-bit Q4_K_M, 4.7 GB), already on this laptop for the
weight estimator (`tools/weight-estimator`), so nothing is downloaded. It fits the 8 GB card with room for eight
answers at once, follows a JSON schema reliably through Ollama's structured output, and reads the Hindi and regional
words in Indian product text. A larger model (14B) would not fit with eight at once; a newer 8B class model can be
tried with `IWC_DESC_MODEL` after `ollama pull` (ask the founder first: it is a download).

**Measured on this laptop (2026-11-02, 24 live listings not used for tuning):** 20 passed every check, 4 flagged for
review (an invented care line, a fact left out twice, a fact line copying the shop's sentence); 25.6 listings a
minute with eight at once (1.6 tries and about 300 tokens each), so about 8 – 9 hours for 13,000 listings: run it
overnight, `run --limit 3000` a night. One listing at a time it is about 5 a minute.

**What it costs (free plans):** Supabase: a page of 25 listings' words per read (about 2 KB each, so about 25 MB for
the catalogue) and one small write per listing (the words replace words of about the same size; the search index
follows by trigger). Vercel: nothing (no page-cache write is asked for; store pages pick up the words within their
cache fallback). The laptop: the work folder holds about 2 KB per listing once it is live.

## Setup (once)
1. The migration `20261107090000_description_redo` on production (the Deploy workflow).
2. Nothing else if `tools/sourcing-runner/.env` is on this machine (the worker account); else
   `tools/description-redo/.env` (not in git) with `IWC_SUPABASE_URL`, `IWC_SUPABASE_ANON_KEY`, `IWC_WORKER_EMAIL`,
   `IWC_WORKER_PASSWORD`. Optional: `IWC_DESC_MODEL` (default `qwen2.5:7b`), `IWC_DESC_PARALLEL` (default 8),
   `OLLAMA_HOST`, `IWC_DESC_OUT`.
3. Ollama with `qwen2.5:7b` and its three speed settings, as for the weight estimator (`tools/weight-estimator/README.md`
   §Speed: `OLLAMA_NUM_PARALLEL=8`, `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`; on this laptop already).

## A first run
`pnpm descriptions:redo run --limit 100`, then `review` (read a few of each type, approve or edit), `publish`. When
the approved ones read well, `run --limit 3000` overnight, Approve all that passed, look at the flagged ones, and
`publish`.
