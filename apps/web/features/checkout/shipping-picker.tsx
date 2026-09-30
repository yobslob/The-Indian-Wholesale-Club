'use client';

import { formatDeliveryWindow, formatUsd, type ShippingMethod } from '@repo/shared/domain';

import type { CheckoutQuote } from './types';

/**
 * Standard (free) or express ($8) shipping, each with its own delivery window
 * (D-041, D-008). Express only appears once it is set up (Q-18).
 */
export function ShippingPicker({
  quote,
  disabled,
  onChange,
}: {
  quote: CheckoutQuote;
  disabled: boolean;
  onChange: (method: ShippingMethod) => void;
}): React.JSX.Element | null {
  const { standard, express } = quote.options;
  if (!express) return null;
  const options: {
    method: ShippingMethod;
    label: string;
    cents: number;
    from: string;
    to: string;
  }[] = [
    {
      method: 'standard',
      label: 'Standard',
      cents: standard.shippingCents,
      from: standard.delivery.est_delivery_from,
      to: standard.delivery.est_delivery_to,
    },
    {
      method: 'express',
      label: 'Express',
      cents: express.shippingCents,
      from: express.delivery.est_delivery_from,
      to: express.delivery.est_delivery_to,
    },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="text-ink text-sm font-medium">Shipping</legend>
      {options.map((o) => (
        <label
          key={o.method}
          className="border-line bg-paper flex min-h-12 items-center gap-3 rounded-md border px-3.5"
        >
          <input
            type="radio"
            name="shippingMethod"
            checked={quote.shippingMethod === o.method}
            disabled={disabled}
            onChange={() => onChange(o.method)}
          />
          <span className="flex-1 text-sm">
            {o.label} · {o.cents === 0 ? 'Free' : formatUsd(o.cents)}
          </span>
          <span className="text-ink-muted text-sm">{formatDeliveryWindow(o.from, o.to)}</span>
        </label>
      ))}
    </fieldset>
  );
}
