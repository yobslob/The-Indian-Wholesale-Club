#!/usr/bin/env node
/**
 * scripts/demo-photos.mjs: fills catalogue/photos/ (catalogue/README.md) with FREE-LICENCE demo photos for the demo
 * round (D-078): the clothing listings of the five demo states, and a main photo for each state. Photos come from
 * Openverse, searching only curated public-domain collections (museums, stock product photos), are matched by
 * category (and by name for each state's launch picks), shrunk to 1200 px, checked by eye (rejects go in
 * catalogue/demo-photo-exclude.txt), and written with:
 *   alt.txt      "<listing> (demo photo)" per file
 *   credit.json  the attribution each CC BY / BY-SA photo needs (shown under the photo on the product page)
 *   source.json  each file's Openverse id and source, to reject one on review (catalogue/demo-photo-exclude.txt)
 * They are demo stand-ins, not pictures of the listed piece; `pnpm demo:clear` removes them from the store.
 *
 *   pnpm demo:photos            fetch what is missing (folders that already have photos are left alone)
 *
 * Openverse allows 20 anonymous searches a minute and 200 a day: searches are paced and cached in
 * catalogue/photos/.openverse-cache.json, so a second run spends no quota. The photos folder is not in git.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sharp = createRequire(resolve('apps/web/package.json'))('sharp'); // Next.js's own image library
const REGIONS = ['delhi', 'maharashtra', 'kerala', 'assam', 'punjab'];
const ROOT = 'catalogue/photos';
const CACHE = `${ROOT}/.openverse-cache.json`;
const PER_LISTING = 2;

/**
 * Where a category's photos come from. Openverse's open web search returned too many off-topic photos and strangers
 * (2026-10-07 review), so only curated public-domain (CC0) collections are searched: museum collections for
 * traditional dress (photographed like products, mostly without people), stock product photos for modern wear.
 */
const MUSEUMS = 'met,clevelandmuseum,brooklynmuseum,smithsonian_cooper_hewitt_museum';
const STOCK = 'rawpixel,stocksnap';
/** Two or three searches per category make its pool; each pool photo is used at most three times in a state. */
const CATEGORY_QUERIES = {
  sarees: [MUSEUMS, ['sari', 'saree', 'silk textile india']],
  kurtas: [MUSEUMS, ['kurta', 'tunic india']],
  'suits-and-sets': [MUSEUMS, ['salwar', 'choli', 'coat india']],
  lehengas: [MUSEUMS, ['ghagra', 'skirt india']],
  'dupattas-and-stoles': [MUSEUMS, ['phulkari', 'odhni']],
  shawls: [MUSEUMS, ['shawl', 'kashmir shawl']],
  headwear: [MUSEUMS, ['turban', 'cap india']],
  kids: [MUSEUMS, ["child's dress india", "child's coat"]],
  // "dhoti" at museums finds sculptures wearing one: woven cloth instead.
  'dhotis-and-mundus': [MUSEUMS, ['cotton cloth india', 'woven cotton textile']],
  footwear: [MUSEUMS, ['shoes india', 'slippers']],
  accessories: [MUSEUMS, ['bangle', 'purse india']],
  fabrics: [MUSEUMS, ['textile india', 'block printed textile']],
  'jeans-and-trousers': [STOCK, ['jeans', 'trousers']],
  'shirts-and-tops': [STOCK, ['t-shirt', 'shirt hanger']],
  'jackets-and-knitwear': [STOCK, ['jacket', 'sweater']],
  'co-ords-and-dresses': [STOCK, ['dress', 'summer dress']],
};
/** Never stand-ins for clothing: armour, sculpture and religious images (2026-10-07 review). */
const OFF_TOPIC = /helmet|armou?r|figure|statue|sculpture|vishnu|shiva|jina|padmapani|nagaraja|buddha|bodhisattva|ganesha|deity|funerary|relief|stele/i;
/** Photos rejected on review (off-topic, people in focus, armour…): Openverse ids, one per line. */
const EXCLUDE = new Set(
  existsSync('catalogue/demo-photo-exclude.txt')
    ? readFileSync('catalogue/demo-photo-exclude.txt', 'utf8').split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    : [],
);
/** A main photo for the states without one of the founder's (design/mockups/assets has Kerala and Punjab). */
const REGION_QUERIES = { delhi: 'India Gate Delhi', maharashtra: 'Gateway of India Mumbai', assam: 'Assam tea garden' };
/** The founder's own photos of a listing (design/mockups/assets), used instead of stand-ins. */
const FOUNDER_LISTING_PHOTOS = {
  'kerala/kasavu-saree': [
    ['Kasavu_main.jpg', 'Kasavu saree with its gold border, spread out on the grass, worn seated'],
    ['kasavu_front_full.png', 'Kasavu saree, full length, front'],
    ['kasavu_back_full.png', 'Kasavu saree, full length, back, the gold pallu over the shoulder'],
    ['kasavu_closeup.png', 'Close-up of the kasavu saree gold border and weave'],
  ],
};
const FOUNDER_REGION_PHOTOS = {
  kerala: [['kerala.jpg', 'Kerala']],
  punjab: [
    ['punjab_1.jpg', 'Punjab'],
    ['punjab_2.jpg', 'Two women in embroidered suits and gold jewellery sit on the floor by brass pots, peanuts and popcorn'],
  ],
};

const slugify = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
let searches = 0;

/** Openverse results for a query, best licences first (no credit needed), never no-derivatives. */
async function search(q, { publicDomainOnly = false, sources = null } = {}) {
  // v3: curated sources only (see MUSEUMS); small photos are dropped below.
  const key = `v3:${publicDomainOnly ? 'pd' : 'all'}:${sources ?? '*'}:${q}`;
  if (!cache[key]) {
    const params = new URLSearchParams({ q, page_size: '20', mature: 'false' });
    if (publicDomainOnly) params.set('license', 'cc0,pdm');
    else params.set('license_type', 'commercial');
    if (sources) params.set('source', sources);
    if (searches > 0) await sleep(3500); // 20 a minute
    searches += 1;
    const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, { headers: { 'user-agent': 'iwc-demo-photos' } });
    if (res.status === 429) throw new Error('Openverse daily search limit reached: run again tomorrow (cached searches are kept).');
    if (!res.ok) throw new Error(`Openverse ${res.status} for "${q}"`);
    const body = await res.json();
    cache[key] = body.results.map((r) => ({
      id: r.id, url: r.url, title: r.title, license: r.license, license_version: r.license_version,
      license_url: r.license_url, attribution: r.attribution, landing: r.foreign_landing_url, width: r.width, height: r.height,
    }));
    writeFileSync(CACHE, JSON.stringify(cache));
  }
  const rank = (r) => (['cc0', 'pdm'].includes(r.license) ? 0 : 1);
  return cache[key]
    .filter((r) => r.license !== 'by-nd' && r.license !== 'by-nc-nd' && !EXCLUDE.has(r.id) && !OFF_TOPIC.test(r.title ?? ''))
    // Museum records often have no size; the rest must be at least 500 px.
    .filter((r) => (r.width === null || r.width >= 500) && (r.height === null || r.height >= 500))
    .sort((a, b) => rank(a) - rank(b));
}

/** Download, shrink to 1200 px on the long side, save as JPEG. False when the source is gone. */
async function save(photo, file) {
  try {
    const res = await fetch(photo.url, { headers: { 'user-agent': 'iwc-demo-photos' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return false;
    const input = Buffer.from(await res.arrayBuffer());
    await sharp(input).rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(file);
    return true;
  } catch {
    return false;
  }
}

const credit = (p) => (['cc0', 'pdm'].includes(p.license) ? null : { text: p.attribution, license_url: p.license_url, source: p.landing });
const hasImages = (dir) => existsSync(dir) && readdirSync(dir).some((f) => /\.(jpe?g|png|webp)$/i.test(f));

let listingsDone = 0;
const missing = [];
for (const region of REGIONS) {
  const items = (await import(pathToFileURL(`catalogue/data/${region}.mjs`).href)).default.filter((i) => i.type === 'clothing');
  const used = new Map(); // photo id → times used in this state

  // The state's main photo.
  const regionDir = `${ROOT}/${region}/_region`;
  if (!hasImages(regionDir)) {
    mkdirSync(regionDir, { recursive: true });
    const alts = [];
    if (FOUNDER_REGION_PHOTOS[region]) {
      for (const [i, [file, alt]] of FOUNDER_REGION_PHOTOS[region].entries()) {
        copyFileSync(`design/mockups/assets/${file}`, `${regionDir}/${i + 1}-${file}`);
        alts.push(`${i + 1}-${file}: ${alt}`);
      }
    } else {
      const landscape = (await search(REGION_QUERIES[region], { publicDomainOnly: true })).filter((p) => p.width > p.height * 1.2);
      for (const p of landscape) {
        if (await save(p, `${regionDir}/1-main.jpg`)) {
          alts.push(`1-main.jpg: ${p.title || REGION_QUERIES[region]}`);
          break;
        }
      }
    }
    writeFileSync(`${regionDir}/alt.txt`, alts.join('\n'));
  }

  for (const item of items) {
    const dir = `${ROOT}/${region}/${item.slug ?? slugify(item.name)}`;
    if (hasImages(dir)) {
      listingsDone += 1;
      continue;
    }
    const founder = FOUNDER_LISTING_PHOTOS[`${region}/${item.slug ?? slugify(item.name)}`];
    if (founder) {
      mkdirSync(dir, { recursive: true });
      const alts = founder.map(([file, alt], i) => {
        copyFileSync(`design/mockups/assets/${file}`, `${dir}/${i + 1}-${file.toLowerCase()}`);
        return `${i + 1}-${file.toLowerCase()}: ${alt}`;
      });
      writeFileSync(`${dir}/alt.txt`, alts.join('\n'));
      writeFileSync(`${dir}/credit.json`, '{}');
      listingsDone += 1;
      continue;
    }
    const [sources, queries] = CATEGORY_QUERIES[item.category] ?? [MUSEUMS, []];
    const byName = item.launch !== undefined ? await search(item.name, { sources }) : [];
    const pool = [];
    for (const q of queries) pool.push(...(await search(q, { sources })));
    // Name matches first; then the least-used pool photos (at most three times in a state).
    const candidates = [
      ...byName,
      ...pool.filter((p) => (used.get(p.id) ?? 0) < 3).sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0)),
    ];
    mkdirSync(dir, { recursive: true });
    const alts = [];
    const credits = {};
    const origins = {};
    const taken = new Set();
    for (const p of candidates) {
      if (alts.length === PER_LISTING) break;
      if (taken.has(p.id)) continue;
      taken.add(p.id);
      const file = `${alts.length + 1}-demo.jpg`;
      if (!(await save(p, `${dir}/${file}`))) continue;
      used.set(p.id, (used.get(p.id) ?? 0) + 1);
      alts.push(`${file}: ${item.name} (demo photo)`);
      origins[file] = { id: p.id, title: p.title, source: p.landing };
      const c = credit(p);
      if (c) credits[file] = c;
    }
    if (alts.length === 0) missing.push(`${region}/${item.name}`);
    else listingsDone += 1;
    writeFileSync(`${dir}/alt.txt`, alts.join('\n'));
    writeFileSync(`${dir}/credit.json`, JSON.stringify(credits, null, 2));
    writeFileSync(`${dir}/source.json`, JSON.stringify(origins, null, 2));
  }
  console.log(`${region}: done`);
}
console.log(`Listings with photos: ${listingsDone}. Openverse searches this run: ${searches}.`);
if (missing.length) console.log(`No photo found for:\n  ${missing.join('\n  ')}`);
