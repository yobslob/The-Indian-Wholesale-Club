'use client';

import { Check, Tag, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

import { formatUSD } from '@repo/shared/utils';

import type { CheckoutItemPayload } from '@/lib/queries/orders';
import type { CheckoutCostBreakdown, ShippingTier } from '@repo/shared/types';

interface OrderSummarySidebarProps {
  items: CheckoutItemPayload[];
  breakdown: CheckoutCostBreakdown;
  shippingTier: ShippingTier;
  onApplyPromo: (code: string) => Promise<{ success: boolean; message?: string }>;
  onRemovePromo: () => void;
  appliedPromoCode?: string | null;
}

export function OrderSummarySidebar({
  items,
  breakdown,
  shippingTier,
  onApplyPromo,
  onRemovePromo,
  appliedPromoCode,
}: OrderSummarySidebarProps): React.JSX.Element {
  const [promoInput, setPromoInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;

    setIsApplying(true);
    setPromoError('');
    setPromoSuccess('');

    const res = await onApplyPromo(promoInput.trim());
    setIsApplying(false);

    if (res.success) {
      setPromoSuccess(`Promo code "${promoInput.toUpperCase()}" applied!`);
      setPromoInput('');
    } else {
      setPromoError(res.message || 'Invalid promotional code');
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-6 shadow-sm">
      <h2 className="font-display text-base font-bold text-neutral-900">
        Order Summary ({items.reduce((s, i) => s + i.quantity, 0)})
      </h2>

      {/* Item List */}
      <ul className="mt-4 max-h-80 divide-y divide-neutral-200 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.variantId} className="flex items-center gap-4 py-3">
            {/* Thumbnail with Quantity Badge */}
            <div className="relative h-16 w-14 flex-shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                  ROOT
                </div>
              )}
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[10px] font-bold text-white shadow">
                {item.quantity}
              </span>
            </div>

            {/* Product Details */}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-semibold text-neutral-900">
                {item.productName}
              </h3>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {[item.colorName, item.size].filter(Boolean).join(' / ')}
              </p>
            </div>

            {/* Price */}
            <div className="text-xs font-semibold text-neutral-900">
              {formatUSD((item.priceCents * item.quantity) / 100)}
            </div>
          </li>
        ))}
      </ul>

      {/* Promo Code Input */}
      <div className="mt-6 border-t border-neutral-200 pt-6">
        {appliedPromoCode ? (
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-wider">{appliedPromoCode}</span>
              <span>(-{formatUSD(breakdown.discountCents / 100)})</span>
            </div>
            <button
              type="button"
              onClick={onRemovePromo}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label="Remove promo code"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleApply} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Discount or Gift Code"
                className="focus-visible:ring-primary h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-xs uppercase placeholder:normal-case focus-visible:outline-none focus-visible:ring-1"
              />
            </div>
            <button
              type="submit"
              disabled={isApplying || !promoInput.trim()}
              className="h-10 rounded-md bg-neutral-900 px-4 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {isApplying ? '...' : 'Apply'}
            </button>
          </form>
        )}

        {promoError && <p className="text-destructive mt-2 text-xs">{promoError}</p>}
        {promoSuccess && !appliedPromoCode && (
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> {promoSuccess}
          </p>
        )}
      </div>

      {/* Cost Breakdown */}
      <div className="mt-6 space-y-2.5 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-medium text-neutral-900">
            {formatUSD(breakdown.subtotalCents / 100)}
          </span>
        </div>

        {breakdown.discountCents > 0 && (
          <div className="text-destructive flex justify-between">
            <span>Promotional Discount</span>
            <span className="font-semibold">-{formatUSD(breakdown.discountCents / 100)}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Shipping ({shippingTier === 'express' ? 'Express Priority' : 'Standard'})</span>
          <span className="font-medium text-neutral-900">
            {breakdown.shippingCents === 0 ? (
              <span className="text-[11px] font-bold uppercase text-emerald-600">FREE</span>
            ) : (
              formatUSD(breakdown.shippingCents / 100)
            )}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Estimated US Sales Tax</span>
          <span className="font-medium text-neutral-900">
            {formatUSD(breakdown.taxCents / 100)}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-sm font-bold text-neutral-900">
          <span>Total</span>
          <span className="font-display text-base">{formatUSD(breakdown.totalCents / 100)}</span>
        </div>
      </div>
    </div>
  );
}
