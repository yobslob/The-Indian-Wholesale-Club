import { PRODUCT_TYPE_LABEL } from '@repo/shared/domain';

import { BrowseByType, browseParams } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: PRODUCT_TYPE_LABEL.home };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Home & gifts (D-106): Pooja & spiritual items, thaali & serveware, handicrafts & decor from every state. */
export default async function HomeAndGiftsPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  return (
    <BrowseByType
      productType="home"
      title={PRODUCT_TYPE_LABEL.home}
      emptyText="Home & gifts are coming soon."
      params={browseParams(await searchParams)}
    />
  );
}
