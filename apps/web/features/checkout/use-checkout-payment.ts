'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { z } from 'zod';

import { useCart } from '@/features/cart/store';

import { clearCheckout, saveCheckout } from './checkout-session';
import { postJson } from './http';
import { saveLastOrder, type SummaryLine } from './last-order';
import { confirmOrder } from './order-confirm';

import type { CheckoutQuote, CheckoutRequestBody, CheckoutStartResponse } from './types';

/** How long pricing the bag may take before the customer is told and Continue comes back (launch QA A-3). */
const START_TIMEOUT_MS = 20_000;

const startSchema: z.ZodType<CheckoutStartResponse> = z.object({
  clientSecret: z.string().min(1),
  paymentIntentId: z.string().min(1),
  quote: z.custom<CheckoutQuote>(
    (v) => typeof v === 'object' && v !== null && 'breakdown' in v && 'lines' in v,
  ),
});

const successUrl = (query: string) => `/checkout/success?${query}`;

/**
 * The payment half of /checkout: price the bag and hold one payment for the visit (A-5: the payment's secret goes
 * back with every re-price, so the server moves its amount), then finish the order once paid. Every failure comes
 * back as a message and the buttons work again (A-3); a paid customer always leaves the form for the thank-you page,
 * which keeps confirming (A-2, A-4).
 */
export function useCheckoutPayment(summarize: (quote: CheckoutQuote) => SummaryLine[]) {
  const router = useRouter();
  const clearBag = useCart((s) => s.clear);
  const secret = useRef<string | null>(null);
  const [started, setStarted] = useState<CheckoutStartResponse | null>(null);
  const [request, setRequest] = useState<CheckoutRequestBody | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The total shown is not the one the payment holds (a re-price failed): Pay waits for a successful retry. */
  const [stale, setStale] = useState(false);
  /** The order was refused after payment and the payment refunded (sold out meanwhile): the message, final. */
  const [refused, setRefused] = useState<string | null>(null);

  /**
   * Prices the bag on the server and holds the payment for that exact total. True when it worked. heldSecret: the
   * payment a refreshed tab already held (A-8).
   */
  async function post(
    body: CheckoutRequestBody,
    heldSecret: string | null = null,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    setRequest(body);
    const result = await postJson(
      '/api/checkout',
      { ...body, clientSecret: heldSecret ?? secret.current },
      startSchema,
      {
        timeoutMs: START_TIMEOUT_MS,
      },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setStale(true);
      return false;
    }
    const json = result.data;
    secret.current = json.clientSecret;
    setStarted(json);
    setStale(false);
    setRefused(null);
    saveCheckout({
      clientSecret: json.clientSecret,
      paymentIntentId: json.paymentIntentId,
      request: body,
    });
    saveLastOrder({
      paymentIntentId: json.paymentIntentId,
      orderNumber: null,
      lines: summarize(json.quote),
      quote: json.quote,
      state: body.address.state,
    });
    return true;
  }

  async function paid(paymentIntentId: string, status: string): Promise<void> {
    if (status !== 'succeeded') {
      router.push(successUrl(`payment_intent=${encodeURIComponent(paymentIntentId)}`));
      return;
    }
    clearCheckout();
    const outcome = await confirmOrder(paymentIntentId);
    if (outcome.kind === 'refused') {
      // Refunded in full; the bag stays so the customer can change it and try again.
      secret.current = null;
      setStarted(null);
      setRefused(outcome.message);
      return;
    }
    if (outcome.kind === 'confirmed') {
      if (started)
        saveLastOrder({
          paymentIntentId,
          orderNumber: outcome.orderNumber,
          lines: summarize(started.quote),
          quote: started.quote,
          state: request?.address.state ?? null,
        });
      clearBag();
      router.push(successUrl(`order=${encodeURIComponent(outcome.orderNumber)}`));
      return;
    }
    clearBag();
    // Paid, not confirmed yet (slow server, offline): the thank-you page keeps asking; the webhook also creates it.
    router.push(successUrl(`payment_intent=${encodeURIComponent(paymentIntentId)}&paid=1`));
  }

  /** Editing an earlier step: the payment form closes, the payment itself is kept for the next re-price. */
  function drop(): void {
    setStarted(null);
    setError(null);
    setStale(false);
  }

  return { started, request, busy, error, stale, refused, post, paid, drop };
}
