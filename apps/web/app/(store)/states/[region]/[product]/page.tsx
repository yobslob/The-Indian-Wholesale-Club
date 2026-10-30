import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, usableSummary } from '@repo/shared/domain';

import { SaveButton } from '@/features/account/save-button';
import { AddToCart } from '@/features/catalog/add-to-cart';
import { CuratedCard } from '@/features/catalog/curated-card';
import { getProductPageCached, getStorePolicyCached } from '@/features/catalog/data';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { Disclosure } from '@/features/catalog/disclosure';
import { photoNote, ProductDetails, sizeChart } from '@/features/catalog/product-details';
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
  return page ? { title: page.product.name, description: usableSummary(page.product.summary, page.product.description) ?? undefined } : {};
}

/**
 * storefront.md §The product page, storefront.md §Direction (D-051): the photos | the buying panel (two even columns on
 * tablets, D-082), then Reviews, Similar items in smaller cards and Curated for you (D-051, D-056). One cached store_product_page() call; the
 * add-to-bag island refreshes availability live (PR-7).
 */
export default async function ProductPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const { region, product: productSlug } = await params;
  // D-154: the policy (STORE_TAG only) carries the 7-day line for the delivery note
  const [page, policy] = await Promise.all([getProductPageCached(region, productSlug), getStorePolicyCached()]);
  if (!page) notFound();
  const { product, variants, media, similar, curated, reviews, delivery, ships_from_us, quick_delivery } = page;
  const chart = sizeChart(product, variants);
  const lo = policy.quick_delivery_days_min;
  const hi = policy.quick_delivery_days_max;
  const quickLine =
    policy.quick_delivery_on && lo !== null && hi !== null && policy.quick_delivery_min_cents
      ? { days: lo === hi ? `${hi}` : `${lo} – ${hi}`, minCents: policy.quick_delivery_min_cents }
      : null;

  return (
    <>
      <div className="grid items-start gap-[var(--gap)] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[1100px]:grid-cols-[auto_minmax(0,1fr)]">
        <ProductGallery media={media} name={product.name} />
        <aside
          aria-label="Buy"
          className="bg-surface rounded-lg p-[clamp(22px,2.6vw,44px)] md:sticky md:top-[calc(var(--top-h)+16px)]"
        >
          <p className="font-ui text-ink-muted flex flex-wrap items-center gap-x-2 text-[13px] font-medium">
            {product.region_slug ? (
              <>
                <Link
                  href={`/states/${product.region_slug}`}
                  className="hover:text-ink underline underline-offset-[3px]"
                >
                  {product.region_name}
                </Link>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span>{PRODUCT_TYPE_LABEL[product.product_type]}</span>
            {product.category_name ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{product.category_name}</span>
              </>
            ) : null}
          </p>
          <div className="my-3 flex items-start justify-between gap-4">
            {/* D-140 (L5): 32 – 36 px, two lines at most, so the price and the sizes stay above the fold */}
            <h1 className="font-display line-clamp-2 text-[clamp(30px,2.5vw,36px)] leading-[1.08] tracking-[-0.01em]">
              {product.name}
            </h1>
            <SaveButton productId={product.id} />
          </div>
          {/* D-140 (L4): one plain line; a shop's specs or the description again are not a summary */}
          {usableSummary(product.summary, product.description) ? (
            <p className="text-ink-muted mb-5">{usableSummary(product.summary, product.description)}</p>
          ) : null}
          {product.coming_soon ? (
            // D-135: shown, not sold yet: the heart above saves it
            <div className="border-line border-y py-4">
              <p className="font-display text-[22px]">Coming soon</p>
              <p className="text-ink-muted text-sm">Save it with the heart to find it again.</p>
            </div>
          ) : variants.length > 0 ? (
            <AddToCart
              product={product}
              variants={variants}
              quick={quick_delivery !== null}
              delivery={<DeliveryNote delivery={delivery} fromUs={ships_from_us} quick={quick_delivery} quickLine={quickLine} />}
            />
          ) : (
            <p className="text-ink-muted text-sm">Not available right now.</p>
          )}
          <div className="mt-6">
            <Disclosure title="Details" defaultOpen>
              <ProductDetails product={product} photos={photoNote(media)} variants={variants} />
            </Disclosure>
            {chart ? <Disclosure title="Size chart">{chart}</Disclosure> : null}
          </div>
          <p className="border-line font-display mt-4 border-t pt-4 text-[17px]">
            Made in India{product.region_name ? ` · from ${product.region_name}` : ''} · Imported
          </p>
        </aside>
      </div>

      <ReviewsSection reviews={reviews} productId={product.id} />

      {similar.length > 0 ? (
        <ProductRow
          id="similar"
          title="Similar items"
          products={similar}
          href={`${PRODUCT_TYPE_PATH[product.product_type]}?category=${product.category_slug}`}
          size="sm"
        />
      ) : null}
      <CuratedCard id="curated" products={curated} regionName={product.region_name} />
    </>
  );
}
