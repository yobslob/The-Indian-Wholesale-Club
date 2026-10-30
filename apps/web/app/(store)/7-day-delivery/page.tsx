import { notFound } from 'next/navigation';

import { formatUsd, PRODUCT_TYPE_LABEL } from '@repo/shared/domain';

import { inQuickStore, PAGE, toBrowseFilter } from '@/features/catalog/browse-query';
import { browseCached, getQuickFrontCached, quickPageCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { DoorLabel } from '@/features/seven-day/door-label';
import { QUICK_TYPES, quickCategories, quickHref } from '@/features/seven-day/links';
import { QuickTiles } from '@/features/seven-day/quick-tiles';
import { Flight } from '@/features/visuals/flight';
import { slotShown, VisualSlot } from '@/features/visuals/visual-slot';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '7-day store',
  description: 'Snacks, masalas and sweets from home, at your door in 7 days.',
};

/**
 * The 7-day store's front page (D-148, D-154; D-161: "Home is 7 days away." and the kirana counter; founder 2026-10-30:
 * pictures, not paragraphs): the heading with the parcel's door label (its date from the 7-day days in Settings:
 * non-negotiable 4) and the founder's photo, the flight with its free-delivery or festival banner, the shelf of
 * category tiles, the rows Most ordered this week, Under $5 and New this
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
  const days =
    front.days_min === front.days_max
      ? `${front.days_max}`
      : `${front.days_min} – ${front.days_max}`;
  const photo = slotShown('seven-day-hero');
  const free = front.min_cents ? `Free delivery from ${formatUsd(front.min_cents)}` : null;

  return (
    <div className="space-y-[clamp(28px,3.4vw,52px)]">
      {/* founder 2026-10-30: the front page as pictures, not paragraphs. The founder's photo (slots.ts) beside the
          heading and the parcel's label; without the photo the label stands beside the heading on its own. */}
      <header
        className={`grid items-center gap-[clamp(24px,4vw,64px)] pt-[clamp(8px,2vw,24px)] ${photo ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]' : ''}`}
      >
        <div
          className={`grid gap-[clamp(22px,3vw,40px)] ${photo ? '' : 'lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center'}`}
        >
          <h1 className="font-display text-ink max-w-[12ch] text-[clamp(44px,6.4vw,100px)] leading-[1.02] tracking-[-0.01em]">
            Home is {days} days away.
          </h1>
          <DoorLabel daysMin={front.days_min} daysMax={front.days_max} total={front.total} />
        </div>
        {photo ? (
          <VisualSlot id="seven-day-hero" eager className="max-h-[78svh] lg:max-h-[640px]" />
        ) : null}
      </header>
      <Flight free={free} festival="quick" />
      {front.total === 0 ? (
        <p className="text-ink-muted">Nothing here right now. Look again soon.</p>
      ) : (
        // every card here is a 7-day piece: the page says so once, not on each card (quickTag, as its list does)
        <>
          <QuickTiles categories={quickCategories(front.categories, page.categories)} />
          <div>
            <ProductRow id="most-ordered" title="What everyone missed this week" products={front.most_ordered}
              quickTag={false} />
            {/* D-161: Under $5 as the kirana counter, the small treats that top a bag up to the line */}
            <ProductRow
              id="under-5"
              title="The kirana counter"
              sub="Under $5"
              products={front.under_5}
              quickTag={false}
            />
            {/* the founder's seasonal poster between the rows (slots.ts) */}
            <VisualSlot id="seven-day-poster" className="my-[clamp(20px,3vw,40px)]" />
            <ProductRow
              id="new-this-week"
              title="New this week"
              products={front.new_this_week}
              quickTag={false}
            />
            {QUICK_TYPES.map((t, i) => (
              <ProductRow
                key={t}
                id={`all-${t}`}
                title={PRODUCT_TYPE_LABEL[t]}
                sub={`${byType[i]!.total} ${byType[i]!.total === 1 ? 'piece' : 'pieces'} in ${days} days`}
                products={byType[i]!.products.slice(0, 12)}
                quickTag={false}
                href={quickHref(t)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
