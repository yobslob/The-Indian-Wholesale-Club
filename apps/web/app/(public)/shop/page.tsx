import {
  CategoryHeader,
  FilterSidebar,
  Pagination,
  ProductGrid,
  SortDropdown,
} from '@/components/catalog';
import { getCategories, getProductImages, getProducts } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

import type { Category, Product, ProductImage } from '@repo/shared/types';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop All Products — ROOT',
  description:
    'Explore our full collection of timeless essentials crafted with precision and care.',
};

const ITEMS_PER_PAGE = 12;

interface ShopPageProps {
  searchParams: Promise<{
    sort?: string;
    price?: string;
    page?: string;
  }>;
}

export default async function ShopPage({
  searchParams,
}: ShopPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await searchParams;
  const sort =
    (resolvedParams.sort as 'price_asc' | 'price_desc' | 'newest' | 'name_asc') || 'newest';
  const page = parseInt(resolvedParams.page || '1', 10);
  const offset = (Math.max(page, 1) - 1) * ITEMS_PER_PAGE;

  let minPriceCents: number | undefined;
  let maxPriceCents: number | undefined;
  if (resolvedParams.price) {
    const [min, max] = resolvedParams.price.split('-').map(Number);
    if (!isNaN(min)) minPriceCents = min;
    if (!isNaN(max)) maxPriceCents = max;
  }

  let products: Product[] = [];
  let count = 0;
  let images: ProductImage[] = [];
  let categories: Category[] = [];

  try {
    const supabase = await createClient();
    const [productResult, categoryResult] = await Promise.all([
      getProducts(supabase, {
        sort,
        limit: ITEMS_PER_PAGE,
        offset,
        minPriceCents,
        maxPriceCents,
      }),
      getCategories(supabase),
    ]);

    products = productResult.products;
    count = productResult.count;
    categories = categoryResult;

    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      images = await getProductImages(supabase, productIds);
    }
  } catch {
    // Supabase error handling / fallback
  }

  const totalPages = Math.ceil(count / ITEMS_PER_PAGE);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      <CategoryHeader
        title="All Products"
        description="Thoughtfully curated pieces designed to elevate your everyday rotation."
        breadcrumbs={[{ name: 'Shop' }]}
        itemCount={count}
      />

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Sidebar Filters */}
        <FilterSidebar categories={categories} />

        {/* Products Column */}
        <div className="flex-1">
          {/* Controls Bar (Mobile filter toggle + Sort Dropdown) */}
          <div className="mb-6 flex items-center justify-between">
            <div className="lg:hidden">
              <FilterSidebar categories={categories} />
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
