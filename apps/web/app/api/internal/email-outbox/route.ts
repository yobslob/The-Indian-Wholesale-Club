import { NextResponse } from 'next/server';

import { listDueEmails } from '@repo/db/server';

import { revalidateIfCutoffPassed } from '@/features/catalog/revalidate';
import { deliverOutboxRow } from '@/lib/email/send';
import { errorMessage, logger } from '@/lib/logger';
import { serviceClient } from '@/lib/supabase/service';

/**
 * POST /api/internal/email-outbox: retries due emails (called by a scheduler
 * with `Authorization: Bearer $EMAIL_OUTBOX_CRON_SECRET`, docs/ops.md). The same
 * minute timer refreshes the cached store once a cycle has closed by itself, so
 * no page keeps showing a past "order by" time (D-008).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.EMAIL_OUTBOX_CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const service = serviceClient();
  const rows = await listDueEmails(service, 20);
  const results = { sent: 0, failed: 0, skipped: 0, storeRefreshed: false };
  for (const row of rows) results[await deliverOutboxRow(service, row)] += 1;
  try {
    results.storeRefreshed = await revalidateIfCutoffPassed();
  } catch (error) {
    logger.error('store.cutoff_refresh_failed', { error: errorMessage(error) });
  }
  return NextResponse.json(results);
}
