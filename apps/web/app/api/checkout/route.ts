import { NextResponse } from 'next/server';
import { z } from 'zod';

import { formatUsd } from '@repo/shared/domain';

import { checkoutIdempotencyKey } from '@/features/checkout/intent-key';
import { startPayment } from '@/features/checkout/payment-intent';
import { checkoutRequestSchema, priceCart } from '@/features/checkout/pricing';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { requestUser } from '@/lib/request-user';
import { isStripeConfigured, stripeServer } from '@/lib/stripe';
import { serviceClient } from '@/lib/supabase/service';

import type { PendingCheckout } from '@/features/checkout/finalize';
import type {
  CheckoutErrorResponse,
  CheckoutProblem,
  CheckoutStartResponse,
} from '@/features/checkout/types';

const PROBLEM_MESSAGE = {
  // The website lists each line with Remove or Keep n; the old app shows only this sentence.
  stock: 'Some items in your bag just sold out or have fewer left. Please change your bag to go on.',
  closed: 'Checkout is not open right now. Please try again soon.',
} as const;

/** The website sends the payment it already holds this visit, so a re-price keeps it (launch QA A-5). */
const reuseSchema = z.object({ clientSecret: z.string().max(200).nullish() });

function problemMessage(problem: CheckoutProblem): string {
  if (problem.kind === 'below_minimum')
    return `Orders start at ${formatUsd(problem.minOrderCents)}, with free shipping. Add ${formatUsd(problem.minOrderCents - problem.subtotalCents)} more to check out.`;
  return PROBLEM_MESSAGE[problem.kind];
}

/**
 * POST /api/checkout (flows.md §3 steps 1–3): price the bag on the server,
 * create the Stripe PaymentIntent for that exact total, and store the priced
 * checkout so the order can later be created from it (never from the browser).
 * A re-price in the same visit moves the amount of the payment the browser holds (`clientSecret`) instead of
 * creating another (payment-intent.ts). DB round trips: 1 (price) + 1 (store) = the checkout budget of 2 (PR-2).
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

  const raw: unknown = await request.json().catch(() => null);
  const parsed = checkoutRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please check your details and try again.' },
      { status: 400 },
    );
  }
  const reuse = reuseSchema.safeParse(raw);

  try {
    const service = serviceClient();
    // Website: session cookies. App: Bearer token. Links the order to the account, and the account's coins and standing
    // price it (D-191), so it is read first.
    const user = await requestUser(request);
    const priced = await priceCart(service, parsed.data, user?.id ?? null);
    if (!priced.ok) {
      return NextResponse.json(
        { error: problemMessage(priced.problem), problem: priced.problem },
        { status: priced.problem.kind === 'closed' ? 503 : 409 },
      );
    }
    const { quote } = priced;

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
      // D-119, D-191: the order's discount is the coupon, the bulk saving and the coins; their parts are kept beside it.
      discountCents: quote.breakdown.discountCents + quote.breakdown.bulkSavingCents + quote.breakdown.coinsUsed,
      bulkSavingCents: quote.breakdown.bulkSavingCents,
      coinsUsed: quote.breakdown.coinsUsed,
      // D-111: the retailer charges travel inside the order's shipping; their part is kept beside it. So does
      // Heavy-item shipping (founder 2026-10-24).
      shippingCents:
        quote.breakdown.shippingCents + quote.breakdown.retailerCents + quote.breakdown.heavyCents,
      retailerChargeCents: quote.breakdown.retailerCents,
      heavyShippingCents: quote.breakdown.heavyCents,
      taxCents: quote.breakdown.taxCents,
      totalCents: quote.breakdown.totalCents,
      promoCodeId: priced.promoCodeId,
      shippingMethod: quote.shippingMethod,
      pages: priced.pages,
    };

    const intent = await startPayment(stripeServer(), service, {
      pending,
      reuseSecret: reuse.success ? (reuse.data.clientSecret ?? null) : null,
      idempotencyKey: checkoutIdempotencyKey(
        {
          email: pending.email,
          userId: pending.userId,
          totalCents: pending.totalCents,
          shippingMethod: pending.shippingMethod,
          promoCode: quote.promoCode,
          address: priced.address,
          lines: pending.items,
        },
        new Date(),
      ),
    });

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
