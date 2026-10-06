import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrderForCustomer, requestReturn } from '@repo/db/server';

import { sendDueEmails } from '@/lib/email/send';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

const bodySchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^IWC-\d{6}-[0-9A-F]{10}$/),
  email: z.string().trim().toLowerCase().email(),
  itemId: z.string().uuid(),
  reason: z.enum(['damaged', 'wrong', 'changed_mind']),
});

const NOT_OPEN = 'This piece can no longer be returned here. Reply to your order email and we will help.';

/**
 * POST /api/orders/return: the customer asks to return a delivered piece (D-071), website and app. The order is
 * found by number + email (the guest-lookup proof). The database decides whether it can be returned and fixes the
 * refund; nothing is refunded yet: the money goes back once the piece is received.
 */
export async function POST(request: Request): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const limited = await limitRequest(request.headers, 'orderLookup');
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: NOT_OPEN }, { status: 404 });
  const { orderNumber, email, itemId, reason } = parsed.data;

  try {
    const service = serviceClient();
    const order = await getOrderForCustomer(service, orderNumber, email);
    if (!order) return NextResponse.json({ error: NOT_OPEN }, { status: 404 });
    const result = await requestReturn(service, { orderId: order.id, itemId, reason });
    if (!result.ok) return NextResponse.json({ error: NOT_OPEN }, { status: 409 });
    await sendDueEmails(service);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('orders.return_failed', { orderNumber, reason, error: errorMessage(error) });
    return NextResponse.json(
      { error: 'Something went wrong on our side. Please try again in a minute.' },
      { status: 500 },
    );
  }
}
