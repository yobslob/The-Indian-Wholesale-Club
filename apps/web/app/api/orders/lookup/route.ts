import { NextResponse } from 'next/server';
import { z } from 'zod';

import { lookupGuestOrder } from '@repo/db/server';

import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

import type { OrderDetail } from '@repo/db/store';

const bodySchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^IWC-\d{6}-[0-9A-F]{10}$/),
  email: z.string().trim().toLowerCase().email(),
});

const NOT_FOUND = 'We could not find an order with that number and email.';

/**
 * POST /api/orders/lookup: guest order tracking for the app (the website uses a
 * server action with the same rules). Rate-limited; one answer for "wrong email"
 * and "no such order"; only the customer-safe order shape (D-003).
 */
export async function POST(
  request: Request,
): Promise<NextResponse<OrderDetail | { error: string }>> {
  const limited = await limitRequest(request.headers, 'orderLookup');
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
  try {
    const order = await lookupGuestOrder(
      serviceClient(),
      parsed.data.orderNumber,
      parsed.data.email,
    );
    return order
      ? NextResponse.json(order)
      : NextResponse.json({ error: NOT_FOUND }, { status: 404 });
  } catch (error) {
    logger.error('orders.lookup_api_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
