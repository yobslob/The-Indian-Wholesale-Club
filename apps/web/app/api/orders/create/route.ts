import { NextResponse } from 'next/server';

import { createPaymentIntentSchema } from '@repo/shared/schemas';

import { processOrderConfirmationEmail } from '@/lib/email/resend';
import { logger } from '@/lib/logger';
import {
  calculateCheckoutBreakdown,
  createOrderInDb,
  validatePromoCode,
  verifyVariantStock,
} from '@/lib/queries/orders';
import { getStripeServer, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parseResult = createPaymentIntentSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid checkout payload', issues: parseResult.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const {
      items,
      shippingAddress,
      shippingMethod,
      promoCode,
      paymentIntentId = null,
    } = parseResult.data;

    const isProduction = process.env.NODE_ENV === 'production';

    // 1. Check for authenticated user (if any)
    let userId: string | null = null;
    try {
      const supabaseUserClient = await createClient();
      const {
        data: { user },
      } = await supabaseUserClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    } catch {
      // Guest checkout if not authenticated
    }

    // 2. Verify stock and calculate verified totals
    const stockVerification = await verifyVariantStock(supabaseAdmin, items);
    if (!stockVerification.ok || !stockVerification.verifiedItems) {
      return NextResponse.json(
        { error: stockVerification.error || 'Inventory verification failed' },
        { status: 409 },
      );
    }

    const serverSubtotalCents = stockVerification.verifiedItems.reduce(
      (sum, { item, serverPriceCents }) => sum + serverPriceCents * item.quantity,
      0,
    );

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


    const breakdown = calculateCheckoutBreakdown(
      serverSubtotalCents,
      discountCents,
      shippingMethod,
      validatedPromo,
    );

    // 3. Payment verification (C3 / C8)
    if (!isStripeConfigured()) {
      // Orders are only ever created after Stripe verification (no fake payments, R2).
      return NextResponse.json(
        { error: 'Payments are not configured on this server' },
        { status: 503 },
      );
    }

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment has not been completed with the payment processor' },
        { status: 402 },
      );
    }

    try {
      const stripe = getStripeServer();
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!pi || (pi.status !== 'succeeded' && pi.status !== 'processing')) {
        return NextResponse.json(
          { error: `Payment not verified with processor (status: ${pi?.status || 'unknown'})` },
          { status: 402 },
        );
      }
      if (pi.amount !== breakdown.totalCents) {
        return NextResponse.json(
          { error: 'Payment amount mismatch between processor and order breakdown' },
          { status: 400 },
        );
      }
      if (pi.currency.toLowerCase() !== 'usd') {
        return NextResponse.json({ error: 'Unsupported payment currency' }, { status: 400 });
      }
      if (isProduction && pi.livemode !== true) {
        return NextResponse.json(
          { error: 'Test-mode payments are not accepted in production' },
          { status: 402 },
        );
      }
    } catch (stripeErr) {
      logger.error('orders.create.stripe_verification_failed', {
        error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
      });
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 502 },
      );
    }

    // Idempotency: a payment intent may only ever pay for one order (N13).
    // Runs for every provider so a client retry after a lost response
    // reconciles instead of double-inserting (M10).
    if (paymentIntentId) {
      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, user_id, shipping_address')
        .eq('payment_intent_id', paymentIntentId)
        .maybeSingle();
      if (existingOrder) {
        const storedAddress = existingOrder.shipping_address as { email?: string } | null;
        const storedEmail = typeof storedAddress?.email === 'string' ? storedAddress.email : null;
        const isOwner =
          (userId !== null && existingOrder.user_id === userId) ||
          (storedEmail !== null &&
            storedEmail.toLowerCase() === shippingAddress.email.toLowerCase());
        return NextResponse.json(
          {
            error: 'This payment has already been used for an order',
            // Reveal the existing order only to the same customer so their
            // retry can reconcile to the success page (M10) without leaking
            // order details to anyone replaying the intent.
            ...(isOwner
              ? { orderId: existingOrder.id, orderNumber: existingOrder.order_number }
              : {}),
          },
          { status: 409 },
        );
      }
    }

    // Prepare line items using verified server prices (H3)
    const verifiedItemsToInsert = stockVerification.verifiedItems.map(
      ({ item, serverPriceCents }) => ({
        ...item,
        priceCents: serverPriceCents,
      }),
    );

    // 4. Insert order into database (triggers handle stock deduction and order_number)
    const order = await createOrderInDb(supabaseAdmin, {
      userId,
      shippingAddress,
      breakdown,
      paymentProvider: 'stripe',
      paymentIntentId,
      items: verifiedItemsToInsert,
      status: 'confirmed',
    });

    const { data: outboxEntry, error: outboxError } = await supabaseAdmin
      .from('email_outbox')
      .insert({
        kind: 'order_confirmation',
        recipient: shippingAddress.email,
        payload: order as unknown as import('@repo/shared/types').Json,
      })
      .select('id')
      .single();
    if (outboxError || !outboxEntry) {
      logger.error('email.outbox_enqueue_failed', {
        orderNumber: order.order_number,
        error: outboxError?.message ?? 'No outbox row returned',
      });
    } else {
      void processOrderConfirmationEmail(outboxEntry.id, order, shippingAddress.email).catch((emailErr: unknown) =>
        logger.error('email.outbox_processing_failed', {
          orderNumber: order.order_number,
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        }),
      );
    }

    // N10: Mark pending order as reconciled since the browser successfully
    // created the order. The webhook will skip reconciliation for this intent.
    if (paymentIntentId) {
      await supabaseAdmin
        .from('pending_orders')
        .update({ reconciled_at: new Date().toISOString(), reconciled_by: 'browser' })
        .eq('payment_intent_id', paymentIntentId);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      totalCents: order.total_cents,
    });
  } catch (error: unknown) {
    logger.error('orders.create.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Unable to finalize your order. Please try again.' },
      { status: 500 },
    );
  }
}
