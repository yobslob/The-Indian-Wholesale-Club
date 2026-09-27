import { SHIPPING_RATES } from '@repo/shared/constants';

import { apiGet } from '../api';
import { isSupabaseConfigured, supabase } from '../supabase';

import type {
  Category,
  OrderItem,
  OrderWithFullDetails,
  ProductWithDetails,
  TrackingEvent,
} from '@repo/shared/types';

// =============================================================================
// Query Functions
// =============================================================================

export async function fetchCategories(): Promise<Category[]> {
  // No hard-coded catalog (R2): an unconfigured app shows an empty catalog.
  if (!isSupabaseConfigured) {
    console.warn('[catalog] Supabase is not configured (EXPO_PUBLIC_SUPABASE_*)');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn('[catalog] fetchCategories failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchCategoryById(id: string): Promise<Category | null> {
  const categories = await fetchCategories();
  return categories.find((c) => c.id === id || c.slug === id) ?? null;
}

export interface FetchProductsOptions {
  categoryId?: string;
  search?: string;
  featuredOnly?: boolean;
  sortBy?: 'featured' | 'price_low' | 'price_high' | 'name';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeSearchTerm(raw: string): string {
  return raw.replace(/[,()"'\\%_]/g, '').trim();
}

const PRODUCT_SELECT = '*, category:categories(*), variants:product_variants(*), images:product_images(*)';

export async function fetchProducts(
  options: FetchProductsOptions = {},
): Promise<ProductWithDetails[]> {
  const { categoryId, search, featuredOnly, sortBy } = options;

  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    let query = supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('is_active', true);

    if (categoryId && categoryId !== 'cat-all') {
      const categoryQuery = UUID_RE.test(categoryId)
        ? await supabase.from('categories').select('id').eq('id', categoryId).maybeSingle()
        : await supabase.from('categories').select('id').eq('slug', categoryId).maybeSingle();
      if (categoryQuery.error) throw categoryQuery.error;
      if (!categoryQuery.data) return [];
      query = query.eq('category_id', categoryQuery.data.id);
    }

    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }

    const cleanSearch = search ? escapeSearchTerm(search) : '';
    if (cleanSearch) {
      query = query.or(
        `name.ilike.%${cleanSearch}%,slug.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%,long_description.ilike.%${cleanSearch}%`,
      );
    }

    switch (sortBy) {
      case 'price_low':
        query = query.order('base_price_cents', { ascending: true });
        break;
      case 'price_high':
        query = query.order('base_price_cents', { ascending: false });
        break;
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;

    let products = (data ?? []) as unknown as ProductWithDetails[];

    // Tag fallback (M9): TEXT[] contains when text fields match nothing
    if (products.length === 0 && cleanSearch) {
      const { data: tagData, error: tagError } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('is_active', true)
        .contains('tags', [cleanSearch])
        .order('created_at', { ascending: false })
        .limit(100);
      if (tagError) throw tagError;
      products = (tagData ?? []) as unknown as ProductWithDetails[];
    }

    return products;
  } catch (err) {
    console.warn('[catalog] fetchProducts failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchProductById(id: string): Promise<ProductWithDetails | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    let query = supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('is_active', true);

    query = UUID_RE.test(id) ? query.eq('id', id) : query.eq('slug', id);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as unknown as ProductWithDetails) ?? null;
  } catch (err) {
    console.warn('[catalog] fetchProductById failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// =============================================================================
// Orders & Tracking Query (guest lookup via web API, C2-authorized email match)
// =============================================================================

interface OrderApiTrackingEvent {
  id?: string;
  status?: string;
  raw_status?: string;
  location?: string | null;
  description?: string | null;
  customer_facing_status?: string;
  event_timestamp?: string;
  created_at?: string;
}

interface OrderApiResponse {
  order?: {
    id?: string;
    created_at?: string;
    estimated_delivery_date?: string | null;
    items?: OrderItem[];
    order_items?: OrderItem[];
    tracking_events?: OrderApiTrackingEvent[];
  } & Record<string, unknown>;
  error?: string;
}

function formatEstimatedDelivery(): string {
  return new Date(
    Date.now() + SHIPPING_RATES.standard.windowDays[1] * 86400000,
  ).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function fetchOrderDetails(
  orderIdOrNumber: string,
  email?: string,
): Promise<OrderWithFullDetails | null> {
  const query = email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : '';
  const res = await apiGet<OrderApiResponse>(
    `/api/orders/${encodeURIComponent(orderIdOrNumber)}${query}`,
  );

  if (!res.ok || !res.data?.order) {
    return null;
  }

  const raw = res.data.order;
  const rawCreatedAt =
    typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString();

  const tracking_events = (raw.tracking_events ?? []).map((event) => ({
    id: String(event.id ?? ''),
    order_id: String(raw.id ?? orderIdOrNumber),
    status: String(event.status ?? 'unknown'),
    raw_status: String(event.raw_status ?? event.status ?? 'unknown'),
    location: event.location ?? null,
    description: event.description ?? null,
    customer_facing_status: String(event.customer_facing_status ?? event.status ?? 'unknown'),
    event_timestamp: String(event.event_timestamp ?? event.created_at ?? rawCreatedAt),
    created_at: String(event.created_at ?? event.event_timestamp ?? rawCreatedAt),
  })) as unknown as TrackingEvent[];

  return {
    ...raw,
    items: raw.items ?? raw.order_items ?? [],
    tracking_events,
    estimated_delivery_date: raw.estimated_delivery_date ?? formatEstimatedDelivery(),
  } as unknown as OrderWithFullDetails;
}
