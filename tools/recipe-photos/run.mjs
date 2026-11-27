#!/usr/bin/env node
/**
 * The recipe photo runner (D-214). For every drafted recipe without a photo yet, it searches a photo source's own API
 * for the dish (sources.mjs: Pixabay or Pexels, free; or Magnific Stock, paid), picks the best result (pick.mjs) and saves it as
 * out/<slug>.jpg, the name Admin → Recipes → Add photos by name reads. When the run ends, that folder is the push: drop
 * it on Add photos by name, which makes each photo's two AVIF copies and refreshes the live pages (the runner itself
 * never writes to the store or the database).
 *
 * Usage (from C:\kod\root):  pnpm photos:recipes [--source pixabay|pexels|magnific] [--limit 50] [--only samosa,pav-bhaji]
 *                            [--again] [--term "{name} snack"]
 * tools/recipe-photos/.env (not in git): PIXABAY_API_KEY=… (free), PEXELS_API_KEY=… (free) and/or MAGNIFIC_API_KEY=…
 * (paid). Without --source, the first of those whose key is there. A run carries on from where the last one stopped.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const template = opt('term') ?? '{name} indian food';

// tools/recipe-photos/.env: KEY=value lines; the environment wins
const envFile = join(HERE, '.env');
if (existsSync(envFile))
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
const KEYS = { pixabay: 'PIXABAY_API_KEY', pexels: 'PEXELS_API_KEY', magnific: 'MAGNIFIC_API_KEY' };
const choice = opt('source') ?? Object.keys(KEYS).find((s) => process.env[KEYS[s]]) ?? 'pixabay';
const keyName = KEYS[choice];
const key = keyName && process.env[keyName];
if (!key) {
  console.error(
    keyName
      ? `Write ${keyName}=… in tools/recipe-photos/.env and run again.` +
          (choice === 'pixabay' ? ' A Pixabay key is free: sign up at pixabay.com, then open pixabay.com/api/docs.' : '')
      : `--source is pixabay, pexels or magnific.`,
  );
  process.exit(2);
}
const source =
  choice === 'magnific'
    ? magnific(key, template)
    : choice === 'pexels'
      ? pexels(key, template)
      : pixabay(key, template, join(OUT, '.cache'));

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

let saved = 0;
let notFound = 0;
let failed = 0;
for (const r of todo.slice(0, limit)) {
  try {
    const used = new Set([...photoOf].filter(([slug]) => slug !== r.slug).map(([, id]) => id));
    // the template's words first ("samosa indian food"); the name alone when none of those is a photo of the dish
    let pick = best(await source.search(r.name), r.name, used);
    if (!pick && template !== '{name}') pick = best(await source.search(r.name, true), r.name, used);
    if (!pick) {
      notFound++;
      appendFileSync(missed, `${r.slug}\t${r.name}\n`);
      console.log(`  -  ${r.slug}: no photo of the dish`);
      continue;
    }
    await source.download(pick, join(OUT, `${r.slug}.jpg`));
    appendFileSync(
      credits,
      [r.slug, r.name, source.name, pick.id, pick.title, pick.author?.name, pick.url, licences(pick)].map(cell).join(',') +
        '\n',
    );
    photoOf.set(r.slug, String(pick.id));
    saved++;
    console.log(`  ✓  ${r.slug}: ${pick.title}`);
  } catch (error) {
    failed++;
    console.log(`  !  ${r.slug}: ${error instanceof Error ? error.message : String(error)}`);
    if (/HTTP 40[123]/.test(String(error))) break; // a wrong key, no credits or a paid plan: stop instead of failing all
  }
}

console.log(`\nDone: ${saved} saved, ${notFound} with no photo of the dish (not-found.txt), ${failed} failed.`);
console.log(`Push: open Admin → Recipes → Add photos by name and choose every .jpg in\n  ${OUT}`);
console.log("Each photo's source, author and licence is in credits.csv there.");
