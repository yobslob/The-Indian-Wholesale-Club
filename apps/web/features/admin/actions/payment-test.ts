'use server';

import { requireAdminAction } from '@/features/admin/guard';
import { TEST_PAYMENT_CENTS, TEST_PAYMENT_KIND } from '@/features/checkout/test-payment';
import { errorMessage, logger } from '@/lib/logger';
import { isStripeConfigured, stripeServer } from '@/lib/stripe';

type Started = { ok: true; clientSecret: string } | { ok: false; error: string };

/** A $1 card payment against the live keys, to see that Stripe takes money (admin.md §Payment test). */
export async function startTestPaymentAction(): Promise<Started> {
  const { user } = await requireAdminAction();
  if (!isStripeConfigured())
    return { ok: false, error: 'Stripe keys are not set on this deployment.' };
  try {
    const intent = await stripeServer().paymentIntents.create({
      amount: TEST_PAYMENT_CENTS,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      description: 'IWC payment test (admin)',
      metadata: { source: 'iwc', kind: TEST_PAYMENT_KIND },
    });
    logger.info('admin.payment_test_started', { paymentIntentId: intent.id, admin: user.id });
    return intent.client_secret
      ? { ok: true, clientSecret: intent.client_secret }
      : { ok: false, error: 'Stripe gave no client secret.' };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Refunds a test payment in full. Only a payment made on the test page; Stripe keeps its fee. */
export async function refundTestPaymentAction(
  paymentIntentId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminAction();
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return { ok: false, error: 'Not a payment id.' };
  try {
    const stripe = stripeServer();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.metadata.kind !== TEST_PAYMENT_KIND)
      return { ok: false, error: 'Not a test payment.' };
    await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `refund-test-${paymentIntentId}` },
    );
    return { ok: true };
  } catch (error) {
    logger.warn('admin.payment_test_refund_failed', {
      paymentIntentId,
      error: errorMessage(error),
    });
    return { ok: false, error: errorMessage(error) };
  }
}
