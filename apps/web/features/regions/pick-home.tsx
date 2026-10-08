import Link from 'next/link';

import { INDIA_MAP as MAP, TINY_REGIONS as TINY } from '@repo/shared/india-map';

import { PickHomeInteractive } from './pick-home-interactive';
import styles from './pick-home.module.css';
import { postmarkFor, StampGrid } from './region-stamp';

import type { DeliveryWindow, RegionCard } from '@repo/db/store';

const accent = (r: RegionCard): React.CSSProperties =>
  ({ '--acc': r.accent_color ?? 'var(--brand)' }) as React.CSSProperties;

/**
 * "Pick your home" (D-050 – D-052): the India map (DataMeet boundaries, static SVG rendered on the server)
 * beside the open regions as postage stamps and every other region by name. The map is decorative for
 * screen readers: the names and stamps are the same links. PickHomeInteractive adds hover, search and tips.
 */
export function PickHome({
  regions,
  delivery,
}: {
  regions: RegionCard[];
  delivery: DeliveryWindow | null;
}): React.JSX.Element {
  const bySlug = new Map(regions.map((r) => [r.slug, r]));
  const live = regions.filter((r) => r.is_live);
  const soon = regions.filter((r) => !r.is_live);
  const postmark = postmarkFor(delivery);

  return (
    <PickHomeInteractive className={styles.pick} regions={regions.map((r) => ({ slug: r.slug, name: r.name, live: r.is_live }))}>
      <div className={`${styles.panel} ${styles.mapPanel} bg-surface`} data-map-panel>
        <svg className={styles.map} viewBox={MAP.viewBox} aria-hidden="true" data-map>
          {Object.entries(MAP.paths).map(([slug, d]) => {
            const r = bySlug.get(slug);
            return (
              <path key={slug} d={d} data-slug={slug} className={r?.is_live ? styles.live : undefined} style={r ? accent(r) : undefined} />
            );
          })}
          {TINY.map((slug) => {
            const r = bySlug.get(slug);
            const [cx, cy] = MAP.centers[slug] ?? [0, 0];
            return (
              <circle key={slug} cx={cx} cy={cy} r={8} data-slug={slug} className={r?.is_live ? styles.live : undefined} style={r ? accent(r) : undefined} />
            );
          })}
        </svg>
        <div className={`${styles.tip} bg-ink text-paper font-ui`} data-map-tip hidden />
        <div className="font-ui text-ink-muted mt-3 flex flex-wrap justify-between gap-3 text-xs font-medium">
          <div className={`${styles.key} flex gap-4`}>
            <span className="inline-flex items-center gap-1.5">
              <i className={styles.keyLive} />
              Open now
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i />
              Coming soon
            </span>
          </div>
          <span>
            Map: <a href="https://github.com/datameet/maps" className="underline">DataMeet India</a>, CC BY 4.0
          </span>
        </div>
      </div>

      <div className={`${styles.panel} ${styles.side} bg-surface`}>
        <label className="border-line bg-paper focus-within:border-ink flex min-h-12 items-center gap-2.5 rounded-pill border px-[18px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-[18px] flex-none">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="sr-only">Find your state</span>
          <input type="search" placeholder="Find your state" autoComplete="off" data-search className="min-h-[46px] flex-1 bg-transparent text-[15px] outline-none" />
        </label>

        <div>
          <h3 className="font-ui text-ink-muted mb-3 flex justify-between text-[11px] font-semibold uppercase tracking-[0.16em]">
            <span>Open now</span>
            <span>{live.length}</span>
          </h3>
          <StampGrid regions={live} postmark={postmark} idPrefix="pm" />
        </div>

        <div>
          <h3 className="font-ui text-ink-muted mb-3 flex justify-between text-[11px] font-semibold uppercase tracking-[0.16em]">
            <span>Coming soon</span>
            <span>{soon.length}</span>
          </h3>
          <ul className={styles.names}>
            {soon.map((r) => (
              <li key={r.slug} data-name={r.name}>
                <Link href={`/states/${r.slug}`} data-slug={r.slug}>
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-ink-muted m-0 text-sm" data-empty hidden>
            No state or union territory by that name.
          </p>
        </div>
      </div>
    </PickHomeInteractive>
  );
}
