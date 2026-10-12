'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isInfoPath } from '@/lib/site';

/** A header link that marks itself as the current section (underlined, D-079) on its own page and the pages below it. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }): React.JSX.Element {
  const path = usePathname();
  const current = path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} prefetch={isInfoPath(href) ? false : undefined} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}
