'use client';

import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElement,
  type StripePaymentElementOptions,
} from '@stripe/stripe-js';
import { useEffect, useRef, useState } from 'react';

import { paymentErrorMessage } from './payment-errors';

let stripePromise: Promise<Stripe | null> | null = null;
/** A failed or empty load is forgotten, so Retry loads Stripe.js again (launch QA A-1). */
export function getStripe(): Promise<Stripe | null> {
  stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').then(
    (stripe) => {
      if (!stripe) stripePromise = null;
      return stripe;
    },
    (error: unknown) => {
      stripePromise = null;
      throw error;
    },
  );
  return stripePromise;
}

/** How long the card form may take to appear before we offer Retry (a blocked frame never says so itself). */
const READY_TIMEOUT_MS = 20_000;
const LOAD_FAILED = "The payment form didn't load. Please check your connection and try again.";

/**
 * Stripe Payment Element (loaded only where a payment is taken). On success it reports the PaymentIntent id and
 * stays locked (the page moves on); card flows that need a redirect (3-D Secure) come back to `returnPath`
 * ?payment_intent=…, which finishes the order there. Mounted from a callback ref, destroyed on unmount, Pay only
 * once the form is ready, Retry when it fails to load (A-1); declines in plain words and the form focused (A-9).
 */
export function PaymentForm({
  clientSecret,
  totalLabel,
  onPaid,
  returnPath = '/checkout/success',
  billing,
  amountCents,
  disabled = false,
  notice = null,
}: {
  clientSecret: string;
  totalLabel: string;
  onPaid: (paymentIntentId: string, status: string) => void;
  /** Where a card that needs a redirect (3-D Secure) comes back to, with ?payment_intent=… */
  returnPath?: string;
  /** The checkout's own details as the form's starting values (a US store: country US, not the visitor's location). */
  billing?: NonNullable<StripePaymentElementOptions['defaultValues']>['billingDetails'];
  /** The payment's amount: when a re-price moves it on the same payment, the form fetches the new amount. */
  amountCents?: number;
  /** True while the total is being re-priced or is out of date: Pay waits. */
  disabled?: boolean;
  /** A message to show above Pay from outside (a payment that failed after a redirect). */
  notice?: string | null;
}): React.JSX.Element {
  const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const elementRef = useRef<StripePaymentElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(notice);
  useEffect(() => {
    if (notice) setError(notice);
  }, [notice]);

  useEffect(() => {
    if (!mountEl) return;
    let cancelled = false;
    let element: StripePaymentElement | null = null;
    setReady(false);
    setLoadFailed(false);
    const timer = setTimeout(() => {
      if (!cancelled) setLoadFailed(true);
    }, READY_TIMEOUT_MS);
    getStripe().then(
      (s) => {
        if (cancelled) return;
        if (!s) {
          setLoadFailed(true);
          return;
        }
        const els = s.elements({ clientSecret });
        element = els.create(
          'payment',
          billing ? { defaultValues: { billingDetails: billing } } : {},
        );
        element.on('ready', () => {
          clearTimeout(timer);
          if (!cancelled) setReady(true);
        });
        element.on('loaderror', () => {
          clearTimeout(timer);
          if (!cancelled) setLoadFailed(true);
        });
        element.mount(mountEl);
        elementRef.current = element;
        setStripe(s);
        setElements(els);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      element?.destroy();
      elementRef.current = null;
    };
    // The form is built once per payment (and per Retry); later changes to `billing` don't rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret, mountEl, attempt]);

  // A-5: the same payment with a new amount (shipping switched): let the form show and confirm the new amount.
  const shownAmount = useRef(amountCents);
  useEffect(() => {
    if (!elements || amountCents === shownAmount.current) return;
    shownAmount.current = amountCents;
    void elements.fetchUpdates().catch(() => undefined);
  }, [elements, amountCents]);

  async function pay(): Promise<void> {
    if (!stripe || !elements || busy || paid) return;
    setBusy(true);
    setError(null);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: `${window.location.origin}${returnPath}` },
      });
      // Already paid (a second tab, a double tap): carry on as paid.
      const done =
        paymentIntent ??
        (stripeError?.payment_intent?.status === 'succeeded' ? stripeError.payment_intent : null);
      if (done) {
        setPaid(true);
        onPaid(done.id, done.status);
        return;
      }
      setError(paymentErrorMessage(stripeError ?? {}));
    } catch {
      setError('We could not reach the payment service. Please try again.');
    }
    setBusy(false);
    elementRef.current?.focus();
  }

  return (
    <div className="space-y-4">
      <div ref={setMountEl} className="min-h-24" />
      {loadFailed && !ready ? (
        <div className="space-y-2" role="alert">
          <p className="text-danger text-sm">{LOAD_FAILED}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="border-line font-ui rounded-pill min-h-11 border px-5 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={!ready || busy || paid || disabled}
        className="bg-brand text-on-brand font-ui rounded-pill min-h-14 w-full px-6 text-[15px] font-medium disabled:opacity-50"
      >
        {paid ? 'Paid. Confirming your order…' : busy ? 'Paying…' : `Pay ${totalLabel}`}
      </button>
    </div>
  );
}
