import { create } from 'zustand';

export interface WishlistState {
  productIds: string[];
  toggleItem: (productId: string) => void;
  hasItem: (productId: string) => boolean;
  removeItem: (productId: string) => void;
  getCount: () => number;
}

export function getWishlistIdsAfterToggle(productIds: string[], productId: string): string[] {
  return productIds.includes(productId)
    ? productIds.filter((id) => id !== productId)
    : [...productIds, productId];
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  productIds: [],

  toggleItem: (productId: string) => {
    set((state) => ({ productIds: getWishlistIdsAfterToggle(state.productIds, productId) }));
  },

  hasItem: (productId: string) => {
    return get().productIds.includes(productId);
  },

  removeItem: (productId: string) => {
    set((state) => ({
      productIds: state.productIds.filter((id) => id !== productId),
    }));
  },

  getCount: () => {
    return get().productIds.length;
  },
}));
