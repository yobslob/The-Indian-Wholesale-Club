'use client';

import { giftInrPaise, RELATION_NAMES, savingCents, type CheckoutGiftBody, type Relation } from '@repo/shared/domain';

import { useGiftStore } from './gift-store';
import { sendHomeNow, useSendHome } from './settings';

import type { SendHome } from '@repo/db/store';

/** Who the saving goes to, as the card and checkout name them. */
export interface GiftPerson {
  name: string;
  relation: Relation;
  savedId: string | null;
}

type GiftState = ReturnType<typeof useGiftStore.getState>;

function personOf(state: GiftState, settings: NonNullable<SendHome>): GiftPerson | null {
  if (state.lovedOneId) {
    const saved = settings.loved_ones.find((l) => l.id === state.lovedOneId);
    if (saved) return { name: saved.call_name, relation: saved.relation, savedId: saved.id };
  }
  if (state.lovedOne) return { name: state.lovedOne.callName || RELATION_NAMES[state.lovedOne.relation], relation: state.lovedOne.relation, savedId: null };
  return null;
}

export interface SavingView {
  settings: NonNullable<SendHome>;
  /** 5% of the goods (D-208). */
  cents: number;
  /** What it is in rupees today; null while Send home is closed (then it can only be kept). */
  inrPaise: number | null;
  /** D-211: Send it home is picked (and open); false = Keep it, as Coins. */
  sending: boolean;
  /** Who it goes to; null while sending = nobody picked yet (Checkout asks), or kept. */
  person: GiftPerson | null;
}

/** Everything the bag's card and checkout's line draw, from the bag's goods; null while off, unknown or nothing saved. */
export function useSavingView(goodsCents: number | null): SavingView | null {
  const settings = useSendHome(goodsCents !== null);
  const state = useGiftStore();
  if (!settings || goodsCents === null) return null;
  const cents = savingCents(goodsCents, settings.save_pct);
  if (cents <= 0) return null;
  const inrPaise = giftInrPaise(cents, settings.inr_per_usd);
  const sending = !state.keep && inrPaise !== null;
  const person = sending ? personOf(state, settings) : null;
  return { settings, cents, inrPaise, sending, person };
}

/** The checkout request's `gift`: who the saving goes home to; null = kept as Coins (D-208). */
export function giftRequestBody(): CheckoutGiftBody | null {
  const settings = sendHomeNow();
  const s = useGiftStore.getState();
  if (!settings || settings.inr_per_usd === null || s.keep) return null;
  if (s.lovedOneId && settings.loved_ones.some((l) => l.id === s.lovedOneId)) return { lovedOneId: s.lovedOneId };
  if (s.lovedOne)
    return {
      lovedOne: { relation: s.lovedOne.relation, callName: s.lovedOne.callName, upi: s.lovedOne.upi, regionId: s.lovedOne.regionId, note: s.lovedOne.note },
      save: s.save,
    };
  return null;
}
