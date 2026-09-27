'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { calculateCheckoutBreakdown } from '@repo/shared/utils';

import {
  CheckoutStepper,
  ContactShippingStep,
  OrderSummarySidebar,
  PaymentStep,
  ShippingMethodStep,
} from '@/components/checkout';
import { useCartStore } from '@/lib/store';

import type { CheckoutStep } from '@/components/checkout';
import type { CheckoutShippingInput } from '@repo/shared/schemas';
import type { CheckoutCostBreakdown, PromoCode, ShippingTier } from '@repo/shared/types';

export default function CheckoutPage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items, clearCart, getSubtotalCents, appliedPromoCode: storePromoCode, setAppliedPromoCode: setStorePromoCode } =
    useCartStore();
  const [mounted, setMounted] = useState(false);

  // Stepper state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('information');

  // Form states
  const [shippingAddress, setShippingAddress] = useState<CheckoutShippingInput>({
    email: '',
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    phone: '',
  });

  const [shippingTier, setShippingTier] = useState<ShippingTier>('standard');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [discountCents, setDiscountCents] = useState(0);

  // Intent & financial state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState(true);
  const [isInitializingIntent, setIsInitializingIntent] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Initial breakdown using centralized calculation
  const [breakdown, setBreakdown] = useState<CheckoutCostBreakdown>(() =>
    calculateCheckoutBreakdown(0, 0, 'standard', null),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Recalculate breakdown whenever inputs change
  useEffect(() => {
    if (!mounted) return;
    const currentSubtotal = getSubtotalCents();
    const updatedBreakdown = calculateCheckoutBreakdown(
      currentSubtotal,
      discountCents,
      shippingTier,
      appliedPromo,
    );
    setBreakdown(updatedBreakdown);
  }, [mounted, getSubtotalCents, discountCents, shippingTier, appliedPromo, items.length]);

  // Handle promo code application
  const handleApplyPromo = useCallback(
    async (code: string): Promise<{ success: boolean; message?: string }> => {
      try {
        const cleanCode = code.trim().toUpperCase();
        const res = await fetch('/api/checkout/validate-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cleanCode, subtotalCents: getSubtotalCents() }),
        });
        const data = await res.json();

        if (!res.ok || !data.valid || !data.promo) {
          return { success: false, message: data.message || 'Invalid promotion' };
        }

        setAppliedPromo(data.promo);
        setDiscountCents(data.discountCents || 0);
        setStorePromoCode(data.promo.code);

        const newBreakdown = calculateCheckoutBreakdown(
          getSubtotalCents(),
          data.discountCents || 0,
          shippingTier,
          data.promo,
        );
        setBreakdown(newBreakdown);

        return { success: true };
      } catch {
        return { success: false, message: 'Network error validating promotion' };
      }
    },
    [getSubtotalCents, shippingTier, setStorePromoCode],
  );

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setDiscountCents(0);
    setStorePromoCode(null);

    const newBreakdown = calculateCheckoutBreakdown(
      getSubtotalCents(),
      0,
      shippingTier,
      null,
    );
    setBreakdown(newBreakdown);
  };

  // Handle promo code from URL param or store on initial mount.
  // Attempted at most once per mount (URL/store promo is not user-typed input).
  const promoInitAttemptedRef = useRef(false);

  useEffect(() => {
    if (!mounted || items.length === 0) return;

    const promoFromUrl = searchParams.get('promo');
    const initialPromoToTry = promoFromUrl || storePromoCode;

    if (initialPromoToTry && !appliedPromo && !promoInitAttemptedRef.current) {
      promoInitAttemptedRef.current = true;
      handleApplyPromo(initialPromoToTry);
    }
  }, [
    mounted,
    searchParams,
    storePromoCode,
    items.length,
    appliedPromo,
    handleApplyPromo,
  ]);

  // Step 1: Submit contact & shipping
  const handleShippingSubmit = (data: CheckoutShippingInput) => {
    setShippingAddress(data);
    setCurrentStep('shipping');
  };

  // Step 2: Continue to payment (initialize intent)
  const handleProceedToPayment = async () => {
    setIsInitializingIntent(true);
    setCheckoutError('');

    try {
      const res = await fetch('/api/checkout/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shippingAddress,
          shippingMethod: shippingTier,
          promoCode: appliedPromo?.code || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Failed to initialize payment');
        setIsInitializingIntent(false);
        return;
      }

      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setIsTestMode(data.isTestMode ?? true);
      if (data.breakdown) {
        setBreakdown(data.breakdown);
      }
      setCurrentStep('payment');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error starting checkout session';
      setCheckoutError(message);
    } finally {
      setIsInitializingIntent(false);
    }
  };

  // Step 3: Complete payment and create order
  const handlePaymentSuccess = async (intentId: string, provider: string) => {
    // Own try/catch (M10): a failure here means the payment may already
    // have succeeded, so every path below either reconciles to the existing
    // order or throws a message that tells the user pressing Pay again is
    // safe (the server's idempotency check prevents a double charge).
    let res: Response;
    let data: { success?: boolean; error?: string; orderNumber?: string } | null = null;
    try {
      res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shippingAddress,
          shippingMethod: shippingTier,
          promoCode: appliedPromo?.code || undefined,
          paymentIntentId: intentId,
          paymentProvider: provider,
        }),
      });
      data = await res.json().catch(() => null);
    } catch {
      throw new Error(
        'Could not reach the server to record your order. Press Pay to retry - you will not be charged again.',
      );
    }

    const goToSuccess = (orderNumber: string) => {
      clearCart();
      const email = encodeURIComponent(shippingAddress.email || '');
      router.push(
        `/checkout/success?order_number=${encodeURIComponent(orderNumber)}&email=${email}`,
      );
    };

    if (res.ok && data?.success && data.orderNumber) {
      goToSuccess(data.orderNumber);
      return;
    }

    // Reconcile: this payment already paid for an order (an earlier attempt
    // succeeded but its response was lost) - the server returns the existing
    // order to its owner, so continue as success instead of failing again.
    if (res.status === 409 && data?.orderNumber) {
      goToSuccess(data.orderNumber);
      return;
    }

    if (res.status === 409) {
      throw new Error(
        'This payment has already been used for an order. Please contact support with your receipt email.',
      );
    }

    if (res.status >= 500) {
      throw new Error(
        'Your payment went through but the order could not be recorded. Press Pay to retry - you will not be charged again.',
      );
    }

    throw new Error(data?.error || 'Could not record your order. Press Pay to retry.');
  };

  if (!mounted) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-screen-2xl items-center justify-center px-4">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-screen-md flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Your Shopping Bag is Empty
        </h1>
        <p className="mt-3 text-sm text-neutral-600">
          Please add at least one item to your bag before proceeding to checkout.
        </p>
        <Link
          href="/shop"
          className="bg-primary text-primary-foreground mt-8 inline-flex h-11 items-center justify-center rounded-md px-8 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800"
        >
          Explore Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Checkout Header */}
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-neutral-900"
          >
            ROOT
          </Link>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Secure 256-Bit SSL Checkout</span>
          </div>
        </div>
      </header>

      {/* Main Checkout Container */}
      <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Stepper & Step Contents */}
          <div className="lg:col-span-7">
            <CheckoutStepper currentStep={currentStep} onStepClick={setCurrentStep} />

            {checkoutError && (
              <div className="text-destructive mb-6 rounded-md bg-red-50 p-4 text-xs font-medium">
                {checkoutError}
              </div>
            )}

            <div className="mt-8">
              {currentStep === 'information' && (
                <ContactShippingStep
                  initialValues={shippingAddress}
                  onSubmit={handleShippingSubmit}
                />
              )}

              {currentStep === 'shipping' && (
                <ShippingMethodStep
                  shippingAddress={shippingAddress}
                  selectedTier={shippingTier}
                  onTierChange={setShippingTier}
                  onBack={() => setCurrentStep('information')}
                  onContinue={handleProceedToPayment}
                  isProcessing={isInitializingIntent}
                  isFreeShipping={breakdown.shippingCents === 0}
                />
              )}

              {currentStep === 'payment' && (
                <PaymentStep
                  clientSecret={clientSecret}
                  paymentIntentId={paymentIntentId}
                  isTestMode={isTestMode}
                  breakdown={breakdown}
                  shippingAddress={shippingAddress}
                  shippingTier={shippingTier}
                  onSuccess={handlePaymentSuccess}
                  onBack={() => setCurrentStep('shipping')}
                />
              )}
            </div>
          </div>

          {/* Right Column: Order Summary Sidebar */}
          <div className="lg:col-span-5">
            <OrderSummarySidebar
              items={items}
              breakdown={breakdown}
              shippingTier={shippingTier}
              onApplyPromo={handleApplyPromo}
              onRemovePromo={handleRemovePromo}
              appliedPromoCode={appliedPromo?.code}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
