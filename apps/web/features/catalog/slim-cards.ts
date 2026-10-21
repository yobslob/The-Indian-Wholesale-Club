import type { ProductCard } from '@repo/db/store';

/** A product card as store_* functions send it: its `options` is a list (a variant's own `options` is a record). */
const isCard = (v: Record<string, unknown>): boolean =>
  Array.isArray(v.options) && typeof v.slug === 'string' && typeof v.price_cents === 'number';

/**
 * D-145: every card in a cached store read keeps at most one option (a single-choice piece still adds at once); a
 * card with several keeps only how many and whether all are sold out, and its + reads them when pressed
 * (/api/card-options). The options were a fifth of a state page, sent twice (its HTML and its data), and Vercel's
 * page-cache writes are counted by size. Walks the whole result, so every card in it is slimmed wherever it sits.
 */
export function slimCards<T>(data: T): T {
  if (Array.isArray(data)) return data.map(slimCards) as T;
  if (!data || typeof data !== 'object') return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[k] = slimCards(v);
  if (!isCard(out)) return out as T;
  const options = out.options as NonNullable<ProductCard['options']>;
  if (options.length <= 1) return out as T;
  return { ...out, options: null, choices: options.length, sold_out: options.every((o) => o.available <= 0) } as T;
}
