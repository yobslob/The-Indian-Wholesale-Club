'use client';

import { useMoney } from './market';

/**
 * D-208: a product page's or a card's options with their prices (and Heavy-item shipping) in the visitor's country, so
 * everything worked out from them (the price label, "From", the struck price, the bag line) is that country's. The US,
 * and abroad an option whose price is still on its way, keep the page's figure; `ready` is false until all are in.
 */
export function useCountryVariants<T extends { id: string; price_cents: number; heavy_cents?: number }>(
  variants: readonly T[],
): { variants: T[]; ready: boolean } {
  const money = useMoney();
  if (money.market === 'us') return { variants: [...variants], ready: money.ready };
  let ready = money.ready;
  const out = variants.map((v) => {
    const price = money.cents(v.price_cents, { variant: v.id });
    const heavy = v.heavy_cents ? money.cents(v.heavy_cents, { variant: v.id, heavy: true }) : 0;
    if (price === null || heavy === null) {
      ready = false;
      return v;
    }
    return { ...v, price_cents: price, ...(v.heavy_cents !== undefined ? { heavy_cents: heavy } : {}) };
  });
  return { variants: out, ready };
}
