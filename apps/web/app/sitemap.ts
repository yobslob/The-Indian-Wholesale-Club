import { getHomeCached, listProductPathsCached } from '@/features/catalog/data';
import { siteUrl } from '@/lib/env';

import type { MetadataRoute } from 'next';

const STATIC_PATHS = [
  '/',
  '/states',
  '/clothing',
  '/spices',
  '/how-it-works',
  '/about',
  '/faq',
  '/contact',
];

/** Storefront pages only (never /admin, D-006). Two cached reads; products are read 1,000 at a time (the API's cap). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [home, products] = await Promise.all([getHomeCached(), listProductPathsCached()]);
  return [
    ...STATIC_PATHS.map((path) => ({ url: `${base}${path}` })),
    ...home.regions.map((r) => ({ url: `${base}/states/${r.slug}` })),
    ...products.map((p) => ({ url: `${base}/states/${p.region_slug}/${p.slug}` })),
  ];
}
