import 'server-only';

import { z } from 'zod';

import { getCheckoutSendHome, type HomeGiftInput } from '@repo/db/server';
import { formatUsd, giftInrPaise, giftLineOf, RELATIONS, upiOf } from '@repo/shared/domain';

import { SEND_HOME_WORDS } from '@/features/send-home/words';

import type { IwcClient } from '@repo/db';

/** D-205: the gift a checkout asks for (zod at the boundary; the server re-prices everything itself). */
export const checkoutGiftSchema = z
  .object({
    cents: z.number().int().min(100).max(100_000),
    lovedOneId: z.string().uuid().nullish(),
    lovedOne: z
      .object({
        relation: z.enum(RELATIONS),
        callName: z.string().trim().min(1).max(20),
        upi: z.string().trim().max(80),
        regionId: z.string().uuid().nullish(),
        note: z.string().max(60).optional(),
      })
      .nullish(),
    save: z.boolean().optional(),
  })
  .nullish();
export type CheckoutGift = z.infer<typeof checkoutGiftSchema>;

export type GiftResult = { ok: true; gift: HomeGiftInput | null } | { ok: false; message: string };

/**
 * plan §2 rules 3, 4, 11: the rate, the caps and the UPI checked again here, the rupees worked out here (never from the
 * browser). An empty rate is Send home off: the gift is dropped and the quote shows the bag without it.
 */
export async function priceGift(
  service: IwcClient,
  gift: NonNullable<CheckoutGift>,
  who: { userId: string | null; email: string; fullName: string },
): Promise<GiftResult> {
  const words = SEND_HOME_WORDS.problems;
  const settings = await getCheckoutSendHome(service, {
    userId: who.userId,
    email: who.email,
    lovedOneId: gift.lovedOneId ?? null,
  });
  const inrPaise = giftInrPaise(gift.cents, settings.inr_per_usd);
  if (settings.inr_per_usd === null || inrPaise === null) return { ok: true, gift: null };
  if (gift.cents > settings.max_cents) return { ok: false, message: words.tooMuch(formatUsd(settings.max_cents)) };
  if (settings.month_cap_cents !== null && settings.month_used_cents + gift.cents > settings.month_cap_cents)
    return { ok: false, message: words.monthCap(formatUsd(settings.month_cap_cents)) };

  const saved = settings.loved_one;
  const typed = gift.lovedOne ?? null;
  const person = saved
    ? { relation: saved.relation, callName: saved.call_name, upi: saved.upi, regionId: saved.region_id, note: saved.note }
    : typed
      ? { relation: typed.relation, callName: typed.callName, upi: typed.upi, regionId: typed.regionId ?? null, note: typed.note ?? '' }
      : null;
  if (!person) return { ok: false, message: words.noOne };
  const upi = upiOf(person.upi);
  if (!upi) return { ok: false, message: words.badUpi };
  const firstName = (settings.sender_first_name || who.fullName).trim().split(/\s+/)[0] ?? '';
  return {
    ok: true,
    gift: {
      usdCents: gift.cents,
      inrPerUsd: settings.inr_per_usd,
      inrPaise,
      relation: person.relation,
      callName: person.callName.trim().slice(0, 20),
      upi: upi.value,
      regionId: person.regionId,
      note: giftLineOf(person.note),
      senderFirstName: firstName.slice(0, 40),
      lovedOneId: saved?.id ?? null,
      save: Boolean(who.userId && !saved && gift.save),
    },
  };
}
