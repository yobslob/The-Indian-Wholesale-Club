import { isDemoStoreCached } from '@/features/catalog/data';
import { DemoBanner } from '@/features/shell/demo-banner';
import { ErrorMessage } from '@/features/shell/error-message';
import { SiteFooter } from '@/features/shell/site-footer';
import { SiteHeader } from '@/features/shell/site-header';

/**
 * 404 with the normal header and footer (D-093). Every unknown address lands here, outside the store layout, so it
 * draws the shell itself. Also what non-admins get for anything under /admin: the same page as any other 404 (D-006).
 */
export default async function NotFound(): Promise<React.JSX.Element> {
  const demo = await isDemoStoreCached().catch(() => false);
  return (
    <>
      <div className="site-top">
        {demo ? <DemoBanner /> : null}
        <SiteHeader />
      </div>
      <main id="main" className="store-main">
        <ErrorMessage kind="not-found" />
      </main>
      <SiteFooter />
    </>
  );
}
