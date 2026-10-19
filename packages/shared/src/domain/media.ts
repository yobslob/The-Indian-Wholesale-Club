/**
 * Product, region and review photos (engineering.md PR-6). Every upload gets a new random path and is never
 * overwritten, so a photo's URL always shows the same file: browsers, the storage CDN and phones may keep it for a year.
 */
export const PHOTO_CACHE_CONTROL = '31536000';

/**
 * Fixed-size copies (D-140, the photo fix): a photo whose path sits in a `c/` folder (`products/<id>/c/<name>.jpg`) has
 * WebP copies beside it, `<name>.w320.webp`, `.w640.webp` and `.w1280.webp`, written when it is uploaded (or by
 * `pnpm photos:copies` for older photos). They come straight from Supabase's CDN at no cost per view: no resizer in
 * between (Vercel's allowed 5,000 a month and then answered 402, 2026-10-18). Never upscaled, so a 1080-pixel shop
 * photo's largest copy is 1080 pixels: as sharp as its source.
 */
export const COPY_WIDTHS = [320, 640, 1280] as const;

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;
const COPY_PATH = /\/c\/[^/]+\.(jpe?g|png|webp|avif)$/i;

/** Whether a storage path or URL has its fixed copies. */
export const hasCopies = (pathOrUrl: string): boolean => COPY_PATH.test(pathOrUrl.split('?')[0]!);

/** The copy for a width in pixels: the smallest that is at least as wide, else the largest. */
export function copyFor(pathOrUrl: string, width: number): string {
  const w = COPY_WIDTHS.find((x) => x >= width) ?? COPY_WIDTHS[COPY_WIDTHS.length - 1];
  return pathOrUrl.replace(IMAGE_EXT, `.w${w}.webp`);
}

/** The path a photo gets once it has copies: `products/p1/abc.jpg` → `products/p1/c/abc.jpg` (c/ paths stay). */
export function copiesPath(path: string): string {
  return COPY_PATH.test(path) ? path : path.replace(/\/([^/]+)$/, '/c/$1');
}

/** Whether a stored file is a photo that can have copies (JPEG, PNG, WebP or AVIF). */
export const canHaveCopies = (path: string): boolean => IMAGE_EXT.test(path);

/**
 * The URL to draw a photo `pixels` wide: its copy when it has them, else the photo itself (a photo uploaded a moment
 * ago, before its copies; never the resizer, so a view never costs anything).
 */
export function photoUrl(url: string, pixels: number): string {
  return hasCopies(url) ? copyFor(url, pixels) : url;
}

/** The `srcset` of a photo with copies (the browser picks one for the `sizes` given); empty without copies. */
export function photoSrcSet(url: string): string {
  return hasCopies(url) ? COPY_WIDTHS.map((w) => `${copyFor(url, w)} ${w}w`).join(', ') : '';
}

/**
 * Every file a stored photo may have, to remove them together: the photo, its copies, and the file it was copied from
 * when it got them later (removing a file that isn't there is fine).
 */
export function photoFiles(path: string): string[] {
  if (!hasCopies(path)) return [path];
  return [path, ...COPY_WIDTHS.map((w) => copyFor(path, w)), path.replace(/\/c\/([^/]+)$/, '/$1')];
}
