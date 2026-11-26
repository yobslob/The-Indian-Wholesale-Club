import { formatUsd } from '@repo/shared/domain';

import { getHomeCached, getStorePolicyCached } from '@/features/catalog/data';
import { CategoryTiles } from '@/features/home/category-tiles';
import { CookAtHome } from '@/features/home/cook-at-home';
import { DeliveryBand } from '@/features/home/delivery-band';
import { FirstOrderBand } from '@/features/home/first-order-band';
import { HomeHero } from '@/features/home/home-hero';
import { HomecomingDusk } from '@/features/home/homecoming-windows';
import { LazyAlbum, LazyPickHome } from '@/features/home/lazy-sections';
import { ALBUM_MINIMUM } from '@/features/regions/region-album';

import type { Metadata } from 'next';

// E-2a: the domain's address for Home (metadataBase in app/layout.tsx), so the old vercel.app copy never competes
export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * Home (D-187, the founder's order; dressed for Homecoming, D-196): the hero, Cook at home (D-204), the album of all of India (the drifting mosaic),
 * the first-order band, the category tiles, the season's dusk with the flight inside, Pick your home and the delivery band. The founder
 * took the product rows off Home on 2026-11-26 (What everyone missed this week, The kirana counter, Just listed Clothing and Home & gifts).
 * One cached store_home() call (PR-1, PR-2). Runs edge to edge (data-bleed); sections keep the gutter. Launch QA C-2: the
 * first screen, Cook at home, the season's window, the tiles, the headings and the band are server-rendered; the album and Pick your
 * home's map and stamps are drawn in the browser as they come near (features/home/lazy-sections.tsx), from data the page carries, so
 * the page stays one cached page.
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
        {/* D-204: Cook at home right under the hero, where the season's three arches were */}
        <CookAtHome recipes={home.recipes} />
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
            data-reveal=""
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
