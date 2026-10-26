"""The photo redo's GPU step (D-163): makes the new photo for every photo `pnpm photos:redo fetch` put in the work folder.

    .venv\\Scripts\\python redo.py --type clothing [--limit 200] [--retry] [--seed 11]

Clothing: a house model's face and skin (iwc_worker/redo_clothing.py), the same house model on all of a listing's
photos, chosen by gender and the nearest skin tone. Food and home: a new scene around the untouched product
(iwc_worker/redo_scene.py). Each photo's folder gets after.png and result.json; `pnpm photos:redo review` shows them.
Works offline: no account, no internet. --retry makes the failed ones again (another seed).
"""

import argparse
import json
import logging
import os
import sys
import time
import traceback
from pathlib import Path

import numpy as np
from PIL import Image

from iwc_worker.parts import FACE, Parts, skin_colour
from iwc_worker.pipeline import MODELS, Pipeline
from iwc_worker.redo_clothing import ClothingRedo, lab_of
from iwc_worker.redo_scene import SceneRedo

HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("IWC_REDO_OUT", HERE.parent / "photo-redo" / "out"))
log = logging.getLogger("iwc-redo")


def house_models(parts: Parts) -> dict[str, dict]:
    """The active house models (out/house-models.json, from the database) whose front photo is on this machine."""
    listed = OUT / "house-models.json"
    rows = json.loads(listed.read_text("utf-8")) if listed.exists() else [
        {"slug": d.name, "wears": "men" if d.name.startswith("m") else "women"}
        for d in (MODELS / "house-models").iterdir() if d.is_dir()]
    found = {}
    for row in rows:
        front = MODELS / "house-models" / row["slug"] / "front.jpg"
        if not front.exists():
            log.warning("house model %s: no %s on this machine", row["slug"], front)
            continue
        img = Image.open(front).convert("RGB")
        skin = skin_colour(lab_of(img), parts.labels(img) == FACE)
        found[row["slug"]] = {"wears": row["wears"], "image": img, "skin": None if skin is None else skin[0]}
    return found


def pending(kind: str, retry: bool) -> list[tuple[Path, dict]]:
    base = OUT / kind
    if not base.exists():
        return []
    todo = []
    for d in sorted(p for p in base.iterdir() if p.is_dir() and not p.name.startswith("_")):
        item_file, result_file = d / "item.json", d / "result.json"
        if not item_file.exists() or not (d / "before.png").exists():
            continue
        if result_file.exists():
            done = json.loads(result_file.read_text("utf-8"))
            if not (retry and done.get("status") == "failed"):
                continue
        todo.append((d, json.loads(item_file.read_text("utf-8"))))
    return todo


def write_result(d: Path, status: str, note: str = "", checks: dict | None = None, house: str | None = None,
                 image: Image.Image | None = None) -> None:
    if image is not None:
        image.save(d / "after.png")
    checks = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in (checks or {}).items()}
    passed = bool(checks.pop("pass", False))
    (d / "result.json").write_text(json.dumps({"status": status, "note": note, "pass": passed, "checks": checks,
                                               "house_model": house}, indent=2), "utf-8")


def run_clothing(todo, pipe: Pipeline, parts: Parts, seed: int) -> None:
    redo = ClothingRedo(parts, pipe)
    models = house_models(parts)
    listings: dict[str, list] = {}
    for d, item in todo:
        listings.setdefault(item["product_id"], []).append((d, item))
    keep = OUT / "clothing" / "_listings"
    keep.mkdir(parents=True, exist_ok=True)
    for product, photos in listings.items():
        saved = keep / f"{product}.json"
        state = json.loads(saved.read_text("utf-8")) if saved.exists() else {}
        loaded = [(d, item, Image.open(d / "before.png").convert("RGB")) for d, item in photos]
        loaded.sort(key=lambda x: not redo.has_face(x[2]))          # a face first: it sets the listing's skin
        wears = "men" if (loaded[0][1].get("wears") == "men") else "women"
        if "house_model" not in state:
            state["house_model"] = pick_model(models, wears, parts, [im for _, _, im in loaded])
        slug = state["house_model"]
        if slug is None or slug not in models:
            for d, _, _ in loaded:
                write_result(d, "failed", f"no house model for {wears} on this machine ({MODELS / 'house-models'})")
            continue
        delta = np.array([float(v) for v in state["skin_delta"].split(",")]) if state.get("skin_delta") else None
        for d, item, img in loaded:
            started = time.time()
            try:
                out, checks = redo.redo(img, models[slug]["image"], "man" if wears == "men" else "woman", seed, delta)
                if out is None:
                    write_result(d, "none", "no person in the photo", checks, slug)
                else:
                    if delta is None and checks.get("face_drawn") and checks.get("skin_delta"):
                        state["skin_delta"] = checks["skin_delta"]
                        delta = np.array([float(v) for v in checks["skin_delta"].split(",")])
                    write_result(d, "made", f"{time.time() - started:.0f} s", checks, slug, out)
                log.info("%s: %s (%.0f s)", item["name"], "made" if out else "nothing to change", time.time() - started)
            except Exception as error:  # one photo's failure never stops the run
                log.error("%s: %s", item["name"], error)
                log.debug(traceback.format_exc())
                write_result(d, "failed", str(error)[:300], house=slug)
        saved.write_text(json.dumps(state, indent=2), "utf-8")


def pick_model(models: dict, wears: str, parts: Parts, photos: list[Image.Image]) -> str | None:
    """The house model for a listing: who wears it, then the skin tone nearest the person in its photos."""
    fitting = {s: m for s, m in models.items() if m["wears"] == wears}
    if not fitting:
        return None
    skin = None
    for img in photos:
        skin = skin_colour(lab_of(img), parts.labels(img) == FACE)
        if skin is not None:
            break
    if skin is None:
        return sorted(fitting)[0]
    return min(fitting, key=lambda s: 1e9 if fitting[s]["skin"] is None else
               float(np.linalg.norm(fitting[s]["skin"] - skin[0])))


def run_scenes(kind: str, todo, pipe: Pipeline, seed: int) -> None:
    redo = SceneRedo(pipe)
    for d, item in todo:
        started = time.time()
        try:
            out, checks = redo.redo(Image.open(d / "before.png"), kind, item["category"], item["name"], seed)
            if out is None:
                write_result(d, "failed", "no product found in the photo", checks)
            else:
                write_result(d, "made", f"{checks.get('where')} scene, {time.time() - started:.0f} s", checks,
                             image=out)
            log.info("%s: %s (%.0f s)", item["name"], "made" if out else "failed", time.time() - started)
        except Exception as error:  # one photo's failure never stops the run
            log.error("%s: %s", item["name"], error)
            write_result(d, "failed", str(error)[:300])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--type", required=True, choices=["clothing", "food", "home"])
    ap.add_argument("--limit", type=int, default=0, help="at most this many photos (0: all fetched)")
    ap.add_argument("--retry", action="store_true", help="make the failed ones again, with another seed")
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(sys.stdout),
                                  logging.FileHandler(HERE / "redo.log", encoding="utf-8")])
    for noisy in ("httpx", "transformers", "diffusers"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    todo = pending(args.type, args.retry)
    if args.limit:
        todo = todo[: args.limit]
    log.info("%s: %d photos to make in %s", args.type, len(todo), OUT / args.type)
    if not todo:
        return 0
    seed = args.seed + (7 if args.retry else 0)
    pipe, parts = Pipeline(), Parts()
    started = time.time()
    if args.type == "clothing":
        run_clothing(todo, pipe, parts, seed)
    else:
        run_scenes(args.type, todo, pipe, seed)
    log.info("%s: done in %.0f min; next: pnpm photos:redo review", args.type, (time.time() - started) / 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
