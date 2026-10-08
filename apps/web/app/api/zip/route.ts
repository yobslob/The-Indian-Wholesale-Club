import { NextResponse } from 'next/server';
import { z } from 'zod';

import zips from '@/features/checkout/zip-codes.json';

const LIST = zips as Record<string, string>;
const zipParam = z.string().regex(/^\d{5}$/);

/**
 * Checkout's ZIP → city and state (D-087, D-098): one answer from our own list (GeoNames, built by
 * scripts/build-zips.mjs), so nothing the customer types leaves our server. The list never changes between deploys,
 * so answers are cached for a day in the browser and a year at the edge. An unknown ZIP is a 404 and the form asks for
 * the city and state instead.
 */
export function GET(request: Request): NextResponse {
  const zip = zipParam.safeParse(new URL(request.url).searchParams.get('zip'));
  if (!zip.success) return NextResponse.json({ error: 'A ZIP code is 5 digits.' }, { status: 400 });
  const hit = LIST[zip.data];
  const cache = { 'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable' };
  if (!hit) return NextResponse.json({ error: 'Unknown ZIP code.' }, { status: 404, headers: cache });
  const [city, state] = hit.split('|');
  return NextResponse.json({ city, state }, { headers: cache });
}
