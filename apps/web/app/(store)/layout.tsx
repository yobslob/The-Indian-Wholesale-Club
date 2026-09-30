import { SiteFooter } from '@/features/shell/site-footer';
import { SiteHeader } from '@/features/shell/site-header';

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
      <SiteHeader />
      <main id="main" className="store-main">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
