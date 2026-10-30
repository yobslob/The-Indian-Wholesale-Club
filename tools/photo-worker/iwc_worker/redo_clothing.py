"""Clothing redo (D-165): no shop model's face reaches the store, and no photo goes out with a face that looks wrong.
For a photo with a face:
  face  the house model's identity swapped onto the face (faceswap.py: HyperSwap, the face's own pose, expression,
        light and skin tone kept, pasted back with soft edges, GFPGAN on a large face); kept only if every check after
        it passes: one face, in the same place, a different person, no seam, no garment pixel changed.
  crop  every other photo with a face (a profile the swapper cannot align, two people, a failed check): the photo is cut
        at the chin, so the neck and neckline stay, and framed 3 : 4 around the person. Nothing drawn.
A photo where the face fills most of the picture (a portrait) is left for the founder: keep it or remove it.
Without a face, the photo is only reframed a little (refresh.py). The garment's pixels are never touched."""

import cv2
import numpy as np
from PIL import Image

from .faceswap import FaceSwap
from .parts import GARMENT, SAME_FACE, Parts, grow
from .refresh import closer

MIN_KEEP = 0.55                 # a cut that keeps less of the photo's height than this is a portrait: the founder decides
MIN_AREA = 0.45                 # … and one keeping less of its area (once framed 3 : 4), a collage or a close-up
FACE_SCORE = 0.6                # YuNet: a face at all (profiles score lower)
SWAP_SCORE = 0.75               # … and sure enough of its landmarks to align it for the swap
MAX_MOVE = 0.12                 # the swapped face's box may move this share of the face's width …
MAX_SIZE = 1.15                 # … and grow or shrink this much
MAX_SEAM = 8.0                  # the colour step where the swap meets the old picture (Lab, median of the soft edge)
GARMENT_GUARD = 3               # pixels around the garment that are always the original's


def lab_of(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2LAB).astype(np.float32)


def points(face: np.ndarray) -> np.ndarray:
    """YuNet's five landmarks (eyes, nose, mouth corners, image-left first), as the swapper's templates order them."""
    return face[4:14].reshape(5, 2).astype(np.float32)


def swappable(face: np.ndarray) -> str | None:
    """Why this face cannot be swapped (None: it can): its landmarks must be sure and both eyes seen."""
    (rx, ry), (lx, ly) = face[4:6], face[6:8]
    if face[14] < SWAP_SCORE:
        return "face not sure"
    if float(np.hypot(lx - rx, ly - ry)) < 0.22 * face[2]:
        return "profile"
    return None


class ClothingRedo:
    def __init__(self, parts: Parts, pipe, swapper: str = "hyperswap") -> None:
        self.parts = parts
        self.pipe = pipe
        self.swap = FaceSwap(swapper)
        self._sources: dict[int, np.ndarray] = {}

    def faces(self, img: Image.Image) -> np.ndarray:
        found = self.parts.faces(img)
        return found[found[:, 14] >= FACE_SCORE] if len(found) else found

    def source(self, house: Image.Image) -> np.ndarray | None:
        """The house model's identity for the swapper, once per house model image."""
        if id(house) not in self._sources:
            found = self.parts.faces(house)
            self._sources[id(house)] = self.swap.identity(house, points(found[0])) if len(found) else None
        return self._sources[id(house)]

    def redo(self, img: Image.Image, house: Image.Image | None, swap: bool) -> tuple[Image.Image | None, dict]:
        """The new photo (None: the founder decides) and what the checks found; checks["mode"] is face, crop or fresh.
        `swap`: a face may take the house model's identity (a house model for who wears it; never kids)."""
        labels = self.parts.labels(img)
        found = self.faces(img)
        # a face is what YuNet finds, profiles included (0.83 - 0.93 on the live back views with the head turned); the
        # parser's face label alone also marks shoulders and a cheek under an earring, so it decides nothing here
        if not len(found):
            return closer(np.array(img)), {"mode": "fresh", "pass": True}
        checks: dict = {"faces": int(len(found))}
        source = self.source(house) if swap and house is not None else None
        if len(found) == 1 and source is not None:
            why = swappable(found[0])
            if why is None:
                out, swap_checks = self._swap(img, labels, found[0], house, source)
                checks.update(swap_checks)
                if swap_checks["pass"]:
                    checks["mode"] = "face"
                    return out, checks
                why = swap_checks["why"]
            checks["not_swapped"] = why
        elif len(found) > 1:
            checks["not_swapped"] = "two or more people"
        cut = self._crop(img, labels, found)
        if cut is None:
            return None, {**checks, "mode": "crop", "why": "the face fills the photo: keep it or remove it", "pass": False}
        out, keep = cut
        checks.update({"mode": "crop", "kept_share": keep, "pass": True})
        return out, checks

    # --- swap ----------------------------------------------------------------------------------------------------
    def _swap(self, img, labels, face, house, source) -> tuple[Image.Image, dict]:
        rgb = np.array(img.convert("RGB"))
        out, alpha = self.swap.swap(img, points(face), float(face[2]), source)
        guard = grow(np.isin(labels, GARMENT), GARMENT_GUARD)
        out[guard] = rgb[guard]                                   # the garment, exactly as it was
        result = Image.fromarray(out)
        c: dict = {"pass": False}
        again = self.parts.faces(result)
        again = again[again[:, 14] >= FACE_SCORE] if len(again) else again
        c["faces_after"] = int(len(again))
        if len(again) != 1:
            c["why"] = "the swapped face was not found once"
            return result, c
        new, w = again[0], float(face[2])
        c["moved"] = float(np.hypot(new[0] + new[2] / 2 - face[0] - w / 2, new[1] + new[3] / 2 - face[1] - face[3] / 2)) / w
        c["size"] = float(new[2]) / w
        c["same_as_before"] = self.parts.same(self.parts.identity(img, face), self.parts.identity(result, new))
        hf = self.parts.faces(house)
        if len(hf):
            c["like_house_model"] = self.parts.same(self.parts.identity(house, hf[0]), self.parts.identity(result, new))
        edge = (alpha > 0.05) & (alpha < 0.6) & ~guard
        diff = np.linalg.norm(lab_of(result) - lab_of(img), axis=2)[edge]
        c["seam"] = float(np.median(diff)) if len(diff) else 0.0
        c["garment_changed_px"] = int((out[guard] != rgb[guard]).any(axis=-1).sum())
        different = c["same_as_before"] < SAME_FACE or c["same_as_before"] < c.get("like_house_model", -1)
        if c["moved"] > MAX_MOVE or not 1 / MAX_SIZE <= c["size"] <= MAX_SIZE:
            c["why"] = "the swapped face moved"
        elif not different:
            c["why"] = "still the same person"
        elif c["seam"] > MAX_SEAM:
            c["why"] = "a visible seam"
        elif c["garment_changed_px"]:
            c["why"] = "garment pixels changed"
        else:
            c["pass"] = True
        return result, c

    # --- crop ----------------------------------------------------------------------------------------------------
    def _crop(self, img, labels, found) -> tuple[Image.Image, float] | None:
        """Cut at the lowest chin (the neck and neckline stay) and frame 3 : 4 around the person; checked: no face is
        found in what is left (the parser's face label runs down the neck, so it is not the test)."""
        H, W = labels.shape
        cut = int(max(f[1] + f[3] for f in found) + 0.005 * H)
        person = self.pipe.mask(img) > 0.5
        for _ in range(5):
            if (H - cut) / H < MIN_KEEP:
                return None
            if not len(self.faces(img.crop((0, cut, W, H)))):
                break
            cut += int(0.015 * H)
        else:
            return None
        h = H - cut
        w = min(W, int(h * 0.75))
        cols = np.where(person[cut:].any(axis=0))[0]
        centre = (cols.min() + cols.max()) / 2 if len(cols) else W / 2
        x0 = int(np.clip(centre - w / 2, 0, W - w))
        if w * h < MIN_AREA * W * H:
            return None                                         # a collage or a close-up: most of it would go
        return img.crop((x0, cut, x0 + w, H)), round(h / H, 3)
