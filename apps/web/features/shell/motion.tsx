'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * The storefront's motion (storefront.md §Direction, D-049): Lenis smooth scrolling, images that reveal as they
 * enter the viewport, a gentle parallax on [data-speed] elements, and the scroll's velocity as `--sv` on <html> (px per
 * frame, ±30) so grids and rows can float apart a little while the page moves fast and settle when it stops (D-116,
 * `.drift` in globals.css). Progressive enhancement only:
 * - Lenis is imported after the page is interactive (not in the first-load bundle, engineering.md §Budgets);
 * - with prefers-reduced-motion nothing runs: native scroll, no parallax, every image simply visible;
 * - only images still below the fold are hidden for the reveal, so nothing on screen ever flickers, and
 *   without JavaScript everything is visible.
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

export function Motion(): null {
  const pathname = usePathname();

  // Smooth scrolling: once per page load.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let frame = 0;
    let cancelled = false;
    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      // anchors: jump links scroll smoothly; Lenis subtracts html's scroll-padding-top (below the sticky header,
      // globals.css) and the target's scroll-margin itself, so no extra offset here.
      const instance = new Lenis({ lerp: 0.09, anchors: true });
      lenis = instance;
      // Lenis eases its velocity back to 0 as the page settles, so the drift springs home by itself. Written only when
      // it moves by more than 0.1 px, which also lets it rest at exactly 0.
      const root = document.documentElement;
      let last = 0;
      instance.on('scroll', ({ velocity }) => {
        const v = Math.max(-30, Math.min(30, Math.abs(velocity) < 0.1 ? 0 : velocity));
        if (Math.abs(v - last) < 0.1 && (v !== 0 || last === 0)) return;
        last = v;
        root.style.setProperty('--sv', v.toFixed(1));
      });
      const loop = (t: number): void => {
        lenis?.raf(t);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, []);

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

  // Reveal and parallax: again on every page, for the elements that page has.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pending = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter(
      (el) => el.getBoundingClientRect().top >= window.innerHeight, // at the fold = not yet seen (Home's album)
    );
    pending.forEach((el) => el.setAttribute('data-reveal', 'pending'));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.setAttribute('data-reveal', 'in');
          io.unobserve(e.target);
        }),
      { rootMargin: '0px 0px -6% 0px' },
    );
    pending.forEach((el) => io.observe(el));

    const moving = [...document.querySelectorAll<HTMLElement>('[data-speed]')];
    const factor = window.innerWidth < 820 ? 0.5 : 1;
    let frame = 0;
    const place = (): void => {
      frame = 0;
      for (const el of moving) {
        const rect = el.parentElement?.getBoundingClientRect();
        if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) continue;
        const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * Number(el.dataset.speed) * factor;
        el.style.transform = `translate3d(0, ${(-offset).toFixed(1)}px, 0)`;
      }
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    if (moving.length > 0) {
      place();
      window.addEventListener('scroll', schedule, { passive: true });
    }
    // The region album (D-052) moves only while it is on screen: no work and no battery spent off screen.
    const albums = new IntersectionObserver((entries) =>
      entries.forEach((e) => e.target.setAttribute('data-album', e.isIntersecting ? 'on' : 'off')),
    );
    document.querySelectorAll('[data-album]').forEach((el) => albums.observe(el));

    return () => {
      io.disconnect();
      albums.disconnect();
      window.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
