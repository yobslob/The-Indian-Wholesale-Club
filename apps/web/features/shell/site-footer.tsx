import Link from 'next/link';

import { INFO_LINKS, isInfoPath, SITE_NAME } from '@/lib/site';

import { IntentLink } from './intent-link';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { href: '/states', label: 'States' },
      { href: '/search', label: 'Search' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/orders/lookup', label: 'Track an order' },
      { href: '/shipping-returns', label: 'Shipping & returns' },
      { href: '/faq', label: 'FAQ' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'About',
    links: INFO_LINKS.filter((l) => ['/about', '/privacy', '/terms'].includes(l.href)),
  },
] as const;

/** On phones the footer is one small block of links and the credit line (D-079). */
const MINI = [
  { href: '/orders/lookup', label: 'Track an order' },
  { href: '/shipping-returns', label: 'Shipping & returns' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

/** On a touch screen every footer link is at least 44 x 44 px (launch QA C-7); a mouse keeps the compact look. */
const TOUCH = '[@media(pointer:coarse)]:inline-flex [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:items-center';

const MAP_CREDIT = (
  <>
    <a href="https://github.com/datameet/maps" className={`text-[#D8D0C4] underline ${TOUCH}`}>
      DataMeet India
    </a>
    , CC BY 4.0
  </>
);

/** A footer link: an info page is never read ahead (D-116), the rest on intent, not on sight (launch QA C-6). */
function FooterLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }): React.JSX.Element {
  return isInfoPath(href) ? (
    <Link href={href} prefetch={false} className={className}>
      {children}
    </Link>
  ) : (
    <IntentLink href={href} className={className}>
      {children}
    </IntentLink>
  );
}

/**
 * Store footer (D-079): Karla; four columns from tablet up, without Clothing and Food (their pages stay); on phones one
 * small block. Carries the map's licence credit (D-052).
 */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="site-footer bg-ink font-foot mt-[clamp(24px,3vw,48px)] px-[var(--gut)] text-[#D8D0C4]">
      <div className="hidden pb-10 pt-[clamp(40px,4vw,64px)] text-sm md:block">
        <div className="grid grid-cols-4 gap-x-[var(--gap)] gap-y-8">
          <div>
            <p className="text-canvas mb-2.5 text-lg">{SITE_NAME}</p>
            {/* TODO(founder): approve the footer line (storefront.md voice, D-019). */}
            <p className="max-w-[30ch]">Clothing, food and gifts from all of India, delivered in the US.</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3.5 text-xs font-medium uppercase tracking-[0.08em] text-[#A89F92]">{col.title}</h2>
              <ul className="grid gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href} className={`text-canvas hover:underline ${TOUCH}`}>
                      {link.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-[#3A332D] pt-4 text-xs text-[#A89F92]">
          <span>© {SITE_NAME}</span>
          <span>Map data: {MAP_CREDIT}</span>
        </div>
      </div>
      <div className="py-5 text-xs md:hidden">
        {/* 44 x 44 px targets (launch QA C-7): the padding keeps the words 16 px apart, as the gap did */}
        <nav aria-label="Footer" className="-mx-2 flex flex-wrap">
          {MINI.map((link) => (
            <FooterLink key={link.href} href={link.href} className="text-canvas inline-flex min-h-11 min-w-11 items-center justify-center px-2">
              {link.label}
            </FooterLink>
          ))}
        </nav>
        <p className="text-[11px] text-[#A89F92]">
          © {SITE_NAME} · Map: {MAP_CREDIT}
        </p>
      </div>
    </footer>
  );
}
