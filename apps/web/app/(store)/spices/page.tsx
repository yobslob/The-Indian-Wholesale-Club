import { BrowseByType, browseParams } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Spices' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Spices stay unpublished until the compliance question is answered (D-032, Q-10). */
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
