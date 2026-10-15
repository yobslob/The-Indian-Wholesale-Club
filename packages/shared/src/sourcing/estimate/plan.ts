import { z } from 'zod';

import { PRODUCT_TYPES, type ProductType } from '../../domain/product-types';
import { parseWeight } from '../weight';

/**
 * D-131: what the weight estimator (tools/weight-estimator) reads and writes. worker_estimate_plan() names the
 * listings to estimate, worker_weight_references() the weights IWC knows, worker_set_estimates() keeps the answers.
 */

/** missing: options with no weight never estimated; redo: also estimated ones; audit: also a page's weight. */
export const ESTIMATE_MODES = ['missing', 'redo', 'audit'] as const;
export type EstimateMode = (typeof ESTIMATE_MODES)[number];

const options = z.record(z.string()).catch({});

export const estimatePlanSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    product_type: z.enum(PRODUCT_TYPES),
    category: z.string(),
    category_weight_g: z.number().int().nullable(),
    summary: z.string().nullable(),
    description: z.string().nullable(),
    attributes: z.record(z.unknown()).catch({}),
    variants: z.array(
      z.object({
        id: z.string().uuid(),
        label: z.string(),
        options,
        weight_g: z.number().int().nullable(),
        weight_source: z.string().nullable(),
        weight_note: z.string().nullable(),
        wanted: z.boolean(),
      }),
    ),
  }),
);
export type EstimateListing = z.infer<typeof estimatePlanSchema>[number];

export const referencesSchema = z.array(
  z.object({
    variant_id: z.string().uuid(),
    product_id: z.string().uuid(),
    name: z.string(),
    product_type: z.enum(PRODUCT_TYPES),
    category: z.string(),
    label: z.string(),
    options,
    weight_g: z.number().int(),
    weight_source: z.enum(['weighed', 'admin', 'shop']),
    weight_estimate_g: z.number().int().nullable(),
  }),
);
export type WeightReferenceRow = z.infer<typeof referencesSchema>[number];

/** What the estimator writes for one option: kept as its estimate; a sure one also becomes the weight. */
export interface EstimateWrite {
  variant_id: string;
  weight_g: number;
  sure: boolean;
  note: string;
}

/** A known weight to compare with: one per listing, or per pack of a listing. */
export interface ReferenceItem {
  key: string;
  productId: string;
  type: ProductType;
  text: string;
  name: string;
  category: string;
  pack: string | null;
  grams: number;
  source: 'weighed' | 'admin' | 'shop';
}

const TRUST = { weighed: 3, admin: 2, shop: 1 } as const;

/** The words an item is known by, for finding similar ones: kind, category, name and pack. */
export const itemText = (
  type: ProductType,
  category: string,
  name: string,
  pack: string | null,
): string => `${type} · ${category} · ${name}${pack ? ` · ${pack}` : ''}`;

/**
 * The references, one per listing (its sizes and colours weigh alike, D-129) and per pack: the most trusted weight
 * (weighed, then typed, then a shop's page), the heaviest among equals.
 */
export function referenceItems(rows: WeightReferenceRow[]): ReferenceItem[] {
  const best = new Map<string, WeightReferenceRow>();
  for (const r of rows) {
    const key = `${r.product_id}|${r.options.pack ?? ''}`;
    const had = best.get(key);
    const better =
      !had ||
      TRUST[r.weight_source] > TRUST[had.weight_source] ||
      (TRUST[r.weight_source] === TRUST[had.weight_source] && r.weight_g > had.weight_g);
    if (better) best.set(key, r);
  }
  return [...best.entries()].map(([key, r]) => ({
    key,
    productId: r.product_id,
    type: r.product_type,
    text: itemText(r.product_type, r.category, r.name, r.options.pack ?? null),
    name: r.name,
    category: r.category,
    pack: r.options.pack ?? null,
    grams: r.weight_g,
    source: r.weight_source,
  }));
}

/** One weight per group: all sizes and colours of the piece share one (D-129); each pack has its own. */
export interface WeightGroup {
  key: string;
  /** For the model: "one piece (sold in 4 sizes and colours: weigh one, a middle size)" or "pack 500 g". */
  label: string;
  pack: string | null;
  /** The net weight the pack or the food's name states, if any: the packed weight cannot be below it. */
  statedNetG: number | null;
  variantIds: string[];
}

export function weightGroups(listing: EstimateListing): WeightGroup[] {
  const wanted = listing.variants.filter((v) => v.wanted);
  const pieces = wanted.filter((v) => !v.options.pack);
  const out: WeightGroup[] = [];
  if (pieces.length) {
    // the sizes are not listed: a model read "Ivory · S, Ivory · M, …" as parts of one sherwani (11.95 kg)
    const n = new Set(pieces.map((v) => v.label)).size;
    out.push({
      key: 'piece',
      label:
        n > 1
          ? `one piece (sold in ${n} sizes and colours: weigh one, a middle size)`
          : 'one piece',
      pack: null,
      statedNetG:
        listing.product_type === 'food' ? (parseWeight(listing.name)?.grams ?? null) : null,
      variantIds: pieces.map((v) => v.id),
    });
  }
  const packs = new Map<string, string[]>();
  for (const v of wanted.filter((v) => v.options.pack))
    packs.set(v.options.pack!, [...(packs.get(v.options.pack!) ?? []), v.id]);
  for (const [pack, ids] of packs)
    out.push({
      key: `pack:${pack}`,
      label: `pack "${pack}"`,
      pack,
      statedNetG: parseWeight(pack)?.grams ?? null,
      variantIds: ids,
    });
  return out;
}

const DETAIL_KEYS: [string, string][] = [
  ['fibre_content', 'Fabric'],
  ['length_m', 'Length (m)'],
  ['material', 'Material'],
  ['dimensions', 'Size'],
  ['ingredients', 'Ingredients'],
];

/** The listing's details that tell its weight, one per line, each short. */
export function detailLines(listing: EstimateListing): string[] {
  const lines = DETAIL_KEYS.flatMap(([key, label]) => {
    const value = listing.attributes[key];
    return typeof value === 'string' || typeof value === 'number'
      ? [`${label}: ${String(value).slice(0, 160)}`]
      : [];
  });
  const about = [listing.summary, listing.description]
    .filter((t): t is string => !!t && t.trim() !== '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (about) lines.push(`About it: ${about.slice(0, 320)}`);
  return lines;
}
