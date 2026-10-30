import Link from 'next/link';

import { StorePhoto } from '@/features/catalog/store-photo';
import { mediaUrl } from '@/lib/site';

import type { QuickCategory } from './links';
import type { QuickFront } from '@repo/db/store';

type Tile = NonNullable<QuickFront>['categories'][number] & QuickCategory;

/**
 * D-154: the 7-day store's category tiles, biggest first, standing on a shop's shelf (founder 2026-10-30: visual), each with the photo of its newest piece and its count. A tile
 * opens that category's See all page in the 7-day store (/7-day-delivery/food?category=sweets), with the filters.
 */
export function QuickTiles({ categories }: { categories: Tile[] }): React.JSX.Element | null {
  if (categories.length < 2) return null;
  return (
    <nav aria-label="Categories in the 7-day store">
      <ul className="m-0 grid list-none grid-cols-3 gap-[var(--gap)] p-0 sm:grid-cols-4 lg:grid-cols-6">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={c.href} className="group block">
              {/* founder 2026-10-30: the tiles stand on a kirana shelf (.shelf-tile) */}
              <span className="shelf-tile block">
                <span className="bg-land relative block aspect-square overflow-hidden rounded-t-lg">
                  {c.image_path ? (
                    <StorePhoto
                      src={mediaUrl(c.image_path)}
                      alt=""
                      sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : null}
                </span>
              </span>
              <span className="font-ui text-ink mt-2 block text-sm font-semibold leading-tight">{c.name}</span>
              <span className="text-ink-muted font-ui block text-xs">
                {c.count} {c.count === 1 ? 'piece' : 'pieces'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
