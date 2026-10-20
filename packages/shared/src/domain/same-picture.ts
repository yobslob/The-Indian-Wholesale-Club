/**
 * The same picture saved twice in one listing (D-142): Amazon's page lists each photo at full size and as a 500-pixel
 * preview under another name, and the capture took both until 2026-10-20 (a third of production's listing photos).
 * Different files, so a byte hash misses them; a perceptual hash (dHash) mixes them up with a jar's front and back.
 * The test that separated all of them on 268 production photos (pairs at 28.9 dB and up, different photos at 25.3 and
 * below): the same shape, and nearly the same pixels once both are 256 × 256 and softened (PSNR at least 27 dB).
 * The print is made with sharp where the bytes are (lib/photo-copies.ts, the runner, scripts/photo-move.mjs):
 *   sharp(bytes).rotate().flatten({ background: '#fff' }).resize(256, 256, { fit: 'fill' }).blur(1.5).removeAlpha().raw()
 */
export interface PhotoPrint {
  /** The photo's own size in pixels. */
  width: number;
  height: number;
  /** 256 × 256 RGB, softened: PRINT_SIZE and PRINT_BLUR. */
  pixels: Uint8Array;
}

export const PRINT_SIZE = 256;
export const PRINT_BLUR = 1.5;
const MIN_PSNR = 27;

/** Whether two photos are one picture (at any two sizes). */
export function samePicture(a: PhotoPrint, b: PhotoPrint): boolean {
  if (Math.abs(a.width / a.height - b.width / b.height) > 0.02) return false;
  if (a.pixels.length !== b.pixels.length || !a.pixels.length) return false;
  let squares = 0;
  for (let i = 0; i < a.pixels.length; i++) squares += (a.pixels[i]! - b.pixels[i]!) ** 2;
  const mse = squares / a.pixels.length;
  return mse === 0 || 10 * Math.log10((255 * 255) / mse) >= MIN_PSNR;
}

/**
 * A listing's photos in groups of one picture, in order of first appearance (each group's indices ascending). Photos
 * with different keys (a variant's own photo) are never grouped; one without a print stands alone.
 */
export function pictureGroups(prints: (PhotoPrint | null)[], keys: (string | null)[] = []): number[][] {
  const groups: number[][] = [];
  prints.forEach((print, i) => {
    const group = print
      ? groups.find((g) => (keys[g[0]!] ?? null) === (keys[i] ?? null) && prints[g[0]!] && samePicture(prints[g[0]!]!, print))
      : undefined;
    if (group) group.push(i);
    else groups.push([i]);
  });
  return groups;
}

/** The group's photo to keep: the most pixels (the full-size one), the earliest on a tie. */
export function sharpest(group: number[], prints: (PhotoPrint | null)[]): number {
  const pixels = (i: number): number => (prints[i] ? prints[i]!.width * prints[i]!.height : 0);
  return group.reduce((best, i) => (pixels(i) > pixels(best) ? i : best), group[0]!);
}
