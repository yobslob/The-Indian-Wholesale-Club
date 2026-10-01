import Image from 'next/image';

import { mediaUrl } from '@/lib/site';

import type { RegionPage } from '@repo/db/store';

type Photo = RegionPage['album'][number];

/**
 * The tile pattern of the approved mockup (a-gallery.html v4, D-053): blocks of a mosaic four cells high, each
 * [width in cells, tiles as [column, row, columns spanned, rows spanned]].
 */
const BLOCKS: [number, [number, number, number, number][]][] = [
  [4, [[0, 0, 4, 2], [0, 2, 2, 2], [2, 2, 2, 2]]],
  [2, [[0, 0, 2, 2], [0, 2, 2, 2]]],
  [5, [[0, 0, 5, 4]]],
  [3, [[0, 0, 3, 2], [0, 2, 3, 2]]],
  [3, [[0, 0, 3, 4]]],
  [4, [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 4, 2]]],
];
const TILES_PER_PATTERN = BLOCKS.reduce((n, [, tiles]) => n + tiles.length, 0);
/** Below this the album would repeat one or two photos over and over; the page leaves it out. */
export const ALBUM_MINIMUM = 3;

function Mosaic({ photos, hidden }: { photos: Photo[]; hidden?: boolean }): React.JSX.Element {
  const patterns = Math.max(1, Math.ceil(photos.length / TILES_PER_PATTERN));
  const tiles: { photo: Photo; column: number; row: number; columns: number; rows: number }[] = [];
  let x = 0;
  for (let p = 0; p < patterns; p++) {
    for (const [width, list] of BLOCKS) {
      for (const [tx, ty, tw, th] of list) {
        tiles.push({ photo: photos[tiles.length % photos.length]!, column: x + tx + 1, row: ty + 1, columns: tw, rows: th });
      }
      x += width;
    }
  }
  return (
    <ul className="album-mosaic" aria-hidden={hidden || undefined}>
      {tiles.map((t, i) => (
        <li
          key={i}
          className="bg-land relative overflow-hidden rounded-[18px]"
          style={{ gridColumn: `${t.column} / span ${t.columns}`, gridRow: `${t.row} / span ${t.rows}` }}
        >
          <Image
            src={mediaUrl(t.photo.storage_path)}
            alt={hidden ? '' : t.photo.alt_text}
            fill
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
 */
export function RegionAlbum({ photos, regionName }: { photos: Photo[]; regionName: string }): React.JSX.Element | null {
  if (photos.length < ALBUM_MINIMUM) return null;
  const patterns = Math.max(1, Math.ceil(photos.length / TILES_PER_PATTERN));
  return (
    <section aria-label={`Photos of ${regionName}`} className="-mx-[var(--gut)] py-[clamp(24px,3vw,48px)]">
      <div className="album" data-album="on" style={{ ['--album-duration' as string]: `${110 * patterns}s` }}>
        <div className="album-track">
          <Mosaic photos={photos} />
          <Mosaic photos={photos} hidden />
        </div>
      </div>
    </section>
  );
}
