'use client';

import { useState } from 'react';

interface Item {
  key: string;
  regionSlug: string;
  node: React.ReactNode;
}

/**
 * Client-side region filter over server-rendered product cards
 * (storefront.md: "static + client filtering"). No extra request.
 */
export function RegionFilter({
  items,
  regions,
}: {
  items: Item[];
  regions: { slug: string; name: string }[];
}): React.JSX.Element {
  const [region, setRegion] = useState('');
  const shown = region ? items.filter((i) => i.regionSlug === region) : items;
  const pill = (on: boolean): string =>
    `font-ui inline-flex min-h-11 items-center gap-2 rounded-pill border px-5 text-sm font-medium ${
      on ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink'
    }`;
  return (
    <div className="space-y-6">
      <div role="group" aria-label="Filter by state" className="flex flex-wrap gap-2.5">
        <button type="button" aria-pressed={region === ''} onClick={() => setRegion('')} className={pill(region === '')}>
          All <span className="opacity-60">{items.length}</span>
        </button>
        {regions.map((r) => (
          <button key={r.slug} type="button" aria-pressed={region === r.slug} onClick={() => setRegion(r.slug)} className={pill(region === r.slug)}>
            {r.name} <span className="opacity-60">{items.filter((i) => i.regionSlug === r.slug).length}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-[var(--gap)] gap-y-[clamp(28px,3vw,44px)] xl:grid-cols-4">
        {shown.map((i) => (
          <div key={i.key}>{i.node}</div>
        ))}
      </div>
    </div>
  );
}
