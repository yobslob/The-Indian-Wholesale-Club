import { NextResponse } from 'next/server';
import { z } from 'zod';

import { startFasterPayment } from '@/features/orders/faster';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { isStripeConfigured } from '@/lib/stripe';
import { serviceClient } from '@/lib/supabase/service';

const bodySchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^IWC-\d{6}-[0-9A-F]{10}$/),
  email: z.string().trim().toLowerCase().email(),
});

const GONE = 'This offer is no longer open.';

/** POST /api/orders/faster (D-064): a PaymentIntent for the order's open faster-delivery offer. Website and app. */
export async function POST(
  request: Request,
): Promise<
  NextResponse<{ clientSecret: string; paymentIntentId: string; priceCents: number } | { error: string }>
> {
  const limited = await limitRequest(request.headers, 'orderLookup');
  if (limited) return limited;
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments are not available right now.' }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: GONE }, { status: 404 });
  try {
    const started = await startFasterPayment(
      serviceClient(),
      parsed.data.orderNumber,
      parsed.data.email,
    );
    if (!started.ok) return NextResponse.json({ error: GONE }, { status: 404 });
    return NextResponse.json({
      clientSecret: started.clientSecret,
      paymentIntentId: started.paymentIntentId,
      priceCents: started.priceCents,
    });
  } catch (error) {
    logger.error('faster.start_failed', { error: errorMessage(error) });
    return NextResponse.json(
      { error: 'We could not start the payment. Please try again.' },
      { status: 500 },
    );
  }
}
