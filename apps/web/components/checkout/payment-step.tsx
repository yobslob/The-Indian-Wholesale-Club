'use client';

import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
import { Check, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { formatUSD } from '@repo/shared/utils';

import type { CheckoutShippingInput } from '@repo/shared/schemas';
import type { CheckoutCostBreakdown, ShippingTier } from '@repo/shared/types';

interface PaymentStepProps {
  shippingAddress: CheckoutShippingInput;
  shippingTier: ShippingTier;
  breakdown: CheckoutCostBreakdown;
  isTestMode: boolean;
  clientSecret?: string | null;
  paymentIntentId?: string | null;
  onBack: () => void;
  onSuccess: (paymentIntentId: string, provider: string) => Promise<void>;
}

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

export function PaymentStep({
  shippingAddress,
  shippingTier,
  breakdown,
  isTestMode,
  clientSecret,
  onBack,
  onSuccess,
}: PaymentStepProps): React.JSX.Element {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Stripe Elements state for live payments (C4)
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [elementsInstance, setElementsInstance] = useState<StripeElements | null>(null);
  const [isStripeReady, setIsStripeReady] = useState(false);
  const paymentElementContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTestMode || !clientSecret || !stripePromise) {
      return;
    }

    let isMounted = true;

    stripePromise.then((stripe) => {
      if (!stripe || !isMounted) return;
      setStripeInstance(stripe);

      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#171717',
            colorBackground: '#ffffff',
            colorText: '#171717',
            borderRadius: '6px',
          },
        },
      });

      const paymentElement = elements.create('payment');
      if (paymentElementContainerRef.current) {
        paymentElement.mount(paymentElementContainerRef.current);
        paymentElement.on('ready', () => {
          if (isMounted) setIsStripeReady(true);
        });
      }

      setElementsInstance(elements);
    });

    return () => {
      isMounted = false;
    };
  }, [isTestMode, clientSecret]);

  const handleLivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeInstance || !elementsInstance) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripeInstance.confirmPayment({
        elements: elementsInstance,
        confirmParams: {
          receipt_email: shippingAddress.email,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Payment authorization failed');
        setIsProcessing(false);
      } else if (
        paymentIntent &&
        (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')
      ) {
        await onSuccess(paymentIntent.id, 'stripe');
      } else {
        setErrorMessage('Payment requires additional verification or is incomplete.');
        setIsProcessing(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment authorization failed';
      setErrorMessage(message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Recap Box */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 text-xs">
        <div className="flex items-center justify-between pb-3">
          <div className="flex gap-4">
            <span className="font-semibold text-neutral-500">Contact</span>
            <span className="text-neutral-900">{shippingAddress.email}</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-primary font-medium underline underline-offset-2 hover:text-neutral-600"
          >
            Change
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 py-3">
          <div className="flex gap-4">
            <span className="font-semibold text-neutral-500">Ship to</span>
            <span className="text-neutral-900">
              {shippingAddress.line1}, {shippingAddress.city}, {shippingAddress.state}{' '}
              {shippingAddress.zipCode}
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-primary font-medium underline underline-offset-2 hover:text-neutral-600"
          >
            Change
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
          <div className="flex gap-4">
            <span className="font-semibold text-neutral-500">Method</span>
            <span className="text-neutral-900">
              {shippingTier === 'express' ? 'Express Priority' : 'Standard Delivery'} ·{' '}
              {breakdown.shippingCents === 0 ? 'FREE' : formatUSD(breakdown.shippingCents / 100)}
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-primary font-medium underline underline-offset-2 hover:text-neutral-600"
          >
            Change
          </button>
        </div>
      </div>

      {/* Payment Information */}
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Payment</h2>
        <p className="mt-1 text-xs text-neutral-500">All transactions are secure and encrypted.</p>

        {!isTestMode && stripePromise && clientSecret ? (
          <form onSubmit={handleLivePayment} className="mt-4 space-y-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-5">
              <div ref={paymentElementContainerRef} id="stripe-payment-element" />
              {!isStripeReady && (
                <div className="flex items-center justify-center py-6 text-xs text-neutral-500">
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
                  Loading payment form...
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="text-destructive rounded-md bg-red-50 p-3 text-xs">
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
              <button
                type="button"
                onClick={onBack}
                className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
              >
                ← Return to Shipping
              </button>

              <button
                type="submit"
                disabled={isProcessing || !isStripeReady}
                className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center gap-2 rounded-md px-8 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Authorizing...
                  </span>
                ) : (
                  <span>Pay {formatUSD(breakdown.totalCents / 100)}</span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/40 p-5">
            <p className="text-sm font-medium text-amber-900">
              Secure card payments are temporarily unavailable.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Please try again later or contact support. No order was created.
            </p>
          </div>
        )}
      </div>

      {/* Security Assurance Footer */}
      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-neutral-100 pt-6 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-emerald-600" />
          <span>Secure Payment Processing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-neutral-600" />
          <span>Guaranteed US Delivery</span>
        </div>
      </div>
    </div>
  );
}
