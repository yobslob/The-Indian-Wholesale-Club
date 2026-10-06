import { NextResponse } from 'next/server';

import { savePendingCheckout } from '@repo/db/server';

import { checkoutRequestSchema, priceCart } from '@/features/checkout/pricing';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { requestUser } from '@/lib/request-user';
import { isStripeConfigured, stripeServer } from '@/lib/stripe';
import { serviceClient } from '@/lib/supabase/service';

import type { PendingCheckout } from '@/features/checkout/finalize';
import type { CheckoutErrorResponse, CheckoutStartResponse } from '@/features/checkout/types';

const PROBLEM_MESSAGE = {
  unavailable: 'Some items in your bag are no longer available.',
  sold_out: 'Some items in your bag just sold out.',
  express_unavailable: 'Express shipping is not available right now.',
  closed: 'Checkout is not open right now. Please try again soon.',
} as const;

/**
 * POST /api/checkout (flows.md §3 steps 1–3): price the bag on the server,
 * create the Stripe PaymentIntent for that exact total, and store the priced
 * checkout so the order can later be created from it (never from the browser).
 * DB round trips: 1 (price) + 1 (store) = the checkout budget of 2 (PR-2).
 */
export async function POST(
  request: Request,
): Promise<NextResponse<CheckoutStartResponse | CheckoutErrorResponse>> {
  const limited = await limitRequest(request.headers, 'checkout');
  if (limited) return limited;
  if (!isStripeConfigured()) {
    logger.error('checkout.stripe_unconfigured');
    return NextResponse.json({ error: 'Payments are not available right now.' }, { status: 503 });
  }

  const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check your details and try again.' },
      { status: 400 },
    );
  }

  try {
    const service = serviceClient();
    // Website: session cookies. App: Bearer token. Only links the order to the account. Read alongside the pricing.
    const [priced, user] = await Promise.all([priceCart(service, parsed.data), requestUser(request)]);
    if (!priced.ok) {
      return NextResponse.json(
        { error: PROBLEM_MESSAGE[priced.problem.kind], problem: priced.problem },
        { status: priced.problem.kind === 'closed' ? 503 : 409 },
      );
    }
    const { quote } = priced;

    const intent = await stripeServer().paymentIntents.create({
      amount: quote.breakdown.totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: parsed.data.email,
      metadata: { source: 'iwc' },
    });

    const pending: PendingCheckout = {
      email: parsed.data.email,
      userId: user?.id ?? null,
      shippingAddress: priced.address,
      items: quote.lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
      })),
      subtotalCents: quote.breakdown.subtotalCents,
      discountCents: quote.breakdown.discountCents,
      shippingCents: quote.breakdown.shippingCents,
      taxCents: quote.breakdown.taxCents,
      totalCents: quote.breakdown.totalCents,
      promoCodeId: priced.promoCodeId,
      shippingMethod: quote.shippingMethod,
      pages: priced.pages,
    };
    try {
      await savePendingCheckout(service, intent.id, { ...pending });
    } catch (error) {
      await stripeServer()
        .paymentIntents.cancel(intent.id)
        .catch(() => undefined);
      throw error;
    }

    if (!intent.client_secret) throw new Error('PaymentIntent has no client secret');
    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      quote,
    });
  } catch (error) {
    logger.error('checkout.start_failed', { error: errorMessage(error) });
    return NextResponse.json(
      { error: 'We could not start checkout. Please try again.' },
      { status: 500 },
    );
  }
}
