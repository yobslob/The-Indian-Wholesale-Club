import Link from 'next/link';

import { dayDate, PRODUCT_TYPE_LABEL, PRODUCT_TYPE_PATH, PRODUCT_TYPES } from '@repo/shared/domain';

import { QUICK_HOME } from '@/lib/site';

import { WIDE } from './diwali-hooks';
import { HeroScroll } from './hero-scroll';
import styles from './home-hero.module.css';

/** "7", or "12–21" when the days are a window. */
const span = (min: number | null, max: number | null): string | null =>
  max === null ? null : min === null || min === max ? `${max}` : `${min}–${max}`;

/**
 * Home hero (D-182; before it D-052 – D-055, D-079, D-161, D-180): one screen that says what is sold and opens it. The
 * founder's Diwali poster, the whole of it a link to the offer, over two doors: the Indian Wholesale Club with its three
 * types and the states, and the 7-day store. Phones stack them inside the first screen, landscape screens put them side
 * by side. The poster's headline is part of the picture (the site has no serif with a true italic); its date and link
 * are live text, placed on the picture's own wall (home-hero.module.css). Delivery days come from Settings (non-negotiable
 * 4). While 7-day delivery is off its store 404s, so its door is left out. Server component; the only script is
 * HeroScroll, for the header's colour. The poster is a static file with no resizer in between (D-140): AVIF 91 KB, WebP
 * 115 KB.
 */
export function HomeHero({
  quickDays,
  storeDays,
}: {
  /** The 7-day days (Settings); null while 7-day delivery is off or paused. */
  quickDays: { min: number | null; max: number | null } | null;
  /** The whole store's delivery days (Settings); null in cycle mode. */
  storeDays: { min: number | null; max: number | null };
}): React.JSX.Element {
  const days = span(storeDays.min, storeDays.max);
  const quick = quickDays ? span(quickDays.min, quickDays.max) : null;
  return (
    <section className={styles.hero} data-home-hero>
      <Link href={WIDE.href} prefetch={false} className={styles.poster}>
        <picture>
          <source srcSet="/images/home-hero-diwali.avif" type="image/avif" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo, already at its size (D-140) */}
          <img
            src="/images/home-hero-diwali.webp"
            alt=""
            width={1024}
            height={1536}
            fetchPriority="high"
            decoding="sync"
            className={styles.photo}
          />
        </picture>
        {WIDE.day ? <span className={`${styles.date} font-ui`}>Diwali · {dayDate(WIDE.day)}</span> : null}
        {/* the same words as the picture's, for screen readers and search */}
        <span className="sr-only">{WIDE.hook} </span>
        <span className={`${styles.shop} font-ui`}>
          {WIDE.cta}
          <span className={styles.ring} aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M2 8h11M9 4l4 4-4 4" />
            </svg>
          </span>
        </span>
      </Link>
      <div className={styles.panel}>
        <div className={styles.store}>
          <h1 className={`${styles.brand} font-display`}>Indian Wholesale Club</h1>
          <p className={`${styles.about} font-body`}>
            Clothing, food and gifts from all 36 states of India, at your door{days ? ` in ${days} days` : ''}.
          </p>
          <nav aria-label="Shop the Indian Wholesale Club" className={styles.kinds}>
            {PRODUCT_TYPES.map((t) => (
              <Link key={t} href={PRODUCT_TYPE_PATH[t]} prefetch={false} className={`${styles.kind} font-ui`}>
                {PRODUCT_TYPE_LABEL[t]}
              </Link>
            ))}
            <Link href="/states" prefetch={false} className={`${styles.kind} font-ui`}>
              States
            </Link>
          </nav>
        </div>
        {quick ? (
          <Link href={QUICK_HOME} prefetch={false} className={styles.door}>
            <span className={styles.doorWords}>
              <span className={`${styles.doorName} font-heading`}>
                <b>7</b>-day store
              </span>
              <span className={`${styles.about} font-body`}>
                Snacks, masalas and sweets from home, at your door in {quick} days.
              </span>
            </span>
            <span className={`${styles.go} font-ui`}>
              Get it here
              <span className={styles.arrows} aria-hidden="true">
                <i>&rsaquo;</i>
                <i>&rsaquo;</i>
              </span>
            </span>
          </Link>
        ) : null}
      </div>
      <HeroScroll />
    </section>
  );
}
