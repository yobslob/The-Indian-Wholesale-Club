import { dayDate, type BagShipmentFacts } from './bag-shipments';
import { bagChargesAt, bulkProgress } from './checkout';

/**
 * The one goal a bag is working towards (founder, 2026-10-24: "two bars … they should only focus on one"): the pill,
 * the bag's summary and the app show this one bar and line, never two. In order:
 * - `quick-gap`: only 7-day pieces, under the 7-day line ($49.99): the nearest goal is free 7-day delivery.
 * - `quick-free`: only 7-day pieces at the 7-day line: Shipping is already struck through and free (as checkout says),
 *   so the bar is full; the next goal ($99.99) is not pushed on top of it.
 * - `free-gap`: any other bag under the free-shipping line ($99.99).
 * - `free`: from the free-shipping line up. The free part stays full and the bulk saving (D-119) fills a second part
 *   after it (founder 2026-10-30: "instead let it keep it and extend the pill"), never the same bar from the start.
 * The "Add $12.40 of 7-day pieces and they arrive by …" line of a mixed bag stays in its shipment's heading (D-154),
 * as words, not a second bar.
 * Founder 2026-10-30 ("now only the 7 day items exist but the bag was still showing 99"): the goal follows the bag as it
 * is now. `facts` are the answer for this very bag; while the next answer is on its way they are null and `known`
 * says which pieces are 7-day (each line's own word when it was added, or an earlier answer) and the 7-day line.
 */
export type BagGoal =
  | { kind: 'none' }
  | { kind: 'quick-gap'; leftCents: number; share: number }
  | { kind: 'quick-free'; share: 1; arrivesBy: string | null; arrivesByDay: string | null }
  | { kind: 'free-gap'; leftCents: number; share: number }
  | { kind: 'free'; share: 1; bulk: ReturnType<typeof bulkProgress> };

/** What is known of a bag before its own answer comes: its 7-day options, the 7-day line and the 7-day day. */
export interface BagGoalKnown {
  quickIds: readonly string[];
  quickMinCents: number | null;
  quickTo: string | null;
}

export function bagGoal({
  subtotalCents,
  freeMinCents,
  at,
  bulk,
  facts,
  variantIds,
  known,
}: {
  subtotalCents: number;
  freeMinCents: number | null;
  at: ReturnType<typeof bagChargesAt>;
  bulk: ReturnType<typeof bulkProgress>;
  /** The charges answer for this bag; null while it is on its way (then `known` speaks). */
  facts: BagShipmentFacts | null;
  /** The bag's options, to tell a bag of only 7-day pieces. */
  variantIds: string[];
  known?: BagGoalKnown | null;
}): BagGoal {
  if (freeMinCents === null || freeMinCents <= 0) return { kind: 'none' };
  if (subtotalCents >= freeMinCents) return { kind: 'free', share: 1, bulk };
  const quick = new Set(facts ? facts.quickIds : (known?.quickIds ?? []));
  const onlyQuick = variantIds.length > 0 && variantIds.every((id) => quick.has(id));
  const minCents = facts ? facts.minCents : (known?.quickMinCents ?? null);
  const quickCents = facts ? facts.quickCents : subtotalCents;
  const quickFree = facts ? at.shippingFree : onlyQuick && minCents !== null && quickCents >= minCents;
  if (quickFree) {
    const day = facts ? facts.dates.quickTo : (known?.quickTo ?? null);
    // arrivesByDay: the calendar day itself, for "home by Saturday" (D-161)
    return { kind: 'quick-free', share: 1, arrivesBy: day ? dayDate(day) : null, arrivesByDay: day };
  }
  const gapCents = facts ? facts.gapCents : minCents !== null ? Math.max(minCents - quickCents, 0) : null;
  if (onlyQuick && minCents && gapCents !== null && gapCents > 0) {
    return { kind: 'quick-gap', leftCents: gapCents, share: Math.min(quickCents / minCents, 1) };
  }
  return {
    kind: 'free-gap',
    leftCents: Math.max(freeMinCents - subtotalCents, 0),
    share: Math.min(subtotalCents / freeMinCents, 1),
  };
}
