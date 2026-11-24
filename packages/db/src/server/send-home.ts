import { z } from 'zod';

import { RELATIONS, type Relation } from '@repo/shared/domain';

import { unwrap, type IwcClient } from '../client';

/** D-205: what checkout's server needs to price a Send home gift (service role). */
const checkoutSendHomeSchema = z.object({
  /** D-208: the % of the goods every order saves; null = no saving. */
  save_pct: z.coerce.number().positive().nullable().default(null),
  /** D-206: rupees per gift dollar as promised (the day's rate less what IWC keeps); null = off. */
  rupees_per_usd: z.coerce.number().positive().nullable(),
  /** The day's rate and the % kept, stored on the gift. */
  inr_per_usd: z.coerce.number().positive().nullable(),
  keep_pct: z.coerce.number().min(0),
  month_cap_cents: z.number().int().positive().nullable(),
  month_used_cents: z.number().int(),
  loved_one: z
    .object({
      id: z.string().uuid(),
      relation: z.enum(RELATIONS),
      call_name: z.string(),
      upi: z.string(),
      region_id: z.string().uuid().nullable(),
      note: z.string(),
    })
    .nullable(),
  sender_first_name: z.string().nullable(),
});
export type CheckoutSendHome = z.infer<typeof checkoutSendHomeSchema>;

export async function getCheckoutSendHome(
  service: IwcClient,
  input: { userId: string | null; email: string; lovedOneId: string | null },
): Promise<CheckoutSendHome> {
  return checkoutSendHomeSchema.parse(
    unwrap(
      await service.rpc('checkout_send_home', {
        // a guest has no loved ones: a uuid no profile has
        p_user: input.userId ?? '00000000-0000-0000-0000-000000000000',
        p_email: input.email,
        p_loved_one: input.lovedOneId ?? '00000000-0000-0000-0000-000000000000',
      }),
    ),
  );
}

/** The gift as create_order stores it (the snapshot the desk pays and the customer sees). */
export interface HomeGiftInput {
  usdCents: number;
  /** The day's rate at payment, and what IWC kept of it (D-206). */
  inrPerUsd: number;
  keepPct: number;
  inrPaise: number;
  relation: Relation;
  callName: string;
  upi: string;
  regionId: string | null;
  note: string;
  senderFirstName: string;
  lovedOneId: string | null;
  save: boolean;
}

export function homeGiftPayload(gift: HomeGiftInput) {
  return {
    usd_cents: gift.usdCents,
    inr_per_usd: gift.inrPerUsd,
    keep_pct: gift.keepPct,
    inr_paise: gift.inrPaise,
    relation: gift.relation,
    call_name: gift.callName,
    upi: gift.upi,
    region_id: gift.regionId,
    note: gift.note,
    sender_first_name: gift.senderFirstName,
    loved_one_id: gift.lovedOneId,
    save: gift.save,
  };
}

/** D-208: an order's saving as create_order stores it: kept as Coins, or sent home (gift: the snapshot, its dollars the saving's). */
export interface SavingInput {
  cents: number;
  pct: number;
  gift: Omit<HomeGiftInput, 'usdCents' | 'keepPct'> | null;
}

export function savingPayload(saving: SavingInput) {
  const { gift } = saving;
  return {
    cents: saving.cents,
    pct: saving.pct,
    outcome: gift ? 'gift' : 'coins',
    gift: gift ? homeGiftPayload({ ...gift, usdCents: saving.cents, keepPct: 0 }) : null,
  };
}

/** D-206: the daily check writes the day's rate (refused when out of range or 10% from the last). */
export async function setSendHomeRate(service: IwcClient, inrPerUsd: number): Promise<void> {
  unwrap(await service.rpc('set_send_home_rate', { p_rate: inrPerUsd }));
}
