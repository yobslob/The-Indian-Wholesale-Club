"""Makes house model candidates (D-101, D-102) for the founder to choose 6 - 7 from: synthetic people (no reference
photo, no real person's likeness), front view from words, back view from the front. Same studio, light and clothes
as every try-on needs: fitted plain white clothes, barefoot, full body on warm light grey, 3 : 4.

    .venv\\Scripts\\python make_house_models.py [out_dir]      (default: <IWC_MODELS>\\house-model-candidates)

Writes <slug>-front.jpg, <slug>-back.jpg and contact-sheet.jpg. Nothing is uploaded.
"""

import sys
from pathlib import Path

import torch
from PIL import Image

from iwc_worker.pipeline import MODELS, OUT_H, OUT_W, Pipeline

STUDIO = ("standing straight and facing the camera, arms relaxed at her sides, {clothes}, barefoot. Plain warm "
          "light-grey seamless studio backdrop, soft even studio lighting, the whole body visible from head to feet "
          "with space above the head and below the feet, centred, sharp focus, photorealistic e-commerce catalogue "
          "photo, natural skin texture.")
WOMAN = "wearing a plain fitted white tank top and fitted white shorts"
MAN = "wearing a plain fitted white crew-neck t-shirt and fitted white shorts"

CANDIDATES = [  # slug, description, seed
    ("w1", "a young South Asian woman in her mid twenties, medium-brown skin, long dark wavy hair, warm smile", 11),
    ("w2", "a South Asian woman in her early thirties, deep-brown skin, shoulder-length black hair, calm confident look", 21),
    ("w3", "a South Asian woman in her late thirties, light-brown skin, dark hair in a low bun, gentle smile", 31),
    ("w4", "a curvy plus-size South Asian woman in her early thirties, medium-brown skin, long straight black hair, "
           "friendly smile", 41),
    ("w5", "a tall slim South Asian woman in her twenties, light-wheatish skin, short dark bob haircut, soft smile", 51),
    ("w6", "a South Asian woman in her mid forties, medium-brown skin, dark hair with a few grey strands tied back, "
           "warm smile", 61),
    ("m1", "a young South Asian man in his late twenties, medium-brown skin, short dark hair, trimmed beard, "
           "friendly smile", 71),
    ("m2", "a South Asian man in his mid thirties, deep-brown skin, short curly black hair, clean shaven, calm look", 81),
    ("m3", "a South Asian man in his mid forties, light-brown skin, salt-and-pepper short hair and moustache, warm smile",
     91),
    ("m4", "a broad-built South Asian man in his early thirties, medium-brown skin, wavy dark hair, full beard, "
           "relaxed smile", 101),
]


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else MODELS / "house-model-candidates"
    out.mkdir(parents=True, exist_ok=True)
    pipe = Pipeline()._flux()
    sheet = []
    for slug, who, seed in CANDIDATES:
        man = slug.startswith("m")
        studio = STUDIO.format(clothes=MAN if man else WOMAN)
        if man:
            studio = studio.replace("her sides", "his sides")
        front = pipe(prompt=f"Full-body photo of {who}, {studio}", width=OUT_W, height=OUT_H, num_inference_steps=4,
                     guidance_scale=1.0, generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        ref = front.copy()
        ref.thumbnail((640, 640))
        back = pipe(image=[ref], width=OUT_W, height=OUT_H, num_inference_steps=4, guidance_scale=1.0,
                    prompt=("The same person, same hair, same clothes, same studio and lighting, now seen from directly "
                            "behind with the back to the camera, standing straight, arms relaxed at the sides, the "
                            "whole body visible from head to feet."),
                    generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        front.save(out / f"{slug}-front.jpg", quality=92)
        back.save(out / f"{slug}-back.jpg", quality=92)
        sheet.append((slug, front, back))
        print(f"{slug} done", flush=True)

    thumb_h = 480
    thumb_w = thumb_h * OUT_W // OUT_H
    canvas = Image.new("RGB", (len(sheet) * (2 * thumb_w + 30), thumb_h + 10), "white")
    for i, (_, front, back) in enumerate(sheet):
        x = i * (2 * thumb_w + 30)
        canvas.paste(front.resize((thumb_w, thumb_h)), (x, 0))
        canvas.paste(back.resize((thumb_w, thumb_h)), (x + thumb_w + 4, 0))
    canvas.save(out / "contact-sheet.jpg", quality=88)
    print(f"Wrote {len(sheet)} candidates and contact-sheet.jpg to {out}")


if __name__ == "__main__":
    main()
