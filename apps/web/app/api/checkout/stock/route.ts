import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCheckoutContext } from '@repo/db/server';

import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { offersOf } from '@/features/checkout/pricing';
import { stockProblems } from '@/features/checkout/stock';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { requestUser } from '@/lib/request-user';
import { serviceClient } from '@/lib/supabase/service';

import type { CheckoutErrorResponse, CheckoutStockResponse } from '@/features/checkout/types';

const bodySchema = z.object({
  lines: z
    .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE) }))
    .min(1)
    .max(50),
  // D-192: the coupon on the bag, or one typed by hand: when valid it joins the offers
  promoCode: z.string().trim().max(40).nullish(),
});

/**
 * POST /api/checkout/stock (§10 Y-3): what checkout says when it opens, before any address: the bag's lines that are sold
 * out, no longer on sale or short. Website and app. One DB round trip, once per checkout visit and once per tab in five minutes for the bag's coupons (offers.ts); every re-price checks
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
    // D-191, D-192: in this same read, the coupons and the account's coins, for the bag as well as checkout
    const user = await requestUser(request);
    const context = await getCheckoutContext(serviceClient(), [...quantities.keys()], parsed.data.promoCode ?? null, null, {
      userId: user?.id ?? null,
      email: user?.email ?? null,
    });
    return NextResponse.json({ lines: stockProblems(context, quantities), offers: offersOf(context) });
  } catch (error) {
    logger.warn('checkout.stock_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'We could not check your bag just now.' }, { status: 503 });
  }
}
