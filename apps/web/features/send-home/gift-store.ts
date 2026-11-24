'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useCart } from '@/features/cart/store';

import type { Relation } from '@repo/shared/domain';

/** A loved one typed in the sheet (a guest's, or someone new): kept for this bag, and on this device if asked. */
export interface TypedLovedOne {
  relation: Relation;
  callName: string;
  upi: string;
  regionId: string | null;
  regionName: string | null;
  note: string;
}

/**
 * D-208: where this bag's 5% saving goes. `keep` (Coins) unless the customer names someone; a returning sender starts on
 * their last loved one (set once by the bag's card, `started`). `cents` is the saving as the card last worked it out,
 * for the sheet's rupees. Kept for the tab; cleared when an order is placed or the bag empties.
 */
interface GiftState {
  started: boolean;
  keep: boolean;
  cents: number;
  lovedOneId: string | null;
  lovedOne: TypedLovedOne | null;
  save: boolean;
  /** The sheet is open, for a relation (a chip) or none (Someone else). Not kept. */
  asking: { relation: Relation | null; then: 'checkout' | null } | null;
  ask: (relation: Relation | null, then?: 'checkout' | null) => void;
  close: () => void;
  start: (lovedOneId: string | null, lovedOne: TypedLovedOne | null) => void;
  setCents: (cents: number) => void;
  keepIt: () => void;
  pickSaved: (id: string) => void;
  pickTyped: (one: TypedLovedOne, save: boolean) => void;
  reset: () => void;
}

const EMPTY = { started: false, keep: true, cents: 0, lovedOneId: null, lovedOne: null, save: false };

export const useGiftStore = create<GiftState>()(
  persist(
    (set) => ({
      ...EMPTY,
      asking: null,
      ask: (relation, then = null) => set({ asking: { relation, then } }),
      close: () => set({ asking: null }),
      start: (lovedOneId, lovedOne) => set({ started: true, lovedOneId, lovedOne, keep: !lovedOneId && !lovedOne }),
      setCents: (cents) => set({ cents }),
      keepIt: () => set({ keep: true }),
      pickSaved: (id) => set({ lovedOneId: id, lovedOne: null, keep: false }),
      pickTyped: (one, save) => set({ lovedOne: one, lovedOneId: null, save, keep: false }),
      reset: () => set({ ...EMPTY, asking: null }),
    }),
    {
      name: 'iwc-gift',
      version: 2,
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ started, keep, cents, lovedOneId, lovedOne, save }) => ({ started, keep, cents, lovedOneId, lovedOne, save }),
      // a bag from before D-208 starts again
      migrate: () => EMPTY,
    },
  ),
);

export const resetGift = (): void => useGiftStore.getState().reset();

// "for the rest of this bag": a bag that empties starts the next one fresh
if (typeof window !== 'undefined') {
  useCart.subscribe((cart) => {
    if (cart.lines.length === 0 && useGiftStore.getState().started) resetGift();
  });
}

// rule 6: a guest's last loved one lives on this device only, never on the server without an account
const DEVICE = 'iwc-loved-one';

export function deviceLovedOne(): TypedLovedOne | null {
  try {
    const v = JSON.parse(localStorage.getItem(DEVICE) ?? 'null') as TypedLovedOne | null;
    return v && typeof v.callName === 'string' && typeof v.upi === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function rememberOnDevice(one: TypedLovedOne | null): void {
  try {
    if (one) localStorage.setItem(DEVICE, JSON.stringify(one));
    else localStorage.removeItem(DEVICE);
  } catch {
    // storage blocked: the next bag asks again
  }
}
