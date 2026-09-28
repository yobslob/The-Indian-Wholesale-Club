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
}

/** Variant picker + live availability + add to bag (the only client island on the product page). */
export function AddToCart({ product, variants }: Props): React.JSX.Element {
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
      <p className="text-ink text-xl">{formatUsd(variant.price_cents)}</p>

      {variants.length > 1 ? (
        <fieldset>
          <legend className="text-ink mb-2 text-sm font-medium">Option</legend>
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
                className={`min-h-11 rounded-sm border px-3 text-sm ${
                  v.id === variantId ? 'border-ink bg-ink text-canvas' : 'border-line text-ink'
                } ${(available[v.id] ?? 0) <= 0 ? 'line-through opacity-60' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <p className={`text-sm ${soldOut ? 'text-caution' : 'text-ink-muted'}`} aria-live="polite">
        {soldOut ? 'Sold out' : left <= 3 ? `Only ${left} left` : 'In stock'}
      </p>

      <div className="flex items-center gap-3">
        <label className="text-ink text-sm">
          Qty{' '}
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={soldOut}
            className="border-line bg-canvas min-h-11 rounded-sm border px-2"
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
          className="bg-brand text-canvas min-h-11 flex-1 rounded-sm px-4 text-sm font-medium disabled:opacity-50"
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
