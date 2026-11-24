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
    /** D-208: the % of the goods every order saves (5). */
    save_pct: z.coerce.number().positive(),
    /** Rupees per dollar sent home (D-206: the day's rate; D-208: IWC keeps nothing); null = Send home closed. */
    inr_per_usd: z.coerce.number().positive().nullable(),
    signed_in: z.boolean(),
    in_bag: z.boolean(),
    loved_ones: z.array(
      lovedOneSchema.extend({ last_inr_paise: z.number().int().nullable(), last_at: isoDateTime.nullable() }),
    ),
  })
  .nullable();
/** Null = no saving (Settings' save % empty). */
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
  /** D-208: iwc = the order's saving sent home; customer = a gift paid with the order (before 2026-11-24). */
  funded_by: z.enum(['customer', 'iwc']).default('customer'),
});
export type OrderHomeGift = z.infer<typeof orderHomeGiftSchema>;

/** D-208: an order's 5% saving and where it went. */
export const orderSavingSchema = z.object({
  save_cents: z.number().int(),
  outcome: z.enum(['gift', 'coins']),
  /** Coins in the wallet (false for a guest until an account with their email exists). */
  credited: z.boolean(),
  taken_back: z.boolean(),
  /** The desk could not send it, so it became Coins. */
  gift_failed: z.boolean(),
});
export type OrderSaving = z.infer<typeof orderSavingSchema>;

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
    /** D-208: what the customer kept as Coins. */
    kept: z.object({ cents: z.number().int(), times: z.number().int() }).default({ cents: 0, times: 0 }),
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
