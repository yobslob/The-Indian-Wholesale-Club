import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SaveButton } from '@/features/account/save-button';
import { AddToCart } from '@/features/catalog/add-to-cart';
import { getProductPageCached } from '@/features/catalog/data';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { ProductDetails, ProductGallery } from '@/features/catalog/product-details';

import type { Metadata } from 'next';

type Params = Promise<{ region: string; product: string }>;

/** Built on first visit, then served from the cache (PR-1). Unknown slugs 404. */
export async function generateStaticParams(): Promise<{ region: string; product: string }[]> {
  return [];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { region, product } = await params;
  const page = await getProductPageCached(region, product);
  return page ? { title: page.product.name, description: page.product.summary ?? undefined } : {};
}

/**
 * storefront.md §The product page. One cached store_product_page() call; the
 * add-to-bag island refreshes availability live (PR-7).
 */
export default async function ProductPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const { region, product: productSlug } = await params;
  const page = await getProductPageCached(region, productSlug);
  if (!page) notFound();
  const { product, variants, media, delivery } = page;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ProductGallery media={media} name={product.name} />
      <div className="space-y-6">
        <div className="space-y-1">
          <Link
            href={`/states/${product.region_slug}`}
            className="text-ink-muted text-sm hover:underline"
          >
            {product.region_name}
          </Link>
          <h1 className="text-ink text-2xl font-semibold">{product.name}</h1>
          {product.summary ? <p className="text-ink-muted">{product.summary}</p> : null}
        </div>
        {variants.length > 0 ? (
          <AddToCart product={product} variants={variants} />
        ) : (
          <p className="text-ink-muted text-sm">Not available right now.</p>
        )}
        <SaveButton productId={product.id} />
        <DeliveryNote delivery={delivery} />
        <ProductDetails product={product} />
      </div>
    </div>
  );
}
