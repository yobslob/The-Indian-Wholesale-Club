'use client';

import { CheckCircle2, Clock, Truck } from 'lucide-react';

import { SHIPPING_RATES } from '@repo/shared/constants';
import { formatUSD } from '@repo/shared/utils';

import type { CheckoutShippingInput } from '@repo/shared/schemas';
import type { ShippingTier } from '@repo/shared/types';

interface ShippingMethodStepProps {
  shippingAddress: CheckoutShippingInput;
  selectedTier: ShippingTier;
  onTierChange: (tier: ShippingTier) => void;
  onBack: () => void;
  onContinue: () => void;
  isFreeShipping: boolean;
  isProcessing?: boolean;
}

export function ShippingMethodStep({
  shippingAddress,
  selectedTier,
  onTierChange,
  onBack,
  onContinue,
  isFreeShipping,
  isProcessing = false,
}: ShippingMethodStepProps): React.JSX.Element {
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

        <div className="flex items-center justify-between border-t border-neutral-200 pt-3">
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
      </div>

      {/* Shipping Method Selection */}
      <div>
        <h2 className="text-base font-semibold text-neutral-900">Shipping Method</h2>
        <p className="mt-1 text-xs text-neutral-500">
          All packages are insured and dispatched with tracking.
        </p>

        <div className="mt-4 space-y-3">
          {/* Standard Tier */}
          <label
            className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all ${
              selectedTier === 'standard'
                ? 'border-primary ring-primary bg-neutral-50/50 ring-1'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="shippingTier"
                value="standard"
                checked={selectedTier === 'standard'}
                onChange={() => onTierChange('standard')}
                className="text-primary focus:ring-primary h-4 w-4"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                  <Truck className="h-4 w-4 text-neutral-600" />
                  <span>Standard Shipping</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                  <Clock className="h-3 w-3" />
                  <span>{SHIPPING_RATES.standard.windowLabel}</span>
                </div>
              </div>
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              {isFreeShipping ? (
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  FREE
                </span>
              ) : (
                formatUSD(SHIPPING_RATES.standard.price)
              )}
            </div>
          </label>

          {/* Express Tier */}
          <label
            className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-all ${
              selectedTier === 'express'
                ? 'border-primary ring-primary bg-neutral-50/50 ring-1'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="shippingTier"
                value="express"
                checked={selectedTier === 'express'}
                onChange={() => onTierChange('express')}
                className="text-primary focus:ring-primary h-4 w-4"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                  <CheckCircle2 className="h-4 w-4 text-neutral-600" />
                  <span>Express Priority Shipping</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                  <Clock className="h-3 w-3" />
                  <span>{SHIPPING_RATES.express.windowLabel}</span>
                </div>
              </div>
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              {formatUSD(SHIPPING_RATES.express.price)}
            </div>
          </label>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
        >
          ← Return to Information
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={isProcessing}
          className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center gap-2 rounded-md px-8 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Preparing Payment...
            </span>
          ) : (
            'Continue to Payment'
          )}
        </button>
      </div>
    </div>
  );
}
