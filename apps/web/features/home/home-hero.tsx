import { HeroScroll } from './hero-scroll';
import styles from './home-hero.module.css';

const WORDS = ['Indian', 'Wholesale', 'Club'] as const;

/**
 * Home hero (D-052 – D-055, D-079): the founder's photo (AI-generated, IWC holds the rights) with the brand name on its
 * white wall and "Miss local market? Start here.", which jumps to Pick your home; since D-148, while 7-day delivery is on,
 * "Want in 7 days? Click here." (the days from Settings) opens the 7-day page instead. Server component; the only script is
 * HeroScroll, which publishes the scroll position for the CSS fade. The photo is drawn at full height on every screen,
 * so every screen needs all of its 1117 x 1409 pixels: AVIF (120 KB) where the browser reads it, else the WebP (241 KB),
 * both static files with no resizer in between (D-140).
 */
export function HomeHero({ quickDays = null }: { quickDays?: number | null }): React.JSX.Element {
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
        <p className={`${styles.line} ${styles.word} font-body`} style={{ '--i': 3 } as React.CSSProperties}>
          {quickDays ? (
            <>
              Want in {quickDays} days? <a href="/7-day-delivery">Click here.</a>
            </>
          ) : (
            <>
              Miss local market? <a href="#pick">Start here.</a>
            </>
          )}
        </p>
      </div>
      <HeroScroll />
    </section>
  );
}
