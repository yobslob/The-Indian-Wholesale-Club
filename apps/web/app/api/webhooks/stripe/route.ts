import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getStripeServer, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

import type { Database } from '@repo/shared/types';
import type Stripe from 'stripe';


export async function POST(req: Request): Promise<NextResponse> {
  if (!isStripeConfigured()) {
    logger.warn('stripe.webhook_unconfigured');
    return NextResponse.json(
      { error: 'Stripe is unconfigured in this environment' },
      { status: 503 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('stripe.webhook_secret_missing');
    return NextResponse.json({ error: 'Webhook secret not set' }, { status: 500 });
  }

  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    const stripe = getStripeServer();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown webhook verification error';
    logger.error('stripe.signature_invalid', { message });
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Idempotency (C8): skip events we already processed successfully.
      const { data: seenEvent, error: seenError } = await supabaseAdmin
        .from('webhook_events')
        .select('id')
        .eq('event_id', event.id)
        .maybeSingle();

      if (seenError) {
        logger.error('stripe.idempotency_lookup_failed', { message: seenError.message });
        return NextResponse.json({ error: 'Idempotency lookup failed' }, { status: 500 });
      }
      if (seenEvent) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      // 1. Fetch matching order by payment_intent_id
      const { data: order, error: findError } = await supabaseAdmin
        .from('orders')
        .select('id, status, total_cents, currency')
        .eq('payment_intent_id', paymentIntent.id)
        .maybeSingle();

      if (findError) {
        logger.error('stripe.order_lookup_failed', { message: findError.message, paymentIntentId: paymentIntent.id });
        return NextResponse.json({ error: 'Database lookup failed' }, { status: 500 });
      }

      if (!order) {
        // N10: Order not yet created by the browser. Attempt reconciliation
        // using the checkout payload stored in pending_orders at intent creation.
        const { data: pending } = await supabaseAdmin
          .from('pending_orders')
          .select('checkout_payload')
          .eq('payment_intent_id', paymentIntent.id)
          .maybeSingle();

        if (!pending?.checkout_payload) {
          // No pending data — record failed reconciliation, return 500 for Stripe retry
          logger.error('stripe.reconciliation_failed_no_pending', {
            paymentIntentId: paymentIntent.id,
          });
          await supabaseAdmin.from('failed_reconciliations').insert({
            payment_intent_id: paymentIntent.id,
            stripe_event_id: event.id,
            amount_cents: paymentIntent.amount,
            currency: paymentIntent.currency,
            customer_email: paymentIntent.receipt_email ?? paymentIntent.metadata?.customerEmail ?? null,
            error_reason: 'No pending_orders entry found for this PaymentIntent',
            metadata: (paymentIntent.metadata as unknown as import('@repo/shared/types').Json) ?? {},
          });
          return NextResponse.json(
            { error: 'Order data not available for reconciliation' },
            { status: 500 },
          );
        }

        // Create the order from the pending checkout payload
        const payload = pending.checkout_payload as {
          items: Array<{
            variantId: string; productId: string; productName: string;
            productSlug: string; priceCents: number; quantity: number;
            size?: string | null; colorName?: string | null;
          }>;
          shippingAddress: Record<string, unknown>;
          breakdown: {
            subtotalCents: number; discountCents: number;
            shippingCents: number; taxCents: number; totalCents: number;
          };
        };

        try {
          const bd = payload.breakdown;
          if (bd.totalCents !== paymentIntent.amount ||
              paymentIntent.currency.toLowerCase() !== 'usd' ||
              !Array.isArray(payload.items) || payload.items.length === 0) {
            throw new Error('Pending checkout payload does not match the PaymentIntent');
          }
          const { data: reconOrder, error: insertErr } = await supabaseAdmin
            .from('orders')
            .insert({
              user_id: null,
              status: 'confirmed',
              subtotal_cents: bd.subtotalCents,
              discount_cents: bd.discountCents,
              shipping_cents: bd.shippingCents,
              tax_cents: bd.taxCents,
              total_cents: bd.totalCents,
              currency: 'USD',
              payment_provider: 'stripe',
              payment_intent_id: paymentIntent.id,
              payment_status: 'paid',
              shipping_address: payload.shippingAddress as unknown as import('@repo/shared/types').Json,
              carrier: null, // set by an admin when the order ships
            })
            .select('id, order_number, status, total_cents, currency')
            .single();

          if (insertErr || !reconOrder) {
            logger.error('stripe.reconciliation_insert_failed', {
              paymentIntentId: paymentIntent.id, error: insertErr?.message,
            });
            return NextResponse.json({ error: 'Reconciliation insert failed' }, { status: 500 });
          }

          // Insert line items; remove the shell if this part fails so retries can reconcile.
          const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
            payload.items.map((item) => ({
              order_id: reconOrder.id,
              variant_id: item.variantId,
              product_name: item.productName,
              variant_label: [item.colorName, item.size].filter(Boolean).join(' / ') || null,
              quantity: item.quantity,
              unit_price_cents: item.priceCents,
              total_price_cents: item.priceCents * item.quantity,
            })),
          );
          if (itemsError) {
            await supabaseAdmin.from('orders').delete().eq('id', reconOrder.id);
            throw new Error(`Reconciliation line item insert failed: ${itemsError.message}`);
          }

          // Mark pending as reconciled by webhook
          await supabaseAdmin
            .from('pending_orders')
            .update({ reconciled_at: new Date().toISOString(), reconciled_by: 'webhook' })
            .eq('payment_intent_id', paymentIntent.id);

          logger.info('stripe.order_reconciled_by_webhook', {
            paymentIntentId: paymentIntent.id,
            orderId: reconOrder.id,
            orderNumber: reconOrder.order_number,
          });

          // Record for idempotency
          await supabaseAdmin.from('webhook_events').insert({
            event_id: event.id, event_type: event.type,
          });

          return NextResponse.json({ received: true, reconciled: true, orderNumber: reconOrder.order_number });
        } catch (reconErr) {
          logger.error('stripe.reconciliation_exception', {
            paymentIntentId: paymentIntent.id,
            error: reconErr instanceof Error ? reconErr.message : String(reconErr),
          });
          return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
        }
      }

      // Amount and currency check - fail closed (C8)
      if (order.total_cents !== paymentIntent.amount) {
        logger.error('stripe.amount_mismatch', {
          orderId: order.id,
          dbTotal: order.total_cents,
          stripeAmount: paymentIntent.amount,
        });
        return NextResponse.json(
          { error: 'Payment amount does not match order total' },
          { status: 400 },
        );
      }
      if (paymentIntent.currency.toLowerCase() !== (order.currency || 'usd').toLowerCase()) {
        logger.error('stripe.currency_mismatch', {
          orderId: order.id,
          dbCurrency: order.currency,
          stripeCurrency: paymentIntent.currency,
        });
        return NextResponse.json({ error: 'Payment currency mismatch' }, { status: 400 });
      }

      // Only transition to 'confirmed' if currently 'pending' (avoid regressing shipped/delivered orders)
      const updatePayload: Database['public']['Tables']['orders']['Update'] = {
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
      };

      if (order.status === 'pending') {
        updatePayload.status = 'confirmed';
      }

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);

      if (updateError) {
        logger.error('stripe.order_update_failed', {
          orderId: order.id,
          message: updateError.message,
        });
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
      }

      // Record successful processing for idempotency (C8)
      const { error: recordError } = await supabaseAdmin.from('webhook_events').insert({
        event_id: event.id,
        event_type: event.type,
      });
      if (recordError && recordError.code !== '23505') {
        logger.error('stripe.event_record_failed', {
          eventId: event.id,
          message: recordError.message,
        });
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const { error: failError } = await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('payment_intent_id', paymentIntent.id);

      if (failError) {
        logger.error('stripe.payment_failed_update_error', {
          paymentIntentId: paymentIntent.id,
          message: failError.message,
        });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
