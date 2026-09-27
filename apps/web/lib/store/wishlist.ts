import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WishlistProduct {
  productId: string;
  slug: string;
  name: string;
  basePriceCents: number;
  compareAtPriceCents?: number | null;
  imageUrl?: string | null;
}

interface WishlistState {
  items: WishlistProduct[];
  addItem: (product: WishlistProduct) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: WishlistProduct) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        set((state) => {
          if (state.items.some((i) => i.productId === product.productId)) {
            return state;
          }
          return { items: [...state.items, product] };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      toggleItem: (product) => {
        const exists = get().items.some((i) => i.productId === product.productId);
        if (exists) {
          get().removeItem(product.productId);
        } else {
          get().addItem(product);
        }
      },

      isInWishlist: (productId) => {
        return get().items.some((i) => i.productId === productId);
      },

      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: 'root_wishlist_storage',
    },
  ),
);
