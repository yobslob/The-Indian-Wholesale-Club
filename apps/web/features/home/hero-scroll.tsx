'use client';

import { useEffect } from 'react';

/**
 * Sets html[data-hero-passed] once the Home hero is under the header, which turns the header cream again (CSS).
 */
export function HeroScroll(): null {
  useEffect(() => {
    const root = document.documentElement;
    const hero = document.querySelector<HTMLElement>('[data-home-hero]');
    const header = document.querySelector<HTMLElement>('.site-top');
    if (!hero) return;
    let frame = 0;
    const update = (): void => {
      frame = 0;
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
      root.removeAttribute('data-hero-passed');
    };
  }, []);
  return null;
}
