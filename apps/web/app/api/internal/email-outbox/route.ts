import { NextResponse } from 'next/server';

import { processOrderConfirmationEmail } from '@/lib/email/resend';
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

import type { OrderWithFullDetails } from '@repo/shared/types';

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.EMAIL_OUTBOX_CRON_SECRET ||
      request.headers.get('authorization') !== `Bearer ${process.env.EMAIL_OUTBOX_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: entries, error } = await supabaseAdmin
    .from('email_outbox')
    .select('id, recipient, payload')
    .in('status', ['pending', 'processing'])
    .lte('next_attempt_at', new Date().toISOString())
    .limit(25);
  if (error) {
    logger.error('email.outbox_lookup_failed', { error: error.message });
    return NextResponse.json({ error: 'Unable to load email outbox' }, { status: 500 });
  }

  let processed = 0;
  for (const entry of entries ?? []) {
    const claimed = await supabaseAdmin.from('email_outbox').update({ status: 'processing' })
      .eq('id', entry.id).eq('status', 'pending').select('id').maybeSingle();
    if (!claimed.data) continue;
    await processOrderConfirmationEmail(
      entry.id,
      entry.payload as unknown as OrderWithFullDetails,
      entry.recipient,
    );
    processed++;
  }
  return NextResponse.json({ processed });
}
