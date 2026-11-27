import { ALL_OF_INDIA, type RecipeDraft } from '@repo/shared/domain';

import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

/**
 * D-203, Admin → Recipes: the admin's own client, so RLS (`is_admin()`) is the gate. The publish rule lives in the
 * database (`_recipe_publish_guard`); these only read and write.
 */

const LISTING =
  'product_variants(id, label, is_active, qty_listed, qty_reserved, price_cents, products(id, name, status, price_cents))';

export type RecipeRow = Awaited<ReturnType<typeof listRecipes>>[number];
export type RecipeAdmin = NonNullable<Awaited<ReturnType<typeof getRecipeAdmin>>>;
export type RecipeAdminLine = RecipeAdmin['recipe_ingredients'][number];

/** Every recipe with what the list shows: status, words, On Home and each line's listing health. */
export async function listRecipes(client: IwcClient) {
  return unwrap(
    await client
      .from('recipes')
      .select(
        `id, slug, name, kind, status, content_status, home_rank, photo_path, sort, updated_at, regions(name),
               recipe_ingredients(source, variant_id, instead_of, ${LISTING})`,
      )
      .order('sort')
      .order('name'),
  );
}

export async function getRecipeAdmin(client: IwcClient, id: string) {
  const rows = unwrap(
    await client
      .from('recipes')
      .select(
        `*, regions(name), recipe_ingredients(id, sort, label, amount, source, variant_id, match_words, instead_of, ${LISTING})`,
      )
      .eq('id', id)
      .limit(1),
  );
  const r = rows[0];
  if (!r) return null;
  r.recipe_ingredients.sort((a, b) => a.sort - b.sort);
  return r;
}

/** A line's listing state, as the editor and the list name it. */
export function lineHealth(line: {
  source: string;
  variant_id: string | null;
  product_variants: {
    is_active: boolean;
    qty_listed: number;
    qty_reserved: number;
    products: { status: string } | null;
  } | null;
}): 'local' | 'ok' | 'sold_out' | 'gone' | 'unmatched' {
  if (line.source === 'local') return 'local';
  if (!line.variant_id || !line.product_variants) return 'unmatched';
  const v = line.product_variants;
  if (!v.is_active || v.products?.status !== 'live') return 'gone';
  return v.qty_listed - v.qty_reserved > 0 ? 'ok' : 'sold_out';
}

export interface RecipeFields {
  slug: string;
  name: string;
  region_id: string | null;
  kind: string;
  blurb: string;
  minutes: number;
  soak_hours: number | null;
  serves: number;
  effort: string;
  steps: { text: string; minutes: number | null }[];
  sort: number;
}

export interface RecipeLineInput {
  label: string;
  amount: string;
  source: 'iwc' | 'local';
  variant_id: string | null;
  match_words: string;
  /** D-204: the fresh, local line this IWC line can stand in for; null for a main line. */
  instead_of: string | null;
}

export async function createRecipe(client: IwcClient, fields: RecipeFields): Promise<string> {
  const rows = unwrap(await client.from('recipes').insert(fields).select('id'));
  return rows[0]!.id;
}

export async function updateRecipe(client: IwcClient, id: string, fields: Partial<RecipeFields>) {
  unwrap(await client.from('recipes').update(fields).eq('id', id));
}

/** The lines as the editor holds them, in order (replaced as a whole: a recipe has a few dozen at most). */
export async function saveRecipeLines(
  client: IwcClient,
  recipeId: string,
  lines: RecipeLineInput[],
) {
  unwrap(await client.from('recipe_ingredients').delete().eq('recipe_id', recipeId));
  if (lines.length === 0) return;
  unwrap(
    await client.from('recipe_ingredients').insert(
      lines.map((l, i) => ({
        recipe_id: recipeId,
        sort: i + 1,
        label: l.label,
        amount: l.amount,
        source: l.source,
        variant_id: l.source === 'iwc' ? l.variant_id : null,
        match_words: l.match_words,
        instead_of: l.source === 'iwc' ? l.instead_of : null,
      })),
    ),
  );
}

export async function setRecipeLineListing(
  client: IwcClient,
  lineId: string,
  variantId: string | null,
) {
  unwrap(
    await client
      .from('recipe_ingredients')
      .update({ variant_id: variantId, product_id: null })
      .eq('id', lineId),
  );
}

export async function setRecipeStatus(
  client: IwcClient,
  id: string,
  status: 'draft' | 'live' | 'archived',
) {
  unwrap(await client.from('recipes').update({ status }).eq('id', id));
}

export async function approveRecipeWords(client: IwcClient, id: string, approved: boolean) {
  unwrap(
    await client
      .from('recipes')
      .update({ content_status: approved ? 'approved' : 'draft' })
      .eq('id', id),
  );
}

export async function setRecipePhoto(client: IwcClient, id: string, path: string | null) {
  unwrap(await client.from('recipes').update({ photo_path: path }).eq('id', id));
}

/** One recipe on Home's window at a time; null takes it off. */
export async function pinRecipe(client: IwcClient, id: string | null) {
  unwrap(await client.rpc('admin_pin_recipe', { p_id: id as string }));
}

/** Why it can't go live: words_not_approved, no_iwc_line (D-204: no main piece with a live listing). */
export async function recipeBlockers(client: IwcClient, id: string): Promise<string[]> {
  return unwrap(await client.rpc('admin_recipe_blockers', { p_id: id })) ?? [];
}

export async function recipeMatches(client: IwcClient, words: string, limit = 5) {
  return unwrap(await client.rpc('admin_recipe_matches', { p_words: words, p_limit: limit })) ?? [];
}

const publishAllSchema = z.object({
  published: z.array(z.string()),
  blocked: z.array(z.object({ slug: z.string(), why: z.array(z.string()) })),
  lines_filled: z.number().int(),
  lines_local: z.number().int().default(0),
  next: z.string().nullable(),
});

/**
 * Publish all (D-204, D-214), one batch: draft recipes after `after` by address; every line without an in-stock listing
 * takes the cheapest match, a main line with none moves to the local shop, the words are approved and each recipe with
 * a piece to sell goes live. `next` is where the next batch starts (null: done).
 */
export async function publishAllRecipes(client: IwcClient, after: string | null, limit = 15) {
  const data = unwrap(
    await client.rpc('admin_recipes_publish_all', { p_after: after as string, p_limit: limit }),
  );
  return publishAllSchema.parse(data);
}

/** D-214: after an import, each draft line takes its cheapest in-stock listing (nothing moves to local yet). */
export async function fillCheapestListings(client: IwcClient, ids: string[]): Promise<number> {
  let filled = 0;
  for (let i = 0; i < ids.length; i += 100) {
    filled += unwrap(await client.rpc('admin_recipes_fill_cheapest', { p_ids: ids.slice(i, i + 100) })) ?? 0;
  }
  return filled;
}

/** Today: live recipes with a piece gone or sold out. */
export async function recipesMissingPiece(client: IwcClient): Promise<number> {
  return unwrap(await client.rpc('admin_recipes_missing_piece', undefined, { get: true })) ?? 0;
}

/** The recipes whose kits hold these listings (a listing change refreshes their pages, D-145). */
export async function recipesUsingProducts(client: IwcClient, productIds: string[]) {
  if (productIds.length === 0) return [];
  const rows = unwrap(
    await client
      .from('recipe_ingredients')
      .select('recipes(slug, status, home_rank)')
      .in('product_id', productIds.slice(0, 500)),
  );
  const out = new Map<string, { slug: string; onHome: boolean }>();
  for (const r of rows) {
    if (r.recipes?.status === 'live')
      out.set(r.recipes.slug, { slug: r.recipes.slug, onHome: r.recipes.home_rank !== null });
  }
  return [...out.values()];
}

/** id and slug of every recipe (photos by name, drafts' duplicates). */
export async function recipeSlugs(client: IwcClient) {
  return unwrap(await client.from('recipes').select('id, slug, photo_path, status, home_rank'));
}

/**
 * Adds drafted recipes (status and words draft). A slug already there is replaced while it is still a draft with draft
 * words (D-204: a later file carries the swaps); once published or approved it is left alone.
 */
export async function addRecipeDrafts(client: IwcClient, drafts: RecipeDraft[]) {
  const regions = unwrap(await client.from('regions').select('id, name'));
  const byName = new Map(regions.map((r) => [r.name.toLowerCase(), r.id]));
  const existing = new Map(
    unwrap(await client.from('recipes').select('id, slug, status, content_status')).map((r) => [
      r.slug,
      r,
    ]),
  );
  const added: { id: string; slug: string }[] = [];
  const replaced: string[] = [];
  const skipped: { slug: string; why: string }[] = [];
  const touched: string[] = [];
  for (const d of drafts) {
    const there = existing.get(d.slug);
    if (there && (there.status !== 'draft' || there.content_status !== 'draft')) {
      skipped.push({
        slug: d.slug,
        why: there.status === 'live' ? 'already live' : 'already there, words approved',
      });
      continue;
    }
    const allIndia = d.state.toLowerCase() === ALL_OF_INDIA.toLowerCase();
    const regionId = allIndia ? null : (byName.get(d.state.toLowerCase()) ?? undefined);
    if (regionId === undefined) {
      skipped.push({ slug: d.slug, why: `no state called "${d.state}"` });
      continue;
    }
    const fields: RecipeFields = {
      slug: d.slug,
      name: d.name,
      region_id: regionId,
      kind: d.kind,
      blurb: d.blurb,
      minutes: d.minutes,
      soak_hours: d.soak_hours,
      serves: d.serves,
      effort: d.effort,
      steps: d.steps,
      sort: d.rank ?? 1000,
    };
    let id: string;
    if (there) {
      id = there.id;
      await updateRecipe(client, id, fields);
    } else {
      id = await createRecipe(client, fields);
    }
    await saveRecipeLines(
      client,
      id,
      d.ingredients.map((l) => ({
        label: l.label,
        amount: l.amount,
        source: l.source,
        variant_id: null,
        match_words: l.source === 'iwc' ? (l.match_words ?? l.label).toLowerCase() : '',
        instead_of: l.source === 'iwc' ? (l.instead_of ?? null) : null,
      })),
    );
    if (there) replaced.push(d.slug);
    else added.push({ id, slug: d.slug });
    existing.set(d.slug, { id, slug: d.slug, status: 'draft', content_status: 'draft' });
    touched.push(id);
  }
  // D-214: the editor opens on each line's cheapest listing ("by default")
  const filled = await fillCheapestListings(client, touched);
  return { added, replaced, skipped, filled };
}
