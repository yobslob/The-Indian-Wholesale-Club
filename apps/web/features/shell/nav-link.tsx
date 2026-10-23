'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isInfoPath } from '@/lib/site';

/**
 * A header link that marks itself as the current section (underlined, D-079) on its own page and the pages below it;
 * `exact`: on its own page only (the 7-day store's All, whose See all pages sit below it).
 */
export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const path = usePathname();
  const current = path === href || (!exact && path.startsWith(`${href}/`));
  return (
    <Link href={href} prefetch={isInfoPath(href) ? false : undefined} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}
