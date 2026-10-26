"""Clothing redo (D-163): the person in a shop's photo gets a house model's face and skin; the garment, the light and
the background keep their own pixels. Only the face is drawn again (FLUX.2 [klein] on a close crop, the house model's
face as the reference); arms, legs and hands only change colour, towards the new face's skin. Every pixel the parser
calls clothing (and a band around it) is copied back from the original, so the garment cannot change."""

import cv2
import numpy as np
import torch
from PIL import Image

from .parts import FACE, GARMENT, HAIR, SAME_FACE, SKIN, Parts, grow, shrink, skin_colour

CROP_SIDE = 768                 # the face crop is drawn at this size (multiple of 16)
STEPS = 4
GARMENT_GUARD = 3               # pixels around the garment that never change
MAX_SHIFT = 25                  # the skin's colour moves at most this far (Lab), from a drawn face
NO_FACE_SHIFT = 10              # … and this far towards the house model when the listing shows no face at all


def lab_of(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2LAB).astype(np.float32)


def house_face(parts: Parts, house: Image.Image) -> Image.Image:
    """The house model's face, cropped like the photo's (2.2 × the face box), for the reference."""
    found = parts.faces(house)
    if not len(found):
        return house
    x, y, w, h = found[0][:4]
    return house.crop(_square(x, y, w, h, house.width, house.height, 2.2)).resize((512, 512), Image.LANCZOS)


def _square(x, y, w, h, W, H, scale) -> tuple[int, int, int, int]:
    side = int(max(w, h) * scale)
    cx, cy = x + w / 2, y + h * 0.58
    side = min(side, W, H)
    left = int(min(max(cx - side / 2, 0), W - side))
    top = int(min(max(cy - side / 2, 0), H - side))
    return left, top, left + side, top + side


class ClothingRedo:
    def __init__(self, parts: Parts, pipe) -> None:
        self.parts = parts
        self.pipe = pipe

    def has_face(self, img: Image.Image) -> bool:
        return bool(len(self.parts.faces(img)))

    def redo(self, img: Image.Image, house: Image.Image, who: str, seed: int,
             skin_delta: np.ndarray | None) -> tuple[Image.Image | None, dict]:
        """The new photo (None: no person to change) and what the checks found. `skin_delta`: how the listing's skin
        moved where its face was drawn (Lab), so a photo without a face moves the same way; checks["skin_delta"]
        carries it on."""
        img = img.convert("RGB")
        labels = self.parts.labels(img)
        rgb = np.array(img)
        lab = lab_of(img)
        face_px, skin_px = labels == FACE, np.isin(labels, SKIN)
        garment_guard = grow(np.isin(labels, GARMENT), GARMENT_GUARD)
        if face_px.mean() < 0.002 and skin_px.mean() < 0.005:
            return None, {"person": False}
        checks: dict = {"person": True}
        found = self.parts.faces(img)
        out = rgb.astype(np.float32)
        changed = np.zeros(labels.shape, bool)
        old_skin = skin_colour(lab, shrink(face_px, 3)) or skin_colour(lab, skin_px | face_px)
        delta = None
        if len(found):
            face = found[0]
            gen, mask = self._face(img, labels, face, house, who, seed, garment_guard)
            a = mask[..., None]
            out = out * (1 - a) + np.array(gen, np.float32) * a
            changed |= mask > 0
            drawn = skin_colour(lab_of(Image.fromarray(out.astype(np.uint8))), shrink(face_px, 3) & (mask > 0.9))
            if drawn is not None and old_skin is not None:
                delta = _capped(drawn[0] - old_skin[0], MAX_SHIFT)
            after = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
            again = self.parts.faces(after)
            checks["faces_after"] = int(len(again))
            if len(again):
                checks["same_as_before"] = self.parts.same(self.parts.identity(img, face),
                                                            self.parts.identity(after, again[0]))
                hf = self.parts.faces(house)
                if len(hf):
                    checks["like_house_model"] = self.parts.same(self.parts.identity(house, hf[0]),
                                                                 self.parts.identity(after, again[0]))
        checks["face_drawn"] = bool(len(found))
        if delta is None and skin_delta is not None:
            delta = skin_delta
        if delta is None and old_skin is not None:
            house_skin = skin_colour(lab_of(house), self.parts.labels(house) == FACE)
            if house_skin is not None:
                delta = _capped(house_skin[0] - old_skin[0], NO_FACE_SHIFT)
        # arms, legs, hands, neck, an ear: wherever the person (BiRefNet) looks like their skin, only the colour moves
        if old_skin is not None and delta is not None:
            person = self.pipe.mask(img) > 0.5
            tone = person & ~garment_guard & ~changed
            out = _move_skin(out, lab, tone, old_skin[0], delta)
            checks["skin_shift"] = float(np.linalg.norm(delta))
            checks["skin_delta"] = ",".join(f"{v:.2f}" for v in delta)
        result = np.clip(out, 0, 255).astype(np.uint8)
        result[garment_guard] = rgb[garment_guard]                       # the garment, exactly as it was
        checks["garment_changed_px"] = int((result[garment_guard] != rgb[garment_guard]).any(axis=-1).sum())
        checks["changed_share"] = float((result != rgb).any(axis=-1).mean())
        checks["pass"] = _passes(checks)
        return Image.fromarray(result), checks

    def _face(self, img, labels, face, house, who, seed, garment_guard) -> tuple[Image.Image, np.ndarray]:
        """The face drawn again on a close crop; returns the full-size drawing and how much of it to use (0..1)."""
        x, y, w, h = face[:4]
        box = _square(x, y, w, h, img.width, img.height, 2.2)
        crop = img.crop(box)
        side = box[2] - box[0]
        prompt = (f"The blurred face in image 1 shows the face of the {who} in image 2: draw it sharp, clearly the "
                  f"person from image 2, with image 1's head angle and a natural expression. Keep image 1's hair, "
                  f"earrings, jewellery, clothes, lighting, colours and background exactly the same. Photorealistic "
                  f"photo, natural skin texture, sharp eyes.")
        ref = house_face(self.parts, house)
        # the old face blurred away first, so the drawing has only the house model's face to go by
        hidden = np.array(crop.resize((CROP_SIDE, CROP_SIDE), Image.LANCZOS))
        k = CROP_SIDE / side
        fx0, fy0 = int((x - box[0]) * k), int((y - box[1]) * k)
        fx1, fy1 = int((x + w - box[0]) * k), int((y + h - box[1]) * k)
        blur = cv2.GaussianBlur(hidden, (0, 0), max(fx1 - fx0, 8) / 6)
        oval = np.zeros(hidden.shape[:2], np.float32)
        cv2.ellipse(oval, ((fx0 + fx1) // 2, (fy0 + fy1) // 2), ((fx1 - fx0) // 2, int((fy1 - fy0) * 0.55)), 0, 0,
                    360, 1.0, -1)
        oval = cv2.GaussianBlur(oval, (0, 0), (fx1 - fx0) / 10)[..., None]
        hidden = (hidden * (1 - oval) + blur * oval).astype(np.uint8)
        pipe = self.pipe._flux()
        drawn = pipe(image=[Image.fromarray(hidden), ref], prompt=prompt,
                     width=CROP_SIDE, height=CROP_SIDE, num_inference_steps=STEPS, guidance_scale=1.0,
                     generator=torch.Generator("cuda").manual_seed(seed)).images[0]
        full = img.copy()
        full.paste(drawn.resize((side, side), Image.LANCZOS), box[:2])
        # where: the face (with the neck and ears the parser counts in it) and a band into the hair and background
        # around it, never near the garment; jewellery outside the face box keeps its pixels (its colour is not skin)
        region = np.zeros(labels.shape, bool)
        region[box[1]:box[3], box[0]:box[2]] = True
        face_px = (labels == FACE) & region
        band = max(3, int(0.025 * side))
        allowed = grow(face_px, band) & np.isin(labels, (FACE, HAIR, 0)) & ~garment_guard & region
        lab = lab_of(img)
        skin = skin_colour(lab, shrink(face_px, 3))
        if skin is not None:
            core = np.zeros(labels.shape, bool)
            fx0, fy0 = int(x - 0.1 * w), int(y - 0.1 * h)
            core[max(fy0, 0):int(y + 1.1 * h), max(fx0, 0):int(x + 1.1 * w)] = True
            not_skin = np.linalg.norm(lab - skin[0], axis=2) > 40
            allowed &= ~(not_skin & (labels != HAIR) & ~core)
        soft = cv2.GaussianBlur(allowed.astype(np.float32), (0, 0), max(1.0, band / 3)) * allowed
        return full, soft


def _move_skin(out: np.ndarray, lab: np.ndarray, where: np.ndarray, skin: np.ndarray, delta: np.ndarray) -> np.ndarray:
    """Skin's colour moved by `delta` (Lab), as strongly as a pixel looks like the old skin, so shading stays and
    bangles, mehndi, rings and a white trouser the parser took for a leg keep their colour."""
    likeness = np.clip(1.6 - np.linalg.norm(lab - skin, axis=2) / 28, 0, 1) * where
    likeness = cv2.GaussianBlur(likeness.astype(np.float32), (0, 0), 2) * where
    target = lab + delta[None, None, :] * likeness[..., None]
    rgb_new = cv2.cvtColor(np.clip(target, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
    return np.where((likeness > 0.01)[..., None], rgb_new, out)


def _capped(delta: np.ndarray, limit: float) -> np.ndarray:
    n = float(np.linalg.norm(delta))
    return delta * (limit / n) if n > limit else delta


def _passes(c: dict) -> bool:
    if c.get("garment_changed_px", 1) != 0:
        return False
    if not c.get("face_drawn"):
        return True
    # a different person: SFace says so, or the face is more the house model's than the old one's
    same, house = c.get("same_as_before"), c.get("like_house_model")
    return c.get("faces_after") == 1 and same is not None and (same < SAME_FACE or (house is not None and same < house))
