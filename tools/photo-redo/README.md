# Photo redo (D-163)

Makes every listing's photos again on the founder's laptop (RTX 4060): clothing gets a house model's face and skin
with the garment's pixels untouched, food's main photo a tempting table scene, home & gifts a new main photo in a room.
This tool does everything but the GPU work, which is `tools/photo-worker/redo.py`. Nothing runs on Vercel.

| Step | Command (from `C:\kod\root`) | Uses |
|---|---|---|
| 1. fetch | `pnpm photos:redo fetch --type clothing --limit 200` | the next photos to do: each one's 1200 copy from R2 (one read) |
| 2. make | `cd tools\photo-worker` then `.venv\Scripts\python redo.py --type clothing` | the GPU, offline |
| 3. review | `pnpm photos:redo review` → http://127.0.0.1:4317 | this machine only: old and new side by side, A approves, R rejects |
| 4. publish | `pnpm photos:redo publish --type clothing` (`--auto`: also the ones that passed the checks and were not rejected) | two R2 writes and one row per photo; old copies deleted 10 min later |
| status | `pnpm photos:redo status` | how many photos are at each step |
| audit | `pnpm photos:redo audit` (`--delete`) | what fills R2; listing photos no listing shows (over a day old) |

Each step can stop and carry on: the work sits in `out/<type>/<photo id>/` (not in git): `item.json`, `before.png`,
`after.png`, `result.json` (the GPU step's checks) and `decision.json` (the review). `fetch` carries on from the last
listing it read; `fetch --again` starts over and takes only what is still not done. `redo.py --retry` makes the failed
ones again with another seed. Run `publish` again after 10 minutes (or `sweep --type …`) to delete the replaced photos'
copies; it checks first that no listing still shows them.

**What each type gets**
- **Clothing:** only the face is drawn again; arms, legs and hands only change colour. Every pixel of the garment and a
  3-pixel band around it is copied from the original (the check counts changed garment pixels: always 0). A listing
  goes live only when all its photos are approved (or have no person in them), so it never shows two people. Kids'
  pieces are not done. The checks pass when the new face is a different person (SFace) and there is exactly one face.
- **Food:** the main photo only; the pack keeps its own pixels (a shop thumbnail is upscaled ×2 first).
- **Home & gifts:** the scene becomes the main photo and the plain one stays second. Look at these on the review page
  rather than `--auto`: a scene can hide a second, drawn copy of the piece behind the real one.

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
you approve. Measured on this laptop (2026-10-27): about 12 s a clothing photo with a face, 1 – 2 s without one,
about 20 s a food or home scene, plus about 40 s to load the models once.
