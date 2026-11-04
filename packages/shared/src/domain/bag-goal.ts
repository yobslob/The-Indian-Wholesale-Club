import { bulkProgress } from './checkout';

/**
 * The one goal a bag is working towards (founder, 2026-10-24: "two bars … they should only focus on one"): the pill,
 * the bag's summary and the app show this one bar and line. D-187: one free-shipping line for every bag.
 * - `free-gap`: under the free-shipping line ($49.99).
 * - `free`: from it up. The free part stays full and the bulk saving (D-119, from $99.99) fills a second part after it
 *   (founder 2026-10-30: "instead let it keep it and extend the pill"), never the same bar from the start.
 */
export type BagGoal =
  | { kind: 'none' }
  | { kind: 'free-gap'; leftCents: number; share: number }
  | { kind: 'free'; share: 1; bulk: ReturnType<typeof bulkProgress> };

export function bagGoal({
  subtotalCents,
  freeMinCents,
  bulk,
}: {
  subtotalCents: number;
  freeMinCents: number | null;
  /** bulkProgress() at the bag's goods and `bulk_saving_from_cents`. */
  bulk: ReturnType<typeof bulkProgress>;
}): BagGoal {
  if (freeMinCents === null || freeMinCents <= 0) return { kind: 'none' };
  if (subtotalCents >= freeMinCents) return { kind: 'free', share: 1, bulk };
  return {
    kind: 'free-gap',
    leftCents: Math.max(freeMinCents - subtotalCents, 0),
    share: Math.min(subtotalCents / freeMinCents, 1),
  };
}
