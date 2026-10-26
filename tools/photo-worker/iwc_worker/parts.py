"""What is where in a clothing photo (D-163): a person's face, hair, arms and legs apart from the garment (SegFormer B2
fine-tuned on ATR's 18 labels), the faces themselves (YuNet) and whose face it is (SFace). The redo changes only the
person, so these masks decide which pixels may change at all."""

import cv2
import numpy as np
import torch
from PIL import Image

from .pipeline import MODELS

HAIR, FACE = 2, 11
SKIN = (12, 13, 14, 15)                                  # legs, arms (hands with them)
GARMENT = (1, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17)           # hat … scarf: everything worn or carried
SAME_FACE = 0.363                                        # SFace's cosine threshold for one person


class Parts:
    def __init__(self) -> None:
        self.parser = None
        self.processor = None
        self.detector = None
        self.recognizer = None

    def unload(self) -> None:
        self.parser = self.processor = None

    def labels(self, img: Image.Image) -> np.ndarray:
        """One ATR label per pixel, at the image's size."""
        if self.parser is None:
            from transformers import SegformerForSemanticSegmentation, SegformerImageProcessor
            path = str(MODELS / "segformer-clothes")
            self.processor = SegformerImageProcessor.from_pretrained(path)
            self.parser = SegformerForSemanticSegmentation.from_pretrained(path).eval()
        model = self.parser.to("cuda")
        inputs = self.processor(images=img.convert("RGB"), return_tensors="pt").to("cuda")
        with torch.no_grad():
            logits = model(**inputs).logits
        up = torch.nn.functional.interpolate(logits, size=(img.height, img.width), mode="bilinear", align_corners=False)
        self.parser = model.to("cpu")
        torch.cuda.empty_cache()
        return up.argmax(dim=1)[0].cpu().numpy().astype(np.uint8)

    def faces(self, img: Image.Image) -> np.ndarray:
        """Faces found, best first: rows of x, y, w, h, five landmarks (x, y), score (YuNet's layout)."""
        rgb = np.array(img.convert("RGB"))
        if self.detector is None:
            self.detector = cv2.FaceDetectorYN.create(str(MODELS / "opencv-face" / "face_detection_yunet_2023mar.onnx"),
                                                      "", (320, 320), 0.8)
        self.detector.setInputSize((rgb.shape[1], rgb.shape[0]))
        _, found = self.detector.detect(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
        if found is None:
            return np.zeros((0, 15), np.float32)
        return found[np.argsort(-found[:, 14])]

    def identity(self, img: Image.Image, face: np.ndarray) -> np.ndarray:
        """SFace's feature of one face (from `faces`)."""
        if self.recognizer is None:
            self.recognizer = cv2.FaceRecognizerSF.create(
                str(MODELS / "opencv-face" / "face_recognition_sface_2021dec.onnx"), "")
        bgr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
        return self.recognizer.feature(self.recognizer.alignCrop(bgr, face))

    def same(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(self.recognizer.match(a, b, cv2.FaceRecognizerSF_FR_COSINE))


def skin_colour(lab: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray] | None:
    """The skin's Lab mean and spread inside `mask` (a face): the pixels near the median, so eyes, lips, brows, shadow
    and earrings do not count."""
    px = lab[mask]
    if len(px) < 200:
        return None
    med = np.median(px, axis=0)
    near = px[np.linalg.norm(px - med, axis=1) < 22]
    if len(near) < 100:
        return None
    return near.mean(axis=0), near.std(axis=0) + 1e-3


def grow(mask: np.ndarray, px: int) -> np.ndarray:
    if px <= 0:
        return mask.astype(bool)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.dilate(mask.astype(np.uint8), k) > 0


def shrink(mask: np.ndarray, px: int) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.erode(mask.astype(np.uint8), k) > 0
