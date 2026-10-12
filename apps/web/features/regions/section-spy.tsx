'use client';

import { useEffect, useRef } from 'react';

/**
 * The region page's sticky jump pills follow the reader (D-116): the pill of the section in the middle of the screen
 * is marked (aria-current, styled in globals.css) and slides into view in its row. Rendered inside the pills' <nav>;
 * attributes are set directly, without re-rendering the server-drawn pills.
 */
export function SectionSpy(): React.JSX.Element {
  const probe = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const nav = probe.current?.closest('nav');
    if (!nav) return;
    const pills = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const byId = new Map(pills.map((a) => [a.hash.slice(1), a]));
    const sections = [...byId.keys()]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let current: HTMLAnchorElement | null = null;
    const mark = (pill: HTMLAnchorElement | null): void => {
      if (pill === current) return;
      current?.removeAttribute('aria-current');
      current = pill;
      if (!pill) return;
      pill.setAttribute('aria-current', 'location');
      // Scroll the pill row only (scrollIntoView would also move the page).
      const row = pill.closest('ul');
      if (!row) return;
      const left = pill.offsetLeft - row.clientWidth / 2 + pill.offsetWidth / 2;
      row.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    };
    // A thin band across the middle of the screen: the section crossing it is the one being read.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) mark(byId.get(e.target.id) ?? null);
      },
      { rootMargin: '-45% 0px -54% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return <span ref={probe} hidden />;
}
