/**
 * Fixed-size copies of a photo (D-140, the photo fix): a photo whose path sits in a `c/` folder
 * (`products/<id>/c/<name>.jpg`) has WebP copies beside it, `<name>.w320.webp`, `.w640.webp` and `.w1280.webp`, made
 * once by scripts/photo-copies.mjs. Serving them costs nothing per view (Supabase's CDN, a year's cache), instead of
 * Vercel's resizer, whose allowance ran out (402, 2026-10-18). Pure, so it has unit tests.
 */
export const COPY_WIDTHS = [320, 640, 1280] as const;

const COPY_PATH = /\/c\/[^/]+\.(jpe?g|png|webp|avif)$/i;

/** Whether a storage path or URL has its fixed copies. */
export const hasCopies = (pathOrUrl: string): boolean => COPY_PATH.test(pathOrUrl.split('?')[0]!);

/** The copy for a width: the smallest that is at least as wide, else the largest. */
export function copyFor(pathOrUrl: string, width: number): string {
  const w = COPY_WIDTHS.find((x) => x >= width) ?? COPY_WIDTHS[COPY_WIDTHS.length - 1];
  return pathOrUrl.replace(/\.(jpe?g|png|webp|avif)$/i, `.w${w}.webp`);
}
