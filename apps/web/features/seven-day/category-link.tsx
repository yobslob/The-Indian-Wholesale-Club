'use client';

import Link from 'next/link';

import { QUICK_HOME } from '@/lib/site';

/** Sent when a category link changes the 7-day front page's address in place; the list (quick-view.tsx) reads it. */
export const QUICK_CATEGORY_EVENT = 'iwc:quick-category';

/**
 * D-154: a link to the 7-day store's list with a category chosen (`null`: all of it), from the tiles and the header.
 * On the front page itself it changes the address and tells the list, without a page load (Next keeps the page
 * mounted when only ?category= changes); from any other page, or opened in a new tab, it is an ordinary link.
 */
export function QuickCategoryLink({
  slug,
  className,
  children,
}: {
  slug: string | null;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const href = slug ? `${QUICK_HOME}?category=${slug}#all` : QUICK_HOME;
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (window.location.pathname !== QUICK_HOME) return;
        e.preventDefault();
        window.history.pushState(window.history.state, '', href);
        window.dispatchEvent(new Event(QUICK_CATEGORY_EVENT));
        if (slug) document.getElementById('all')?.scrollIntoView();
      }}
    >
      {children}
    </Link>
  );
}
