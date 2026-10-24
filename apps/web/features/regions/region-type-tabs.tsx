'use client';

import { useEffect, useRef, useState } from 'react';

import { typeSwitch, typeSwitchItem } from '@/features/catalog/type-switch-style';

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

/**
 * A state's Clothing · Food · Home & gifts (D-156, D-157): the See all pages' frosted switch with each type's count,
 * over that type's inventory as See all draws it (its filters, chips, sort and Show more; `views`, drawn on the server
 * with their first 24 cards, so a switch is instant and asks for nothing). The address names the type
 * (/states/punjab?type=food; Clothing has none) and keeps its filters, so Back, a refresh and a shared link open the
 * same view. Switching while scrolled down brings the reader back to the top of the inventory.
 */
export function RegionTypeTabs({
  tabs,
  first,
  region,
  views,
}: {
  tabs: RegionTab[];
  first: string;
  region: string;
  views: Record<string, React.ReactNode>;
}): React.JSX.Element {
  const [open, setOpen] = useState(first);
  const top = useRef<HTMLDivElement>(null);

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
        {views[open]}
      </div>
    </div>
  );
}
