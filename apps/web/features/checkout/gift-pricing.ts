import 'server-only';

import { z } from 'zod';

import { giftInrPaise, giftLineOf, RELATIONS, upiOf } from '@repo/shared/domain';

import { SEND_HOME_WORDS } from '@/features/send-home/words';

import type { CheckoutSendHome, SavingInput } from '@repo/db/server';


/**
 * D-208: who the order's saving goes home to (zod at the boundary). Absent or null: the customer keeps it as Coins.
 * `cents` is what the old bag sent for a paid gift (D-205): read no more, the server works the saving out itself.
 */
export const checkoutGiftSchema = z
  .object({
    cents: z.number().int().optional(),
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

export type SavingResult = { ok: true; saving: SavingInput | null } | { ok: false; message: string };

/**
 * D-208: the order's saving (worked out by the caller from the goods): sent home at the day's rate when the customer
 * named someone and Send home is open, else kept as Coins. The rupees are worked out here, never in the browser.
 */
export function priceSaving(
  settings: CheckoutSendHome,
  saveCents: number,
  gift: CheckoutGift,
  who: { userId: string | null; fullName: string },
): SavingResult {
  if (saveCents <= 0 || settings.save_pct === null) return { ok: true, saving: null };
  const keep = { ok: true as const, saving: { cents: saveCents, pct: settings.save_pct, gift: null } };
  const inrPaise = giftInrPaise(saveCents, settings.inr_per_usd);
  // nobody named, or Send home closed (no fresh rate): the saving is kept
  if (!gift || settings.rupees_per_usd === null || settings.inr_per_usd === null || inrPaise === null) return keep;

  const words = SEND_HOME_WORDS.problems;
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
    saving: {
      cents: saveCents,
      pct: settings.save_pct,
      gift: {
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
    },
  };
}
