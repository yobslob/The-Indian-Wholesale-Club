import { PAGE } from '@/features/catalog/browse-query';
import { getHomeCached, getStorePolicyCached, quickPageCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { DeliveryBand } from '@/features/home/delivery-band';
import { HomeHero } from '@/features/home/home-hero';
import { JustListed } from '@/features/home/just-listed';
import { PickHome } from '@/features/regions/pick-home';
import { RegionAlbum } from '@/features/regions/region-album';
import { QUICK_HOME } from '@/lib/site';

/**
 * Home (storefront.md, storefront.md §Direction, D-050 – D-055, D-113): the photo hero, the album of all of India (the
 * region pages' drifting mosaic), Pick your home, then Just listed (a row per type with its See all, D-062, D-140).
 * One cached store_home() call (PR-1, PR-2). Runs edge to edge (data-bleed); sections keep the gutter. D-154: while the
 * 7-day store is open, one row "Arrives in 7 days" before Just listed (the 7-day page's cached first page, refreshed
 * with Home when listings change).
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const [home, policy] = await Promise.all([getHomeCached(), getStorePolicyCached()]);
  const quickDays = policy.quick_delivery_on ? policy.quick_delivery_days_max : null;
  const quick = quickDays ? await quickPageCached(null, 0, PAGE).catch(() => null) : null;

  return (
    <div data-bleed>
      {/* D-148: the hero's line opens the 7-day page while 7-day delivery is on (its days from Settings) */}
      <HomeHero quickDays={quickDays} />

      <div className="px-[var(--gut)]">
        <RegionAlbum photos={home.album} regionName="India" reveal />
      </div>

      <section id="pick" aria-labelledby="pick-home" className="px-[var(--gut)] py-[clamp(28px,3.4vw,56px)]">
        <div className="mb-[clamp(18px,2vw,28px)]">
          <h2 id="pick-home" className="font-heading text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]">
            Pick your home
          </h2>
          <p className="text-ink-muted mt-1.5 text-sm">
            All 28 states and 8 union territories. Find yours on the map or by name.
          </p>
        </div>
        <PickHome regions={home.regions} delivery={home.delivery} />
      </section>

      <div className="px-[var(--gut)]">
        {quick && quickDays ? (
          <ProductRow
            id="arrives-in-7-days"
            title={`Arrives in ${quickDays} days`}
            // the row says it once, not each card (as on the 7-day page)
            products={quick.products.slice(0, 12).map((p) => ({ ...p, quick_days: null }))}
            href={QUICK_HOME}
          />
        ) : null}
        <JustListed home={home} />
        <DeliveryBand delivery={home.delivery} band={home.band} />
      </div>
    </div>
  );
}
