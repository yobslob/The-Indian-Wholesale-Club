#!/usr/bin/env node
/**
 * The recipe photo runner (D-214). For every drafted recipe without a photo yet, it searches a photo source's own API
 * for the dish (openverse.mjs: Openverse, free and no key, the default; sources.mjs: Pixabay or Pexels, free; Magnific
 * Stock, paid), has the laptop's vision model pick the best-looking photo of the dish among the best few (judge.mjs;
 * Openverse only, --no-judge to skip; else pick.mjs alone) and saves it as out/<slug>.jpg, the name Admin → Recipes → Add photos by name reads. When the run ends, that folder is the push: drop
 * it on Add photos by name, which makes each photo's two AVIF copies and refreshes the live pages (the runner itself
 * never writes to the store or the database).
 *
 * Usage (from C:\kod\root):  pnpm photos:recipes [--source openverse|pixabay|pexels|magnific] [--no-judge] [--look 4] [--limit 50] [--only samosa,pav-bhaji]
 *                            [--again] [--term "{name} snack"]
 * tools/recipe-photos/.env (not in git): PIXABAY_API_KEY=… (free), PEXELS_API_KEY=… (free) and/or MAGNIFIC_API_KEY=…
 * (paid). Without --source, the first of those whose key is there. A run carries on from where the last one stopped.
 */
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ask, GOOD_ENOUGH, MODEL, ready, shortlist, verdictScore } from './judge.mjs';
import { openverse } from './openverse.mjs';
import { best, licences } from './pick.mjs';
import { magnific, pexels, pixabay } from './sources.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const OUT = process.env.IWC_RECIPE_PHOTOS_OUT ?? join(HERE, 'out');

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const limit = Number(opt('limit') ?? Infinity);
const only = opt('only')?.split(',').map((s) => s.trim());
const again = args.includes('--again');
const look = Number(opt('look') ?? 4);

// tools/recipe-photos/.env: KEY=value lines; the environment wins
const envFile = join(HERE, '.env');
if (existsSync(envFile))
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
const KEYS = { pixabay: 'PIXABAY_API_KEY', pexels: 'PEXELS_API_KEY', magnific: 'MAGNIFIC_API_KEY' };
const choice = opt('source') ?? 'openverse';
// Openverse finds a dish by its name; the stock libraries by "<name> indian food"
const template = opt('term') ?? (choice === 'openverse' ? '{name}' : '{name} indian food');
const keyName = KEYS[choice];
const key = keyName && process.env[keyName];
if (choice !== 'openverse' && !key) {
  console.error(
    keyName
      ? `Write ${keyName}=… in tools/recipe-photos/.env and run again.` +
          (choice === 'pixabay' ? ' A Pixabay key is free: sign up at pixabay.com, then open pixabay.com/api/docs.' : '')
      : `--source is openverse, pixabay, pexels or magnific.`,
  );
  process.exit(2);
}
const source =
  choice === 'openverse'
    ? openverse(template, join(OUT, '.cache'))
    : choice === 'magnific'
    ? magnific(key, template)
    : choice === 'pexels'
      ? pexels(key, template)
      : pixabay(key, template, join(OUT, '.cache'));

const judging = choice === 'openverse' && !args.includes('--no-judge');
if (judging) {
  const problem = await ready();
  if (problem) {
    console.error(problem);
    process.exit(2);
  }
}

/** Every drafted recipe, in the drafts' order (catalogue/recipes-drafts-*.json). */
const recipes = readdirSync(join(REPO, 'catalogue'))
  .filter((f) => /^recipes-drafts-\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .flatMap((f) => JSON.parse(readFileSync(join(REPO, 'catalogue', f), 'utf8')))
  .map((d) => ({ slug: d.slug, name: d.name }));

mkdirSync(OUT, { recursive: true });
const credits = join(OUT, 'credits.csv');
if (!existsSync(credits)) writeFileSync(credits, 'slug,name,source,id,title,author,page,licences\n');
const missed = join(OUT, 'not-found.txt');
const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;

const todo = recipes.filter(
  (r) => (!only || only.includes(r.slug)) && (again || !existsSync(join(OUT, `${r.slug}.jpg`))),
);
console.log(
  `${source.name}: ${recipes.length} recipes, ${todo.length} without a photo here; taking ${Math.min(todo.length, limit)}.`,
);

/** Each recipe's photo id so far (credits.csv), so two recipes never get the same photo. */
const photoOf = new Map();
for (const line of readFileSync(credits, 'utf8').split(/\r?\n/).slice(1)) {
  const m = line.match(/^"([^"]*)","(?:[^"]|"")*","([^"]*)","([^"]*)"/);
  if (m && m[2] === source.name) photoOf.set(m[1], m[3]);
}

/**
 * Openverse with the GPU: the best few results downloaded to out/.look and shown to the vision model; the best-looking
 * photo of the dish wins (judge.mjs). Null: none of them is the dish.
 */
async function judged(r, used) {
  const list = shortlist(await source.search(r.name), r.name, look, used);
  const dir = join(OUT, '.look');
  mkdirSync(dir, { recursive: true });
  let top = null;
  try {
    for (const [i, candidate] of list.entries()) {
      const file = join(dir, `${r.slug}-${i}.jpg`);
      try {
        await source.download(candidate, file);
      } catch (error) {
        console.log(`     ${candidate.name || candidate.id}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      let v;
      try {
        v = await ask(file, r.name);
      } catch (error) {
        // one photo the model can't take (too large for its context): skip it, not the run
        if (!/HTTP 4\d\d/.test(String(error))) throw error;
        console.log(`     ${String(candidate.name || candidate.id).slice(0, 70)}: ${String(error).slice(0, 120)}`);
        rmSync(file, { force: true });
        continue;
      }
      const s = verdictScore(v, candidate.width);
      console.log(
        `     ${s ? String(s).padStart(2) : ' x'}  ${String(candidate.name || candidate.id).slice(0, 70)}` +
          (v.is_dish && v.main_subject === false
            ? ' (one dish of several)'
            : v.is_dish
            ? ` (appetising ${v.appetising}, sharp ${v.sharp}${v.people ? ', people' : ''}${v.text_or_logo ? ', text' : ''}${v.cluttered ? ', cluttered' : ''})`
            : ' (not the dish)'),
      );
      if (s > (top?.score ?? 0)) {
        if (top) rmSync(top.file, { force: true });
        top = { pick: candidate, file, score: s };
      } else rmSync(file, { force: true });
      if (s >= GOOD_ENOUGH) break;
    }
    if (top) copyFileSync(top.file, join(OUT, `${r.slug}.jpg`));
    return top?.pick ?? null;
  } finally {
    if (top) rmSync(top.file, { force: true });
  }
}

let saved = 0;
let notFound = 0;
let failed = 0;
if (judging) console.log(`The vision model (${MODEL}) looks at up to ${look} photos a recipe.`);
for (const r of todo.slice(0, limit)) {
  try {
    const used = new Set([...photoOf].filter(([slug]) => slug !== r.slug).map(([, id]) => id));
    let pick = null;
    if (judging) pick = await judged(r, used);
    else {
      // the template's words first ("samosa indian food"); the name alone when none of those is a photo of the dish
      pick = best(await source.search(r.name), r.name, used);
      if (!pick && template !== '{name}') pick = best(await source.search(r.name, true), r.name, used);
      if (pick) await source.download(pick, join(OUT, `${r.slug}.jpg`));
    }
    if (!pick) {
      notFound++;
      appendFileSync(missed, `${r.slug}\t${r.name}\n`);
      console.log(`  -  ${r.slug}: no photo of the dish`);
      continue;
    }
    appendFileSync(
      credits,
      [r.slug, r.name, source.name, pick.id, pick.name ?? pick.title, pick.author?.name, pick.url, licences(pick)]
        .map(cell)
        .join(',') + '\n',
    );
    photoOf.set(r.slug, String(pick.id));
    saved++;
    console.log(`  ✓  ${r.slug}: ${pick.name ?? pick.title}`);
  } catch (error) {
    failed++;
    console.log(`  !  ${r.slug}: ${error instanceof Error ? error.message : String(error)}`);
    // a wrong key, no credits, a paid plan, a day's searches used up or no Ollama: stop instead of failing them all
    if (/HTTP 40[123]|search: HTTP 429|Ollama/.test(String(error))) break;
  }
}

console.log(`\nDone: ${saved} saved, ${notFound} with no photo of the dish (not-found.txt), ${failed} failed.`);
console.log(`Push: open Admin → Recipes → Add photos by name and choose every .jpg in\n  ${OUT}`);
console.log("together with credits.csv: each photo's author and licence become its recipe page's credit line.");
