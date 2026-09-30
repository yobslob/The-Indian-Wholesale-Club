import Image from 'next/image';

import { HeroScroll } from './hero-scroll';
import styles from './home-hero.module.css';

const WORDS = ['The', 'Indian', 'Wholesale', 'Club'] as const;

/**
 * Home hero (design.md §Direction, D-052 – D-055): the founder's photo (AI-generated, IWC holds the
 * rights) with the brand name and "Clothing and spices from home". Server component; the only script is
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
        <h1 className={`${styles.brand} font-hero`}>
          {WORDS.map((word, i) => (
            <span key={word} className={styles.word} style={{ '--i': i } as React.CSSProperties}>
              {word}{' '}
            </span>
          ))}
        </h1>
        <p className={`${styles.label} font-hero`}>Clothing and spices from home</p>
      </div>
      <HeroScroll />
    </section>
  );
}
