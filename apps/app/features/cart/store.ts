import { create } from 'zustand';

/** Most pieces of one variant per order line (the server checks the same limit). */
export const MAX_QTY_PER_LINE = 10;

/**
 * The bag, on the device. Prices are only for display: checkout re-prices every
 * line on the server. Kept in memory for now (backlog: keep it across app restarts).
 */
export interface BagLine {
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

interface BagState {
  lines: BagLine[];
  add: (line: Omit<BagLine, 'quantity'>, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
}

export const useBag = create<BagState>()((set) => ({
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
}));

export function bagCount(lines: BagLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export function bagSubtotalCents(lines: BagLine[]): number {
  return lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
}
