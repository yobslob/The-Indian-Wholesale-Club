/**
 * Openverse (D-214, founder 2026-11-27: "Yes, with credits"): the open-source search over openly licensed photos,
 * most from Flickr and Wikimedia Commons (api.openverse.org, no key: 100 searches a minute, 1,000 a day). Only licences
 * that allow a shop's use are asked for: CC0, the Public Domain Mark, CC BY and CC BY-SA (never NC, never ND). CC BY
 * and BY-SA ask for credit: the recipe page shows each photo's author, title and licence (`photo_credit`).
 * Searches are cached for a day and one a second; the photos come from Flickr's and Wikimedia's own servers.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { searchTerm } from './pick.mjs';
import { AGENT, frame, getJson, save, spaced } from './sources.mjs';

const DAY = 24 * 60 * 60 * 1000;
/** Narrower than this and the recipe page (768 px wide) would show it blurred. */
const MIN_WIDTH = 640;

const LICENCE = { by: 'CC BY', 'by-sa': 'CC BY-SA', cc0: 'CC0', pdm: 'Public Domain Mark' };

/** "CC BY 2.0", "CC0 1.0": how a licence is named in the credit. */
export const licenceName = (code, version) =>
  `${LICENCE[code] ?? String(code).toUpperCase()}${version ? ` ${version}` : ''}`;

/**
 * A Wikimedia Commons original can be 4,000 px and 8 MB (and too many tokens for the vision model): its 1,280 px copy from the same server instead
 * (upload.wikimedia.org/…/commons/7/79/X.jpg → …/commons/thumb/7/79/X.jpg/1280px-X.jpg).
 */
export function sizedUrl(url, width) {
  const m = url.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/([^/]+\.(?:jpe?g|png))$/i);
  return m && width > 1280 ? `${m[1]}/thumb/${m[2]}/${m[3]}/1280px-${m[3]}` : url;
}

/** One Openverse result in the runner's shape (pick.mjs reads title + tags as its words). */
export function fromOpenverse(r) {
  const tags = (r.tags ?? []).map((t) => t.name).filter(Boolean);
  return {
    id: r.id,
    title: [r.title ?? '', ...tags].join(', '),
    name: r.title ?? '',
    url: r.foreign_landing_url,
    author: { name: r.creator ?? '' },
    licences: [{ type: licenceName(r.license, r.license_version), url: r.license_url ?? '' }],
    image: { type: 'photo', orientation: frame(r.width, r.height) },
    width: r.width ?? 0,
    stats: { downloads: 0 },
    download: sizedUrl(r.url, r.width ?? 0),
  };
}

export function openverse(template, cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const turn = spaced(1000);
  async function find(q) {
    const file = join(cacheDir, `openverse-${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}.json`);
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < DAY) return JSON.parse(readFileSync(file, 'utf8'));
    await turn();
    const params = new URLSearchParams({ q, license: 'cc0,pdm,by,by-sa', page_size: '20', mature: 'false' });
    const data = await getJson(`https://api.openverse.org/v1/images/?${params}`, { 'User-Agent': AGENT }, 'openverse search');
    writeFileSync(file, JSON.stringify(data));
    return data;
  }
  const downloadTurn = spaced(1000);
  return {
    name: 'openverse',
    async search(dish, plain = false) {
      const data = await find(searchTerm(dish, plain ? '{name}' : template));
      return (data.results ?? [])
        .filter((r) => !r.mature && (r.width ?? 0) >= MIN_WIDTH && /^(jpe?g|png)$/i.test(r.filetype ?? 'jpg'))
        .map(fromOpenverse);
    },
    async download(result, file) {
      await downloadTurn();
      await save(result.download, file, `openverse ${result.id}`);
    },
  };
}
