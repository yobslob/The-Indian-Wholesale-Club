import { z } from 'zod';

/**
 * Validation schemas — expanded in Phase 1 & 2.
 */
export const emailSchema = z.string().email('Please enter a valid email address');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = loginSchema
  .extend({
    fullName: z.string().min(2, 'Name must be at least 2 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

export const addressSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  label: z.string().optional(),
  line1: z.string().min(3, 'Street address is required'),
  line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().regex(/^[A-Z]{2}$/, 'Please select a valid 2-letter US state code'),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid US ZIP code (e.g. 10001 or 10001-1234)'),
  country: z.string().default('US'),
  phone: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutShippingSchema = z.object({
  email: emailSchema,
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  line1: z.string().min(3, 'Street address is required'),
  line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().regex(/^[A-Z]{2}$/, 'Please select a valid 2-letter US state code'),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid US ZIP code (e.g. 10001 or 10001-1234)'),
  country: z.string().default('US'),
  phone: z.string().optional(),
});

export type CheckoutShippingInput = z.infer<typeof checkoutShippingSchema>;

export const checkoutItemSchema = z.object({
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productSlug: z.string(),
  priceCents: z.number().int().positive(),
  quantity: z.number().int().positive(),
  size: z.string().nullable().optional(),
  colorName: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;

export const createPaymentIntentSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Cart cannot be empty'),
  shippingAddress: checkoutShippingSchema,
  shippingMethod: z.enum(['standard', 'express']).default('standard'),
  promoCode: z.string().optional(),
  paymentIntentId: z
    .string()
    .regex(/^(?:pi_|mock_pi_)[A-Za-z0-9_-]+$/, 'Invalid payment intent id')
    .optional(),
  paymentProvider: z.enum(['stripe', 'stripe_simulator']).default('stripe'),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;

export const guestOrderLookupSchema = z.object({
  orderNumber: z.string().min(5, 'Order number is required'),
  email: emailSchema,
});

export type GuestOrderLookupInput = z.infer<typeof guestOrderLookupSchema>;

// ==========================================
// Admin & Logistics Schemas
// ==========================================

export const adminUpdateOrderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'refunded',
  ]),
  trackingCode: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type AdminUpdateOrderStatusInput = z.infer<typeof adminUpdateOrderStatusSchema>;

export const adminUpdateStockSchema = z.object({
  variantId: z.string().uuid(),
  inventoryCount: z.number().int().min(0, 'Inventory cannot be negative'),
  lowStockThreshold: z.number().int().min(0).optional(),
});

export type AdminUpdateStockInput = z.infer<typeof adminUpdateStockSchema>;

export const adminVariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().min(2, 'SKU is required'),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']).nullable().optional(),
  colorName: z.string().nullable().optional(),
  colorHex: z.string().nullable().optional(),
  priceCents: z.number().int().positive().nullable().optional(),
  inventoryCount: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
});

export const adminProductImageInputSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url('Must be a valid URL'),
  altText: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export const adminCreateProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  slug: z.string().min(2, 'Slug is required'),
  description: z.string().optional().nullable(),
  longDescription: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  basePriceCents: z.number().int().positive('Price must be greater than 0'),
  compareAtPriceCents: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  variants: z.array(adminVariantInputSchema).optional(),
  images: z.array(adminProductImageInputSchema).optional(),
});

export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;

export const adminUpdateProductSchema = adminCreateProductSchema.partial();
export type AdminUpdateProductInput = z.infer<typeof adminUpdateProductSchema>;

export const adminCreatePromoCodeSchema = z.object({
  code: z.string().min(2, 'Promo code must be at least 2 characters').toUpperCase(),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.number().int().positive('Discount value must be greater than 0'),
  minOrderCents: z.number().int().min(0).default(0),
  maxUses: z.number().int().positive().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type AdminCreatePromoCodeInput = z.infer<typeof adminCreatePromoCodeSchema>;

export const adminCreateTrackingEventSchema = z.object({
  orderId: z.string().uuid('Valid order ID required'),
  status: z.string().min(2, 'Status is required'),
  rawLocation: z.string().optional().nullable(),
  rawDescription: z.string().optional().nullable(),
  eventTimestamp: z.string().optional(),
});

export type AdminCreateTrackingEventInput = z.infer<typeof adminCreateTrackingEventSchema>;

export const carrierWebhookPayloadSchema = z.object({
  trackingNumber: z.string().min(2),
  carrier: z.string().default('Carrier Partner'),
  status: z.string(),
  statusDetails: z.string().optional(),
  location: z.string().optional(),
  timestamp: z.string().optional(),
  signature: z.string().optional(),
});

export type CarrierWebhookPayload = z.infer<typeof carrierWebhookPayloadSchema>;
