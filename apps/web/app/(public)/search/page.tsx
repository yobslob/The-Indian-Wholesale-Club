import Link from 'next/link';

import { Pagination, ProductGrid, SortDropdown } from '@/components/catalog';
import { getCategories, getProductImages, getProducts } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

import type { Category, Product, ProductImage } from '@repo/shared/types';
import type { Metadata } from 'next';

const ITEMS_PER_PAGE = 12;

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    price?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  if (!q) {
    return { title: 'Search — ROOT' };
  }
  return {
    title: `Search: "${q}" — ROOT`,
    description: `Browse product search results for "${q}" on ROOT.`,
  };
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q?.trim() || '';
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
  let popularCategories: Category[] = [];

  try {
    const supabase = await createClient();
    const [categoriesResult, productsResult] = await Promise.all([
      getCategories(supabase),
      query
        ? getProducts(supabase, {
            search: query,
            sort,
            limit: ITEMS_PER_PAGE,
            offset,
            minPriceCents,
            maxPriceCents,
          })
        : Promise.resolve({ products: [], count: 0 }),
    ]);

    popularCategories = categoriesResult.filter((c) => !c.parent_category_id);
    products = productsResult.products;
    count = productsResult.count;

    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      images = await getProductImages(supabase, productIds);
    }
  } catch {
    // Database fallback
  }

  const totalPages = Math.ceil(count / ITEMS_PER_PAGE);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 md:px-8 lg:px-12">
      {/* Header bar */}
      <div className="border-b border-neutral-200 pb-8 pt-4">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center space-x-2 text-xs text-neutral-500">
            <li>
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-neutral-400">/</span>
              <span className="font-medium text-neutral-900">Search</span>
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-primary text-3xl font-bold tracking-tight md:text-4xl">
              {query ? `Search: "${query}"` : 'Search Products'}
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              {query
                ? `Found ${count} ${count === 1 ? 'item' : 'items'} matching your query.`
                : 'Enter a search term to find apparel, accessories, and new drops.'}
            </p>
          </div>

          {products.length > 0 && (
            <div>
              <SortDropdown />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-8">
        {products.length > 0 ? (
          <>
            <ProductGrid products={products} images={images} />
            <Pagination currentPage={page} totalPages={totalPages} />
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="font-display text-lg font-medium text-neutral-900">
              {query ? `No products found matching "${query}"` : 'What are you looking for?'}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Try searching with different keywords, or explore our collections below.
            </p>

            {/* Popular category pills */}
            {popularCategories.length > 0 && (
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {popularCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    className="rounded-full border border-neutral-200 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-800 transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
