import { formatUsd } from './checkout';

/**
 * The price a product shows before and after an option is picked (launch QA B-1): the page showed the first in-stock
 * option's price ($17.31) and the bag then held the picked option's ($16.30). Before a pick: "From $16.30", the lowest
 * price among the options in stock, when they differ; their one price when they don't. After a pick: that option's
 * price. The same rule on the product page, the phone buy bar, cards and the card's option sheet. Display only:
 * prices themselves are never changed here (CLAUDE.md rule 5). Integer cents in, words out.
 */
export interface PricedOption {
  price_cents: number;
  available: number;
}

/**
 * The lowest price among the options in stock (all options when none is) and whether those options differ in price.
 * Null for no options.
 */
export function priceRange(options: readonly PricedOption[]): { fromCents: number; varies: boolean } | null {
  if (options.length === 0) return null;
  const inStock = options.filter((o) => o.available > 0);
  const prices = (inStock.length > 0 ? inStock : options).map((o) => o.price_cents);
  return { fromCents: Math.min(...prices), varies: new Set(prices).size > 1 };
}

/** "From $16.30" when the options differ in price, else "$16.30"; `fmt`: the visitor's currency (D-197). */
export const fromLabel = (cents: number, varies: boolean, fmt: (cents: number) => string = formatUsd): string =>
  varies ? `From ${fmt(cents)}` : fmt(cents);

/** The label for a product's options: the picked option's price once there is one, else `fromLabel` of the range. */
export function optionPriceLabel(
  options: readonly PricedOption[],
  picked?: Pick<PricedOption, 'price_cents'> | null,
  fmt: (cents: number) => string = formatUsd,
): string {
  if (picked) return fmt(picked.price_cents);
  const range = priceRange(options);
  return range ? fromLabel(range.fromCents, range.varies, fmt) : '';
}
