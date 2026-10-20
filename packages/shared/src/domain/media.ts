/**
 * Product, region and review photos (engineering.md PR-6). Every upload gets a new random path and is never
 * overwritten, so a photo's URL always shows the same file: browsers, CDNs and phones may keep it for a year.
 */
export const PHOTO_CACHE_CONTROL = '31536000';

/**
 * The photo store (D-140, the photo fix, 2026-10-20): photos live in Cloudflare R2, not in Supabase's storage (whose
 * free plan holds 1 GB; production had 54,600 photos, 7.9 GB). A stored photo is recorded with a path in an `s/` folder
 * (`products/<id>/s/<name>.jpg`) and exists only as two AVIF copies, `<name>.w640.avif` and `<name>.w1200.avif`,
 * under `<bucket>/` in the store (about 70 KB together; never upscaled, so a 500-pixel shop photo stays 500 pixels).
 * The original is not kept. Any other path is a photo still in Supabase's storage (just uploaded, or not yet moved),
 * shown as it is.
 */
export const COPY_WIDTHS = [640, 1200] as const;

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;
const STORED = /\/s\/[^/]+\.(jpe?g|png|webp|avif)$/i;

/** Whether a storage path or URL is a stored photo (its copies are in the photo store). */
export const hasCopies = (pathOrUrl: string): boolean => STORED.test(pathOrUrl.split('?')[0]!);

/** Whether a file is a photo that can be stored (JPEG, PNG, WebP or AVIF). */
export const canHaveCopies = (path: string): boolean => IMAGE_EXT.test(path);

/** The copy for a width in pixels: the smallest that is at least as wide, else the largest. */
export function copyFor(pathOrUrl: string, width: number): string {
  const w = COPY_WIDTHS.find((x) => x >= width) ?? COPY_WIDTHS[COPY_WIDTHS.length - 1];
  return pathOrUrl.replace(IMAGE_EXT, `.w${w}.avif`);
}

/** The path a photo is recorded with once stored: `products/p1/abc.jpg` → `products/p1/s/abc.jpg` (s/ paths stay). */
export function storedPath(path: string): string {
  if (STORED.test(path)) return path;
  // a copy made before 2026-10-20 sat in a c/ folder in Supabase's storage; it is stored like any other
  return path.replace(/\/c\/([^/]+)$/, '/$1').replace(/\/([^/]+)$/, '/s/$1');
}

/** The keys of a stored photo's copies in the photo store (each under its Supabase bucket's name). */
export function storeKeys(bucket: string, path: string): string[] {
  return COPY_WIDTHS.map((w) => `${bucket}/${copyFor(path, w)}`);
}

const encodePath = (path: string): string => path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');

/**
 * A photo's address on the site: `/media/s/<bucket>/<path>` for a stored photo (its copies, from the photo store),
 * `/media/<bucket>/<path>` for one still in Supabase's storage. next.config.js routes both; the page never names a
 * storage host. `photoUrl` and `photoSrcSet` turn a stored photo's address into its copies'.
 */
export function mediaPath(bucket: string, storagePath: string): string {
  return hasCopies(storagePath) ? `/media/s/${bucket}/${encodePath(storagePath)}` : `/media/${bucket}/${encodePath(storagePath)}`;
}

/** The URL to draw a photo `pixels` wide: its copy when it is stored, else the photo itself. */
export function photoUrl(url: string, pixels: number): string {
  return hasCopies(url) ? copyFor(url, pixels) : url;
}

/** The `srcset` of a stored photo (the browser picks a copy for the `sizes` given); empty for any other. */
export function photoSrcSet(url: string): string {
  return hasCopies(url) ? COPY_WIDTHS.map((w) => `${copyFor(url, w)} ${w}w`).join(', ') : '';
}

/**
 * The same copy as a JPEG, for the few places that can't show AVIF (an email client, an old browser): made on demand
 * by the website (app/media/jpeg) and kept by the CDN. `url` is a stored photo's address from `mediaPath`.
 */
export function photoJpegUrl(url: string, width: number): string {
  return `${copyFor(url, width).replace('/media/s/', '/media/jpeg/')}?w=${Math.min(Math.max(Math.round(width), 80), 1200)}`;
}
