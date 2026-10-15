import { formatGrams, unusualWeight } from '../../domain/weight';

import type { ProductType } from '../../domain/product-types';
import type { ReferenceItem } from './plan';
import type { ModelGuess } from './prompt';

/**
 * D-131: from the model's guess, its second look and the known weights most like the listing, one weight per group,
 * and whether it is sure enough to price on. A sure estimate needs: the model's own range within ±25%, its second look
 * within 30%, the close known items (when there are some) within 25%, not below a food's stated net weight, and not
 * far from its category's usual weight. Anything else stays a suggestion for an admin.
 */

/** Two items this alike (cosine of their embeddings) are the same kind of thing. Tuned with `pnpm weights eval`. */
export const CLOSE = 0.8;
/** Near-identical: the same piece in another colour, listed apart. Three of these agreeing need no model. */
export const TWIN = 0.93;

const TRUST = { weighed: 3, admin: 2, shop: 1 } as const;

export interface Neighbour {
  item: ReferenceItem;
  sim: number;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** The k known items most like a query, most alike first (same product type; a pack only with a pack). */
export function nearest(
  query: ArrayLike<number>,
  items: { item: ReferenceItem; vector: ArrayLike<number> }[],
  filter: { type: ProductType; pack: boolean; exclude?: string },
  k = 6,
): Neighbour[] {
  return items
    .filter(
      ({ item }) =>
        item.type === filter.type &&
        !!item.pack === filter.pack &&
        item.productId !== filter.exclude,
    )
    .map(({ item, vector }) => ({ item, sim: cosine(query, vector) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, k);
}

/** The middle of the close items' weights, the more alike and the better measured counting more; none under two. */
export function neighbourWeight(neighbours: Neighbour[]): { grams: number; count: number } | null {
  const close = neighbours.filter((n) => n.sim >= CLOSE);
  if (close.length < 2) return null;
  const weighted = close
    .map((n) => ({ grams: n.item.grams, w: TRUST[n.item.source] * n.sim ** 4 }))
    .sort((a, b) => a.grams - b.grams);
  const half = weighted.reduce((s, x) => s + x.w, 0) / 2;
  let run = 0;
  for (const x of weighted) {
    run += x.w;
    if (run >= half) return { grams: x.grams, count: close.length };
  }
  return null;
}

/** Three or more near-identical items within 15% of their middle weight: that weight, without asking the model. */
export function twinWeight(
  neighbours: Neighbour[],
): { grams: number; count: number; weighed: number } | null {
  const twins = neighbours.filter((n) => n.sim >= TWIN);
  if (twins.length < 3) return null;
  const sorted = twins.map((n) => n.item.grams).sort((a, b) => a - b);
  const mid = sorted[Math.floor((sorted.length - 1) / 2)]!;
  if (sorted.some((g) => Math.abs(g - mid) > mid * 0.15)) return null;
  return {
    grams: mid,
    count: twins.length,
    weighed: twins.filter((n) => n.item.source === 'weighed').length,
  };
}

/** Grams as a scale shows them: 5 g steps under 100 g, 10 g under 2 kg, 50 g above. */
export function roundGrams(grams: number): number {
  const step = grams < 100 ? 5 : grams < 2000 ? 10 : 50;
  return Math.max(step, Math.round(grams / step) * step);
}

export interface Decision {
  grams: number;
  sure: boolean;
  /** For the admin (kept on the option, ≤ 300 characters): the weight, how it was reached, what to check. */
  note: string;
}

export function decide(input: {
  guess: ModelGuess | null;
  /** The second look's one number (null: not asked, or no answer). */
  quick?: number | null;
  neighbours: Neighbour[];
  statedNetG: number | null;
  type: ProductType;
  categoryWeightG: number | null;
}): Decision | null {
  const { guess, neighbours, statedNetG, type, categoryWeightG } = input;
  const quick = input.quick ?? null;
  const twins = twinWeight(neighbours);
  if (twins && (statedNetG === null || twins.grams >= statedNetG)) {
    const grams = roundGrams(twins.grams);
    const how = twins.weighed ? `${twins.weighed} weighed at the hub` : 'known weights';
    return {
      grams,
      sure: !unusualWeight(grams, type, categoryWeightG),
      note: `Estimated ${formatGrams(grams)}: like ${twins.count} near-identical items (${how})`,
    };
  }
  if (!guess) return null;
  const near = neighbourWeight(neighbours);
  const agrees = near ? Math.abs(guess.packedG - near.grams) <= near.grams * 0.25 : null;
  const second =
    quick === null ? null : Math.abs(guess.packedG - quick) <= Math.max(guess.packedG, quick) * 0.3;
  // two looks that agree: the careful one counts twice; similar known items: halfway to them
  const own = second ? (2 * guess.packedG + quick!) / 3 : guess.packedG;
  const raw = near && agrees ? (own + near.grams) / 2 : own;
  const grams = roundGrams(raw);
  const check: string[] = [];
  if (guess.highG - guess.lowG > guess.packedG * 0.5)
    check.push(`the model is unsure (${guess.lowG}-${guess.highG} g)`);
  if (second === false) check.push(`a second look says about ${formatGrams(quick!)}`);
  if (near && !agrees)
    check.push(`${near.count} similar known items weigh about ${formatGrams(near.grams)}`);
  if (statedNetG !== null && grams < statedNetG)
    check.push(`below its stated ${formatGrams(statedNetG)}`);
  if (unusualWeight(grams, type, categoryWeightG))
    check.push("far from its category's usual weight");
  const parts = guess.parts
    .slice(0, 4)
    .map((p) => `${p.what.slice(0, 28)} ${p.grams}`)
    .concat(guess.packagingG ? [`packing ${guess.packagingG}`] : [])
    .join(' + ');
  const like =
    near && agrees ? `; ${near.count} similar known items ~${formatGrams(near.grams)}` : '';
  const head = `Estimated ${formatGrams(grams)} packed (${guess.lowG}-${guess.highG} g)${like}: ${parts} g`;
  const note = check.length ? `${head.slice(0, 200)}. Check: ${check.join('; ')}` : head;
  return { grams, sure: check.length === 0, note: note.slice(0, 300) };
}
