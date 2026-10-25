import { NextResponse } from 'next/server';

import { getSearchHints } from '@repo/db/store';

import { limitRequestLocal } from '@/lib/rate-limit';
import { storeClient } from '@/lib/supabase/store';

/**
 * What the search boxes suggest while typing (D-160): the listings' words, synonyms, categories, states and popular
 * searches, the same for everyone. Read once by a box when it is first focused; Vercel's CDN keeps it an hour (free,
 * not the page cache, monitoring.md), so typing never reaches a function or the database. The app reads it too.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limited = limitRequestLocal(request.headers, 'searchHints');
  if (limited) return limited;
  const hints = await getSearchHints(storeClient());
  // public and the same for everyone, so any origin may read it (the app's web build runs on another one)
  return NextResponse.json(hints, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
