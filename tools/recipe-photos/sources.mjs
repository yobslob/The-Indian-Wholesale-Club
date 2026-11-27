/**
 * Where the recipe photo runner looks (D-214). Each source searches for a dish and downloads a result; results come back
 * in one shape for pick.mjs: { id, title, url, author, licences, image: { type, orientation }, stats: { downloads } }.
 *
 * - pexels (free): Pexels' own API with a free key (pexels.com/api). Its licence lets a business use the photos without
 *   paying or crediting; credits.csv keeps the photographer and page anyway.
 * - magnific (paid): Magnific Stock's API (formerly Freepik's), which spends the account's API credits.
 */
import { writeFileSync } from 'node:fs';

import { searchTerm } from './pick.mjs';

async function getJson(url, headers, label) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, Number(res.headers.get('retry-after') ?? 15) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}

async function save(url, file, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: download HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/image\/(jpeg|png|webp)/.test(type)) throw new Error(`${label}: ${type || 'no type'}, not a photo`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const frame = (w, h) => (!w || !h ? 'unknown' : Math.abs(w - h) / Math.max(w, h) < 0.1 ? 'square' : w > h ? 'horizontal' : 'vertical');

export function pexels(key, template) {
  const headers = { Authorization: key };
  return {
    name: 'pexels',
    async search(dish) {
      const q = new URLSearchParams({ query: searchTerm(dish, template), per_page: '40' });
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
    async search(dish) {
      const q = new URLSearchParams({ term: searchTerm(dish, template), limit: '30', order: 'relevance' });
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
