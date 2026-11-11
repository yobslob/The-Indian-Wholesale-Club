'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { startPageMotion } from './motion-reveal';

export { enhanceMotion } from './motion-reveal';

/**
 * The storefront's motion (storefront.md §Direction, D-049; the browser's own scrolling since §10 Y-6): images that
 * reveal as they enter the viewport, a gentle parallax on [data-speed] elements and Home's season windows that pause off screen
 * (motion-reveal.ts). Progressive enhancement only: with prefers-reduced-motion nothing runs (no parallax,
 * every image simply visible), and without JavaScript everything is visible.
 */
let navTimer = 0;
/** The top line while a page is on its way (globals.css `html[data-nav]`); gone when it is drawn or after 15 s. */
export function navStart(): void {
  document.documentElement.dataset.nav = '';
  window.clearTimeout(navTimer);
  navTimer = window.setTimeout(navDone, 15000);
}
function navDone(): void {
  window.clearTimeout(navTimer);
  delete document.documentElement.dataset.nav;
}

const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Motion(): null {
  const pathname = usePathname();

  // A link to another page shows a thin line at the top from the tap until that page is drawn (founder 2026-10-30:
  // "clicking them doesn't open"; on a slow connection a tap looked dead). `navStart` marks taps that are not links.
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const to = new URL(a.href, location.href);
      if (to.origin === location.origin && to.pathname !== location.pathname) navStart();
    };
    // capture: next/link prevents the default before a bubbling listener would see the tap
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  useEffect(() => navDone(), [pathname]);

  // Reveal, parallax and album pause: again on every page, for the elements that page has.
  useEffect(() => {
    if (reducedMotion()) return;
    return startPageMotion().stop;
  }, [pathname]);

  return null;
}
