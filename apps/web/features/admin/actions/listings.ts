'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { addProductMedia, createListing, setProductStatus } from '@repo/db/admin';
import { listingInputSchema } from '@repo/shared/domain';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

/** A photo uploaded while the listing was being filled in (listing/upload.ts): only our own drafts folder. */
const photoSchema = z.object({
  path: z.string().regex(/^products\/drafts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/),
  alt: z.string().trim().min(3, 'describe each photo (alt text)').max(200),
});

export type SaveResult = { id: string; published: boolean; note?: string } | { error: string };

/** The database's refusals in the admin's words. */
function plain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('price_needed')) return 'Set the shop price (with every cost in Settings), or a price by hand.';
  if (message.includes('vendor_not_found')) return 'Pick an active shop.';
  if (message.includes('products_slug') || message.includes('duplicate key')) return 'That web address is taken: edit it.';
  if (message.includes('spice') || message.includes('D-032')) return 'Spices can’t go live yet (D-032).';
  return message.length < 200 ? message : 'Could not save. Try again.';
}

async function saveOne(input: unknown, photos: unknown, publish: boolean): Promise<SaveResult> {
  const { client } = await requireAdminAction();
  const listing = listingInputSchema.safeParse(input);
  if (!listing.success) return { error: `Check ${String(listing.error.issues[0]?.path.at(-1) ?? 'the form')}.` };
  const pics = z.array(photoSchema).max(30).safeParse(photos);
  if (!pics.success) return { error: pics.error.issues[0]?.message ?? 'Check the photos.' };
  let id: string;
  try {
    // One path for every new listing, web or phone: product + variants in one transaction (admin_create_listing).
    id = await createListing(client, listing.data);
  } catch (error) {
    return { error: plain(error) };
  }
  for (const [i, p] of pics.data.entries()) {
    await addProductMedia(client, { product_id: id, storage_path: p.path, alt_text: p.alt, sort_order: i, is_primary: i === 0 });
  }
  if (!publish) return { id, published: false };
  try {
    await setProductStatus(client, id, 'live');
    revalidateTag(STORE_TAG);
    return { id, published: true };
  } catch (error) {
    return { id, published: false, note: `Saved as a draft, not published: ${plain(error)}` };
  }
}

/** New listing in one step (D-096): the listing, its options and its photos together; Save draft or Publish. */
export async function saveListingAction(input: unknown, photos: unknown, publish: boolean): Promise<SaveResult> {
  const result = await saveOne(input, photos, z.boolean().parse(publish));
  revalidatePath('/admin/listings');
  revalidatePath('/admin/catalog');
  return result;
}

/** Add many (D-096): one draft per row, each on its own, so one refusal doesn't stop the rest. */
export async function saveManyAction(rows: { input: unknown; photos: unknown }[]): Promise<SaveResult[]> {
  await requireAdminAction();
  const list = z.array(z.object({ input: z.unknown(), photos: z.unknown() })).min(1).max(60).parse(rows);
  const results: SaveResult[] = [];
  for (const row of list) results.push(await saveOne(row.input, row.photos, false));
  revalidatePath('/admin/listings');
  revalidatePath('/admin/catalog');
  return results;
}
