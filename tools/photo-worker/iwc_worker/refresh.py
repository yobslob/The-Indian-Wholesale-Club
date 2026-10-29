"""The light refresh (D-163): a shop's photo made IWC's own by a fixed change, with nothing cut out and nothing drawn,
so it cannot go wrong the way a cutout can.
  paper   a photo on a white backdrop (most packshots): the backdrop becomes the store's paper colour and the product is
          framed 3 : 4 (the cards' shape: today a square photo loses its sides there) with a soft shadow under it
  fit     any other food or home photo: shown whole on paper, 3 : 4, with rounded corners
  closer  clothing without a face: reframed 3 : 4 a little closer (its colours, fabric and light stay exact)
Food and home also get a gentle warm grade. The check reports how far the new photo's perceptual hashes (pHash and
dHash, 64 bits) are from the shop's: at least MIN_DISTANCE bits passes. Measured on 164 live clothing photos, crops,
frames and grades are what such hashes are built to see through (a 24 % zoom still left a fifth under 12 bits); the
paper backdrop moves them reliably, so a photo that stays close is shown as "check it", never claimed as new."""

import cv2
import numpy as np
from PIL import Image

PAPER_TOP = np.array([251, 248, 243], np.float32)      # tokens: paper (#FBF8F3)
PAPER_BOTTOM = np.array([243, 236, 225], np.float32)   # a shade towards surface, for depth
RATIO = 3 / 4                                          # width : height of every card and gallery photo
MIN_DISTANCE = 14                                      # of 64 bits; near-duplicate finders flag about 10 or fewer
FILL = (0.80, 0.86, 0.72)                              # the product's share of the frame, tried in turn
INSET = (0.94, 0.90)                                   # a whole photo's share of the frame (fit), tried in turn


def phash(img: Image.Image) -> np.ndarray:
    g = cv2.resize(np.array(img.convert("L"), np.float32), (32, 32), interpolation=cv2.INTER_AREA)
    d = cv2.dct(g)[:8, :8].flatten()[1:]
    return d > np.median(d)


def dhash(img: Image.Image) -> np.ndarray:
    g = cv2.resize(np.array(img.convert("L"), np.float32), (9, 8), interpolation=cv2.INTER_AREA)
    return (g[:, 1:] > g[:, :-1]).flatten()


def distance(a: Image.Image, b: Image.Image) -> tuple[int, int]:
    return int((phash(a) != phash(b)).sum()), int((dhash(a) != dhash(b)).sum())


def white_backdrop(rgb: np.ndarray) -> bool:
    h, w = rgb.shape[:2]
    k = max(2, int(0.02 * min(h, w)))
    border = np.concatenate([rgb[:k].reshape(-1, 3), rgb[-k:].reshape(-1, 3), rgb[:, :k].reshape(-1, 3),
                             rgb[:, -k:].reshape(-1, 3)])
    return float((border.min(axis=1) > 236).mean()) >= 0.85


def _on_paper(rgb: np.ndarray, fill: float) -> Image.Image:
    """The product (everything not backdrop-white) framed 3 : 4 on paper, never enlarged."""
    ink = rgb.min(axis=2) < 243
    ys, xs = np.where(cv2.dilate(ink.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
    crop = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
    ch, cw = crop.shape[:2]
    H = int(max(ch / fill, cw / (fill * RATIO * 1.08)))
    W = int(H * RATIO)
    t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    canvas = PAPER_TOP * (1 - t) + PAPER_BOTTOM * t
    canvas = np.repeat(canvas, W, axis=1)
    top = int(0.53 * H - ch / 2)
    left = (W - cw) // 2
    # a soft contact shadow under the product, on the paper only
    shadow = np.zeros((H, W), np.float32)
    cv2.ellipse(shadow, (W // 2, min(H - 1, top + ch)), (int(cw * 0.36), max(3, int(ch * 0.035))), 0, 0, 360, 1.0, -1)
    shadow = cv2.GaussianBlur(shadow, (0, 0), max(4.0, cw * 0.04))
    canvas = canvas * (1 - 0.16 * shadow[..., None])
    # the shop's white becomes the paper, smoothly: only near-white pixels move, the product keeps its colours
    white = crop.min(axis=2)
    w = np.clip((white - 236) / 16, 0, 1)[..., None]
    w = w * w * (3 - 2 * w)
    region = canvas[top:top + ch, left:left + cw]
    canvas[top:top + ch, left:left + cw] = crop * (1 - w) + region * w
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))


def _fit(rgb: np.ndarray, scale: float) -> Image.Image:
    """The whole photo on paper, 3 : 4, rounded corners: nothing of it is lost."""
    h, w = rgb.shape[:2]
    H = max(h, int(w / RATIO))
    W = int(H * RATIO)
    t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    canvas = np.repeat(PAPER_TOP * (1 - t) + PAPER_BOTTOM * t, W, axis=1)
    k = min(W * scale / w, H * scale / h)
    pw, ph = int(w * k), int(h * k)
    photo = np.array(Image.fromarray(rgb).resize((pw, ph), Image.LANCZOS), np.float32)
    r = max(4, int(0.035 * min(pw, ph)))
    mask = np.zeros((ph, pw), np.uint8)
    cv2.rectangle(mask, (r, 0), (pw - r, ph), 1, -1)
    cv2.rectangle(mask, (0, r), (pw, ph - r), 1, -1)
    for cx, cy in ((r, r), (pw - r - 1, r), (r, ph - r - 1), (pw - r - 1, ph - r - 1)):
        cv2.circle(mask, (cx, cy), r, 1, -1)
    mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.8)[..., None]
    top, left = (H - ph) // 2, (W - pw) // 2
    region = canvas[top:top + ph, left:left + pw]
    canvas[top:top + ph, left:left + pw] = photo * mask + region * (1 - mask)
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))


def closer(rgb: np.ndarray, zoom: float = 1.06) -> Image.Image:
    """A 3 : 4 frame a little closer than the shop's, its centre moved slightly up and left."""
    h, w = rgb.shape[:2]
    fh = h / zoom
    fw = fh * RATIO
    if fw > w / zoom:
        fw = w / zoom
        fh = fw / RATIO
    cx, cy = w / 2 - 0.015 * w, h / 2 - 0.02 * h
    x0 = int(np.clip(cx - fw / 2, 0, w - fw))
    y0 = int(np.clip(cy - fh / 2, 0, h - fh))
    return Image.fromarray(rgb[y0:y0 + int(fh), x0:x0 + int(fw)])


def _grade(img: Image.Image) -> Image.Image:
    """A gentle warm, tempting grade: a little warmth, contrast and colour."""
    x = np.array(img, np.float32) / 255
    x = x * np.array([1.025, 1.0, 0.975], np.float32)
    x = 0.5 + (x - 0.5) * 1.05
    grey = x.mean(axis=2, keepdims=True)
    x = grey + (x - grey) * 1.08
    return Image.fromarray(np.clip(x * 255, 0, 255).astype(np.uint8))


def flat(img: Image.Image) -> Image.Image:
    """RGB, a transparent backdrop made white (a shop's PNG with no background would otherwise turn black)."""
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        white = Image.new("RGBA", img.size, (255, 255, 255, 255))
        return Image.alpha_composite(white, img).convert("RGB")
    return img.convert("RGB")


def refresh(img: Image.Image, kind: str, paper: bool) -> tuple[Image.Image, dict]:
    """The refreshed photo and its checks. `kind`: food, home or clothing; `paper`: a white backdrop may become paper
    (not for garments, whose white fabric would melt into it)."""
    img = flat(img)
    rgb = np.array(img)
    if paper and white_backdrop(rgb) and (rgb.min(axis=2) < 243).any():
        style, tries = "paper", [lambda f=f: _on_paper(rgb, f) for f in FILL]
    elif kind == "clothing":
        style, tries = "closer", [lambda: closer(rgb)]
    else:
        style, tries = "fit", [lambda k=k: _fit(rgb, k) for k in INSET]
    out, dist = img, (0, 0)
    for make in tries:
        out = make()
        if kind != "clothing":
            out = _grade(out)
        dist = distance(img, out)
        if min(dist) >= MIN_DISTANCE:
            break
    return out, {"style": style, "phash_bits": dist[0], "dhash_bits": dist[1], "pass": min(dist) >= MIN_DISTANCE}
