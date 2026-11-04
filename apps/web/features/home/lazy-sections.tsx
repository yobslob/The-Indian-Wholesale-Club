'use client';

import { useNear, useNearComponent } from './use-near';

import type { HomeData, ProductCard, RegionCard, RegionProductCard } from '@repo/db/store';

/**
 * Home's parts below the first screen, drawn in the browser as they come near (launch QA C-2): the album, Pick your
 * home and the product rows. Home sent all of them as HTML and again as React's data (753 KB, 180 images, 2,614
 * elements), most of it never seen on a phone. Now the page carries only their data (photo paths, the states, the
 * cards), each part's code loads at the first scroll, and each draws half a screen before it is seen, in today's
 * layout, order and look. Until then a box of the part's height holds its place, so nothing below it moves.
 * The page stays one cached page (ISR, PR-1): no request of its own, nothing read per visit.
 */

type AlbumPhoto = HomeData['album'][number];
type StampRegion = Pick<RegionCard, 'slug' | 'name' | 'is_live' | 'accent_color' | 'hero_image_path'>;
/** A card as the rows draw it (product-row.tsx). */
export type RowCard = ProductCard & Partial<Pick<RegionProductCard, 'available' | 'quick_add'>>;
interface StripProps {
  products: RowCard[];
  label: string;
}

const loadAlbum = (): Promise<React.ComponentType<{ photos: AlbumPhoto[]; regionName: string; reveal?: boolean }>> =>
  import('@/features/regions/region-album').then((m) => m.RegionAlbum);
const loadPick = (): Promise<React.ComponentType<{ regions: RegionCard[] }>> =>
  import('@/features/regions/pick-home').then((m) => m.PickHome);
const loadStrip = (): Promise<React.ComponentType<StripProps>> =>
  import('@/features/catalog/product-row').then((m) => m.ProductStrip);
/** At the first scroll every part's code starts loading, so the album right under the photo is ready in time. */
const warm = (): void => {
  void loadAlbum();
  void loadPick();
  void loadStrip();
};

/** The album of all of India (region-album.tsx), its box exactly the album's height (globals.css `.album`). */
export function LazyAlbum({ photos }: { photos: AlbumPhoto[] }): React.JSX.Element {
  const [ref, near] = useNear<HTMLDivElement>(warm);
  const [Album, box] = useNearComponent(near, loadAlbum);
  if (Album) {
    return (
      <div ref={box}>
        <Album photos={photos} regionName="India" reveal />
      </div>
    );
  }
  return (
    <div ref={ref} aria-hidden="true" className="-mx-[var(--gut)] py-[clamp(24px,3vw,48px)]">
      <div className="album">
        <div style={{ height: 'calc(var(--cell) * 4 + var(--gap) * 3)' }} />
      </div>
    </div>
  );
}

/**
 * Pick your home (pick-home.tsx): the map and its 44 KB of outlines come with its code instead of twice in the page.
 * Its box is about the section's height: two panels side by side from 1101 px, one above the other below.
 */
export function LazyPickHome({ regions }: { regions: StampRegion[] }): React.JSX.Element {
  const [ref, near] = useNear<HTMLDivElement>(warm);
  const [Pick, box] = useNearComponent(near, loadPick);
  if (Pick) {
    return (
      <div ref={box}>
        {/* the fields PickHome reads; the greetings and taglines stay out of the page */}
        <Pick regions={regions as RegionCard[]} />
      </div>
    );
  }
  return <div ref={ref} aria-hidden="true" className="min-h-[1250px] min-[1101px]:min-h-[800px]" />;
}

/** A row of product cards (product-row.tsx ProductStrip); its box is one card high, at the row's card width. */
export function LazyStrip(props: StripProps): React.JSX.Element {
  const [ref, near] = useNear<HTMLDivElement>(warm);
  const [Strip, box] = useNearComponent(near, loadStrip);
  if (Strip) {
    return (
      <div ref={box}>
        <Strip {...props} />
      </div>
    );
  }
  return (
    <div ref={ref} aria-hidden="true" className="pb-1">
      <div className="w-[148px] sm:w-[clamp(176px,23vw,304px)]">
        <div className="aspect-[3/4]" />
        <div className="h-[86px]" />
      </div>
    </div>
  );
}
