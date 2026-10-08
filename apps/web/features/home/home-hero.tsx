import Image from 'next/image';

import { HeroScroll } from './hero-scroll';
import styles from './home-hero.module.css';

const WORDS = ['Indian', 'Wholesale', 'Club'] as const;

/**
 * Home hero (D-052 – D-055, D-079): the founder's photo (AI-generated, IWC holds the rights) with the brand name on its
 * white wall and "Miss local market? Start here.", which jumps to Pick your home. Server component; the only script is
 * HeroScroll, which publishes the scroll position for the CSS fade.
 */
export function HomeHero(): React.JSX.Element {
  return (
    <section className={styles.hero} data-home-hero>
      <Image
        src="/images/home-hero.webp"
        alt="A woman in a white embroidered suit and dupatta sits on a wooden bench in a hallway, her chin resting on her hand."
        fill
        priority
        sizes="100vw"
        className={styles.photo}
      />
      <div className={styles.words}>
        <h1 className={`${styles.brand} font-display`}>
          {WORDS.map((word, i) => (
            <span key={word} className={styles.word} style={{ '--i': i } as React.CSSProperties}>
              {word}{' '}
            </span>
          ))}
        </h1>
        <p className={`${styles.line} ${styles.word} font-body`} style={{ '--i': 3 } as React.CSSProperties}>
          Miss local market? <a href="#pick">Start here.</a>
        </p>
      </div>
      <HeroScroll />
    </section>
  );
}
