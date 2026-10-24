import { dayDate, type BagShipmentFacts } from './bag-shipments';
import { bagChargesAt, bulkProgress } from './checkout';

/**
 * The one goal a bag is working towards (founder, 2026-10-24: "two bars … they should only focus on one"): the pill,
 * the bag's summary and the app show this one bar and line, never two. In order:
 * - `quick-gap`: only 7-day pieces, under the 7-day line ($49.99): the nearest goal is free 7-day delivery.
 * - `quick-free`: only 7-day pieces at the 7-day line: Shipping is already struck through and free (as checkout says),
 *   so the bar is full; the next goal ($99.99) is not pushed on top of it.
 * - `free-gap`: any other bag under the free-shipping line ($99.99).
 * - `free`: from the free-shipping line up; `bulk` then fills with the bulk saving (D-119).
 * The "Add $12.40 of 7-day pieces and they arrive by …" line of a mixed bag stays in its shipment's heading (D-154),
 * as words, not a second bar.
 */
export type BagGoal =
  | { kind: 'none' }
  | { kind: 'quick-gap'; leftCents: number; share: number }
  | { kind: 'quick-free'; share: 1; arrivesBy: string | null }
  | { kind: 'free-gap'; leftCents: number; share: number }
  | { kind: 'free'; share: number; bulk: ReturnType<typeof bulkProgress> };

export function bagGoal({
  subtotalCents,
  freeMinCents,
  at,
  bulk,
  facts,
  variantIds,
}: {
  subtotalCents: number;
  freeMinCents: number | null;
  at: ReturnType<typeof bagChargesAt>;
  bulk: ReturnType<typeof bulkProgress>;
  facts: BagShipmentFacts | null;
  /** The bag's options, to tell a bag of only 7-day pieces. */
  variantIds: string[];
}): BagGoal {
  if (freeMinCents === null || freeMinCents <= 0) return { kind: 'none' };
  if (subtotalCents >= freeMinCents) {
    // the bar refills with the bulk saving once there is one; until then it stays full
    const share = bulk.capCents > 0 && bulk.savingCents > 0 ? bulk.share : 1;
    return { kind: 'free', share, bulk };
  }
  if (at.shippingFree) {
    return { kind: 'quick-free', share: 1, arrivesBy: facts?.dates.quickTo ? dayDate(facts.dates.quickTo) : null };
  }
  const quick = new Set(facts?.quickIds ?? []);
  const onlyQuick = variantIds.length > 0 && variantIds.every((id) => quick.has(id));
  if (onlyQuick && facts?.minCents && facts.gapCents !== null && facts.gapCents > 0) {
    return { kind: 'quick-gap', leftCents: facts.gapCents, share: Math.min(facts.quickCents / facts.minCents, 1) };
  }
  return {
    kind: 'free-gap',
    leftCents: Math.max(freeMinCents - subtotalCents, 0),
    share: Math.min(subtotalCents / freeMinCents, 1),
  };
}
