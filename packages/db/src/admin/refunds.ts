/**
 * Refunds and cancellations (D-030, D-042). The amounts are computed in SQL
 * (item_refund_cents / cancel_refund_cents, migration 4), which also re-checks
 * them when the refund is recorded. The caller refunds through Stripe FIRST,
 * then records it here, so the database never says "refunded" before the money
 * has actually gone back.
 */
import { DbError, unwrap, type IwcClient } from '../client';

export type CancelReason = 'customer_request' | 'our_fault';

function amountOrThrow(value: number | null, what: string): number {
  if (value === null)
    throw new DbError('refund_amount_unavailable', `${what}: no amount (not found or not admin)`);
  return value;
}

/** An unavailable piece: its price after discount + its share of the tax; the last piece refunds all that is left. */
export async function itemRefundCents(client: IwcClient, itemId: string): Promise<number> {
  return amountOrThrow(
    unwrap(await client.rpc('item_refund_cents', { p_item: itemId }, { get: true })),
    'item refund',
  );
}

/** Before cutoff: the customer's own cancel keeps the tax; a cancel because of us refunds everything. */
export async function cancelRefundCents(
  client: IwcClient,
  orderId: string,
  reason: CancelReason,
): Promise<number> {
  return amountOrThrow(
    unwrap(await client.rpc('cancel_refund_cents', { p_order: orderId, p_reason: reason }, { get: true })),
    'cancel refund',
  );
}

export async function recordItemRefund(
  client: IwcClient,
  itemId: string,
  amountCents: number,
  refundRef: string,
) {
  unwrap(
    await client.rpc('refund_order_item', {
      p_item: itemId,
      p_amount_cents: amountCents,
      p_refund_ref: refundRef,
    }),
  );
}

/** Releases the reserved stock, marks the items refunded and the order cancelled. */
export async function recordCancellation(
  client: IwcClient,
  input: { orderId: string; reason: CancelReason; amountCents: number; refundRef: string },
) {
  unwrap(
    await client.rpc('cancel_order', {
      p_order: input.orderId,
      p_reason: input.reason,
      p_amount_cents: input.amountCents,
      p_refund_ref: input.refundRef,
    }),
  );
}
