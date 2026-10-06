'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import {
  createPromoCode,
  setSpicesCleared,
  updateBusinessDetails,
  updatePricingSettings,
  updatePromoCode,
} from '@repo/db/admin';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';
import { SETTING_FIELDS, storedValue } from '../settings-fields';

/** Empty input = not decided yet = NULL (D-047, Q-18). Never a default. */
const optionalNumber = (schema: z.ZodNumber) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v)))
    .pipe(schema.nullable());
const optionalCents = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
  .pipe(z.number().int().min(0).nullable());

/**
 * Saves every number in Settings (the list in settings-fields.ts). Empty = not decided = NULL (D-047), never a default.
 * A value that is not a number refuses the whole save. Prices follow in the database (D-075); the store refreshes.
 */
export async function updatePricingSettingsAction(form: FormData): Promise<void> {
  const { client, user } = await requireAdminAction();
  const patch: Record<string, number | null> = {};
  for (const field of SETTING_FIELDS) {
    const value = storedValue(field.kind, String(form.get(field.key) ?? ''));
    if (Number.isNaN(value) || (field.required && value === null)) {
      throw new Error(`Settings: "${field.label}" needs a number`);
    }
    patch[field.key] = value;
  }
  await updatePricingSettings(client, { ...patch, updated_by: user.id });
  revalidateTag(STORE_TAG); // prices (D-075), delivery windows and the next cycle's dates (D-008, D-063) changed
  revalidatePath('/admin/settings');
}

export async function createPromoAction(form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9_-]{3,30}$/),
      discountType: z.enum(['percentage', 'fixed']),
      value: z.coerce.number().positive(),
      minOrder: optionalCents,
      maxUses: optionalNumber(z.number().int().positive()),
      validUntil: z.string().trim(),
    })
    .parse(Object.fromEntries(form));
  await createPromoCode(client, {
    code: input.code,
    discount_type: input.discountType,
    // percentage: whole percent (≤ 100, DB CHECK); fixed: dollars → cents
    discount_value:
      input.discountType === 'percentage' ? Math.round(input.value) : Math.round(input.value * 100),
    min_order_cents: input.minOrder ?? 0,
    max_uses: input.maxUses,
    valid_until: input.validUntil ? `${input.validUntil}T23:59:59Z` : null,
  });
  revalidatePath('/admin/promotions');
}

export async function togglePromoAction(promoId: string, isActive: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await updatePromoCode(client, z.string().uuid().parse(promoId), { is_active: isActive });
  revalidatePath('/admin/promotions');
}

/** D-074: the exporter, importer, broker, FDA and contact details. */
export async function updateBusinessDetailsAction(form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (/^[a-z_]+$/.test(key) && typeof value === 'string') values[key] = value.slice(0, 500);
  }
  await updateBusinessDetails(client, values);
  revalidatePath('/admin/settings');
}

/** D-074: spice listings can be published once cleared. */
export async function updateSpicesClearedAction(cleared: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await setSpicesCleared(client, z.boolean().parse(cleared));
  revalidatePath('/admin/settings');
}
