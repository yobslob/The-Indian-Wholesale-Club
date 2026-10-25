import { SearchView, type SearchParams } from '@/features/search/search-view';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search the 7-day store', robots: { index: false, follow: true } };

/** D-154: the 7-day store's search, only 7-day pieces (search-view.tsx); inside the store, so its header and switch. */
export default function QuickSearchPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  return SearchView({ searchParams, store: 'quick' });
}
