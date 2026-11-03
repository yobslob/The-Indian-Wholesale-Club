import { getHomeCached } from '@/features/catalog/data';
import { siteUrl } from '@/lib/env';
import { errorMessage, logger } from '@/lib/logger';
import { storeClient } from '@/lib/supabase/store';

import { listingPart, productPart, SITEMAP_HEADERS, STATIC_PATHS, urlsetXml, type SitemapEntry } from '../sitemap-data';

// Built per request, never at build time or into the page cache; the CDN keeps it a day (sitemap-data.ts).
export const dynamic = 'force-dynamic';

/** E-2d: one part of the sitemap: `pages.xml` (fixed pages and states) or `products-<n>.xml` (5,000 listings). */
export async function GET(_request: Request, { params }: { params: Promise<{ part: string }> }): Promise<Response> {
  const name = (await params).part;
  const base = siteUrl();
  const part = productPart(name);
  if (name !== 'pages.xml' && part === null) return new Response('Not found', { status: 404 });
  try {
    let entries: SitemapEntry[];
    if (part === null) {
      const { regions } = await getHomeCached();
      entries = [...STATIC_PATHS.map((p) => ({ loc: `${base}${p}` })), ...regions.map((r) => ({ loc: `${base}/states/${r.slug}` }))];
    } else {
      entries = await listingPart(storeClient(), part, base);
      if (entries.length === 0 && part > 0) return new Response('Not found', { status: 404 });
    }
    return new Response(urlsetXml(entries), { headers: SITEMAP_HEADERS });
  } catch (error) {
    logger.warn('sitemap.part_failed', { part: name, error: errorMessage(error) });
    return new Response('Busy, try again in a minute.', { status: 503, headers: { 'retry-after': '60' } });
  }
}
