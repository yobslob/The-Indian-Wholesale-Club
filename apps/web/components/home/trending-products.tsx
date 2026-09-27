import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { ProductCard } from '@/components/ui/product-card';

import type { Product, ProductImage } from '@repo/shared/types';

interface TrendingProductsProps {
  products: Product[];
  images: ProductImage[];
}

export function TrendingProducts({ products, images }: TrendingProductsProps): React.JSX.Element {
  return (
    <section className="mx-auto max-w-screen-2xl px-4 py-12 md:px-8 md:py-16 lg:px-12 lg:py-24">
      <div className="mb-8 flex items-end justify-between md:mb-12">
        <div>
          <h2 className="font-display text-primary text-2xl font-bold tracking-tight md:text-3xl">
            Trending Now
          </h2>
          <p className="mt-2 text-sm text-neutral-600 md:text-base">
            Our most popular pieces this season.
          </p>
        </div>
        <Link
          href="/shop"
          className="hover:text-primary hidden items-center gap-1 text-sm font-medium text-neutral-600 transition-colors sm:inline-flex"
        >
          View All
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {products.map((product) => {
          const primaryImage = images.find(
            (img) => img.product_id === product.id && img.is_primary,
          );
          return <ProductCard key={product.id} product={product} image={primaryImage} />;
        })}
      </div>

      {/* Mobile "View All" link */}
      <div className="mt-8 text-center sm:hidden">
        <Link
          href="/shop"
          className="hover:text-primary inline-flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors"
        >
          View All Products
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
