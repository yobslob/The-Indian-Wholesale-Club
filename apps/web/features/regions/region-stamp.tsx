import Link from 'next/link';

import { StorePhoto } from '@/features/catalog/store-photo';
import { mediaUrl } from '@/lib/site';

import { StampPager } from './stamp-pager';
import styles from './stamps.module.css';

import type { RegionCard } from '@repo/db/store';

type StampRegion = Pick<RegionCard, 'slug' | 'name' | 'accent_color' | 'hero_image_path'>;

/** Stamps per page; from one more than this they page (D-080). */
const PAGE = 6;

const accent = (r: StampRegion): React.CSSProperties =>
  ({ '--acc': r.accent_color ?? 'var(--brand)' }) as React.CSSProperties;

/**
 * One open state as a postage stamp (D-051, D-080): its photo, its name in Cinzel, and a postmark (no date on store
 * pages, D-187). `data-slug` / `data-name` are what Pick your home's
 * hover and search look for.
 */
export function RegionStamp({
  region: r,
}: {
  region: StampRegion;
}): React.JSX.Element {
  return (
    <Link href={`/states/${r.slug}`} className={styles.stamp} data-slug={r.slug} data-name={r.name} style={accent(r)}>
      <span className={styles.face}>
        {r.hero_image_path ? (
          <StorePhoto src={mediaUrl(r.hero_image_path)} alt="" sizes="(min-width: 1100px) 12vw, 30vw" className="object-cover" />
        ) : null}
      </span>
      <span className={styles.caption}>
        <em className="font-display">{r.name}</em>
        <b className="font-ui">Open</b>
      </span>
      <svg className={styles.postmark} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="1" />
        <text x="50" y="54" textAnchor="middle" fontSize="13" fill="currentColor" className="font-logo italic">
          IWC
        </text>
      </svg>
    </Link>
  );
}

/** The open states as stamps: up to 6 in one grid as always, from 7 in pages of 6 with arrows and a count (D-080). */
export function StampGrid({
  regions,
}: {
  regions: StampRegion[];
}): React.JSX.Element {
  const stamp = (r: StampRegion): React.JSX.Element => (
    <RegionStamp key={r.slug} region={r} />
  );
  if (regions.length <= PAGE) return <div className={styles.stamps}>{regions.map(stamp)}</div>;
  const pages: StampRegion[][] = [];
  for (let i = 0; i < regions.length; i += PAGE) pages.push(regions.slice(i, i + PAGE));
  return (
    <StampPager count={pages.length}>
      {pages.map((page, i) => (
        <div key={i} className={styles.stamps}>
          {page.map(stamp)}
        </div>
      ))}
    </StampPager>
  );
}
