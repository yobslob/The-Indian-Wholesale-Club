"""Clothing redo (D-163): no shop model's face reaches the store, and no photo goes out with a face that looks wrong.
For a photo with a face:
  face  the face drawn again as the house model's (FLUX.2 [klein] on a close crop, the old face blurred away first),
        only when the face is large and turned to the camera, and only if every check after it passes: one face, in the
        same place, a different person, its colour matched to the neck around it with no seam. Only face pixels change;
        neck, arms and hands keep theirs.
  crop  every other photo with a face (a side pose, a small face, sunglasses, two people, a failed check): the photo is
        cut just under the chin and framed 3 : 4 around the person. Nothing is drawn, so nothing can look wrong.
A photo where the face fills most of the picture (a portrait) is left for the founder: keep it or remove it.
Without a face, the photo is only reframed a little (refresh.py). The garment's pixels are never touched."""

import cv2
import numpy as np
import torch
from PIL import Image

from .parts import FACE, HAIR, SAME_FACE, Parts, grow, shrink, skin_colour
from .refresh import closer

CROP_SIDE = 768                 # the face crop is drawn at this size (multiple of 16)
SUNGLASSES = 3
MIN_KEEP = 0.55                 # a cut that keeps less of the photo than this is a portrait: the founder decides
FACE_SCORE = 0.6                # YuNet: a face at all (profiles score lower)
MAX_MOVE = 0.12                 # the drawn face's box may move this share of the face's width …
MAX_SIZE = 1.15                 # … and grow or shrink this much
MAX_SEAM = 18.0                 # the colour step where the drawing meets the old skin (Lab, median): clean ones 6 - 13,
                                # a chin drawn above the old one 39 (2026-10-30)


def lab_of(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2LAB).astype(np.float32)


def _square(x, y, w, h, W, H, scale) -> tuple[int, int, int, int]:
    side = min(int(max(w, h) * scale), W, H)
    cx, cy = x + w / 2, y + h * 0.58
    left = int(min(max(cx - side / 2, 0), W - side))
    top = int(min(max(cy - side / 2, 0), H - side))
    return left, top, left + side, top + side


def house_face(parts: Parts, house: Image.Image) -> Image.Image:
    """The house model's face, cropped like the photo's (2.2 × the face box), for the reference."""
    found = parts.faces(house)
    if not len(found):
        return house
    x, y, w, h = found[0][:4]
    return house.crop(_square(x, y, w, h, house.width, house.height, 2.2)).resize((512, 512), Image.LANCZOS)


def frontal(face: np.ndarray, labels: np.ndarray, W: int) -> str | None:
    """Why this face may not be drawn again (None: it may): it must be large, sure, turned to the camera, level."""
    x, y, w, h = face[:4]
    (rx, ry), (lx, ly), (nx, ny), (mrx, mry), (mlx, mly) = face[4:14].reshape(5, 2)
    eye = float(np.hypot(lx - rx, ly - ry))
    if face[14] < 0.9:
        return "face not sure"
    if w < max(60, 0.06 * W):
        return "face small"
    if eye < 0.3 * w:
        return "turned away"
    yaw = (nx - (rx + lx) / 2) / eye
    pitch = (ny - (ry + ly) / 2) / max(((mry + mly) / 2 - (ry + ly) / 2), 1)
    if abs(yaw) > 0.2:
        return "side pose"
    if not 0.35 <= pitch <= 0.75:
        return "looking up or down"
    if abs(np.degrees(np.arctan2(ly - ry, lx - rx))) > 15:
        return "head tilted"
    box = labels[int(y):int(y + h), int(x):int(x + w)]
    if (box == SUNGLASSES).mean() > 0.02:
        return "sunglasses"
    return None


class ClothingRedo:
    def __init__(self, parts: Parts, pipe) -> None:
        self.parts = parts
        self.pipe = pipe

    def faces(self, img: Image.Image) -> np.ndarray:
        found = self.parts.faces(img)
        return found[found[:, 14] >= FACE_SCORE] if len(found) else found

    def redo(self, img: Image.Image, house: Image.Image | None, who: str, seed: int,
             redraw: bool) -> tuple[Image.Image | None, dict]:
        """The new photo (None: the founder decides) and what the checks found; checks["mode"] is face, crop or fresh.
        `redraw`: a face may be drawn again (a house model for who wears it; never kids)."""
        labels = self.parts.labels(img)
        found = self.faces(img)
        heads = _heads(labels)
        if not len(found) and not heads:
            return closer(np.array(img)), {"mode": "fresh", "pass": True}
        checks: dict = {"faces": int(len(found))}
        if len(found) == 1 and redraw and house is not None:
            why = frontal(found[0], labels, img.width)
            if why is None:
                drawn, face_checks = self._draw(img, labels, found[0], house, who, seed)
                checks.update(face_checks)
                if face_checks["pass"]:
                    checks["mode"] = "face"
                    return drawn, checks
                why = face_checks["why"]
            checks["not_drawn"] = why
        elif len(found) > 1:
            checks["not_drawn"] = "two or more people"
        cut = self._crop(img, labels, found, heads)
        if cut is None:
            if not len(found):
                # a cheek or an ear with no face in it (an earring close-up): nobody can be known from it
                return closer(np.array(img)), {**checks, "mode": "fresh", "pass": True}
            return None, {**checks, "mode": "crop", "why": "the face fills the photo: keep it or remove it", "pass": False}
        out, keep = cut
        checks.update({"mode": "crop", "kept_share": keep, "pass": True})
        return out, checks

    # --- crop ----------------------------------------------------------------------------------------------------
    def _crop(self, img, labels, found, heads) -> tuple[Image.Image, float] | None:
        """Cut just under the lowest chin and frame 3 : 4 around the person; checked: no face left in it."""
        H, W = labels.shape
        chins = [f[1] + f[3] * 1.08 for f in found]
        chins += [min(y1, y0 + 1.3 * (x1 - x0)) for x0, y0, x1, y1 in heads]
        cut = int(max(chins) + 0.01 * H)
        person = self.pipe.mask(img) > 0.5
        for _ in range(5):
            if (H - cut) / H < MIN_KEEP:
                return None
            part = img.crop((0, cut, W, H))
            left_px = labels[cut:cut + max(1, int(0.2 * (H - cut)))] == FACE
            if not len(self.faces(part)) and left_px.mean() < 0.002:
                break
            cut += int(0.03 * H)
        else:
            return None
        h = H - cut
        w = min(W, int(h * 0.75))
        cols = np.where(person[cut:].any(axis=0))[0]
        centre = (cols.min() + cols.max()) / 2 if len(cols) else W / 2
        x0 = int(np.clip(centre - w / 2, 0, W - w))
        return img.crop((x0, cut, x0 + w, H)), round(h / H, 3)

    # --- draw ----------------------------------------------------------------------------------------------------
    def _draw(self, img, labels, face, house, who, seed) -> tuple[Image.Image, dict]:
        x, y, w, h = face[:4]
        box = _square(x, y, w, h, img.width, img.height, 2.2)
        side = box[2] - box[0]
        crop = np.array(img.crop(box).resize((CROP_SIDE, CROP_SIDE), Image.LANCZOS))
        k = CROP_SIDE / side
        fx0, fy0, fx1, fy1 = [int(v) for v in ((x - box[0]) * k, (y - box[1]) * k, (x + w - box[0]) * k,
                                               (y + h - box[1]) * k)]
        # the old face blurred away first, so the drawing has only the house model's face to go by
        blur = cv2.GaussianBlur(crop, (0, 0), max(fx1 - fx0, 8) / 6)
        oval = np.zeros(crop.shape[:2], np.float32)
        cv2.ellipse(oval, ((fx0 + fx1) // 2, (fy0 + fy1) // 2), ((fx1 - fx0) // 2, int((fy1 - fy0) * 0.55)), 0, 0,
                    360, 1.0, -1)
        oval = cv2.GaussianBlur(oval, (0, 0), (fx1 - fx0) / 10)[..., None]
        hidden = (crop * (1 - oval) + blur * oval).astype(np.uint8)
        prompt = (f"The blurred face in image 1 shows the face of the {who} in image 2: draw it sharp, clearly the "
                  f"person from image 2, with image 1's head angle and a natural expression. Keep image 1's hair, "
                  f"earrings, jewellery, clothes, lighting, colours and background exactly the same. Photorealistic "
                  f"photo, natural skin texture, sharp eyes.")
        drawn = self.pipe._flux()(image=[Image.fromarray(hidden), house_face(self.parts, house)], prompt=prompt,
                                  width=CROP_SIDE, height=CROP_SIDE, num_inference_steps=4, guidance_scale=1.0,
                                  generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        full = img.copy()
        full.paste(drawn.resize((side, side), Image.LANCZOS), box[:2])
        # only the face (the parser's face, with ears; the neck stays) and a thin band into hair and background
        region = np.zeros(labels.shape, bool)
        region[box[1]:box[3], box[0]:box[2]] = True
        face_px = (labels == FACE) & region
        core = np.zeros(labels.shape, bool)
        core[int(y):int(y + h * 1.02), int(x):int(x + w)] = True
        face_px &= core | grow(core, int(0.08 * w))
        band = max(3, int(0.02 * side))
        allowed = grow(face_px, band) & np.isin(labels, (FACE, HAIR, 0)) & region
        allowed &= ~grow(~np.isin(labels, (FACE, HAIR, 0)), 3)        # never near the garment
        soft = cv2.GaussianBlur(allowed.astype(np.float32), (0, 0), max(1.0, band / 3)) * allowed
        # the drawn face takes the colour of the skin around it, so it meets the neck without a seam
        lab_old, lab_new = lab_of(img), lab_of(full)
        inner = shrink(face_px, 3) & core
        old_skin, new_skin = skin_colour(lab_old, inner), skin_colour(lab_new, inner)
        if old_skin is not None and new_skin is not None:
            (om, osd), (nm, nsd) = old_skin, new_skin
            lab_new = (lab_new - nm) * np.clip(osd / nsd, 0.7, 1.4) + om
        matched = cv2.cvtColor(np.clip(lab_new, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
        a = soft[..., None]
        rgb = np.array(img, np.float32)
        out = np.clip(rgb * (1 - a) + matched * a, 0, 255).astype(np.uint8)
        result = Image.fromarray(out)
        # the seam: where the drawing fades into the old picture over skin (the chin, the neck), how far apart they are
        edge = (soft > 0.02) & (soft < 0.9) & (labels == FACE)
        seam = np.linalg.norm(lab_of(Image.fromarray(matched.astype(np.uint8))) - lab_old, axis=2)[edge]
        return result, self._checks(img, result, face, house, soft, seam)

    def _checks(self, before, after, face, house, soft, seam: np.ndarray) -> dict:
        """Every one must pass, or the photo is cropped instead."""
        c: dict = {"pass": False}
        again = self.parts.faces(after)
        again = again[again[:, 14] >= 0.85] if len(again) else again
        c["faces_after"] = int(len(again))
        if len(again) != 1:
            c["why"] = "the drawn face was not found once"
            return c
        new = again[0]
        w = float(face[2])
        # where the head is and how big: the features themselves move with a new face, the head must not
        moved = float(np.hypot(new[0] + new[2] / 2 - face[0] - w / 2, new[1] + new[3] / 2 - face[1] - face[3] / 2)) / w
        c["moved"] = moved
        c["size"] = float(new[2]) / w
        c["same_as_before"] = self.parts.same(self.parts.identity(before, face), self.parts.identity(after, new))
        hf = self.parts.faces(house)
        if len(hf):
            c["like_house_model"] = self.parts.same(self.parts.identity(house, hf[0]), self.parts.identity(after, new))
        c["seam"] = float(np.median(seam)) if len(seam) else 0.0
        changed = (np.array(after) != np.array(before)).any(axis=-1)
        c["outside_face_px"] = int((changed & (soft == 0)).sum())
        different = c["same_as_before"] < SAME_FACE or c["same_as_before"] < c.get("like_house_model", -1)
        if moved > MAX_MOVE or not 1 / MAX_SIZE <= c["size"] <= MAX_SIZE:
            c["why"] = "the drawn face moved"
        elif not different:
            c["why"] = "still the same person"
        elif c["seam"] > MAX_SEAM:
            c["why"] = "a visible seam"
        elif c["outside_face_px"]:
            c["why"] = "pixels outside the face changed"
        else:
            c["pass"] = True
        return c


def _heads(labels: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Face-label shapes that are a head (a profile YuNet misses): big enough and with hair beside them (the parser
    sometimes calls a bare torso a face; a torso has no hair). Their boxes."""
    n, comp, stats, _ = cv2.connectedComponentsWithStats((labels == FACE).astype(np.uint8))
    floor = 0.002 * labels.size
    hair = labels == HAIR
    heads = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < floor:
            continue
        near = grow(comp == i, max(4, int(0.15 * max(w, h))))
        if (near & hair).sum() >= 0.05 * area:
            heads.append((int(x), int(y), int(x + w), int(y + h)))
    return heads
