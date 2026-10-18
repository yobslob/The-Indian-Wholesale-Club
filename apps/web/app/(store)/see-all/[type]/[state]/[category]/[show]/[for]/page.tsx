import { notFound } from 'next/navigation';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { BrowseByType } from '@/features/catalog/browse-by-type';
import { browseHref, parseBrowseQuery } from '@/features/catalog/browse-query';
import { TYPE_EMPTY } from '@/features/catalog/type-toggle';

import type { Metadata } from 'next';

type Params = Promise<{ type: string; state: string; category: string; show: string; for: string }>;

/**
 * The See all pages, /clothing, /food and /home-and-gifts (D-062, D-106), with their filters (?state=, ?category=,
 * ?show=, and ?for= women or men on clothing, D-140). next.config.js rewrites each address here (it never shows in the browser), so a page is built once and
 * served from the cache like the state pages (PR-1, D-011) instead of rendered on every request; "all" = no filter.
 * The other filters (price, size, sort, D-136) are read by the page itself in the browser (browse-view.tsx).
 */
export async function generateStaticParams(): Promise<{ type: string; state: string; category: string; show: string; for: string }[]> {
  return [
    ...PRODUCT_TYPES.map((t) => ({ type: PRODUCT_TYPE_PATH[t].slice(1), state: 'all', category: 'all', show: '24', for: 'all' })),
    // D-140: the header's and the tiles' Women and Men
    ...(['women', 'men'] as const).map((w) => ({ type: 'clothing', state: 'all', category: 'all', show: '24', for: w })),
  ];
}

const typeOf = (slug: string): ProductType | undefined => PRODUCT_TYPES.find((t) => PRODUCT_TYPE_PATH[t] === `/${slug}`);

async function read(params: Params) {
  const p = await params;
  const productType = typeOf(p.type);
  if (!productType) notFound();
  const query = parseBrowseQuery({
    state: p.state === 'all' ? undefined : p.state,
    category: p.category === 'all' ? undefined : p.category,
    show: p.show === '24' ? undefined : p.show, // the first page, as /clothing shows it
    for: p.for === 'all' ? undefined : p.for,
  });
  return { productType, query };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { productType, query } = await read(params);
  // the address customers use, never this route's
  return { title: PRODUCT_TYPE_LABEL[productType], alternates: { canonical: browseHref(productType, query) } };
}

export default async function SeeAllPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { productType, query } = await read(params);
  return (
    <BrowseByType
      productType={productType}
      title={PRODUCT_TYPE_LABEL[productType]}
      emptyText={TYPE_EMPTY[productType]}
      query={query}
    />
  );
}
