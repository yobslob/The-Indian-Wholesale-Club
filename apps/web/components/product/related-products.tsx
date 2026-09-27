import { ProductCard } from '@/components/ui/product-card';

import type { Product, ProductImage } from '@repo/shared/types';

interface RelatedProductsProps {
  products: Product[];
  images: ProductImage[];
}

export function RelatedProducts({
  products,
  images,
}: RelatedProductsProps): React.JSX.Element | null {
  if (products.length === 0) return null;

  return (
    <div className="mt-20 border-t border-neutral-200 pt-12">
      <div className="mb-8">
        <h2 className="font-display text-primary text-2xl font-bold tracking-tight">
          You May Also Like
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Curated recommendations from the same collection.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
        {products.map((product) => {
          const image = images.find((img) => img.product_id === product.id && img.is_primary);
          return <ProductCard key={product.id} product={product} image={image} />;
        })}
      </div>
    </div>
  );
}
