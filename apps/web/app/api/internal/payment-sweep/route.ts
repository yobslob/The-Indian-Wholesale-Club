import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  claimPaymentSweep,
  markPendingReconciled,
  recordFailedReconciliation,
  stopSweeping,
  type SweepRow,
} from '@repo/db/server';

import { finalizeOrder } from '@/features/checkout/finalize';
import { errorMessage, logger } from '@/lib/logger';
import { isStripeConfigured, stripeServer } from '@/lib/stripe';
import { busyIfDbTimeout } from '@/lib/supabase/busy';
import { serviceClient } from '@/lib/supabase/service';

import {
  inGroups,
  isUnknownToStripe,
  refundedCents,
  stepAfterFinalize,
  stepForPayment,
  type SweepStep,
} from './decide';

import type { IwcClient } from '@repo/db';

export const maxDuration = 60;

type Outcome = 'finalized' | 'waiting' | 'stopped' | 'failed';

/** Compared in constant time (as hashes, so the lengths match), as the email outbox job does. */
function sameSecret(given: string, expected: string): boolean {
  const hash = (v: string): Buffer => createHash('sha256').update(v).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

/** One checkout: ask Stripe, and create the order when it was paid. Never throws (a failure is logged and counted). */
async function sweepOne(service: IwcClient, row: SweepRow): Promise<Outcome> {
  const paymentIntentId = row.payment_intent_id;
  let step: SweepStep;
  try {
    const intent = await stripeServer().paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });
    step = stepForPayment(intent.status, refundedCents(intent.latest_charge));
  } catch (error) {
    if (isUnknownToStripe(error)) {
      await stopSweeping(service, paymentIntentId, 'unknown to Stripe');
      return 'stopped';
    }
    logger.warn('payment_sweep.stripe_failed', { paymentIntentId, error: errorMessage(error) });
    return 'failed'; // asked again in an hour
  }
  if (step.kind === 'wait') return 'waiting';
  if (step.kind === 'stop') {
    await stopSweeping(service, paymentIntentId, step.note);
    if (step.note === 'refunded in Stripe') logger.warn('payment_sweep.refunded_without_order', { paymentIntentId });
    return 'stopped';
  }

  // Paid, and neither the customer's device nor the webhook created the order (or marked it reconciled).
  try {
    const after = stepAfterFinalize(await finalizeOrder(service, paymentIntentId, 'sweep', null));
    if (after.kind === 'wait') return 'waiting';
    if (after.kind === 'stop') {
      await stopSweeping(service, paymentIntentId, after.note);
      logger.error('payment_sweep.not_finalized', { paymentIntentId, note: after.note });
      return 'stopped';
    }
    // finalize marks a new order reconciled itself; this covers an order made by a run killed before that mark.
    await markPendingReconciled(service, paymentIntentId, 'sweep');
    logger.warn('payment_sweep.finalized', { paymentIntentId, orderNumber: after.orderNumber });
    return 'finalized';
  } catch (error) {
    logger.error('payment_sweep.finalize_failed', { paymentIntentId, error: errorMessage(error) });
    await recordFailedReconciliation(service, {
      paymentIntentId,
      stripeEventId: null,
      amountCents: null,
      email: null,
      reason: `Payment sweep: paid, but the order could not be created (${errorMessage(error).slice(0, 200)})`,
      metadata: { source: 'sweep' },
    }).catch(() => undefined);
    return 'failed'; // asked again in an hour
  }
}

/**
 * POST /api/internal/payment-sweep (launch QA F-2, flows.md §3): the safety net for a paid customer without an order.
 * Called every 10 minutes by the database's timer, only when a checkout is due (migration 20261108090200), with
 * `Authorization: Bearer $EMAIL_OUTBOX_CRON_SECRET` (the same secret as the email timer, ops.md). Takes at most 20
 * checkouts, asks Stripe about each and creates the order for each one that was paid.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.EMAIL_OUTBOX_CRON_SECRET;
  if (!secret || !sameSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!isStripeConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const service = serviceClient();
  let rows: SweepRow[];
  try {
    rows = await claimPaymentSweep(service);
  } catch (error) {
    logger.error('payment_sweep.claim_failed', { error: errorMessage(error) });
    return busyIfDbTimeout(error) ?? NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }

  const outcomes = await inGroups(rows, 5, (row) =>
    sweepOne(service, row).catch((error: unknown): Outcome => {
      logger.error('payment_sweep.failed', { paymentIntentId: row.payment_intent_id, error: errorMessage(error) });
      return 'failed';
    }),
  );
  const results = { checked: rows.length, finalized: 0, waiting: 0, stopped: 0, failed: 0 };
  for (const outcome of outcomes) results[outcome] += 1;
  return NextResponse.json(results);
}
