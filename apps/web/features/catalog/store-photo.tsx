import { hasCopies, photoJpegUrl, photoSrcSet } from '@repo/shared/domain';

/**
 * A photo in its frame (D-140, the photo fix), on the store and in the admin panel. A stored photo is its AVIF copies
 * from the photo store (packages/shared media.ts): the browser picks 640 or 1200 pixels for the `sizes` given, and a
 * browser without AVIF gets the same copy as a JPEG (app/media/jpeg). A photo still in Supabase's storage (uploaded a
 * moment ago) shows as it is. No resizer runs per view. Fills its positioned frame, like the `fill` next/image it
 * replaced.
 */
export function StorePhoto({
  src,
  alt,
  sizes,
  className = '',
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}): React.JSX.Element {
  const img = (url: string): React.JSX.Element => (
    // eslint-disable-next-line @next/next/no-img-element -- fixed copies on the CDN: no resizer in between (D-140)
    <img
      src={url}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
  if (!hasCopies(src)) return img(src);
  return (
    <picture>
      <source type="image/avif" srcSet={photoSrcSet(src)} sizes={sizes} />
      {img(photoJpegUrl(src, 640))}
    </picture>
  );
}
