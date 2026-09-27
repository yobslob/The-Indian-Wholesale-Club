/**
 * Database types for the e-commerce platform.
 *
 * Hand-written to match supabase/migrations/20260924000001_create_schema.sql exactly.
 * Replace with auto-generated types once a Supabase project is linked:
 *   supabase gen types typescript --project-id "$PROJECT_REF" > types/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ==========================================
// Enum types matching PostgreSQL enums
// ==========================================

export type SizeEnum = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export type OrderStatusEnum =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatusEnum = 'pending' | 'paid' | 'failed' | 'refunded';

export type DiscountTypeEnum = 'percentage' | 'fixed';

// ==========================================
// Database interface (Supabase convention)
// ==========================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          default_address_id: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          default_address_id?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          default_address_id?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_default_address';
            columns: ['default_address_id'];
            isOneToOne: false;
            referencedRelation: 'addresses';
            referencedColumns: ['id'];
          },
        ];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          full_name: string;
          line1: string;
          line2: string | null;
          city: string;
          state: string;
          zip_code: string;
          country: string;
          phone: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          full_name: string;
          line1: string;
          line2?: string | null;
          city: string;
          state: string;
          zip_code: string;
          country?: string;
          phone?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string | null;
          full_name?: string;
          line1?: string;
          line2?: string | null;
          city?: string;
          state?: string;
          zip_code?: string;
          country?: string;
          phone?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'addresses_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          parent_category_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          parent_category_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          parent_category_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_category_id_fkey';
            columns: ['parent_category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          long_description: string | null;
          category_id: string | null;
          base_price_cents: number;
          compare_at_price_cents: number | null;
          currency: string;
          is_active: boolean;
          is_featured: boolean;
          tags: string[];
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          long_description?: string | null;
          category_id?: string | null;
          base_price_cents: number;
          compare_at_price_cents?: number | null;
          currency?: string;
          is_active?: boolean;
          is_featured?: boolean;
          tags?: string[];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          long_description?: string | null;
          category_id?: string | null;
          base_price_cents?: number;
          compare_at_price_cents?: number | null;
          currency?: string;
          is_active?: boolean;
          is_featured?: boolean;
          tags?: string[];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          size: SizeEnum | null;
          color_name: string | null;
          color_hex: string | null;
          price_cents: number | null;
          inventory_count: number;
          low_stock_threshold: number;
          weight_grams: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          size?: SizeEnum | null;
          color_name?: string | null;
          color_hex?: string | null;
          price_cents?: number | null;
          inventory_count?: number;
          low_stock_threshold?: number;
          weight_grams?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          sku?: string;
          size?: SizeEnum | null;
          color_name?: string | null;
          color_hex?: string | null;
          price_cents?: number | null;
          inventory_count?: number;
          low_stock_threshold?: number;
          weight_grams?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          url: string;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variant_id?: string | null;
          url: string;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          variant_id?: string | null;
          url?: string;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_images_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          variant_id: string;
          quantity: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          variant_id: string;
          quantity: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          variant_id?: string;
          quantity?: number;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cart_items_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cart_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wishlists_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'wishlists_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string | null;
          order_number: string;
          status: OrderStatusEnum;
          subtotal_cents: number;
          discount_cents: number;
          shipping_cents: number;
          tax_cents: number;
          total_cents: number;
          currency: string;
          payment_provider: string | null;
          payment_intent_id: string | null;
          payment_status: PaymentStatusEnum;
          shipping_address: Json;
          tracking_code: string | null;
          carrier: string | null;
          estimated_delivery_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          order_number?: string;
          status?: OrderStatusEnum;
          subtotal_cents: number;
          discount_cents?: number;
          shipping_cents?: number;
          tax_cents?: number;
          total_cents: number;
          currency?: string;
          payment_provider?: string | null;
          payment_intent_id?: string | null;
          payment_status?: PaymentStatusEnum;
          shipping_address: Json;
          tracking_code?: string | null;
          carrier?: string | null;
          estimated_delivery_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          order_number?: string;
          status?: OrderStatusEnum;
          subtotal_cents?: number;
          discount_cents?: number;
          shipping_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          currency?: string;
          payment_provider?: string | null;
          payment_intent_id?: string | null;
          payment_status?: PaymentStatusEnum;
          shipping_address?: Json;
          tracking_code?: string | null;
          carrier?: string | null;
          estimated_delivery_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          variant_id: string | null;
          product_name: string;
          variant_label: string | null;
          quantity: number;
          unit_price_cents: number;
          total_price_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          variant_id?: string | null;
          product_name: string;
          variant_label?: string | null;
          quantity: number;
          unit_price_cents: number;
          total_price_cents: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          variant_id?: string | null;
          product_name?: string;
          variant_label?: string | null;
          quantity?: number;
          unit_price_cents?: number;
          total_price_cents?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          order_id: string | null;
          rating: number;
          title: string | null;
          body: string | null;
          is_verified_purchase: boolean;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          order_id?: string | null;
          rating: number;
          title?: string | null;
          body?: string | null;
          is_verified_purchase?: boolean;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          order_id?: string | null;
          rating?: number;
          title?: string | null;
          body?: string | null;
          is_verified_purchase?: boolean;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      tracking_events: {
        Row: {
          id: string;
          order_id: string;
          status: string;
          raw_status: string | null;
          location: string | null;
          description: string | null;
          customer_facing_status: string | null;
          event_timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: string;
          raw_status?: string | null;
          location?: string | null;
          description?: string | null;
          customer_facing_status?: string | null;
          event_timestamp: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          status?: string;
          raw_status?: string | null;
          location?: string | null;
          description?: string | null;
          customer_facing_status?: string | null;
          event_timestamp?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tracking_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          discount_type: DiscountTypeEnum;
          discount_value: number;
          min_order_cents: number | null;
          max_uses: number | null;
          current_uses: number;
          valid_from: string | null;
          valid_until: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_type: DiscountTypeEnum;
          discount_value: number;
          min_order_cents?: number | null;
          max_uses?: number | null;
          current_uses?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          discount_type?: DiscountTypeEnum;
          discount_value?: number;
          min_order_cents?: number | null;
          max_uses?: number | null;
          current_uses?: number;
          valid_from?: string | null;
          valid_until?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          processed_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_type: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_type?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      pending_orders: {
        Row: { id: string; payment_intent_id: string; checkout_payload: Json; created_at: string; reconciled_at: string | null; reconciled_by: string | null };
        Insert: { id?: string; payment_intent_id: string; checkout_payload: Json; created_at?: string; reconciled_at?: string | null; reconciled_by?: string | null };
        Update: { id?: string; payment_intent_id?: string; checkout_payload?: Json; created_at?: string; reconciled_at?: string | null; reconciled_by?: string | null };
        Relationships: [];
      };
      email_outbox: {
        Row: { id: string; kind: string; recipient: string; payload: Json; status: string; attempts: number; next_attempt_at: string; last_error: string | null; provider_message_id: string | null; created_at: string; sent_at: string | null };
        Insert: { id?: string; kind: string; recipient: string; payload: Json; status?: string; attempts?: number; next_attempt_at?: string; last_error?: string | null; provider_message_id?: string | null; created_at?: string; sent_at?: string | null };
        Update: { id?: string; kind?: string; recipient?: string; payload?: Json; status?: string; attempts?: number; next_attempt_at?: string; last_error?: string | null; provider_message_id?: string | null; created_at?: string; sent_at?: string | null };
        Relationships: [];
      };
      admin_error_events: {
        Row: { id: string; event: string; context: Json; created_at: string };
        Insert: { id?: string; event: string; context?: Json; created_at?: string };
        Update: { id?: string; event?: string; context?: Json; created_at?: string };
        Relationships: [];
      };
      failed_reconciliations: {
        Row: { id: string; payment_intent_id: string; stripe_event_id: string | null; amount_cents: number | null; currency: string | null; customer_email: string | null; error_reason: string; metadata: Json | null; created_at: string; resolved_at: string | null; resolved_by: string | null };
        Insert: { id?: string; payment_intent_id: string; stripe_event_id?: string | null; amount_cents?: number | null; currency?: string | null; customer_email?: string | null; error_reason: string; metadata?: Json | null; created_at?: string; resolved_at?: string | null; resolved_by?: string | null };
        Update: { resolved_at?: string | null; resolved_by?: string | null };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_promo_uses: {
        Args: {
          promo_id: string;
        };
        Returns: boolean;
      };
      admin_dashboard_stats: {
        Args: Record<string, never>;
        Returns: AdminDashboardStatsRow;
      };
    };
    Enums: {

      size_enum: SizeEnum;
      order_status_enum: OrderStatusEnum;
      payment_status_enum: PaymentStatusEnum;
      discount_type_enum: DiscountTypeEnum;
    };
  };
}

// ==========================================
// Convenience type aliases for frontend use
// ==========================================

/** Shortcut to access any table's Row type */
type Tables = Database['public']['Tables'];

export type Profile = Tables['profiles']['Row'];
export type ProfileInsert = Tables['profiles']['Insert'];
export type ProfileUpdate = Tables['profiles']['Update'];

export type Address = Tables['addresses']['Row'];
export type AddressInsert = Tables['addresses']['Insert'];
export type AddressUpdate = Tables['addresses']['Update'];

export type Category = Tables['categories']['Row'];
export type CategoryInsert = Tables['categories']['Insert'];

export type Product = Tables['products']['Row'];
export type ProductInsert = Tables['products']['Insert'];
export type ProductUpdate = Tables['products']['Update'];

export type ProductVariant = Tables['product_variants']['Row'];
export type ProductVariantInsert = Tables['product_variants']['Insert'];

export type ProductImage = Tables['product_images']['Row'];
export type ProductImageInsert = Tables['product_images']['Insert'];

export type CartItem = Tables['cart_items']['Row'];
export type CartItemInsert = Tables['cart_items']['Insert'];
export type CartItemUpdate = Tables['cart_items']['Update'];

export type WishlistItem = Tables['wishlists']['Row'];
export type WishlistItemInsert = Tables['wishlists']['Insert'];

export type Order = Tables['orders']['Row'];
export type OrderInsert = Tables['orders']['Insert'];
export type OrderUpdate = Tables['orders']['Update'];

export type OrderItem = Tables['order_items']['Row'];
export type OrderItemInsert = Tables['order_items']['Insert'];

export type Review = Tables['reviews']['Row'];
export type ReviewInsert = Tables['reviews']['Insert'];
export type ReviewUpdate = Tables['reviews']['Update'];

export type TrackingEvent = Tables['tracking_events']['Row'];
export type TrackingEventInsert = Tables['tracking_events']['Insert'];

export type PromoCode = Tables['promo_codes']['Row'];

// ==========================================
// Composite types for frontend queries
// ==========================================

/** Product with its variants and images — common query shape */
export interface ProductWithDetails extends Product {
  category: Category | null;
  variants: ProductVariant[];
  images: ProductImage[];
}

/** Order with its line items — common query shape */
export interface OrderWithItems extends Order {
  items: OrderItem[];
}

/** Order with items and tracking events */
export interface OrderWithFullDetails extends Order {
  items: OrderItem[];
  tracking_events?: TrackingEvent[];
}

/** Shipping rate tier options */
export type ShippingTier = 'standard' | 'express';

/** Checkout cost calculation breakdown */
export interface CheckoutCostBreakdown {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  appliedPromo?: {
    code: string;
    discountType: DiscountTypeEnum;
    discountValue: number;
    amountCents: number;
  } | null;
}

/** Cart item joined with variant and product info */
export interface CartItemWithProduct extends CartItem {
  variant: ProductVariant & {
    product: Product & {
      images: ProductImage[];
    };
  };
}

// ==========================================
// Admin Dashboard & Logistics Types
// ==========================================

export interface AdminSalesDataPoint {
  date: string;
  revenueCents: number;
  orderCount: number;
}

/** Raw row returned by the admin_dashboard_stats() SQL function. */
export interface AdminDashboardStatsRow {
  total_revenue_cents: number;
  total_orders: number;
  average_order_value_cents: number;
  pending_shipments: number;
  low_stock_count: number;
  revenue_change_pct: number;
  orders_change_pct: number;
  sales_trend: { date: string; revenue_cents: number; order_count: number }[];
}

export interface AdminDashboardMetrics {
  totalRevenueCents: number;
  totalOrders: number;
  averageOrderValueCents: number;
  pendingShipments: number;
  lowStockCount: number;
  revenueChangePercentage: number;
  ordersChangePercentage: number;
  salesTrend: AdminSalesDataPoint[];
  /** True when stats could not be loaded (all values are zero, nothing fabricated). */
  dataUnavailable?: boolean;
}

export interface AdminOrderListItem extends Order {
  customerEmail: string;
  customerName: string;
  itemCount: number;
}

export interface AdminProductListItem extends Product {
  categoryName: string | null;
  variantCount: number;
  totalStock: number;
  primaryImageUrl: string | null;
}

export interface AdminInventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  size: SizeEnum | null;
  colorName: string | null;
  colorHex: string | null;
  priceCents: number;
  inventoryCount: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  primaryImageUrl: string | null;
}

export interface AdminCustomerListItem {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderDate: string | null;
}

export type CustomerFacingMilestone =
  | 'Order Confirmed'
  | 'Processing & Quality Inspection'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Exception / Hub Delay';

export interface SanitizedTrackingEvent {
  rawStatus: string;
  rawLocation?: string | null;
  rawDescription?: string | null;
  sanitizedStatus?: string;
  sanitizedLocation?: string;
  sanitizedDescription?: string;
  customerFacingStatus: string;
  customerFacingLocation: string;
  customerFacingDescription: string;
  customerFacingMilestone?: CustomerFacingMilestone;
  isOriginConcealed?: boolean;
  flaggedForReview: boolean;
  eventTimestamp: string;
}
