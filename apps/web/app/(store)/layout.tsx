import Link from 'next/link';

import { CartLink } from '@/features/cart/cart-link';
import { INFO_LINKS, SITE_NAME } from '@/lib/site';

/**
 * Storefront shell: server-rendered, no session reads (pages stay static, PR-1).
 * The only client island here is the bag count. No admin link anywhere (D-006).
 */
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <header className="border-line border-b">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-sm">
          <Link href="/" className="text-brand mr-auto text-base font-semibold">
            {SITE_NAME}
          </Link>
          <Link href="/states" className="hover:underline">
            States
          </Link>
          <Link href="/clothing" className="hover:underline">
            Clothing
          </Link>
          <Link href="/spices" className="hover:underline">
            Spices
          </Link>
          <Link href="/search" className="hover:underline">
            Search
          </Link>
          <Link href="/account" className="hover:underline">
            Account
          </Link>
          <CartLink />
        </nav>
      </header>
      <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-line border-t">
        <div className="text-ink-muted mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm">
          {INFO_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
          <Link href="/orders/lookup" className="hover:underline">
            Track an order
          </Link>
          <span className="ml-auto">© {SITE_NAME}</span>
        </div>
      </footer>
    </>
  );
}
