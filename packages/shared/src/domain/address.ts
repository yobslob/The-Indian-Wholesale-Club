import { z } from 'zod';

import { US_STATES } from './us-states';

const STATE_CODES = new Set<string>(US_STATES.map((s) => s.code));

const trimmed = (min: number, message: string) => z.string().trim().min(min, message);
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/**
 * The shipping address snapshot stored on an order (orders.shipping_address) and the checkout form. Customer-owned data,
 * shown only to that customer. D-208: any country IWC sells in (`country`, ISO code, the US when absent): a US address
 * keeps its state and ZIP checks; elsewhere the region is optional free text and the postal code free (2 – 12 letters,
 * digits, spaces or dashes), since formats differ by country. Which countries are open is the server's to say.
 */
export const shippingAddressSchema = z
  .object({
    fullName: trimmed(2, 'Enter your full name'),
    line1: trimmed(3, 'Enter a street address'),
    line2: optionalText,
    city: trimmed(2, 'Enter a city'),
    state: z.string().trim().max(60).default(''),
    zipCode: z.string().trim().max(12),
    phone: optionalText,
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Choose a country')
      .default('US'),
  })
  .superRefine((a, ctx) => {
    if (a.country === 'US') {
      if (!STATE_CODES.has(a.state.toUpperCase())) ctx.addIssue({ code: 'custom', path: ['state'], message: 'Choose a US state' });
      if (!/^\d{5}(-\d{4})?$/.test(a.zipCode))
        ctx.addIssue({ code: 'custom', path: ['zipCode'], message: 'Enter a US ZIP code (12345 or 12345-6789)' });
    } else if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(a.zipCode)) {
      ctx.addIssue({ code: 'custom', path: ['zipCode'], message: 'Enter a postal code' });
    }
  })
  .transform((a) => (a.country === 'US' ? { ...a, state: a.state.toUpperCase() } : a));

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');
