import Link from 'next/link';

import { CartLink } from '@/features/cart/cart-link';
import { isInfoPath, QUICK_HOME } from '@/lib/site';

import { HeaderIcon } from './header-icons';
import { IntentLink } from './intent-link';
import { LogoText } from './logo';
import { NavLink } from './nav-link';
import { PhoneSearch } from './phone-search';
import { SearchPill } from './search-pill';
import { SiteMenu } from './site-menu';
import { StoreLinks } from './store-links';

import type { QuickNav } from '@/features/catalog/data';

const MORE = [
  { href: '/orders/lookup', label: 'Track an order' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/shipping-returns', label: 'Shipping & returns' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * Store header (D-079, D-113, D-140): Search (a pill that grows into a bar on scroll) · Clothing (Women · Men on hover
 * or focus) · Food · Home & gifts · States, then Saved, Bag and Profile as icons (About us lives in the menu and the
 * footer); below 1024 px the types move into the menu, which phones and tablets open from the menu button; on phones the
 * logo, the icons and a menu button that opens a side panel over the page. D-154: while 7-day delivery is on, the store
 * tabs sit above it (store-switch.tsx, drawn by the store layout), and inside the 7-day store the type links become its
 * categories and Search finds only 7-day pieces. Server-rendered with
 * no session reads, so pages stay static (PR-1); the bag count, the search pill, the menu and the current-section mark are the only client
 * islands. Its links read their page ahead on intent, never on sight (intent-link.tsx, launch QA C-6). Its look
 * on Home (on the photo, logo fading in on scroll) is CSS in app/globals.css. No admin link anywhere (D-006).
 */
export function SiteHeader({ quick = null }: { quick?: QuickNav }): React.JSX.Element {
  return (
    <header className="site-header">
      <a
        href="#main"
        className="font-ui bg-ink text-paper sr-only rounded-pill px-5 text-sm focus:not-sr-only focus:absolute focus:left-[var(--gut)] focus:top-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center"
      >
        Skip to content
      </a>
      <div className="site-bar font-ui">
        <IntentLink href="/" aria-label="Indian Wholesale Club, home" className="site-logo font-logo mr-auto text-[16px] font-normal leading-none tracking-normal md:text-[22px]">
          <LogoText />
        </IntentLink>
        <nav aria-label="Main" className="site-links">
          <SearchPill />
          <StoreLinks
            quick={
              <>
                <span className="site-type">
                  <NavLink href={QUICK_HOME} exact>
                    All
                  </NavLink>
                </span>
                {/* the names are long ("Rice, Flours & Staples"): two fit beside the logo below 1280 px, four above */}
                {quick?.categories.map((c, i) => (
                  <span key={c.slug} className={`site-type whitespace-nowrap ${i > 1 ? 'max-xl:hidden' : ''}`}>
                    <NavLink href={c.href}>{c.name}</NavLink>
                  </span>
                ))}
              </>
            }
          >
          {/* D-140 (S1): shopping by type from every page; no Kids at launch */}
          <div className="site-drop site-type">
            <NavLink href="/clothing">Clothing</NavLink>
            <div className="site-drop-menu">
              <IntentLink href="/clothing?for=women">Women</IntentLink>
              <IntentLink href="/clothing?for=men">Men</IntentLink>
            </div>
          </div>
          <span className="site-type">
            <NavLink href="/food">Food</NavLink>
          </span>
          {/* one line, as Clothing and Food: it broke onto two at tablet widths */}
          <span className="site-type whitespace-nowrap">
            <NavLink href="/home-and-gifts">Home &amp; gifts</NavLink>
          </span>
          <NavLink href="/states">States</NavLink>
          </StoreLinks>
        </nav>
        <div className="site-icons">
          {/* Phones: Search takes Saved's place (Saved is in the menu there, D-116). */}
          <IntentLink href="/account/saved" className="site-icon hidden md:grid" aria-label="Saved">
            <HeaderIcon name="heart" />
          </IntentLink>
          <PhoneSearch />
          <CartLink />
          <IntentLink href="/account" className="site-icon" aria-label="Profile">
            <HeaderIcon name="person" />
          </IntentLink>
          <SiteMenu>
            <form action="/search" role="search" className="site-panel-search">
              <HeaderIcon name="search" />
              <input type="search" name="q" placeholder="Search" aria-label="Search" />
            </form>
            <ul className="site-panel-big">
              <li>
                <IntentLink href="/clothing">Clothing</IntentLink>
                <span className="site-panel-sub">
                  <IntentLink href="/clothing?for=women">Women</IntentLink>
                  <IntentLink href="/clothing?for=men">Men</IntentLink>
                </span>
              </li>
              <li>
                <IntentLink href="/food">Food</IntentLink>
              </li>
              <li>
                <IntentLink href="/home-and-gifts">Home &amp; gifts</IntentLink>
              </li>
              <li>
                <IntentLink href="/states">States</IntentLink>
              </li>
              <li>
                <Link href="/about" prefetch={false}>
                  About us
                </Link>
              </li>
              <li>
                <IntentLink href="/account/saved">Saved</IntentLink>
              </li>
            </ul>
            <ul className="site-panel-small">
              {MORE.map((l) => (
                <li key={l.href}>
                  {isInfoPath(l.href) ? (
                    <Link href={l.href} prefetch={false}>
                      {l.label}
                    </Link>
                  ) : (
                    <IntentLink href={l.href}>{l.label}</IntentLink>
                  )}
                </li>
              ))}
            </ul>
          </SiteMenu>
        </div>
      </div>
    </header>
  );
}
