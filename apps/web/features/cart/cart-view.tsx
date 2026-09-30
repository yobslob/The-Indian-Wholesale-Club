'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { MAX_QTY_PER_LINE } from './limits';
import { cartSubtotalCents, useCart } from './store';

/** The bag. Prices are indicative; checkout re-prices on the server. */
export function CartView(): React.JSX.Element {
  const { lines, setQuantity, remove } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <p className="text-ink-muted text-sm">Loading your bag…</p>;
  if (lines.length === 0) {
    return (
      <p className="text-ink">
        Your bag is empty.{' '}
        <Link href="/states" className="underline">
          Find something from home
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="divide-line border-line divide-y border-y">
        {lines.map((line) => (
          <li key={line.variantId} className="flex flex-wrap items-center gap-4 py-4">
            <div className="flex-1">
              <Link
                href={`/states/${line.regionSlug}/${line.productSlug}`}
                className="text-ink font-medium hover:underline"
              >
                {line.productName}
              </Link>
              <p className="text-ink-muted text-sm">
                {line.variantLabel} · {line.regionName}
              </p>
            </div>
            <label className="text-sm">
              <span className="sr-only">Quantity</span>
              <select
                value={line.quantity}
                onChange={(e) => setQuantity(line.variantId, Number(e.target.value))}
                className="border-line bg-paper font-ui min-h-11 rounded-pill border px-3"
              >
                {Array.from({ length: MAX_QTY_PER_LINE }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="w-20 text-right text-sm">
              {formatUsd(line.unitPriceCents * line.quantity)}
            </span>
            <button
              type="button"
              onClick={() => remove(line.variantId)}
              className="min-h-11 text-sm underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <p className="text-ink">
          Subtotal <strong>{formatUsd(cartSubtotalCents(lines))}</strong>
          <span className="text-ink-muted block text-xs">
            Shipping, tax and delivery dates are shown at checkout.
          </span>
        </p>
        <Link
          href="/checkout"
          className="bg-brand text-on-brand font-ui inline-flex min-h-12 items-center rounded-pill px-6 text-[15px] font-medium"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
