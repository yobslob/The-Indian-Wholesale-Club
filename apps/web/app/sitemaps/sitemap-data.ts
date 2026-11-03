import { z } from 'zod';

import { productPath } from '@repo/shared/domain';

import type { IwcClient } from '@repo/db';

/**
 * E-2d: the sitemap in parts. `/sitemap.xml` is the index (the address robots.txt and Search Console know), then
 * `/sitemaps/pages.xml` (the fixed pages and the 36 states) and `/sitemaps/products-<n>.xml`, 5,000 listings each.
 * Built per request and kept a day by Vercel's CDN (SITEMAP_HEADERS): no page-cache (ISR) writes at all, and the
 * database sees one count for the index and five 1,000-row reads per part (the API's cap) once a day per CDN region.
 */
export const PRODUCTS_PER_PART = 5000;
const ROWS_PER_READ = 1000;

export const SITEMAP_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, max-age=3600',
  'cdn-cache-control': 'max-age=86400, stale-while-revalidate=86400',
};

/** Storefront pages only (never /admin, D-006; search and the bag are kept out by robots.ts). */
export const STATIC_PATHS = [
  '/',
  '/states',
  '/clothing',
  '/food',
  '/home-and-gifts',
  '/7-day-delivery',
  '/how-it-works',
  '/about',
  '/faq',
  '/shipping-returns',
  '/contact',
];

export interface SitemapEntry {
  loc: string;
  lastmod?: string | null;
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

const item = (tag: 'url' | 'sitemap', e: SitemapEntry): string =>
  `<${tag}><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${escapeXml(e.lastmod)}</lastmod>` : ''}</${tag}>`;

export function urlsetXml(entries: readonly SitemapEntry[]): string {
  return `${XML_HEAD}<urlset ${NS}>\n${entries.map((e) => item('url', e)).join('\n')}\n</urlset>\n`;
}

export function indexXml(entries: readonly SitemapEntry[]): string {
  return `${XML_HEAD}<sitemapindex ${NS}>\n${entries.map((e) => item('sitemap', e)).join('\n')}\n</sitemapindex>\n`;
}

/** The part names for a catalogue of `count` live listings. */
export function partNames(count: number): string[] {
  const parts = Math.max(1, Math.ceil(count / PRODUCTS_PER_PART));
  return ['pages', ...Array.from({ length: parts }, (_, i) => `products-${i}`)];
}

/** `products-3.xml` → 3; anything else → null. */
export function productPart(name: string): number | null {
  const m = /^products-(\d{1,3})\.xml$/.exec(name);
  return m ? Number(m[1]) : null;
}

/** How many listings the store shows (one count on store_products). */
export async function countListings(client: IwcClient): Promise<number> {
  const { count, error } = await client.from('store_products').select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

const pathRow = z.object({ region_slug: z.string().nullable(), slug: z.string(), published_at: z.string().nullable() });

/** One part's listings: rows part×5,000 … +4,999 in id order, read 1,000 at a time. */
export async function listingPart(client: IwcClient, part: number, base: string): Promise<SitemapEntry[]> {
  const from = part * PRODUCTS_PER_PART;
  const reads = Array.from({ length: PRODUCTS_PER_PART / ROWS_PER_READ }, (_, i) => from + i * ROWS_PER_READ);
  const pages = await Promise.all(
    reads.map(async (start) => {
      const { data, error } = await client
        .from('store_products')
        .select('region_slug, slug, published_at')
        .order('id')
        .range(start, start + ROWS_PER_READ - 1);
      if (error) throw new Error(error.message);
      return z.array(pathRow).parse(data ?? []);
    }),
  );
  return pages.flat().map((p) => ({
    loc: `${base}${productPath(p.region_slug, p.slug)}`,
    lastmod: p.published_at ? p.published_at.slice(0, 10) : null,
  }));
}
