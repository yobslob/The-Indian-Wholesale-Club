'use client';

import Link from 'next/link';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

import { flyToBag } from '@/features/cart/fly-to-bag';
import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { useCart } from '@/features/cart/store';
import { mediaUrl } from '@/lib/site';

import { bagLine } from './card-options';
import { OptionRibbon, OptionSheet, ribbonWidth } from './option-picker';

import type { CardOption, ProductCard, QuickAdd as QuickAddData } from '@repo/db/store';

/** On the card's photo, bottom right (D-080): a round + so the name keeps the card's full width. */
const spot = 'font-ui absolute bottom-2.5 right-2.5 z-[2]';
// Hover turns the + a quarter and lifts the button; once added it fills with the brand colour and a ring ripples out (D-116).
const round = `${spot} quick-add grid size-11 place-items-center rounded-full border border-line bg-paper text-black shadow-sm hover:border-ink`;
const pillButton = 'grid h-11 w-11 place-items-center rounded-full text-[18px] leading-none hover:bg-surface';

function Icon({ d }: { d: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const PLUS = 'M12 5v14M5 12h14';

const noop = (): (() => void) => () => undefined;
/** True once the page is hydrated: the bag lives on the device, so the server draws every card empty. */
const useHydrated = (): boolean => useSyncExternalStore(noop, () => true, () => false);

/**
 * A card's + (D-080), since D-140 (plan F8, F9): tap anywhere else on the card for the product page. A piece with one
 * choice is added at once and flies to the bag; one with sizes, packs or flavours opens the ribbon on the photo (or a
 * bottom sheet for many options or a narrow card) to pick one there. Once it is in the bag the + becomes − n +: n is
 * every size of it in the bag; with one size there − and + change it (− at 1 takes it out), with several they open the
 * sheet with each size's own count. All instant: the bag is on the device (rule 0.1). Prices are for display only:
 * checkout re-prices and re-checks stock on the server.
 */
export function QuickAdd({
  product,
  quickAdd,
  options: given,
  available,
  href,
}: {
  product: Pick<ProductCard, 'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path' | 'product_type'>;
  quickAdd: QuickAddData | null | undefined;
  options?: CardOption[] | null;
  available: number | undefined;
  href: string;
}): React.JSX.Element {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const [open, setOpen] = useState<false | 'ribbon' | 'sheet'>(false);
  const [refused, setRefused] = useState(false);
  const self = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // older cached cards carry only quick_add (one choice)
  const options: CardOption[] =
    given ?? (quickAdd ? [{ id: quickAdd.variant_id, label: quickAdd.label, options: {}, price_cents: quickAdd.price_cents, available: available ?? 1 }] : []);
  const inBag = hydrated ? lines.filter((l) => l.productId === product.id) : [];
  const count = inBag.reduce((n, l) => n + l.quantity, 0);
  const counts = new Map(inBag.map((l) => [l.variantId, l.quantity]));
  const image = product.primary_image_path ? mediaUrl(product.primary_image_path) : null;

  const put = (o: CardOption, next: number, from: HTMLElement | null): void => {
    const now = counts.get(o.id) ?? 0;
    if (next > now) {
      if (next > Math.min(o.available, MAX_QTY_PER_LINE)) {
        // L9: say why + did nothing, once
        setRefused(true);
        setTimeout(() => setRefused(false), 1600);
        return;
      }
      add(bagLine(product, o), next - now);
      flyToBag(from, image);
    } else setQuantity(o.id, next);
  };
  const narrow = (): boolean => (self.current?.closest('article')?.clientWidth ?? 999) < 160;
  const choose = (): void => setOpen(ribbonWidth(options) > 8 || narrow() ? 'sheet' : 'ribbon');

  const picker =
    open === 'ribbon' ? (
      <OptionRibbon
        product={product}
        options={options}
        onClose={close}
        onPick={(o, from) => {
          put(o, (counts.get(o.id) ?? 0) + 1, from);
          setOpen(false);
        }}
      />
    ) : open === 'sheet' ? (
      <OptionSheet product={product} options={options} counts={counts} onChange={(o, n, from) => put(o, n, from)} onClose={close} />
    ) : null;

  const soldOut = available === 0 || (options.length > 0 && options.every((o) => o.available <= 0));
  if (soldOut && count === 0) {
    return <span className={`${spot} bg-paper text-ink-muted rounded-pill px-3 py-1.5 text-xs font-medium`}>Sold out</span>;
  }
  if (options.length === 0) {
    // no options known (an old cached card): choose on the product page
    return (
      <Link href={href} className={round} aria-label={`Choose options for ${product.name}`}>
        <Icon d={PLUS} />
      </Link>
    );
  }

  if (count > 0) {
    const one = inBag.length === 1 ? options.find((o) => o.id === inBag[0]!.variantId) : undefined;
    return (
      <div ref={self}>
        <div
          data-card-plus=""
          className={`${spot} bg-paper border-line font-ui rise-in flex items-center rounded-full border shadow-sm ${refused ? 'card-refused' : ''}`}
          role="group"
          aria-label={`${product.name}: ${count} in your bag`}
        >
          <button
            type="button"
            className={pillButton}
            aria-label={one ? `One less ${product.name}` : `Change the sizes of ${product.name} in your bag`}
            onClick={(e) => (one ? put(one, (counts.get(one.id) ?? 0) - 1, e.currentTarget) : setOpen('sheet'))}
          >
            −
          </button>
          <span className="min-w-5 text-center text-[14px] font-bold" aria-live="polite">
            {count}
          </span>
          <button
            type="button"
            className={pillButton}
            aria-label={one && options.length === 1 ? `One more ${product.name}` : `Add another size of ${product.name}`}
            onClick={(e) => (one && options.length === 1 ? put(one, (counts.get(one.id) ?? 0) + 1, e.currentTarget) : one ? choose() : setOpen('sheet'))}
          >
            +
          </button>
        </div>
        {refused ? (
          <span role="status" className="font-ui bg-ink text-paper absolute bottom-16 right-2.5 z-[3] rounded-full px-2.5 py-1 text-[12px]">
            Only {options.find((o) => counts.has(o.id))?.available ?? ''} left
          </span>
        ) : null}
        {picker}
      </div>
    );
  }

  return (
    <div ref={self}>
      <button
        type="button"
        data-card-plus=""
        className={round}
        aria-expanded={open ? true : undefined}
        aria-label={options.length === 1 ? `Add ${product.name} to your bag` : `Choose ${product.product_type === 'clothing' ? 'a size' : 'one'} of ${product.name}`}
        onClick={(e) => {
          if (open) return setOpen(false);
          if (options.length === 1) return put(options[0]!, 1, e.currentTarget);
          choose();
        }}
      >
        <Icon d={PLUS} />
      </button>
      {picker}
    </div>
  );
}
