import Link from 'next/link';

import { CartLink } from '@/features/cart/cart-link';
import { SITE_NAME } from '@/lib/site';

const NAV = [
  { href: '/states', label: 'States' },
  { href: '/clothing', label: 'Clothing' },
  { href: '/spices', label: 'Spices' },
  { href: '/search', label: 'Search' },
  { href: '/account', label: 'Account' },
] as const;

/**
 * Store header: server-rendered, no session reads (pages stay static, PR-1). Its look on Home (on the
 * photo, logo fading in on scroll) is pure CSS in app/globals.css. No admin link anywhere (D-006).
 */
export function SiteHeader(): React.JSX.Element {
  return (
    <header className="site-header">
      <nav
        aria-label="Main"
        className="font-ui flex flex-wrap items-center gap-x-[clamp(14px,2.2vw,32px)] gap-y-1 px-[var(--gut)] py-4 text-[13px] font-medium tracking-[0.03em]"
      >
        <Link
          href="/"
          className="site-logo font-display mr-auto py-2 text-[22px] font-normal leading-none tracking-normal"
        >
          {SITE_NAME}
        </Link>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="py-3 hover:underline hover:underline-offset-4">
            {item.label}
          </Link>
        ))}
        <span className="py-3">
          <CartLink />
        </span>
      </nav>
    </header>
  );
}
