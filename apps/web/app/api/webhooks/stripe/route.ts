import { NextResponse } from 'next/server';

import { claimWebhookEvent, finishWebhookEvent, releaseWebhookEvent } from '@repo/db/server';

import { finalizeOrder } from '@/features/checkout/finalize';
import { FASTER_KIND, finalizeFasterPayment } from '@/features/orders/faster';
import { errorMessage, logger } from '@/lib/logger';
import { isStripeConfigured, stripeServer } from '@/lib/stripe';
import { busyIfDbTimeout } from '@/lib/supabase/busy';
import { serviceClient } from '@/lib/supabase/service';

import type Stripe from 'stripe';

/** Well under the 2 minutes after which a retry takes over an unfinished claim (F-1). */
export const maxDuration = 60;

/**
 * Stripe webhook: creates the order if the browser never came back after
 * paying (flows.md §3, pending_orders reconciliation), and finishes a paid
 * faster-delivery offer the same way (D-064). Idempotent per event: a claim is
 * marked done once handled; one left unfinished by a killed function is taken
 * over by Stripe's retry after 2 minutes (F-1).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !secret) {
    logger.error('stripe.webhook_unconfigured');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripeServer().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    logger.warn('stripe.signature_invalid', { error: errorMessage(error) });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'payment_intent.succeeded') return NextResponse.json({ received: true });

  const service = serviceClient();
  let claimed: boolean;
  try {
    claimed = await claimWebhookEvent(service, event.id, event.type);
  } catch (error) {
    // Nothing was claimed: any non-2xx makes Stripe deliver the event again later.
    logger.error('stripe.webhook_claim_failed', { eventId: event.id, error: errorMessage(error) });
    return busyIfDbTimeout(error) ?? NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
  if (!claimed) return NextResponse.json({ received: true, duplicate: true });

  try {
    const intent = event.data.object as Stripe.PaymentIntent;
    const result =
      intent.metadata.kind === FASTER_KIND
        ? await finalizeFasterPayment(service, intent.id)
        : await finalizeOrder(service, intent.id, 'webhook', event.id);
    if (!result.ok)
      logger.warn('stripe.webhook_not_finalized', {
        paymentIntentId: intent.id,
        reason: result.reason,
      });
    // Handled (the order exists, or why not is recorded). If this mark is lost, a retry finds the existing order.
    await finishWebhookEvent(service, event.id).catch((error: unknown) =>
      logger.warn('stripe.webhook_finish_failed', { eventId: event.id, error: errorMessage(error) }),
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    // Let Stripe retry: forget the claim so the retry is processed. If even this fails (the database is down), the
    // claim expires after 2 minutes instead.
    await releaseWebhookEvent(service, event.id).catch(() => undefined);
    logger.error('stripe.webhook_failed', { eventId: event.id, error: errorMessage(error) });
    return busyIfDbTimeout(error) ?? NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
