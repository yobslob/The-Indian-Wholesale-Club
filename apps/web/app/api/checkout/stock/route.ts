import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCheckoutContext } from '@repo/db/server';

import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { stockProblems } from '@/features/checkout/stock';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

import type { CheckoutErrorResponse, CheckoutStockResponse } from '@/features/checkout/types';

const bodySchema = z.object({
  lines: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE) }))
    .min(1)
    .max(50),
});

/**
 * POST /api/checkout/stock (§10 Y-3): what checkout says when it opens, before any address: the bag's lines that are sold
 * out, no longer on sale or short. Website and app. One DB round trip, once per checkout visit; every re-price checks
 * again (pricing.ts) and create_order has the last word. No payment starts here. If this fails checkout simply opens.
 */
export async function POST(request: Request): Promise<NextResponse<CheckoutStockResponse | CheckoutErrorResponse>> {
  const limited = await limitRequest(request.headers, 'checkout');
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  try {
    const quantities = new Map<string, number>();
    for (const l of parsed.data.lines) {
      quantities.set(l.variantId, Math.min((quantities.get(l.variantId) ?? 0) + l.quantity, MAX_QTY_PER_LINE));
    }
    const context = await getCheckoutContext(serviceClient(), [...quantities.keys()], null);
    return NextResponse.json({ lines: stockProblems(context, quantities) });
  } catch (error) {
    logger.warn('checkout.stock_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'We could not check your bag just now.' }, { status: 503 });
  }
}
