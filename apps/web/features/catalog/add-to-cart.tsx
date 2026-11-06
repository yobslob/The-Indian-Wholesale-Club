'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { displayOption, displayTitle, formatUsd, optionAxes, optionPriceLabel, priceRange, selectionOf, wasCents } from '@repo/shared/domain';

import { flyToBag } from '@/features/cart/fly-to-bag';
import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { useCart } from '@/features/cart/store';
import { mediaUrl } from '@/lib/site';

import { BuyBar } from './buy-bar';
import { OptionRows } from './option-rows';

import type { Product, Variant } from '@repo/db/store';

interface Props {
  product: Pick<
    Product,
    'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path' | 'product_type' | 'offer'
  >;
  variants: Variant[];
  /** Shown just above the button (the delivery window, D-008). */
  delivery?: React.ReactNode;
}

const stepButton = 'grid size-11 place-items-center text-lg font-medium disabled:cursor-default disabled:text-line';

/**
 * Variant picker + availability as the cached page was built (§10 Y-3: checkout checks the stock) + add to bag, with the phone buy bar standing in for the button whenever it is
 * off the screen (D-082; launch QA B-2: also before it has scrolled into view). Colour and size
 * get a row each when the variants carry them (`optionAxes`); otherwise one button per variant (option-rows.tsx).
 * D-140 (L3): no size (or option) is chosen until the customer taps one, so a quick Add never buys the smallest size:
 * until then the button says "Choose a size" and takes them to the sizes. A colour may start chosen. (F8) The chosen
 * option says how many of it are already in the bag.
 * Launch QA B-1: until a pick the price is "From $x" (the lowest in stock) when the options differ, so the price shown
 * is never one the bag then changes; after the pick it is that option's price, the one the bag line gets.
 */
export function AddToCart({ product, variants, delivery }: Props): React.JSX.Element {
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
  // The button says "Added" for a moment after each add, then is ready for the next one (D-116).
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
  const inStock = (v: Variant): boolean => v.available > 0;
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
  const price = optionPriceLabel(variants, picked ? variant : null);
  // D-190: follows the price shown, the picked option's or the lowest
  const was = product.offer
    ? wasCents(picked ? variant.price_cents : (priceRange(variants)?.fromCents ?? variant.price_cents), product.product_type)
    : null;

  const left = variant.available;
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
      <div className="font-ui flex items-baseline text-[22px] font-semibold leading-none">
        {was ? <s className="was">{formatUsd(was)}</s> : null}
        <p data-testid="product-price" className={was ? 'now m-0' : 'm-0'}>
          {price}
        </p>
      </div>
      {/* founder 2026-10-24: heavy cookware's other half, added in the bag and at checkout */}
      {variant.heavy_cents > 0 ? (
        <p className="font-ui -mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-paper border-line text-ink rounded-pill border px-2.5 py-1 text-xs font-semibold">Heavy-item shipping</span>
          <span className="text-ink-muted">+ {formatUsd(variant.heavy_cents)}, added at checkout</span>
        </p>
      ) : null}

      <div ref={choices} key={nudge} className={`scroll-mt-28 space-y-4 ${nudge ? 'choose-nudge' : ''}`}>
        <OptionRows
          variants={variants}
          axes={axes}
          selection={selection}
          variantId={variant.id}
          picked={picked}
          inStock={inStock}
          onSelect={select}
        />
      </div>

      <p className={`flex items-center gap-2 text-sm ${soldOut ? 'text-caution' : ''}`} aria-live="polite">
        <span aria-hidden="true" className={`size-2 rounded-full ${soldOut ? 'bg-caution' : 'bg-region live-dot'}`} />
        {soldOut ? 'Sold out' : !picked ? 'In stock' : left <= 3 ? `Only ${left} left` : 'In stock'}
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
              Added
            </span>
          </span>
        </button>
      </div>
      {added ? (
        <p className="rise-in text-positive m-0 text-sm" role="status">
          Added.{' '}
          <Link href="/cart" className="group text-ink inline-flex items-center gap-1 font-medium underline underline-offset-[3px]">
            View bag
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </p>
      ) : null}
      <BuyBar
        target={button}
        name={displayTitle(product.name)}
        detail={variants.length > 1 && picked ? `${price} · ${displayOption(variant.label)}` : price}
        action={mustChoose ? `Choose ${mustChoose}` : 'Add to bag'}
        disabled={soldOut}
        added={flash > 0}
        onAdd={addToBag}
      />
    </div>
  );
}
