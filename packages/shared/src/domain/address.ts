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
 * The shipping address snapshot stored on an order (orders.shipping_address)
 * and the checkout form. Customer-owned data, shown only to that customer.
 */
export const shippingAddressSchema = z.object({
  fullName: trimmed(2, 'Enter your full name'),
  line1: trimmed(3, 'Enter a street address'),
  line2: optionalText,
  city: trimmed(2, 'Enter a city'),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => STATE_CODES.has(v), 'Choose a US state'),
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, 'Enter a US ZIP code (12345 or 12345-6789)'),
  phone: optionalText,
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');
