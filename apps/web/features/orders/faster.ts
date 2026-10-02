import 'server-only';

import {
  acceptFastOffer,
  findOrderIdByNumberAndEmail,
  getOfferMove,
  getOpenOffer,
} from '@repo/db/server';

import { logger } from '@/lib/logger';
import { stripeServer } from '@/lib/stripe';

import { FASTER_KIND, fasterDecision } from './faster-decision';

import type { IwcClient } from '@repo/db';

export { FASTER_KIND };

/**
 * D-064: start paying for the earlier window. The order is found by number + email (the same proof as the guest
 * lookup); the price comes from the database, never from the browser.
 */
export async function startFasterPayment(
  service: IwcClient,
  orderNumber: string,
  email: string,
): Promise<
  { ok: true; clientSecret: string; paymentIntentId: string; priceCents: number } | { ok: false }
> {
  const orderId = await findOrderIdByNumberAndEmail(service, orderNumber, email);
  const offer = orderId ? await getOpenOffer(service, orderId) : null;
  if (!offer?.offer_cents) return { ok: false };
  const intent = await stripeServer().paymentIntents.create(
    {
      amount: offer.offer_cents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      metadata: { source: 'iwc', kind: FASTER_KIND, move_id: offer.id },
    },
    // One payment per offer and price: a second tap reuses the first PaymentIntent.
    { idempotencyKey: `faster-${offer.id}-${offer.offer_cents}` },
  );
  if (!intent.client_secret) throw new Error('PaymentIntent has no client secret');
  return {
    ok: true,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    priceCents: offer.offer_cents,
  };
}

export type FasterResult =
  | { ok: true }
  | { ok: false; reason: 'payment_not_complete' | 'unknown_payment' | 'offer_closed' };

/**
 * After the payment (browser, app or webhook; whichever comes second finds it done): checks it with Stripe, then
 * moves the window. If the offer closed meanwhile (the order already shipped), the payment is refunded in full.
 */
export async function finalizeFasterPayment(
  service: IwcClient,
  paymentIntentId: string,
): Promise<FasterResult> {
  const stripe = stripeServer();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const moveId = intent.metadata.move_id;
  const move = moveId ? await getOfferMove(service, moveId) : null;
  const decision = fasterDecision(intent, move, process.env.STRIPE_SECRET_KEY ?? '');
  if (decision === 'unknown' || !move) return { ok: false, reason: 'unknown_payment' };
  if (decision === 'pending') return { ok: false, reason: 'payment_not_complete' };
  if (decision === 'done') return { ok: true };
  if (decision === 'accept') {
    const accepted = await acceptFastOffer(service, move.id, intent.id);
    if (accepted.ok) return { ok: true };
    // It lapsed between the read and the accept: refund below.
  }
  await stripe.refunds.create({ payment_intent: intent.id }, { idempotencyKey: `refund-${intent.id}` });
  logger.warn('faster.refunded', { paymentIntentId: intent.id, moveId: move.id, offerStatus: move.offer_status });
  return { ok: false, reason: 'offer_closed' };
}
