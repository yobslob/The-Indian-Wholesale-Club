'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { updateShipCountry } from '@repo/db/admin';

import { requireAdminAction } from '../guard';

/**
 * D-208, Admin → Countries: a country's freight a kg (what its prices carry instead of ₹2,000; empty = not sold there)
 * and whether IWC sells there. Prices abroad are worked out when they are read, so the store follows at once.
 */
export async function updateCountryAction(form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      iso2: z.string().regex(/^[A-Z]{2}$/),
      rate: z
        .string()
        .trim()
        .transform((v) => (v === '' ? null : Number(v)))
        .pipe(z.number().int().min(100).max(20000).nullable()),
      open: z.string().optional(),
    })
    .parse(Object.fromEntries(form));
  await updateShipCountry(client, input.iso2, { inr_per_kg: input.rate, open: input.open === 'on' && input.rate !== null });
  revalidatePath('/admin/countries');
}
