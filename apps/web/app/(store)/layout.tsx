import { FreeDeliveryBar } from '@/features/cart/free-delivery-bar';
import { getStorePolicyCached, isDemoStoreCached } from '@/features/catalog/data';
import { deliveryDaysLabel } from '@/features/catalog/delivery-days';
import { DaysProvider, type ShellDays } from '@/features/shell/days';
import { DemoBanner } from '@/features/shell/demo-banner';
import { IndiaSymbol } from '@/features/shell/india-mark';
import { Motion } from '@/features/shell/motion';
import { SiteFooter } from '@/features/shell/site-footer';
import { SiteHeader } from '@/features/shell/site-header';
import { TopHeight } from '@/features/shell/top-height';

/**
 * Storefront shell: server-rendered, no session reads (pages stay static, PR-1).
 * The @info slot draws an info page as a glass panel over the page it was opened from (D-092).
 * Client islands here: the bag count, the free-delivery bar (D-111), the motion layer (reveal, parallax; off for reduced
 * motion) and the header height for rows pinned under it (top-height.tsx). D-187: the delivery days and the free line
 * for the client parts (days.tsx), and the days as CSS variables for every card's delivery line, so a cached card carries
 * no words of its own (`.product-card-days`, globals.css). No admin link anywhere (D-006).
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
  const [demo, policy] = await Promise.all([
    isDemoStoreCached().catch(() => false),
    getStorePolicyCached().catch(() => null),
  ]);
  const days: ShellDays = {
    food:
      policy?.food_delivery_days_min != null && policy.food_delivery_days_max != null
        ? { min: policy.food_delivery_days_min, max: policy.food_delivery_days_max }
        : null,
    standard:
      policy?.delivery_days_min != null && policy.delivery_days_max != null
        ? { min: policy.delivery_days_min, max: policy.delivery_days_max }
        : null,
    freeMinCents: policy?.free_shipping_min_cents ?? null,
  };
  // only digits and fixed words (delivery-days.ts): safe to write into the style as it is
  const cardDays = `:root{--days-food:"${deliveryDaysLabel(days.food?.min, days.food?.max) ?? ''}";--days-standard:"${deliveryDaysLabel(days.standard?.min, days.standard?.max) ?? ''}"}`;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cardDays }} />
      <DaysProvider value={days} />
      <div className="site-top">
        {demo ? <DemoBanner /> : null}
        <SiteHeader />
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
