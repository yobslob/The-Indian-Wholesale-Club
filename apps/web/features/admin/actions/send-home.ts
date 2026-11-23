'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getHomeGiftForRefund, markHomeGiftSent, recordHomeGiftFailed } from '@repo/db/admin';

import { stripeServer } from '@/lib/stripe';

import { sendEmailsSoon } from '../emails-soon';
import { requireAdminAction } from '../guard';

const id = z.string().uuid();

function done(orderId?: string): void {
  sendEmailsSoon();
  revalidatePath('/admin/send-home');
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

export type GiftActionState = { error: string | null; ok?: boolean };

/** D-205: paid from the desk's UPI app; the reference (UTR) is checked and recorded by the database. */
export async function markGiftSentAction(_prev: GiftActionState, form: FormData): Promise<GiftActionState> {
  const { client } = await requireAdminAction();
  const giftId = id.safeParse(form.get('giftId'));
  const utr = String(form.get('utr') ?? '').replace(/\s+/g, '');
  if (!giftId.success) return { error: 'Which gift?' };
  if (!/^[A-Za-z0-9]{6,35}$/.test(utr))
    return { error: 'Type the UPI reference (UTR) from your UPI app: 6 to 35 letters or digits.' };
  try {
    await markHomeGiftSent(client, giftId.data, utr);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('gift_on_hold')) return { error: 'This gift is on hold: it cannot go yet.' };
    if (message.includes('gift_not_open')) return { error: 'This gift is no longer open (sent, refunded or cancelled).' };
    return { error: 'Could not save. Try again.' };
  }
  done();
  return { error: null, ok: true };
}

/**
 * D-205, Couldn't send (a wrong UPI, a closed account): the gift alone back to the card, Stripe first, then the database
 * (D-042), with Stripe's own refunded total so the refund webhook never counts it twice. The goods are untouched.
 */
export async function giftFailedAction(giftId: string, reason: string): Promise<void> {
  const { client } = await requireAdminAction();
  const gift = await getHomeGiftForRefund(client, id.parse(giftId));
  const paymentIntent = gift?.orders?.payment_intent_id;
  if (!gift || !paymentIntent) throw new Error('This gift has no card payment to refund');
  if (!['on_hold', 'to_send', 'failed'].includes(gift.status)) throw new Error('This gift is no longer open');
  const stripe = stripeServer();
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntent, amount: gift.usd_cents },
    { idempotencyKey: `iwc-gift-${gift.id}` },
  );
  const intent = await stripe.paymentIntents.retrieve(paymentIntent, { expand: ['latest_charge'] }).catch(() => null);
  const charge = intent?.latest_charge;
  const refundedTotal = charge && typeof charge === 'object' ? charge.amount_refunded : null;
  await recordHomeGiftFailed(client, {
    giftId: gift.id,
    reason: reason.slice(0, 200),
    refundId: refund.id,
    refundedTotalCents: refundedTotal,
  });
  done(gift.order_id);
}
