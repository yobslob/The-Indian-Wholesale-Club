import { HeroScroll } from './hero-scroll';
import styles from './home-hero.module.css';

const WORDS = ['Indian', 'Wholesale', 'Club'] as const;

/**
 * Home hero (D-052 – D-055, D-079): the founder's photo (AI-generated, IWC holds the rights) with the brand name on its
 * white wall and, since D-161, "We go home so you don't have to." with "India's shelves, at your door." under it, which
 * jumps to Pick your home (D-079's "Miss local market? Start here." and D-148's 7-day line gave way; the store tabs
 * carry the 7-day store). Server component; the only script is
 * HeroScroll, which publishes the scroll position for the CSS fade. The photo is drawn at full height on every screen,
 * so every screen needs all of its 1117 x 1409 pixels: AVIF (120 KB) where the browser reads it, else the WebP (241 KB),
 * both static files with no resizer in between (D-140).
 */
export function HomeHero(): React.JSX.Element {
  return (
    <section className={styles.hero} data-home-hero>
      <picture>
        <source srcSet="/images/home-hero.avif" type="image/avif" />
        {/* eslint-disable-next-line @next/next/no-img-element -- static photo, already at its size (D-140) */}
        <img
          src="/images/home-hero.webp"
          alt="A woman in a white embroidered suit and dupatta sits on a wooden bench in a hallway, her chin resting on her hand."
          width={1117}
          height={1409}
          fetchPriority="high"
          decoding="sync"
          className={styles.photo}
        />
      </picture>
      <div className={styles.words}>
        <h1 className={`${styles.brand} font-display`}>
          {WORDS.map((word, i) => (
            <span key={word} className={styles.word} style={{ '--i': i } as React.CSSProperties}>
              {word}{' '}
            </span>
          ))}
        </h1>
        {/* D-161: the homesick plan's heading (Claude's draft, the plan's first pick) and its line, to Pick your home */}
        <p className={`${styles.line} ${styles.lead} ${styles.word} font-body`} style={{ '--i': 3 } as React.CSSProperties}>
          We go home so you don&rsquo;t have to.
        </p>
        <p className={`${styles.sub} ${styles.word} font-body`} style={{ '--i': 4 } as React.CSSProperties}>
          <a href="#pick">India&rsquo;s shelves, at your door.</a>
        </p>
      </div>
      <HeroScroll />
    </section>
  );
}
