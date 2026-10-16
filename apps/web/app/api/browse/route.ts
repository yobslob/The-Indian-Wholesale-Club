import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PRODUCT_TYPES } from '@repo/shared/domain';

import { MOST, PAGE, parseBrowseQuery, toBrowseFilter } from '@/features/catalog/browse-query';
import { browseCached } from '@/features/catalog/data';
import { limitRequestLocal } from '@/lib/rate-limit';

const type = z.enum(PRODUCT_TYPES);
const offset = z.coerce.number().int().min(0).max(MOST).catch(0);
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
  const count = Math.min(limit.parse(params.get('limit') ?? PAGE), MOST - from);
  if (count <= 0) return NextResponse.json({ error: 'No more pieces on one page.' }, { status: 400 });
  const page = await browseCached(toBrowseFilter(productType.data, parseBrowseQuery(params), from, count));
  return NextResponse.json(page);
}
