import Link from 'next/link';

import type { RegionCard as RegionCardData } from '@repo/db/store';

/**
 * One of the 36 regions (D-002: states and UTs shown the same way). The
 * greeting appears only when approved (the store view enforces D-019).
 */
export function RegionCard({ region }: { region: RegionCardData }): React.JSX.Element {
  return (
    <Link
      href={`/states/${region.slug}`}
      className="border-line bg-paper hover:border-ink block rounded-lg border p-5"
      style={
        region.accent_color ? { borderTopColor: region.accent_color, borderTopWidth: 4 } : undefined
      }
    >
      <p className="font-display text-ink text-xl">{region.name}</p>
      {region.greeting_native ? (
        <p
          className="text-ink-muted mt-1 text-sm"
          lang={region.greeting_script ? `und-${region.greeting_script}` : undefined}
        >
          {region.greeting_native}
        </p>
      ) : null}
      {region.tagline ? <p className="text-ink-muted mt-1 text-xs">{region.tagline}</p> : null}
      {!region.is_live ? <p className="text-ink-muted mt-2 text-xs">Coming soon</p> : null}
    </Link>
  );
}

export function RegionGrid({ regions }: { regions: RegionCardData[] }): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-[var(--gap)] sm:grid-cols-3 lg:grid-cols-4">
      {regions.map((region) => (
        <RegionCard key={region.slug} region={region} />
      ))}
    </div>
  );
}
