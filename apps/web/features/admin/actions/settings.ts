'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

import { getPricingSettings, updateBusinessDetails, updatePricingSettings } from '@repo/db/admin';

import { STORE_TAG } from '@/features/catalog/data';
import { checkDayRate } from '@/features/send-home/day-rate';
import { logger, errorMessage } from '@/lib/logger';

import { requireAdminAction } from '../guard';
import { SETTING_FIELDS, storedValue } from '../settings-fields';

/**
 * Saves the numbers in Settings that changed (the list in settings-fields.ts). Empty = not decided = NULL (D-047), never
 * a default. A value that is not a number refuses the whole save. Only what changed is written: writing the home & gifts
 * estimate re-prices listings even at the same value (D-187), and an unchanged form refreshes no store page.
 */
export async function updatePricingSettingsAction(form: FormData): Promise<void> {
  const { client, user } = await requireAdminAction();
  const saved = (await getPricingSettings(client)) as unknown as Record<string, number | string | null>;
  const patch: Record<string, number | null> = {};
  for (const field of SETTING_FIELDS) {
    const value = storedValue(field.kind, String(form.get(field.key) ?? ''));
    if (Number.isNaN(value) || (field.required && value === null)) {
      throw new Error(`Settings: "${field.label}" needs a number`);
    }
    const before = saved[field.key];
    if (value !== (before === null || before === undefined ? null : Number(before))) patch[field.key] = value;
  }
  if (Object.keys(patch).length > 0) {
    await updatePricingSettings(client, { ...patch, updated_by: user.id });
    revalidateTag(STORE_TAG); // the free line, delivery days and prices the store shows
  }
  // D-208: Send home switched on checks today's rate at once (the timer only runs at 03:15 UTC); a failed check leaves
  // it closed until the timer or Admin → Send home's Check now
  if (patch.send_home_open === 1) {
    await checkDayRate(client).catch((error: unknown) => logger.warn('send_home.rate_on_open_failed', { error: errorMessage(error) }));
    revalidatePath('/admin/send-home');
  }
  revalidatePath('/admin/settings');
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
