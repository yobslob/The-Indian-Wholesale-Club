import Link from 'next/link';

import { dayDate, formatUsd, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES } from '@repo/shared/domain';

import { QUICK_HOME } from '@/lib/site';

import { WIDE } from './diwali-hooks';
import { heroSans, heroSerif } from './hero-font';
import { HeroScroll } from './hero-scroll';
import { HERO } from './hero-words';
import styles from './home-hero.module.css';

/** "7", or "5–7" when the days are a window. */
const span = (min: number | null, max: number | null): string | null =>
  max === null ? null : min === null || min === max ? `${max}` : `${min}–${max}`;

const ARROW = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M2 8h11M9 4l4 4-4 4" />
  </svg>
);

/**
 * Home hero (D-183 – D-185; before it D-182, D-052 – D-055, D-079, D-161, D-180): one screen that opens the store. The
 * poster is the 7-day store's front door: its words live on the picture's dark wall (the picture carries none since
 * D-183) in the poster's own type (Cormorant Garamond and Montserrat, hero-font.ts): the Diwali date, the headline with
 * its gold italic, the days, and a small gold button that is the free 7-day line; the whole poster is one link to the
 * 7-day store. Under it on phones, beside it on landscape screens: Indian Wholesale Club and its four doors. Delivery days
 * and the free line come from Settings (non-negotiable 4); while 7-day delivery is off its store 404s, so the poster opens
 * Food with the whole store's days and a plain button. Server component; the only script is HeroScroll, for the
 * header's colour. The picture is a static file with no resizer in between (D-140): AVIF 86 KB, WebP 109 KB.
 */
export function HomeHero({
  quickDays,
  quickFreeCents,
  storeDays,
}: {
  /** The 7-day days (Settings); null while 7-day delivery is off or paused. */
  quickDays: { min: number | null; max: number | null } | null;
  /** The 7-day free line (Settings, D-154); null when there is none. */
  quickFreeCents: number | null;
  /** The whole store's delivery days (Settings); null in cycle mode. */
  storeDays: { min: number | null; max: number | null };
}): React.JSX.Element {
  const quick = quickDays ? span(quickDays.min, quickDays.max) : null;
  const days = quick ?? span(storeDays.min, storeDays.max);
  const free = quick && quickFreeCents ? formatUsd(quickFreeCents) : null;
  return (
    <section className={`${styles.hero} ${heroSerif.variable} ${heroSans.variable}`} data-home-hero>
      <Link href={quick ? QUICK_HOME : '/food'} prefetch={false} className={styles.poster}>
        <picture>
          <source srcSet="/images/home-hero-7day.avif" type="image/avif" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo, already at its size (D-140) */}
          <img
            src="/images/home-hero-7day.webp"
            alt=""
            width={1024}
            height={1536}
            fetchPriority="high"
            decoding="sync"
            className={styles.photo}
          />
        </picture>
        <span className={styles.offer}>
          {/* the date says Diwali; screen readers hear which store the poster opens */}
          {quick ? <span className="sr-only">{HERO.store}. </span> : null}
          <span className={styles.kicker}>
            {WIDE.day ? `Diwali · ${dayDate(WIDE.day)}` : quick ? HERO.store : HERO.storeClosed}
          </span>
          <span className={styles.headline}>
            {HERO.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            <em>{HERO.accent}</em>
          </span>
          {days ? (
            <span className={styles.when}>
              {HERO.when} <b>{days}&nbsp;days</b>
              {quick ? <small> {HERO.onFood}</small> : null}.
            </span>
          ) : null}
          {/* D-185: the button is the free line, two short lines; with no free line it just opens the store */}
          <span className={styles.cta}>
            {free ? (
              <span>
                <small>{HERO.free}</small> from {free}
              </span>
            ) : (
              <span>{HERO.shop}</span>
            )}
            <i>{ARROW}</i>
          </span>
        </span>
      </Link>
      <div className={styles.panel}>
        <h1 className={styles.brand}>Indian Wholesale Club</h1>
        <nav aria-label="Shop the Indian Wholesale Club" className={styles.kinds}>
          {PRODUCT_TYPES.map((t) => (
            <Link key={t} href={PRODUCT_TYPE_PATH[t]} prefetch={false} className={styles.kind}>
              {PRODUCT_TYPE_LABEL[t]}
            </Link>
          ))}
          <Link href="/states" prefetch={false} className={styles.kind}>
            States
          </Link>
        </nav>
      </div>
      <HeroScroll />
    </section>
  );
}
