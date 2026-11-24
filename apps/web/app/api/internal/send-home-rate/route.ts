import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { checkDayRate } from '@/features/send-home/day-rate';
import { errorMessage, logger } from '@/lib/logger';
import { serviceClient } from '@/lib/supabase/service';

/** Compared in constant time (as hashes, so the lengths match), as the payment sweep does. */
function sameSecret(given: string, expected: string): boolean {
  const hash = (v: string): Buffer => createHash('sha256').update(v).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

/**
 * POST /api/internal/send-home-rate (D-206): Send home's daily rate check. Called once a day by the database's timer
 * (`iwc-send-home-rate`, migration 20261126090000) with `Authorization: Bearer $EMAIL_OUTBOX_CRON_SECRET`, the same
 * secret as the email timer and the payment sweep.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.EMAIL_OUTBOX_CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const rate = await checkDayRate(serviceClient());
    return NextResponse.json({ rate });
  } catch (error) {
    logger.error('send_home.rate_check_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'Rate not checked' }, { status: 502 });
  }
}
