/**
 * After the sale (migration 26): customer-care cancels once an order left India (D-072) and returns (D-071). The
 * amounts come from SQL, which re-checks them when the refund is recorded. As in refunds.ts, the caller refunds
 * through Stripe FIRST, then records it here.
 */
import { unwrap, type IwcClient } from '../client';

/** After it left India: all but the shipping deduction. Null while it is still in India, or when it is done. */
export async function exportCancelCents(client: IwcClient, orderId: string): Promise<number | null> {
  return unwrap(await client.rpc('admin_cancel_after_export_cents', { p_order: orderId }));
}

export async function recordCancelAfterExport(
  client: IwcClient,
  input: { orderId: string; amountCents: number; refundRef: string },
) {
  unwrap(
    await client.rpc('admin_cancel_after_export', {
      p_order: input.orderId,
      p_amount_cents: input.amountCents,
      p_refund_ref: input.refundRef,
    }),
  );
}

export const RETURN_STATUSES = ['requested', 'received', 'refunded', 'rejected'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Returns, oldest first: the piece, its order, the reason and the refund fixed when it was asked for. */
export async function listReturns(client: IwcClient, status?: ReturnStatus) {
  let query = client
    .from('returns')
    .select(
      `id, reason, status, refund_cents, kept_pct, requested_at, decided_at, refund_ref, note,
       order:orders(id, order_number, email, payment_intent_id),
       item:order_items(product_name, variant_label, region_name)`,
    );
  if (status) query = query.eq('status', status);
  return unwrap(await query.order('requested_at').limit(200));
}

export async function getReturn(client: IwcClient, returnId: string) {
  return unwrap(
    await client
      .from('returns')
      .select('id, status, refund_cents, order:orders(id, payment_intent_id)')
      .eq('id', returnId)
      .maybeSingle(),
  );
}

/** The piece is back at the US warehouse: it becomes a US clearance draft. */
export async function markReturnReceived(client: IwcClient, returnId: string) {
  unwrap(await client.rpc('admin_return_received', { p_return: returnId }));
}

export async function recordReturnRefund(
  client: IwcClient,
  input: { returnId: string; amountCents: number; refundRef: string },
) {
  unwrap(
    await client.rpc('admin_return_refunded', {
      p_return: input.returnId,
      p_amount_cents: input.amountCents,
      p_refund_ref: input.refundRef,
    }),
  );
}

export async function rejectReturn(client: IwcClient, returnId: string, note: string) {
  unwrap(await client.rpc('admin_return_rejected', { p_return: returnId, p_note: note }));
}
