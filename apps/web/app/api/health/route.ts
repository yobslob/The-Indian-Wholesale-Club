import { NextResponse } from 'next/server';

import { isStripeConfigured } from '@/lib/stripe';
import { storeClient } from '@/lib/supabase/store';

export const dynamic = 'force-dynamic';

/** F-0/F-5: the read gives up after 4 s (inside the clients' 8 s), so an uptime check gets its answer in seconds. */
const HEALTH_READ_MS = 4_000;

/**
 * Liveness + one cheap DB read (a store view, as a visitor). No configuration details in production.
 * `degraded` (the read failed or timed out) answers 503, so an uptime service alerts on the status alone.
 */
export async function GET(): Promise<NextResponse> {
  const started = Date.now();
  const { error } = await storeClient()
    .from('store_categories')
    .select('id')
    .limit(1)
    .abortSignal(AbortSignal.timeout(HEALTH_READ_MS));
  const status = error ? 'degraded' : 'healthy';
  const init = error ? { status: 503, headers: { 'Retry-After': '30' } } : undefined;
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ status }, init);
  return NextResponse.json(
    {
      status,
      dbLatencyMs: Date.now() - started,
      services: {
        // F-5: both keys and the webhook's signing secret (payments and their orders); never shown in production.
        stripe: isStripeConfigured() && process.env.STRIPE_WEBHOOK_SECRET ? 'configured' : 'not_configured',
        email:
          process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL
            ? 'configured'
            : 'not_configured',
      },
    },
    init,
  );
}
