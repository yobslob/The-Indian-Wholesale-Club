import Link from 'next/link';

import { INFO_LINKS, SITE_NAME } from '@/lib/site';

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      { href: '/states', label: 'States' },
      { href: '/clothing', label: 'Clothing' },
      { href: '/spices', label: 'Spices' },
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

/** Store footer: Inter only (D-050), four equal columns; carries the map's licence credit (D-052). */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="bg-ink font-foot mt-[clamp(24px,3vw,48px)] px-[var(--gut)] pb-10 pt-[clamp(40px,4vw,64px)] text-sm text-[#D8D0C4]">
      <div className="grid grid-cols-2 gap-x-[var(--gap)] gap-y-8 md:grid-cols-4">
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
        <span>
          Map data:{' '}
          <a href="https://github.com/datameet/maps" className="text-[#D8D0C4] underline">
            DataMeet India
          </a>
          , CC BY 4.0
        </span>
      </div>
    </footer>
  );
}
