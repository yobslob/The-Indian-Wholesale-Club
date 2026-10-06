'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  exportCancelCents,
  getAdminOrder,
  getReturn,
  markReturnReceived,
  recordCancelAfterExport,
  recordReturnRefund,
  rejectReturn,
} from '@repo/db/admin';

import { stripeServer } from '@/lib/stripe';

import { sendEmailsSoon } from '../emails-soon';
import { requireAdminAction } from '../guard';

const id = z.string().uuid();

/**
 * D-072: customer care cancels an order that already left India: everything back except the shipping deduction, and
 * its pieces become US clearance drafts. Stripe first, then the database (which re-checks the amount).
 */
export async function cancelAfterExportAction(orderId: string): Promise<void> {
  const { client } = await requireAdminAction();
  const order = await getAdminOrder(client, id.parse(orderId));
  const amount = await exportCancelCents(client, orderId);
  if (!order || amount === null) throw new Error('This order cannot be cancelled this way now');
  let refundRef = 'no refund due';
  if (amount > 0) {
    if (!order.payment_intent_id) throw new Error('This order has no card payment to refund');
    const refund = await stripeServer().refunds.create(
      { payment_intent: order.payment_intent_id, amount },
      { idempotencyKey: `iwc-export-cancel-${orderId}` },
    );
    refundRef = refund.id;
  }
  await recordCancelAfterExport(client, { orderId, amountCents: amount, refundRef });
  sendEmailsSoon();
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  revalidatePath('/admin/catalog');
}

function returnsChanged(): void {
  sendEmailsSoon();
  revalidatePath('/admin/returns');
  revalidatePath('/admin/catalog');
}

/** D-071: the piece is back at the US warehouse; it becomes a US clearance draft. */
export async function returnReceivedAction(returnId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await markReturnReceived(client, id.parse(returnId));
  returnsChanged();
}

/** D-071: refund the amount fixed when the return was asked for. Stripe first, then the database. */
export async function returnRefundAction(returnId: string): Promise<void> {
  const { client } = await requireAdminAction();
  const ret = await getReturn(client, id.parse(returnId));
  if (!ret || ret.status !== 'received') throw new Error('Mark the piece received first');
  let refundRef = 'no refund due';
  if (ret.refund_cents > 0) {
    if (!ret.order?.payment_intent_id) throw new Error('This order has no card payment to refund');
    const refund = await stripeServer().refunds.create(
      { payment_intent: ret.order.payment_intent_id, amount: ret.refund_cents },
      { idempotencyKey: `iwc-return-${returnId}` },
    );
    refundRef = refund.id;
  }
  await recordReturnRefund(client, { returnId, amountCents: ret.refund_cents, refundRef });
  returnsChanged();
}

const noteSchema = z.string().trim().min(1).max(500);

/** D-071: not accepted (worn, altered, not checked out against the handover photos). The note stays internal. */
export async function returnRejectAction(returnId: string, formData: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  await rejectReturn(client, id.parse(returnId), noteSchema.parse(formData.get('note')));
  returnsChanged();
}
