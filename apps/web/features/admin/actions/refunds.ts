'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import {
  cancelRefundCents,
  getAdminOrder,
  itemRefundCents,
  recordCancellation,
  recordItemRefund,
  type CancelReason,
} from '@repo/db/admin';

import { STORE_TAG } from '@/features/catalog/data';
import { stripeServer } from '@/lib/stripe';

import { requireAdminAction } from '../guard';

const id = z.string().uuid();

async function paymentIntentOf(orderId: string): Promise<string> {
  const { client } = await requireAdminAction();
  const order = await getAdminOrder(client, id.parse(orderId));
  if (!order?.payment_intent_id) throw new Error('This order has no card payment to refund');
  return order.payment_intent_id;
}

function done(orderId: string): void {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
}

/**
 * D-030 / D-042: a piece unavailable at pickup is our fault, so the customer gets
 * its price and its share of the tax back (the last piece refunds everything left).
 * Stripe first, then the database (which re-checks the amount).
 */
export async function refundItemAction(orderId: string, itemId: string): Promise<void> {
  const { client } = await requireAdminAction();
  const amount = await itemRefundCents(client, id.parse(itemId));
  const refund = await stripeServer().refunds.create(
    { payment_intent: await paymentIntentOf(orderId), amount },
    { idempotencyKey: `iwc-item-${itemId}` },
  );
  await recordItemRefund(client, itemId, amount, refund.id);
  done(orderId);
}

/**
 * D-042, before cutoff only: the customer's own cancel refunds everything except
 * the tax; a cancel because of us refunds everything. Reserved stock is released.
 */
export async function cancelOrderAction(orderId: string, reason: CancelReason): Promise<void> {
  const { client } = await requireAdminAction();
  const why = z.enum(['customer_request', 'our_fault']).parse(reason);
  const amount = await cancelRefundCents(client, id.parse(orderId), why);
  let refundRef = 'no refund due';
  if (amount > 0) {
    const refund = await stripeServer().refunds.create(
      { payment_intent: await paymentIntentOf(orderId), amount },
      { idempotencyKey: `iwc-cancel-${orderId}` },
    );
    refundRef = refund.id;
  }
  await recordCancellation(client, { orderId, reason: why, amountCents: amount, refundRef });
  revalidateTag(STORE_TAG); // the pieces are available again
  done(orderId);
}
