'use client';

import { useEffect } from 'react';

import { piecePrices } from '@/features/shell/country-prices';
import { useMoney } from '@/features/shell/market';

import { useCart, type CartLine } from './store';

/** A line's price is for the visitor's country (lines from before D-208 are the US's). */
export const linePricedFor = (l: CartLine, market: string): boolean => (l.priceCountry ?? 'us') === market;

/**
 * D-208: keeps the bag's prices the visitor's country's: a line added on a page priced for another country, or a bag
 * carried over a change of country, is priced again (one request for the whole bag), so the bill, the free-delivery bar
 * and Checkout's first figures are that country's. Checkout prices every line again on the server anyway (D-038).
 * Mounted once in the store layout; draws nothing.
 */
export function CountryBag(): null {
  const { market } = useMoney();
  const lines = useCart((s) => s.lines);
  const stale = lines.filter((l) => !linePricedFor(l, market)).map((l) => l.variantId);
  const key = `${market}:${stale.sort().join(',')}`;
  useEffect(() => {
    if (stale.length === 0) return;
    let live = true;
    void piecePrices(market, stale)
      .then((prices) => {
        if (live && prices) useCart.getState().reprice(market, prices);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // `key` stands for the market and the lines to price
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
