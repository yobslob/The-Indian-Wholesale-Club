"""The redo's shared models: the cutout mask (BiRefNet), a scene's drawing (FLUX.2 [klein] 4B in 4-bit) and the x2 upscale
(Real-ESRGAN). They load on first use and can be unloaded to give the GPU back. Licences: BiRefNet MIT, FLUX.2 [klein] 4B
Apache 2.0, Real-ESRGAN BSD-3."""

import gc
import os
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image

MODELS = Path(os.environ.get("IWC_MODELS", r"C:\kod\iwc-photo-models"))


class Pipeline:
    def __init__(self) -> None:
        self.seg = None
        self.flux = None
        self.esr = None

    # --- models --------------------------------------------------------------------------------------------------
    def _seg(self):
        if self.seg is None:
            from transformers import AutoModelForImageSegmentation
            self.seg = AutoModelForImageSegmentation.from_pretrained(str(MODELS / "birefnet"), trust_remote_code=True)
            self.seg.eval().half()
        return self.seg

    def _flux(self):
        if self.flux is None:
            from diffusers import BitsAndBytesConfig as DiffusersBnb
            from diffusers import Flux2KleinPipeline
            from diffusers.quantizers import PipelineQuantizationConfig
            from transformers import BitsAndBytesConfig as TransformersBnb
            nf4 = dict(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16)
            self.flux = Flux2KleinPipeline.from_pretrained(
                str(MODELS / "flux2-klein-4b"), torch_dtype=torch.bfloat16,
                quantization_config=PipelineQuantizationConfig(
                    quant_mapping={"transformer": DiffusersBnb(**nf4), "text_encoder": TransformersBnb(**nf4)}))
            self.flux.to("cuda")
        return self.flux

    def _esr(self):
        if self.esr is None:
            from spandrel import ModelLoader
            self.esr = ModelLoader().load_from_file(str(MODELS / "realesrgan" / "RealESRGAN_x2plus.pth")).eval()
        return self.esr

    @property
    def loaded(self) -> bool:
        return any(m is not None for m in (self.seg, self.flux, self.esr))

    def unload(self) -> None:
        self.seg = self.flux = self.esr = None
        gc.collect()
        torch.cuda.empty_cache()

    # --- image steps ---------------------------------------------------------------------------------------------
    def mask(self, img: Image.Image) -> np.ndarray:
        """Foreground probability (0..1) at the image's size. BiRefNet visits the GPU only while it works."""
        from torchvision import transforms
        tf = transforms.Compose([transforms.Resize((1024, 1024)), transforms.ToTensor(),
                                 transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
        seg = self._seg().to("cuda")
        with torch.no_grad():
            pred = seg(tf(img).unsqueeze(0).to("cuda").half())[-1].sigmoid().float().cpu()[0, 0].numpy()
        self.seg = seg.to("cpu")
        torch.cuda.empty_cache()
        return cv2.resize(pred, img.size, interpolation=cv2.INTER_LINEAR)

    def upscale(self, img: Image.Image) -> Image.Image:
        esr = self._esr().to("cuda")
        x = torch.from_numpy(np.array(img.convert("RGB"))).permute(2, 0, 1).float().div(255)[None].to("cuda")
        with torch.no_grad():
            y = esr(x).clamp(0, 1)[0].permute(1, 2, 0).mul(255).byte().cpu().numpy()
        self.esr = esr.to("cpu")
        torch.cuda.empty_cache()
        return Image.fromarray(y)
