"""Face swap (D-165): a house model's identity on the shop photo's face, as a dedicated swapper does it, not a drawing.
The face is aligned from its five landmarks (YuNet) to the swapper's template, the swapper (HyperSwap 256, or
inswapper 128) gives the same head, pose, expression and light with the house model's features, GFPGAN restores detail
on a large face, and the result goes back through the inverse alignment with a soft-edged mask, so there is no edge to
see. Models (FaceFusion's releases, in IWC_MODELS/faceswap): hyperswap_1a_256, inswapper_128_fp16, arcface_w600k_r50,
gfpgan_1.4."""

import cv2
import numpy as np
from PIL import Image

from .pipeline import MODELS

# five-point templates (eyes, nose, mouth corners), as shares of the crop
ARCFACE_112 = np.array([[0.34191607, 0.46157411], [0.65653393, 0.45983393], [0.500225, 0.64050536],
                        [0.37097589, 0.82469196], [0.63151696, 0.82325089]], np.float32)
ARCFACE_128 = np.array([[0.36167656, 0.40387734], [0.63696719, 0.40235469], [0.50019687, 0.56044219],
                        [0.38710391, 0.72160547], [0.61507734, 0.72034453]], np.float32)
FFHQ_512 = np.array([[0.37691676, 0.46864664], [0.62285697, 0.46912813], [0.50123859, 0.61331904],
                     [0.39308822, 0.72541100], [0.61150205, 0.72490465]], np.float32)
SWAPPERS = {"hyperswap": ("hyperswap_1a_256.onnx", 256, 0.5, 0.5), "inswapper": ("inswapper_128_fp16.onnx", 128, 0.0, 1.0)}
ENHANCE_FROM = 150              # a face this many pixels wide or more is restored (the swap works at 256 or 128)
ENHANCE_BLEND = 0.7


def _session(name: str):
    import onnxruntime as ort
    return ort.InferenceSession(str(MODELS / "faceswap" / name),
                                providers=["CUDAExecutionProvider", "CPUExecutionProvider"])


def _align(rgb: np.ndarray, points: np.ndarray, template: np.ndarray, size: int) -> tuple[np.ndarray, np.ndarray]:
    m, _ = cv2.estimateAffinePartial2D(points.astype(np.float32), template * size, method=cv2.LMEDS)
    return cv2.warpAffine(rgb, m, (size, size), borderMode=cv2.BORDER_REPLICATE, flags=cv2.INTER_AREA), m


def _box_mask(size: int, blur: float = 0.3, top: float = 0.0) -> np.ndarray:
    """FaceFusion's box mask: the whole crop with soft edges (blur as a share of half the side)."""
    amount = int(size * 0.5 * blur)
    area = max(amount // 2, 1)
    mask = np.ones((size, size), np.float32)
    mask[:max(area, int(size * top)), :] = 0
    mask[-area:, :] = 0
    mask[:, :area] = 0
    mask[:, -area:] = 0
    return cv2.GaussianBlur(mask, (0, 0), amount * 0.25) if amount > 0 else mask


class FaceSwap:
    def __init__(self, swapper: str = "hyperswap") -> None:
        self.kind = swapper
        self.swapper = self.arcface = self.gfpgan = None
        self.emap = None

    def _models(self) -> None:
        if self.swapper is None:
            self.swapper = _session(SWAPPERS[self.kind][0])
            self.arcface = _session("arcface_w600k_r50.onnx")
            self.gfpgan = _session("gfpgan_1.4.onnx")
            if self.kind == "inswapper":
                import onnx
                from onnx import numpy_helper
                model = onnx.load(str(MODELS / "faceswap" / SWAPPERS["inswapper"][0]))
                self.emap = numpy_helper.to_array(model.graph.initializer[-1]).astype(np.float32)

    def identity(self, img: Image.Image, points: np.ndarray) -> np.ndarray:
        """The swapper's source: the face's ArcFace embedding (the house model's)."""
        self._models()
        crop, _ = _align(np.array(img.convert("RGB")), points, ARCFACE_112, 112)
        x = ((crop.astype(np.float32) - 127.5) / 127.5).transpose(2, 0, 1)[None]
        emb = self.arcface.run(None, {"input": x})[0].reshape(1, -1)
        if self.kind == "inswapper":
            return (emb @ self.emap / np.linalg.norm(emb)).astype(np.float32)
        return (emb / np.linalg.norm(emb)).astype(np.float32)

    def swap(self, img: Image.Image, points: np.ndarray, face_width: float,
             source: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """The photo with the face swapped (RGB), and how much of each pixel came from the swap (0..1)."""
        self._models()
        name, size, mean, std = SWAPPERS[self.kind]
        rgb = np.array(img.convert("RGB"))
        crop, m = _align(rgb, points, ARCFACE_128, size)
        x = ((crop.astype(np.float32) / 255 - mean) / std).transpose(2, 0, 1)[None]
        outs = self.swapper.run(None, {"source": source, "target": x})
        swapped = np.clip((outs[0][0].transpose(1, 2, 0) * std + mean) * 255, 0, 255).astype(np.uint8)
        mask = _box_mask(size)
        if len(outs) > 1:                                  # HyperSwap's own face mask, softened
            mask = np.minimum(mask, cv2.GaussianBlur(np.clip(outs[1][0, 0], 0, 1), (0, 0), size / 64))
        inv = cv2.invertAffineTransform(m)
        h, w = rgb.shape[:2]
        back = cv2.warpAffine(swapped, inv, (w, h), borderMode=cv2.BORDER_REPLICATE, flags=cv2.INTER_CUBIC)
        alpha = np.clip(cv2.warpAffine(mask, inv, (w, h)), 0, 1)
        out = rgb * (1 - alpha[..., None]) + back * alpha[..., None]
        if face_width >= ENHANCE_FROM:
            out = self._enhance(out.astype(np.uint8), points, alpha)
        return np.clip(out, 0, 255).astype(np.uint8), alpha

    def _enhance(self, rgb: np.ndarray, points: np.ndarray, alpha: np.ndarray) -> np.ndarray:
        """GFPGAN on the swapped face, blended in where the swap is."""
        crop, m = _align(rgb, points, FFHQ_512, 512)
        x = ((crop.astype(np.float32) / 255 - 0.5) / 0.5).transpose(2, 0, 1)[None]
        y = np.clip((self.gfpgan.run(None, {"input": x})[0][0].transpose(1, 2, 0) * 0.5 + 0.5) * 255, 0, 255)
        crop = crop * (1 - ENHANCE_BLEND) + y * ENHANCE_BLEND
        inv = cv2.invertAffineTransform(m)
        h, w = rgb.shape[:2]
        back = cv2.warpAffine(crop.astype(np.uint8), inv, (w, h), borderMode=cv2.BORDER_REPLICATE,
                              flags=cv2.INTER_CUBIC)
        a = np.clip(cv2.warpAffine(_box_mask(512, 0.3), inv, (w, h)), 0, 1) * alpha
        return rgb * (1 - a[..., None]) + back * a[..., None]
