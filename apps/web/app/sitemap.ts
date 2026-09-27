import { getCategories, getProducts } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://root.clothing';

const PRODUCT_PAGE_SIZE = 500;

function safeLastModified(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/shop`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/shipping-returns`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  try {
    const supabase = await createClient();

    const [categories, firstPage] = await Promise.all([
      getCategories(supabase),
      getProducts(supabase, { limit: PRODUCT_PAGE_SIZE, offset: 0 }),
    ]);

    // Paginate so the sitemap covers the full catalog, not just the first page (M8).
    const products = [...firstPage.products];
    const totalCount = firstPage.count ?? products.length;
    for (
      let offset = PRODUCT_PAGE_SIZE;
      offset < totalCount && products.length < totalCount;
      offset += PRODUCT_PAGE_SIZE
    ) {
      const { products: page } = await getProducts(supabase, {
        limit: PRODUCT_PAGE_SIZE,
        offset,
      });
      if (page.length === 0) break;
      products.push(...page);
    }

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${SITE_URL}/category/${cat.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    const productRoutes: MetadataRoute.Sitemap = products.map((prod) => ({
      url: `${SITE_URL}/product/${prod.slug}`,
      // One bad updated_at must not invalidate the whole dynamic sitemap (M8).
      lastModified: safeLastModified(prod.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}
