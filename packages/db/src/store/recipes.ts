/**
 * D-203, Cook at home: customer-safe recipe reads (store_recipes, store_recipe; Home's row comes with store_home).
 * Only what the cards and the bag's line need (D-017, INV-1).
 */
import { photoCreditSchema } from '@repo/shared/domain';
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

export const RECIPE_KINDS = ['snacks', 'breakfast', 'dinner', 'sweets', 'drinks'] as const;
export type RecipeKind = (typeof RECIPE_KINDS)[number];
export const RECIPE_EFFORTS = ['easy', 'medium', 'weekend'] as const;
export type RecipeEffort = (typeof RECIPE_EFFORTS)[number];

const recipeKind = z.enum(RECIPE_KINDS);
const recipeEffort = z.enum(RECIPE_EFFORTS);

export const recipeCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: recipeKind,
  blurb: z.string(),
  minutes: z.number().int(),
  soak_hours: z.number().nullable(),
  serves: z.number().int(),
  effort: recipeEffort,
  photo_path: z.string().nullable(),
  /** Null for an all-India recipe (D-121). */
  region_slug: z.string().nullable(),
  region_name: z.string().nullable(),
  /** The available pieces' store prices added up; the struck figure is drawn from it, never stored (D-203). */
  kit_cents: z.number().int(),
  kit_count: z.number().int(),
});

export const recipeStepSchema = z.object({
  text: z.string(),
  minutes: z.number().nullable().optional(),
});

const localLineSchema = z.object({
  source: z.literal('local'),
  label: z.string(),
  amount: z.string(),
});

/** An IWC line: what the bag's line needs (bagLine), plus whether it can be bought. */
const iwcLineSchema = z.object({
  source: z.literal('iwc'),
  label: z.string(),
  amount: z.string(),
  /** D-204: a swap: the fresh, local line it can stand in for (offered unticked, outside the kit's price). */
  instead_of: z.string().nullable().default(null),
  available: z.boolean(),
  variant_id: z.string().uuid().nullable(),
  product_id: z.string().uuid().nullable(),
  product_name: z.string().nullable(),
  product_slug: z.string().nullable(),
  region_slug: z.string().nullable(),
  region_name: z.string().nullable(),
  variant_label: z.string().nullable(),
  net_qty: z.string().nullable(),
  price_cents: z.number().int().nullable(),
  image_path: z.string().nullable(),
  product_type: z.string().nullable(),
  option_count: z.number().int().nullable(),
});

export const recipeLineSchema = z.discriminatedUnion('source', [localLineSchema, iwcLineSchema]);

export const recipePageSchema = recipeCardSchema.extend({
  /** D-214: an openly licensed photo's credit, shown under it; null for the founder's own photos. */
  photo_credit: photoCreditSchema.nullable().catch(null).default(null),
  steps: z.array(recipeStepSchema),
  published_at: z.string().nullable(),
  updated_at: z.string(),
  lines: z.array(recipeLineSchema),
});

export type RecipeCard = z.infer<typeof recipeCardSchema>;
export type RecipeStep = z.infer<typeof recipeStepSchema>;
export type RecipeLine = z.infer<typeof recipeLineSchema>;
export type RecipeIwcLine = z.infer<typeof iwcLineSchema>;
export type RecipePage = z.infer<typeof recipePageSchema>;

/** /recipes: the live recipes as cards, shelf order (1 round trip). */
export async function getRecipes(client: IwcClient): Promise<RecipeCard[]> {
  const data = unwrap(await client.rpc('store_recipes', {}, { get: true }));
  return z.array(recipeCardSchema).parse(data ?? []);
}

/** /recipes/[slug]: null when it isn't live (1 round trip). */
export async function getRecipe(client: IwcClient, slug: string): Promise<RecipePage | null> {
  const data = unwrap(await client.rpc('store_recipe', { p_slug: slug }, { get: true }));
  return data ? recipePageSchema.parse(data) : null;
}
