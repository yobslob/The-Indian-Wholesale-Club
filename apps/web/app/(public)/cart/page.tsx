'use client';

import {
  ArrowRight,
  CheckCircle,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { FREE_SHIPPING_THRESHOLD_CENTS } from '@repo/shared/constants';
import { calculateCheckoutBreakdown, formatUSD } from '@repo/shared/utils';

import { CartSkeleton } from '@/components/ui';
import { useCartStore } from '@/lib/store';

import type { PromoCode } from '@repo/shared/types';

export default function CartPage(): React.JSX.Element {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    getSubtotalCents,
    getTotalItems,
    appliedPromoCode,
    setAppliedPromoCode,
  } = useCartStore();

  const [mounted, setMounted] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [validatedPromo, setValidatedPromo] = useState<PromoCode | null>(null);
  const [promoDiscountCents, setPromoDiscountCents] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (appliedPromoCode) {
      setPromoInput(appliedPromoCode);
    }
  }, [appliedPromoCode]);

  // Synchronize promo validation when subtotal changes or on mount
  useEffect(() => {
    if (!mounted || !appliedPromoCode || items.length === 0) {
      if (items.length === 0) {
        setValidatedPromo(null);
        setPromoDiscountCents(0);
        setPromoSuccess('');
      }
      return;
    }

    const validateExistingPromo = async () => {
      try {
        const res = await fetch('/api/checkout/validate-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: appliedPromoCode,
            subtotalCents: getSubtotalCents(),
          }),
        });
        const data = await res.json();
        if (res.ok && data.valid && data.promo) {
          setValidatedPromo(data.promo);
          setPromoDiscountCents(data.discountCents || 0);
          setPromoSuccess(data.promo.code === 'FREESHIP' ? 'Free shipping applied!' : 'Promo code applied!');
        } else {
          setValidatedPromo(null);
          setPromoDiscountCents(0);
          setAppliedPromoCode(null);
        }
      } catch {
        // Silently preserve on network error
      }
    };

    validateExistingPromo();
  }, [mounted, appliedPromoCode, items.length, getSubtotalCents, setAppliedPromoCode]);

  if (!mounted) {
    return <CartSkeleton />;
  }

  const subtotalCents = getSubtotalCents();
  const breakdown = calculateCheckoutBreakdown(
    subtotalCents,
    promoDiscountCents,
    'standard',
    validatedPromo,
  );

  const isFreeShipping = breakdown.shippingCents === 0;
  const freeShippingProgress = Math.min(100, (subtotalCents / FREE_SHIPPING_THRESHOLD_CENTS) * 100);
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    setPromoSuccess('');

    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    setIsValidatingPromo(true);
    try {
      const res = await fetch('/api/checkout/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotalCents }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setPromoError(data.message || 'Invalid or expired promo code.');
        setValidatedPromo(null);
        setPromoDiscountCents(0);
        setAppliedPromoCode(null);
        return;
      }

      setValidatedPromo(data.promo);
      setPromoDiscountCents(data.discountCents || 0);
      setAppliedPromoCode(data.promo.code);
      setPromoSuccess(
        data.promo.code === 'FREESHIP'
          ? 'Free shipping applied!'
          : `Promo code ${data.promo.code} applied!`,
      );
    } catch {
      setPromoError('Network error validating promo code.');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromoCode(null);
    setValidatedPromo(null);
    setPromoDiscountCents(0);
    setPromoInput('');
    setPromoSuccess('');
    setPromoError('');
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-20 text-center md:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <ShoppingBag className="h-10 w-10 text-neutral-400" />
        </div>
        <h1 className="font-display text-primary mt-6 text-3xl font-bold tracking-tight">
          Your Shopping Bag is Empty
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Looks like you haven&apos;t added any essentials to your bag yet.
        </p>
        <div className="mt-8">
          <Link
            href="/shop"
            className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center rounded-md px-8 text-sm font-semibold uppercase tracking-wider hover:bg-neutral-800"
          >
            Explore the Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:py-12">
      <div className="flex items-baseline justify-between border-b border-neutral-200 pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Shopping Bag ({getTotalItems()})
        </h1>
        <button
          onClick={clearCart}
          className="text-xs font-medium text-neutral-500 underline underline-offset-4 transition-colors hover:text-neutral-900"
        >
          Clear Bag
        </button>
      </div>

      {/* Free Shipping Progress Bar */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-neutral-900">
            {isFreeShipping ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                <CheckCircle className="h-4 w-4" />
                {validatedPromo?.code === 'FREESHIP'
                  ? 'Free standard shipping unlocked with promo code!'
                  : 'You unlocked free standard US shipping!'}
              </span>
            ) : (
              <span>
                Add{' '}
                <strong className="font-bold text-neutral-900">
                  {formatUSD(remainingForFreeShipping / 100)}
                </strong>{' '}
                more to qualify for <strong className="font-bold">Free US Shipping</strong>
              </span>
            )}
          </span>
          <span className="font-mono text-neutral-500">{Math.round(freeShippingProgress)}%</span>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className={`h-full transition-all duration-300 ${
              isFreeShipping ? 'bg-emerald-600' : 'bg-neutral-900'
            }`}
            style={{ width: `${freeShippingProgress}%` }}
          />
        </div>
      </div>

      {/* Main Grid: Cart Items on Left, Order Summary on Right */}
      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Left Column: Line Items */}
        <div className="lg:col-span-8">
          <div className="divide-y divide-neutral-200 border-b border-neutral-200">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-4 py-6 sm:gap-6">
                {/* Product Image */}
                <div className="relative aspect-3/4 w-24 shrink-0 overflow-hidden rounded-md bg-neutral-100 sm:w-28">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      fill
                      className="object-cover"
                      sizes="112px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                      No Image
                    </div>
                  )}
                </div>

                {/* Details & Controls */}
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-neutral-900 sm:text-base">
                          <Link
                            href={`/product/${item.productSlug}`}
                            className="hover:underline hover:underline-offset-2"
                          >
                            {item.productName}
                          </Link>
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500">
                          {item.colorName && <span>Color: {item.colorName}</span>}
                          {item.colorName && item.size && <span>&middot;</span>}
                          {item.size && <span>Size: {item.size}</span>}
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold text-neutral-900">
                        {formatUSD((item.priceCents * item.quantity) / 100)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity & Remove Row */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center rounded-md border border-neutral-200 bg-white">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-100"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center font-mono text-xs font-semibold text-neutral-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center text-neutral-600 transition-colors hover:bg-neutral-100"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="flex items-center gap-1 text-xs text-neutral-400 transition-colors hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <Link
              href="/shop"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-neutral-700 hover:text-neutral-900"
            >
              &larr; Continue Shopping
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Order Summary</h2>

            <div className="mt-6 space-y-3 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span className="font-mono text-neutral-900">
                  {formatUSD(breakdown.subtotalCents / 100)}
                </span>
              </div>

              {breakdown.discountCents > 0 && (
                <div className="flex justify-between font-semibold text-emerald-600">
                  <span>Discount ({validatedPromo?.code})</span>
                  <span className="font-mono">-{formatUSD(breakdown.discountCents / 100)}</span>
                </div>
              )}

              <div className="flex justify-between text-neutral-600">
                <span>Shipping</span>
                <span className="font-mono text-neutral-900">
                  {breakdown.shippingCents === 0 ? (
                    <span className="font-semibold uppercase text-emerald-600">Free</span>
                  ) : (
                    formatUSD(breakdown.shippingCents / 100)
                  )}
                </span>
              </div>

              <div className="flex justify-between text-neutral-600">
                <span>Estimated Sales Tax (8%)</span>
                <span className="font-mono text-neutral-900">
                  {formatUSD(breakdown.taxCents / 100)}
                </span>
              </div>

              <div className="border-t border-neutral-200 pt-3">
                <div className="flex items-baseline justify-between text-base">
                  <span className="font-bold text-neutral-900">Total</span>
                  <span className="font-display text-xl font-bold text-neutral-900">
                    {formatUSD(breakdown.totalCents / 100)}
                  </span>
                </div>
                <p className="mt-0.5 text-right text-[11px] text-neutral-400">USD</p>
              </div>
            </div>

            {/* Promo Code Form */}
            <div className="mt-6 border-t border-neutral-200 pt-4">
              <label
                htmlFor="promo"
                className="text-xs font-semibold uppercase tracking-wider text-neutral-700"
              >
                Promo Code
              </label>

              {appliedPromoCode ? (
                <div className="mt-2 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="font-mono font-bold">{appliedPromoCode}</span>
                    <span className="text-[11px] text-emerald-600">
                      {validatedPromo?.code === 'FREESHIP' ? '(Free Shipping)' : '(Applied)'}
                    </span>
                  </div>
                  <button
                    onClick={handleRemovePromo}
                    className="text-emerald-700 hover:text-emerald-900"
                    title="Remove promo code"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="mt-2 flex gap-2">
                  <input
                    id="promo"
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="e.g. WELCOME10 or FREESHIP"
                    className="focus-visible:ring-primary h-10 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-xs uppercase placeholder:normal-case placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1"
                  />
                  <button
                    type="submit"
                    disabled={isValidatingPromo}
                    className="rounded-md border border-neutral-300 bg-white px-4 text-xs font-semibold uppercase tracking-wider text-neutral-800 transition-colors hover:bg-neutral-100 disabled:opacity-50"
                  >
                    {isValidatingPromo ? '...' : 'Apply'}
                  </button>
                </form>
              )}

              {promoSuccess && !appliedPromoCode && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {promoSuccess}
                </p>
              )}
              {promoError && <p className="text-destructive mt-1.5 text-xs">{promoError}</p>}
            </div>

            {/* Checkout CTA */}
            <div className="mt-6">
              <Link
                href={
                  appliedPromoCode
                    ? `/checkout?promo=${encodeURIComponent(appliedPromoCode)}`
                    : '/checkout'
                }
                className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800"
              >
                <Lock className="h-3.5 w-3.5" />
                Proceed to Checkout
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Safe & Secure Guarantees */}
            <div className="mt-6 space-y-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-neutral-700" />
                <span>Free shipping on all US orders $75+</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-neutral-700" />
                <span>Easy 30-day returns and exchanges</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
