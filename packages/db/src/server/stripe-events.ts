/**
 * What Stripe says after a payment (service role only, launch QA F-3, migration 20261108090300): refunds made in the
 * Stripe dashboard reach the order, disputes are kept for Today's count. flows.md §3.
 */
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

import type { PostgrestError } from '@supabase/supabase-js';

/**
 * The two functions are newer than the generated types (database.types.ts is regenerated from the local database with
 * `pnpm db:types` once the migration is applied there); until then they are called by name and their answers are
 * checked with zod, which they would be anyway.
 */
interface UntypedRpc {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: PostgrestError | null }>;
}
const untyped = (service: IwcClient): UntypedRpc => service as unknown as UntypedRpc;

const refundResultSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({
    found: z.literal(true),
    order_number: z.string(),
    applied_cents: z.number().int(),
    refunded_cents: z.number().int(),
    total_cents: z.number().int(),
  }),
]);
export type StripeRefundResult = z.infer<typeof refundResultSchema>;

/**
 * The order's refunded total catches up with Stripe's `amount_refunded` (cumulative, in cents): never down, never past
 * the order's total. When it moved, the customer's refund email is queued (an 'item_refunded' order event). A refund
 * the admin made itself is already counted: applied_cents is then 0 and nothing is sent.
 */
export async function recordStripeRefund(
  service: IwcClient,
  input: { paymentIntentId: string; refundedCents: number; refundId: string | null },
): Promise<StripeRefundResult> {
  const data = unwrap(
    await untyped(service).rpc('record_stripe_refund', {
      p_payment_intent: input.paymentIntentId,
      p_refunded_cents: input.refundedCents,
      p_refund_id: input.refundId,
    }),
  );
  return refundResultSchema.parse(data);
}

const disputeResultSchema = z.object({
  is_new: z.boolean(),
  order_number: z.string().nullable(),
  closed: z.boolean(),
});
export type DisputeResult = z.infer<typeof disputeResultSchema>;

export interface DisputeInput {
  disputeId: string;
  paymentIntentId: string | null;
  chargeId: string | null;
  amountCents: number;
  currency: string;
  reason: string | null;
  status: string;
  evidenceDueAt: Date | null;
}

/** Keeps payment_disputes current; is_new is true only the first time a dispute is seen (one alert). */
export async function recordPaymentDispute(service: IwcClient, input: DisputeInput): Promise<DisputeResult> {
  const data = unwrap(
    await untyped(service).rpc('record_payment_dispute', {
      p_dispute_id: input.disputeId,
      p_payment_intent: input.paymentIntentId,
      p_charge: input.chargeId,
      p_amount_cents: input.amountCents,
      p_currency: input.currency,
      p_reason: input.reason,
      p_status: input.status,
      p_evidence_due: input.evidenceDueAt?.toISOString() ?? null,
    }),
  );
  return disputeResultSchema.parse(data);
}
