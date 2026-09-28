'use client';

import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
import { useEffect, useRef, useState } from 'react';

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');
  return stripePromise;
}

/**
 * Stripe Payment Element (loaded only on /checkout). On success it reports the
 * PaymentIntent id; card flows that need a redirect (3-D Secure) come back to
 * /checkout/success?payment_intent=…, which finishes the order there.
 */
export function PaymentForm({
  clientSecret,
  totalLabel,
  onPaid,
}: {
  clientSecret: string;
  totalLabel: string;
  onPaid: (paymentIntentId: string, status: string) => void;
}): React.JSX.Element {
  const mountRef = useRef<HTMLDivElement>(null);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStripe().then((s) => {
      if (cancelled || !s || !mountRef.current) return;
      const els = s.elements({ clientSecret });
      els.create('payment').mount(mountRef.current);
      setStripe(s);
      setElements(els);
    });
    return () => {
      cancelled = true;
    };
  }, [clientSecret]);

  async function pay(): Promise<void> {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/checkout/success` },
    });
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.');
      setBusy(false);
      return;
    }
    if (paymentIntent) onPaid(paymentIntent.id, paymentIntent.status);
  }

  return (
    <div className="space-y-4">
      <div ref={mountRef} className="min-h-24" />
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void pay()}
        disabled={!elements || busy}
        className="bg-brand text-canvas min-h-11 w-full rounded-sm px-4 text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Paying…' : `Pay ${totalLabel}`}
      </button>
    </div>
  );
}
