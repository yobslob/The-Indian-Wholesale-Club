'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { useCart } from '@/features/cart/store';

import { useLiveAvailability } from './use-live-availability';

import type { Product, Variant } from '@repo/db/store';

interface Props {
  product: Pick<
    Product,
    'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path'
  >;
  variants: Variant[];
  /** Shown just above the button (the delivery window, D-008). */
  delivery?: React.ReactNode;
}

/** Variant picker + live availability + add to bag (the only client island on the product page). */
export function AddToCart({ product, variants, delivery }: Props): React.JSX.Element {
  const initial = useMemo(
    () => Object.fromEntries(variants.map((v) => [v.id, v.available])),
    [variants],
  );
  const available = useLiveAvailability(product.id, initial);
  const add = useCart((s) => s.add);
  const [variantId, setVariantId] = useState(
    () => variants.find((v) => v.available > 0)?.id ?? variants[0]?.id,
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId);
  if (!variant) return <p className="text-ink-muted text-sm">Not available right now.</p>;

  const left = available[variant.id] ?? 0;
  const soldOut = left <= 0;
  const maxQty = Math.max(1, Math.min(left, MAX_QTY_PER_LINE));

  return (
    <div className="space-y-4">
      <p className="font-ui text-[22px] font-semibold leading-none">{formatUsd(variant.price_cents)}</p>

      {variants.length > 1 ? (
        <fieldset>
          <legend className="font-ui text-ink-muted mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]">Option</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVariantId(v.id);
                  setQuantity(1);
                  setAdded(false);
                }}
                aria-pressed={v.id === variantId}
                className={`font-ui bg-paper min-h-11 rounded-pill border px-4 text-sm font-medium ${
                  v.id === variantId ? 'border-ink shadow-[inset_0_0_0_1px_theme(colors.ink)]' : 'border-line'
                } ${(available[v.id] ?? 0) <= 0 ? 'line-through opacity-60' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <p className={`flex items-center gap-2 text-sm ${soldOut ? 'text-caution' : ''}`} aria-live="polite">
        <span aria-hidden="true" className={`size-2 rounded-full ${soldOut ? 'bg-caution' : 'bg-region'}`} />
        {soldOut ? 'Sold out' : left <= 3 ? `Only ${left} left` : 'In stock'}
      </p>

      {delivery ? <div className="bg-paper rounded-md px-4 py-3.5">{delivery}</div> : null}

      <div className="flex items-center gap-3">
        <label className="text-ink text-sm">
          Qty{' '}
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={soldOut}
            className="border-line bg-paper font-ui min-h-12 rounded-pill border px-3"
          >
            {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={soldOut}
          onClick={() => {
            add(
              {
                variantId: variant.id,
                productId: product.id,
                productName: product.name,
                productSlug: product.slug,
                regionSlug: product.region_slug,
                regionName: product.region_name,
                variantLabel: variant.label,
                unitPriceCents: variant.price_cents,
                imagePath: product.primary_image_path,
              },
              quantity,
            );
            setAdded(true);
          }}
          className="bg-brand text-on-brand font-ui min-h-14 flex-1 rounded-pill px-5 text-[15px] font-medium disabled:opacity-50"
        >
          Add to bag
        </button>
      </div>
      {added ? (
        <p className="text-positive text-sm" role="status">
          Added.{' '}
          <Link href="/cart" className="underline">
            View bag
          </Link>
        </p>
      ) : null}
    </div>
  );
}
