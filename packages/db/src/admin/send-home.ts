import { z } from 'zod';

import { RELATIONS } from '@repo/shared/domain';

import { unwrap, type IwcClient } from '../client';

/**
 * D-205, Admin → Send home: the India desk's queue and its two moves. The admin's own client, so RLS and the functions'
 * `is_admin()` are the gate. The whole UPI is here: the desk pays it.
 */

export const SEND_HOME_TABS = ['to_send', 'on_hold', 'sent', 'failed'] as const;
export type SendHomeTab = (typeof SEND_HOME_TABS)[number];

const deskGiftSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  order_number: z.string(),
  customer: z.string(),
  call_name: z.string(),
  relation: z.enum(RELATIONS),
  region_name: z.string().nullable(),
  upi: z.string(),
  note: z.string(),
  sender_first_name: z.string(),
  usd_cents: z.number().int(),
  inr_paise: z.number().int(),
  status: z.enum(['on_hold', 'to_send', 'sent', 'failed', 'refunded', 'cancelled']),
  held: z.boolean(),
  paid_at: z.string(),
  hold_until: z.string().nullable(),
  sent_at: z.string().nullable(),
  utr: z.string().nullable(),
  failed_reason: z.string().nullable(),
  /** D-208: iwc = an order's saving (nothing to refund: it becomes Coins); customer = paid with the order (D-205). */
  funded_by: z.enum(['customer', 'iwc']).default('customer'),
});
export type DeskGift = z.infer<typeof deskGiftSchema>;

const queueSchema = z.object({
  /** D-206: the day's rate, when it was checked, and whether Send home is open now. */
  rate: z.object({
    inr_per_usd: z.coerce.number().nullable(),
    at: z.string().nullable(),
    keep_pct: z.coerce.number().nullable(),
    open: z.boolean(),
    live: z.boolean(),
  }),
  counts: z.object({ to_send: z.number().int(), to_send_inr_paise: z.number().int(), on_hold: z.number().int() }),
  gifts: z.array(deskGiftSchema),
});
export type SendHomeQueue = z.infer<typeof queueSchema>;

export async function getSendHomeQueue(client: IwcClient, tab: SendHomeTab): Promise<SendHomeQueue> {
  return queueSchema.parse(unwrap(await client.rpc('admin_send_home', { p_tab: tab }, { get: true })));
}

export async function markHomeGiftSent(client: IwcClient, giftId: string, utr: string): Promise<void> {
  unwrap(await client.rpc('admin_home_gift_sent', { p_gift: giftId, p_utr: utr }));
}

/** After Stripe refunded the gift alone: Stripe's own total refunded so far, so the webhook never counts it twice. */
export async function recordHomeGiftFailed(
  client: IwcClient,
  input: { giftId: string; reason: string; refundId: string; refundedTotalCents: number | null },
): Promise<void> {
  unwrap(
    await client.rpc('admin_home_gift_failed', {
      p_gift: input.giftId,
      p_reason: input.reason,
      p_refund_id: input.refundId,
      p_refunded_total: input.refundedTotalCents as number,
    }),
  );
}

/** D-208: a saving's gift that could not go: into the customer's Coins (nothing to refund, IWC paid it). */
export async function recordSavingGiftFailed(client: IwcClient, giftId: string, reason: string): Promise<void> {
  unwrap(await client.rpc('admin_saving_gift_failed', { p_gift: giftId, p_reason: reason }));
}

/** One gift with its order's payment, for the refund (Couldn't send). */
export async function getHomeGiftForRefund(client: IwcClient, giftId: string) {
  const rows = unwrap(
    await client
      .from('home_gifts')
      .select('id, status, usd_cents, order_id, orders(payment_intent_id)')
      .eq('id', giftId)
      .limit(1),
  );
  return rows[0] ?? null;
}
