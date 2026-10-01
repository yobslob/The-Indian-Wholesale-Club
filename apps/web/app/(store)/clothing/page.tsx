import { BrowseByType, browseParams } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Clothing' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Every clothing piece, the See all page behind the rows (D-062): ?state=<region>&category=<category>. */
export default async function ClothingPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  return (
    <BrowseByType
      productType="clothing"
      title="Clothing"
      emptyText="New pieces are on their way."
      params={browseParams(await searchParams)}
    />
  );
}
