import Image from 'next/image';
import Link from 'next/link';

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
 * One open state as a postage stamp (D-051, D-080): its photo, its name in Cinzel, and a postmark with the next
 * delivery window from cycle data (D-008; no window, no dates). `data-slug` / `data-name` are what Pick your home's
 * hover and search look for.
 */
export function RegionStamp({
  region: r,
  postmark,
  idPrefix,
}: {
  region: StampRegion;
  postmark: string;
  idPrefix: string;
}): React.JSX.Element {
  const ring = `${idPrefix}-${r.slug}`;
  return (
    <Link href={`/states/${r.slug}`} className={styles.stamp} data-slug={r.slug} data-name={r.name} style={accent(r)}>
      <span className={styles.face}>
        {r.hero_image_path ? (
          <Image src={mediaUrl(r.hero_image_path)} alt="" fill sizes="(min-width: 1100px) 12vw, 30vw" className="object-cover" />
        ) : null}
      </span>
      <span className={styles.caption}>
        <em className="font-display">{r.name}</em>
        <b className="font-ui">Open</b>
      </span>
      <svg className={styles.postmark} viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <path id={ring} d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" />
        </defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="1" />
        {postmark ? (
          <text fontSize="8.2" letterSpacing="1.2" fill="currentColor" className="font-ui font-semibold">
            <textPath href={`#${ring}`}>{postmark.repeat(2)}</textPath>
          </text>
        ) : null}
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
  postmark,
  idPrefix,
}: {
  regions: StampRegion[];
  postmark: string;
  idPrefix: string;
}): React.JSX.Element {
  const stamp = (r: StampRegion): React.JSX.Element => (
    <RegionStamp key={r.slug} region={r} postmark={postmark} idPrefix={idPrefix} />
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
