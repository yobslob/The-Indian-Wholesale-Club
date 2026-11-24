import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Most pieces of one variant per order line (the server checks the same limit). */
export const MAX_QTY_PER_LINE = 10;

/**
 * The bag, on the device. Prices are only for display: checkout re-prices every
 * line on the server. Kept on the device across app restarts (B-16), like the website keeps it in the browser.
 */
export interface BagLine {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  /** Null for an all-India piece (D-121). */
  regionSlug: string | null;
  regionName: string | null;
  variantLabel: string;
  unitPriceCents: number;
  imagePath: string | null;
  quantity: number;
  /** D-208: the country unitPriceCents is for (absent: the US); country-bag.ts keeps it the shopper's. */
  priceCountry?: string;
}

interface BagState {
  lines: BagLine[];
  add: (line: Omit<BagLine, 'quantity'>, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  /** D-208: lines priced again in `country`. */
  reprice: (country: string, prices: Record<string, number>) => void;
}

export const useBag = create<BagState>()(
  persist(
    (set) => ({
  lines: [],
  add: (line, quantity) =>
    set((state) => {
      const existing = state.lines.find((l) => l.variantId === line.variantId);
      if (!existing) {
        return {
          lines: [...state.lines, { ...line, quantity: Math.min(quantity, MAX_QTY_PER_LINE) }],
        };
      }
      return {
        lines: state.lines.map((l) =>
          l.variantId === line.variantId
            ? { ...l, ...line, quantity: Math.min(l.quantity + quantity, MAX_QTY_PER_LINE) }
            : l,
        ),
      };
    }),
  reprice: (country, prices) =>
    set((state) => ({
      lines: state.lines.map((l) =>
        prices[l.variantId] === undefined ? l : { ...l, unitPriceCents: prices[l.variantId]!, priceCountry: country },
      ),
    })),
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
  clear: () => set({ lines: [] }),
    }),
    {
      name: 'iwc-bag',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Only the lines are saved; the functions come from the code.
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

export function bagCount(lines: BagLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export function bagSubtotalCents(lines: BagLine[]): number {
  return lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
}
