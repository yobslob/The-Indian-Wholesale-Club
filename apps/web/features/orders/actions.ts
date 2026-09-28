'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { lookupGuestOrder } from '@repo/db/server';

import { errorMessage, logger } from '@/lib/logger';
import { rateLimit, RULES } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

import type { OrderDetail } from '@repo/db/store';

export type LookupState = { order: OrderDetail | null; error: string | null };

const lookupSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^IWC-\d{6}-[0-9A-F]{10}$/),
  email: z.string().trim().toLowerCase().email(),
});

/**
 * Guest order lookup (storefront.md /orders/lookup): order number + the email
 * used at checkout. Rate-limited; the same answer for "wrong email" and "no
 * such order" so it can't be used to probe for orders.
 */
export async function lookupOrderAction(_prev: LookupState, form: FormData): Promise<LookupState> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
  if (!rateLimit(`${ip}:orderLookup`, RULES.orderLookup).ok) {
    return { order: null, error: 'Too many attempts. Please wait a minute and try again.' };
  }
  const parsed = lookupSchema.safeParse({
    orderNumber: form.get('orderNumber'),
    email: form.get('email'),
  });
  const notFound: LookupState = {
    order: null,
    error: 'We could not find an order with that number and email.',
  };
  if (!parsed.success) return notFound;
  try {
    const order = await lookupGuestOrder(
      serviceClient(),
      parsed.data.orderNumber,
      parsed.data.email,
    );
    return order ? { order, error: null } : notFound;
  } catch (error) {
    logger.error('orders.lookup_failed', { error: errorMessage(error) });
    return { order: null, error: 'Something went wrong. Please try again.' };
  }
}
