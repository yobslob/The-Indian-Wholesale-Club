import {
  decide,
  estimateAnswerSchema,
  ESTIMATE_SYSTEM,
  estimatePrompt,
  itemText,
  nearest,
  quickAnswerSchema,
  QUICK_SYSTEM,
  quickPrompt,
  readAnswer,
  readQuick,
  twinWeight,
  weightGroups,
  type EstimateListing,
  type EstimateWrite,
  type Neighbour,
  type ReferenceItem,
  type WeightGroup,
} from '@repo/shared/sourcing/estimate';

import type { Ollama } from './ollama';
import type { Vectors } from './vectors';

/**
 * One listing, start to end (D-131): its groups (all sizes of the piece, each pack), the known items most like each,
 * then two questions to the model for all groups at once (skipped when near-identical items already agree): the
 * careful one, part by part with at most six known weights, and a one-number second look; then a decision per group.
 */

export interface Estimator {
  ollama: Ollama;
  vectors: Vectors;
  references: { item: ReferenceItem; vector: Float32Array }[];
}

export interface ListingResult {
  writes: EstimateWrite[];
  /** Per group: "one piece 420 g sure" for the log. */
  lines: string[];
  asked: boolean;
  /** The model's answer length (tokens): what the time goes on. */
  tokens: number;
}

export const groupText = (listing: EstimateListing, group: WeightGroup): string =>
  itemText(listing.product_type, listing.category, listing.name, group.pack);

/** The weights a shop's page or a matching item gave the wanted options (audit): shown to the model to weigh up. */
function pageWeights(listing: EstimateListing): string[] {
  return [
    ...new Set(
      listing.variants
        .filter(
          (v) =>
            v.wanted &&
            v.weight_g !== null &&
            (v.weight_source === 'shop' || v.weight_source === 'similar'),
        )
        .map((v) => `${v.weight_g} g${v.weight_note ? ` (${v.weight_note.slice(0, 120)})` : ''}`),
    ),
  ].slice(0, 2);
}

export async function estimateListing(
  est: Estimator,
  listing: EstimateListing,
): Promise<ListingResult> {
  const groups = weightGroups(listing);
  if (!groups.length) return { writes: [], lines: [], asked: false, tokens: 0 };
  const near: Neighbour[][] = groups.map((g) =>
    nearest(est.vectors.of(groupText(listing, g)), est.references, {
      type: listing.product_type,
      pack: g.pack !== null,
      exclude: listing.product_id,
    }),
  );
  const twinsOnly = near.every((n, i) => {
    const t = twinWeight(n);
    return t !== null && (groups[i]!.statedNetG === null || t.grams >= groups[i]!.statedNetG!);
  });
  let guesses = groups.map(() => null as ReturnType<typeof readAnswer>[number]);
  let quick = groups.map(() => null as number | null);
  let tokens = 0;
  if (!twinsOnly) {
    const shown = [
      ...new Map(
        near
          .flat()
          .filter((n) => n.sim >= 0.6)
          .sort((a, b) => b.sim - a.sim)
          .map((n) => [n.item.key, n]),
      ).values(),
    ].slice(0, 6);
    const prompt = estimatePrompt(listing, groups, shown, pageWeights(listing));
    const [answer, second] = await Promise.all([
      est.ollama.ask(ESTIMATE_SYSTEM, prompt, estimateAnswerSchema(groups.length)),
      est.ollama.ask(QUICK_SYSTEM, quickPrompt(listing, groups), quickAnswerSchema(groups.length)),
    ]);
    guesses = readAnswer(answer.content, groups.length);
    quick = readQuick(second.content, groups.length);
    tokens = answer.tokens + second.tokens;
  }
  const writes: EstimateWrite[] = [];
  const lines: string[] = [];
  groups.forEach((group, i) => {
    const d = decide({
      guess: guesses[i] ?? null,
      quick: quick[i] ?? null,
      neighbours: near[i]!,
      statedNetG: group.statedNetG,
      type: listing.product_type,
      categoryWeightG: listing.category_weight_g,
    });
    if (!d) {
      lines.push(`${group.label}: no answer`);
      return;
    }
    lines.push(`${group.pack ?? 'piece'} ${d.grams} g ${d.sure ? 'sure' : 'to check'}`);
    for (const id of group.variantIds)
      writes.push({ variant_id: id, weight_g: d.grams, sure: d.sure, note: d.note });
  });
  return { writes, lines, asked: !twinsOnly, tokens };
}

/** Runs `work` over `items`, `parallel` at a time, in order of starting. */
export async function pool<T>(
  items: T[],
  parallel: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(parallel, items.length) }, async () => {
      while (next < items.length) await work(items[next++]!);
    }),
  );
}
