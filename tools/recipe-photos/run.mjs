#!/usr/bin/env node
/**
 * The recipe photo runner (D-214, founder 2026-11-27: "scrape from magnific.com because I have permission from their
 * website"). For every drafted recipe without a photo yet, it asks Magnific Stock's API (formerly Freepik's) for photos
 * of the dish, picks the best one (pick.mjs) and saves it as out/<slug>.jpg, the name Admin → Recipes → Add photos by
 * name reads. When the run ends, that folder is the push: drop it on Add photos by name, which makes each photo's two
 * AVIF copies and refreshes the live pages (the runner itself never writes to the store or the database).
 *
 * Usage (from C:\kod\root):  pnpm photos:recipes [--limit 50] [--only samosa,pav-bhaji] [--again] [--term "{name} snack"]
 * Needs tools/recipe-photos/.env (not in git) with MAGNIFIC_API_KEY=… . Each search and each download spends the
 * account's API credits; a run carries on from where the last one stopped.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { best, licences, searchTerm } from './pick.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const OUT = process.env.IWC_RECIPE_PHOTOS_OUT ?? join(HERE, 'out');
const API = 'https://api.magnific.com/v1';

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
const KEY = process.env.MAGNIFIC_API_KEY;
if (!KEY) {
  console.error('Write MAGNIFIC_API_KEY=… in tools/recipe-photos/.env (your Magnific API key) and run again.');
  process.exit(2);
}

/** Every drafted recipe, in the drafts' order (catalogue/recipes-drafts-*.json). */
const recipes = readdirSync(join(REPO, 'catalogue'))
  .filter((f) => /^recipes-drafts-\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .flatMap((f) => JSON.parse(readFileSync(join(REPO, 'catalogue', f), 'utf8')))
  .map((d) => ({ slug: d.slug, name: d.name }));

mkdirSync(OUT, { recursive: true });
const credits = join(OUT, 'credits.csv');
if (!existsSync(credits)) writeFileSync(credits, 'slug,name,magnific_id,title,author,page,licences\n');
const missed = join(OUT, 'not-found.txt');
const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;

async function api(path) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      headers: { 'x-magnific-api-key': KEY, 'Accept-Language': 'en-US' },
    });
    if (res.status === 429 && attempt < 5) {
      const wait = Number(res.headers.get('retry-after') ?? 10) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${path.split('?')[0]}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}

async function search(name) {
  const q = new URLSearchParams({ term: searchTerm(name, template), limit: '30', order: 'relevance' });
  q.set('filters[content_type][photo]', '1');
  q.set('filters[people][exclude]', '1');
  return (await api(`/resources?${q}`)).data ?? [];
}

async function download(id, file) {
  const { data } = await api(`/resources/${id}/download?image_size=medium`);
  const url = data?.signed_url ?? data?.url;
  if (!url) throw new Error(`resource ${id}: no download link`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`resource ${id}: download HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/image\/(jpeg|png|webp)/.test(type)) throw new Error(`resource ${id}: ${type || 'no type'}, not a photo`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const todo = recipes.filter(
  (r) => (!only || only.includes(r.slug)) && (again || !existsSync(join(OUT, `${r.slug}.jpg`))),
);
console.log(`${recipes.length} recipes, ${todo.length} without a photo here; taking ${Math.min(todo.length, limit)}.`);

let saved = 0;
let notFound = 0;
let failed = 0;
for (const r of todo.slice(0, limit)) {
  try {
    const pick = best(await search(r.name), r.name);
    if (!pick) {
      notFound++;
      appendFileSync(missed, `${r.slug}\t${r.name}\n`);
      console.log(`  -  ${r.slug}: no photo of the dish`);
      continue;
    }
    await download(pick.id, join(OUT, `${r.slug}.jpg`));
    appendFileSync(
      credits,
      [r.slug, r.name, pick.id, pick.title, pick.author?.name, pick.url, licences(pick)].map(cell).join(',') + '\n',
    );
    saved++;
    console.log(`  ✓  ${r.slug}: ${pick.title}`);
  } catch (error) {
    failed++;
    console.log(`  !  ${r.slug}: ${error instanceof Error ? error.message : String(error)}`);
    if (/HTTP 40[13]/.test(String(error))) break; // a wrong key or no credits: stop instead of failing every recipe
  }
}

console.log(`\nDone: ${saved} saved, ${notFound} with no photo of the dish (not-found.txt), ${failed} failed.`);
console.log(`Push: open Admin → Recipes → Add photos by name and choose every .jpg in\n  ${OUT}`);
console.log('Each photo\'s licence is in credits.csv there.');
