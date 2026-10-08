'use client';

import { formatDeliveryWindow, formatUsd, type ShippingMethod } from '@repo/shared/domain';

import type { CheckoutQuote } from './types';

/**
 * Standard (free, with the next export, D-041) or express (a courier from Mumbai to the door, priced by the pieces,
 * D-070), each with its own delivery window (D-008). Express only appears once its settings exist.
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
      label: 'Express (courier from India to your door)',
      cents: express.shippingCents,
      from: express.delivery.est_delivery_from,
      to: express.delivery.est_delivery_to,
    },
  ];
  return (
    <fieldset className="mb-[18px] grid gap-2">
      <legend className="sr-only">Shipping</legend>
      {options.map((o) => (
        <label
          key={o.method}
          className="border-line bg-paper has-[:checked]:border-ink font-ui flex min-h-[52px] cursor-pointer items-center gap-3 rounded-md border px-3.5 text-sm font-medium"
        >
          <input
            type="radio"
            name="shippingMethod"
            checked={quote.shippingMethod === o.method}
            disabled={disabled}
            onChange={() => onChange(o.method)}
          />
          <span className="flex-1">
            {o.label} · {o.cents === 0 ? 'Free' : formatUsd(o.cents)}
          </span>
          <small className="text-ink-muted text-[13px]">{formatDeliveryWindow(o.from, o.to)}</small>
        </label>
      ))}
    </fieldset>
  );
}
