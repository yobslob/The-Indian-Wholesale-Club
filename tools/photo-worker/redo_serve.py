"""The photo redo as a local service for the sourcing runner (D-168): a new listing's photos are made again before
they are uploaded, so they never wait for `pnpm photos:redo` (fetch, redo.py, review, publish).

    .venv\\Scripts\\python redo_serve.py [--port 4318]

The runner starts it by itself when it is not running (tools/sourcing-runner/src/redo.ts). This machine only
(127.0.0.1), one listing at a time (the GPU's). POST /listing with {"type", "wears", "photos": [base64 …]} answers
{"photos": [{"status", "mode", "pass", "note", "image"}], "house_model"}: the same work as redo.py (clothing: a face
swapped to the house model or cut at the chin, a photo without a face reframed, a portrait left for the founder;
food and home: the light refresh). The models are let go after 10 idle minutes and the service ends after 30.
"""

import argparse
import base64
import io
import json
import logging
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from logging.handlers import RotatingFileHandler
from pathlib import Path

from PIL import Image

from iwc_worker.parts import Parts
from iwc_worker.pipeline import Pipeline
from iwc_worker.redo_clothing import ClothingRedo
from iwc_worker.refresh import flat, refresh
from redo import house_models, pick_model

HERE = Path(__file__).resolve().parent
UNLOAD_AFTER = 10 * 60
STOP_AFTER = 30 * 60
log = logging.getLogger("iwc-redo-serve")


class Work:
    def __init__(self) -> None:
        self.pipe = Pipeline()
        self.parts = Parts()
        self.clothing: ClothingRedo | None = None
        self.models: dict | None = None
        self.last = time.time()
        self.lock = threading.Lock()

    def listing(self, body: dict) -> dict:
        kind = body["type"]
        images = [flat(Image.open(io.BytesIO(base64.b64decode(p)))) for p in body["photos"]]
        if kind == "clothing":
            return self._clothing(images, body.get("wears"))
        out = []
        for img in images:
            try:
                new, checks = refresh(img, kind, paper=True)
                out.append(result("made", "fresh", bool(checks["pass"]), checks["style"], new))
            except Exception as error:  # one photo's failure leaves it as it is
                out.append(result("failed", None, False, str(error)[:200]))
        return {"photos": out, "house_model": None}

    def _clothing(self, images: list[Image.Image], wears: str | None) -> dict:
        if self.clothing is None:
            self.clothing = ClothingRedo(self.parts, self.pipe)
        if self.models is None:
            self.models = house_models(self.parts)
        # kids are never given a house model's face (D-102): theirs are always cut off
        slug = None
        if wears != "kids" and self.models:
            slug = pick_model(self.models, "men" if wears == "men" else "women", self.parts, images)
        house = self.models.get(slug, {}).get("image") if slug else None
        out = []
        for img in images:
            try:
                new, checks = self.clothing.redo(img, house, house is not None)
                if new is None:
                    out.append(result("failed", checks.get("mode"), False, checks.get("why", "")))
                else:
                    out.append(result("made", checks["mode"], bool(checks.get("pass")), checks["mode"], new))
            except Exception as error:  # one photo's failure leaves the listing for the review page
                log.error("clothing photo: %s", error)
                log.debug(traceback.format_exc())
                out.append(result("failed", None, False, str(error)[:200]))
        used = any(p["mode"] == "face" for p in out)
        return {"photos": out, "house_model": slug if used else None}

    def idle(self) -> bool:
        """Lets the models go after 10 idle minutes; True once the service should end."""
        quiet = time.time() - self.last
        if quiet > UNLOAD_AFTER and (self.pipe.loaded or self.parts.parser is not None):
            with self.lock:
                self.pipe.unload()
                self.parts.unload()
            log.info("idle: models let go")
        return quiet > STOP_AFTER


def result(status: str, mode: str | None, passed: bool, note: str, image: Image.Image | None = None) -> dict:
    data = None
    if image is not None:
        buf = io.BytesIO()
        image.convert("RGB").save(buf, "JPEG", quality=95)
        data = base64.b64encode(buf.getvalue()).decode("ascii")
    return {"status": status, "mode": mode, "pass": passed, "note": note, "image": data}


def handler(work: Work):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):  # the runner logs what matters
            pass

        def _send(self, code: int, doc: dict) -> None:
            body = json.dumps(doc).encode("utf-8")
            self.send_response(code)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            self._send(200, {"ok": True}) if self.path == "/health" else self._send(404, {})

        def do_POST(self):
            if self.path != "/listing":
                return self._send(404, {})
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
                started = time.time()
                with work.lock:
                    answer = work.listing(body)
                work.last = time.time()
                modes = [p["mode"] or p["status"] for p in answer["photos"]]
                log.info("%s: %s in %.0f s", body["type"], ", ".join(modes), time.time() - started)
                self._send(200, answer)
            except Exception as error:
                log.error("listing: %s", error)
                log.debug(traceback.format_exc())
                self._send(500, {"error": str(error)[:300]})

    return Handler


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=4318)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(sys.stdout),
                                  RotatingFileHandler(HERE / "serve.log", maxBytes=5_000_000, backupCount=1,
                                                      encoding="utf-8")])
    for noisy in ("httpx", "transformers", "diffusers"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    work = Work()
    server = HTTPServer(("127.0.0.1", args.port), handler(work))
    server.timeout = 30
    log.info("photo redo service on http://127.0.0.1:%d", args.port)
    while not work.idle():
        server.handle_request()
    log.info("30 idle minutes: stopping")
    return 0


if __name__ == "__main__":
    sys.exit(main())
