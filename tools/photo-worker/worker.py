"""IWC photo worker (D-101, D-103): takes photo jobs from Supabase and makes the AI photos on this machine's GPU.

    .venv\\Scripts\\python worker.py           run until stopped (Ctrl+C)
    .venv\\Scripts\\python worker.py --once    one job, then stop

Settings come from tools/photo-worker/.env (README.md). Nothing on the internet depends on this machine: when it is
off, jobs wait in the queue and vendors can still upload.
"""

import io
import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

from PIL import Image, ImageOps

from iwc_worker.pipeline import Pipeline
from iwc_worker.prompts import on_model, try_on_prompt
from iwc_worker.supa import Supabase

HERE = Path(__file__).resolve().parent
POLL_SECONDS = 30
IDLE_UNLOAD_SECONDS = 600         # give the GPU back after 10 quiet minutes
SEEDS = [11, 23, 37]              # three candidates per view; an admin picks one

log = logging.getLogger("iwc-worker")


def load_env(path: Path) -> None:
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"'))


def open_image(data: bytes) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")


def jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=88, optimize=True, progressive=True)
    return buf.getvalue()


def process(sb: Supabase, pipe: Pipeline, job: dict) -> list[str]:
    view = job["view"]
    photo_path = (job.get("photos") or {}).get(view)
    if not photo_path:
        raise ValueError(f"no_{view}_photo")
    garment, real_pixels = pipe.garment_on_white(open_image(sb.download("vendor-uploads", photo_path)))
    house_model = job.get("house_model")
    if on_model(job.get("category"), job.get("wears")) and house_model:
        house = open_image(sb.download_public("product-media", house_model[f"{view}_path"]))
        prompt = try_on_prompt(view, job["category"], job.get("wears"))
        outs = [pipe.colour_match(o, house, real_pixels) for o in pipe.try_on(house, garment, prompt, SEEDS)]
    else:
        outs = [pipe.packshot(garment)]
    paths = []
    for i, out in enumerate(outs):
        path = f"{job['job_id']}/{i}.jpg"
        sb.upload("photo-candidates", path, jpeg(pipe.upscale(out)))
        paths.append(path)
    return paths


def run(once: bool) -> None:
    load_env(HERE / ".env")
    missing = [k for k in ("IWC_SUPABASE_URL", "IWC_SUPABASE_ANON_KEY", "IWC_WORKER_EMAIL", "IWC_WORKER_PASSWORD")
               if not os.environ.get(k)]
    if missing:
        sys.exit(f"Missing in tools/photo-worker/.env: {', '.join(missing)} (README.md, Setup)")
    sb = Supabase(os.environ["IWC_SUPABASE_URL"], os.environ["IWC_SUPABASE_ANON_KEY"],
                  os.environ["IWC_WORKER_EMAIL"], os.environ["IWC_WORKER_PASSWORD"])
    pipe = Pipeline()
    last_work = time.time()
    log.info("worker started (%s)", os.environ["IWC_SUPABASE_URL"])
    while True:
        try:
            job = sb.rpc("worker_claim_job")
        except Exception as e:                                   # network down, laptop asleep, ...
            log.warning("could not reach Supabase: %s", e)
            time.sleep(POLL_SECONDS * 2)
            continue
        if not job:
            if pipe.loaded and time.time() - last_work > IDLE_UNLOAD_SECONDS:
                pipe.unload()
                log.info("idle: models unloaded, GPU free")
            if once:
                log.info("no job waiting")
                return
            time.sleep(POLL_SECONDS)
            continue
        started = time.time()
        log.info("job %s: %s view, %s", job["job_id"], job["view"], job.get("category"))
        try:
            paths = process(sb, pipe, job)
            sb.rpc("worker_finish_job", {"p_job": job["job_id"], "p_candidates": paths})
            log.info("job %s done in %.0f s: %d candidate(s)", job["job_id"], time.time() - started, len(paths))
        except Exception as e:
            log.exception("job %s failed", job["job_id"])
            try:
                sb.rpc("worker_finish_job", {"p_job": job["job_id"], "p_candidates": [], "p_error": str(e)[:300]})
            except Exception:
                log.exception("could not report the failure (the job is taken again after 30 minutes)")
        last_work = time.time()
        if once:
            return


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(),
                                  RotatingFileHandler(HERE / "worker.log", maxBytes=2_000_000, backupCount=3)])
    run(once="--once" in sys.argv)
