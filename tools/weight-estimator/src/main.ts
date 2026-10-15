import { randomUUID } from 'node:crypto';

import {
  ESTIMATE_MODES,
  referenceItems,
  weightGroups,
  type EstimateListing,
  type EstimateMode,
  type EstimateWrite,
} from '@repo/shared/sourcing/estimate';

import { sortClothing } from './classes';
import { Db } from './db';
import { dbEnv, errorText, log, modelEnv, needDbEnv } from './env';
import { estimateListing, groupText, pool, type Estimator } from './estimate';
import { evaluate } from './eval';
import { Ollama } from './ollama';
import { Vectors } from './vectors';

import type { ProductType } from '@repo/shared/domain';

/**
 * The weight estimator (D-131), on the founder's laptop with its GPU:
 *   pnpm weights classes --dry        clothing by the founder's classes (D-132): the sheet clothing-classes.csv only
 *   pnpm weights classes              … and write each option's class weight   (--all: sort sorted ones again;
 *                                      --fast: rules only, no model)
 *   pnpm weights run                  food and home: options with no weight, never estimated (sure ones become weights)
 *   pnpm weights run --redo           also re-estimate estimated weights (after many hub weighings)
 *   pnpm weights run --audit          also check the shops' weights (kept as estimates; big differences listed)
 *            --limit 50  at most 50 listings      --dry  write nothing, print every estimate
 *   pnpm weights try "Kanjivaram silk saree with blouse" --type clothing --category Sarees [--pack "500 g"]
 *   pnpm weights eval [--limit 200]   how close it comes to the weights IWC knows (each left out in turn)
 *   pnpm weights doctor               Ollama, its models, a timed question, the worker sign-in
 */

const arg = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function estimator(db: Db | null): Promise<Estimator> {
  const env = modelEnv();
  const ollama = new Ollama(env);
  const vectors = new Vectors(ollama, env.IWC_EMBED_MODEL);
  const items = db ? referenceItems(await db.references()) : [];
  await vectors.load(items.map((i) => i.text));
  if (db)
    log(
      `references: ${items.length} known weights (${items.filter((i) => i.source === 'weighed').length} weighed)`,
    );
  return {
    ollama,
    vectors,
    references: items.map((item) => ({ item, vector: vectors.of(item.text) })),
  };
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

async function run(args: string[]): Promise<number> {
  const mode: EstimateMode = args.includes('--audit')
    ? 'audit'
    : args.includes('--redo')
      ? 'redo'
      : 'missing';
  const limit = Number(arg(args, '--limit') ?? Infinity);
  const dry = args.includes('--dry');
  const parallel = modelEnv().IWC_WEIGHT_PARALLEL;
  const db = await Db.signIn(needDbEnv());
  const est = await estimator(db);
  const started = Date.now();
  let after: string | null = null;
  let listings = 0;
  let asked = 0;
  let tokens = 0;
  let failedInARow = 0;
  const totals = { estimates: 0, weights: 0, sure: 0, check: 0, failed: 0 };
  log(`run (${mode}${dry ? ', dry' : ''}) with ${est.ollama.model}, ${parallel} at a time`);
  while (listings < limit) {
    const page: EstimateListing[] = (
      await db.plan(after, Math.min(100, limit - listings), mode)
    ).slice(0, limit - listings);
    if (!page.length) break;
    after = page[page.length - 1]!.product_id;
    await est.vectors.load(page.flatMap((l) => weightGroups(l).map((g) => groupText(l, g))));
    const writes: EstimateWrite[] = [];
    await pool(page, parallel, async (listing) => {
      const t0 = Date.now();
      try {
        const r = await estimateListing(est, listing);
        writes.push(...r.writes);
        if (r.asked) asked += 1;
        tokens += r.tokens;
        failedInARow = 0;
        for (const w of r.writes) totals[w.sure ? 'sure' : 'check'] += 1;
        log(
          `  "${listing.name.slice(0, 60)}": ${r.lines.join(', ') || 'nothing to weigh'} (${seconds(Date.now() - t0)})`,
        );
        if (dry)
          for (const w of [...new Map(r.writes.map((x) => [x.note, x])).values()])
            log(`      ${w.note}`);
      } catch (error) {
        totals.failed += 1;
        failedInARow += 1;
        log(`  "${listing.name.slice(0, 60)}": ${errorText(error)}`);
        // Ollama down or out of GPU memory: stop, instead of failing every listing left
        if (failedInARow >= 5)
          throw new Error(
            `5 listings in a row failed (last: ${errorText(error)}); see pnpm weights doctor`,
          );
      }
    });
    listings += page.length;
    for (let i = 0; !dry && i < writes.length; i += 500) {
      const saved = await db.setEstimates(writes.slice(i, i + 500));
      totals.estimates += saved.estimates;
      totals.weights += saved.weights;
    }
  }
  const took = Date.now() - started;
  log(
    `done: ${listings} listings in ${seconds(took)} (${listings ? seconds(took / listings) : '0 s'} each; the model ` +
      `asked for ${asked}${asked ? `, ${Math.round(tokens / asked)} tokens an answer` : ''}, the rest matched ` +
      `near-identical items). Options: ${totals.sure} sure, ${totals.check} to ` +
      `check, ${totals.failed} failed.` +
      (dry
        ? ' Nothing written (--dry).'
        : ` Written: ${totals.weights} weights, ${totals.estimates} estimates kept.`),
  );
  return totals.failed ? 1 : 0;
}

async function tryOne(args: string[]): Promise<number> {
  const name = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const type = (arg(args, '--type') ?? 'clothing') as ProductType;
  if (!name)
    throw new Error(
      'pnpm weights try "<listing name>" --type clothing|food|home --category <name>',
    );
  const env = dbEnv();
  const est = await estimator(env ? await Db.signIn(env) : null);
  const pack = arg(args, '--pack');
  const listing: EstimateListing = {
    product_id: randomUUID(),
    name,
    product_type: type,
    category: arg(args, '--category') ?? type,
    category_weight_g: null,
    summary: arg(args, '--about') ?? null,
    description: null,
    attributes: {},
    variants: [
      {
        id: randomUUID(),
        label: pack ?? 'One size',
        options: pack ? { pack } : {},
        weight_g: null,
        weight_source: null,
        weight_note: null,
        wanted: true,
      },
    ],
  };
  await est.vectors.load(weightGroups(listing).map((g) => groupText(listing, g)));
  const t0 = Date.now();
  const r = await estimateListing(est, listing);
  for (const w of r.writes) log(`${w.sure ? 'SURE ' : 'CHECK'} ${w.note}`);
  log(`took ${seconds(Date.now() - t0)}`);
  return 0;
}

async function doctor(): Promise<number> {
  const env = modelEnv();
  const ollama = new Ollama(env);
  let ok = true;
  try {
    const have = await ollama.models();
    log(`ok    Ollama at ${env.OLLAMA_HOST}: ${have.join(', ') || 'no models yet'}`);
    for (const m of [env.IWC_WEIGHT_MODEL, env.IWC_EMBED_MODEL]) {
      const found = have.some((h) => h === m || h === `${m}:latest`);
      log(`${found ? 'ok  ' : 'FAIL'}  model ${m}${found ? '' : `: run  ollama pull ${m}`}`);
      ok &&= found;
    }
  } catch (error) {
    log(
      `FAIL  Ollama at ${env.OLLAMA_HOST}: ${errorText(error)} (installed and running? README.md)`,
    );
    return 1;
  }
  if (ok) {
    for (let i = 0; i < 2; i += 1) {
      const t0 = Date.now();
      await tryOne([
        'Women Cotton Printed Straight Kurta with Palazzo and Dupatta',
        '--type',
        'clothing',
        '--category',
        'Kurta sets',
      ]);
      log(`${i ? 'ok    warm' : 'ok    cold (loads the model)'}: ${seconds(Date.now() - t0)}`);
    }
    // four short questions at once take about as long as one when Ollama answers them together
    const ask = () =>
      ollama.ask('Answer with JSON only.', 'A cotton kurta weighs how many grams?', {
        type: 'object',
        properties: { grams: { type: 'integer' } },
        required: ['grams'],
      });
    let t0 = Date.now();
    await ask();
    const one = Date.now() - t0;
    t0 = Date.now();
    await Promise.all([ask(), ask(), ask(), ask()]);
    const together = (Date.now() - t0) / one < 2.5;
    log(
      together
        ? 'ok    Ollama answers several listings at once'
        : 'SLOW  Ollama answers one listing at a time: set OLLAMA_NUM_PARALLEL=8 (README, Speed) and restart Ollama',
    );
  }
  const db = dbEnv();
  if (!db) log('skip  worker sign-in: no IWC_* settings (needed for run and eval)');
  else
    await Db.signIn(db).then(
      () => log('ok    worker sign-in'),
      (error: unknown) => {
        ok = false;
        log(`FAIL  worker sign-in: ${errorText(error)}`);
      },
    );
  return ok ? 0 : 1;
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'run') return run(args);
  if (command === 'try') return tryOne(args);
  if (command === 'classes') {
    const env = modelEnv();
    const ollama = new Ollama(env);
    const useModel =
      !args.includes('--fast') &&
      (await ollama.models().then(
        (m) => m.some((n) => n === env.IWC_WEIGHT_MODEL || n === `${env.IWC_WEIGHT_MODEL}:latest`),
        () => false,
      ));
    if (!useModel && !args.includes('--fast'))
      log('Ollama or its model is not there: sorting by the rules only');
    return sortClothing(await Db.signIn(needDbEnv()), useModel ? ollama : null, {
      dry: args.includes('--dry'),
      all: args.includes('--all'),
      parallel: env.IWC_WEIGHT_PARALLEL,
    });
  }
  if (command === 'doctor') return doctor();
  if (command === 'eval') {
    const db = await Db.signIn(needDbEnv());
    return evaluate(db, await estimator(db), Number(arg(args, '--limit') ?? 200));
  }
  console.log(
    `pnpm weights classes [--dry] [--all] [--fast] | run [--redo | --audit] [--limit N] [--dry] | try "<name>" | eval | doctor (modes: ${ESTIMATE_MODES.join(', ')})`,
  );
  return command ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    log(`failed: ${errorText(error)}`);
    process.exit(1);
  },
);
