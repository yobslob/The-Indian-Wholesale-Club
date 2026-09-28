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
  return (
    <div className="space-y-4">
      <label className="text-ink block text-sm">
        State{' '}
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="border-line bg-canvas min-h-11 rounded-sm border px-2"
        >
          <option value="">All ({items.length})</option>
          {regions.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((i) => (
          <div key={i.key}>{i.node}</div>
        ))}
      </div>
    </div>
  );
}
