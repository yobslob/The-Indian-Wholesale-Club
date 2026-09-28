'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { MAX_QTY_PER_LINE } from './limits';

/**
 * The cart lives on the device (storefront.md). Prices here are only for
 * display: checkout re-prices every line from the catalog on the server.
 */
export interface CartLine {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  regionSlug: string;
  regionName: string;
  variantLabel: string;
  unitPriceCents: number;
  imagePath: string | null;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  promoCode: string | null;
  add: (line: Omit<CartLine, 'quantity'>, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  setPromoCode: (code: string | null) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      promoCode: null,
      add: (line, quantity) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === line.variantId);
          if (!existing)
            return {
              lines: [...state.lines, { ...line, quantity: Math.min(quantity, MAX_QTY_PER_LINE) }],
            };
          return {
            lines: state.lines.map((l) =>
              l.variantId === line.variantId
                ? { ...l, ...line, quantity: Math.min(l.quantity + quantity, MAX_QTY_PER_LINE) }
                : l,
            ),
          };
        }),
      setQuantity: (variantId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.variantId !== variantId)
              : state.lines.map((l) =>
                  l.variantId === variantId
                    ? { ...l, quantity: Math.min(quantity, MAX_QTY_PER_LINE) }
                    : l,
                ),
        })),
      remove: (variantId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),
      setPromoCode: (code) => set({ promoCode: code ? code.trim().toUpperCase() : null }),
      clear: () => set({ lines: [], promoCode: null }),
    }),
    { name: 'iwc-cart', version: 1 },
  ),
);

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
}
