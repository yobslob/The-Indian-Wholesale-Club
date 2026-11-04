'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isInfoPath } from '@/lib/site';

import { IntentLink } from './intent-link';

/**
 * A header link that marks itself as the current section (underlined, D-079) on its own page and the pages below it.
 * Read ahead on intent, not on sight (intent-link.tsx, launch QA C-6); an info page never (D-116).
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const path = usePathname();
  const current = path === href || path.startsWith(`${href}/`);
  const mark = current ? 'page' : undefined;
  return isInfoPath(href) ? (
    <Link href={href} prefetch={false} aria-current={mark}>
      {children}
    </Link>
  ) : (
    <IntentLink href={href} aria-current={mark}>
      {children}
    </IntentLink>
  );
}
