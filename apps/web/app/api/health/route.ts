import { NextResponse } from 'next/server';

import { storeClient } from '@/lib/supabase/store';

export const dynamic = 'force-dynamic';

/** Liveness + one cheap DB read (a store view, as a visitor). No configuration details in production. */
export async function GET(): Promise<NextResponse> {
  const started = Date.now();
  const { error } = await storeClient().from('store_categories').select('id').limit(1);
  const status = error ? 'degraded' : 'healthy';
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ status });
  return NextResponse.json({
    status,
    dbLatencyMs: Date.now() - started,
    services: {
      stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
      email:
        process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL
          ? 'configured'
          : 'not_configured',
    },
  });
}
