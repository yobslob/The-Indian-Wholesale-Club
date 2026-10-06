import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  cancelAfterDelay,
  customerCancel,
  getOrderForCustomer,
  keepAfterDelay,
  lookupGuestOrder,
} from '@repo/db/server';

import { revalidateAfterRelease } from '@/features/catalog/revalidate';
import { sendDueEmails } from '@/lib/email/send';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { stripeServer } from '@/lib/stripe';
import { serviceClient } from '@/lib/supabase/service';

const bodySchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^IWC-\d{6}-[0-9A-F]{10}$/),
  email: z.string().trim().toLowerCase().email(),
  choice: z.enum(['cancel', 'keep']),
});

const NOT_OPEN = 'This order can no longer be changed here. Reply to your order email and we will help.';

/**
 * POST /api/orders/choice: the customer's own decision on their order, website and app. The order is found by number
 * + email (the guest-lookup proof). What is allowed and the refund come from the database (D-072: cancel until the
 * order leaves India, minus the cancel fee once its pieces are being collected; D-008: after a delay, everything
 * back, or keep it with the new date). Stripe is refunded first, then the database records it and re-checks the
 * amount.
 */
export async function POST(request: Request): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const limited = await limitRequest(request.headers, 'orderLookup');
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: NOT_OPEN }, { status: 404 });
  const { orderNumber, email, choice } = parsed.data;

  try {
    const service = serviceClient();
    const [detail, order] = await Promise.all([
      lookupGuestOrder(service, orderNumber, email),
      getOrderForCustomer(service, orderNumber, email),
    ]);
    const actions = detail?.actions;
    if (!order || !actions) return NextResponse.json({ error: NOT_OPEN }, { status: 404 });

    if (choice === 'keep') {
      if (!actions.delay_open) return NextResponse.json({ error: NOT_OPEN }, { status: 409 });
      await keepAfterDelay(service, order.id);
      return NextResponse.json({ ok: true });
    }

    // A delay cancel refunds everything, so it comes first when both are open.
    const delay = actions.delay_open && actions.delay_refund_cents !== null;
    const amount = delay ? actions.delay_refund_cents : actions.can_cancel ? actions.cancel_refund_cents : null;
    if (amount === null) return NextResponse.json({ error: NOT_OPEN }, { status: 409 });
    let refundRef = 'no refund due';
    if (amount > 0) {
      if (!order.payment_intent_id) throw new Error('order has no card payment');
      const refund = await stripeServer().refunds.create(
        { payment_intent: order.payment_intent_id, amount },
        { idempotencyKey: `iwc-cancel-${order.id}` },
      );
      refundRef = refund.id;
    }
    const input = { orderId: order.id, amountCents: amount, refundRef };
    await (delay ? cancelAfterDelay(service, input) : customerCancel(service, input));
    revalidateAfterRelease(); // reserved pieces went back to stock
    await sendDueEmails(service);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('orders.choice_failed', { orderNumber, choice, error: errorMessage(error) });
    return NextResponse.json(
      { error: 'Something went wrong on our side. Please try again in a minute.' },
      { status: 500 },
    );
  }
}
