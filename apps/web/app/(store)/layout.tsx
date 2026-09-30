import { Motion } from '@/features/shell/motion';
import { SiteFooter } from '@/features/shell/site-footer';
import { SiteHeader } from '@/features/shell/site-header';

/**
 * Storefront shell: server-rendered, no session reads (pages stay static, PR-1).
 * Client islands here: the bag count and the motion layer (Lenis, reveal, parallax; off for reduced motion). No admin link anywhere (D-006).
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
      <Motion />
    </>
  );
}
