import Link from 'next/link';

import { INFO_LINKS, SITE_NAME } from '@/lib/site';

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

const MAP_CREDIT = (
  <>
    <a href="https://github.com/datameet/maps" className="text-[#D8D0C4] underline">
      DataMeet India
    </a>
    , CC BY 4.0
  </>
);

/**
 * Store footer (D-079): Karla; four columns from tablet up, without Clothing and Spices (their pages stay); on phones one
 * small block. Carries the map's licence credit (D-052).
 */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="bg-ink font-foot mt-[clamp(24px,3vw,48px)] px-[var(--gut)] text-[#D8D0C4]">
      <div className="hidden pb-10 pt-[clamp(40px,4vw,64px)] text-sm md:block">
        <div className="grid grid-cols-4 gap-x-[var(--gap)] gap-y-8">
          <div>
            <p className="text-canvas mb-2.5 text-lg">{SITE_NAME}</p>
            {/* TODO(founder): approve the footer line (design.md voice, D-019). */}
            <p className="max-w-[30ch]">Clothing and spices from all of India, delivered in the US.</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3.5 text-xs font-medium uppercase tracking-[0.08em] text-[#A89F92]">{col.title}</h2>
              <ul className="grid gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-canvas hover:underline">
                      {link.label}
                    </Link>
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
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4">
          {MINI.map((link) => (
            <Link key={link.href} href={link.href} className="text-canvas py-2">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-2 text-[11px] text-[#A89F92]">
          © {SITE_NAME} · Map: {MAP_CREDIT}
        </p>
      </div>
    </footer>
  );
}
