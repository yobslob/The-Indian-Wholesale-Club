import { BrowseByType, browseParams } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Food' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Food: every live food listing: masalas, snacks, sweets, pickles, staples (D-110). */
export default async function FoodPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  return (
    <BrowseByType
      productType="food"
      title="Food"
      emptyText="Food is coming soon."
      params={browseParams(await searchParams)}
    />
  );
}
