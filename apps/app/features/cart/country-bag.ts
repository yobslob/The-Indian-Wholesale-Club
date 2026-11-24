import { useEffect } from 'react';


import { useCountry } from '../shell/country';

import { useBag } from './store';

import { apiPost } from '@/lib/api';

/**
 * D-208: keeps the bag's prices the shopper's country's (a line added before a change of country is priced again, one
 * request for the bag), as the website's bag does. Checkout prices every line again on the server anyway (D-038).
 * Returns whether every line is priced for that country.
 */
export function useBagInCountry(): boolean {
  const { country } = useCountry();
  const lines = useBag((s) => s.lines);
  const stale = lines.filter((l) => (l.priceCountry ?? 'us') !== country).map((l) => l.variantId);
  const key = `${country}:${stale.sort().join(',')}`;
  useEffect(() => {
    if (stale.length === 0) return;
    let live = true;
    void apiPost<{ prices: null | { variants: Record<string, { price: number }> } }>('/api/country/prices', {
      country,
      variants: stale.slice(0, 200),
      products: [],
      recipes: [],
    }).then((res) => {
      if (!live || !res.ok || !res.data.prices) return;
      useBag.getState().reprice(country, Object.fromEntries(Object.entries(res.data.prices.variants).map(([id, v]) => [id, v.price])));
    });
    return () => {
      live = false;
    };
    // `key` stands for the country and the lines to price
  }, [key]);
  return stale.length === 0;
}
