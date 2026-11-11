'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  displayOption,
  displayTitle,
  initialLook,
  lookKey,
  lookPhoto,
  optionAxes,
  optionPriceLabel,
  priceRange,
  selectionOf,
} from '@repo/shared/domain';

import { flyToBag } from '@/features/cart/fly-to-bag';
import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { useCart } from '@/features/cart/store';
import { Money, useMoney } from '@/features/shell/market';
import { mediaUrl } from '@/lib/site';

import { BuyBar } from './buy-bar';
import { lookPhotosOn } from './look-flag';
import { GALLERY_MAIN_SIZES, useLook } from './look-store';
import { OptionRows } from './option-rows';
import { preloadPhoto } from './store-photo';

import type { Media, Product, Variant } from '@repo/db/store';

interface Props {
  product: Pick<
    Product,
    'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path' | 'product_type' | 'offer' | 'pack'
  >;
  variants: Variant[];
  /** The listing's photos: the bag line takes the picked look's (D-194). */
  media: Media[];
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
export function AddToCart({ product, variants, media, delivery }: Props): React.JSX.Element {
  // D-197: before any early return (rules of hooks)
  const money = useMoney();
  const add = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);
  const setLook = useLook((s) => s.setLook);
  const clearLook = useLook((s) => s.clearLook);
  const [variantId, setVariantId] = useState(() => {
    // D-194: the first choice matches the photo the page opens on
    const start = lookPhotosOn ? initialLook(variants, media) : null;
    const first = (v: Variant): boolean => v.available > 0 && (start === null || lookKey(v.options) === start);
    return variants.find(first)?.id ?? variants[0]?.id;
  });
  // the picked look ends with the visit to this page, like the picked option
  useEffect(() => () => clearLook(product.id), [clearLook, product.id]);
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
  const photoOf = (v: Variant): string | null => (lookPhotosOn ? lookPhoto(lookKey(v.options), media, variants) : null);
  const select = (id: string, axis?: string): void => {
    const next = variants.find((v) => v.id === id);
    // D-194: a size never changes the photos, unless choosing it had to move to another colour. Any other tap shows its
    // look, also the one chosen by default, which the page didn't open on.
    if (lookPhotosOn && next && (axis !== 'size' || lookKey(next.options) !== lookKey(variant.options))) {
      setLook(product.id, lookKey(next.options));
    }
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
  const price = optionPriceLabel(variants, picked ? variant : null, money.format);
  // D-190: follows the price shown, the picked option's or the lowest
  const was = product.offer ? (picked ? variant.price_cents : (priceRange(variants)?.fromCents ?? variant.price_cents)) : null;

  const left = variant.available;
  const soldOut = left <= 0;
  const maxQty = Math.max(1, Math.min(left, MAX_QTY_PER_LINE));
  const addToBag = (from: Element | null = button.current): void => {
    if (mustChoose) return showChoices();
    const photo = photoOf(variant) ?? product.primary_image_path;
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
        imagePath: photo,
        productType: product.product_type,
      },
      quantity,
    );
    setAdded(true);
    setFlash((n) => n + 1);
    flyToBag(from, photo ? mediaUrl(photo) : null);
  };

  return (
    <div className="space-y-4">
      <div className="font-ui flex items-baseline text-[22px] font-semibold leading-none">
        {was ? (
          <s className="was">
            <Money cents={was} wasOf={product.product_type} />
          </s>
        ) : null}
        {/* D-197: hidden until drawn in the visitor's dollars (.money) */}
        <p
          data-testid="product-price"
          data-m={money.ready ? money.market : undefined}
          className={was ? 'money now m-0' : 'money m-0'}
        >
          {price}
        </p>
        {/* D-191: its weight, like the cards; a piece with several packs says it on each */}
        {product.pack && variants.length === 1 ? (
          <span data-testid="product-pack" className="text-ink-muted ml-2.5 text-sm font-normal">
            {product.pack}
          </span>
        ) : null}
      </div>
      {/* founder 2026-10-24: heavy cookware's other half, added in the bag and at checkout */}
      {variant.heavy_cents > 0 ? (
        <p className="font-ui -mt-1 flex flex-wrap items-center gap-2 text-sm">
          <span className="bg-paper border-line text-ink rounded-pill border px-2.5 py-1 text-xs font-semibold">Heavy-item shipping</span>
          <span className="text-ink-muted">
            + <Money cents={variant.heavy_cents} />, added at checkout
          </span>
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
          onWarm={(id) => {
            const next = variants.find((v) => v.id === id);
            const photo = next && photoOf(next);
            if (photo) preloadPhoto(mediaUrl(photo), GALLERY_MAIN_SIZES);
          }}
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
