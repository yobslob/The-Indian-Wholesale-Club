import type { Client } from '@/lib/supabase/types';
import type {
  Category,
  Product,
  ProductImage,
  ProductVariant,
  ProductWithDetails,
} from '@repo/shared/types';


// ==========================================
// Categories
// ==========================================

/** Fetch all active categories with optional parent filter */
export async function getCategories(client: Client, parentId?: string | null): Promise<Category[]> {
  let query = client
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (parentId !== undefined) {
    query =
      parentId === null
        ? query.is('parent_category_id', null)
        : query.eq('parent_category_id', parentId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Fetch a single category by slug */
export async function getCategoryBySlug(client: Client, slug: string): Promise<Category | null> {
  const { data, error } = await client.from('categories').select('*').eq('slug', slug).single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/** Fetch full category tree (top-level with children) */
export async function getCategoryTree(
  client: Client,
): Promise<(Category & { children: Category[] })[]> {
  const allCategories = await getCategories(client);

  const topLevel = allCategories.filter((c) => !c.parent_category_id);
  return topLevel.map((parent) => ({
    ...parent,
    children: allCategories.filter((c) => c.parent_category_id === parent.id),
  }));
}

// ==========================================
// Products
// ==========================================

interface GetProductsOptions {
  categoryId?: string;
  categoryIds?: string[];
  featured?: boolean;
  limit?: number;
  offset?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name_asc';
  search?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
}

/** Fetch products with optional filtering, sorting, and pagination */
export async function getProducts(
  client: Client,
  options: GetProductsOptions = {},
): Promise<{ products: Product[]; count: number }> {
  const {
    categoryId,
    categoryIds,
    featured,
    limit = 12,
    offset = 0,
    sort = 'newest',
    search,
    minPriceCents,
    maxPriceCents,
  } = options;

  let query = client.from('products').select('*', { count: 'exact' }).eq('is_active', true);

  if (categoryIds && categoryIds.length > 0) {
    query = query.in('category_id', categoryIds);
  } else if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  if (minPriceCents !== undefined) {
    query = query.gte('base_price_cents', minPriceCents);
  }
  if (maxPriceCents !== undefined) {
    query = query.lte('base_price_cents', maxPriceCents);
  }
  if (featured !== undefined) {
    query = query.eq('is_featured', featured);
  }
  if (search) {
    const cleanSearch = search.replace(/[,()"'\\%_]/g, '').trim();
    if (cleanSearch) {
      query = query.or(
        `name.ilike.%${cleanSearch}%,slug.ilike.%${cleanSearch}%,description.ilike.%${cleanSearch}%,long_description.ilike.%${cleanSearch}%`,
      );
    }
  }

  switch (sort) {
    case 'price_asc':
      query = query.order('base_price_cents', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('base_price_cents', { ascending: false });
      break;
    case 'name_asc':
      query = query.order('name', { ascending: true });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  let products = data ?? [];
  let totalCount = count ?? 0;

  // Tag fallback: TEXT[] contains (M9) when text fields match nothing
  if (products.length === 0 && search) {
    const cleanSearch = search.replace(/[,()"'\\%_]/g, '').trim();
    if (cleanSearch) {
      const { data: tagData, error: tagError, count: tagCount } = await client
        .from('products')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .contains('tags', [cleanSearch])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (!tagError) {
        products = tagData ?? [];
        totalCount = tagCount ?? 0;
      }
    }
  }

  return { products, count: totalCount };
}

/** Fetch a single product by slug with variants and images */
export async function getProductBySlug(
  client: Client,
  slug: string,
): Promise<ProductWithDetails | null> {
  const { data: product, error } = await client
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!product) return null;

  const [categoryResult, variantsResult, imagesResult] = await Promise.all([
    product.category_id
      ? client.from('categories').select('*').eq('id', product.category_id).single()
      : Promise.resolve({ data: null, error: null }),
    client
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .eq('is_active', true)
      .order('size', { ascending: true }),
    client
      .from('product_images')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true }),
  ]);

  if (variantsResult.error) throw variantsResult.error;
  if (imagesResult.error) throw imagesResult.error;

  return {
    ...product,
    category: categoryResult.data as Category | null,
    variants: variantsResult.data as ProductVariant[],
    images: imagesResult.data as ProductImage[],
  };
}

/** Fetch a single product by ID with variants and images */
export async function getProductById(
  client: Client,
  id: string,
  opts: { includeInactive?: boolean } = {},
): Promise<ProductWithDetails | null> {
  // Storefront-safe by default (L2): only the admin edit page may ask for
  // inactive/soft-deleted products, so a future storefront reuse cannot
  // leak them.
  let query = client.from('products').select('*').eq('id', id);
  if (!opts.includeInactive) {
    query = query.eq('is_active', true);
  }
  const { data: product, error } = await query.single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!product) return null;

  const [categoryResult, variantsResult, imagesResult] = await Promise.all([
    product.category_id
      ? client.from('categories').select('*').eq('id', product.category_id).single()
      : Promise.resolve({ data: null, error: null }),
    client
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .order('size', { ascending: true }),
    client
      .from('product_images')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true }),
  ]);

  return {
    ...product,
    category: categoryResult.data as Category | null,
    variants: (variantsResult.data || []) as ProductVariant[],
    images: (imagesResult.data || []) as ProductImage[],
  };
}

/** Fetch featured products with primary images */
export async function getFeaturedProducts(client: Client, limit = 8): Promise<Product[]> {
  const { products } = await getProducts(client, { featured: true, limit });
  return products;
}

/** Fetch related products within the same category */
export async function getRelatedProducts(
  client: Client,
  productId: string,
  categoryId: string | null,
  limit = 4,
): Promise<Product[]> {
  let query = client.from('products').select('*').neq('id', productId).eq('is_active', true);

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ==========================================
// Product Images (standalone queries)
// ==========================================

/** Fetch the primary image for a product */
export async function getProductPrimaryImage(
  client: Client,
  productId: string,
): Promise<ProductImage | null> {
  const { data, error } = await client
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .eq('is_primary', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/** Fetch all images for a set of product IDs (batch) */
export async function getProductImages(
  client: Client,
  productIds: string[],
): Promise<ProductImage[]> {
  if (productIds.length === 0) return [];

  const { data, error } = await client
    .from('product_images')
    .select('*')
    .in('product_id', productIds)
    .eq('is_primary', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
