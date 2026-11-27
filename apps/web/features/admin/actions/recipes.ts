'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  addRecipeDrafts,
  approveRecipeWords,
  createRecipe,
  getRecipeAdmin,
  pinRecipe,
  publishAllRecipes,
  recipeMatches,
  recipeSlugs,
  saveRecipeLines,
  setRecipeLineListing,
  setRecipePhoto,
  setRecipeStatus,
  updateRecipe,
} from '@repo/db/admin';
import { photoCreditSchema, recipeDraftFileSchema, slugFromFileName } from '@repo/shared/domain';

import { refreshRecipes } from '@/features/admin/refresh-recipes';
import { errorMessage } from '@/lib/logger';
import { removePhotos, storePhoto } from '@/lib/photo-copies';

import { requireAdminAction } from '../guard';

/**
 * D-203, Admin → Recipes. Every change to a live recipe refreshes its page, the shelf and Home when it is on Home's
 * window (refreshRecipes); a draft refreshes nothing customers see (D-145).
 */

type Result = { error: string | null };
const PAGE = '/admin/recipes';
const id = z.string().uuid();
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const fail = (error: unknown): Result => ({
  error:
    error instanceof z.ZodError
      ? (error.issues[0]?.message ?? 'not valid')
      : readable(errorMessage(error)),
});

/** The database's publish rule names what's missing; the admin reads it in words. */
const BLOCKER_WORDS: Record<string, string> = {
  words_not_approved: 'the words are not approved',
  no_iwc_line: 'nothing in its kit can be bought yet',
};
function readable(message: string): string {
  const m = /recipe_not_ready: (.+)/.exec(message);
  if (!m) return message;
  return `Can't publish yet: ${m[1]!
    .split(', ')
    .map((b) => BLOCKER_WORDS[b] ?? b)
    .join('; ')}.`;
}

async function afterChange(
  client: Parameters<typeof getRecipeAdmin>[0],
  recipeId: string,
  wasShown: boolean,
): Promise<void> {
  const r = await getRecipeAdmin(client, recipeId);
  revalidatePath(PAGE);
  revalidatePath(`${PAGE}/${recipeId}`);
  if (r && (wasShown || r.status === 'live'))
    refreshRecipes([r.slug], r.home_rank !== null || wasShown);
}

const fieldsSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'the address: lowercase words joined by -'),
  name: z.string().trim().min(1, 'a name').max(80),
  region_id: z.string().uuid().nullable(),
  kind: z.enum(['snacks', 'breakfast', 'dinner', 'sweets', 'drinks']),
  blurb: z.string().trim().max(200),
  minutes: z.number().int().min(1).max(1440),
  soak_hours: z.number().min(0).max(48).nullable(),
  serves: z.number().int().min(1).max(50),
  effort: z.enum(['easy', 'medium', 'weekend']),
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1, 'a step needs words').max(600),
        minutes: z.number().int().min(0).max(1440).nullable(),
      }),
    )
    .max(30),
  sort: z.number().int().min(0).max(100_000),
});
const linesSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1, 'an ingredient needs a name').max(80),
      amount: z.string().trim().max(40),
      source: z.enum(['iwc', 'local']),
      variant_id: z.string().uuid().nullable(),
      match_words: z.string().trim().max(120),
      instead_of: z.string().trim().min(1).max(80).nullable().default(null),
    }),
  )
  .max(40);

export type RecipeForm = z.input<typeof fieldsSchema> & { lines: z.input<typeof linesSchema> };

/** Saves the editor (fields and lines). A new recipe returns its id. */
export async function saveRecipeAction(
  recipeId: string | null,
  form: RecipeForm,
): Promise<Result & { id?: string }> {
  try {
    const { client } = await requireAdminAction();
    const fields = fieldsSchema.parse(form);
    const lines = linesSchema.parse(form.lines);
    if (!recipeId) {
      const newId = await createRecipe(client, fields);
      await saveRecipeLines(client, newId, lines);
      revalidatePath(PAGE);
      return { error: null, id: newId };
    }
    const before = await getRecipeAdmin(client, id.parse(recipeId));
    await updateRecipe(client, recipeId, fields);
    await saveRecipeLines(client, recipeId, lines);
    await afterChange(client, recipeId, before?.status === 'live');
    if (before && before.slug !== fields.slug && before.status === 'live')
      refreshRecipes([before.slug], false);
    return { error: null, id: recipeId };
  } catch (error) {
    return fail(error);
  }
}

export async function approveRecipeAction(recipeId: string, approved: boolean): Promise<Result> {
  try {
    const { client } = await requireAdminAction();
    const before = await getRecipeAdmin(client, id.parse(recipeId));
    await approveRecipeWords(client, recipeId, approved);
    await afterChange(client, recipeId, before?.status === 'live');
    return { error: null };
  } catch (error) {
    return fail(error);
  }
}

export async function setRecipeStatusAction(
  recipeId: string,
  status: 'draft' | 'live' | 'archived',
): Promise<Result> {
  try {
    const { client } = await requireAdminAction();
    const before = await getRecipeAdmin(client, id.parse(recipeId));
    await setRecipeStatus(client, recipeId, z.enum(['draft', 'live', 'archived']).parse(status));
    await afterChange(client, recipeId, before?.status === 'live');
    if (before?.home_rank !== null && status !== 'live') refreshRecipes([], true);
    return { error: null };
  } catch (error) {
    return fail(error);
  }
}

/** On Home's window: one recipe at a time (the one before leaves Home's window). */
export async function pinRecipeAction(recipeId: string | null): Promise<Result> {
  try {
    const { client } = await requireAdminAction();
    await pinRecipe(client, recipeId === null ? null : id.parse(recipeId));
    refreshRecipes([], true);
    revalidatePath(PAGE);
    if (recipeId) revalidatePath(`${PAGE}/${recipeId}`);
    return { error: null };
  } catch (error) {
    return fail(error);
  }
}

export async function setLineListingAction(
  recipeId: string,
  lineId: string,
  variantId: string | null,
): Promise<Result> {
  try {
    const { client } = await requireAdminAction();
    const before = await getRecipeAdmin(client, id.parse(recipeId));
    await setRecipeLineListing(
      client,
      id.parse(lineId),
      variantId === null ? null : id.parse(variantId),
    );
    await afterChange(client, recipeId, before?.status === 'live');
    return { error: null };
  } catch (error) {
    return fail(error);
  }
}

export type Match = Awaited<ReturnType<typeof recipeMatches>>[number];

/** Live, in-stock food options for some words, cheapest first (the listing picker). */
export async function findListingsAction(words: string): Promise<Match[]> {
  const { client } = await requireAdminAction();
  return recipeMatches(client, z.string().trim().max(120).parse(words), 8);
}

/** Match listings again: up to five live, in-stock options for every IWC line with no listing; the admin picks. */
export async function suggestMatchesAction(recipeId: string): Promise<Record<string, Match[]>> {
  const { client } = await requireAdminAction();
  const r = await getRecipeAdmin(client, id.parse(recipeId));
  if (!r) return {};
  const out: Record<string, Match[]> = {};
  for (const line of r.recipe_ingredients) {
    if (line.source !== 'iwc' || line.variant_id) continue;
    out[line.id] = await recipeMatches(client, line.match_words || line.label, 5);
  }
  return out;
}

/** Add drafts from a file (plan §7): a JSON list of drafted recipes; each starts as a draft with draft words (one still
 * a draft is replaced, D-204). */
export async function addDraftsAction(
  json: string,
): Promise<{ error: string | null; added: string[]; replaced: string[]; skipped: string[] }> {
  try {
    const { client } = await requireAdminAction();
    const drafts = recipeDraftFileSchema.parse(JSON.parse(json));
    const { added, replaced, skipped } = await addRecipeDrafts(client, drafts);
    revalidatePath(PAGE);
    return {
      error: null,
      added: added.map((a) => a.slug),
      replaced,
      skipped: skipped.map((s) => `${s.slug}: ${s.why}`),
    };
  } catch (error) {
    const e = error instanceof SyntaxError ? { error: 'not a JSON file' } : fail(error);
    return { ...e, added: [], replaced: [], skipped: [] };
  }
}

/**
 * Publish all (D-204): one batch of draft recipes after the last batch (the button repeats it, D-146): empty lines take the
 * cheapest in-stock match, the words are approved and each recipe with a piece to sell goes live. Refreshes the shelf,
 * the new pages and Home's row.
 */
export async function publishAllAction(
  after: string | null,
): Promise<
  Result & {
    published: string[];
    blocked: { slug: string; why: string[] }[];
    filled: number;
    local: number;
    next: string | null;
  }
> {
  try {
    const { client } = await requireAdminAction();
    const r = await publishAllRecipes(
      client,
      after === null ? null : z.string().max(80).parse(after),
    );
    if (r.published.length > 0) refreshRecipes(r.published, true);
    revalidatePath(PAGE);
    return {
      error: null,
      published: r.published,
      blocked: r.blocked,
      filled: r.lines_filled,
      local: r.lines_local,
      next: r.next,
    };
  } catch (error) {
    return { ...fail(error), published: [], blocked: [], filled: 0, local: 0, next: null };
  }
}

/**
 * Add photos by name (D-203 answer 4): each file goes to the recipe whose slug is its name (case, spaces and
 * underscores ignored), as two AVIF copies (D-141), replacing any earlier photo. One file a call (D-146).
 */
export async function recipePhotoByNameAction(form: FormData): Promise<Result & { slug?: string }> {
  try {
    const { client } = await requireAdminAction();
    const file = form.get('image');
    const forId = form.get('recipe_id');
    if (!(file instanceof File) || file.size === 0) return { error: 'no photo' };
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { error: 'not a JPEG, PNG, WebP or AVIF image' };
    if (file.size > MAX_IMAGE_BYTES) return { error: 'larger than 8 MB' };
    const all = await recipeSlugs(client);
    const slug = slugFromFileName(file.name);
    const recipe =
      typeof forId === 'string' && forId
        ? all.find((r) => r.id === forId)
        : all.find((r) => r.slug === slug);
    if (!recipe) return { error: `no recipe called "${slug}"` };
    // D-214: the photo's credit from the runner's credits.csv, when its licence asks for one
    const creditText = form.get('credit');
    const credit =
      typeof creditText === 'string' && creditText ? photoCreditSchema.safeParse(JSON.parse(creditText)) : null;
    if (credit && !credit.success) return { error: 'its credit in credits.csv is not complete' };
    const path = await storePhoto(
      client,
      'product-media',
      `recipes/${recipe.slug}/${crypto.randomUUID()}.${ext}`,
      file,
      file.type,
    );
    await setRecipePhoto(client, recipe.id, path, credit?.data ?? null);
    if (recipe.photo_path)
      await removePhotos(client, 'product-media', [recipe.photo_path]).catch(() => undefined);
    await afterChange(client, recipe.id, recipe.status === 'live');
    return { error: null, slug: recipe.slug };
  } catch (error) {
    return fail(error);
  }
}
