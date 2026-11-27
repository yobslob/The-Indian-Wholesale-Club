/**
 * Where the recipe photo runner looks (D-214). Each source searches for a dish and downloads a result; results come back
 * in one shape for pick.mjs: { id, title, url, author, licences, image: { type, orientation }, stats: { downloads } }.
 *
 * - openverse (free, no key, the default): openverse.mjs.
 * - pixabay (free): Pixabay's own API with a free key (pixabay.com/api/docs, shown there once logged in).
 *   Its Content License lets a business use the photos without paying or crediting. Its rules, kept here: searches
 *   cached for 24 hours, no bursts of automated queries (one search a second at most), only the picked photo is
 *   downloaded, and it is kept on our own store (no hotlinking).
 * - pexels (free): Pexels' own API with a free key (pexels.com/api; new keys paused since 2026-11). Its licence lets a
 *   business use the photos without paying or crediting; credits.csv keeps the photographer and page anyway.
 * - magnific (paid): Magnific Stock's API (formerly Freepik's), which spends the account's API credits.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { searchTerm } from './pick.mjs';

/** Seconds between two Pixabay photo downloads. */
const PIXABAY_GAP = 15;
const DAY = 24 * 60 * 60 * 1000;
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Calls at least `ms` apart. */
export function spaced(ms) {
  let last = 0;
  return async () => {
    await pause(Math.max(0, last + ms - Date.now()));
    last = Date.now();
  };
}

/** Who is asking, for sites that want to know (Wikimedia's photos refuse a download without it). */
export const AGENT = 'IWC-recipe-photos/1.0';

export async function getJson(url, headers, label) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers });
    // a short wait is waited out; a day's limit (Openverse's 1,000 searches) is not
    const wait = Number(res.headers.get('retry-after') ?? 15);
    if (res.status === 429 && attempt < 5 && wait <= 120) {
      await pause(wait * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}

/**
 * A photo saved to `file`. A refusal for going too fast (HTTP 429: Pixabay's image links answer it to quick downloads,
 * founder's first run 2026-11-27) waits and tries again, longer each time, before the recipe counts as failed.
 */
export async function save(url, file, label) {
  let res;
  for (const wait of [30, 60, 120, 240, null]) {
    res = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (res.status !== 429 || wait === null) break;
    console.log(`     ${label}: the site asks to slow down, waiting ${wait} s`);
    await pause(wait * 1000);
  }
  if (!res.ok) throw new Error(`${label}: download HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/image\/(jpeg|png|webp)/.test(type)) throw new Error(`${label}: ${type || 'no type'}, not a photo`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

export const frame = (w, h) => (!w || !h ? 'unknown' : Math.abs(w - h) / Math.max(w, h) < 0.1 ? 'square' : w > h ? 'horizontal' : 'vertical');

/**
 * Pixabay's search, cached for a day in `cacheDir`, at most one search a second (its API rules), and one photo
 * download every PIXABAY_GAP seconds (its image links refuse quick downloads).
 */
export function pixabay(key, template, cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const searchTurn = spaced(1000);
  const downloadTurn = spaced(PIXABAY_GAP * 1000);
  async function find(q) {
    const file = join(cacheDir, `pixabay-${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}.json`);
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < DAY) return JSON.parse(readFileSync(file, 'utf8'));
    await searchTurn();
    const params = new URLSearchParams({ key, q: q.slice(0, 100), image_type: 'photo', category: 'food', safesearch: 'true', per_page: '40' });
    const data = await getJson(`https://pixabay.com/api/?${params}`, {}, 'pixabay search');
    writeFileSync(file, JSON.stringify(data));
    return data;
  }
  return {
    name: 'pixabay',
    async search(dish, plain = false) {
      const hits = (await find(searchTerm(dish, plain ? '{name}' : template))).hits ?? [];
      return hits.map((h) => ({
        id: h.id,
        // Pixabay's tags ("biryani, rice, indian food") stand in for a title
        title: h.tags ?? '',
        url: h.pageURL,
        author: { name: h.user },
        licences: [{ type: 'pixabay', url: 'https://pixabay.com/service/license-summary/' }],
        image: { type: h.type === 'photo' ? 'photo' : h.type, orientation: frame(h.imageWidth, h.imageHeight) },
        stats: { downloads: h.downloads ?? 0 },
        download: h.largeImageURL,
      }));
    },
    async download(result, file) {
      await downloadTurn();
      await save(result.download, file, `pixabay ${result.id}`);
    },
  };
}

export function pexels(key, template) {
  const headers = { Authorization: key };
  return {
    name: 'pexels',
    async search(dish, plain = false) {
      const q = new URLSearchParams({ query: searchTerm(dish, plain ? '{name}' : template), per_page: '40' });
      const data = await getJson(`https://api.pexels.com/v1/search?${q}`, headers, 'pexels search');
      return (data.photos ?? []).map((p) => ({
        id: p.id,
        // Pexels' alt text describes the photo; it stands in for a title
        title: p.alt ?? '',
        url: p.url,
        author: { name: p.photographer },
        licences: [{ type: 'pexels', url: 'https://www.pexels.com/license/' }],
        image: { type: 'photo', orientation: frame(p.width, p.height) },
        stats: { downloads: 0 },
        download: `${p.src.original}?auto=compress&cs=tinysrgb&w=1500`,
      }));
    },
    download: (result, file) => save(result.download, file, `pexels ${result.id}`),
  };
}

export function magnific(key, template) {
  const api = 'https://api.magnific.com/v1';
  const headers = { 'x-magnific-api-key': key, 'Accept-Language': 'en-US' };
  return {
    name: 'magnific',
    async search(dish, plain = false) {
      const q = new URLSearchParams({ term: searchTerm(dish, plain ? '{name}' : template), limit: '30', order: 'relevance' });
      q.set('filters[content_type][photo]', '1');
      q.set('filters[people][exclude]', '1');
      const data = await getJson(`${api}/resources?${q}`, headers, 'magnific search');
      return (data.data ?? []).map((r) => ({ ...r, licences: r.licenses ?? [] }));
    },
    async download(result, file) {
      const { data } = await getJson(`${api}/resources/${result.id}/download?image_size=medium`, headers, 'magnific download');
      const url = data?.signed_url ?? data?.url;
      if (!url) throw new Error(`magnific ${result.id}: no download link`);
      await save(url, file, `magnific ${result.id}`);
    },
  };
}
