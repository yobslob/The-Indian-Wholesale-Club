import { useState } from 'react';

import { stockProblemLines } from './stock';

import type {
  CheckoutErrorResponse,
  CheckoutRequestBody,
  CheckoutStartResponse,
  CheckoutStockResponse,
  FinalizeResponse,
  StockProblemLine,
} from '@repo/shared/domain';


import { apiPost } from '@/lib/api';
import { SITE_NAME } from '@/lib/site';
import { PaymentSheetError, useStripe } from '@/lib/stripe';

/** Where Stripe returns after a bank redirect (app.json scheme). */
const STRIPE_RETURN_URL = 'iwc://stripe-redirect';

export type CheckoutOutcome =
  | { kind: 'placed'; orderNumber: string; email: string }
  /** Paid; the order is confirmed later by the Stripe webhook (flows.md §3). */
  | { kind: 'pending'; message: string; email: string };

/**
 * The app's checkout, on the same server API as the website (flows.md §3):
 * POST /api/checkout prices the bag and creates the PaymentIntent, the
 * PaymentSheet takes the payment, POST /api/orders creates the order from the
 * checkout stored on the server (D-038). The phone never sends prices. §10 Y-3: `stock` holds the lines that cannot go
 * ahead as they are, from when checkout opens and from every re-price; while it has any there is nothing to pay.
 */
export function useCheckout() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [started, setStarted] = useState<CheckoutStartResponse | null>(null);
  const [request, setRequest] = useState<CheckoutRequestBody | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stock, setStock] = useState<StockProblemLine[]>([]);

  /** A failed check changes nothing: the re-price asks again and the order's own check still stands (INV-3). */
  async function checkStock(lines: CheckoutRequestBody['lines']): Promise<void> {
    const res = await apiPost<CheckoutStockResponse>('/api/checkout/stock', { lines });
    if (res.ok) setStock(res.data.lines);
  }

  async function start(body: CheckoutRequestBody): Promise<void> {
    setBusy(true);
    setError(null);
    setRequest(body);
    setStarted(null);
    const res = await apiPost<CheckoutStartResponse>('/api/checkout', body);
    if (!res.ok) {
      setBusy(false);
      const lines = stockProblemLines(res.problem);
      setStock(lines);
      if (lines.length === 0) setError(res.error);
      return;
    }
    setStock([]);
    const a = body.address;
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: SITE_NAME,
      paymentIntentClientSecret: res.data.clientSecret,
      returnURL: STRIPE_RETURN_URL,
      defaultBillingDetails: {
        name: a.fullName,
        email: body.email,
        phone: a.phone ?? undefined,
        address: {
          line1: a.line1,
          line2: a.line2 ?? undefined,
          city: a.city,
          state: a.state,
          postalCode: a.zipCode,
          country: 'US',
        },
      },
    });
    setBusy(false);
    if (initError) {
      setError('Payments are not available right now.');
      return;
    }
    setStarted(res.data);
  }

  async function pay(): Promise<CheckoutOutcome | null> {
    if (!started || !request) return null;
    setError(null);
    const { error: payError } = await presentPaymentSheet();
    if (payError) {
      if (payError.code !== PaymentSheetError.Canceled) setError(payError.message);
      return null;
    }
    setBusy(true);
    const res = await apiPost<FinalizeResponse | CheckoutErrorResponse>('/api/orders', {
      paymentIntentId: started.paymentIntentId,
    });
    setBusy(false);
    if (res.ok && 'orderNumber' in res.data) {
      return { kind: 'placed', orderNumber: res.data.orderNumber, email: request.email };
    }
    if (!res.ok && res.status === 409) {
      // Sold out while paying: the server refunded in full. The bag stays.
      setStarted(null);
      setError(res.error);
      void checkStock(request.lines);
      return null;
    }
    const message = res.ok
      ? 'error' in res.data
        ? res.data.error
        : ''
      : res.status === 0
        ? 'Your payment went through. We will email your order confirmation shortly.'
        : res.error;
    return { kind: 'pending', message, email: request.email };
  }

  return { started, request, busy, error, stock, checkStock, start, pay, edit: () => setStarted(null) };
}
