import Link from 'next/link';

import { dayDate, formatUsd, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES } from '@repo/shared/domain';

import { heroSans, heroSerif } from './hero-font';
import { HeroScroll } from './hero-scroll';
import { HERO } from './hero-words';
import styles from './home-hero.module.css';
import { SEASON } from './homecoming-hooks';

/** "7", or "12 – 16" when the days are a window. */
const span = (min: number | null, max: number | null): string | null =>
  max === null ? null : min === null || min === max ? `${max}` : `${min} – ${max}`;

const ARROW = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M2 8h11M9 4l4 4-4 4" />
  </svg>
);

/**
 * Home hero (D-183 – D-185, D-187; before it D-182, D-052 – D-055, D-079, D-161, D-180): one screen that opens the store.
 * The poster's words live on the picture's dark wall (the picture carries none since D-183) in the poster's own type
 * (Cormorant Garamond and Montserrat, hero-font.ts): the season's date (Thanksgiving, D-196), the headline with its gold italic, the delivery
 * days, and a small gold button that is the free line; the whole poster is one link to Food. Under it on phones, beside
 * it on landscape screens: Indian Wholesale Club and its four doors. Delivery days and the free line come from Settings
 * (non-negotiable 4). Server component; the only script is HeroScroll, for the
 * header's colour. The picture is a static file with no resizer in between (D-140): the founder's Thanksgiving poster
 * (D-196), AVIF 37 KB, WebP 80 KB.
 */
export function HomeHero({
  foodDays,
  storeDays,
  freeCents,
}: {
  /** Food's delivery days (Settings). */
  foodDays: { min: number | null; max: number | null };
  /** Clothing and home & gifts' delivery days (Settings): said only if food's are not set. */
  storeDays: { min: number | null; max: number | null };
  /** The free line (Settings); null when there is none. */
  freeCents: number | null;
}): React.JSX.Element {
  const food = span(foodDays.min, foodDays.max);
  const days = food ?? span(storeDays.min, storeDays.max);
  // a cap: in US dollars in every country (D-198)
  const free = freeCents ? formatUsd(freeCents) : null;
  return (
    <section className={`${styles.hero} ${heroSerif.variable} ${heroSans.variable}`} data-home-hero>
      <Link href="/food" prefetch={false} className={styles.poster}>
        <picture>
          <source srcSet="/images/home-hero-thanksgiving.avif" type="image/avif" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo, already at its size (D-140) */}
          <img
            src="/images/home-hero-thanksgiving.webp"
            alt=""
            width={1000}
            height={1500}
            fetchPriority="high"
            decoding="sync"
            className={styles.photo}
          />
        </picture>
        <span className={styles.offer}>
          {/* the date names the season; screen readers hear the store's own words first */}
          {SEASON.day ? <span className="sr-only">{HERO.storeClosed}. </span> : null}
          <span className={styles.kicker}>
            {SEASON.day ? `${SEASON.name} · ${dayDate(SEASON.day)}` : HERO.storeClosed}
          </span>
          <span className={styles.headline}>
            {HERO.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            <em>{HERO.accent}</em>
          </span>
          {days ? (
            <span className={styles.when}>
              {HERO.when} <b>{days}&nbsp;delivery days</b>
              {food ? <small> {HERO.onFood}</small> : null}.
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
