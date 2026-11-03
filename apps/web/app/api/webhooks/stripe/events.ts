import { alertDollars } from '@/lib/alert';

import type { DisputeInput, DisputeResult, StripeRefundResult } from '@repo/db/server';
import type Stripe from 'stripe';

/**
 * The Stripe events after a payment (launch QA F-3, flows.md §3), besides payment_intent.succeeded which creates the
 * order. Same claim-once handling in the route; this module decides what each event does, with its side effects passed
 * in, so the unit tests check it without Stripe or a database (tests/stripe-events.test.ts).
 */
export const EXTRA_EVENTS = [
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
  'payment_intent.payment_failed',
] as const;
export type ExtraEventType = (typeof EXTRA_EVENTS)[number];

export function isExtraEvent(type: string): type is ExtraEventType {
  return (EXTRA_EVENTS as readonly string[]).includes(type);
}

export interface StripeEventDeps {
  recordRefund(input: { paymentIntentId: string; refundedCents: number; refundId: string | null }): Promise<StripeRefundResult>;
  recordDispute(input: DisputeInput): Promise<DisputeResult>;
  /** The payment sweep asks Stripe again later rather than now (absent: nothing to defer). */
  deferSweep?(paymentIntentId: string): Promise<void>;
  /** lib/alert.ts sendAlert: never throws. */
  alert(title: string, fields: Record<string, unknown>): Promise<boolean>;
  warn(event: string, context: Record<string, unknown>): void;
  sleep(ms: number): Promise<void>;
  now(): number;
}

export type ExtraEventOutcome =
  | 'refund_recorded'
  | 'refund_already_counted'
  | 'refund_without_order'
  | 'dispute_recorded'
  | 'dispute_closed'
  | 'payment_failed'
  | 'ignored';

/**
 * A refund the admin makes is sent to Stripe first and written to the order a moment later (admin refund flows). The
 * event can arrive in between, so a fresh one waits until it is this old: the admin's own record is then in place and
 * the event finds the refund already counted (no double count, no second email). Well inside the route's 60 s.
 */
export const REFUND_SETTLE_MS = 30_000;

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === 'string' ? value : (value?.id ?? null);

async function onRefund(event: Stripe.Event, charge: Stripe.Charge, deps: StripeEventDeps): Promise<ExtraEventOutcome> {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId) return 'ignored';
  const age = deps.now() - event.created * 1000;
  if (age < REFUND_SETTLE_MS) await deps.sleep(REFUND_SETTLE_MS - Math.max(age, 0));

  const result = await deps.recordRefund({
    paymentIntentId,
    refundedCents: charge.amount_refunded,
    refundId: charge.refunds?.data[0]?.id ?? null,
  });
  if (!result.found) {
    // Refused at checkout and refunded then (failed_reconciliations has it), or not one of ours.
    deps.warn('stripe.refund_without_order', { paymentIntentId });
    return 'refund_without_order';
  }
  if (result.applied_cents === 0) return 'refund_already_counted';
  const full = result.refunded_cents >= result.total_cents;
  deps.warn('stripe.refund_recorded', { orderNumber: result.order_number, appliedCents: result.applied_cents, full });
  await deps.alert(`Refunded in Stripe: order ${result.order_number}`, {
    refunded: alertDollars(result.applied_cents),
    refundedInAll: `${alertDollars(result.refunded_cents)} of ${alertDollars(result.total_cents)}`,
    next: full
      ? 'The customer was emailed. If nothing should ship, cancel the order in the admin.'
      : 'The customer was emailed. Mark the refunded pieces in the admin if they should not ship.',
  });
  return 'refund_recorded';
}

async function onDispute(dispute: Stripe.Dispute, closed: boolean, deps: StripeEventDeps): Promise<ExtraEventOutcome> {
  const dueBy = dispute.evidence_details?.due_by ?? null;
  const result = await deps.recordDispute({
    disputeId: dispute.id,
    paymentIntentId: idOf(dispute.payment_intent),
    chargeId: idOf(dispute.charge),
    amountCents: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason ?? null,
    status: dispute.status,
    evidenceDueAt: dueBy ? new Date(dueBy * 1000) : null,
  });
  const order = result.order_number ? `order ${result.order_number}` : 'a payment without an order';
  if (closed) {
    deps.warn('stripe.dispute_closed', { disputeId: dispute.id, status: dispute.status, orderNumber: result.order_number });
    await deps.alert(`Dispute ${dispute.status.replace(/_/g, ' ')}: ${order}`, {
      amount: alertDollars(dispute.amount),
      disputeId: dispute.id,
    });
    return 'dispute_closed';
  }
  deps.warn('stripe.dispute_created', { disputeId: dispute.id, reason: dispute.reason, orderNumber: result.order_number });
  // Immediately, every time it is new: a dispute left unanswered past its due date is lost.
  if (result.is_new) {
    await deps.alert(`Dispute opened on ${order}`, {
      amount: alertDollars(dispute.amount),
      reason: dispute.reason,
      respondBy: dueBy ? new Date(dueBy * 1000).toISOString().slice(0, 10) : 'see Stripe',
      disputeId: dispute.id,
      next: 'Stripe → Disputes: answer with the order, tracking and delivery proof.',
    });
  }
  return 'dispute_recorded';
}

async function onPaymentFailed(intent: Stripe.PaymentIntent, deps: StripeEventDeps): Promise<ExtraEventOutcome> {
  const error = intent.last_payment_error;
  // The customer may try another card on the same payment, so the checkout stays open; only codes are logged.
  deps.warn('stripe.payment_failed', {
    paymentIntentId: intent.id,
    code: error?.code ?? null,
    declineCode: error?.decline_code ?? null,
  });
  await deps.deferSweep?.(intent.id);
  return 'payment_failed';
}

/** Handles one of EXTRA_EVENTS. Throws when recording failed (the route releases the claim so Stripe retries). */
export async function handleExtraEvent(event: Stripe.Event, deps: StripeEventDeps): Promise<ExtraEventOutcome> {
  switch (event.type) {
    case 'charge.refunded':
      return onRefund(event, event.data.object, deps);
    case 'charge.dispute.created':
      return onDispute(event.data.object, false, deps);
    case 'charge.dispute.closed':
      return onDispute(event.data.object, true, deps);
    case 'payment_intent.payment_failed':
      return onPaymentFailed(event.data.object, deps);
    default:
      return 'ignored';
  }
}
