import { notFound } from 'next/navigation';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { BrowseByType, browseParams, seeAllHref } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

type Params = Promise<{ type: string; state: string; category: string; show: string }>;

/**
 * The See all pages, /clothing, /food and /home-and-gifts (D-062, D-106), with their filters (?state=, ?category=,
 * ?show=). next.config.js rewrites each address here (it never shows in the browser), so a page is built once and
 * served from the cache like the state pages (PR-1, D-011) instead of rendered on every request; "all" = no filter.
 */
export async function generateStaticParams(): Promise<{ type: string; state: string; category: string; show: string }[]> {
  return PRODUCT_TYPES.map((t) => ({ type: PRODUCT_TYPE_PATH[t].slice(1), state: 'all', category: 'all', show: '24' }));
}

const EMPTY: Record<ProductType, string> = {
  clothing: 'New pieces are on their way.',
  food: 'Food is coming soon.',
  home: 'Home & gifts are coming soon.',
};

const typeOf = (slug: string): ProductType | undefined => PRODUCT_TYPES.find((t) => PRODUCT_TYPE_PATH[t] === `/${slug}`);

async function read(params: Params) {
  const p = await params;
  const productType = typeOf(p.type);
  if (!productType) notFound();
  const filters = browseParams({
    state: p.state === 'all' ? undefined : p.state,
    category: p.category === 'all' ? undefined : p.category,
    show: p.show === '24' ? undefined : p.show, // the first page, as /clothing shows it
  });
  return { productType, filters };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { productType, filters } = await read(params);
  // the address customers use, never this route's
  return { title: PRODUCT_TYPE_LABEL[productType], alternates: { canonical: seeAllHref(productType, filters) } };
}

export default async function SeeAllPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { productType, filters } = await read(params);
  return (
    <BrowseByType
      productType={productType}
      title={PRODUCT_TYPE_LABEL[productType]}
      emptyText={EMPTY[productType]}
      params={filters}
    />
  );
}
