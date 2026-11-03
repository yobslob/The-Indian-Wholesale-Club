import { formatUsd } from '@repo/shared/domain';

import { PAGE } from '@/features/catalog/browse-query';
import { getHomeCached, getStorePolicyCached, quickPageCached } from '@/features/catalog/data';
import { DeliveryBand } from '@/features/home/delivery-band';
import { DiwaliWindows } from '@/features/home/diwali-windows';
import { HomeHero } from '@/features/home/home-hero';
import { HomeRow } from '@/features/home/home-row';
import { JustListed } from '@/features/home/just-listed';
import { LazyAlbum, LazyPickHome } from '@/features/home/lazy-sections';
import { ALBUM_MINIMUM } from '@/features/regions/region-album';
import { VisualSlot } from '@/features/visuals/visual-slot';
import { QUICK_HOME } from '@/lib/site';

/**
 * Home (storefront.md, storefront.md §Direction, D-050 – D-055, D-113): the photo hero, the album of all of India (the
 * region pages' drifting mosaic), the Diwali windows with the flight inside (D-174), Pick your home, the founder's wide picture (slots.ts), then Just listed (a row per type with its See all, D-062, D-140).
 * One cached store_home() call (PR-1, PR-2). Runs edge to edge (data-bleed); sections keep the gutter. D-154: while the
 * 7-day store is open, one row "Arrives in 7 days" before Just listed (the 7-day page's cached first page, refreshed
 * with Home when listings change). Launch QA C-2: the first screen, the Diwali windows, the headings and the band are
 * server-rendered; the album, Pick your home's map and stamps and every row's cards are drawn in the browser as they
 * come near (features/home/lazy-sections.tsx), from data the page carries, so the page stays one cached page.
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const [home, policy] = await Promise.all([getHomeCached(), getStorePolicyCached()]);
  const quickDays = policy.quick_delivery_on ? policy.quick_delivery_days_max : null;
  const quick = quickDays ? await quickPageCached(null, 0, PAGE).catch(() => null) : null;

  return (
    <div data-bleed>
      <HomeHero />

      <div className="px-[var(--gut)]">
        {home.album.length >= ALBUM_MINIMUM ? <LazyAlbum photos={home.album} /> : null}
        {/* D-174: the Diwali windows, the plane from India flying inside the wide one */}
        <DiwaliWindows
          free={home.band?.free_min_cents ? `Free delivery from ${formatUsd(home.band.free_min_cents)}` : null}
        />
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
        <LazyPickHome
          // only what the map and stamps read: the greetings and taglines stay out of the page
          regions={home.regions.map(({ slug, name, is_live, accent_color, hero_image_path }) => ({
            slug,
            name,
            is_live,
            accent_color,
            hero_image_path,
          }))}
          delivery={home.delivery}
        />
      </section>

      <div className="px-[var(--gut)]">
        <VisualSlot id="home-poster" />
      </div>

      <div className="px-[var(--gut)]">
        {quick && quickDays ? (
          <HomeRow
            id="arrives-in-7-days"
            title={`Arrives in ${quickDays} days`}
            // the row says it once, not each card (as on the 7-day page)
            products={quick.products.slice(0, 12)}
            quickTag={false}
            href={QUICK_HOME}
          />
        ) : null}
        <JustListed home={home} />
        <DeliveryBand delivery={home.delivery} band={home.band} policy={policy} />
      </div>
    </div>
  );
}
