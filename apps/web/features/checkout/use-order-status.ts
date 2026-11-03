'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from '@/features/cart/store';

import { clearCheckout, savePaymentNotice } from './checkout-session';
import { pollOrder } from './order-confirm';
import { paymentErrorMessage } from './payment-errors';

export type OrderStatus =
  | { phase: 'confirmed'; orderNumber: string }
  | { phase: 'confirming' }
  /** No order number after about a minute: the webhook will still create it. paid: we know the payment succeeded. */
  | { phase: 'gave_up'; paid: boolean }
  /** Refunded in full (sold out while paying). */
  | { phase: 'refused'; message: string }
  /** The server does not know this payment. */
  | { phase: 'unconfirmed' }
  /** Nothing to confirm (the page was opened without a payment). */
  | { phase: 'none' };

const FAILED_DEFAULT = 'Your payment did not go through. Please try again or use another card.';

/** After a failed 3-D Secure check: Stripe's reason, in plain words, for the checkout page to show. */
async function failureMessage(clientSecret: string | null): Promise<string> {
  if (!clientSecret) return FAILED_DEFAULT;
  try {
    const { getStripe } = await import('./payment-form');
    const stripe = await getStripe();
    const result = await stripe?.retrievePaymentIntent(clientSecret);
    const error = result?.paymentIntent?.last_payment_error;
    return error ? paymentErrorMessage(error) : FAILED_DEFAULT;
  } catch {
    return FAILED_DEFAULT;
  }
}

/**
 * The thank-you page's order: given, or confirmed from the payment with back-off for about a minute (2, 4, 8, 16,
 * 30 s), since the server or the webhook may be slow (launch QA A-4). A 3-D Secure redirect that failed
 * (`redirect_status=failed`) goes back to /checkout with Stripe's reason, the bag kept.
 */
export function useOrderStatus(
  orderNumber: string | null,
  paymentIntentId: string | null,
): OrderStatus {
  const router = useRouter();
  const clear = useCart((s) => s.clear);
  const [status, setStatus] = useState<OrderStatus>(
    orderNumber
      ? { phase: 'confirmed', orderNumber }
      : paymentIntentId
        ? { phase: 'confirming' }
        : { phase: 'none' },
  );

  useEffect(() => {
    if (orderNumber || !paymentIntentId) return;
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect_status');
    const knownPaid = params.get('paid') === '1' || redirect === 'succeeded';
    const controller = new AbortController();

    if (redirect === 'failed') {
      void failureMessage(params.get('payment_intent_client_secret')).then((message) => {
        if (controller.signal.aborted) return;
        savePaymentNotice(message);
        router.replace('/checkout');
      });
      return () => controller.abort();
    }

    void pollOrder(paymentIntentId, { signal: controller.signal }).then((outcome) => {
      if (!outcome) return;
      if (outcome.kind === 'confirmed') {
        clear();
        clearCheckout();
        setStatus({ phase: 'confirmed', orderNumber: outcome.orderNumber });
      } else if (outcome.kind === 'refused') {
        clearCheckout();
        setStatus({ phase: 'refused', message: outcome.message });
      } else if (outcome.kind === 'unconfirmed') {
        setStatus({ phase: 'unconfirmed' });
      } else {
        // Paid for sure: the bag must not invite a second purchase while the order is created.
        if (knownPaid) {
          clear();
          clearCheckout();
        }
        setStatus({ phase: 'gave_up', paid: knownPaid });
      }
    });
    return () => controller.abort();
  }, [orderNumber, paymentIntentId, clear, router]);

  return status;
}
