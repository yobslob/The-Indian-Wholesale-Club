import { z } from 'zod';

import { RELATIONS, type Relation } from '@repo/shared/domain';

import { unwrap, type IwcClient } from '../client';

/** D-205: what checkout's server needs to price a Send home gift (service role). */
const checkoutSendHomeSchema = z.object({
  inr_per_usd: z.coerce.number().positive().nullable(),
  max_cents: z.number().int().positive(),
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
  inrPerUsd: number;
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
