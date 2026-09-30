'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * The storefront's motion (design.md §Direction, D-049): Lenis smooth scrolling, images that reveal as they
 * enter the viewport, and a gentle parallax on [data-speed] elements. Progressive enhancement only:
 * - Lenis is imported after the page is interactive (not in the first-load bundle, engineering.md §Budgets);
 * - with prefers-reduced-motion nothing runs: native scroll, no parallax, every image simply visible;
 * - only images still below the fold are hidden for the reveal, so nothing on screen ever flickers, and
 *   without JavaScript everything is visible.
 */
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
      // anchors: jump links scroll smoothly and land below the sticky header (scroll-padding-top in globals.css).
      lenis = new Lenis({ lerp: 0.09, anchors: { offset: -96 } });
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

  // Reveal and parallax: again on every page, for the elements that page has.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pending = [...document.querySelectorAll<HTMLElement>('[data-reveal]')].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
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
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
