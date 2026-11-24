import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCountryPrices } from '@repo/db/store';

import { errorMessage, logger } from '@/lib/logger';
import { limitRequestLocal } from '@/lib/rate-limit';
import { storeClient } from '@/lib/supabase/store';

const ids = z.array(z.string().uuid()).max(200).default([]);
const slugs = z.array(z.string().regex(/^[a-z0-9-]{1,120}$/)).max(200).default([]);
const bodySchema = z.object({ country: z.string().regex(/^[a-z]{2}$/), variants: ids, products: ids, recipes: slugs });

/**
 * POST /api/country/prices (D-208): the prices a page abroad shows, in that country (US cents with its freight), worked
 * out in the database from weights that never leave it (non-negotiable 1). `prices: null` = IWC does not sell there.
 * Only visitors outside the US ask (country-prices.ts batches a page's asks into one request).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'browse');
  if (limited) return limited;
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'country, variants, products, recipes' }, { status: 400 });
  try {
    const prices = await getCountryPrices(storeClient(), body.data.country, body.data);
    return NextResponse.json({ prices }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.warn('country.prices_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'Not available' }, { status: 503 });
  }
}
