import { notFound } from 'next/navigation';

import {
  CategoryHeader,
  FilterSidebar,
  Pagination,
  ProductGrid,
  SortDropdown,
} from '@/components/catalog';
import { getCategories, getCategoryBySlug, getProductImages, getProducts } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

import type { Category, Product, ProductImage } from '@repo/shared/types';
import type { Metadata } from 'next';

const ITEMS_PER_PAGE = 12;

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    sort?: string;
    price?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const category = await getCategoryBySlug(supabase, slug);
    if (!category) {
      return { title: 'Category Not Found — ROOT' };
    }
    return {
      title: `${category.name} — ROOT`,
      description:
        category.description ||
        `Explore our ${category.name} collection. High quality, sustainably crafted wardrobe essentials.`,
    };
  } catch {
    return {
      title: 'Collection — ROOT',
    };
  }
}

export const revalidate = 3600; // ISR: 1 hour

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const sort =
    (resolvedSearchParams.sort as 'price_asc' | 'price_desc' | 'newest' | 'name_asc') || 'newest';
  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const offset = (Math.max(page, 1) - 1) * ITEMS_PER_PAGE;

  let minPriceCents: number | undefined;
  let maxPriceCents: number | undefined;
  if (resolvedSearchParams.price) {
    const [min, max] = resolvedSearchParams.price.split('-').map(Number);
    if (!isNaN(min)) minPriceCents = min;
    if (!isNaN(max)) maxPriceCents = max;
  }

  let category: Category | null = null;
  let subcategories: Category[] = [];
  let products: Product[] = [];
  let count = 0;
  let images: ProductImage[] = [];

  try {
    const supabase = await createClient();
    category = await getCategoryBySlug(supabase, slug);

    if (category) {
      // Find subcategories if this is a parent category
      const allCategories = await getCategories(supabase);
      subcategories = allCategories.filter((c) => c.parent_category_id === category?.id);

      // Collect IDs to fetch: this category + its children (if any)
      const targetCategoryIds = [category.id, ...subcategories.map((c) => c.id)];

      const productResult = await getProducts(supabase, {
        categoryIds: targetCategoryIds,
        sort,
        limit: ITEMS_PER_PAGE,
        offset,
        minPriceCents,
        maxPriceCents,
      });

      products = productResult.products;
      count = productResult.count;

      if (products.length > 0) {
        const productIds = products.map((p) => p.id);
        images = await getProductImages(supabase, productIds);
      }
    }
  } catch {
    // Fallback if DB is unavailable
  }

  if (!category) {
    notFound();
  }

  const totalPages = Math.ceil(count / ITEMS_PER_PAGE);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      <CategoryHeader
        title={category.name}
        description={category.description}
        breadcrumbs={[{ name: 'Shop', href: '/shop' }, { name: category.name }]}
        itemCount={count}
      />

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Sidebar Filters */}
        <FilterSidebar categories={subcategories} activeCategorySlug={slug} />

        {/* Products Column */}
        <div className="flex-1">
          {/* Controls Bar */}
          <div className="mb-6 flex items-center justify-between">
            <div className="lg:hidden">
              <FilterSidebar categories={subcategories} activeCategorySlug={slug} />
            </div>
            <div className="ml-auto">
              <SortDropdown />
            </div>
          </div>

          {/* Product Grid */}
          <ProductGrid products={products} images={images} />

          {/* Pagination */}
          <Pagination currentPage={page} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}
