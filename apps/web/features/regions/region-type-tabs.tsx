'use client';

import { useEffect, useRef, useState } from 'react';

import { typeSwitch, typeSwitchItem } from '@/features/catalog/type-toggle';

export interface RegionTab {
  /** The address's hash and the panel's id: clothing, food, home-and-gifts. */
  slug: string;
  label: string;
  count: number;
}

/**
 * A state's Clothing · Food · Home & gifts (founder 2026-10-24: "the same consistency in design as normal pages while
 * distributing clothing, food and home n gift in a toggle"): the See all pages' frosted switch (D-122), pinned under
 * the header, with each type's count. Every panel is drawn on the server (the page stays one cached build, PR-1); the
 * switch shows one and hides the others, at once, with no request. The choice is kept in the address's hash
 * (/states/punjab#food), so Back, a shared link and a refresh open the same type. Tapping a type while scrolled down
 * brings the reader back to the top of its rows, not to the middle of another type's page.
 */
export function RegionTypeTabs({
  tabs,
  first,
  panels,
}: {
  tabs: RegionTab[];
  first: string;
  panels: Record<string, React.ReactNode>;
}): React.JSX.Element {
  const [open, setOpen] = useState(first);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = (): void => {
      const hash = window.location.hash.slice(1);
      if (tabs.some((t) => t.slug === hash)) setOpen(hash);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [tabs]);

  const choose = (slug: string): void => {
    setOpen(slug);
    try {
      history.replaceState(history.state, '', `#${slug}`);
    } catch {
      // the address keeps the last type; the switch still works
    }
    const box = top.current;
    if (!box) return;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 56;
    const y = box.getBoundingClientRect().top + window.scrollY - header;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'auto' });
  };

  return (
    <div ref={top}>
      <div className="bg-canvas/90 sticky top-[var(--top-h)] z-10 -mx-[var(--gut)] px-[var(--gut)] py-3 backdrop-blur-xl">
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
              tabIndex={open === t.slug ? 0 : -1}
            >
              <span className="whitespace-nowrap">{t.label}</span>
              <span className={`text-xs ${open === t.slug ? 'text-paper/70' : 'text-ink-muted'}`}>{t.count.toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.slug} role="tabpanel" id={`panel-${t.slug}`} aria-labelledby={`tab-${t.slug}`} hidden={open !== t.slug}>
          {panels[t.slug]}
        </div>
      ))}
    </div>
  );
}
