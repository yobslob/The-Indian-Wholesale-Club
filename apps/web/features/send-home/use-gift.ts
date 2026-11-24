'use client';

import {
  formatInr,
  giftChipsCents,
  giftFitsOrder,
  giftInrPaise,
  RELATION_NAMES,
  roundUpGiftCents,
  type CheckoutGiftBody,
  type Relation,
} from '@repo/shared/domain';

import { useMoney } from '@/features/shell/market';

import { useGiftStore } from './gift-store';
import { sendHomeNow, useSendHome } from './settings';
import { SEND_HOME_WORDS } from './words';

import type { SendHome } from '@repo/db/store';

/** Who the gift goes to, as the card and the bill name them. */
export interface GiftPerson {
  name: string;
  relation: Relation;
  savedId: string | null;
}

type GiftState = ReturnType<typeof useGiftStore.getState>;

function personOf(state: GiftState, settings: SendHome): GiftPerson | null {
  if (state.lovedOneId) {
    const saved = settings?.loved_ones.find((l) => l.id === state.lovedOneId);
    if (saved) return { name: saved.call_name, relation: saved.relation, savedId: saved.id };
  }
  if (state.lovedOne) return { name: state.lovedOne.callName || RELATION_NAMES[state.lovedOne.relation], relation: state.lovedOne.relation, savedId: null };
  return null;
}

/**
 * D-206: never more than the order. A gift fixed on a bag that has since shrunk below it falls back to the largest chip
 * the bag still allows (none: no gift).
 */
function fitted(cents: number, orderCents: number): number {
  return giftFitsOrder(cents, orderCents) ? cents : (giftChipsCents(orderCents)[0] ?? 0);
}

/** The gift the bill adds now: only once the bag's card has shown it, in the US (rule 5), and while it is not removed. */
export function useGiftCents(orderCents: number | null): number {
  const settings = useSendHome(false);
  const { market } = useMoney();
  const { started, removed, cents } = useGiftStore();
  return settings && market === 'us' && started && !removed && orderCents !== null ? fitted(cents, orderCents) : 0;
}

export interface GiftView {
  settings: NonNullable<SendHome>;
  added: boolean;
  cents: number;
  inrPaise: number;
  roundUpCents: number;
  roundUpTotalCents: number;
  chips: number[];
  /** Other stops here: the order's own total (D-206). */
  maxCents: number;
  person: GiftPerson | null;
}

/** Everything the bag's card draws, from the bag's total without the gift; null while off or unknown. */
export function useGiftView(baseTotalCents: number | null): GiftView | null {
  const settings = useSendHome(baseTotalCents !== null);
  const { market } = useMoney();
  const state = useGiftStore();
  if (!settings || market !== 'us' || baseTotalCents === null) return null;
  const roundUpCents = roundUpGiftCents(baseTotalCents);
  const chips = giftChipsCents(baseTotalCents);
  if (chips.length === 0) return null; // a bag too small for any gift (D-206)
  const cents = state.started ? fitted(state.cents, baseTotalCents) : chips[0]!;
  return {
    settings,
    added: state.started && !state.removed,
    cents,
    inrPaise: giftInrPaise(cents, settings.inr_per_usd) ?? 0,
    roundUpCents,
    roundUpTotalCents: baseTotalCents + roundUpCents,
    chips,
    maxCents: baseTotalCents,
    person: personOf(state, settings),
  };
}

/** The bag bill's words for the gift: "₹368 to Maa", or just the rupees before anyone is named. */
export function useGiftDetail(baseTotalCents: number | null): string | null {
  const view = useGiftView(baseTotalCents);
  if (!view?.added) return null;
  const inr = formatInr(view.inrPaise);
  return view.person ? SEND_HOME_WORDS.bill.lineTo(inr, view.person.name) : inr;
}

/** The checkout request's gift, from this bag's state; null when none is added or no one is named yet. */
export function giftRequestBody(): CheckoutGiftBody | null {
  const settings = sendHomeNow();
  const s = useGiftStore.getState();
  if (!settings || !s.started || s.removed || s.cents <= 0) return null;
  if (s.lovedOneId && settings.loved_ones.some((l) => l.id === s.lovedOneId)) return { cents: s.cents, lovedOneId: s.lovedOneId };
  if (s.lovedOne)
    return {
      cents: s.cents,
      lovedOne: { relation: s.lovedOne.relation, callName: s.lovedOne.callName, upi: s.lovedOne.upi, regionId: s.lovedOne.regionId, note: s.lovedOne.note },
      save: s.save,
    };
  return null;
}

/** A gift is added but no one is named: Checkout asks "Who's it for?" first (rule 7). */
export function giftNeedsName(): boolean {
  const settings = sendHomeNow();
  const s = useGiftStore.getState();
  return Boolean(settings && s.started && !s.removed && s.cents > 0 && giftRequestBody() === null);
}
