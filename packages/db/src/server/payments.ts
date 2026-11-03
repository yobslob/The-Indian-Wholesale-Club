/**
 * The safety nets around a payment (service role only): the Stripe webhook's event claims (launch QA F-1) and the
 * payment sweep's queue (F-2). flows.md §3. Re-exported by './checkout'.
 */
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

// ---------------------------------------------------------------- webhook event claims (F-1)

/**
 * Claims a Stripe event for processing. True the first time, and when an earlier claim was never finished (still
 * 'processing' after 2 minutes: its function was killed); false for a duplicate or a delivery being handled now.
 */
export async function claimWebhookEvent(
  service: IwcClient,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const data = unwrap(
    await service.rpc('claim_webhook_event', { p_event_id: eventId, p_event_type: eventType }),
  );
  return z.boolean().parse(data);
}

/** The handler finished: later deliveries of the event are duplicates. */
export async function finishWebhookEvent(service: IwcClient, eventId: string) {
  unwrap(
    await service
      .from('webhook_events')
      .update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('event_id', eventId),
  );
}

/** Lets a failed handler be retried by Stripe at once (an unfinished claim is removed; a finished one stays). */
export async function releaseWebhookEvent(service: IwcClient, eventId: string) {
  unwrap(
    await service.from('webhook_events').delete().eq('event_id', eventId).eq('status', 'processing'),
  );
}

// ---------------------------------------------------------------- the payment sweep (F-2)

export const sweepRowSchema = z.object({
  payment_intent_id: z.string().min(1),
  created_at: z.string(),
});
export type SweepRow = z.infer<typeof sweepRowSchema>;

/** At most 20 should run per call (D-146): one bounded update in the database, then one Stripe call each. */
export const SWEEP_BATCH = 20;

/**
 * Takes the unreconciled checkouts due a look (10 minutes to 2 days old, not looked at in the last hour) and stamps
 * them, oldest never-looked-at first. migration 20261108090200.
 */
export async function claimPaymentSweep(service: IwcClient, limit = SWEEP_BATCH): Promise<SweepRow[]> {
  const data = unwrap(await service.rpc('claim_payment_sweep', { p_limit: limit }));
  return z.array(sweepRowSchema).parse(data ?? []);
}

/** The sweep stops looking at a checkout, and says why (payment cancelled, unknown to Stripe, not finalized). */
export async function stopSweeping(service: IwcClient, paymentIntentId: string, note: string) {
  unwrap(
    await service
      .from('pending_orders')
      .update({ sweep_note: note.slice(0, 200) })
      .eq('payment_intent_id', paymentIntentId),
  );
}
