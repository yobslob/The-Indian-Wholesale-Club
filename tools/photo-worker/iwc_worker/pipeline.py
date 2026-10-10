"""The photo pipeline (D-101): garment cutout and white balance (BiRefNet), the garment on a house model (FLUX.2 [klein]
4B in 4-bit), colour matched back to the real photo, x2 upscale (Real-ESRGAN). Models load on first use and can be
unloaded to give the GPU back. Licences: BiRefNet MIT, FLUX.2 [klein] 4B Apache 2.0, Real-ESRGAN BSD-3."""

import gc
import os
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

MODELS = Path(os.environ.get("IWC_MODELS", r"C:\kod\iwc-photo-models"))
OUT_W, OUT_H = 864, 1152       # 3 : 4 portrait, like every product photo; x2 after the upscale
REF_SIDE = 640                 # references shrunk to this: 15 s instead of 3.5 min on an 8 GB card (spike, 2026-10-10)


class Pipeline:
    def __init__(self) -> None:
        self.seg = None
        self.flux = None
        self.esr = None
        self._skin: dict[int, np.ndarray | None] = {}   # a house model's skin colour, once per photo (by id)

    # --- models --------------------------------------------------------------------------------------------------
    def _seg(self):
        if self.seg is None:
            from transformers import AutoModelForImageSegmentation
            self.seg = AutoModelForImageSegmentation.from_pretrained(str(MODELS / "birefnet"), trust_remote_code=True)
            self.seg.eval().half()
        return self.seg

    def _flux(self):
        if self.flux is None:
            from diffusers import BitsAndBytesConfig as DiffusersBnb
            from diffusers import Flux2KleinPipeline
            from diffusers.quantizers import PipelineQuantizationConfig
            from transformers import BitsAndBytesConfig as TransformersBnb
            nf4 = dict(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16)
            self.flux = Flux2KleinPipeline.from_pretrained(
                str(MODELS / "flux2-klein-4b"), torch_dtype=torch.bfloat16,
                quantization_config=PipelineQuantizationConfig(
                    quant_mapping={"transformer": DiffusersBnb(**nf4), "text_encoder": TransformersBnb(**nf4)}))
            self.flux.to("cuda")
        return self.flux

    def _esr(self):
        if self.esr is None:
            from spandrel import ModelLoader
            self.esr = ModelLoader().load_from_file(str(MODELS / "realesrgan" / "RealESRGAN_x2plus.pth")).eval()
        return self.esr

    @property
    def loaded(self) -> bool:
        return any(m is not None for m in (self.seg, self.flux, self.esr))

    def unload(self) -> None:
        self.seg = self.flux = self.esr = None
        gc.collect()
        torch.cuda.empty_cache()

    # --- garment -------------------------------------------------------------------------------------------------
    def mask(self, img: Image.Image) -> np.ndarray:
        """Foreground probability (0..1) at the image's size. BiRefNet visits the GPU only while it works."""
        from torchvision import transforms
        tf = transforms.Compose([transforms.Resize((1024, 1024)), transforms.ToTensor(),
                                 transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
        seg = self._seg().to("cuda")
        with torch.no_grad():
            pred = seg(tf(img).unsqueeze(0).to("cuda").half())[-1].sigmoid().float().cpu()[0, 0].numpy()
        self.seg = seg.to("cpu")
        torch.cuda.empty_cache()
        return cv2.resize(pred, img.size, interpolation=cv2.INTER_LINEAR)

    def garment_on_white(self, img: Image.Image) -> tuple[Image.Image, np.ndarray]:
        """The garment alone on white, white-balanced on the backdrop, cropped; plus its real pixels (for colour)."""
        rgb = np.array(img.convert("RGB"))
        mask = self.mask(img)
        n, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0.5).astype(np.uint8))
        if n < 2:
            raise ValueError("no_garment_found")
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        mask = mask * (labels == keep)
        backdrop = rgb[mask < 0.2].reshape(-1, 3).astype(np.float64)
        if len(backdrop) > 1000:                                   # grey-world on the backdrop only
            means = backdrop.mean(axis=0)
            rgb = np.clip(rgb * (means.mean() / means), 0, 255).astype(np.uint8)
        a = mask[..., None]
        out = (rgb * a + 255 * (1 - a)).astype(np.uint8)
        ys, xs = np.where(mask > 0.5)
        pad = max(16, int(0.04 * max(img.size)))
        box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0),
               min(xs.max() + pad, img.width), min(ys.max() + pad, img.height))
        return Image.fromarray(out).crop(box), rgb[mask > 0.5]

    # --- the garment on a house model ----------------------------------------------------------------------------
    def try_on(self, house: Image.Image, garment: Image.Image, prompt: str, seeds: list[int]) -> list[Image.Image]:
        refs = []
        for im in (house, garment):
            im = im.convert("RGB").copy()
            im.thumbnail((REF_SIDE, REF_SIDE))
            refs.append(im)
        pipe = self._flux()
        return [pipe(image=refs, prompt=prompt, width=OUT_W, height=OUT_H, num_inference_steps=4, guidance_scale=1.0,
                     generator=torch.Generator("cuda").manual_seed(seed)).images[0] for seed in seeds]

    def colour_match(self, gen: Image.Image, house: Image.Image, real_pixels: np.ndarray) -> Image.Image:
        """Pulls the garment's colours back to the real photo's (the model drifts: reddish-brown to plum, black to navy).
        The garment = the person on the output minus skin (its colour from the house model), the head and the feet.
        Up to two main colours are matched (a cream saree and its black blouse), each shift capped; faces, skin, the
        wall and small print details keep their own colours."""
        lab = lambda im: cv2.cvtColor(np.array(im.convert("RGB")), cv2.COLOR_RGB2LAB).astype(np.float32)
        g = lab(gen)
        skin_ref = self._skin_colour(house, lab)
        if skin_ref is None or len(real_pixels) < 500:
            return gen
        person = self.mask(gen) > 0.5
        ys = np.where(person.any(axis=1))[0]
        if len(ys) == 0:
            return gen
        top, bottom = ys.min(), ys.max()
        garment = person & (np.linalg.norm(g - skin_ref, axis=2) > 18)
        garment[: top + int(0.13 * (bottom - top))] = False          # head and hair
        garment[bottom - int(0.05 * (bottom - top)):] = False        # feet and footwear
        garment = cv2.morphologyEx(garment.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
        if garment.sum() < 0.03 * garment.size:
            return gen
        real = cv2.cvtColor(real_pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3)
        pairs = _paired_colours(real.astype(np.float32), g[garment])
        if not pairs:
            return gen
        shift = np.zeros_like(g)
        total = np.zeros(g.shape[:2], np.float32)
        for gen_c, real_c in pairs:
            w = np.clip(1 - np.linalg.norm(g - gen_c, axis=2) / 50, 0, 1) * garment
            delta = real_c - gen_c
            delta *= min(1.0, 60 / max(float(np.linalg.norm(delta)), 1e-6))   # never move a colour more than 60 dE
            shift += w[..., None] * delta
            total += w
        # The blend of the pairs' shifts (weighted mean), applied as strongly as the pixel belongs to the garment's
        # colours: once, not squared.
        shift /= np.maximum(total, 1e-6)[..., None]
        weight = cv2.GaussianBlur(np.clip(total, 0, 1), (0, 0), 3)[..., None]
        out = np.clip(g + shift * weight, 0, 255).astype(np.uint8)
        return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_LAB2RGB))

    def _skin_colour(self, house: Image.Image, lab) -> np.ndarray | None:
        """The house model's skin colour: person pixels that are neither the fitted clothes nor hair. Kept per photo, so a
        job's three candidates (and the next jobs on the same model) measure it once."""
        key = id(house)
        if key not in self._skin:
            hp = lab(house)[self.mask(house) > 0.5]
            chroma = np.linalg.norm(hp[:, 1:] - 128, axis=1)
            skin = hp[(hp[:, 0] > 60) & (hp[:, 0] < 235) & (chroma > 8)]
            self._skin = {key: np.median(skin, axis=0) if len(skin) >= 500 else None}
        return self._skin[key]

    # --- product shot and upscale --------------------------------------------------------------------------------
    @staticmethod
    def packshot(garment: Image.Image) -> Image.Image:
        """Pieces that are not shown on a model (kids, footwear, accessories, fabrics): centred on white, 3 : 4."""
        canvas = Image.new("RGB", (OUT_W, OUT_H), "white")
        g = garment.convert("RGB").copy()
        g.thumbnail((int(OUT_W * 0.86), int(OUT_H * 0.86)), Image.LANCZOS)
        canvas.paste(g, ((OUT_W - g.width) // 2, (OUT_H - g.height) // 2))
        return canvas

    def upscale(self, img: Image.Image) -> Image.Image:
        esr = self._esr().to("cuda")
        x = torch.from_numpy(np.array(img.convert("RGB"))).permute(2, 0, 1).float().div(255)[None].to("cuda")
        with torch.no_grad():
            y = esr(x).clamp(0, 1)[0].permute(1, 2, 0).mul(255).byte().cpu().numpy()
        self.esr = esr.to("cpu")
        torch.cuda.empty_cache()
        return Image.fromarray(y)


def _paired_colours(real: np.ndarray, gen: np.ndarray) -> list[tuple[np.ndarray, np.ndarray]]:
    """The garment's main colours in the real photo and in the output, paired light to light, dark to dark: two when
    both show two clear colours (each at least 12 % of the garment), else one."""
    def centres(px: np.ndarray) -> list[tuple[np.ndarray, float]]:
        sample = px[np.random.default_rng(0).choice(len(px), min(len(px), 20000), replace=False)].astype(np.float32)
        _, labels, c = cv2.kmeans(sample, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5), 3,
                                  cv2.KMEANS_PP_CENTERS)
        share = [float((labels == i).mean()) for i in range(2)]
        two = min(share) >= 0.12 and np.linalg.norm(c[0] - c[1]) > 25
        if not two:
            return [(np.median(sample, axis=0), 1.0)]
        return sorted([(c[i], share[i]) for i in range(2)], key=lambda x: float(x[0][0]))
    r, g = centres(real), centres(gen)
    if len(r) != len(g):
        r, g = [(np.median(real, axis=0), 1.0)], [(np.median(gen, axis=0), 1.0)]
    return [(gc, rc) for (gc, _), (rc, _) in zip(g, r)]
