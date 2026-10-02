import { NextResponse } from 'next/server';
import { z } from 'zod';

import { finalizeOrder } from '@/features/checkout/finalize';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { isStripeConfigured } from '@/lib/stripe';
import { serviceClient } from '@/lib/supabase/service';

import type { CheckoutErrorResponse, FinalizeResponse } from '@/features/checkout/types';

const bodySchema = z.object({ paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9_]+$/) });

/**
 * POST /api/orders: the browser reports a finished payment. The server checks
 * it with Stripe and creates the order from the stored checkout (finalize.ts).
 */
export async function POST(
  request: Request,
): Promise<NextResponse<FinalizeResponse | CheckoutErrorResponse>> {
  const limited = limitRequest(request.headers, 'checkout');
  if (limited) return limited;
  if (!isStripeConfigured())
    return NextResponse.json({ error: 'Payments are not available right now.' }, { status: 503 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  try {
    const result = await finalizeOrder(serviceClient(), parsed.data.paymentIntentId, 'browser');
    if (result.ok) return NextResponse.json({ orderNumber: result.orderNumber });
    switch (result.reason) {
      case 'payment_not_complete':
        return NextResponse.json(
          { error: 'Your payment is still processing. We will email you when it completes.' },
          { status: 202 },
        );
      case 'order_refused':
        return NextResponse.json(
          {
            // D-065: the order-by time passed and the delivery window shown could no longer be kept.
            error:
              result.detail === 'cycle_closed'
                ? 'Sorry, the order-by time passed while you were paying, so we could not keep the delivery date we showed you. Your payment has been refunded in full.'
                : 'Sorry, an item sold out while you were paying. Your payment has been refunded in full.',
          },
          { status: 409 },
        );
      default:
        return NextResponse.json({ error: 'We could not confirm this payment.' }, { status: 400 });
    }
  } catch (error) {
    logger.error('orders.finalize_failed', { error: errorMessage(error) });
    return NextResponse.json(
      {
        error:
          'Your payment went through but we could not confirm the order yet. We will email you shortly.',
      },
      { status: 500 },
    );
  }
}
