import { NextResponse } from 'next/server';

import { createPaymentIntentSchema } from '@repo/shared/schemas';

import { logger } from '@/lib/logger';
import {
  calculateCheckoutBreakdown,
  validatePromoCode,
  verifyVariantStock,
} from '@/lib/queries/orders';
import { getStripeServer, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parseResult = createPaymentIntentSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { items, shippingAddress, shippingMethod, promoCode } = parseResult.data;

    // 1. Verify variant stock and retrieve server prices
    const stockVerification = await verifyVariantStock(supabaseAdmin, items);
    if (!stockVerification.ok || !stockVerification.verifiedItems) {
      return NextResponse.json(
        { error: stockVerification.error || 'Inventory verification failed' },
        { status: 409 },
      );
    }

    // 2. Calculate true subtotal using verified server prices
    const serverSubtotalCents = stockVerification.verifiedItems.reduce(
      (sum, { item, serverPriceCents }) => sum + serverPriceCents * item.quantity,
      0,
    );

    // 3. Validate promo code if provided
    let discountCents = 0;
    let validatedPromo = null;

    if (promoCode) {
      const promoResult = await validatePromoCode(supabaseAdmin, promoCode, serverSubtotalCents);
      if (!promoResult.valid || !promoResult.promo) {
        return NextResponse.json(
          { error: promoResult.message || 'Invalid or expired promo code' },
          { status: 400 },
        );
      }
      discountCents = promoResult.discountCents;
      validatedPromo = promoResult.promo;
    }



    // 4. Calculate total breakdown (subtotal, shipping tier, tax, total)
    const breakdown = calculateCheckoutBreakdown(
      serverSubtotalCents,
      discountCents,
      shippingMethod,
      validatedPromo,
    );

    // 5. Create Stripe PaymentIntent or return development simulator
    if (isStripeConfigured()) {
      try {
        const stripe = getStripeServer();
        const paymentIntent = await stripe.paymentIntents.create({
          amount: breakdown.totalCents,
          currency: 'usd',
          automatic_payment_methods: { enabled: true },
          receipt_email: shippingAddress.email,
          metadata: {
            customerEmail: shippingAddress.email,
            itemCount: items.length.toString(),
            shippingMethod,
            promoCode: promoCode || '',
          },
        });

        // N10: Store checkout payload in pending_orders for webhook reconciliation.
        // If the browser never POSTs /api/orders/create, the Stripe webhook can
        // use this data to create the order.
        const { error: pendingError } = await supabaseAdmin.from('pending_orders').upsert(
          {
            payment_intent_id: paymentIntent.id,
            checkout_payload: {
              items,
              shippingAddress,
              shippingMethod,
              promoCode: promoCode || null,
              breakdown,
            } as unknown as import('@repo/shared/types').Json,
          },
          { onConflict: 'payment_intent_id' },
        );
        if (pendingError) {
          logger.error('checkout.pending_order_persist_failed', {
            paymentIntentId: paymentIntent.id,
            error: pendingError.message,
          });
          await stripe.paymentIntents.cancel(paymentIntent.id).catch((cancelError) =>
            logger.error('checkout.pending_order_cancel_failed', {
              paymentIntentId: paymentIntent.id,
              error: cancelError instanceof Error ? cancelError.message : String(cancelError),
            }),
          );
          return NextResponse.json({ error: 'Unable to persist checkout safely' }, { status: 503 });
        }

        return NextResponse.json({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          breakdown,
          isTestMode: false,
        });
      } catch (stripeErr) {
        logger.error('checkout.createIntent.stripe_error', {
          error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
        return NextResponse.json(
          { error: 'Failed to initialize payment processor' },
          { status: 502 },
        );
      }
    }

    // Fallback: Test mode simulation when Stripe keys are not yet provided.
    // Prefixed mock_ so it can never be mistaken for a real intent (L3).
    const mockIntentId = `mock_pi_${Date.now()}`;
    return NextResponse.json({
      clientSecret: `mock_secret_${mockIntentId}`,
      paymentIntentId: mockIntentId,
      breakdown,
      isTestMode: true,
    });
  } catch (error: unknown) {
    logger.error('checkout.createIntent.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to start checkout. Please try again.' },
      { status: 500 },
    );
  }
}
