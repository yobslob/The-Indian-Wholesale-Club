/**
 * The tile pattern of the approved mockup (a-gallery.html v4, D-053): blocks of a mosaic four cells high, each
 * [width in cells, tiles as [column, row, columns spanned, rows spanned]]. Shared by the album (region-album.tsx) and
 * the admin's Home photos page, which shows the founder where each photo will sit (D-169).
 */
const BLOCKS: [number, [number, number, number, number][]][] = [
  [4, [[0, 0, 4, 2], [0, 2, 2, 2], [2, 2, 2, 2]]],
  [2, [[0, 0, 2, 2], [0, 2, 2, 2]]],
  [5, [[0, 0, 5, 4]]],
  [3, [[0, 0, 3, 2], [0, 2, 3, 2]]],
  [3, [[0, 0, 3, 4]]],
  [4, [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 4, 2]]],
];
export const TILES_PER_PATTERN = BLOCKS.reduce((n, [, tiles]) => n + tiles.length, 0);

export interface AlbumTile {
  /** Which photo fills it (photos repeat when there are fewer than the tiles). */
  photo: number;
  column: number;
  row: number;
  columns: number;
  rows: number;
}

/** The tiles for `count` photos: whole patterns, the photos in order, again from the first when they run out. */
export function albumTiles(count: number): AlbumTile[] {
  const patterns = Math.max(1, Math.ceil(count / TILES_PER_PATTERN));
  const tiles: AlbumTile[] = [];
  let x = 0;
  for (let p = 0; p < patterns; p++) {
    for (const [width, list] of BLOCKS) {
      for (const [tx, ty, tw, th] of list) {
        tiles.push({ photo: tiles.length % Math.max(count, 1), column: x + tx + 1, row: ty + 1, columns: tw, rows: th });
      }
      x += width;
    }
  }
  return tiles;
}
