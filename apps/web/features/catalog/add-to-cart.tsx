'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { choose, formatUsd, isAvailable, optionAxes, selectionOf } from '@repo/shared/domain';

import { flyToBag } from '@/features/cart/fly-to-bag';
import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { useCart } from '@/features/cart/store';
import { mediaUrl } from '@/lib/site';

import { BuyBar } from './buy-bar';
import { useLiveAvailability } from './use-live-availability';

import type { Product, Variant } from '@repo/db/store';

interface Props {
  product: Pick<
    Product,
    'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path' | 'product_type'
  >;
  variants: Variant[];
  /** Shown just above the button (the delivery window, D-008). */
  delivery?: React.ReactNode;
}

const pillClass = (selected: boolean, out: boolean): string =>
  `font-ui bg-paper min-h-11 rounded-pill border px-4 text-sm font-medium ${
    selected ? 'border-ink shadow-[inset_0_0_0_1px_theme(colors.ink)]' : 'border-line'
  } ${out ? 'line-through opacity-60' : ''}`;
const stepButton = 'grid size-11 place-items-center text-lg font-medium disabled:cursor-default disabled:text-line';
const legendClass = 'font-ui text-ink-muted mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]';

/**
 * Variant picker + live availability + add to bag, with the phone buy bar standing in for the button once it has
 * scrolled away (D-082). Colour and size
 * get a row each when the variants carry them (`optionAxes`); otherwise one button per variant.
 * D-140 (L3): no size (or option) is chosen until the customer taps one, so a quick Add never buys the smallest size:
 * until then the button says "Choose a size" and takes them to the sizes. A colour may start chosen. (F8) The chosen
 * option says how many of it are already in the bag.
 */
export function AddToCart({ product, variants, delivery }: Props): React.JSX.Element {
  const initial = useMemo(
    () => Object.fromEntries(variants.map((v) => [v.id, v.available])),
    [variants],
  );
  const available = useLiveAvailability(product.id, initial);
  const add = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);
  const [variantId, setVariantId] = useState(
    () => variants.find((v) => v.available > 0)?.id ?? variants[0]?.id,
  );
  // L3: picked by the customer (a piece with one option needs no pick)
  const [picked, setPicked] = useState(variants.length <= 1);
  const [nudge, setNudge] = useState(0);
  const choices = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  // The button says "Packed" (D-161; "Added" until then) for a moment after each add, then is ready for the next one (D-116).
  const [flash, setFlash] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(0), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const axes = useMemo(() => optionAxes(variants), [variants]);
  const variant = variants.find((v) => v.id === variantId);
  if (!variant) return <p className="text-ink-muted text-sm">Not available right now.</p>;
  const inStock = (v: Variant): boolean => (available[v.id] ?? 0) > 0;
  const selection = selectionOf(variant, axes);
  const select = (id: string): void => {
    setVariantId(id);
    setPicked(true);
    setQuantity(1);
    setAdded(false);
  };
  const sizeAxis = axes.find((a) => a.key === 'size');
  // what a customer must still choose: the size when there is one, else the option
  const mustChoose = !picked ? (sizeAxis ? 'a size' : 'one') : null;
  const showChoices = (): void => {
    choices.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setNudge((n) => n + 1);
  };
  const inBagNow = mounted && picked ? (lines.find((l) => l.variantId === variant.id)?.quantity ?? 0) : 0;

  const left = available[variant.id] ?? 0;
  const soldOut = left <= 0;
  const maxQty = Math.max(1, Math.min(left, MAX_QTY_PER_LINE));
  const addToBag = (from: Element | null = button.current): void => {
    if (mustChoose) return showChoices();
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
        productType: product.product_type,
      },
      quantity,
    );
    setAdded(true);
    setFlash((n) => n + 1);
    flyToBag(from, product.primary_image_path ? mediaUrl(product.primary_image_path) : null);
  };

  return (
    <div className="space-y-4">
      <p className="font-ui text-[22px] font-semibold leading-none">{formatUsd(variant.price_cents)}</p>
      {/* founder 2026-10-24: heavy cookware's other half, added in the bag and at checkout */}
      {variant.heavy_cents > 0 ? (
        <p className="font-ui -mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-paper border-line text-ink rounded-pill border px-2.5 py-1 text-xs font-semibold">Heavy-item shipping</span>
          <span className="text-ink-muted">+ {formatUsd(variant.heavy_cents)}, added at checkout</span>
        </p>
      ) : null}

      <div ref={choices} key={nudge} className={`scroll-mt-28 space-y-4 ${nudge ? 'choose-nudge' : ''}`}>
      {axes.length > 0
        ? axes.map((axis) => {
            const open = !picked && axis.key === (sizeAxis ? 'size' : axis.key);
            return (
            <fieldset key={axis.key}>
              <legend className={legendClass}>
                {axis.label}:{' '}
                <span className={`normal-case tracking-normal ${open ? 'text-caution' : 'text-ink'}`}>{open ? 'choose one' : selection[axis.key]}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {axis.values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      const next = choose(variants, axes, selection, axis.key, value, inStock);
                      if (next) select(next.id);
                    }}
                    aria-pressed={!open && selection[axis.key] === value}
                    className={pillClass(
                      !open && selection[axis.key] === value,
                      !isAvailable(variants, axes, selection, axis.key, value, inStock),
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            );
          })
        : null}
      {axes.length === 0 && variants.length > 1 ? (
        <fieldset>
          <legend className={legendClass}>Option</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => select(v.id)}
                aria-pressed={picked && v.id === variantId}
                className={pillClass(picked && v.id === variantId, !inStock(v))}
              >
                {v.label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      </div>

      <p className={`flex items-center gap-2 text-sm ${soldOut ? 'text-caution' : ''}`} aria-live="polite">
        <span aria-hidden="true" className={`size-2 rounded-full ${soldOut ? 'bg-caution' : 'bg-region live-dot'}`} />
        {soldOut ? 'Sold out. Someone missed home faster than you.' : !picked ? 'In stock' : left <= 3 ? `Only ${left} left` : 'In stock'}
        {inBagNow > 0 ? <span className="text-ink-muted"> · {inBagNow} in your bag</span> : null}
      </p>

      {delivery ? <div className="bg-paper rounded-md px-4 py-3.5">{delivery}</div> : null}

      <div className="flex items-center gap-3">
        {/* The bag's − / + (D-086) instead of a dropdown: one tap per piece, the same control as in the bag (D-116). */}
        <div
          role="group"
          aria-label="Quantity"
          className={`border-line bg-paper font-ui inline-flex h-14 flex-none items-center rounded-pill border ${soldOut ? 'opacity-50' : ''}`}
        >
          <button type="button" className={stepButton} aria-label="One fewer" disabled={soldOut || quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
            −
          </button>
          <output className="min-w-[20px] text-center text-[15px] font-semibold tabular-nums" aria-live="polite">
            {quantity}
          </output>
          <button type="button" className={stepButton} aria-label="One more" disabled={soldOut || quantity >= maxQty} onClick={() => setQuantity((q) => q + 1)}>
            +
          </button>
        </div>
        <button
          type="button"
          disabled={soldOut}
          ref={button}
          onClick={() => addToBag()}
          className="bg-brand text-on-brand font-ui press relative min-h-14 flex-1 overflow-hidden rounded-pill px-5 text-[15px] font-medium disabled:opacity-50"
        >
          <span className={`block transition-[transform,opacity] duration-300 ${flash ? '-translate-y-6 opacity-0' : ''}`}>
            {mustChoose ? `Choose ${mustChoose}` : 'Add to bag'}
          </span>
          <span
            aria-hidden="true"
            className={`absolute inset-0 grid place-items-center transition-[transform,opacity] duration-300 ${flash ? '' : 'translate-y-6 opacity-0'}`}
          >
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" className="draw-check" />
              </svg>
              Packed
            </span>
          </span>
        </button>
      </div>
      {added ? (
        <p className="rise-in text-positive m-0 text-sm" role="status">
          Packed for home.{' '}
          <Link href="/cart" className="group text-ink inline-flex items-center gap-1 font-medium underline underline-offset-[3px]">
            View bag
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </p>
      ) : null}
      <BuyBar
        target={button}
        name={product.name}
        detail={variants.length > 1 && picked ? `${formatUsd(variant.price_cents)} · ${variant.label}` : formatUsd(variant.price_cents)}
        disabled={soldOut}
        added={flash > 0}
        onAdd={addToBag}
      />
    </div>
  );
}
