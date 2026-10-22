import { notFound } from 'next/navigation';

import { PAGE } from '@/features/catalog/browse-query';
import { quickPageCached } from '@/features/catalog/data';
import { QuickView } from '@/features/seven-day/quick-view';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '7-day delivery',
  description: 'Snacks, masalas and sweets from home, at your door in days.',
};

/**
 * 7-day delivery (D-148): every piece that reaches the customer in the 7-day days (Settings), from one cached
 * store_quick_browse() read (PR-1, PR-2; refreshed with See all). The days come only from Settings (non-negotiable 4):
 * with them empty there is no page. Which shop makes a piece 7-day never reaches this page (D-003). The words are
 * Claude's draft (D-012, D-059) until the founder approves them.
 */
export default async function SevenDayPage(): Promise<React.JSX.Element> {
  const page = await quickPageCached(null, 0, PAGE);
  if (page.days_max === null || page.days_min === null) notFound();
  const days = page.days_min === page.days_max ? `${page.days_max}` : `${page.days_min} – ${page.days_max}`;

  return (
    <div className="space-y-[clamp(28px,3.4vw,52px)]">
      <header className="border-line relative overflow-hidden rounded-lg border bg-paper px-[clamp(20px,4vw,64px)] py-[clamp(36px,6vw,88px)]">
        <p className="text-brand font-ui text-xs font-semibold uppercase tracking-[0.18em]">{days}-day delivery</p>
        <h1 className="font-display text-ink mt-4 max-w-[14ch] text-[clamp(40px,6vw,92px)] leading-[1.02] tracking-[-0.01em]">
          Home, in {days} days.
        </h1>
        <p className="text-ink-muted mt-5 max-w-[56ch] text-[clamp(15px,1.2vw,18px)] leading-relaxed">
          The snacks, masalas and sweets you grew up with, at your door in {days} days. One rule: keep the bag to pieces
          from this page. Add a kurta and everything travels together, on our usual date.
        </p>
        {/* the brand's running stitch (storefront.md §Visual system 8), here as a still thread under the words */}
        <div aria-hidden className="border-brand/60 mt-8 w-[min(420px,70%)] border-t-2 border-dashed" />
        <p className="text-ink font-ui mt-4 text-sm font-medium">
          {page.all_total} {page.all_total === 1 ? 'piece' : 'pieces'}
        </p>
      </header>
      {page.all_total === 0 ? (
        <p className="text-ink-muted">Nothing here right now. Look again soon.</p>
      ) : (
        <QuickView initial={page} />
      )}
    </div>
  );
}
