'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { z } from 'zod';

import { forgetOffers, setOffers } from '@/features/cart/offers';
import { useCart } from '@/features/cart/store';

import { clearCheckout, saveCheckout } from './checkout-session';
import { postJson } from './http';
import { saveLastOrder, type SummaryLine } from './last-order';
import { confirmOrder } from './order-confirm';

import type { CheckoutQuote, CheckoutRequestBody, CheckoutStartResponse, StockProblemLine } from './types';
import type { CheckoutOffers } from '@repo/shared/domain';

/** How long pricing the bag may take before the customer is told and Continue comes back (launch QA A-3). */
const START_TIMEOUT_MS = 20_000;

const startSchema: z.ZodType<CheckoutStartResponse> = z.object({
  clientSecret: z.string().min(1),
  paymentIntentId: z.string().min(1),
  quote: z.custom<CheckoutQuote>(
    (v) => typeof v === 'object' && v !== null && 'breakdown' in v && 'lines' in v,
  ),
});

const stockLinesSchema = z.array(
  z.object({
    variantId: z.string(),
    productName: z.string().nullable(),
    variantLabel: z.string().nullable(),
    imagePath: z.string().nullable(),
    quantity: z.number().int(),
    available: z.number().int(),
  }),
);
const stockProblemSchema = z.object({ kind: z.literal('stock'), lines: stockLinesSchema });

const successUrl = (query: string) => `/checkout/success?${query}`;

/**
 * The payment half of /checkout: price the bag and hold one payment for the visit (A-5: the payment's secret goes
 * back with every re-price, so the server moves its amount), then finish the order once paid. Every failure comes
 * back as a message and the buttons work again (A-3); a paid customer always leaves the form for the thank-you page,
 * which keeps confirming (A-2, A-4). §10 Y-3: a line sold out or short comes back as `stock`: the payment form closes and
 * stays closed until each line is removed or lowered; the payment itself is kept for the next re-price.
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
  /** The bag's lines that cannot go ahead as they are (Y-3): payment stays locked while there is one. */
  const [stock, setStock] = useState<StockProblemLine[]>([]);

  /**
   * Prices the bag on the server and holds the payment for that exact total. heldSecret: the payment a refreshed tab
   * already held (A-8). 'stock': the answer listed lines to fix (`stock`), no payment moved.
   */
  async function post(
    body: CheckoutRequestBody,
    heldSecret: string | null = null,
  ): Promise<'ok' | 'stock' | 'failed'> {
    if (busy) return 'failed';
    setBusy(true);
    setError(null);
    setRequest(body);
    // kept even if this answer lists stock problems: the re-price after the fix moves the same payment (A-5)
    if (heldSecret) secret.current = heldSecret;
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
      const problem = stockProblemSchema.safeParse(result.problem);
      if (!problem.success) return 'failed';
      setStock(problem.data.lines);
      setStarted(null);
      return 'stock';
    }
    const json = result.data;
    secret.current = json.clientSecret;
    setStarted(json);
    if (json.quote.offers) setOffers(json.quote.offers);
    setStale(false);
    setRefused(null);
    setStock([]);
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
    return 'ok';
  }

  /** When checkout opens: the bag's stock, before any address. A failure says nothing: every re-price checks again. */
  async function checkStock(lines: { variantId: string; quantity: number }[]): Promise<void> {
    const result = await postJson(
      '/api/checkout/stock',
      { lines },
      z.object({ lines: stockLinesSchema, offers: z.custom<CheckoutOffers>().optional() }),
      { timeoutMs: START_TIMEOUT_MS },
    );
    if (!result.ok) return;
    setStock(result.data.lines);
    if (result.data.offers) setOffers(result.data.offers);
  }

  /** A line was removed or lowered: off the list. */
  function stockFixed(variantId: string): StockProblemLine[] {
    const rest = stock.filter((l) => l.variantId !== variantId);
    setStock(rest);
    setError(null);
    return rest;
  }

  async function paid(paymentIntentId: string, status: string): Promise<void> {
    if (status !== 'succeeded') {
      router.push(successUrl(`payment_intent=${encodeURIComponent(paymentIntentId)}`));
      return;
    }
    clearCheckout();
    forgetOffers(); // the wallet and the customer's standing have moved
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

  return { started, request, busy, error, stale, refused, stock, post, paid, drop, checkStock, stockFixed };
}
