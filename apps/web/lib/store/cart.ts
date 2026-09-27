import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartStoreItem {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  priceCents: number;
  quantity: number;
  size: string | null;
  colorName: string | null;
  imageUrl: string | null;
}

interface CartState {
  items: CartStoreItem[];
  isOpen: boolean;
  appliedPromoCode: string | null;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartStoreItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  setAppliedPromoCode: (code: string | null) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotalCents: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      appliedPromoCode: null,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      addItem: (newItem) => {
        const quantityToAdd = newItem.quantity ?? 1;
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.variantId === newItem.variantId,
          );

          if (existingIndex > -1) {
            const updatedItems = [...state.items];
            const existing = updatedItems[existingIndex];
            if (existing) {
              updatedItems[existingIndex] = {
                ...existing,
                quantity: existing.quantity + quantityToAdd,
              };
            }
            return { items: updatedItems, isOpen: true };
          }

          return {
            items: [...state.items, { ...newItem, quantity: quantityToAdd }],
            isOpen: true,
          };
        });
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((item) => item.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }

        set((state) => ({
          items: state.items.map((item) =>
            item.variantId === variantId ? { ...item, quantity } : item,
          ),
        }));
      },

      setAppliedPromoCode: (code) => {
        set({ appliedPromoCode: code ? code.trim().toUpperCase() : null });
      },

      clearCart: () => set({ items: [], appliedPromoCode: null }),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotalCents: () => {
        return get().items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
      },
    }),
    {
      name: 'root_cart_storage',
      partialize: (state) => ({
        items: state.items,
        appliedPromoCode: state.appliedPromoCode,
      }),
    },
  ),
);
