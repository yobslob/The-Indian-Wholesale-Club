import { z } from 'zod';

import {
  CLASS_GRAMS,
  CLASS_LABEL,
  CLASS_MEANING,
  CLOTHING_CLASSES,
  classGrams,
  type ClothingClass,
} from './classes';

/**
 * D-132: what tools/weight-estimator (`pnpm weights classes`) and the sourcing runner read and write to weigh clothing
 * by class: worker_clothing_plan() names the listings, worker_set_class_weights() keeps each option's class weight.
 */

export const clothingPlanSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    category_slug: z.string(),
    category: z.string(),
    summary: z.string().nullable(),
    attributes: z.record(z.unknown()).catch({}),
    variants: z.array(
      z.object({
        id: z.string().uuid(),
        label: z.string(),
        options: z.record(z.string()).catch({}),
        weight_g: z.number().int().nullable(),
        weight_source: z.string().nullable(),
      }),
    ),
  }),
);
export type ClothingListing = z.infer<typeof clothingPlanSchema>[number];

export interface ClassWrite {
  variant_id: string;
  weight_g: number;
  note: string;
}

/** Every option of the listing a person has not weighed or typed, at its class's weight, with why. */
export function classWrites(
  listing: ClothingListing,
  cls: ClothingClass,
  why: string,
): ClassWrite[] {
  return listing.variants
    .filter((v) => v.weight_source !== 'weighed' && v.weight_source !== 'admin')
    .map((v) => ({
      variant_id: v.id,
      weight_g: classGrams(cls, v.options, listing.name),
      note: `${CLASS_LABEL[cls]}: ${why} (D-132)`.slice(0, 200),
    }));
}

/** The model's question for a name the rules do not read: which of the founder's four classes. */
export const CLASS_SYSTEM = `You sort clothing from India into four weight classes for shipping. Answer with the one class that fits the listing best, and a few words why.
${CLOTHING_CLASSES.map((c) => `- ${c} (${CLASS_GRAMS[c]} g): ${CLASS_MEANING[c]}`).join('\n')}
A set of two or more garments sold together is always heavy, except a co-ord set (medium). Answer with JSON only.`;

export const CLASS_ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    class: { type: 'string', enum: [...CLOTHING_CLASSES] },
    why: { type: 'string' },
  },
  required: ['class', 'why'],
} as const;

export function classPrompt(listing: ClothingListing): string {
  const fibre = listing.attributes.fibre_content;
  return [
    `Listing: ${listing.name}`,
    `Category: ${listing.category}`,
    ...(typeof fibre === 'string' ? [`Fabric: ${fibre.slice(0, 120)}`] : []),
    ...(listing.summary ? [`About it: ${listing.summary.slice(0, 240)}`] : []),
    `Options: ${[...new Set(listing.variants.map((v) => v.label))].slice(0, 8).join(', ')}`,
  ].join('\n');
}

/** The model's class, or null for anything but one of the four. */
export function readClass(raw: string): { cls: ClothingClass; why: string } | null {
  try {
    const parsed = z
      .object({ class: z.enum(CLOTHING_CLASSES), why: z.string().catch('') })
      .safeParse(JSON.parse(raw));
    return parsed.success
      ? { cls: parsed.data.class, why: parsed.data.why.trim().slice(0, 80) }
      : null;
  } catch {
    return null;
  }
}
