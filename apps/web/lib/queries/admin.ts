import {
  canTransitionOrder,
  mapTrackingMilestoneToOrderStatus,
  sanitizeTrackingEvent,
} from '@repo/shared/utils';

import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

import type {
  AdminCreateProductInput,
  AdminCreatePromoCodeInput,
  AdminCreateTrackingEventInput,
  AdminUpdateProductInput,
} from '@repo/shared/schemas';
import type {
  AdminCustomerListItem,
  AdminDashboardMetrics,
  AdminDashboardStatsRow,
  AdminInventoryItem,
  AdminOrderListItem,
  AdminProductListItem,
  AdminSalesDataPoint,
  Category,
  Database,
  OrderItem,
  OrderStatusEnum,
  OrderWithFullDetails,
  PromoCode,
  SizeEnum,
  TrackingEvent,
} from '@repo/shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ==========================================
// 1. Admin Dashboard Stats & Trends
// ==========================================

export async function getAdminDashboardStats(
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<AdminDashboardMetrics> {
  const emptyTrend: AdminSalesDataPoint[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    emptyTrend.push({ date: d.toISOString().split('T')[0], revenueCents: 0, orderCount: 0 });
  }

  try {
    // All aggregates computed in SQL (M3): no full-table fetch into JS.
    const { data, error } = await client.rpc('admin_dashboard_stats');
    if (error) throw new Error(error.message);

    const row = data as unknown as AdminDashboardStatsRow;

    return {
      totalRevenueCents: Number(row.total_revenue_cents ?? 0),
      totalOrders: Number(row.total_orders ?? 0),
      averageOrderValueCents: Number(row.average_order_value_cents ?? 0),
      pendingShipments: Number(row.pending_shipments ?? 0),
      lowStockCount: Number(row.low_stock_count ?? 0),
      // Real period-over-period comparisons - never fabricated (C9)
      revenueChangePercentage: Number(row.revenue_change_pct ?? 0),
      ordersChangePercentage: Number(row.orders_change_pct ?? 0),
      salesTrend: (row.sales_trend ?? []).map((point) => ({
        date: point.date,
        revenueCents: Number(point.revenue_cents ?? 0),
        orderCount: Number(point.order_count ?? 0),
      })),
    };
  } catch (err) {
    logger.error('admin.dashboard_stats_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Honest fallback: zeros + flag, no invented numbers (C9)
    return {
      totalRevenueCents: 0,
      totalOrders: 0,
      averageOrderValueCents: 0,
      pendingShipments: 0,
      lowStockCount: 0,
      revenueChangePercentage: 0,
      ordersChangePercentage: 0,
      salesTrend: emptyTrend,
      dataUnavailable: true,
    };
  }
}

// ==========================================
// 2. Orders Management
// ==========================================

export interface GetAdminOrdersParams {
  search?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
}

export async function getAdminOrders(
  params: GetAdminOrdersParams = {},
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{
  orders: AdminOrderListItem[];
  totalCount: number;
  page: number;
  totalPages: number;
}> {
  const { search, status, paymentStatus, page = 1, limit = 15 } = params;
  const offset = (page - 1) * limit;

  try {
    let query = client.from('orders').select('*, order_items(id)', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status as OrderStatusEnum);
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq(
        'payment_status',
        paymentStatus as Database['public']['Tables']['orders']['Row']['payment_status'],
      );
    }

    if (search) {
      const cleanSearch = search.replace(/[,()"'\\%_]/g, '').trim();
      if (cleanSearch) {
        query = query.or(
          `order_number.ilike.%${cleanSearch}%,shipping_address->>email.ilike.%${cleanSearch}%,shipping_address->>fullName.ilike.%${cleanSearch}%`,
        );
      }
    }


    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.warn('[Admin Queries] getAdminOrders error:', error.message);
      return { orders: [], totalCount: 0, page: 1, totalPages: 1 };
    }

    const items: AdminOrderListItem[] = (data || []).map((row) => {
      const addr = (row.shipping_address as Record<string, unknown>) || {};
      const orderItemsList = (row.order_items as unknown as Array<{ id: string }>) || [];
      return {
        ...row,
        customerEmail: (addr.email as string) || 'guest@example.com',
        customerName: (addr.fullName as string) || (addr.full_name as string) || 'Valued Customer',
        itemCount: orderItemsList.length,
      };
    });

    const totalCount = count || items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return { orders: items, totalCount, page, totalPages };
  } catch (err) {
    console.error('[Admin Queries] getAdminOrders exception:', err);
    return { orders: [], totalCount: 0, page: 1, totalPages: 1 };
  }
}

export async function getAdminOrderDetail(
  idOrOrderNumber: string,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<OrderWithFullDetails | null> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrOrderNumber,
    );

    let query = client.from('orders').select('*, order_items(*), tracking_events(*)');

    if (isUuid) {
      query = query.eq('id', idOrOrderNumber);
    } else {
      query = query.eq('order_number', idOrOrderNumber);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      return null;
    }

    const trackingEvents = (order.tracking_events as TrackingEvent[] | undefined) || [];
    trackingEvents.sort(
      (a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime(),
    );

    return {
      ...order,
      items: (order.order_items as OrderItem[]) || [],
      tracking_events: trackingEvents,
    };
  } catch (err) {
    console.error('[Admin Queries] getAdminOrderDetail exception:', err);
    return null;
  }
}

export async function updateAdminOrderStatus(
  orderId: string,
  payload: {
    status: OrderStatusEnum;
    trackingCode?: string | null;
    carrier?: string | null;
    notes?: string | null;
  },
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
  try {
    // Verify transition validity if status is being updated (H13)
    const { data: currentOrder } = await client
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();

    if (currentOrder && !canTransitionOrder(currentOrder.status, payload.status)) {
      return {
        success: false,
        conflict: true,
        error: `Cannot transition order status from '${currentOrder.status}' to '${payload.status}'`,
      };
    }

    const updateData: Partial<Database['public']['Tables']['orders']['Update']> = {
      status: payload.status,
      updated_at: new Date().toISOString(),
    };


    if (payload.trackingCode !== undefined) {
      updateData.tracking_code = payload.trackingCode;
    }
    if (payload.carrier !== undefined) {
      updateData.carrier = payload.carrier;
    }
    if (payload.notes !== undefined) {
      updateData.notes = payload.notes;
    }

    const { error: updateError } = await client.from('orders').update(updateData).eq('id', orderId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Automatically create a corresponding sanitized tracking event if status was updated
    const milestoneMap: Record<OrderStatusEnum, string> = {
      pending: 'Order Received',
      confirmed: 'Order Confirmed',
      processing: 'Processing & Quality Inspection',
      shipped: 'In Transit',
      in_transit: 'In Transit',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Order Cancelled',
      refunded: 'Order Refunded',
    };

    const sanitized = sanitizeTrackingEvent({
      rawStatus: payload.status,
      rawLocation: 'Carrier Regional Hub',
      rawDescription: `Order status updated to ${milestoneMap[payload.status] || payload.status}.`,
    });

    const { error: eventError } = await client.from('tracking_events').insert({
      order_id: orderId,
      status: sanitized.customerFacingStatus,
      raw_status: payload.status,
      location: sanitized.customerFacingLocation,
      description: sanitized.customerFacingDescription,
      customer_facing_status: sanitized.customerFacingStatus,
      event_timestamp: sanitized.eventTimestamp,
    });

    if (eventError) {
      // Status changed but the audit event was lost - surface it (H4)
      return {
        success: false,
        error: `Order updated but tracking event could not be recorded: ${eventError.message}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error updating order status',
    };
  }
}

// ==========================================
// 3. Products & Variants Catalog
// ==========================================

export interface GetAdminProductsParams {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export async function getAdminProducts(
  params: GetAdminProductsParams = {},
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{
  products: AdminProductListItem[];
  totalCount: number;
  page: number;
  totalPages: number;
}> {
  const { search, categoryId, isActive, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  try {
    let query = client
      .from('products')
      .select(
        '*, categories(name), product_variants(inventory_count), product_images(url, is_primary)',
        {
          count: 'exact',
        },
      );

    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId);
    }

    if (search) {
      const cleanSearch = search.replace(/[,()"'\\%_]/g, '').trim();
      if (cleanSearch) {
        query = query.or(`name.ilike.%${cleanSearch}%,slug.ilike.%${cleanSearch}%`);
      }
    }


    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.warn('[Admin Queries] getAdminProducts error:', error.message);
      return { products: [], totalCount: 0, page: 1, totalPages: 1 };
    }

    const products: AdminProductListItem[] = (data || []).map((row) => {
      const categoryData = row.categories as unknown as { name: string } | null;
      const variantsList =
        (row.product_variants as unknown as Array<{ inventory_count: number }>) || [];
      const imagesList =
        (row.product_images as unknown as Array<{ url: string; is_primary: boolean }>) || [];

      const totalStock = variantsList.reduce((sum, v) => sum + (v.inventory_count || 0), 0);
      const primaryImg = imagesList.find((i) => i.is_primary)?.url || imagesList[0]?.url || null;

      return {
        ...row,
        categoryName: categoryData?.name || null,
        variantCount: variantsList.length,
        totalStock,
        primaryImageUrl: primaryImg,
      };
    });

    const totalCount = count || products.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return { products, totalCount, page, totalPages };
  } catch (err) {
    console.error('[Admin Queries] getAdminProducts exception:', err);
    return { products: [], totalCount: 0, page: 1, totalPages: 1 };
  }
}

export async function createAdminProduct(
  payload: AdminCreateProductInput,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; productId?: string; error?: string }> {
  try {
    // 1. Insert product
    const { data: product, error: productError } = await client
      .from('products')
      .insert({
        name: payload.name,
        slug: payload.slug,
        description: payload.description || null,
        long_description: payload.longDescription || null,
        category_id: payload.categoryId || null,
        base_price_cents: payload.basePriceCents,
        compare_at_price_cents: payload.compareAtPriceCents || null,
        is_active: payload.isActive ?? true,
        is_featured: payload.isFeatured ?? false,
        tags: payload.tags || [],
      })
      .select('id')
      .single();

    if (productError || !product) {
      return { success: false, error: productError?.message || 'Failed to insert product' };
    }

    const productId = product.id;

    // 2. Insert variants if provided
    if (payload.variants && payload.variants.length > 0) {
      const variantsToInsert = payload.variants.map((v) => ({
        product_id: productId,
        sku: v.sku,
        size: v.size || null,
        color_name: v.colorName || null,
        color_hex: v.colorHex || null,
        price_cents: v.priceCents || null,
        inventory_count: v.inventoryCount || 0,
        low_stock_threshold: v.lowStockThreshold || 5,
        is_active: v.isActive ?? true,
      }));

      const { error: variantError } = await client.from('product_variants').insert(variantsToInsert);
      if (variantError) {
        // Roll back parent product creation
        await client.from('products').delete().eq('id', productId);
        return { success: false, error: `Failed to insert variants: ${variantError.message}` };
      }
    }

    // 3. Insert images if provided
    if (payload.images && payload.images.length > 0) {
      const imagesToInsert = payload.images.map((img, idx) => ({
        product_id: productId,
        url: img.url,
        alt_text: img.altText || payload.name,
        sort_order: img.sortOrder ?? idx,
        is_primary: img.isPrimary ?? idx === 0,
      }));

      const { error: imageError } = await client.from('product_images').insert(imagesToInsert);
      if (imageError) {
        // Roll back variants and product
        await client.from('product_variants').delete().eq('product_id', productId);
        await client.from('products').delete().eq('id', productId);
        return { success: false, error: `Failed to insert product images: ${imageError.message}` };
      }
    }

    return { success: true, productId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown product creation error',
    };
  }
}

export async function updateAdminProduct(
  id: string,
  payload: AdminUpdateProductInput,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Partial<Database['public']['Tables']['products']['Update']> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.slug !== undefined) updateData.slug = payload.slug;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.longDescription !== undefined) updateData.long_description = payload.longDescription;
    if (payload.categoryId !== undefined) updateData.category_id = payload.categoryId || null;
    if (payload.basePriceCents !== undefined) updateData.base_price_cents = payload.basePriceCents;
    if (payload.compareAtPriceCents !== undefined)
      updateData.compare_at_price_cents = payload.compareAtPriceCents;
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;
    if (payload.isFeatured !== undefined) updateData.is_featured = payload.isFeatured;
    if (payload.tags !== undefined) updateData.tags = payload.tags;

    const { error } = await client.from('products').update(updateData).eq('id', id);
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update product',
    };
  }
}

export async function deleteAdminProduct(
  id: string,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Soft delete product by setting is_active = false
    const { error } = await client
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    // Cascade soft-delete to product variants so they don't linger in inventory
    await client
      .from('product_variants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('product_id', id);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete product',
    };
  }
}


// ==========================================
// 4. Inventory Management
// ==========================================

export interface GetAdminInventoryParams {
  search?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}

export async function getAdminInventory(
  params: GetAdminInventoryParams = {},
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{
  inventory: AdminInventoryItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  totalUnits: number;
  lowStockTotal: number;
}> {
  const { search, lowStockOnly, page = 1, limit = 25 } = params;
  const offset = (page - 1) * limit;

  try {
    // 1. Fetch warehouse-wide aggregate counts
    const { data: allWarehouseVariants } = await client
      .from('product_variants')
      .select('inventory_count, low_stock_threshold')
      .eq('is_active', true);

    const warehouseTotalUnits = (allWarehouseVariants || []).reduce(
      (sum, v) => sum + (v.inventory_count || 0),
      0,
    );
    const warehouseLowStockCount = (allWarehouseVariants || []).filter(
      (v) => (v.inventory_count || 0) <= (v.low_stock_threshold || 5),
    ).length;

    // 2. Query paginated variants with database-level filtering
    let query = client
      .from('product_variants')
      .select('*, products(name, slug, base_price_cents, product_images(url, is_primary))', {
        count: 'exact',
      })
      .eq('is_active', true);

    if (search) {
      const cleanSearch = search.replace(/[,()"'\\%_]/g, '').trim();
      if (cleanSearch) {
        query = query.or(`sku.ilike.%${cleanSearch}%,color_name.ilike.%${cleanSearch}%`);
      }
    }

    if (lowStockOnly) {
      // Compare against each variant's own threshold, not a hardcoded 5 (N7)
      query = query.or('inventory_count.lte.low_stock_threshold');
    }

    query = query.order('inventory_count', { ascending: true }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.warn('[Admin Queries] getAdminInventory error:', error.message);
      return {
        inventory: [],
        totalCount: 0,
        page: 1,
        totalPages: 1,
        totalUnits: warehouseTotalUnits,
        lowStockTotal: warehouseLowStockCount,
      };
    }

    const items: AdminInventoryItem[] = (data || []).map((row) => {
      const prod = row.products as unknown as {
        name: string;
        slug: string;
        base_price_cents: number;
        product_images: Array<{ url: string; is_primary: boolean }>;
      } | null;

      const images = prod?.product_images || [];
      const primaryImg = images.find((i) => i.is_primary)?.url || images[0]?.url || null;

      return {
        variantId: row.id,
        productId: row.product_id,
        productName: prod?.name || 'Unknown Product',
        productSlug: prod?.slug || '',
        sku: row.sku,
        size: row.size as SizeEnum | null,
        colorName: row.color_name,
        colorHex: row.color_hex,
        priceCents: row.price_cents || prod?.base_price_cents || 0,
        inventoryCount: row.inventory_count,
        lowStockThreshold: row.low_stock_threshold,
        isLowStock: row.inventory_count <= row.low_stock_threshold && row.inventory_count > 0,
        isOutOfStock: row.inventory_count === 0,
        primaryImageUrl: primaryImg,
      };
    });

    const totalCount = count || items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      inventory: items,
      totalCount,
      page,
      totalPages,
      totalUnits: warehouseTotalUnits,
      lowStockTotal: warehouseLowStockCount,
    };
  } catch (err) {
    console.error('[Admin Queries] getAdminInventory exception:', err);
    return { inventory: [], totalCount: 0, page: 1, totalPages: 1, totalUnits: 0, lowStockTotal: 0 };
  }
}


export async function updateVariantStock(
  variantId: string,
  newQuantity: number,
  lowStockThreshold?: number,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: {
      inventory_count: number;
      low_stock_threshold?: number;
      updated_at: string;
    } = {
      inventory_count: Math.max(0, newQuantity),
      updated_at: new Date().toISOString(),
    };

    if (lowStockThreshold !== undefined) {
      updatePayload.low_stock_threshold = Math.max(0, lowStockThreshold);
    }

    const { error } = await client
      .from('product_variants')
      .update(updatePayload)
      .eq('id', variantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Stock update failed' };
  }
}

// ==========================================
// 5. Promo Codes Management
// ==========================================

export async function getAdminPromoCodes(
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<PromoCode[]> {
  try {
    const { data, error } = await client
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Admin Queries] getAdminPromoCodes error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[Admin Queries] getAdminPromoCodes exception:', err);
    return [];
  }
}

export async function createAdminPromoCode(
  payload: AdminCreatePromoCodeInput,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; promoId?: string; error?: string }> {
  try {
    const { data, error } = await client
      .from('promo_codes')
      .insert({
        code: payload.code.toUpperCase().trim(),
        discount_type: payload.discountType,
        discount_value: payload.discountValue,
        min_order_cents: payload.minOrderCents || 0,
        max_uses: payload.maxUses || null,
        valid_until: payload.validUntil || null,
        is_active: payload.isActive ?? true,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to insert promo code' };
    }

    return { success: true, promoId: data.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error creating promo code',
    };
  }
}

export async function togglePromoCodeStatus(
  id: string,
  isActive: boolean,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await client.from('promo_codes').update({ is_active: isActive }).eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update promo status',
    };
  }
}

// ==========================================
// 6. Customers Management
// ==========================================

export async function getAdminCustomers(
  params: { search?: string; page?: number; limit?: number } = {},
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{
  customers: AdminCustomerListItem[];
  totalCount: number;
  page: number;
  totalPages: number;
}> {
  const { search, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  try {
    let query = client
      .from('profiles')
      .select('*, orders(id, total_cents, created_at, payment_status)', { count: 'exact' });

    if (search) {
      const cleanSearch = search.replace(/[,()"'\\%_]/g, '').trim();
      if (cleanSearch) {
        query = query.or(`email.ilike.%${cleanSearch}%,full_name.ilike.%${cleanSearch}%`);
      }
    }


    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.warn('[Admin Queries] getAdminCustomers error:', error.message);
      return { customers: [], totalCount: 0, page: 1, totalPages: 1 };
    }

    const customers: AdminCustomerListItem[] = (data || []).map((row) => {
      const ordersList =
        (row.orders as unknown as Array<{
          id: string;
          total_cents: number;
          created_at: string;
          payment_status: string;
        }>) || [];
      // Lifetime spend counts paid orders only (M3)
      const totalSpent = ordersList.reduce(
        (sum, o) => (o.payment_status === 'paid' ? sum + (o.total_cents || 0) : sum),
        0,
      );
      const sortedOrders = [...ordersList].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        phone: row.phone,
        createdAt: row.created_at,
        orderCount: ordersList.length,
        totalSpentCents: totalSpent,
        lastOrderDate: sortedOrders[0]?.created_at || null,
      };
    });

    const totalCount = count || customers.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    return { customers, totalCount, page, totalPages };
  } catch (err) {
    console.error('[Admin Queries] getAdminCustomers exception:', err);
    return { customers: [], totalCount: 0, page: 1, totalPages: 1 };
  }
}

// ==========================================
// 7. Stealth Logistics & Tracking Events
// ==========================================

export async function addAdminTrackingEvent(
  payload: AdminCreateTrackingEventInput,
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const sanitized = sanitizeTrackingEvent({
      rawStatus: payload.status,
      rawLocation: payload.rawLocation,
      rawDescription: payload.rawDescription,
      eventTimestamp: payload.eventTimestamp,
    });

    const { data, error } = await client
      .from('tracking_events')
      .insert({
        order_id: payload.orderId,
        status: sanitized.customerFacingStatus,
        raw_status: payload.status,
        location: sanitized.customerFacingLocation,
        description: sanitized.customerFacingDescription,
        customer_facing_status: sanitized.customerFacingStatus,
        event_timestamp: sanitized.eventTimestamp,
      })
      .select('id')
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || 'Failed to insert tracking event' };
    }

    // Advance order status if milestone indicates advancement and transition is valid (H13)
    const nextOrderStatus = mapTrackingMilestoneToOrderStatus(sanitized.customerFacingStatus);

    const { data: currentOrder } = await client
      .from('orders')
      .select('status')
      .eq('id', payload.orderId)
      .maybeSingle();

    if (nextOrderStatus && currentOrder && canTransitionOrder(currentOrder.status, nextOrderStatus)) {
      const { error: statusError } = await client
        .from('orders')
        .update({ status: nextOrderStatus, updated_at: new Date().toISOString() })
        .eq('id', payload.orderId);

      if (statusError) {
        return { success: false, error: statusError.message };
      }
    }

    return { success: true, eventId: data.id };

  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error adding tracking event',
    };
  }
}

export async function getAdminLogisticsOverview(
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<{
  activeShipments: AdminOrderListItem[];
  recentEvents: TrackingEvent[];
  stats: {
    totalInTransit: number;
    deliveredCount: number;
    delayedCount: number;
    flaggedScansCount: number;
  };
}> {
  try {
    // 1. Fetch active shipments (orders with status confirmed, processing, shipped, in_transit, out_for_delivery)
    const { data: activeOrders } = await client
      .from('orders')
      .select('*, order_items(id)')
      .in('status', ['confirmed', 'processing', 'shipped', 'in_transit', 'out_for_delivery'])
      .order('created_at', { ascending: false })
      .limit(20);

    const activeShipments: AdminOrderListItem[] = (activeOrders || []).map((row) => {
      const addr = (row.shipping_address as Record<string, unknown>) || {};
      const orderItemsList = (row.order_items as unknown as Array<{ id: string }>) || [];
      return {
        ...row,
        customerEmail: (addr.email as string) || 'guest@example.com',
        customerName: (addr.fullName as string) || (addr.full_name as string) || 'Valued Customer',
        itemCount: orderItemsList.length,
      };
    });

    // 2. Fetch recent tracking events
    const { data: events } = await client
      .from('tracking_events')
      .select('*')
      .order('event_timestamp', { ascending: false })
      .limit(25);

    const recentEvents = events || [];

    // 3. Real aggregates for the KPI stats - never fabricated (C9)
    const delayedBefore = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const [deliveredRes, transitRes, delayedRes, flaggedRes] = await Promise.all([
      client.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
      client
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['shipped', 'in_transit', 'out_for_delivery']),
      // Active longer than the longest advertised window (10d > 7d standard) = delayed.
      client
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['confirmed', 'processing', 'shipped', 'in_transit', 'out_for_delivery'])
        .lt('created_at', delayedBefore),
      client
        .from('tracking_events')
        .select('id', { count: 'exact', head: true })
        .eq('customer_facing_status', 'Exception / Hub Delay'),
    ]);
    for (const res of [deliveredRes, transitRes, delayedRes, flaggedRes]) {
      if (res.error) {
        console.warn('[Admin Queries] logistics stat count failed:', res.error.message);
      }
    }

    return {
      activeShipments,
      recentEvents,
      stats: {
        totalInTransit: transitRes.count ?? 0,
        deliveredCount: deliveredRes.count ?? 0,
        delayedCount: delayedRes.count ?? 0,
        flaggedScansCount: flaggedRes.count ?? 0,
      },
    };
  } catch (err) {
    console.error('[Admin Queries] getAdminLogisticsOverview exception:', err);
    return {
      activeShipments: [],
      recentEvents: [],
      stats: {
        totalInTransit: 0,
        deliveredCount: 0,
        delayedCount: 0,
        flaggedScansCount: 0,
      },
    };
  }
}

// ==========================================
// 8. Categories Query Helper
// ==========================================

export async function getAdminCategories(
  client: SupabaseClient<Database> = supabaseAdmin,
): Promise<Category[]> {
  try {
    const { data } = await client
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    return data || [];
  } catch (err) {
    console.error('[Admin Queries] getAdminCategories exception:', err);
    return [];
  }
}
