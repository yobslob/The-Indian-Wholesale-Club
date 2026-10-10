# Photo worker (D-101, D-103)

Makes the AI photos for vendor pieces on the founder's laptop GPU (RTX 4060, 8 GB). It signs in to Supabase as its
own **worker** account (role `worker`), takes queued `photo_jobs`, and uploads three candidates per view to the private
`photo-candidates` bucket; an admin picks one. Nothing on the internet depends on this machine: when it is off, jobs
wait and vendors can still upload.

Per job: the vendor's photo → BiRefNet cutout and white balance → FLUX.2 [klein] 4B puts the garment on a house model
(three seeds) → each colour-matched back to the real photo → Real-ESRGAN ×2 → JPEG. Pieces not shown on a model (kids,
footwear, accessories, fabrics; `iwc_worker/prompts.py`) get one product shot on white. The close-up is never
generated or upscaled (D-100). About a minute per view on the RTX 4060 (unverified at volume).

| File | What |
|---|---|
| `worker.py` | the loop: claim, process, finish; unloads the models after 10 idle minutes |
| `iwc_worker/pipeline.py` | the models and image steps |
| `iwc_worker/prompts.py` | which categories go on a model, and the words FLUX gets |
| `iwc_worker/supa.py` | sign-in, database functions, storage (plain HTTPS, no service key) |
| `prepare_house_model.py` | splits one of the founder's house model images (two poses side by side) into front and back |

## Setup (once)
1. **Models** (16 GB, outside the repo) in `C:\kod\iwc-photo-models\` (or set `IWC_MODELS`): `flux2-klein-4b\`
   (Hugging Face `black-forest-labs/FLUX.2-klein-4B`, diffusers layout, Apache 2.0), `birefnet\` (`ZhengPeng7/BiRefNet`,
   MIT), `realesrgan\RealESRGAN_x2plus.pth` (Real-ESRGAN release v0.2.1, BSD-3).
2. **Python 3.10** environment, from this folder:
   ```
   py -3.10 -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu124
   ```
3. **The worker account:** a Supabase user whose `profiles.role` is `worker` (local: `pnpm dev:photo-e2e` makes one;
   production: `docs/ops.md` §Photo worker).
4. **Settings** in `tools/photo-worker/.env` (not in git; the founder writes it):
   `IWC_SUPABASE_URL`, `IWC_SUPABASE_ANON_KEY` (the public anon key), `IWC_WORKER_EMAIL`, `IWC_WORKER_PASSWORD`, and
   optionally `IWC_MODELS`. Environment variables win over the file.

## Run
```
.venv\Scripts\python worker.py          (until Ctrl+C)
.venv\Scripts\python worker.py --once   (one job)
```
It logs to the console and `worker.log`. To start it with Windows: Task Scheduler → Create Task → "At log on", action
`C:\kod\root\tools\photo-worker\.venv\Scripts\pythonw.exe` with argument `worker.py` and "Start in"
`C:\kod\root\tools\photo-worker`.

## House models (D-104)
The founder supplies them: 6 women and 4 men, AI-generated and licensed, each one image with two poses side by side
(facing front; from behind with the head turned). `prepare_house_model.py <image> <slug>` splits it into
`<IWC_MODELS>\house-models\<slug>\front.jpg` and `back.jpg`; those go to `product-media/house-models/<slug>/` with a
`house_models` row (the admin screen for this is V3). Every piece gets two photos, one per pose, on the house look of the
founder's example (a warm plaster wall, matching footwear; `iwc_worker/prompts.py`).
