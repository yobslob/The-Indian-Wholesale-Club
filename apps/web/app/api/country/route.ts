import { NextResponse } from 'next/server';

import { getCountries } from '@repo/db/store';

import { errorMessage, logger } from '@/lib/logger';
import { limitRequestLocal } from '@/lib/rate-limit';
import { storeClient } from '@/lib/supabase/store';

/**
 * GET /api/country (D-208): where the visitor is, the country Vercel reads from their IP (`x-vercel-ip-country`) when IWC
 * sells there, else null; asked once a tab when no country has been chosen (market.tsx), never cached. With `?list`, the
 * countries IWC sells in (code and name), the same for everyone, kept by the CDN a day.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'browse');
  if (limited) return limited;
  try {
    const countries = await getCountries(storeClient());
    if (new URL(request.url).searchParams.has('list'))
      return NextResponse.json({ countries }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
    const ip = (request.headers.get('x-vercel-ip-country') ?? '').toLowerCase();
    const country = countries.some((c) => c.code === ip) ? ip : null;
    return NextResponse.json({ country }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.warn('country.read_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'Not available' }, { status: 503 });
  }
}
