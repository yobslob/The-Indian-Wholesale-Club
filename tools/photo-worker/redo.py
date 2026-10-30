"""The photo redo's GPU step (D-163 – D-165): makes the new photo for every photo `pnpm photos:redo fetch` put in the
work folder.

    .venv\\Scripts\\python redo.py --type clothing [--faces crop] [--swapper inswapper] [--limit 200] [--again] [--retry]
    .venv\\Scripts\\python redo.py --type food [--scene]

Clothing (iwc_worker/redo_clothing.py): a face takes the house model's identity through a face swapper (its pose, light
and skin kept) when every check passes, else the photo is cut at the chin (`--faces crop`: always cut, never swapped);
a photo without a face is reframed a little. One house model per listing (who wears it, then the nearest skin tone);
kids' faces are always cut.
Food and home (iwc_worker/refresh.py): the light refresh, nothing cut out; `--scene` draws a scene around the product
instead (iwc_worker/redo_scene.py: look at each one). Each photo's folder gets after.png and result.json; `pnpm
photos:redo review` shows them. Works offline. --again makes every photo not yet live again (after a change here; its
review choice is cleared); --retry only the failed ones, with another seed.
"""

import argparse
import json
import logging
from logging.handlers import RotatingFileHandler
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
from iwc_worker.refresh import flat, refresh

HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("IWC_REDO_OUT", HERE.parent / "photo-redo" / "out"))
log = logging.getLogger("iwc-redo")


def house_models(parts: Parts) -> dict[str, dict]:
    """The house models: every folder in IWC_MODELS/house-models with a front.jpg (w-1 … for women, m-1 … for men).
    Who wears it comes from the database's row of the same slug (out/house-models.json) when there is one, else from
    the folder's first letter."""
    listed = OUT / "house-models.json"
    wears = {r["slug"]: r["wears"] for r in json.loads(listed.read_text("utf-8"))} if listed.exists() else {}
    found = {}
    for d in sorted((MODELS / "house-models").iterdir()):
        front = d / "front.jpg"
        if not d.is_dir() or d.name.startswith("_") or not front.exists():
            continue
        img = Image.open(front).convert("RGB")
        skin = skin_colour(lab_of(img), parts.labels(img) == FACE)
        found[d.name] = {"wears": wears.get(d.name, "men" if d.name.startswith("m") else "women"), "image": img,
                         "skin": None if skin is None else skin[0]}
        if not len(parts.faces(img)):
            log.warning("house model %s: no face found in %s; it is skipped", d.name, front)
            del found[d.name]
    return found


def pending(kind: str, retry: bool, again: bool) -> list[tuple[Path, dict]]:
    base = OUT / kind
    if not base.exists():
        return []
    todo = []
    for d in sorted(p for p in base.iterdir() if p.is_dir() and not p.name.startswith("_")):
        item_file, result_file = d / "item.json", d / "result.json"
        if not item_file.exists() or not (d / "before.png").exists():
            continue
        item = json.loads(item_file.read_text("utf-8"))
        if item.get("published") or item.get("stale"):
            continue
        if result_file.exists():
            done = json.loads(result_file.read_text("utf-8"))
            # a face drawn on a house model since removed from this machine is made again, on another one
            gone = bool(done.get("house_model")) and not (MODELS / "house-models" / done["house_model"] /
                                                          "front.jpg").exists()
            approved = (d / "decision.json").exists() and json.loads((d / "decision.json").read_text("utf-8")).get("ok")
            # --again keeps what the founder approved (unless its house model is gone)
            if not ((again and not approved) or gone or (retry and done.get("status") == "failed")):
                continue
        todo.append((d, item))
    return todo


def clear(todo) -> None:
    """Before a photo is made again: its old review choice and new photo were about another photo."""
    for d, _ in todo:
        (d / "decision.json").unlink(missing_ok=True)
        (d / "after.png").unlink(missing_ok=True)
        (d / "result.json").unlink(missing_ok=True)


def write_result(d: Path, status: str, note: str = "", checks: dict | None = None, house: str | None = None,
                 image: Image.Image | None = None) -> None:
    if image is not None:
        image.save(d / "after.png")
    checks = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in (checks or {}).items()}
    passed = bool(checks.pop("pass", False))
    mode = checks.pop("mode", None)
    doc = {"status": status, "note": note, "pass": passed, "checks": checks, "house_model": house}
    if mode:
        doc["mode"] = mode
    (d / "result.json").write_text(json.dumps(doc, indent=2), "utf-8")


def run_clothing(todo, pipe: Pipeline, parts: Parts, faces: str, swapper: str) -> None:
    redo = ClothingRedo(parts, pipe, swapper)
    models = house_models(parts) if faces == "redraw" else {}
    listings: dict[str, list] = {}
    for d, item in todo:
        listings.setdefault(item["product_id"], []).append((d, item))
    keep = OUT / "clothing" / "_listings"
    keep.mkdir(parents=True, exist_ok=True)
    for product, photos in listings.items():
        saved = keep / f"{product}.json"
        state = json.loads(saved.read_text("utf-8")) if saved.exists() else {}
        loaded = [(d, item, flat(Image.open(d / "before.png"))) for d, item in photos]
        wears = loaded[0][1].get("wears")
        who = "men" if wears == "men" else "women"
        # kids are never given a house model's face (D-102): theirs are always cut off
        if state.get("house_model") and state["house_model"] not in models and faces == "redraw":
            log.info("%s: house model %s is no longer here; choosing another", loaded[0][1]["name"],
                     state.pop("house_model"))
        if wears != "kids" and models and "house_model" not in state:
            state["house_model"] = pick_model(models, who, parts, [im for _, _, im in loaded])
        slug = state.get("house_model") if wears != "kids" else None
        house = models.get(slug, {}).get("image") if slug else None
        for d, item, img in loaded:
            started = time.time()
            try:
                out, checks = redo.redo(img, house, house is not None)
                took = f"{time.time() - started:.0f} s"
                if out is None:
                    write_result(d, "failed", checks.get("why", ""), checks, slug)
                else:
                    note = {"face": "face swapped", "crop": f"cut at the chin ({checks.get('not_swapped', '')})",
                            "fresh": "no face: reframed"}[checks["mode"]]
                    write_result(d, "made", f"{note}, {took}", checks, slug if checks["mode"] == "face" else None, out)
                log.info("%s: %s (%s)", item["name"], checks.get("mode") if out else "your call", took)
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


def run_refresh(kind: str, todo) -> None:
    """The light refresh: no GPU, nothing cut out (iwc_worker/refresh.py)."""
    for d, item in todo:
        try:
            out, checks = refresh(Image.open(d / "before.png"), kind, paper=True)
            note = f"{checks['style']}, {checks['phash_bits']} / {checks['dhash_bits']} bits from the shop's"
            write_result(d, "made", note, {**checks, "mode": "fresh"}, image=out)
        except Exception as error:  # one photo's failure never stops the run
            log.error("%s: %s", item["name"], error)
            write_result(d, "failed", str(error)[:300])
    log.info("%s: %d photos refreshed", kind, len(todo))


def run_scenes(kind: str, todo, pipe: Pipeline, seed: int) -> None:
    redo = SceneRedo(pipe)
    for d, item in todo:
        started = time.time()
        try:
            out, checks = redo.redo(flat(Image.open(d / "before.png")), kind, item["category"], item["name"], seed)
            if out is None:
                write_result(d, "failed", "no product found in the photo", checks)
            else:
                write_result(d, "made", f"{checks.get('where')} scene, {time.time() - started:.0f} s",
                             {**checks, "mode": "scene"}, image=out)
            log.info("%s: %s (%.0f s)", item["name"], "made" if out else "failed", time.time() - started)
        except Exception as error:  # one photo's failure never stops the run
            log.error("%s: %s", item["name"], error)
            write_result(d, "failed", str(error)[:300])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--type", required=True, choices=["clothing", "food", "home"])
    ap.add_argument("--limit", type=int, default=0, help="at most this many photos (0: all fetched)")
    ap.add_argument("--retry", action="store_true", help="make the failed ones again, with another seed")
    ap.add_argument("--again", action="store_true", help="make every photo not yet live again")
    ap.add_argument("--faces", choices=["redraw", "crop"], default="redraw",
                    help="clothing: swap a face when every check passes (else cut it off), or always cut it off")
    ap.add_argument("--swapper", choices=["hyperswap", "inswapper"], default="hyperswap",
                    help="clothing: the face swapper (hyperswap 256 px; inswapper 128 px keeps a bindi more often)")
    ap.add_argument("--scene", action="store_true", help="food and home: a drawn scene instead of the light refresh")
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(sys.stdout),
                                  RotatingFileHandler(HERE / "redo.log", maxBytes=5_000_000,
                                                      backupCount=1, encoding="utf-8")])
    for noisy in ("httpx", "transformers", "diffusers"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    todo = pending(args.type, args.retry, args.again)
    if args.limit:
        todo = todo[: args.limit]
    log.info("%s: %d photos to make in %s", args.type, len(todo), OUT / args.type)
    if not todo:
        return 0
    clear(todo)
    seed = args.seed + (7 if args.retry else 0)
    pipe, parts = Pipeline(), Parts()
    started = time.time()
    if args.type == "clothing":
        run_clothing(todo, pipe, parts, args.faces, args.swapper)
    elif args.scene:
        run_scenes(args.type, todo, pipe, seed)
    else:
        run_refresh(args.type, todo)
    log.info("%s: done in %.0f min; next: pnpm photos:redo review", args.type, (time.time() - started) / 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
