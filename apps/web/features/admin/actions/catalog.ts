'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  createVariant,
  renameListings,
  setListedQty,
  setProductStatus,
  setProductWears,
  updateProduct,
} from '@repo/db/admin';
import { WEARS } from '@repo/shared/domain';

import { errorMessage, logger } from '@/lib/logger';

import { requireAdminAction } from '../guard';
import { refreshListings } from '../refresh-listings';

const id = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
/** Empty = priced automatically (D-075). */
const optionalDollars = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'price must be a positive number');
const rupeesToPaise = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
  .refine(
    (v) => v === null || (Number.isFinite(v) && v >= 0),
    'shop price must be a positive number',
  );

export async function updateProductAction(productId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      name: text(120).pipe(z.string().min(2)),
      price: optionalDollars,
      shopPrice: rupeesToPaise,
      summary: optional(300),
      description: optional(4000),
      story: optional(4000),
      craft: optional(120),
    })
    .parse(Object.fromEntries(form));
  await updateProduct(client, id.parse(productId), {
    name: input.name,
    // D-075: empty = automatic (the database prices it from the shop price and weight); a typed price = by hand.
    ...(input.price === null
      ? { price_auto: true }
      : { price_auto: false, price_cents: input.price }),
    shop_price_paise: input.shopPrice,
    summary: input.summary,
    description: input.description,
    story: input.story,
    craft: input.craft,
  });
  await refreshListings(client, [productId]);
  revalidatePath(`/admin/catalog/${productId}`);
}

/** Curated for you (D-056): an admin's pick shows on its region page and the region's product pages. */
export async function setProductCuratedAction(productId: string, curated: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await updateProduct(client, id.parse(productId), { is_curated: z.boolean().parse(curated) });
  await refreshListings(client, [productId]);
  revalidatePath(`/admin/catalog/${productId}`);
}

/**
 * Heavy-item shipping (founder 2026-10-24): heavy cookware is priced on half its weight and the other half is charged
 * in the bag. A home piece named a cooker is one when it is listed; this ticks or unticks any piece (the database
 * reprices it at once).
 */
export async function setProductHeavyAction(productId: string, heavy: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await updateProduct(client, id.parse(productId), { heavy_item: z.boolean().parse(heavy) });
  await refreshListings(client, [productId]);
  revalidatePath(`/admin/catalog/${productId}`);
}

/** Publishing makes it visible in the store. */
export async function setProductStatusAction(
  productId: string,
  status: 'draft' | 'live' | 'paused' | 'archived',
): Promise<void> {
  const { client } = await requireAdminAction();
  try {
    await setProductStatus(
      client,
      id.parse(productId),
      z.enum(['draft', 'live', 'paused', 'archived']).parse(status),
    );
  } catch (error) {
    // the database's refusal, said on the page: an option without a weight (D-129)
    const message = error instanceof Error ? error.message : '';
    const why = /weight_missing:\s*(.*)$/.exec(message)?.[1];
    if (!why) throw error;
    redirect(`/admin/catalog/${productId}?note=${encodeURIComponent(`Not published: ${why}`)}`);
  }
  await refreshListings(client, [productId], true);
  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath('/admin/listings');
}

export async function addVariantAction(productId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      label: text(60).pipe(z.string().min(1)),
      sku: text(60).pipe(z.string().min(2)),
      qty: z.coerce.number().int().min(0).max(10000),
      price: z
        .string()
        .trim()
        .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
        .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'price must be positive'),
      weightG: z
        .string()
        .trim()
        .transform((v) => (v === '' ? null : Number(v)))
        .refine(
          (v) => v === null || (Number.isInteger(v) && v > 0),
          'weight must be a positive integer',
        ),
    })
    .parse(Object.fromEntries(form));
  await createVariant(client, {
    product_id: id.parse(productId),
    label: input.label,
    sku: input.sku,
    qty_listed: input.qty,
    price_cents: input.price,
    weight_g: input.weightG,
    qty_confirmed_at: new Date().toISOString(),
  });
  await refreshListings(client, [productId]);
  revalidatePath(`/admin/catalog/${productId}`);
}

/** Stock correction with a ledger note; also counts as re-confirmed with the shop (INV-4). */
export async function setQtyAction(
  productId: string,
  variantId: string,
  form: FormData,
): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({ qty: z.coerce.number().int().min(0).max(10000), note: optional(200) })
    .parse({ qty: form.get('qty'), note: form.get('note') ?? '' });
  await setListedQty(client, id.parse(variantId), input.qty, input.note ?? undefined);
  await refreshListings(client, [productId]);
  revalidatePath(`/admin/catalog/${productId}`);
}

/** D-140: who a clothing piece is for, from the Products list; false when it did not save (the picker goes back). */
export async function setWearsAction(productId: string, wears: string): Promise<boolean> {
  const { client } = await requireAdminAction();
  try {
    await setProductWears(client, id.parse(productId), z.enum(WEARS).parse(wears));
    await refreshListings(client, [productId]);
    return true;
  } catch (error) {
    logger.error('admin.set_wears_failed', { productId, error: errorMessage(error) });
    return false;
  }
}

/** D-140 (L1): rename listings from Names to tidy; the old names are kept as each listing's shop title. */
export async function renameListingsAction(
  items: { id: string; name: string }[],
): Promise<{ ok: true; renamed: number } | { ok: false; error: string }> {
  const { client } = await requireAdminAction();
  try {
    const list = z.array(z.object({ id, name: z.string().trim().min(2).max(120) })).max(500).parse(items);
    const renamed = await renameListings(client, list);
    await refreshListings(client, list.map((l) => l.id));
    revalidatePath('/admin/catalog/names');
    return { ok: true, renamed };
  } catch (error) {
    logger.error('admin.rename_listings_failed', { error: errorMessage(error) });
    return { ok: false, error: 'The names did not save. Try again.' };
  }
}
