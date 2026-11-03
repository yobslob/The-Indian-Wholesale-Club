import 'server-only';

import { unstable_cache } from 'next/cache';

import { getSearchHints, isSearchBusy, searchPage, type SearchFilter, type SearchPage } from '@repo/db/store';

import { STORE_TAG } from '@/features/catalog/data';
import { errorMessage, logger } from '@/lib/logger';
import { storeClient } from '@/lib/supabase/store';

import type { ProductType } from '@repo/shared/domain';

export const EMPTY_PAGE: SearchPage = {
  query: '',
  fixed: null,
  mode: 'none',
  total: 0,
  all_total: 0,
  capped: false,
  slow: false,
  types: {},
  categories: [],
  regions: [],
  named_regions: [],
  products: [],
};

/** A search's results, or why there are none: busy (time ran out, the database is busy) or failed (anything else). */
export type SearchResult = { page: SearchPage; failed: null | 'busy' | 'error' };

/**
 * One search (store_search_page, D-160), never thrown (launch QA D-1): a slow or failing database gives the page a
 * reason to show a friendly line instead of Next's error page. The read gives up after SEARCH_TIMEOUT_MS
 * (packages/db); the database says slow when it skipped the spelling fix for time.
 */
export async function loadSearch(q: string, filter: SearchFilter): Promise<SearchResult> {
  try {
    const page = await searchPage(storeClient(), q, filter);
    return { page, failed: page.slow && page.products.length === 0 ? 'busy' : null };
  } catch (error) {
    const busy = isSearchBusy(error);
    logger.warn(busy ? 'search.busy' : 'search.failed', { error: errorMessage(error) });
    return { page: EMPTY_PAGE, failed: busy ? 'busy' : 'error' };
  }
}

/** What a search that found nothing offers instead (D-3): only what the store already has, never made up. */
export interface SearchIdeas {
  /** Searches many customers made that found pieces (store_search_hints' popular: the listings' own words only). */
  popular: string[];
  /** The states with the most pieces. */
  regions: { slug: string; name: string; count: number }[];
  /** The categories with the most pieces. */
  categories: { type: ProductType; slug: string; name: string; count: number }[];
}

const NO_IDEAS: SearchIdeas = { popular: [], regions: [], categories: [] };

/**
 * The ideas, from store_search_hints() (one read an hour, shared by every visitor: one small data-cache entry, under
 * 1 KB, so about 24 page-cache writes a day at most). An error gives none, never a broken page.
 */
const ideasCached = unstable_cache(
  async (): Promise<SearchIdeas> => {
    const hints = await getSearchHints(storeClient());
    const most = <T extends { count: number }>(list: T[]): T[] =>
      list.filter((x) => x.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);
    return { popular: hints.popular.slice(0, 8), regions: most(hints.regions), categories: most(hints.categories) };
  },
  ['search-ideas', 'v1'],
  { tags: [STORE_TAG], revalidate: 3600 },
);

export async function loadSearchIdeas(): Promise<SearchIdeas> {
  try {
    return await ideasCached();
  } catch (error) {
    logger.warn('search.ideas_failed', { error: errorMessage(error) });
    return NO_IDEAS;
  }
}
