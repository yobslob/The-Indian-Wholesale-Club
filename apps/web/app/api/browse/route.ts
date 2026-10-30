import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PRODUCT_TYPES } from '@repo/shared/domain';

import { MOST, PAGE, parseBrowseQuery, toBrowseFilter } from '@/features/catalog/browse-query';
import { browseCached, browseFresh } from '@/features/catalog/data';
import { limitRequestLocal } from '@/lib/rate-limit';

const type = z.enum(PRODUCT_TYPES);
// the endless scroll reads on to the last piece (2026-10-30), a page at a time
const offset = z.coerce.number().int().min(0).max(100_000).catch(0);
const limit = z.coerce.number().int().min(1).max(MOST).catch(PAGE);

/**
 * See all's filters and Show more without reloading the page (D-136): one page of cards, the total and the filter
 * counts, from the same cached store_browse() read the page uses (one round trip, PR-2; a filter set opened before
 * comes from the cache). Only the store's light cards: nothing a customer may not see (D-003, D-017).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'browse');
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const productType = type.safeParse(params.get('type'));
  if (!productType.success) return NextResponse.json({ error: 'Unknown product type.' }, { status: 400 });
  const from = offset.parse(params.get('offset') ?? 0);
  const count = limit.parse(params.get('limit') ?? PAGE);
  const filter = toBrowseFilter(productType.data, parseBrowseQuery(params), from, count);
  // the first 480 from the data cache, as before; deeper pages fresh, so the cache never grows with the scroll
  const page = await (from + count <= MOST ? browseCached(filter) : browseFresh(filter));
  // The same answer for everyone (light cards, no stock): Vercel's CDN keeps it a minute, like /api/card-options, so a
  // filter or Show more someone opened before answers from the edge (about 20 ms, no function run) instead of a
  // function and a data-cache read (about 250 ms). Free: CDN caching is not the page cache (monitoring.md).
  return NextResponse.json(page, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=60' },
  });
}
