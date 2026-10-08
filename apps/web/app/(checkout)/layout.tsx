import Link from 'next/link';

import { isDemoStoreCached } from '@/features/catalog/data';
import { DemoBanner } from '@/features/shell/demo-banner';
import { LogoText } from '@/features/shell/logo';
import { Motion } from '@/features/shell/motion';
import { TopHeight } from '@/features/shell/top-height';
import { SITE_NAME } from '@/lib/site';

/**
 * Checkout's quiet frame (D-087): the logo and "Back to bag" over the page, a one-line footer; nothing else to wander
 * off to while paying. The demo banner still rides above the header (D-078, D-079). The thank-you page
 * (/checkout/success) stays in the store layout with the full header.
 */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const demo = await isDemoStoreCached().catch(() => false);
  return (
    <>
      <div className="site-top">
        {demo ? <DemoBanner /> : null}
        <header className="site-header">
          <div className="site-bar font-ui justify-between">
            <Link href="/" className="site-logo font-logo text-[16px] font-normal leading-none tracking-normal md:text-[22px]">
              <LogoText />
            </Link>
            <Link href="/cart" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18 9 12l6-6" />
              </svg>
              Back to bag
            </Link>
          </div>
        </header>
      </div>
      <main id="main" className="store-main">
        {children}
      </main>
      <footer className="border-line font-foot text-ink-muted flex flex-wrap gap-x-4 gap-y-1 border-t px-[var(--gut)] py-[18px] text-xs">
        <span>© {SITE_NAME}</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
      </footer>
      <Motion />
      <TopHeight />
    </>
  );
}
