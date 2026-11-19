import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import { autoPrice, copyFor, formatGrams, hasCopies, mediaPath } from '@repo/shared/domain';
import { readNet } from '@repo/shared/sourcing';
import {
  LABEL_PROMPT,
  LABEL_SCHEMA,
  TRANSCRIBE_PROMPT,
  decideLabel,
  labelAnswerSchema,
  labelMatches,
  labelSummary,
  labelWrites,
  type LabelListing,
  type LabelResult,
  type PhotoReading,
} from '@repo/shared/sourcing/estimate';

import { errorText, log, modelEnv, ROOT } from './env';
import { Ollama } from './ollama';
import { loadPriceIndex, priceDoubt } from './prices';

import type { Db } from './db';

/**
 * D-202: `pnpm weights labels` reads the net quantity printed on the photos of food whose weight nobody read, on this
 * laptop's GPU (packages/shared/src/sourcing/estimate/label.ts says how a weight is decided). Each photo (its 1200
 * copy, through the site's CDN: no R2 key needed) goes to the vision model; when it sees a net quantity, the photo's
 * words are written out (the second reader) and read by the same rule as a shop page. Both agree: the label's weight,
 * written as the label's (customers see it; the price follows, D-128). The sheet label-weights.csv lists every listing.
 *   --dry      read and write the sheet only        --limit N  at most N listings     --all  also listings read before
 *   --eval     read listings whose weight is known from their own words, and say how often the photos agree
 */

const MAX_PHOTOS = 6;

/**
 * The transcription is enough once a whole line states a net quantity: the first one that reads decides (readNet),
 * so the ingredients and nutrition table after it change nothing. Returns the text up to that line, or null.
 */
function untilNet(text: string): string | null {
  const done = text.slice(0, text.lastIndexOf('\n'));
  return done && readNet(done) ? done : null;
}

/** Below this share in the GPU's memory the model runs several times slower (README, Labels: speed). */
const ON_GPU = 0.98;
const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
const usd = (cents: number | null | undefined): string =>
  cents == null ? '' : `$${(cents / 100).toFixed(2)}`;

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

/** Reads a listing's photos until both readers agree for every option it can weigh (most stop at the second photo). */
async function readListing(
  ollama: Ollama,
  models: { label: string; ocr: string },
  site: string,
  listing: LabelListing,
  every: boolean,
  doubt: NonNullable<Parameters<typeof decideLabel>[2]>['doubt'],
): Promise<LabelResult[]> {
  const readings: PhotoReading[] = [];
  const photos = listing.photos.slice(0, MAX_PHOTOS);
  const fetchPhoto = (i: number) =>
    i < photos.length
      ? photoJpeg(site, photos[i]!.path).catch((error: unknown) => {
          log(`    ${errorText(error)}`);
          return null;
        })
      : null;
  // the next photo downloads while the GPU reads this one (at most one photo a listing more than it reads)
  let next = fetchPhoto(0);
  for (const [i, photo] of photos.entries()) {
    const jpeg = await next;
    next = fetchPhoto(i + 1);
    if (!jpeg) continue;
    const parsed = labelAnswerSchema.safeParse(
      JSON.parse((await ollama.see(models.label, LABEL_PROMPT, jpeg, LABEL_SCHEMA)) || 'null'),
    );
    const answer = parsed.success ? parsed.data : null;
    // the second reader only where the first saw a net quantity: half the time on photos of the food itself
    const transcript = answer?.shows_net_quantity
      ? await ollama.see(models.ocr, TRANSCRIBE_PROMPT, jpeg, null, untilNet)
      : null;
    readings.push({ path: photo.path, variant_id: photo.variant_id, answer, transcript });
    const results = decideLabel(listing, readings, { doubt, every });
    // one option: done at its first agreed photo; several: every photo, each may be tagged with its own
    if (listing.variants.filter((v) => v.is_active).length === 1 && results.some((r) => r.variant))
      return results;
  }
  return decideLabel(listing, readings, { doubt, every });
}

export async function readLabels(
  db: Db,
  opts: { dry: boolean; all: boolean; evaluate: boolean; limit: number },
): Promise<number> {
  const env = modelEnv();
  const ollama = new Ollama(env);
  const models = { label: env.IWC_LABEL_MODEL, ocr: env.IWC_OCR_MODEL || env.IWC_LABEL_MODEL };
  const have = await ollama.models();
  for (const m of new Set(Object.values(models)))
    if (!have.some((h) => h === m || h === `${m}:latest`))
      throw new Error(`model ${m} missing: ollama pull ${m}`);
  const index = await loadPriceIndex(db);
  const doubt = opts.evaluate ? undefined : priceDoubt(index);
  const write = !opts.dry && !opts.evaluate;
  const mode = opts.evaluate ? 'known' : opts.all ? 'all' : 'new';
  const sheet = join(ROOT, opts.evaluate ? 'label-eval.csv' : 'label-weights.csv');
  const before = join(ROOT, 'label-weights-before.jsonl');
  log(
    `labels (${mode}${write ? '' : ', nothing written'}) with ${models.label}${models.ocr !== models.label ? ` + ${models.ocr}` : ''}`,
  );
  const started = Date.now();
  const rows: LabelResult[] = [];
  let after: string | null = null;
  let listings = 0;
  let written = 0;
  let failedInARow = 0;
  let gpuChecked = false;
  while (listings < opts.limit) {
    const page = await db.labelPlan(after, Math.min(25, opts.limit - listings), mode);
    if (!page.length) break;
    after = page[page.length - 1]!.product_id;
    const done: LabelResult[] = [];
    // one listing at a time: the GPU holds one reader at full speed (two at once spill onto the CPU, README)
    for (const listing of page) {
      const t0 = Date.now();
      try {
        const results = await readListing(
          ollama,
          models,
          env.IWC_SITE_URL,
          listing,
          opts.evaluate,
          doubt,
        );
        done.push(...results);
        failedInARow = 0;
        log(
          `  "${listing.name.slice(0, 60)}": ${results.map(labelSummary).join('; ')} (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
        );
      } catch (error) {
        failedInARow += 1;
        log(`  "${listing.name.slice(0, 60)}": ${errorText(error)}`);
        if (failedInARow >= 5)
          throw new Error(
            `5 listings in a row failed (last: ${errorText(error)}); see pnpm weights doctor`,
          );
      }
      if (!gpuChecked) gpuChecked = await checkGpu(ollama, models.label);
    }
    listings += page.length;
    rows.push(...done);
    if (write) {
      const writes = labelWrites(done);
      if (writes.length) {
        const ids = new Set(writes.map((w) => w.variant_id));
        appendFileSync(
          before,
          done
            .filter((r) => r.variant && ids.has(r.variant.id))
            .map((r) =>
              JSON.stringify({
                at: new Date().toISOString(),
                product_id: r.listing.product_id,
                variant: r.variant,
              }),
            )
            .join('\n') + '\n',
        );
        written += await db.setFoodWeights(writes);
      }
      await db.labelTried(page.map((l) => l.product_id));
    }
  }
  writeSheet(sheet, rows, opts.evaluate);
  const read = rows.filter((r) => r.result === 'read').length;
  const took = (Date.now() - started) / 1000;
  log(
    `done: ${listings} listings in ${took.toFixed(0)} s (${listings ? (took / listings).toFixed(1) : 0} s each); ${read} options read from their labels.`,
  );
  if (opts.evaluate) {
    const m = rows.map(labelMatches);
    const same = m.filter((x) => x === 'same').length;
    const different = m.filter((x) => x === 'different').length;
    log(
      `eval: of ${rows.length} options, the label agrees with the known weight on ${same}, differs on ${different}` +
        ` (look at those in ${sheet}), and nothing was read on ${m.length - same - different}.` +
        ` Write only when "differs" is rare: each one there would have been a wrong weight.`,
    );
  } else log(`sheet: ${sheet}. ${write ? `${written} options written.` : 'Nothing written.'}`);
  return 0;
}

/** Once the model is loaded: says so when part of it runs on the CPU, the reason a listing takes minutes. */
async function checkGpu(ollama: Ollama, model: string): Promise<boolean> {
  const share = await ollama.onGpu(model).catch(() => null);
  if (share === null) return false;
  if (share < ON_GPU)
    log(
      `SLOW  ${model} is only ${Math.round(share * 100)}% on the GPU: the rest runs on the CPU, about 6 times slower. ` +
        `Ollama keeps room for OLLAMA_NUM_PARALLEL answers at once; quit Ollama, set OLLAMA_NUM_PARALLEL=1, start it ` +
        `again and run this again (README, Labels: speed; set it back to 8 for pnpm weights run).`,
    );
  return true;
}

function writeSheet(file: string, rows: LabelResult[], evaluate: boolean): void {
  const head = [
    'Listing',
    'Category',
    'Option',
    'Weight before',
    'Source before',
    'Label says',
    'New weight',
    'Change',
    'Price before',
    'Price after',
    evaluate ? 'Matches' : 'Result',
    'Photo',
  ];
  const lines = rows.map((r) => {
    const v = r.variant ?? r.listing.variants.find((x) => x.is_active) ?? null;
    const shop = v?.shop_price_paise ?? r.listing.shop_price_paise;
    const price = (g: number | null | undefined) =>
      g && shop
        ? usd(autoPrice({ shopPricePaise: shop, weightG: g, productType: 'food' })?.priceCents)
        : '';
    const change =
      v?.weight_g && r.grams && r.grams !== v.weight_g
        ? `${r.grams > v.weight_g ? '+' : ''}${Math.round(((r.grams - v.weight_g) * 100) / v.weight_g)}%`
        : '';
    return [
      r.listing.name,
      r.listing.category,
      v?.label ?? '',
      v?.weight_g ? formatGrams(v.weight_g) : '',
      v?.weight_source ?? '',
      r.parts ? labelSummary(r) : '',
      r.grams ? formatGrams(r.grams) : '',
      change,
      price(v?.weight_g),
      r.grams ? price(r.grams) : '',
      evaluate ? labelMatches(r) : r.result,
      r.photo ?? '',
    ]
      .map(cell)
      .join(',');
  });
  writeFileSync(file, `\uFEFF${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`, 'utf8');
}
