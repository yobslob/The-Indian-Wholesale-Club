import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PRODUCT_TYPES } from '@repo/shared/domain';

import { browseCached } from '@/features/catalog/data';
import { limitRequestLocal } from '@/lib/rate-limit';

const query = z.object({
  type: z.enum(PRODUCT_TYPES),
  state: z.string().regex(/^[a-z0-9-]{1,80}$/).optional().catch(undefined),
  not: z.string().max(2000).optional().catch(undefined),
});

/**
 * "Goes well with" in the bag panel (D-140, plan L6): four light cards of the bag's type from its state first (the
 * state's own pieces lead, L2), none already in the bag. Read from the same cached store_browse() the See all pages use,
 * so it adds no query of its own. Only the store's light cards (D-003, D-017).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'browse');
  if (limited) return limited;
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Unknown product type.' }, { status: 400 });
  const { type, state, not } = parsed.data;
  const skip = new Set((not ?? '').split(',').filter(Boolean));
  const page = await browseCached({ productType: type, regionSlug: state, offset: 0, limit: 24 });
  const cards = page.products.filter((p) => !skip.has(p.id) && !p.coming_soon).slice(0, 4);
  // Nothing about the visitor is in the answer (the address carries the bag's ids), so the CDN may keep it too.
  return NextResponse.json({ cards }, { headers: { 'cache-control': 'public, max-age=60, s-maxage=60' } });
}
