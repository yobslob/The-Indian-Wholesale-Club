"""Prepares one of the founder's house models (D-104): their image holds two poses side by side, facing front and seen
from behind. This splits it into front.jpg and back.jpg (each pose alone on its own white background).

    .venv\\Scripts\\python prepare_house_model.py <image> <slug>     e.g.  ... w_1.jpg w-1

Writes <IWC_MODELS>\\house-models\\<slug>\\front.jpg and back.jpg; they then go to product-media/house-models/<slug>/
with a house_models row (the admin's House models screen, V3; locally `pnpm dev:photo-e2e --house=front,back`).
"""

import sys

import numpy as np
from PIL import Image, ImageOps

from iwc_worker.pipeline import MODELS, Pipeline


def split(img: Image.Image, mask: np.ndarray) -> tuple[Image.Image, Image.Image]:
    """Cuts at the emptiest column in the middle third (the gap between the two people)."""
    cols = (mask > 0.5).sum(axis=0)
    lo, hi = img.width // 3, 2 * img.width // 3
    cut = lo + int(np.argmin(cols[lo:hi]))
    if cols[cut] > 0.02 * img.height:
        raise SystemExit("Could not find the gap between the two poses: are they side by side, not overlapping?")
    halves = []
    for x0, x1 in ((0, cut), (cut, img.width)):
        part, part_mask = img.crop((x0, 0, x1, img.height)), mask[:, x0:x1] > 0.5
        ys, xs = np.where(part_mask)
        pad = int(0.03 * img.height)
        box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, part.width),
               min(ys.max() + pad, part.height))
        halves.append(part.crop(box))
    return halves[0], halves[1]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    source, slug = sys.argv[1], sys.argv[2]
    img = ImageOps.exif_transpose(Image.open(source)).convert("RGB")
    front, back = split(img, Pipeline().mask(img))
    out = MODELS / "house-models" / slug
    out.mkdir(parents=True, exist_ok=True)
    front.save(out / "front.jpg", quality=94)
    back.save(out / "back.jpg", quality=94)
    print(f"{slug}: front {front.size}, back {back.size} -> {out}")


if __name__ == "__main__":
    main()
