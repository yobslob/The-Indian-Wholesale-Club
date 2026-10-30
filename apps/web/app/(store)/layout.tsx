import { FreeDeliveryBar } from '@/features/cart/free-delivery-bar';
import { getQuickNavCached, getStorePolicyCached, isDemoStoreCached } from '@/features/catalog/data';
import { DaysProvider, type ShellDays } from '@/features/shell/days';
import { DemoBanner } from '@/features/shell/demo-banner';
import { IndiaMark, IndiaSymbol } from '@/features/shell/india-mark';
import { Motion } from '@/features/shell/motion';
import { SiteFooter } from '@/features/shell/site-footer';
import { SiteHeader } from '@/features/shell/site-header';
import { StoreSwitch } from '@/features/shell/store-switch';
import { TopHeight } from '@/features/shell/top-height';

/**
 * Storefront shell: server-rendered, no session reads (pages stay static, PR-1).
 * The @info slot draws an info page as a glass panel over the page it was opened from (D-092).
 * Client islands here: the bag count, the free-delivery bar (D-111), the motion layer (Lenis, reveal, parallax; off for reduced motion) and the
 * header height for rows pinned under it (top-height.tsx). D-161: the days
 * every date counts from, for the client parts (days.tsx). No admin link anywhere (D-006).
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
  // D-154: the store switch's days and the 7-day store's categories (null while 7-day delivery is off or paused)
  const [demo, quick, policy] = await Promise.all([
    isDemoStoreCached().catch(() => false),
    getQuickNavCached().catch(() => null),
    getStorePolicyCached().catch(() => null),
  ]);
  // D-161: the days the pages' dates count from (the dates themselves are worked out in the browser, days.tsx), and the
  // free-delivery lines the bag's pill starts from
  const days: ShellDays = {
    quick: quick ? { min: quick.daysMin, max: quick.daysMax } : null,
    standard:
      policy?.delivery_days_min != null && policy.delivery_days_max != null
        ? { min: policy.delivery_days_min, max: policy.delivery_days_max }
        : null,
    lines: {
      freeMinCents: policy?.free_shipping_min_cents ?? null,
      quickMinCents: quick ? (policy?.quick_delivery_min_cents ?? null) : null,
    },
  };
  return (
    <>
      <DaysProvider value={days} />
      <div className="site-top">
        {/* first in .site-top: it scrolls away and the header stays (globals.css, --strip-h) */}
        {quick ? <StoreSwitch mark={<IndiaMark />} /> : null}
        {demo ? <DemoBanner /> : null}
        <SiteHeader quick={quick} />
      </div>
      <main id="main" className="store-main">
        {children}
      </main>
      <SiteFooter />
      {info}
      <FreeDeliveryBar />
      <Motion />
      <TopHeight />
      <IndiaSymbol />
    </>
  );
}
