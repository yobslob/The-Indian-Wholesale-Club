'use client';

import { useEffect } from 'react';

/**
 * Publishes how far the Home hero has scrolled: --hero-p (0 at the top, 1 after 55 % of the hero) on
 * <html>, which fades the brand words out and the header logo in (CSS), and html[data-hero-passed] once
 * the photo is under the header. Opacity only follows the scroll, so it also runs with reduced motion.
 */
export function HeroScroll(): null {
  useEffect(() => {
    const root = document.documentElement;
    const hero = document.querySelector<HTMLElement>('[data-home-hero]');
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!hero) return;
    let frame = 0;
    const update = (): void => {
      frame = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.55)));
      root.style.setProperty('--hero-p', p.toFixed(3));
      root.toggleAttribute('data-hero-passed', window.scrollY >= hero.offsetHeight - (header?.offsetHeight ?? 0));
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
      root.style.removeProperty('--hero-p');
      root.removeAttribute('data-hero-passed');
    };
  }, []);
  return null;
}
