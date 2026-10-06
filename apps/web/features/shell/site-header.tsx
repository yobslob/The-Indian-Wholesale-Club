import Link from 'next/link';

import { CartLink } from '@/features/cart/cart-link';

import { LogoText } from './logo';

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
      <a
        href="#main"
        className="font-ui bg-ink text-paper sr-only rounded-pill px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:left-[var(--gut)] focus:top-3 focus:z-50"
      >
        Skip to content
      </a>
      <nav
        aria-label="Main"
        className="font-ui flex flex-wrap items-center gap-x-[clamp(14px,2.2vw,32px)] gap-y-1 px-[var(--gut)] py-4 text-[13px] font-medium tracking-[0.03em]"
      >
        <Link
          href="/"
          className="site-logo font-display mr-auto py-2 text-[22px] font-normal leading-none tracking-normal"
        >
          <LogoText />
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
