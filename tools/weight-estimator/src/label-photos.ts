import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import { copyFor, hasCopies, mediaPath } from '@repo/shared/domain';
import { readNet } from '@repo/shared/sourcing';
import {
  LABEL_PROMPT,
  LABEL_SCHEMA,
  TRANSCRIBE_PROMPT,
  decideLabel,
  labelAnswerSchema,
  type LabelAnswer,
  type LabelListing,
  type LabelResult,
  type PhotoReading,
} from '@repo/shared/sourcing/estimate';

import { errorText, log, ROOT } from './env';

import type { Ollama } from './ollama';

/**
 * D-202: the label reader's two readings of each photo (labels.ts runs them). Every photo's readings are kept in
 * .cache/label-readings.jsonl (not in git), keyed by the photo, both models and both prompts: a second run (the eval
 * after a rule changes, `--all`) asks the GPU, and the CDN, only about photos it has not seen.
 */

const MAX_PHOTOS = 6;

type Models = { label: string; ocr: string };
type Saved = { answer: LabelAnswer | null; transcript: string | null };

/**
 * The transcription is enough once a whole line states a net quantity: the first one that reads decides (readNet),
 * so the ingredients and nutrition table after it change nothing. Returns the text up to that line, or null.
 */
function untilNet(text: string): string | null {
  const done = text.slice(0, text.lastIndexOf('\n'));
  return done && readNet(done) ? done : null;
}

export class ReadingCache {
  private readonly file = join(ROOT, '.cache', 'label-readings.jsonl');
  private readonly saved = new Map<string, Saved>();
  private readonly prefix: string;

  constructor(models: Models) {
    this.prefix = createHash('sha256')
      .update([models.label, models.ocr, LABEL_PROMPT, TRANSCRIBE_PROMPT].join('\n'))
      .digest('hex')
      .slice(0, 12);
    if (!existsSync(this.file)) return;
    for (const line of readFileSync(this.file, 'utf8').split('\n')) {
      if (!line.startsWith('{')) continue;
      try {
        const row = JSON.parse(line) as Saved & { key: string };
        this.saved.set(row.key, { answer: row.answer, transcript: row.transcript });
      } catch {
        // a line cut short by a stopped run is read again
      }
    }
  }

  get size(): number {
    return [...this.saved.keys()].filter((k) => k.startsWith(this.prefix)).length;
  }

  get(path: string): Saved | undefined {
    return this.saved.get(`${this.prefix}|${path}`);
  }

  put(path: string, value: Saved): void {
    const key = `${this.prefix}|${path}`;
    this.saved.set(key, value);
    mkdirSync(join(ROOT, '.cache'), { recursive: true });
    appendFileSync(this.file, `${JSON.stringify({ key, ...value })}\n`);
  }
}

async function photoJpeg(site: string, path: string): Promise<string> {
  const address = hasCopies(path)
    ? copyFor(mediaPath('product-media', path), 1200)
    : mediaPath('product-media', path);
  const res = await fetch(`${site}${address}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`photo ${address}: HTTP ${res.status}`);
  const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return jpeg.toString('base64');
}

export interface ReadContext {
  ollama: Ollama;
  models: Models;
  cache: ReadingCache;
  site: string;
  /** The eval: every active option (decideLabel's `every`). */
  every: boolean;
  doubt: NonNullable<Parameters<typeof decideLabel>[2]>['doubt'];
  /** `--cached`: decide from saved readings only (no GPU, no download); null when a photo it needs is not read yet. */
  cachedOnly: boolean;
}

/** Reads a listing's photos until both readers agree for every option it can weigh (most stop at the second photo). */
export async function readListing(
  ctx: ReadContext,
  listing: LabelListing,
): Promise<LabelResult[] | null> {
  const { ollama, models, cache, site, every, doubt } = ctx;
  const readings: PhotoReading[] = [];
  const photos = listing.photos.slice(0, MAX_PHOTOS);
  const fetchPhoto = (i: number) =>
    i < photos.length && !ctx.cachedOnly && !cache.get(photos[i]!.path)
      ? photoJpeg(site, photos[i]!.path).catch((error: unknown) => {
          log(`    ${errorText(error)}`);
          return null;
        })
      : null;
  // the next photo downloads while the GPU reads this one (at most one photo a listing more than it reads)
  let next = fetchPhoto(0);
  for (const [i, photo] of photos.entries()) {
    let saved = cache.get(photo.path);
    if (!saved && ctx.cachedOnly) return null;
    const jpeg = saved ? null : await next;
    next = fetchPhoto(i + 1);
    if (!saved) {
      if (!jpeg) continue;
      const parsed = labelAnswerSchema.safeParse(
        JSON.parse((await ollama.see(models.label, LABEL_PROMPT, jpeg, LABEL_SCHEMA)) || 'null'),
      );
      const answer = parsed.success ? parsed.data : null;
      // the second reader only where the first saw a net quantity: half the time on photos of the food itself
      const transcript = answer?.shows_net_quantity
        ? await ollama.see(models.ocr, TRANSCRIBE_PROMPT, jpeg, null, untilNet)
        : null;
      saved = { answer, transcript };
      cache.put(photo.path, saved);
    }
    readings.push({ path: photo.path, variant_id: photo.variant_id, ...saved });
    const results = decideLabel(listing, readings, { doubt, every });
    // one option: done at its first agreed photo; several: every photo, each may be tagged with its own
    if (listing.variants.filter((v) => v.is_active).length === 1 && results.some((r) => r.grams))
      return results;
  }
  return decideLabel(listing, readings, { doubt, every });
}
