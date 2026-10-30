import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCardOptions, getCardOptionsFor } from '@repo/db/store';

import { limitRequestLocal } from '@/lib/rate-limit';
import { storeClient } from '@/lib/supabase/store';

const id = z.string().uuid();
const ids = z
  .string()
  .max(48 * 37)
  .transform((v) => v.split(',').filter(Boolean))
  .pipe(z.array(id).min(1).max(48));

const CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' };

/**
 * Cards' options (D-145; the page does not carry them, slim-cards.ts): `?id=` one piece, read when its + is pressed;
 * `?ids=a,b,…` (up to 48) the several-option cards a page has on screen, read while the shopper looks so a + opens at
 * once (2026-10-30), answered as { [product id]: options }. The store's own variants view, so nothing a customer may not
 * see (D-003, D-017). Vercel's CDN keeps each answer a minute (free, unlike the page cache); the numbers left are for
 * display only, checkout re-checks stock on the server.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'cardOptions');
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  if (params.has('ids')) {
    const list = ids.safeParse(params.get('ids'));
    if (!list.success) return NextResponse.json({ error: 'Unknown pieces.' }, { status: 400 });
    return NextResponse.json(await getCardOptionsFor(storeClient(), list.data), { headers: CACHE });
  }
  const productId = id.safeParse(params.get('id'));
  if (!productId.success) return NextResponse.json({ error: 'Unknown piece.' }, { status: 400 });
  const options = await getCardOptions(storeClient(), productId.data);
  return NextResponse.json(options, { headers: CACHE });
}
