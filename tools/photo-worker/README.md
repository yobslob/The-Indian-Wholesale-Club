# Photo worker: the photo redo's GPU step (D-163 – D-168)

Makes new photos for listings on the founder's laptop GPU (RTX 4060, 8 GB). It needs no account and no internet:
`tools/photo-redo` fetches and publishes, the sourcing runner sends new listings to `redo_serve.py`.

| File | What |
|---|---|
| `redo.py` | makes the photos `pnpm photos:redo fetch` put in the work folder |
| `redo_serve.py` | the same work as a local service for the sourcing runner |
| `iwc_worker/redo_clothing.py`, `faceswap.py`, `parts.py` | clothing: the face swap, the cut at the chin, the reframe |
| `iwc_worker/refresh.py` | food and home: the light refresh |
| `iwc_worker/redo_scene.py` | food and home with `--scene`: a drawn scene around the product |
| `iwc_worker/pipeline.py` | the shared models (cutout mask, FLUX.2, upscale) and where they live (`IWC_MODELS`) |
| `prepare_house_model.py` | splits one of the founder's model images (two poses side by side) into front and back |

## Setup (once)
1. **Models** (outside the repo) in `C:\kod\iwc-photo-models\` (or set `IWC_MODELS`): `birefnet\` (`ZhengPeng7/BiRefNet`,
   MIT), `segformer-clothes\` (`mattmdjaga/segformer_b2_clothes`: `config.json`, `preprocessor_config.json`,
   `model.safetensors`), `opencv-face\` (`face_detection_yunet_2023mar.onnx` from `opencv/face_detection_yunet`,
   `face_recognition_sface_2021dec.onnx` from `opencv/face_recognition_sface`), and for the face swap `faceswap\` (about
   1.2 GB, FaceFusion's GitHub releases `facefusion/facefusion-assets`: `models-3.3.0/hyperswap_1a_256.onnx`,
   `models-3.0.0/inswapper_128_fp16.onnx`, `arcface_w600k_r50.onnx`, `gfpgan_1.4.onnx`). For `--scene` only (16 GB):
   `flux2-klein-4b\` (Hugging Face `black-forest-labs/FLUX.2-klein-4B`, diffusers layout, Apache 2.0) and
   `realesrgan\RealESRGAN_x2plus.pth` (Real-ESRGAN release v0.2.1, BSD-3).
2. **Python 3.10** environment, from this folder:
   ```
   py -3.10 -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu124
   ```

## House models (D-187: the folder is the whole list)
The models are folders on this laptop, nowhere else: `<IWC_MODELS>\house-models\w-1\`, `w-2\` … wear women's listings,
`m-1\` … men's. **To add a model, add a folder with `front.jpg`; to remove one, remove its folder.** A folder starting
with `_` is set aside; any other name is skipped with a warning in the log. A `front.jpg` with no face found is skipped
too. The larger the photo, the better the faces.

A model image with two poses side by side (facing front; from behind): `prepare_house_model.py <image> <slug>` makes
that folder's `front.jpg` and `back.jpg`.

With no usable model, `redo.py --type clothing` stops before it changes anything and says where it looked (`--faces crop`
cuts every face instead), and `redo_serve.py` answers an error for a clothing listing, so the runner uploads its photos
as they are and the redo takes them later. With no model for who wears a listing (no `m-…` for a men's piece), its faces
are cut. Kids' faces are always cut.

## Photo redo (D-163, D-164)
`redo.py` makes the new photos for every listing's photos that `pnpm photos:redo fetch` put in the work folder
(`tools/photo-redo/README.md` has the whole flow): `.venv\Scripts\python redo.py --type clothing|food|home
[--faces crop] [--scene] [--again] [--retry]`. Clothing: the house model's identity swapped onto the face (HyperSwap,
pasted back with soft edges) when every check passes, else the photo cut at the chin; nothing outside the face changes.
Food and home: the light refresh, no GPU; `--scene` draws a scene around the product instead. It logs to the console and
`redo.log`.

## Photo redo service (D-168)
`redo_serve.py` is the same work as a service on http://127.0.0.1:4318 for the sourcing runner: `pnpm sourcing run`
starts it when it is not running and sends each new listing's photos before uploading them (`tools/sourcing-runner`
README). It lets the GPU go after 10 idle minutes and ends after 30; its log is `serve.log` (`serve.log.1` past 5 MB).
To run it by hand: `.venv\Scripts\python redo_serve.py`.
