import { notFound } from 'next/navigation';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, type ProductType } from '@repo/shared/domain';

import { browseHref, inQuickStore, PAGE, parseBrowseQuery, toBrowseFilter } from '@/features/catalog/browse-query';
import { BrowseView } from '@/features/catalog/browse-view';
import { browseCached, getStorePolicyCached, quickPageCached } from '@/features/catalog/data';
import { QUICK_TYPES } from '@/features/seven-day/links';
import { QuickTypeSwitch } from '@/features/seven-day/quick-type-switch';

import type { Metadata } from 'next';

type Params = Promise<{ type: string; category: string }>;

/**
 * D-154: the 7-day store's See all pages, /7-day-delivery/food and /7-day-delivery/home-and-gifts (?category=), built
 * like the IWC store's (browse-view.tsx: the filter panel, chips, sort, Show more) with only 7-day pieces. The tiles
 * and the header's categories open them. next.config.js rewrites the address here (never shown in the browser), so a
 * page is built once per type and category and served from the cache (PR-1); every other filter is read in the
 * browser, as on See all.
 */
export async function generateStaticParams(): Promise<{ type: string; category: string }[]> {
  const all = QUICK_TYPES.map((t) => ({ productType: t, category: undefined as string | undefined }));
  // Every 7-day category too (about a dozen pages a deploy): built on the first click instead, a category took 1.7 –
  // 2.4 s to open after each deploy (measured 2026-10-24); built ahead, its click is a cached answer.
  let pages = all;
  try {
    const { categories } = await quickPageCached(null, 0, PAGE);
    pages = [
      ...all,
      ...categories.flatMap((c) => {
        const t = QUICK_TYPES.find((q) => q === c.product_type);
        return t ? [{ productType: t, category: c.slug as string | undefined }] : [];
      }),
    ];
  } catch {
    // the types' pages only
  }
  // A page that fails to build fails the whole deploy: /7-day-delivery/food/all did (2026-11-04, its list read past the
  // database's 3 s limit). As the state pages do, each page's list is read here first, two at a time, which fills the
  // cache its build then reads; a page whose read fails is left out and built on its first visit instead.
  const built: { type: string; category: string }[] = [];
  for (let i = 0; i < pages.length; i += 2) {
    const group = pages.slice(i, i + 2);
    const read = await Promise.all(
      group.map((p) =>
        browseCached(toBrowseFilter(p.productType, inQuickStore(parseBrowseQuery({ category: p.category })), 0, PAGE)).then(
          () => true,
          () => false,
        ),
      ),
    );
    built.push(
      ...group.filter((_, j) => read[j]).map((p) => ({ type: PRODUCT_TYPE_PATH[p.productType].slice(1), category: p.category ?? 'all' })),
    );
  }
  return built;
}

async function read(params: Params): Promise<{ productType: ProductType; category: string | undefined }> {
  const p = await params;
  const productType = QUICK_TYPES.find((t) => PRODUCT_TYPE_PATH[t] === `/${p.type}`);
  if (!productType) notFound();
  return { productType, category: p.category === 'all' ? undefined : p.category };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { productType, category } = await read(params);
  const query = inQuickStore(parseBrowseQuery({ category }));
  return {
    title: `${PRODUCT_TYPE_LABEL[productType]} · 7-day store`,
    alternates: { canonical: browseHref(productType, query) },
  };
}

export default async function QuickSeeAllPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { productType, category } = await read(params);
  const query = inQuickStore(parseBrowseQuery({ category }));
  // the same cached reads as the front page (its first cards name each category's type) and every page's header
  const [page, all, policy] = await Promise.all([
    browseCached(toBrowseFilter(productType, query, 0, PAGE)),
    quickPageCached(null, 0, PAGE),
    getStorePolicyCached(),
  ]);
  if (!policy.quick_delivery_on) notFound();
  const types = QUICK_TYPES.filter((t) => all.categories.some((c) => c.product_type === t));

  return (
    <div className="space-y-6">
      <QuickTypeSwitch current={productType} types={types.includes(productType) ? types : [...types, productType]} />
      {page.all_total === 0 ? (
        <>
          <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">
            {PRODUCT_TYPE_LABEL[productType]}
          </h1>
          <p className="text-ink-muted">Nothing here right now. Look again soon.</p>
        </>
      ) : (
        <BrowseView productType={productType} title={PRODUCT_TYPE_LABEL[productType]} initialQuery={query} initial={page} />
      )}
    </div>
  );
}
