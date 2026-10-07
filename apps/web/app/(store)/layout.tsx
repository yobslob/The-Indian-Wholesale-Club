import { isDemoStoreCached } from '@/features/catalog/data';
import { DemoBanner } from '@/features/shell/demo-banner';
import { Motion } from '@/features/shell/motion';
import { SiteFooter } from '@/features/shell/site-footer';
import { SiteHeader } from '@/features/shell/site-header';

/**
 * Storefront shell: server-rendered, no session reads (pages stay static, PR-1).
 * Client islands here: the bag count and the motion layer (Lenis, reveal, parallax; off for reduced motion). No admin link anywhere (D-006).
 * In the demo round (D-078) every page opens with the demo banner (a cached store read, so pages stay static).
 */
export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const demo = await isDemoStoreCached().catch(() => false);
  return (
    <>
      {demo ? <DemoBanner /> : null}
      <SiteHeader />
      <main id="main" className="store-main">
        {children}
      </main>
      <SiteFooter />
      <Motion />
    </>
  );
}
