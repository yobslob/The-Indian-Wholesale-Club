import { NextResponse } from 'next/server';
import { z } from 'zod';

import { finalizeFasterPayment } from '@/features/orders/faster';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

const bodySchema = z.object({ paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9_]+$/) });

/** POST /api/orders/faster/confirm (D-064): after paying, the new window is set (or the payment refunded). */
export async function POST(request: Request): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const limited = limitRequest(request.headers, 'orderLookup');
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  try {
    const result = await finalizeFasterPayment(serviceClient(), parsed.data.paymentIntentId);
    if (result.ok) return NextResponse.json({ ok: true });
    switch (result.reason) {
      case 'payment_not_complete':
        return NextResponse.json(
          { error: 'Your payment is still processing. This page updates when it completes.' },
          { status: 202 },
        );
      case 'offer_closed':
        return NextResponse.json(
          {
            error:
              'Sorry, your order was already on its way, so the offer had closed. Your payment has been refunded in full.',
          },
          { status: 409 },
        );
      default:
        return NextResponse.json({ error: 'We could not confirm this payment.' }, { status: 400 });
    }
  } catch (error) {
    logger.error('faster.confirm_failed', { error: errorMessage(error) });
    return NextResponse.json(
      { error: 'We could not confirm the payment yet. Please refresh in a minute.' },
      { status: 500 },
    );
  }
}
