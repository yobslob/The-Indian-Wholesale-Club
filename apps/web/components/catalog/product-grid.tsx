import { ProductCard } from '@/components/ui/product-card';

import type { Product, ProductImage } from '@repo/shared/types';

interface ProductGridProps {
  products: Product[];
  images: ProductImage[];
}

export function ProductGrid({ products, images }: ProductGridProps): React.JSX.Element {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 p-12 text-center">
        <p className="font-display text-lg font-medium text-neutral-900">No products found</p>
        <p className="mt-1 text-sm text-neutral-500">
          Try adjusting your filters or search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => {
        const primaryImage = images.find((img) => img.product_id === product.id && img.is_primary);
        return <ProductCard key={product.id} product={product} image={primaryImage} />;
      })}
    </div>
  );
}
