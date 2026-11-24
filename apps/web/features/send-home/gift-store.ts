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
 * D-205: this bag's gift. `started` once the bag's card has shown (only then is anything added: the card is where the
 * customer sees it); on by default (rule 7) unless the account's switch is off; × removes it for the rest of this bag.
 * Kept for the tab; cleared when an order is placed or the bag empties.
 */
interface GiftState {
  started: boolean;
  removed: boolean;
  /** Fixed once added (rule 3): a bag that changes later never moves it. */
  cents: number;
  lovedOneId: string | null;
  lovedOne: TypedLovedOne | null;
  save: boolean;
  /** The sheet is open: for a relation (a chip) or none (Someone else, Checkout), and where to go after. Not kept. */
  asking: { relation: Relation | null; then: 'checkout' | null } | null;
  ask: (relation: Relation | null, then?: 'checkout' | null) => void;
  close: () => void;
  start: (cents: number, removed: boolean, lovedOneId: string | null, lovedOne: TypedLovedOne | null) => void;
  setCents: (cents: number) => void;
  setRemoved: (removed: boolean) => void;
  pickSaved: (id: string) => void;
  pickTyped: (one: TypedLovedOne, save: boolean) => void;
  reset: () => void;
}

const EMPTY = { started: false, removed: false, cents: 0, lovedOneId: null, lovedOne: null, save: false };

export const useGiftStore = create<GiftState>()(
  persist(
    (set) => ({
      ...EMPTY,
      asking: null,
      ask: (relation, then = null) => set({ asking: { relation, then } }),
      close: () => set({ asking: null }),
      start: (cents, removed, lovedOneId, lovedOne) => set({ started: true, cents, removed, lovedOneId, lovedOne }),
      setCents: (cents) => set({ cents, removed: false }),
      setRemoved: (removed) => set({ removed }),
      pickSaved: (id) => set({ lovedOneId: id, lovedOne: null, removed: false }),
      pickTyped: (one, save) => set({ lovedOne: one, lovedOneId: null, save, removed: false }),
      reset: () => set({ ...EMPTY, asking: null }),
    }),
    {
      name: 'iwc-gift',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ started, removed, cents, lovedOneId, lovedOne, save }) => ({ started, removed, cents, lovedOneId, lovedOne, save }),
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
