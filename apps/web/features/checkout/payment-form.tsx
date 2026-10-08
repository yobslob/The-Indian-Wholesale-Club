'use client';

import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElementOptions,
} from '@stripe/stripe-js';
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
  returnPath = '/checkout/success',
  billing,
}: {
  clientSecret: string;
  totalLabel: string;
  onPaid: (paymentIntentId: string, status: string) => void;
  /** Where a card that needs a redirect (3-D Secure) comes back to, with ?payment_intent=… */
  returnPath?: string;
  /** The checkout's own details as the form's starting values (a US store: country US, not the visitor's location). */
  billing?: NonNullable<StripePaymentElementOptions['defaultValues']>['billingDetails'];
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
      els.create('payment', billing ? { defaultValues: { billingDetails: billing } } : {}).mount(mountRef.current);
      setStripe(s);
      setElements(els);
    });
    return () => {
      cancelled = true;
    };
    // The form is built once per payment; later changes to `billing` don't rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret]);

  async function pay(): Promise<void> {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}${returnPath}` },
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
        className="bg-brand text-on-brand font-ui min-h-14 w-full rounded-pill px-6 text-[15px] font-medium disabled:opacity-50"
      >
        {busy ? 'Paying…' : `Pay ${totalLabel}`}
      </button>
    </div>
  );
}
