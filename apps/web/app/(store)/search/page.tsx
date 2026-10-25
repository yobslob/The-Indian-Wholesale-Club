import { SearchView, type SearchParams } from '@/features/search/search-view';

import type { Metadata } from 'next';

/** D-160: a search's results are for the person searching, not search engines (robots.ts keeps crawlers out too). */
export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: true } };

/** Search (D-085; D-154's "Delivery: in 7 days" filter; D-160): search-view.tsx. */
export default function SearchPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  return SearchView({ searchParams, store: 'iwc' });
}
