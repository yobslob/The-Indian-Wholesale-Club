import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  labelMatches,
  labelSummary,
  labelWrites,
  type LabelResult,
} from '@repo/shared/sourcing/estimate';

import { errorText, log, modelEnv, ROOT } from './env';
import { readListing, ReadingCache, type ReadContext } from './label-photos';
import { summary, writeSheet } from './label-sheet';
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
 *   --cached   decide from the photos read before only (seconds, no GPU): the sheet and the summary so far
 */

/** Below this share in the GPU's memory the model runs several times slower (README, Labels: speed). */
const ON_GPU = 0.98;

/** A database call again after a network blip (twice a 7-hour run stopped at "fetch failed"): 6 tries over 8 min. */
async function retry<T>(what: string, call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= 6) throw error;
      const wait = 15 * 2 ** (attempt - 1);
      log(`  ${what}: ${errorText(error)}; trying again in ${wait} s`);
      await new Promise((done) => setTimeout(done, wait * 1000));
    }
  }
}

export async function readLabels(
  db: Db,
  opts: {
    dry: boolean;
    all: boolean;
    evaluate: boolean;
    cached: boolean;
    front: boolean;
    limit: number;
  },
): Promise<number> {
  const env = modelEnv();
  const ollama = new Ollama(env);
  const models = { label: env.IWC_LABEL_MODEL, ocr: env.IWC_OCR_MODEL || env.IWC_LABEL_MODEL };
  if (!opts.cached) {
    const have = await ollama.models();
    for (const m of new Set(Object.values(models)))
      if (!have.some((h) => h === m || h === `${m}:latest`))
        throw new Error(`model ${m} missing: ollama pull ${m}`);
  }
  const index = await loadPriceIndex(db);
  const cache = new ReadingCache(models);
  if (cache.size)
    log(`${cache.size} photos read before (.cache/label-readings.jsonl): not read again`);
  const ctx: ReadContext = {
    ollama,
    models,
    cache,
    site: env.IWC_SITE_URL,
    every: opts.evaluate,
    // the eval doubts like a real run, so it counts what a real run would write (an eval listing is not its own
    // reference: similarReferences leaves the listing out)
    doubt: priceDoubt(index),
    cachedOnly: opts.cached,
    front: opts.front,
  };
  const write = !opts.dry && !opts.evaluate;
  const mode = opts.evaluate ? 'known' : opts.all ? 'all' : 'new';
  const sheet = join(ROOT, opts.evaluate ? 'label-eval.csv' : 'label-weights.csv');
  const before = join(ROOT, 'label-weights-before.jsonl');
  log(
    `labels (${mode}${write ? '' : ', nothing written'}${opts.cached ? ', read before only' : ''}) with ` +
      `${models.label}${models.ocr !== models.label ? ` + ${models.ocr}` : ''}`,
  );
  const started = Date.now();
  const rows: LabelResult[] = [];
  let after: string | null = null;
  let listings = 0;
  let notYet = 0;
  let written = 0;
  let failedInARow = 0;
  let gpuChecked = opts.cached;
  while (listings < opts.limit) {
    const size = Math.min(opts.cached ? 100 : 25, opts.limit - listings);
    const page = await retry('the plan', () => db.labelPlan(after, size, mode));
    if (!page.length) break;
    after = page[page.length - 1]!.product_id;
    const done: LabelResult[] = [];
    const read: string[] = [];
    // one listing at a time: the GPU holds one reader at full speed (two at once spill onto the CPU, README)
    for (const listing of page) {
      const t0 = Date.now();
      try {
        const results = await readListing(ctx, listing);
        if (!results) {
          notYet += 1;
          continue;
        }
        done.push(...results);
        read.push(listing.product_id);
        failedInARow = 0;
        if (!opts.cached)
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
    writeSheet(sheet, rows, opts.evaluate);
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
        written += await retry('writing weights', () => db.setFoodWeights(writes));
      }
      // only listings whose photos were all read leave the `new` plan
      if (read.length) await retry('marking read', () => db.labelTried(read));
    }
  }
  const took = (Date.now() - started) / 1000;
  const each = listings - notYet ? (took / (listings - notYet)).toFixed(1) : 0;
  log(
    `done: ${listings} listings in ${took.toFixed(0)} s (${each} s each)` +
      (notYet ? `; ${notYet} not read yet (run without --cached to read them)` : '') +
      '.',
  );
  if (opts.evaluate) {
    const count = (of: LabelResult[], m: 'same' | 'different') =>
      of.filter((r) => labelMatches(r) === m).length;
    const kept = rows.filter((r) => r.result === 'read');
    const held = rows.filter((r) => r.grams && r.result !== 'read');
    log(
      `eval: of ${rows.length} options, a real run would write ${kept.length}: the known weight on ` +
        `${count(kept, 'same')}, a different one on ${count(kept, 'different')}. Held back by the pack and price ` +
        `checks: ${held.length} (${count(held, 'different')} of them wrong, ${count(held, 'same')} right). Nothing ` +
        `read on ${rows.length - kept.length - held.length}. Write only when "a different one" is rare: each would ` +
        `be a wrong weight (${sheet}).`,
    );
  } else {
    log(summary(rows));
    log(`sheet: ${sheet}. ${write ? `${written} options written.` : 'Nothing written.'}`);
  }
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
