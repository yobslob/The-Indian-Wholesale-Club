import 'server-only';

import { revalidateTag } from 'next/cache';

import { recipesUsingProducts } from '@repo/db/admin';

import { homeTag, recipesTag, recipeTag } from '@/features/catalog/data';

type Client = Parameters<typeof recipesUsingProducts>[0];

/**
 * D-203, D-145: a recipe change refreshes only its own page, the shelf (and the sitemap, which reads it) and Home
 * when Home's window shows it. Nothing else.
 */
export function refreshRecipes(slugs: string[], home: boolean): void {
  if (slugs.length === 0 && !home) return;
  revalidateTag(recipesTag);
  for (const slug of new Set(slugs)) revalidateTag(recipeTag(slug));
  if (home) revalidateTag(homeTag);
}

/**
 * A listing's price or stock moved: the recipe pages whose kits hold it show the new kit price (one lookup, capped like
 * the rest of D-145). Checkout re-prices on the server either way (D-038).
 */
export async function refreshRecipesForListings(client: Client, productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const recipes = await recipesUsingProducts(client, productIds);
  if (recipes.length === 0) return;
  refreshRecipes(
    recipes.map((r) => r.slug),
    recipes.some((r) => r.onHome),
  );
}
