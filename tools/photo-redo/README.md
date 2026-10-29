# Photo redo (D-163, D-164)

Makes every listing's photos again on the founder's laptop (RTX 4060): no shop model's face reaches the store, and
every other photo gets a small change of its own. This tool does everything but the image work, which is
`tools/photo-worker/redo.py`. Nothing runs on Vercel.

| Step | Command (from `C:\kod\root`) | Uses |
|---|---|---|
| 1. fetch | `pnpm photos:redo fetch --type clothing --limit 200` | the next photos to do: each one's 1200 copy from R2 (one read) |
| 2. make | `cd tools\photo-worker` then `.venv\Scripts\python redo.py --type clothing` (`--again` after a change here) | the GPU for clothing; food and home need none |
| 3. review | `pnpm photos:redo review` → http://127.0.0.1:4317 | this machine only: old and new side by side, A approves, R rejects; a portrait: Remove photo or Keep it |
| 4. publish | `pnpm photos:redo publish --type clothing` (`--auto`: also the ones that passed the checks and were not rejected) | two R2 writes and one row per photo; old copies deleted 10 min later |
| status | `pnpm photos:redo status` | how many photos are at each step |
| audit | `pnpm photos:redo audit` (`--delete`) | what fills R2; listing photos no listing shows (over a day old) |

Each step can stop and carry on: the work sits in `out/<type>/<photo id>/` (not in git): `item.json`, `before.png`,
`after.png`, `result.json` (the GPU step's checks) and `decision.json` (the review). `fetch` carries on from the last
listing it read; `fetch --again` starts over and takes only what is still not done. `redo.py --again` makes every photo
not yet live again (its review choice is cleared); `--retry` only the failed ones, with another seed. Run `publish` again after 10 minutes (or `sweep --type …`) to delete the replaced photos'
copies; it checks first that no listing still shows them.

**What each photo gets**
- **Clothing with a face:** the face is drawn again as the house model's only when that is safe (a large face turned
  to the camera, level, no sunglasses, one person) and every check after it passes (one face, in the same place, a
  different person, its colour matched to the neck around it, no seam, nothing outside the face changed). Any other
  photo with a face is cut just under the chin and framed 3 : 4 around the person: nothing is drawn, so nothing can
  look wrong. `redo.py --faces crop` cuts every face off and draws none. Neck, arms and hands never change. Kids' faces
  are always cut. A portrait whose face fills the photo cannot be cut: the review page asks you to remove it (it comes
  off the listing; a listing's only photo is never removed) or keep it. A listing goes live only when all its photos
  are settled, so it never shows two people.
- **Clothing without a face:** reframed 3 : 4 a little closer; colours untouched.
- **Food and home & gifts, every photo:** the light refresh, with nothing cut out or drawn. On a white backdrop (most
  packshots) the backdrop becomes the store's paper colour, the product framed 3 : 4 with a soft shadow (today the
  cards cut a square photo's sides off); any other photo is shown whole on paper with rounded corners; both get a
  gentle warm grade. The checks report how far the photo's perceptual hashes moved from the shop's (14 of 64 bits or
  more passes). Crops, frames and colour grades are what such hashes, and reverse image search, are built to see
  through, so a photo that stays close shows "check it" rather than being called new. `redo.py --scene` draws a room
  or table scene around the product instead (look at each: a cutout can go wrong).

**What it costs (free plans):** R2: one read per photo fetched, two writes per photo published (about 25,000 for the
catalogue, of 1,000,000 a month), deletes free, no net growth for a replaced photo (food's thumbnails grow: they become
real photos). Supabase: a page of plan rows per 25 listings and one small call per photo. Vercel: nothing (store pages
pick up the new path within their 5-minute refresh; no page-cache write is asked for).

## Setup (once)
1. The migration `20261102090000_photo_redo` on production (the Deploy workflow).
2. `tools/photo-redo/.env` (not in git), or nothing if `tools/sourcing-runner/.env` is on this machine (same keys):
   `IWC_SUPABASE_URL`, `IWC_SUPABASE_ANON_KEY`, `IWC_WORKER_EMAIL`, `IWC_WORKER_PASSWORD` (the worker account, `docs/ops.md`),
   `IWC_PHOTO_STORE_S3_URL`, `IWC_PHOTO_STORE_KEY_ID`, `IWC_PHOTO_STORE_SECRET` (the R2 token: Object Read & Write, which
   also lists and deletes). Optional `IWC_REDO_OUT` (the work folder).
3. The photo worker set up (`tools/photo-worker/README.md`), with its three extra models for the redo, and the house
   models as one folder each in `C:\kod\iwc-photo-models\house-models\`: `w-1\front.jpg` and `back.jpg` …, `m-1\` …
   for men (the first letter says who wears it unless the database has a house model of that slug). Every folder there
   with a `front.jpg` in which a face is found is used; the larger the photo, the better the faces. On the laptop
   (2026-10-27): `w-1` – `w-6` (about 540 × 1450, faces about 100 px wide); the originals in
   `house-models-source\women_black\`, the earlier `w-1` in `house-models-previous\`. No men's model yet.

## A first run
`pnpm photos:redo fetch --type clothing --limit 30`, `redo.py --type clothing`, `review`, then `publish` for the ones
you approve. Photos made before 2026-10-30 (the first way): `redo.py --type clothing --again` (and food, home) makes
them the new way. Measured on this laptop: a face drawn about 12 s, a cut or a reframe 1 – 2 s, a food or home refresh
well under a second, plus about 40 s to load the models once.
