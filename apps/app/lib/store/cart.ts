import { create } from 'zustand';

import { calculateShipping, calculateTax } from '@repo/shared/utils';

import { apiPost } from '../api';

export interface MobileCartItem {
  id: string; // Composite key: `${variantId}_${size}_${color}`
  productId: string;
  variantId: string;
  productSlug: string;
  title: string;
  price: number; // in cents
  originalPrice?: number | null;
  imageUrl: string;
  size: string;
  color: string;
  quantity: number;
}

export type PromoDiscountType = 'percentage' | 'fixed';

interface ValidatePromoResponse {
  valid: boolean;
  message?: string;
  promo?: { code: string; discount_type: PromoDiscountType; discount_value: number };
  discountCents: number;
}

export interface CartState {
  items: MobileCartItem[];
  promoCode: string | null;
  promoDiscountType: PromoDiscountType | null;
  promoDiscountValue: number;
  shippingMethod: 'standard' | 'express';
  addItem: (
    item: Omit<MobileCartItem, 'id' | 'quantity'> & { quantity?: number },
  ) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  applyPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromoCode: () => void;
  setShippingMethod: (method: 'standard' | 'express') => void;
  getItemCount: () => number;
  getSubtotalCents: () => number;
  getDiscountCents: () => number;
  getShippingCents: () => number;
  getTotalCents: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  promoCode: null,
  promoDiscountType: null,
  promoDiscountValue: 0,
  shippingMethod: 'standard',

  addItem: (newItem) => {
    const compositeId = `${newItem.variantId}_${newItem.size}_${newItem.color}`;
    const qty = newItem.quantity ?? 1;

    set((state) => {
      const existingIndex = state.items.findIndex((item) => item.id === compositeId);

      if (existingIndex > -1) {
        const updated = [...state.items];
        const existing = updated[existingIndex];
        if (existing) {
          updated[existingIndex] = {
            ...existing,
            quantity: existing.quantity + qty,
          };
        }
        return { items: updated };
      }

      return {
        items: [
          ...state.items,
          {
            ...newItem,
            id: compositeId,
            quantity: qty,
          },
        ],
      };
    });
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id);
      return;
    }

    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, quantity } : item)),
    }));
  },

  clearCart: () => {
    set({ items: [], promoCode: null, promoDiscountType: null, promoDiscountValue: 0 });
  },

  // Server-validated promo codes (L3): the same endpoint the web uses,
  // so mobile can only apply codes that exist in the database.
  applyPromoCode: async (code) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      return { success: false, message: 'Enter a promo code' };
    }

    const subtotalCents = get().getSubtotalCents();
    const res = await apiPost<ValidatePromoResponse>('/api/checkout/validate-promo', {
      code: normalized,
      subtotalCents,
    });

    if (!res.ok || !res.data?.valid || !res.data.promo) {
      return {
        success: false,
        message: res.data?.message ?? res.error ?? 'Invalid promo code',
      };
    }

    const promo = res.data.promo;
    set({
      promoCode: promo.code,
      promoDiscountType: promo.discount_type,
      promoDiscountValue: promo.discount_value,
    });

    return {
      success: true,
      message:
        promo.discount_type === 'percentage'
          ? `${promo.discount_value}% discount applied!`
          : 'Promo code applied!',
    };
  },

  removePromoCode: () => {
    set({ promoCode: null, promoDiscountType: null, promoDiscountValue: 0 });
  },

  setShippingMethod: (method) => {
    set({ shippingMethod: method });
  },

  getItemCount: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0);
  },

  getSubtotalCents: () => {
    return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
  },

  getDiscountCents: () => {
    const { promoDiscountType, promoDiscountValue } = get();
    const subtotal = get().getSubtotalCents();

    if (!promoDiscountType || promoDiscountValue <= 0) return 0;
    if (promoDiscountType === 'percentage') {
      return Math.round((subtotal * promoDiscountValue) / 100);
    }
    return Math.min(subtotal, promoDiscountValue);
  },

  getShippingCents: () => {
    const subtotal = get().getSubtotalCents();
    const discount = get().getDiscountCents();
    const method = get().shippingMethod;
    const discounted = Math.max(0, subtotal - discount);

    return calculateShipping(discounted, method, get().promoCode);
  },

  getTotalCents: () => {
    const subtotal = get().getSubtotalCents();
    const discount = get().getDiscountCents();
    const shipping = get().getShippingCents();
    const discounted = Math.max(0, subtotal - discount);
    const tax = calculateTax(discounted + shipping);

    return Math.max(0, discounted + shipping + tax);
  },
}));
