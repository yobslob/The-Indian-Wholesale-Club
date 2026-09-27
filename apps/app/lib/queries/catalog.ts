import { SHIPPING_RATES } from '@repo/shared/constants';

import { apiGet } from '../api';
import { isSupabaseConfigured, supabase } from '../supabase';

import type {
  Category,
  OrderItem,
  OrderWithFullDetails,
  ProductWithDetails,
  SizeEnum,
  TrackingEvent,
} from '@repo/shared/types';

// =============================================================================
// Canonical Fallback Data (Offline & Instant Demo Experience)
// =============================================================================

export const FALLBACK_CATEGORIES: Category[] = [
  {
    id: 'cat-all',
    name: 'All Items',
    slug: 'all',
    description: 'Complete wardrobe catalog',
    image_url:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop&q=80',
    parent_category_id: null,
    sort_order: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-men',
    name: 'Men',
    slug: 'men',
    description: "Men's Elevated Basics",
    image_url:
      'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800&auto=format&fit=crop&q=80',
    parent_category_id: null,
    sort_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-women',
    name: 'Women',
    slug: 'women',
    description: "Women's Timeless Silhouettes",
    image_url:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80',
    parent_category_id: null,
    sort_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-accessories',
    name: 'Accessories',
    slug: 'accessories',
    description: 'Handcrafted Everyday Carry',
    image_url:
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
    parent_category_id: null,
    sort_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const FALLBACK_PRODUCTS: ProductWithDetails[] = [
  {
    id: 'prod-1',
    name: 'Classic Oxford Shirt',
    slug: 'classic-oxford-shirt',
    description: 'A timeless Oxford cotton shirt with a clean, tailored fit.',
    long_description:
      'Crafted from premium 100% long-staple cotton Oxford cloth, this shirt features a button-down collar, chest pocket, and back box pleat. Pre-washed for a soft hand-feel from day one.',
    category_id: 'cat-men',
    base_price_cents: 4500,
    compare_at_price_cents: 5500,
    currency: 'USD',
    is_active: true,
    is_featured: true,
    tags: ['oxford', 'button-down', 'classic', 'cotton'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[1] ?? null,
    variants: [
      {
        id: 'var-1-1',
        product_id: 'prod-1',
        sku: 'OXF-WHT-S',
        size: 'S' as SizeEnum,
        color_name: 'White',
        color_hex: '#FFFFFF',
        price_cents: 4500,
        inventory_count: 24,
        low_stock_threshold: 5,
        weight_grams: 230,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-1-2',
        product_id: 'prod-1',
        sku: 'OXF-WHT-M',
        size: 'M' as SizeEnum,
        color_name: 'White',
        color_hex: '#FFFFFF',
        price_cents: 4500,
        inventory_count: 35,
        low_stock_threshold: 5,
        weight_grams: 240,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-1-3',
        product_id: 'prod-1',
        sku: 'OXF-LBL-M',
        size: 'M' as SizeEnum,
        color_name: 'Light Blue',
        color_hex: '#93C5FD',
        price_cents: 4500,
        inventory_count: 18,
        low_stock_threshold: 5,
        weight_grams: 240,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-1-4',
        product_id: 'prod-1',
        sku: 'OXF-LBL-L',
        size: 'L' as SizeEnum,
        color_name: 'Light Blue',
        color_hex: '#93C5FD',
        price_cents: 4500,
        inventory_count: 12,
        low_stock_threshold: 5,
        weight_grams: 260,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-1-1',
        product_id: 'prod-1',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Classic Oxford Shirt - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'img-1-2',
        product_id: 'prod-1',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Classic Oxford Shirt - Detail',
        sort_order: 1,
        is_primary: false,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'prod-2',
    name: 'Heavyweight Pocket Tee',
    slug: 'heavyweight-pocket-tee',
    description: 'A substantial 6.5oz organic cotton tee with a structured drape.',
    long_description:
      'Made from garment-dyed 6.5oz heavy cotton jersey. Features a reinforced chest pocket, ribbed crew neckline, and a clean, relaxed silhouette that holds its shape wash after wash.',
    category_id: 'cat-men',
    base_price_cents: 3200,
    compare_at_price_cents: null,
    currency: 'USD',
    is_active: true,
    is_featured: true,
    tags: ['tee', 'heavyweight', 'basics', 'cotton'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[1] ?? null,
    variants: [
      {
        id: 'var-2-1',
        product_id: 'prod-2',
        sku: 'HWT-BLK-M',
        size: 'M' as SizeEnum,
        color_name: 'Obsidian Black',
        color_hex: '#18181B',
        price_cents: 3200,
        inventory_count: 50,
        low_stock_threshold: 5,
        weight_grams: 220,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-2-2',
        product_id: 'prod-2',
        sku: 'HWT-OAT-L',
        size: 'L' as SizeEnum,
        color_name: 'Oatmeal',
        color_hex: '#E4DCD3',
        price_cents: 3200,
        inventory_count: 30,
        low_stock_threshold: 5,
        weight_grams: 230,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-2-3',
        product_id: 'prod-2',
        sku: 'HWT-WHT-XL',
        size: 'XL' as SizeEnum,
        color_name: 'Optic White',
        color_hex: '#FFFFFF',
        price_cents: 3200,
        inventory_count: 15,
        low_stock_threshold: 5,
        weight_grams: 240,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-2-1',
        product_id: 'prod-2',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Heavyweight Pocket Tee - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'prod-3',
    name: 'Slim Chino Pant',
    slug: 'slim-chino-pant',
    description: 'Clean, modern chinos with a comfortable slim tapered fit.',
    long_description:
      'Cut from a stretch cotton-twill blend (98% combed cotton, 2% elastane) for effortless mobility. Zip fly, clean internal seams, and welt back pockets.',
    category_id: 'cat-men',
    base_price_cents: 6800,
    compare_at_price_cents: 7800,
    currency: 'USD',
    is_active: true,
    is_featured: false,
    tags: ['chino', 'slim', 'stretch', 'pants'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[1] ?? null,
    variants: [
      {
        id: 'var-3-1',
        product_id: 'prod-3',
        sku: 'CHN-KHK-32',
        size: 'M' as SizeEnum,
        color_name: 'Khaki',
        color_hex: '#C3B091',
        price_cents: 6800,
        inventory_count: 22,
        low_stock_threshold: 5,
        weight_grams: 400,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-3-2',
        product_id: 'prod-3',
        sku: 'CHN-NVY-32',
        size: 'L' as SizeEnum,
        color_name: 'Navy',
        color_hex: '#1E293B',
        price_cents: 6800,
        inventory_count: 18,
        low_stock_threshold: 5,
        weight_grams: 420,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-3-1',
        product_id: 'prod-3',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Slim Chino Pant - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'prod-4',
    name: 'Summer Floral Dress',
    slug: 'summer-floral-dress',
    description: 'Lightweight floral midi dress perfect for warm days.',
    long_description:
      'This breezy midi dress features a refined botanical pattern printed on lightweight breathable viscose. V-neckline, subtle side slit, and adjustable waist tie.',
    category_id: 'cat-women',
    base_price_cents: 6500,
    compare_at_price_cents: null,
    currency: 'USD',
    is_active: true,
    is_featured: true,
    tags: ['floral', 'midi', 'summer', 'viscose'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[2] ?? null,
    variants: [
      {
        id: 'var-4-1',
        product_id: 'prod-4',
        sku: 'DRS-FLR-S',
        size: 'S' as SizeEnum,
        color_name: 'Olive Botanical',
        color_hex: '#556B2F',
        price_cents: 6500,
        inventory_count: 14,
        low_stock_threshold: 4,
        weight_grams: 200,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-4-2',
        product_id: 'prod-4',
        sku: 'DRS-FLR-M',
        size: 'M' as SizeEnum,
        color_name: 'Olive Botanical',
        color_hex: '#556B2F',
        price_cents: 6500,
        inventory_count: 19,
        low_stock_threshold: 4,
        weight_grams: 210,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-4-1',
        product_id: 'prod-4',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Summer Floral Dress - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'prod-5',
    name: 'Linen Shirt Dress',
    slug: 'linen-shirt-dress',
    description: 'An effortless linen dress with relaxed proportions.',
    long_description:
      'Made from 100% European flax linen. Features a spread collar, mother-of-pearl buttons, and rolled sleeves with button tabs. Natural drape that gets softer with every wash.',
    category_id: 'cat-women',
    base_price_cents: 8900,
    compare_at_price_cents: 10500,
    currency: 'USD',
    is_active: true,
    is_featured: false,
    tags: ['linen', 'shirt-dress', 'relaxed', 'european-flax'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[2] ?? null,
    variants: [
      {
        id: 'var-5-1',
        product_id: 'prod-5',
        sku: 'LSD-NAT-S',
        size: 'S' as SizeEnum,
        color_name: 'Natural Flax',
        color_hex: '#E8DCC8',
        price_cents: 8900,
        inventory_count: 12,
        low_stock_threshold: 3,
        weight_grams: 250,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-5-2',
        product_id: 'prod-5',
        sku: 'LSD-NAT-M',
        size: 'M' as SizeEnum,
        color_name: 'Natural Flax',
        color_hex: '#E8DCC8',
        price_cents: 8900,
        inventory_count: 8,
        low_stock_threshold: 3,
        weight_grams: 260,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-5-1',
        product_id: 'prod-5',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Linen Shirt Dress - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'prod-6',
    name: 'Ribbed Tank Top',
    slug: 'ribbed-tank-top',
    description: 'A wardrobe essential in soft, modal-cotton rib knit.',
    long_description:
      'Spun from fine-gauge combed cotton and modal with a touch of spandex. Deep scoop neck, reinforced binding, and exceptional recovery.',
    category_id: 'cat-women',
    base_price_cents: 2400,
    compare_at_price_cents: null,
    currency: 'USD',
    is_active: true,
    is_featured: true,
    tags: ['tank', 'ribbed', 'basics', 'modal'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[2] ?? null,
    variants: [
      {
        id: 'var-6-1',
        product_id: 'prod-6',
        sku: 'TNK-BLK-S',
        size: 'S' as SizeEnum,
        color_name: 'Charcoal Black',
        color_hex: '#18181B',
        price_cents: 2400,
        inventory_count: 45,
        low_stock_threshold: 5,
        weight_grams: 95,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'var-6-2',
        product_id: 'prod-6',
        sku: 'TNK-WHT-M',
        size: 'M' as SizeEnum,
        color_name: 'Chalk White',
        color_hex: '#FAFAFA',
        price_cents: 2400,
        inventory_count: 50,
        low_stock_threshold: 5,
        weight_grams: 100,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-6-1',
        product_id: 'prod-6',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Ribbed Tank Top - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'prod-7',
    name: 'Canvas Utility Tote',
    slug: 'canvas-utility-tote',
    description: 'A durable, structured 18oz canvas tote with bridle leather straps.',
    long_description:
      'Constructed from heavy 18oz duck canvas with solid brass rivets and vegetable-tanned bridle leather handles. Interior zip pocket fits a 16-inch laptop with room to spare.',
    category_id: 'cat-accessories',
    base_price_cents: 4800,
    compare_at_price_cents: 5800,
    currency: 'USD',
    is_active: true,
    is_featured: true,
    tags: ['tote', 'canvas', 'carry', 'leather'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[3] ?? null,
    variants: [
      {
        id: 'var-7-1',
        product_id: 'prod-7',
        sku: 'TOT-NAT-OS',
        size: 'M' as SizeEnum,
        color_name: 'Natural Ecru',
        color_hex: '#F5F5F0',
        price_cents: 4800,
        inventory_count: 28,
        low_stock_threshold: 5,
        weight_grams: 480,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-7-1',
        product_id: 'prod-7',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Canvas Utility Tote - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'prod-8',
    name: 'Leather Minimal Crossbody',
    slug: 'leather-minimal-crossbody',
    description: 'Handcrafted Italian vegetable-tanned leather everyday crossbody.',
    long_description:
      'Minimalist crossbody bag cut from full-grain Italian vacchetta leather that develops a deep golden patina with time. Solid brass magnetic closure and adjustable shoulder strap.',
    category_id: 'cat-accessories',
    base_price_cents: 12500,
    compare_at_price_cents: null,
    currency: 'USD',
    is_active: true,
    is_featured: false,
    tags: ['crossbody', 'leather', 'accessories', 'italian'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    category: FALLBACK_CATEGORIES[3] ?? null,
    variants: [
      {
        id: 'var-8-1',
        product_id: 'prod-8',
        sku: 'XBD-COG-OS',
        size: 'M' as SizeEnum,
        color_name: 'Cognac Brown',
        color_hex: '#8B4513',
        price_cents: 12500,
        inventory_count: 10,
        low_stock_threshold: 2,
        weight_grams: 360,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    images: [
      {
        id: 'img-8-1',
        product_id: 'prod-8',
        variant_id: null,
        url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Leather Minimal Crossbody - Front',
        sort_order: 0,
        is_primary: true,
        created_at: new Date().toISOString(),
      },
    ],
  },
];

// =============================================================================
// Query Functions
// =============================================================================

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) {
    return FALLBACK_CATEGORIES;
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

function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()"'\\%_]/g, '').trim();
}

function filterFallbackProducts(options: FetchProductsOptions): ProductWithDetails[] {
  const { categoryId, search, featuredOnly, sortBy } = options;

  let products = [...FALLBACK_PRODUCTS];

  if (categoryId && categoryId !== 'cat-all') {
    products = products.filter(
      (p) => p.category_id === categoryId || p.category?.slug === categoryId,
    );
  }

  if (featuredOnly) {
    products = products.filter((p) => p.is_featured);
  }

  if (search && search.trim().length > 0) {
    const query = search.trim().toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  if (sortBy === 'price_low') {
    products.sort((a, b) => a.base_price_cents - b.base_price_cents);
  } else if (sortBy === 'price_high') {
    products.sort((a, b) => b.base_price_cents - a.base_price_cents);
  } else if (sortBy === 'name') {
    products.sort((a, b) => a.name.localeCompare(b.name));
  }

  return products;
}

const PRODUCT_SELECT = '*, category:categories(*), variants:product_variants(*), images:product_images(*)';

export async function fetchProducts(
  options: FetchProductsOptions = {},
): Promise<ProductWithDetails[]> {
  const { categoryId, search, featuredOnly, sortBy } = options;

  // Hard-coded catalog is only ever used when Supabase env is absent (L1).
  if (!isSupabaseConfigured) {
    return filterFallbackProducts(options);
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

    const cleanSearch = search ? sanitizeSearchTerm(search) : '';
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
    return FALLBACK_PRODUCTS.find((p) => p.id === id || p.slug === id) ?? null;
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
