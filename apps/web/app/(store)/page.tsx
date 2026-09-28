import Link from 'next/link';

import { getHomeCached } from '@/features/catalog/data';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { RegionGrid } from '@/features/regions/region-card';

/**
 * "Where's home?" (storefront.md): all 36 regions + the next delivery window.
 * One cached store_home() call (PR-1, PR-2). The India map comes with the
 * design mockups (design.md §Visual system 4).
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const home = await getHomeCached();
  const live = home.regions.filter((r) => r.is_live);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-ink text-3xl font-semibold">Where&apos;s home?</h1>
        <p className="text-ink-muted max-w-2xl">
          {/* TODO(founder): approve the home copy (design.md voice, D-019). */}
          Pick your state and find the clothing and spices you grew up with, delivered to your door
          in the US.
        </p>
        <DeliveryNote delivery={home.delivery} />
      </section>

      {live.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-ink text-lg font-medium">Available now</h2>
          <RegionGrid regions={live} />
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-ink text-lg font-medium">All of India</h2>
          <Link href="/states" className="text-sm underline">
            A–Z list
          </Link>
        </div>
        <RegionGrid regions={home.regions} />
      </section>
    </div>
  );
}
