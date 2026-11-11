import { formatUsd } from '@repo/shared/domain';

import { getHomeCached, getStorePolicyCached } from '@/features/catalog/data';
import { CategoryTiles } from '@/features/home/category-tiles';
import { DeliveryBand } from '@/features/home/delivery-band';
import { FirstOrderBand } from '@/features/home/first-order-band';
import { HomeHero } from '@/features/home/home-hero';
import { HomeRow } from '@/features/home/home-row';
import { HomecomingArches, HomecomingDusk } from '@/features/home/homecoming-windows';
import { JustListed } from '@/features/home/just-listed';
import { LazyAlbum, LazyPickHome } from '@/features/home/lazy-sections';
import { ALBUM_MINIMUM } from '@/features/regions/region-album';

import type { Metadata } from 'next';

// E-2a: the domain's address for Home (metadataBase in app/layout.tsx), so the old vercel.app copy never competes
export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * Home (D-187, the founder's order; dressed for Homecoming, D-196): the hero, the season's three arches, the album of all of India (the drifting mosaic),
 * the first-order band, the category tiles, the season's dusk with the flight inside, What everyone missed this week, The kirana counter, Just
 * listed Clothing and Home & gifts, Pick your home and the delivery band.
 * One cached store_home() call (PR-1, PR-2). Runs edge to edge (data-bleed); sections keep the gutter. Launch QA C-2: the
 * first screen, the season's windows, the tiles, the headings and the band are server-rendered; the album, Pick your home's
 * map and stamps and every row's cards are drawn in the browser as they come near (features/home/lazy-sections.tsx), from
 * data the page carries, so the page stays one cached page.
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const [home, policy] = await Promise.all([getHomeCached(), getStorePolicyCached()]);

  return (
    <div data-bleed>
      <HomeHero
        foodDays={{ min: policy.food_delivery_days_min, max: policy.food_delivery_days_max }}
        storeDays={{ min: policy.delivery_days_min, max: policy.delivery_days_max }}
        freeCents={policy.free_shipping_min_cents}
      />

      <div className="px-[var(--gut)]">
        {/* D-179: the season's three arches right under the hero, a price on the first screens */}
        <HomecomingArches />
        {home.album.length >= ALBUM_MINIMUM ? <LazyAlbum photos={home.album} /> : null}
        <FirstOrderBand />
        <CategoryTiles categories={home.categories} />
        <HomecomingDusk
          free={
            home.band?.free_min_cents
              ? `Free delivery from ${formatUsd(home.band.free_min_cents)}`
              : null
          }
        />
        <HomeRow id="most-ordered" title="What everyone missed this week" products={home.most_ordered} />
        {/* D-161: the small treats that top a bag up to the line */}
        <HomeRow id="under-5" title="The kirana counter" sub="Under $5" products={home.under_5} />
        <JustListed home={home} />
      </div>

      <section
        id="pick"
        aria-labelledby="pick-home"
        className="px-[var(--gut)] py-[clamp(28px,3.4vw,56px)]"
      >
        <div className="mb-[clamp(18px,2vw,28px)]">
          <h2
            id="pick-home"
            className="font-heading text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]"
          >
            Pick your home
          </h2>
          <p className="text-ink-muted mt-1.5 text-sm">
            All 28 states and 8 union territories. Find yours on the map or by name.
          </p>
        </div>
        <LazyPickHome
          // only what the map and stamps read: the greetings and taglines stay out of the page
          regions={home.regions.map(({ slug, name, is_live, accent_color, hero_image_path }) => ({
            slug,
            name,
            is_live,
            accent_color,
            hero_image_path,
          }))}
        />
      </section>

      <div className="px-[var(--gut)]">
        <DeliveryBand band={home.band} policy={policy} />
      </div>
    </div>
  );
}
