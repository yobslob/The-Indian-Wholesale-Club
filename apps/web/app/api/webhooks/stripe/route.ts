import { NextResponse } from 'next/server';

import { claimWebhookEvent, releaseWebhookEvent } from '@repo/db/server';

import { finalizeOrder } from '@/features/checkout/finalize';
import { FASTER_KIND, finalizeFasterPayment } from '@/features/orders/faster';
import { errorMessage, logger } from '@/lib/logger';
import { isStripeConfigured, stripeServer } from '@/lib/stripe';
import { serviceClient } from '@/lib/supabase/service';

import type Stripe from 'stripe';

/**
 * Stripe webhook: creates the order if the browser never came back after
 * paying (flows.md §3, pending_orders reconciliation), and finishes a paid
 * faster-delivery offer the same way (D-064). Idempotent per event.
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
  if (!(await claimWebhookEvent(service, event.id, event.type))) {
    return NextResponse.json({ received: true, duplicate: true });
  }
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
    return NextResponse.json({ received: true });
  } catch (error) {
    // Let Stripe retry: forget the claim so the retry is processed.
    await releaseWebhookEvent(service, event.id).catch(() => undefined);
    logger.error('stripe.webhook_failed', { eventId: event.id, error: errorMessage(error) });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
