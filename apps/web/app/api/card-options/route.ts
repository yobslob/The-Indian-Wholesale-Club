import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCardOptions } from '@repo/db/store';

import { limitRequestLocal } from '@/lib/rate-limit';
import { storeClient } from '@/lib/supabase/store';

const id = z.string().uuid();

/**
 * A card's options, read when its + is pressed (D-145; the page no longer carries them, slim-cards.ts): the store's
 * own variants view, so nothing a customer may not see (D-003, D-017). Vercel's CDN keeps each answer a minute (free,
 * unlike the page cache); the numbers left are for display only, checkout re-checks stock on the server.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'cardOptions');
  if (limited) return limited;
  const productId = id.safeParse(new URL(request.url).searchParams.get('id'));
  if (!productId.success) return NextResponse.json({ error: 'Unknown piece.' }, { status: 400 });
  const options = await getCardOptions(storeClient(), productId.data);
  return NextResponse.json(options, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' } });
}
