import { SHIPPING_RATES } from '@repo/shared/constants';

import { logger } from '@/lib/logger';

import type {
  CheckoutCostBreakdown,
  Database,
  OrderItem,
  OrderWithFullDetails,
  PromoCode,
} from '@repo/shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CheckoutItemPayload {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  priceCents: number;
  quantity: number;
  size?: string | null;
  colorName?: string | null;
  imageUrl?: string | null;
}

// Declared as a type alias (not an interface) so TypeScript gives it an
// implicit index signature and the payload is directly assignable to the
// JSONB `shipping_address` column without an `as unknown as` cast (M13).
export type ShippingAddressPayload = {
  email: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
};

/**
 * Validate a promo code against active database promo codes.
 */
export async function validatePromoCode(
  supabase: SupabaseClient<Database>,
  code: string,
  subtotalCents: number,
): Promise<{
  valid: boolean;
  message?: string;
  promo?: PromoCode;
  discountCents: number;
}> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: 'Promo code cannot be empty', discountCents: 0 };
  }

  const { data: promo, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', cleanCode)
    .eq('is_active', true)
    .single();

  if (error || !promo) {
    return { valid: false, message: 'Invalid or expired promotional code', discountCents: 0 };
  }

  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return { valid: false, message: 'This promotion has not started yet', discountCents: 0 };
  }

  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return { valid: false, message: 'This promotional code has expired', discountCents: 0 };
  }

  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return {
      valid: false,
      message: 'This promotional code has reached its usage limit',
      discountCents: 0,
    };
  }

  if (promo.min_order_cents && subtotalCents < promo.min_order_cents) {
    const minDollars = (promo.min_order_cents / 100).toFixed(2);
    return {
      valid: false,
      message: `Minimum order amount of $${minDollars} required for this code`,
      discountCents: 0,
    };
  }

  let discountCents = 0;
  if (promo.discount_type === 'percentage') {
    discountCents = Math.round((subtotalCents * promo.discount_value) / 100);
  } else {
    // Fixed amount discount
    discountCents = Math.min(subtotalCents, promo.discount_value);
  }

  return {
    valid: true,
    promo,
    discountCents,
  };
}

/**
 * Authoritative single source of truth for checkout financial calculations, re-exported from @repo/shared/utils.
 */
export { calculateCheckoutBreakdown } from '@repo/shared/utils';

/**
 * Verify stock availability for an array of cart items against product_variants.
 */
export async function verifyVariantStock(
  supabase: SupabaseClient<Database>,
  items: CheckoutItemPayload[],
): Promise<{
  ok: boolean;
  error?: string;
  verifiedItems?: Array<{
    item: CheckoutItemPayload;
    serverPriceCents: number;
    inventoryCount: number;
  }>;
}> {
  const variantIds = items.map((i) => i.variantId);

  const { data: variants, error } = await supabase
    .from('product_variants')
    .select(
      'id, product_id, price_cents, inventory_count, is_active, products(base_price_cents, is_active)',
    )
    .in('id', variantIds);

  if (error || !variants) {
    return { ok: false, error: 'Failed to verify inventory with the catalog' };
  }

  // 1. Aggregate requested quantities by variantId to prevent split-item overselling (N16)
  const requestedQuantities = new Map<string, number>();
  for (const item of items) {
    requestedQuantities.set(
      item.variantId,
      (requestedQuantities.get(item.variantId) || 0) + item.quantity,
    );
  }

  const verifiedItems: Array<{
    item: CheckoutItemPayload;
    serverPriceCents: number;
    inventoryCount: number;
  }> = [];

  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.is_active) {
      return { ok: false, error: `Item "${item.productName}" is no longer available` };
    }

    const totalRequested = requestedQuantities.get(item.variantId) || item.quantity;
    if (variant.inventory_count < totalRequested) {
      return {
        ok: false,
        error: `Only ${variant.inventory_count} unit(s) remaining for "${item.productName}"`,
      };
    }

    const serverProduct = variant.products as {
      base_price_cents: number;
      is_active: boolean;
    } | null;
    if (serverProduct && !serverProduct.is_active) {
      return { ok: false, error: `Product "${item.productName}" is currently archived` };
    }

    const serverPrice = variant.price_cents ?? serverProduct?.base_price_cents ?? item.priceCents;

    verifiedItems.push({
      item,
      serverPriceCents: serverPrice,
      inventoryCount: variant.inventory_count,
    });
  }

  return { ok: true, verifiedItems };
}

/**
 * Inserts a finalized order and order items into Supabase.
 * Triggers in Postgres will:
 * 1. Auto-generate order_number (ORD-YYYYMMDD-XXXX)
 * 2. Deduct inventory from product_variants on order_items insert
 * 3. Restock inventory on status = 'cancelled' or 'refunded'
 */
export async function createOrderInDb(
  supabaseAdmin: SupabaseClient<Database>,
  {
    userId,
    shippingAddress,
    breakdown,
    paymentProvider = 'stripe',
    paymentIntentId,
    items,
    status = 'confirmed',
  }: {
    userId?: string | null;
    shippingAddress: ShippingAddressPayload;
    breakdown: CheckoutCostBreakdown;
    paymentProvider?: string;
    paymentIntentId?: string | null;
    items: CheckoutItemPayload[];
    status?: 'confirmed' | 'pending';
  },
): Promise<OrderWithFullDetails> {
  // Idempotency: return existing order if paymentIntentId was already processed (N13)
  if (paymentIntentId) {
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existingOrder?.id) {
      const existing = await getOrderById(supabaseAdmin, existingOrder.id);
      if (existing) {
        return existing;
      }
    }
  }

  // Delivery estimation: express window (2-3 days) vs standard window (5-7 days) (M4)
  const isExpress = breakdown.shippingCents >= SHIPPING_RATES.express.price * 100;
  const deliveryDays = isExpress
    ? SHIPPING_RATES.express.windowDays[1]
    : SHIPPING_RATES.standard.windowDays[1];
  const estimatedDeliveryDate = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // 0. Atomically claim one promo redemption BEFORE any writes (H5).
  //    increment_promo_uses() enforces max_uses + validity in one UPDATE.
  if (breakdown.appliedPromo?.code) {
    const { data: promoData, error: promoLookupError } = await supabaseAdmin
      .from('promo_codes')
      .select('id')
      .eq('code', breakdown.appliedPromo.code)
      .maybeSingle();

    if (promoLookupError) {
      throw new Error(`Promo code lookup failed: ${promoLookupError.message}`);
    }

    if (promoData?.id) {
      const { data: incremented, error: promoError } = await supabaseAdmin.rpc(
        'increment_promo_uses',
        { promo_id: promoData.id },
      );

      if (promoError) {
        throw new Error(`Failed to apply promo code: ${promoError.message}`);
      }
      if (incremented !== true) {
        throw new Error('This promotional code has reached its usage limit');
      }
    }
  }

  // 1. Insert order
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      user_id: userId ?? null,
      status,
      subtotal_cents: breakdown.subtotalCents,
      discount_cents: breakdown.discountCents,
      shipping_cents: breakdown.shippingCents,
      tax_cents: breakdown.taxCents,
      total_cents: breakdown.totalCents,
      currency: 'USD',
      payment_provider: paymentProvider,
      payment_intent_id: paymentIntentId ?? null,
        payment_status: status === 'confirmed' ? 'paid' : 'pending',
        // Type alias above makes the payload structurally assignable to the
        // JSONB column - no unchecked cast at this DB boundary (M13).
        shipping_address: shippingAddress,
      carrier: 'USPS / Regional Carrier',
      estimated_delivery_date: estimatedDeliveryDate,
    })
    .select('*')
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order record: ${orderError?.message}`);
  }

  // 2. Insert line items
  const lineItemsToInsert = items.map((item) => ({
    order_id: order.id,
    variant_id: item.variantId,
    product_name: item.productName,
    variant_label: [item.colorName, item.size].filter(Boolean).join(' / ') || null,
    quantity: item.quantity,
    unit_price_cents: item.priceCents,
    total_price_cents: item.priceCents * item.quantity,
  }));

  const { data: orderItems, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .insert(lineItemsToInsert)
    .select('*');

  if (itemsError || !orderItems) {
    // Roll back order shell on line items insertion error (H4)
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    throw new Error(`Failed to insert order items: ${itemsError?.message}`);
  }

  // 3. Create initial tracking event - failure is logged loudly, order stands (H4)
  const { error: initialEventError } = await supabaseAdmin.from('tracking_events').insert({
    order_id: order.id,
    status: 'ORDER_PLACED',
    customer_facing_status: 'Order Confirmed',
    description: 'We have received your order and are preparing your items.',
    location: 'Regional Sorting Facility',
    event_timestamp: new Date().toISOString(),
  });

  if (initialEventError) {
    logger.error('orders.initial_tracking_event_failed', {
      orderId: order.id,
      error: initialEventError.message,
    });
  }

  return {
    ...order,
    items: (orderItems as OrderItem[]) || [],
  };
}


/**
 * Fetch an order by UUID with items and tracking events.
 */
export async function getOrderById(
  supabase: SupabaseClient<Database>,
  orderId: string,
): Promise<OrderWithFullDetails | null> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*), tracking_events(*)')
    .eq('id', orderId)
    .single();

  if (error || !order) return null;

  const { order_items, tracking_events, ...orderData } =
    order as unknown as Database['public']['Tables']['orders']['Row'] & {
      order_items: OrderItem[];
      tracking_events: Database['public']['Tables']['tracking_events']['Row'][];
    };

  return {
    ...orderData,
    items: order_items || [],
    tracking_events: tracking_events || [],
  };
}

/**
 * Fetch an order by order_number and verify security match with email.
 */
export async function getOrderByNumber(
  supabase: SupabaseClient<Database>,
  orderNumber: string,
  email: string,
): Promise<OrderWithFullDetails | null> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*), tracking_events(*)')
    .eq('order_number', orderNumber.trim())
    .single();

  if (error || !order) return null;

  // Security check: verify email from shipping_address matches
  const shipping = order.shipping_address as { email?: string };
  if (!shipping.email || shipping.email.toLowerCase() !== email.trim().toLowerCase()) {
    return null;
  }

  const { order_items, tracking_events, ...orderData } =
    order as unknown as Database['public']['Tables']['orders']['Row'] & {
      order_items: OrderItem[];
      tracking_events: Database['public']['Tables']['tracking_events']['Row'][];
    };

  return {
    ...orderData,
    items: order_items || [],
    tracking_events: tracking_events || [],
  };
}
