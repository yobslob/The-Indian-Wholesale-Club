'use client';

import Link from 'next/link';
import { useState } from 'react';

import { seeAllPill, sectionHeading } from '@/features/catalog/product-row';
import { typeSwitch, typeSwitchItem } from '@/features/catalog/type-toggle';

import type { ProductType } from '@repo/shared/domain';

export interface JustListedTab {
  type: ProductType;
  label: string;
  /** See all for this type. */
  href: string;
  /** The server-rendered row (or the type's "coming soon" line). */
  panel: React.ReactNode;
}

/**
 * Home's Just listed (D-136): the See all pages' Clothing · Food · Home & gifts switch under the heading; it swaps the
 * row in place (all three rows are in the page, server-rendered) and See all follows the type shown.
 */
export function JustListedSwitch({ tabs, initial }: { tabs: JustListedTab[]; initial?: ProductType }): React.JSX.Element {
  const [current, setCurrent] = useState(initial ?? tabs[0]?.type);
  const active = tabs.find((t) => t.type === current) ?? tabs[0];

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const i = tabs.findIndex((t) => t.type === current);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    if (!next) return;
    setCurrent(next.type);
    document.getElementById(`jl-tab-${next.type}`)?.focus();
  };

  return (
    <section id="just-listed" aria-labelledby="just-listed-h" className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
      <div className="mb-[clamp(16px,1.8vw,24px)] flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="just-listed-h" className={sectionHeading} data-reveal="">
            Just listed
          </h2>
          <div role="tablist" aria-label="Clothing, food or home & gifts" className={`${typeSwitch} mt-3`} onKeyDown={onKey}>
            {tabs.map((t) => (
              <button
                key={t.type}
                id={`jl-tab-${t.type}`}
                type="button"
                role="tab"
                aria-selected={t.type === active?.type}
                aria-controls={`jl-panel-${t.type}`}
                tabIndex={t.type === active?.type ? 0 : -1}
                className={typeSwitchItem(t.type === active?.type)}
                onClick={() => setCurrent(t.type)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {active ? (
          <Link href={active.href} className={seeAllPill}>
            See all<span className="sr-only"> {active.label}</span>
            <span aria-hidden="true" className="-mr-1 transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        ) : null}
      </div>
      {tabs.map((t) => (
        <div
          key={t.type}
          id={`jl-panel-${t.type}`}
          role="tabpanel"
          aria-labelledby={`jl-tab-${t.type}`}
          hidden={t.type !== active?.type}
        >
          {t.panel}
        </div>
      ))}
    </section>
  );
}
