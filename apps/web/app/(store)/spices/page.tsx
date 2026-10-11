import { BrowseByType, browseParams } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Spices' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Spices: every live pantry listing (D-107: published since "Spices are cleared" was switched on, D-074). */
export default async function SpicesPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  return (
    <BrowseByType
      productType="spice"
      title="Spices"
      emptyText="Spices are coming soon."
      params={browseParams(await searchParams)}
    />
  );
}
