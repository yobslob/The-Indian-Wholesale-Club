"""Food and home redo (D-163): the product cut out (BiRefNet) and set in a new scene drawn around it (FLUX.2 [klein]):
food's main photo on a tempting table, home & gifts on a wall, a pooja shelf or a console. The product's own pixels
are pasted back over the drawing, so its pack, label and colours are exactly the shop's; the check is that the
drawing kept it in the same place and size (else the paste would leave a ghost)."""

import re

import cv2
import numpy as np
import torch
from PIL import Image

LONG_SIDE = 1024                 # drawn at this size (multiples of 16); copies are never upscaled past it
SMALL = 600                      # a product smaller than this (a shop thumbnail) is upscaled x2 first
MAX_GHOST = 0.2                  # share of the band around the product the drawing may fill (its own copy)

FOOD = [
    (r"chocolate|choco|snickers|shots|candy|toffee|poppins", "on a warm wooden table with a few pieces of chocolate "
     "and candy scattered beside it, small lit Diwali diyas glowing softly behind"),
    (r"chikki|makhana|nuts|dry ?fruit|almond|cashew", "on a rustic wooden table with a small brass bowl of roasted nuts "
     "and jaggery pieces beside it"),
    (r"biscuit|cookie|rusk", "on a breakfast table beside a cup of steaming masala chai and a few biscuits on a saucer"),
]
FOOD_BY_CATEGORY = {
    "sweets": "on a brass thali on a festive table with marigold petals and a few pieces of the sweet on a small plate",
    "snacks-and-namkeen": "on a rustic wooden table with a small bowl of the snack beside it and a cup of masala chai",
    "ground-spices": "on a dark wooden kitchen counter with small heaps of spices, dried red chillies and a brass spoon",
    "whole-spices": "on a dark wooden kitchen counter with small heaps of whole spices, cinnamon sticks and star anise",
    "masala-blends": "on a kitchen counter beside a simmering curry in a copper pot and small bowls of spices",
    "pickles-and-chutneys": "on a kitchen table beside a ceramic bowl of the pickle and hot parathas on a plate",
    "papad-and-wadi": "on a kitchen table with a plate of crisp roasted papad beside it",
    "rice-flours-and-staples": "on a rustic kitchen counter with a small bowl of the grain and a wooden scoop",
    "tea-and-drinks": "on a wooden table beside a glass cup of steaming chai, soft morning window light",
}
FOOD_DEFAULT = "on a rustic wooden table in a warm Indian kitchen with fresh ingredients around it"

HOME = [
    (r"toran|bandhanwar", "wall", "hung across the top of a decorated wooden doorway with marigold garlands, warm light"),
    (r"wall|hanging|frame|painting|mirror|clock|tapestry|decal", "wall",
     "hung on a warm cream plaster wall above a wooden console with a plant, soft daylight"),
    (r"wick|batti|diya|lamp|candle|kalash|bell|ghanti|incense|agarbatti|dhoop|pooja|puja|aarti|thali", "table",
     "on a wooden pooja shelf with marigold flowers, rangoli and a lit brass diya, soft warm festive light"),
    (r"ganesh|ganesha|idol|murti|statue|figurine|buddha|lakshmi|krishna|showpiece|elephant", "table",
     "on a carved wooden console in a warm, softly lit Indian living room with a brass urli of flowers"),
    (r"plate|bowl|glass|tumbler|tray|serve|jug|cup|mug|kettle|pot", "table",
     "on a dining table set for a festive Indian meal, linen runner, soft daylight"),
    (r"cushion|cover|runner|bedsheet|throw|rug|mat", "table", "styled on a sofa in a bright Indian living room"),
]
HOME_DEFAULT = ("table", "on a wooden console in a warm, softly lit Indian living room with plants and soft daylight")


def scene_for(kind: str, category: str, name: str) -> tuple[str, str]:
    """(where it goes: table or wall, the scene's words), from the listing's name, else its category."""
    text = name.lower()
    if kind == "food":
        for pattern, words in FOOD:
            if re.search(pattern, text):
                return "table", words
        return "table", FOOD_BY_CATEGORY.get(category, FOOD_DEFAULT)
    for pattern, where, words in HOME:
        if re.search(pattern, text):
            return where, words
    return HOME_DEFAULT


def _size(w: int, h: int) -> tuple[int, int]:
    r = w / h
    W, H = (LONG_SIDE, LONG_SIDE / r) if r >= 1 else (LONG_SIDE * r, LONG_SIDE)
    return int(round(W / 16) * 16), int(round(H / 16) * 16)


class SceneRedo:
    def __init__(self, pipe) -> None:
        self.pipe = pipe

    def redo(self, img: Image.Image, kind: str, category: str, name: str, seed: int) -> tuple[Image.Image | None, dict]:
        img = img.convert("RGB")
        alpha = self.pipe.mask(img)
        hard = (alpha > 0.5).astype(np.uint8)
        n, labels, stats, _ = cv2.connectedComponentsWithStats(hard)
        if n < 2:
            return None, {"product_found": False, "pass": False}
        biggest = stats[1:, cv2.CC_STAT_AREA].max()
        keep = np.isin(labels, [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 0.05 * biggest])
        alpha = alpha * cv2.dilate(keep.astype(np.uint8), np.ones((9, 9), np.uint8))
        ys, xs = np.where(alpha > 0.5)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        product = img.crop(box)
        matte = Image.fromarray((alpha[box[1]:box[3], box[0]:box[2]] * 255).astype(np.uint8))
        upscaled = max(product.size) < SMALL
        if upscaled:
            product = self.pipe.upscale(product)
            matte = matte.resize(product.size, Image.LANCZOS)
        W, H = _size(img.width, img.height)
        where, words = scene_for(kind, category, name)
        fit_w, fit_h = (0.62, 0.6) if where == "wall" else (0.64, 0.62)
        k = min(fit_w * W / product.width, fit_h * H / product.height)
        pw, ph = max(1, int(product.width * k)), max(1, int(product.height * k))
        product, matte = product.resize((pw, ph), Image.LANCZOS), matte.resize((pw, ph), Image.LANCZOS)
        left = (W - pw) // 2
        top = int(0.42 * H - ph / 2) if where == "wall" else int(0.86 * H) - ph
        canvas = Image.new("RGB", (W, H), (236, 234, 230))
        canvas.paste(product, (left, top), matte)
        placed = np.zeros((H, W), np.float32)
        placed[top:top + ph, left:left + pw] = np.array(matte, np.float32) / 255
        prompt = (f"Image 1 shows a product on a plain background. Make it a styled lifestyle photo with the product "
                  f"{words}. The product stays exactly as it is in image 1: the same size, the same place, the same "
                  f"shape, colours and printed text. Add a soft natural shadow where it rests. Photorealistic, warm "
                  f"natural light, gentle depth of field, high-end product photography.")
        drawn = self.pipe._flux()(image=[canvas], prompt=prompt, width=W, height=H, num_inference_steps=4,
                                  guidance_scale=1.0, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        # Did the drawing keep the product where it was put? A copy drawn bigger or moved shows around the pasted one:
        # the band just outside the product must stay background in the drawing (props apart do not touch it).
        mine = placed > 0.5
        reach = max(6, int(0.03 * max(W, H)))
        band = (cv2.dilate(mine.astype(np.uint8), np.ones((2 * reach + 1, 2 * reach + 1), np.uint8)) > 0) &             ~(cv2.dilate(mine.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
        ghost = float(((self.pipe.mask(drawn) > 0.5) & band).sum() / max(band.sum(), 1))
        # … and in the product's own colours: a second copy, even one the cutout model takes for the background
        lab = lambda im: cv2.cvtColor(np.array(im), cv2.COLOR_RGB2LAB).astype(np.float32)
        own = lab(canvas)[placed > 0.9]
        sample = own[np.random.default_rng(0).choice(len(own), min(len(own), 20000), replace=False)]
        _, _, centres = cv2.kmeans(sample, 5, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 2,
                                   cv2.KMEANS_PP_CENTERS)
        ring = lab(drawn)[band]
        near = np.min(np.linalg.norm(ring[:, None, :] - centres[None, :, :], axis=2), axis=1) < 10
        before = np.min(np.linalg.norm(lab(canvas)[band][:, None, :] - centres[None, :, :], axis=2), axis=1) < 10
        ghost = max(ghost, float((near & ~before).mean()) if len(ring) else 0.0)
        hard = np.where(placed > 0.99, 1.0, placed)[..., None]
        out = (np.array(drawn, np.float32) * (1 - hard) + np.array(canvas, np.float32) * hard).round().astype(np.uint8)
        solid = placed > 0.99
        checks = {"product_found": True, "where": where, "upscaled": upscaled, "ghost": ghost,
                  "product_changed_px": int((out[solid] != np.array(canvas)[solid]).any(axis=-1).sum())}
        checks["pass"] = ghost <= MAX_GHOST and checks["product_changed_px"] == 0
        return Image.fromarray(out), checks
