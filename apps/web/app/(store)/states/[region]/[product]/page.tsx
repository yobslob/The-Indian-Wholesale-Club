import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SaveButton } from '@/features/account/save-button';
import { AddToCart } from '@/features/catalog/add-to-cart';
import { CuratedCard } from '@/features/catalog/curated-card';
import { getProductPageCached } from '@/features/catalog/data';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { Disclosure } from '@/features/catalog/disclosure';
import { hasDetails, ProductDetails, sizeChart } from '@/features/catalog/product-details';
import { ProductGallery } from '@/features/catalog/product-gallery';
import { ProductRow } from '@/features/catalog/product-row';
import { ReviewsSection } from '@/features/reviews/reviews-section';

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
 * storefront.md §The product page, design.md §Direction (D-051): the photos | the buying panel, then
 * Reviews, Similar items in smaller cards and Curated for you (D-051, D-056). One cached store_product_page() call; the
 * add-to-bag island refreshes availability live (PR-7).
 */
export default async function ProductPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { region, product: productSlug } = await params;
  const page = await getProductPageCached(region, productSlug);
  if (!page) notFound();
  const { product, variants, media, similar, curated, reviews, delivery } = page;
  const chart = sizeChart(product, variants);

  return (
    <>
      <div className="grid items-start gap-[var(--gap)] md:grid-cols-[auto_minmax(0,1fr)]">
        <ProductGallery media={media} name={product.name} />
        <aside aria-label="Buy" className="bg-surface rounded-lg p-[clamp(22px,2.6vw,44px)] md:sticky md:top-24">
          <p className="font-ui text-ink-muted text-[13px] font-medium">
            <Link href={`/states/${product.region_slug}`} className="underline">
              {product.region_name}
            </Link>
            &nbsp;·&nbsp; {product.product_type === 'clothing' ? 'Clothing' : 'Spices'} &nbsp;·&nbsp; {product.category_name}
          </p>
          <div className="my-3 flex items-start justify-between gap-4">
            <h1 className="font-display text-[clamp(38px,3.6vw,64px)] leading-none tracking-[-0.02em]">{product.name}</h1>
            <SaveButton productId={product.id} />
          </div>
          {product.summary ? <p className="text-ink-muted mb-5">{product.summary}</p> : null}
          {variants.length > 0 ? (
            <AddToCart product={product} variants={variants} delivery={<DeliveryNote delivery={delivery} />} />
          ) : (
            <p className="text-ink-muted text-sm">Not available right now.</p>
          )}
          <div className="mt-6">
            {hasDetails(product) ? (
              <Disclosure title="Details" defaultOpen>
                <ProductDetails product={product} />
              </Disclosure>
            ) : null}
            {chart ? <Disclosure title="Size chart">{chart}</Disclosure> : null}
          </div>
          <p className="border-line font-display mt-4 border-t pt-4 text-[19px] italic">
            Made in India · from {product.region_name} · Imported
          </p>
        </aside>
      </div>

      <ReviewsSection reviews={reviews} productId={product.id} />

      {similar.length > 0 ? (
        <ProductRow
          id="similar"
          title="Similar items"
          products={similar}
          href={`/clothing?category=${product.category_slug}`}
          size="sm"
        />
      ) : null}
      <CuratedCard id="curated" products={curated} regionName={product.region_name} />
    </>
  );
}
