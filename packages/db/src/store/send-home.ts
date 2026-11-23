import { z } from 'zod';

import { RELATIONS } from '@repo/shared/domain';

import { unwrap, type IwcClient } from '../client';

/**
 * D-205, Send home: what customers read, through store_* only (D-017). The whole UPI never comes back to a customer,
 * only `upi_masked`; the desk's name, the rate's cost, the hold and the full reference stay out (non-negotiable 1).
 */

const relationSchema = z.enum(RELATIONS);
const isoDateTime = z.string();

export const lovedOneSchema = z.object({
  id: z.string().uuid(),
  relation: relationSchema,
  call_name: z.string(),
  region_id: z.string().uuid().nullable(),
  region_name: z.string().nullable(),
  note: z.string(),
  upi_masked: z.string(),
});
export type LovedOne = z.infer<typeof lovedOneSchema>;

export const sendHomeSchema = z
  .object({
    inr_per_usd: z.coerce.number().positive(),
    max_cents: z.number().int().positive(),
    signed_in: z.boolean(),
    in_bag: z.boolean(),
    loved_ones: z.array(
      lovedOneSchema.extend({ last_inr_paise: z.number().int().nullable(), last_at: isoDateTime.nullable() }),
    ),
  })
  .nullable();
/** Null = Send home is off (no rate set). */
export type SendHome = z.infer<typeof sendHomeSchema>;

export const giftStatusSchema = z.enum(['sending', 'sent', 'refunded']);

/** An order's gift, on its page and the thank-you postcard. */
export const orderHomeGiftSchema = z.object({
  call_name: z.string(),
  relation: relationSchema,
  region_name: z.string().nullable(),
  note: z.string(),
  usd_cents: z.number().int(),
  inr_paise: z.number().int(),
  customer_status: giftStatusSchema,
  upi_masked: z.string(),
  utr_last4: z.string().nullable(),
  sent_at: isoDateTime.nullable(),
  so_far: z.object({ inr_paise: z.number().int(), times: z.number().int() }),
});
export type OrderHomeGift = z.infer<typeof orderHomeGiftSchema>;

export const myPeopleSchema = z
  .object({
    on: z.boolean(),
    in_bag: z.boolean(),
    total: z.object({
      inr_paise: z.number().int(),
      times: z.number().int(),
      usd_cents: z.number().int(),
      since: isoDateTime.nullable(),
    }),
    loved_ones: z.array(lovedOneSchema.extend({ sent_inr_paise: z.number().int(), times: z.number().int() })),
    history: z.array(
      z.object({
        id: z.string().uuid(),
        order_number: z.string(),
        created_at: isoDateTime,
        call_name: z.string(),
        relation: relationSchema,
        inr_paise: z.number().int(),
        usd_cents: z.number().int(),
        customer_status: giftStatusSchema,
        upi_masked: z.string(),
        utr_last4: z.string().nullable(),
        sent_at: isoDateTime.nullable(),
      }),
    ),
  })
  .nullable();
export type MyPeople = z.infer<typeof myPeopleSchema>;

/** The bag's card: on or off, the cap, and a signed-in customer's loved ones (the client is theirs, or anon). */
export async function getSendHome(client: IwcClient): Promise<SendHome> {
  return sendHomeSchema.parse(unwrap(await client.rpc('store_send_home', undefined, { get: true })));
}

/** Account → Your people at home, for the signed-in customer (their own client). */
export async function getMyPeople(client: IwcClient): Promise<MyPeople> {
  return myPeopleSchema.parse(unwrap(await client.rpc('store_my_people', undefined, { get: true })));
}
