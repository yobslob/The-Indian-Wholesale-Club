
import { StorePhoto } from '@/features/catalog/store-photo';
import { mediaUrl } from '@/lib/site';

import { albumTiles, TILES_PER_PATTERN } from './album-tiles';

import type { RegionPage } from '@repo/db/store';

type Photo = RegionPage['album'][number];

/** Below this the album would repeat one or two photos over and over; the page leaves it out. */
export const ALBUM_MINIMUM = 3;

function Mosaic({ photos, hidden }: { photos: Photo[]; hidden?: boolean }): React.JSX.Element {
  const tiles = albumTiles(photos.length).map((t) => ({ ...t, photo: photos[t.photo]! }));
  return (
    <ul className="album-mosaic" aria-hidden={hidden || undefined}>
      {tiles.map((t, i) => (
        <li
          key={i}
          className="bg-land relative overflow-hidden rounded-[18px]"
          style={{ gridColumn: `${t.column} / span ${t.columns}`, gridRow: `${t.row} / span ${t.rows}` }}
        >
          <StorePhoto
            src={mediaUrl(t.photo.storage_path)}
            alt={hidden ? '' : t.photo.alt_text}
            sizes={`${t.columns * 110}px`}
            className="object-cover"
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The region album (D-051, D-052): the region's photos as a mosaic that drifts sideways by itself, between Most
 * wanted and Curated for you. Not interactive and no pause control (founder's decision); still for reduced
 * motion, paused off screen (features/shell/motion.tsx). Server-rendered, no client code of its own.
 * Home shows it (D-113; since D-169 the founder's own Home photos, in the admin's order) with `reveal`: it opens with the clip-and-scale reveal and floats with a
 * gentle parallax as the page scrolls (motion.tsx's [data-reveal] and [data-speed]).
 */
export function RegionAlbum({
  photos,
  regionName,
  reveal = false,
}: {
  photos: Photo[];
  regionName: string;
  reveal?: boolean;
}): React.JSX.Element | null {
  if (photos.length < ALBUM_MINIMUM) return null;
  const patterns = Math.max(1, Math.ceil(photos.length / TILES_PER_PATTERN));
  return (
    <section
      aria-label={`Photos of ${regionName}`}
      data-reveal={reveal ? '' : undefined}
      className="-mx-[var(--gut)] py-[clamp(24px,3vw,48px)]"
    >
      <div
        className="album"
        data-album="on"
        data-speed={reveal ? '0.05' : undefined}
        style={{ ['--album-duration' as string]: `${110 * patterns}s` }}
      >
        <div className="album-track">
          <Mosaic photos={photos} />
          <Mosaic photos={photos} hidden />
        </div>
      </div>
    </section>
  );
}
