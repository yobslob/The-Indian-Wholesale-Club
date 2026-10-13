'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { updateSourcedProduct } from '@repo/db/admin';
import { attributesSchemaFor, PRODUCT_TYPES } from '@repo/shared/domain';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

/**
 * The details customers must see (attributes.ts: fibre and care, ingredients, allergens and shelf life, material),
 * edited on a product's page: listings found by the runner arrive with whatever their shop page said (D-118).
 */
export async function updateDetailsAction(
  productId: string,
  type: string,
  form: FormData,
): Promise<void> {
  const { client } = await requireAdminAction();
  const productType = z.enum(PRODUCT_TYPES).parse(type);
  const f = (name: string) => String(form.get(name) ?? '').trim();
  const raw =
    productType === 'clothing'
      ? { fibre_content: f('fibre'), care: f('care') }
      : productType === 'home'
        ? { material: f('material'), ...(f('care') ? { care: f('care') } : {}) }
        : {
            ingredients: f('ingredients'),
            allergens: f('allergens')
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean),
            shelf_life_days: Number(f('shelfLifeDays')),
            ...(f('storage') ? { storage: f('storage') } : {}),
          };
  const attributes = attributesSchemaFor(productType).parse(raw);
  await updateSourcedProduct(client, z.string().uuid().parse(productId), { attributes });
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/catalog/${productId}`);
}
