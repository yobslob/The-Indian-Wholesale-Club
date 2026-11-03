import { countListings, indexXml, partNames, SITEMAP_HEADERS } from '@/app/sitemaps/sitemap-data';
import { siteUrl } from '@/lib/env';
import { errorMessage, logger } from '@/lib/logger';
import { storeClient } from '@/lib/supabase/store';

// Built per request, never at build time or into the page cache; the CDN keeps it a day (sitemap-data.ts).
export const dynamic = 'force-dynamic';

/** E-2d: the sitemap index: the fixed pages and states, then one part per 5,000 listings. */
export async function GET(): Promise<Response> {
  const base = siteUrl();
  try {
    const parts = partNames(await countListings(storeClient()));
    return new Response(indexXml(parts.map((p) => ({ loc: `${base}/sitemaps/${p}.xml` }))), { headers: SITEMAP_HEADERS });
  } catch (error) {
    logger.warn('sitemap.index_failed', { error: errorMessage(error) });
    return new Response('Busy, try again in a minute.', { status: 503, headers: { 'retry-after': '60' } });
  }
}
