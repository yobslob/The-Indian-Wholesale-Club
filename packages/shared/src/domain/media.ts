/**
 * Product and region photos (engineering.md PR-6). Every upload gets a new random path and is never overwritten, so
 * a photo's URL always shows the same file: browsers, the storage CDN and phones may keep it for a year.
 */
export const PHOTO_CACHE_CONTROL = '31536000';

/** The widths the website's image resizer serves (Next.js's default image + device sizes). */
export const RESIZER_WIDTHS = [
  16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
] as const;

/** The smallest served width that covers `pixels` (a photo is never upscaled; the largest if nothing covers it). */
export function resizerWidth(pixels: number): number {
  return RESIZER_WIDTHS.find((w) => w >= pixels) ?? RESIZER_WIDTHS[RESIZER_WIDTHS.length - 1];
}

/**
 * The URL of `sourceUrl` resized by the website (`/_next/image`, the same resizer and quality as the website's own
 * photos, so the app shares its cache) for a photo drawn `displayWidth` points wide on a screen with `pixelRatio`.
 */
export function resizedPhotoUrl(
  siteUrl: string,
  sourceUrl: string,
  displayWidth: number,
  pixelRatio: number,
): string {
  const width = resizerWidth(Math.ceil(displayWidth * pixelRatio));
  return `${siteUrl.replace(/\/+$/, '')}/_next/image?url=${encodeURIComponent(sourceUrl)}&w=${width}&q=75`;
}
