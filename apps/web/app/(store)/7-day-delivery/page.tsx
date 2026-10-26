import { notFound } from 'next/navigation';

import { DUTIES_PAID, formatUsd, PRODUCT_TYPE_LABEL, quickOpenLine } from '@repo/shared/domain';

import { inQuickStore, PAGE, toBrowseFilter } from '@/features/catalog/browse-query';
import { browseCached, getQuickFrontCached, quickPageCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { FestivalLine } from '@/features/seven-day/festival-line';
import { QUICK_TYPES, quickCategories, quickHref } from '@/features/seven-day/links';
import { QuickArrives } from '@/features/seven-day/quick-arrives';
import { QuickTiles } from '@/features/seven-day/quick-tiles';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '7-day store',
  description: 'Snacks, masalas and sweets from home, at your door in 7 days.',
};

/**
 * The 7-day store's front page (D-148, D-154; D-161: "Home is 7 days away. Order today, open it Sat, Oct 31.", the
 * festival clock or the weekend line, the kirana counter): the real next date, from the
 * 7-day days in Settings: non-negotiable 4), the category tiles, the rows Most ordered this week, Under $5 and New this
 * week, then a row per type with See all, as the IWC store's Home ends. A tile and See all open the 7-day store's own
 * See all pages (/7-day-delivery/food, with the filters). Cached reads only (store_quick_front, store_quick_browse for
 * the categories' types, store_browse's first page of each type, the same entries those pages use; PR-1, PR-2). While
 * 7-day delivery is off or paused there is no store. "From your state" is not built: the site keeps no chosen state
 * (docs/status.md). Which shop makes a piece 7-day never reaches this page (D-003). The words are the plan's, approved
 * 2026-10-23.
 */
export default async function SevenDayPage(): Promise<React.JSX.Element> {
  const [front, page, ...byType] = await Promise.all([
    getQuickFrontCached(),
    quickPageCached(null, 0, PAGE),
    ...QUICK_TYPES.map((t) => browseCached(toBrowseFilter(t, inQuickStore({ sizes: [], sort: 'low' }), 0, PAGE))),
  ]);
  if (!front) notFound();
  // every card here is a 7-day piece: the page says so once, not on each card (as its list does)
  const rows = <T extends object>(cards: T[]) => cards.map((p) => ({ ...p, quick_days: null }));
  const days = front.days_min === front.days_max ? `${front.days_max}` : `${front.days_min} – ${front.days_max}`;

  return (
    <div className="space-y-[clamp(28px,3.4vw,52px)]">
      <header className="border-line relative overflow-hidden rounded-lg border bg-paper px-[clamp(20px,4vw,64px)] py-[clamp(36px,6vw,88px)]">
        <p className="text-brand font-ui text-xs font-semibold uppercase tracking-[0.18em]">The 7-day store</p>
        <h1 className="font-display text-ink mt-4 max-w-[14ch] text-[clamp(40px,6vw,92px)] leading-[1.02] tracking-[-0.01em]">
          Home is {days} days away.
        </h1>
        {/* D-161: the day you open it, as the plan's heading 2 says it */}
        <p className="font-heading text-ink mt-5 text-[clamp(20px,1.8vw,28px)] font-medium tracking-[-0.015em]">
          Order today, open it{' '}
          <QuickArrives
            daysMin={front.days_min}
            daysMax={front.days_max}
            initial={quickOpenLine(front.days_min, front.days_max)}
            open
          />
          .
        </p>
        <p className="text-ink-muted mt-3 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] leading-relaxed">
          The snacks, masalas and sweets you grew up with, straight from India to your door.
          {front.min_cents ? ` Free 7-day delivery from ${formatUsd(front.min_cents)} of 7-day pieces.` : null}
          {DUTIES_PAID ? ' Duties paid, nothing to pay at your door.' : null}
        </p>
        <FestivalLine weekend className="text-brand font-ui mt-4 flex items-center gap-2 text-[15px] font-semibold" />
        {/* the brand's running stitch (storefront.md §Visual system 8), here as a still thread under the words */}
        <div aria-hidden className="border-brand/60 mt-8 w-[min(420px,70%)] border-t-2 border-dashed" />
        <p className="text-ink font-ui mt-4 text-sm font-medium">
          {front.total} {front.total === 1 ? 'piece' : 'pieces'}
        </p>
      </header>
      {front.total === 0 ? (
        <p className="text-ink-muted">Nothing here right now. Look again soon.</p>
      ) : (
        <>
          <QuickTiles categories={quickCategories(front.categories, page.categories)} />
          <div>
            <ProductRow id="most-ordered" title="What everyone missed this week" products={rows(front.most_ordered)} />
            {/* D-161: Under $5 as the kirana counter, the small treats that top a bag up to the line */}
            <ProductRow id="under-5" title="The kirana counter" sub="Under $5, and no toffees for change." products={rows(front.under_5)} />
            <ProductRow id="new-this-week" title="New this week" products={rows(front.new_this_week)} />
            {QUICK_TYPES.map((t, i) => (
              <ProductRow
                key={t}
                id={`all-${t}`}
                title={PRODUCT_TYPE_LABEL[t]}
                sub={`${byType[i]!.total} ${byType[i]!.total === 1 ? 'piece' : 'pieces'} in ${days} days`}
                products={rows(byType[i]!.products.slice(0, 12))}
                href={quickHref(t)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
