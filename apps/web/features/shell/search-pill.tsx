'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { isQuickPath, QUICK_HOME } from '@/lib/site';

import { HeaderIcon } from './header-icons';

/**
 * The header's Search (D-079, D-113): a pill with the icon and the word; it grows into a long search bar once the page
 * is scrolled (html[data-scrolled]), on hover or focus, and while something is typed. Enter opens /search. The look
 * is CSS (app/globals.css, .site-search); the script marks the scroll and lets a hovered pill close on mouse-out.
 * D-154: inside the 7-day store it searches only 7-day pieces (/7-day-delivery/search).
 */
export function SearchPill(): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const quick = isQuickPath(usePathname());
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const update = (): void => {
      frame = 0;
      root.toggleAttribute('data-scrolled', window.scrollY > 24);
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
      root.removeAttribute('data-scrolled');
    };
  }, []);
  return (
    <form
      action={quick ? `${QUICK_HOME}/search` : '/search'}
      role="search"
      className="site-search"
      onMouseLeave={() => {
        if (input.current && !input.current.value) input.current.blur();
      }}
    >
      <span className="site-search-word" aria-hidden="true">
        Search
      </span>
      <HeaderIcon name="search" />
      <input ref={input} type="search" name="q" placeholder={quick ? 'Search the 7-day store' : 'Search'} aria-label="Search" />
    </form>
  );
}
