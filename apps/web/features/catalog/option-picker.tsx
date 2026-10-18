'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import { chipLabel, coloursOf, LOW_STOCK, showsPrices } from './card-options';

/** The most chips the ribbon shows at one step: the colours, then one colour's sizes. */
export function ribbonWidth(options: CardOption[]): number {
  const colours = coloursOf(options);
  if (colours.length === 0) return options.length;
  return Math.max(colours.length, ...colours.map((c) => options.filter((o) => o.options?.colour === c).length));
}

import type { CardOption, ProductCard } from '@repo/db/store';

type Product = Pick<ProductCard, 'id' | 'name' | 'product_type' | 'primary_image_path'>;

/** Arrow keys move between a group's chips (a roving focus, D-140). */
function onArrows(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const chips = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
  const i = chips.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  chips[(i + (e.key === 'ArrowRight' ? 1 : chips.length - 1)) % chips.length]?.focus();
}

/**
 * The size ribbon (D-140, plan F9): it unrolls from the + across the bottom of the photo like a measuring tape pulled
 * out, the chips arriving one after another; a piece in colours shows its colours first. Sold-out chips are struck
 * and cannot be tapped; a dot marks "only a few left". A tap adds that option and rolls the ribbon back. Escape, a tap
 * outside or the card leaving the screen closes it. Reduced motion: it simply appears (globals.css).
 */
export function OptionRibbon({
  product,
  options,
  onPick,
  onClose,
}: {
  product: Product;
  options: CardOption[];
  onPick: (o: CardOption, from: HTMLElement) => void;
  onClose: () => void;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const colours = coloursOf(options);
  const [colour, setColour] = useState<string | null>(colours.length ? null : '');
  const prices = showsPrices(options, product.product_type);
  const shown = colour === null ? [] : options.filter((o) => !colour || o.options?.colour === colour);

  useEffect(() => {
    const el = ref.current;
    el?.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus({ preventScroll: true });
    const outside = (e: PointerEvent): void => {
      if (el && !el.contains(e.target as Node) && !(e.target as Element).closest?.('[data-card-plus]')) onClose();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    const card = el?.closest('article');
    const seen = new IntersectionObserver(([entry]) => {
      if (entry && entry.intersectionRatio < 0.4) onClose();
    }, { threshold: [0, 0.4] });
    if (card) seen.observe(card);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      seen.disconnect();
    };
  }, [onClose]);

  const chip = 'card-chip font-ui inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 text-[13px] font-semibold md:min-h-10 md:min-w-10';
  return (
    <div ref={ref} role="dialog" aria-label={`Choose for ${product.name}`} className="card-ribbon absolute inset-x-1.5 bottom-1.5 z-[3] rounded-[16px] p-2">
      {colour === null ? (
        <div role="group" aria-label="Colour" className="flex flex-wrap gap-1.5" onKeyDown={onArrows}>
          {colours.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`${chip} border-line bg-paper text-ink`}
              style={{ animationDelay: `${i * 28}ms` }}
              onClick={(e) => {
                // a colour with one option (a saree, a shawl) is the choice itself
                const only = options.filter((o) => o.options?.colour === c);
                if (only.length === 1 && only[0]!.available > 0) onPick(only[0]!, e.currentTarget);
                else setColour(c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <div role="group" aria-label={product.product_type === 'clothing' ? 'Size' : 'Choose one'} className="flex flex-wrap gap-1.5" onKeyDown={onArrows}>
          {shown.map((o, i) => {
            const out = o.available <= 0;
            const low = !out && o.available <= LOW_STOCK;
            return (
              <button
                key={o.id}
                type="button"
                disabled={out}
                aria-label={`${chipLabel(o, product.product_type, prices)}${out ? ', sold out' : low ? `, only ${o.available} left` : ''}`}
                className={`${chip} relative ${out ? 'border-line text-ink-muted line-through opacity-60' : 'border-line bg-paper text-ink hover:border-ink'}`}
                style={{ animationDelay: `${i * 28}ms` }}
                onClick={(e) => onPick(o, e.currentTarget)}
              >
                {chipLabel(o, product.product_type, prices)}
                {low ? <i aria-hidden="true" className="bg-caution absolute right-1 top-1 h-1.5 w-1.5 rounded-full" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The bottom sheet (D-140, F8, F9): the same choices with the piece's photo and name, for a piece with many sizes, a
 * narrow card (phone rows) and a piece already in the bag in several sizes, each row with its own − n +.
 */
export function OptionSheet({
  product,
  options,
  counts,
  onChange,
  onClose,
}: {
  product: Product;
  options: CardOption[];
  counts: Map<string, number>;
  onChange: (o: CardOption, next: number, from: HTMLElement) => void;
  onClose: () => void;
}): React.JSX.Element {
  const close = useRef<HTMLButtonElement>(null);
  const prices = showsPrices(options, product.product_type) || product.product_type !== 'clothing';
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);

  const step = 'grid h-11 w-11 place-items-center rounded-full border border-line bg-paper text-[18px] disabled:opacity-40';
  // on the page itself: a card's grid drifts (transform), which would pin a fixed sheet to the card
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`Choose for ${product.name}`}>
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[rgb(20_17_15/0.4)]" />
      <div className="card-sheet bg-canvas absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[22px] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 md:inset-x-auto md:right-6 md:bottom-6 md:w-[380px] md:rounded-[22px]">
        <div className="mb-3 flex items-center gap-3">
          <span className="bg-land relative block h-16 w-12 flex-none overflow-hidden rounded-[10px]">
            {product.primary_image_path ? <Image src={mediaUrl(product.primary_image_path)} alt="" fill sizes="48px" className="object-cover" /> : null}
          </span>
          <b className="font-ui flex-1 text-[15px] leading-snug">{product.name}</b>
          <button ref={close} type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-[20px]">
            ×
          </button>
        </div>
        <ul className="divide-line divide-y">
          {options.map((o) => {
            const n = counts.get(o.id) ?? 0;
            const out = o.available <= 0;
            return (
              <li key={o.id} className="font-ui flex items-center gap-3 py-2.5">
                <span className={`flex-1 text-[14.5px] ${out ? 'text-ink-muted line-through' : ''}`}>
                  {o.label}
                  {prices ? <span className="text-ink-muted"> · {formatUsd(o.price_cents)}</span> : null}
                  {!out && o.available <= LOW_STOCK ? <small className="text-caution block text-[12px]">Only {o.available} left</small> : null}
                  {out ? <small className="block text-[12px] no-underline">Sold out</small> : null}
                </span>
                {n > 0 ? (
                  <button type="button" className={step} aria-label={`One less ${o.label}`} onClick={(e) => onChange(o, n - 1, e.currentTarget)}>
                    −
                  </button>
                ) : null}
                {n > 0 ? (
                  <span className="w-5 text-center font-semibold" aria-live="polite">
                    {n}
                  </span>
                ) : null}
                <button
                  type="button"
                  className={step}
                  disabled={out || n >= o.available}
                  aria-label={`Add ${o.label}`}
                  onClick={(e) => onChange(o, n + 1, e.currentTarget)}
                >
                  +
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
