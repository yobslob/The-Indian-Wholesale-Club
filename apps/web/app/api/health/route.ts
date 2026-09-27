import { NextResponse } from 'next/server';

import { resend } from '@/lib/email/resend';
import { isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  let dbStatus: 'connected' | 'unreachable' = 'unreachable';

  try {
    const { error } = await supabaseAdmin.from('categories').select('id').limit(1);
    if (!error) {
      dbStatus = 'connected';
    }
  } catch {
    dbStatus = 'unreachable';
  }

  const isProd = process.env.NODE_ENV === 'production';

  // In production, return minimal health check to prevent information disclosure (H10)
  if (isProd) {
    return NextResponse.json({
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
    });
  }

  const stripeConfigured = isStripeConfigured();
  const resendConfigured = Boolean(
    resend && process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('re_test_...'),
  );

  const latencyMs = Date.now() - startTime;

  return NextResponse.json({
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs,
    services: {
      database: dbStatus,
      stripe: stripeConfigured ? 'configured' : 'simulator',
      resend: resendConfigured ? 'configured' : 'simulator',
    },
  });
}

