import { SearchView, type SearchParams } from '@/features/catalog/search-view';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

/** Search (D-085; D-154's "Delivery: in 7 days" filter): search-view.tsx. */
export default function SearchPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  return SearchView({ searchParams, store: 'iwc' });
}
