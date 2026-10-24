'use client';

import { useEffect, useRef, useState } from 'react';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { browseSearch, inStatePage, PAGE, parseBrowseQuery } from '@/features/catalog/browse-query';
import { BrowseSkeleton } from '@/features/catalog/browse-skeleton';
import { BrowseView } from '@/features/catalog/browse-view';
import { typeSwitch, typeSwitchItem } from '@/features/catalog/type-switch-style';

import type { BrowsePage } from '@repo/db/store';

export interface RegionTab {
  /** The address's ?type= (none for Clothing): clothing, food, home-and-gifts. */
  slug: string;
  label: string;
  count: number;
}

/** The type the address names (?type=, or an older link's #food), else null. */
function addressType(tabs: RegionTab[]): string | null {
  const type = new URLSearchParams(window.location.search).get('type') ?? window.location.hash.slice(1);
  return tabs.some((t) => t.slug === type) ? type : null;
}

const typeOf = (slug: string): ProductType | undefined => PRODUCT_TYPES.find((t) => PRODUCT_TYPE_PATH[t] === `/${slug}`);

/**
 * A state's Clothing · Food · Home & gifts (D-156, D-157): the See all pages' frosted switch with each type's count,
 * over that type's inventory as See all draws it (its filters, chips, sort and Show more). The first type is drawn on
 * the server (`firstView`); another is read the first time it is opened, from the same cached /api/browse answer See
 * all uses (its shape on screen meanwhile), so the page's build reads one inventory per state, not three (the build
 * ran past the database's statement limit with three, 2026-10-24). The address names the type
 * (/states/punjab?type=food; Clothing has none) and keeps its filters, so Back, a refresh and a shared link open the
 * same view. Switching while scrolled down brings the reader back to the top of the inventory.
 */
export function RegionTypeTabs({
  tabs,
  first,
  region,
  regionName,
  firstView,
  quickDays,
}: {
  tabs: RegionTab[];
  first: string;
  region: string;
  regionName: string;
  firstView: React.ReactNode;
  /** D-154: the 7-day days for "Delivery: in 7 days"; null while 7-day delivery is off. */
  quickDays: number | null;
}): React.JSX.Element {
  const [open, setOpen] = useState(first);
  const [pages, setPages] = useState<Record<string, BrowsePage | 'failed'>>({});
  const top = useRef<HTMLDivElement>(null);
  const query = inStatePage(parseBrowseQuery({}), region);
  const type = typeOf(open);
  const count = tabs.find((t) => t.slug === open)?.count ?? 0;
  const page = pages[open];

  useEffect(() => {
    if (open === first || !type || count === 0 || page) return;
    let gone = false;
    fetch(`/api/browse?type=${type}&offset=0&limit=${PAGE}&${browseSearch(query)}`)
      .then((r) => (r.ok ? (r.json() as Promise<BrowsePage>) : Promise.reject(new Error(String(r.status)))))
      .then((p) => !gone && setPages((all) => ({ ...all, [open]: p })))
      .catch(() => !gone && setPages((all) => ({ ...all, [open]: 'failed' })));
    return () => {
      gone = true;
    };
    // the query is the state's, fixed for the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, first, type, count, page]);

  useEffect(() => {
    const read = (): void => setOpen(addressType(tabs) ?? first);
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [tabs, first]);

  const choose = (slug: string): void => {
    if (slug === open) return;
    try {
      // a new type starts with no filters: they belong to the type left
      const href = slug === 'clothing' ? `/states/${region}` : `/states/${region}?type=${slug}`;
      window.history.replaceState(window.history.state, '', href);
    } catch {
      // the address keeps the last type; the switch still works
    }
    setOpen(slug);
    const box = top.current;
    if (!box) return;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 56;
    const y = box.getBoundingClientRect().top + window.scrollY - header - 12;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'auto' });
  };

  return (
    <div ref={top} className="space-y-6 pt-[clamp(8px,1.5vw,24px)]">
      {/* phones: three equal cells, the count under the name, so all three fit at 320 px */}
      <div
        role="tablist"
        aria-label="Clothing, food or home & gifts"
        className={`${typeSwitch} grid w-full grid-cols-3 sm:inline-flex sm:w-auto`}
      >
        {tabs.map((t) => (
          <button
            key={t.slug}
            type="button"
            role="tab"
            id={`tab-${t.slug}`}
            aria-selected={open === t.slug}
            aria-controls={`panel-${t.slug}`}
            tabIndex={open === t.slug ? 0 : -1}
            className={`${typeSwitchItem(open === t.slug)} flex-col justify-center gap-0.5 !px-2 leading-tight sm:flex-row sm:gap-2 sm:!px-5`}
            onClick={() => choose(t.slug)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const i = tabs.findIndex((x) => x.slug === t.slug) + (e.key === 'ArrowRight' ? 1 : -1);
              const next = tabs[(i + tabs.length) % tabs.length];
              if (!next) return;
              choose(next.slug);
              document.getElementById(`tab-${next.slug}`)?.focus();
            }}
          >
            <span className="whitespace-nowrap">{t.label}</span>
            <span className={`text-xs ${open === t.slug ? 'text-paper/70' : 'text-ink-muted'}`}>
              {t.count.toLocaleString('en-US')}
            </span>
          </button>
        ))}
      </div>
      {/* only the open type is drawn: each view keeps its own filters, Show more and Back history (use-browse.ts) */}
      <div key={open} role="tabpanel" id={`panel-${open}`} aria-labelledby={`tab-${open}`}>
        {open === first ? (
          firstView
        ) : !type || count === 0 ? (
          <ComingSoon type={type ?? 'food'} regionName={regionName} />
        ) : page === 'failed' ? (
          <p className="text-ink-muted">
            These pieces did not load.{' '}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() =>
                setPages((all) => {
                  const next = { ...all };
                  delete next[open];
                  return next;
                })
              }
            >
              Try again
            </button>
          </p>
        ) : page ? (
          <BrowseView productType={type} title={PRODUCT_TYPE_LABEL[type]} initialQuery={query} initial={page} quickDays={quickDays} />
        ) : (
          <BrowseSkeleton dense={type !== 'clothing'} />
        )}
      </div>
    </div>
  );
}

/** A type the state has nothing of yet. */
export function ComingSoon({ type, regionName }: { type: ProductType; regionName: string }): React.JSX.Element {
  return (
    <p className="bg-surface font-body rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
      {type === 'clothing'
        ? 'New pieces are on their way.'
        : `${PRODUCT_TYPE_LABEL[type]} from ${regionName} ${type === 'food' ? 'is' : 'are'} coming soon.`}
    </p>
  );
}
