import Link from 'next/link';

import { PRODUCT_TYPE_PATH } from '@repo/shared/domain';

import { sectionHeading } from '@/features/catalog/product-row';
import { StorePhoto } from '@/features/catalog/store-photo';
import { mediaUrl } from '@/lib/site';

import { TILE_PHOTOS } from './tile-photos';

import type { HomeData } from '@repo/db/store';

/**
 * D-187: Home's category tiles, biggest first, each with its photo and its count: the founder's own (tile-photos.ts),
 * else the photo of its newest piece. A tile opens that category's See all page (/food?category=sweets). From
 * store_home(), so no read of its own. Server-drawn.
 */
export function CategoryTiles({ categories }: { categories: HomeData['categories'] }): React.JSX.Element | null {
  if (categories.length < 2) return null;
  return (
    <section id="categories" aria-labelledby="categories-h" className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
      <h2 id="categories-h" className={`${sectionHeading} mb-[clamp(16px,1.8vw,24px)]`} data-reveal="">
        Shop by category
      </h2>
      <ul className="m-0 grid list-none grid-cols-3 gap-[var(--gap)] p-0 sm:grid-cols-4 lg:grid-cols-6">
        {categories.map((c) => {
          const photo = TILE_PHOTOS[c.slug] ?? (c.image_path ? mediaUrl(c.image_path) : null);
          return (
            <li key={c.slug}>
              <Link href={`${PRODUCT_TYPE_PATH[c.product_type]}?category=${c.slug}`} prefetch={false} className="group block">
                {/* founder 2026-10-31: no shelf under the tiles */}
                <span className="bg-land relative block aspect-square overflow-hidden rounded-lg">
                  {photo ? (
                    <StorePhoto
                      src={photo}
                      alt=""
                      sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : null}
                </span>
                <span className="font-ui text-ink mt-2 block text-sm font-semibold leading-tight">{c.name}</span>
                <span className="text-ink-muted font-ui block text-xs">
                  {c.count} {c.count === 1 ? 'piece' : 'pieces'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
