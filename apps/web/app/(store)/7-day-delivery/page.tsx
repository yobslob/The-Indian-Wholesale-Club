import { notFound } from 'next/navigation';

import { formatUsd, quickArrivesLine } from '@repo/shared/domain';

import { PAGE } from '@/features/catalog/browse-query';
import { getQuickFrontCached, quickPageCached } from '@/features/catalog/data';
import { ProductRow, sectionHeading } from '@/features/catalog/product-row';
import { QuickArrives } from '@/features/seven-day/quick-arrives';
import { QuickTiles } from '@/features/seven-day/quick-tiles';
import { QuickView } from '@/features/seven-day/quick-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '7-day store',
  description: 'Snacks, masalas and sweets from home, at your door in 7 days.',
};

/**
 * The 7-day store's front page (D-148, D-154): "Order today, arrives by Fri, Oct 30" (the real next date, from the
 * 7-day days in Settings: non-negotiable 4), the category tiles, the rows Most ordered this week, Under $5 and New this
 * week, then every 7-day piece as before (pills, Show more). Two cached reads (store_quick_front, store_quick_browse;
 * PR-1, PR-2), refreshed with See all. While 7-day delivery is off or paused there is no store. "From your state" is
 * not built: the site keeps no chosen state (docs/status.md). Which shop makes a piece 7-day never reaches this page
 * (D-003). The words are the plan's, approved 2026-10-23.
 */
export default async function SevenDayPage(): Promise<React.JSX.Element> {
  const [front, page] = await Promise.all([getQuickFrontCached(), quickPageCached(null, 0, PAGE)]);
  if (!front) notFound();
  // every card here is a 7-day piece: the page says so once, not on each card (as its list does)
  const rows = (cards: typeof front.under_5) => cards.map((p) => ({ ...p, quick_days: null }));
  const days = front.days_min === front.days_max ? `${front.days_max}` : `${front.days_min} – ${front.days_max}`;

  return (
    <div className="space-y-[clamp(28px,3.4vw,52px)]">
      <header className="border-line relative overflow-hidden rounded-lg border bg-paper px-[clamp(20px,4vw,64px)] py-[clamp(36px,6vw,88px)]">
        <p className="text-brand font-ui text-xs font-semibold uppercase tracking-[0.18em]">The 7-day store</p>
        <h1 className="font-display text-ink mt-4 max-w-[14ch] text-[clamp(40px,6vw,92px)] leading-[1.02] tracking-[-0.01em]">
          Home, in {days} days.
        </h1>
        <p className="font-heading text-ink mt-5 text-[clamp(20px,1.8vw,28px)] font-medium tracking-[-0.015em]">
          Order today,{' '}
          <QuickArrives
            daysMin={front.days_min}
            daysMax={front.days_max}
            initial={quickArrivesLine(front.days_min, front.days_max)}
          />
          .
        </p>
        <p className="text-ink-muted mt-3 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] leading-relaxed">
          The snacks, masalas and sweets you grew up with.
          {front.min_cents ? ` Comes in ${days} days with ${formatUsd(front.min_cents)} of 7-day pieces.` : null}
        </p>
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
          <QuickTiles categories={front.categories} />
          <div>
            <ProductRow id="most-ordered" title="Most ordered this week" products={rows(front.most_ordered)} />
            <ProductRow id="under-5" title="Under $5" products={rows(front.under_5)} />
            <ProductRow id="new-this-week" title="New this week" products={rows(front.new_this_week)} />
          </div>
          <section id="all" aria-labelledby="all-h" className="scroll-mt-[calc(var(--top-h)+16px)] space-y-6">
            <h2 id="all-h" className={sectionHeading}>
              Everything in the 7-day store
            </h2>
            {/* The address's ?category= (a tile, the header) is read in the browser, so the page stays one cached page */}
            <QuickView initial={page} />
          </section>
        </>
      )}
    </div>
  );
}
