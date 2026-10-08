import Link from 'next/link';

import { CartLink } from '@/features/cart/cart-link';

import { HeaderIcon } from './header-icons';
import { LogoText } from './logo';
import { NavLink } from './nav-link';
import { SearchPill } from './search-pill';
import { SiteMenu } from './site-menu';

const MORE = [
  { href: '/orders/lookup', label: 'Track an order' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/shipping-returns', label: 'Shipping & returns' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * Store header (D-079): States · Search (a pill on hover) · About us, then Saved, Bag and Profile as icons; on phones the
 * logo, the icons and a menu button that opens a side panel over the page. Server-rendered with
 * no session reads, so pages stay static (PR-1); the bag count, the search pill, the menu and the current-section mark are the only client
 * islands. Its look
 * on Home (on the photo, logo fading in on scroll) is CSS in app/globals.css. No admin link anywhere (D-006).
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
      <div className="site-bar font-ui">
        <Link href="/" className="site-logo font-logo mr-auto text-[16px] font-normal leading-none tracking-normal md:text-[22px]">
          <LogoText />
        </Link>
        <nav aria-label="Main" className="site-links">
          <NavLink href="/states">States</NavLink>
          <SearchPill />
          <NavLink href="/about">About us</NavLink>
        </nav>
        <div className="site-icons">
          <Link href="/account/saved" className="site-icon" aria-label="Saved">
            <HeaderIcon name="heart" />
          </Link>
          <CartLink />
          <Link href="/account" className="site-icon" aria-label="Profile">
            <HeaderIcon name="person" />
          </Link>
          <SiteMenu>
            <form action="/search" role="search" className="site-panel-search">
              <HeaderIcon name="search" />
              <input type="search" name="q" placeholder="Search" aria-label="Search" />
            </form>
            <ul className="site-panel-big">
              <li>
                <Link href="/states">States</Link>
              </li>
              <li>
                <Link href="/about">About us</Link>
              </li>
            </ul>
            <ul className="site-panel-small">
              {MORE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </SiteMenu>
        </div>
      </div>
    </header>
  );
}
