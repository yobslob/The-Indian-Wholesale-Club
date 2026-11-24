import { NextResponse } from 'next/server';

import { getSendHome, type SendHome } from '@repo/db/store';

import { errorMessage, logger } from '@/lib/logger';
import { limitRequestLocal } from '@/lib/rate-limit';
import { sessionClient } from '@/lib/supabase/server';
import { storeClient } from '@/lib/supabase/store';

/**
 * GET /api/send-home (D-205): the bag's Send home card: off (null) while no rate is set, else the cap, the account's
 * switch and a signed-in customer's loved ones (masked). One small read when a bag is looked at, cached for the tab
 * (features/send-home/settings.ts). Never cached by the CDN: it can carry the customer's own people. With `?regions`,
 * the sheet's list of states instead (cached).
 */
export async function GET(
  request: Request,
): Promise<NextResponse<{ sendHome: SendHome } | { regions: { id: string; name: string }[] } | { error: string }>> {
  const limited = limitRequestLocal(request.headers, 'sendHome');
  if (limited) return limited;
  try {
    // the sheet's "Where's home?": the 36 states and UTs, the same for everyone (D-002), kept by the CDN a day
    if (new URL(request.url).searchParams.has('regions')) {
      const { data, error } = await storeClient().from('store_regions').select('id, name').order('name');
      if (error) throw error;
      return NextResponse.json({ regions: data ?? [] }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });
    }
    const sendHome = await getSendHome(await sessionClient());
    return NextResponse.json({ sendHome }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.warn('send_home.read_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'Not available' }, { status: 503 });
  }
}
