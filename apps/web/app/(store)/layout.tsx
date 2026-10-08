import { isDemoStoreCached } from '@/features/catalog/data';
import { DemoBanner } from '@/features/shell/demo-banner';
import { Motion } from '@/features/shell/motion';
import { SiteFooter } from '@/features/shell/site-footer';
import { SiteHeader } from '@/features/shell/site-header';

/**
 * Storefront shell: server-rendered, no session reads (pages stay static, PR-1).
 * The @info slot draws an info page as a glass panel over the page it was opened from (D-092).
 * Client islands here: the bag count and the motion layer (Lenis, reveal, parallax; off for reduced motion). No admin link anywhere (D-006).
 * In the demo round (D-078) every page opens with the demo banner (a cached store read, so pages stay static); it rides
 * with the header in .site-top, above it and never under it (D-079).
 */
export default async function StoreLayout({
  children,
  info,
}: {
  children: React.ReactNode;
  info: React.ReactNode;
}): Promise<React.JSX.Element> {
  const demo = await isDemoStoreCached().catch(() => false);
  return (
    <>
      <div className="site-top">
        {demo ? <DemoBanner /> : null}
        <SiteHeader />
      </div>
      <main id="main" className="store-main">
        {children}
      </main>
      <SiteFooter />
      {info}
      <Motion />
    </>
  );
}
