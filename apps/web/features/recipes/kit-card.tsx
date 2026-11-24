'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { formatUsd, kitPiecesToAdd, kitTotal, productPath } from '@repo/shared/domain';

import { flyToBag } from '@/features/cart/fly-to-bag';
import { MAX_QTY_PER_LINE } from '@/features/cart/limits';
import { cartSubtotalCents, useCart } from '@/features/cart/store';
import { StorePhoto } from '@/features/catalog/store-photo';
import { Money, useMoney } from '@/features/shell/market';
import { mediaUrl } from '@/lib/site';

import type { RecipeIwcLine } from '@repo/db/store';

const noop = (): (() => void) => () => undefined;
const useHydrated = (): boolean =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

type Piece = RecipeIwcLine & { variantId: string | null; priceCents: number | null };

/**
 * The kit from IWC (D-203, plan §4.3): every piece starts ticked (answer 6); untick what's already in the kitchen. Dry
 * swaps for fresh things (D-204) follow, unticked. A
 * piece already in the bag shows the card's − n + instead (D-140) and is never added twice. The total and its struck
 * figure (food's factor, every kit: answer 5) are what Add puts in the bag. Prices are for display: checkout re-prices
 * every line on the server (D-038). A sticky bar stands in for the card while it is off the screen (phones).
 */
export function KitCard({
  name,
  lines,
  days,
  freeMinCents,
}: {
  name: string;
  lines: RecipeIwcLine[];
  days: string | null;
  freeMinCents: number | null;
}): React.JSX.Element {
  const hydrated = useHydrated();
  const money = useMoney();
  // D-208: each piece at its price in the visitor's country (the US: as the page has it), so the total and Add follow
  const pieces: Piece[] = lines.map((l) => {
    const local = l.variant_id && l.price_cents !== null ? money.cents(l.price_cents, { variant: l.variant_id }) : null;
    return { ...l, variantId: l.variant_id, priceCents: local ?? l.price_cents };
  });
  // D-204: a swap starts unticked: it stands in for something fresh the customer may have
  const [ticked, setTicked] = useState(
    () =>
      new Set(
        pieces.filter((p) => p.available && p.variantId && !p.instead_of).map((p) => p.variantId!),
      ),
  );
  const [added, setAdded] = useState(false);
  const bag = useCart(useShallow((s) => s.lines));
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const card = useRef<HTMLElement>(null);
  const [barShown, setBarShown] = useState(false);

  const shownBag = hydrated ? bag : [];
  const held = new Map(shownBag.map((l) => [l.variantId, l.quantity]));
  const inBag = new Set(held.keys());
  const toAdd = kitPiecesToAdd(pieces, ticked, inBag);
  const total = kitTotal(toAdd);
  // abroad the total waits for every ticked piece's own price (hidden until then); `cents` is already that sum
  const kitOf = money.market === 'us' ? undefined : { variants: toAdd.flatMap((p) => (p.variantId ? [p.variantId] : [])) };
  const gap =
    freeMinCents === null ? null : freeMinCents - cartSubtotalCents(shownBag) - total.cents;

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) =>
      setBarShown(e ? !e.isIntersecting && e.boundingClientRect.top > 0 : false),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const addKit = (from: Element): void => {
    if (toAdd.length === 0) return;
    for (const p of toAdd) {
      add(
        {
          variantId: p.variantId,
          productId: p.product_id!,
          productName: p.product_name ?? p.label,
          productSlug: p.product_slug ?? '',
          regionSlug: p.region_slug,
          regionName: p.region_name,
          variantLabel: p.variant_label ?? '',
          unitPriceCents: p.priceCents,
          imagePath: p.image_path,
          productType: p.product_type ?? 'food',
        },
        1,
      );
    }
    const first = toAdd.find((p) => p.image_path);
    flyToBag(from, first?.image_path ? mediaUrl(first.image_path) : null);
    setAdded(true);
  };
  const toggle = (id: string): void =>
    setTicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addLabel =
    toAdd.length === 0
      ? 'Nothing ticked'
      : `Add ${toAdd.length} ${toAdd.length === 1 ? 'piece' : 'pieces'} to bag`;
  const Price = (): React.JSX.Element => (
    <>
      {total.cents > 0 ? (
        <s className="text-ink-muted mr-1.5 text-[0.85em] font-normal" aria-label="Was">
          <Money cents={total.cents} of={kitOf} wasOf="food" />
        </s>
      ) : null}
      <Money cents={total.cents} of={kitOf} />
    </>
  );

  return (
    <>
      <section
        ref={card}
        id="kit"
        aria-labelledby="kit-title"
        className="bg-surface rounded-lg p-[clamp(18px,2.4vw,32px)]"
      >
        <h2 id="kit-title" className="font-heading text-[22px] font-medium leading-tight">
          The kit from IWC
        </h2>
        <p className="text-ink-muted mt-1 text-sm">
          {days ? `${days[0]!.toUpperCase()}${days.slice(1)}. ` : ''}Untick what&rsquo;s already in
          your kitchen.
        </p>
        <ul className="divide-line mt-3 divide-y">
          {[...pieces.filter((p) => !p.instead_of), ...pieces.filter((p) => p.instead_of)].map(
            (p, i, all) => {
              const id = p.variantId;
              const n = id ? held.get(id) : undefined;
              const href = p.product_slug ? productPath(p.region_slug, p.product_slug) : null;
              const firstSwap = p.instead_of && !all[i - 1]?.instead_of;
              return (
                <li
                  key={`${id ?? 'x'}-${i}`}
                  data-swap={p.instead_of ? '' : undefined}
                  className={`grid grid-cols-[44px_52px_1fr_auto] items-center gap-3 py-3 ${p.available ? '' : 'opacity-60'}`}
                >
                  {id && n ? (
                    <span
                      className="font-ui flex flex-col items-center text-[13px] font-semibold"
                      aria-label={`${p.label}: ${n} in your bag`}
                    >
                      <button
                        type="button"
                        className="size-7 rounded-full border"
                        aria-label={`One more ${p.label}`}
                        disabled={n >= MAX_QTY_PER_LINE}
                        onClick={() => setQuantity(id, n + 1)}
                      >
                        +
                      </button>
                      <span aria-live="polite">{n}</span>
                      <button
                        type="button"
                        className="size-7 rounded-full border"
                        aria-label={`One less ${p.label}`}
                        onClick={() => setQuantity(id, n - 1)}
                      >
                        −
                      </button>
                    </span>
                  ) : (
                    <label className="flex size-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        className="accent-brand size-5"
                        checked={!!id && p.available && ticked.has(id)}
                        disabled={!id || !p.available}
                        onChange={() => id && toggle(id)}
                        aria-label={`${p.label} in the kit`}
                      />
                    </label>
                  )}
                  <span className="bg-land relative block size-[52px] overflow-hidden rounded-md">
                    {p.image_path ? (
                      <StorePhoto
                        src={mediaUrl(p.image_path)}
                        alt=""
                        sizes="52px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    {firstSwap ? (
                      <span className="text-ink-muted font-ui block text-[12px] font-semibold uppercase tracking-wide">
                        No fresh ones at hand?
                      </span>
                    ) : null}
                    <span className="block truncate text-[15px] font-semibold">
                      {href && p.available ? (
                        <Link href={href} className="hover:underline">
                          {p.product_name ?? p.label}
                        </Link>
                      ) : (
                        p.label
                      )}
                    </span>
                    <span className="text-ink-muted block text-[13px]">
                      {p.available
                        ? [
                            p.instead_of ? `in place of ${p.instead_of.toLowerCase()}` : null,
                            p.net_qty ?? p.variant_label,
                            p.amount ? `uses ${p.amount}` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : 'Not available right now'}
                    </span>
                    {p.available && (p.option_count ?? 0) > 1 && href ? (
                      <Link
                        href={href}
                        className="text-ink-muted text-[13px] underline underline-offset-2"
                      >
                        Other packs
                      </Link>
                    ) : null}
                  </span>
                  <span className="font-ui text-[15px] font-semibold">
                    {p.available && p.priceCents !== null ? <Money cents={p.priceCents} of={p.variantId ? { variant: p.variantId } : undefined} /> : null}
                  </span>
                </li>
              );
            },
          )}
        </ul>
        <div className="border-line mt-2 flex items-baseline justify-between border-t pt-3">
          <span className="text-ink-muted text-sm">
            {total.count} {total.count === 1 ? 'piece' : 'pieces'}
          </span>
          <span className="font-ui text-[20px] font-semibold" data-testid="kit-total">
            <Price />
          </span>
        </div>
        {gap !== null && total.cents > 0 ? (
          <p className="text-ink-muted mt-1 text-right text-[13px]">
            {gap > 0
              ? `${formatUsd(gap)} more and delivery is free.`
              : 'Delivery is free on this bag.'}
          </p>
        ) : null}
        {added && toAdd.length === 0 ? (
          <p role="status" className="mt-3 flex items-center justify-between gap-3 font-semibold">
            In your bag. Happy cooking.
            <Link
              href="/cart"
              className="bg-ink text-paper font-ui rounded-pill px-4 py-2 text-[14px] font-medium"
            >
              View bag
            </Link>
          </p>
        ) : (
          <button
            type="button"
            disabled={toAdd.length === 0}
            onClick={(e) => addKit(e.currentTarget)}
            className="bg-brand text-on-brand font-ui press rounded-pill mt-3 h-12 w-full text-[16px] font-medium disabled:opacity-50"
          >
            {addLabel}
          </button>
        )}
      </section>
      <div
        aria-hidden={!barShown}
        inert={!barShown}
        className={`bg-canvas border-line fixed inset-x-0 bottom-0 z-[45] flex items-center gap-3 border-t px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 transition-transform duration-300 md:hidden ${
          barShown ? 'translate-y-0' : 'translate-y-[105%]'
        }`}
      >
        <div className="font-ui min-w-0 flex-1">
          <b className="block truncate text-sm font-semibold">
            {name} kit · {total.count} {total.count === 1 ? 'piece' : 'pieces'}
          </b>
          <span className="block text-[13px]">
            <Price />
          </span>
        </div>
        <button
          type="button"
          disabled={toAdd.length === 0}
          onClick={(e) => addKit(e.currentTarget)}
          className="bg-brand text-on-brand font-ui press rounded-pill h-12 w-[150px] flex-none text-[15px] font-medium disabled:opacity-50"
        >
          {toAdd.length === 0 && added ? '✓ Added' : 'Add to bag'}
        </button>
      </div>
    </>
  );
}
