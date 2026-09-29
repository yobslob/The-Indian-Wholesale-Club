'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { createPromoCode, updatePricingSettings, updatePromoCode } from '@repo/db/admin';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

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

export async function updatePricingSettingsAction(form: FormData): Promise<void> {
  const { client, user } = await requireAdminAction();
  const input = z
    .object({
      fx: optionalNumber(z.number().positive()),
      freightPerKg: optionalCents,
      dutyPct: optionalNumber(z.number().min(0).max(100)),
      marginPct: optionalNumber(z.number().min(0).max(1000)),
      domesticMin: optionalNumber(z.number().int().min(0).max(60)),
      domesticMax: optionalNumber(z.number().int().min(0).max(60)),
      staleDays: optionalNumber(z.number().int().min(1).max(365)),
      shippingFlat: optionalCents,
      freeShippingMin: optionalCents,
      expressShipping: optionalCents,
      expressMin: optionalNumber(z.number().int().min(0).max(60)),
      expressMax: optionalNumber(z.number().int().min(0).max(60)),
    })
    .parse(Object.fromEntries(form));
  await updatePricingSettings(client, {
    fx_inr_per_usd: input.fx,
    freight_cents_per_kg: input.freightPerKg,
    duty_pct: input.dutyPct,
    margin_pct: input.marginPct,
    domestic_days_min: input.domesticMin,
    domestic_days_max: input.domesticMax,
    stale_listing_days: input.staleDays,
    shipping_flat_cents: input.shippingFlat,
    free_shipping_min_cents: input.freeShippingMin,
    express_shipping_cents: input.expressShipping,
    express_days_min: input.expressMin,
    express_days_max: input.expressMax,
    updated_by: user.id,
  });
  revalidateTag(STORE_TAG); // delivery windows use the domestic days (D-008)
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
