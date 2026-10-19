import { photoSrcSet, photoUrl } from '@repo/shared/domain';

/**
 * A photo in its frame (D-140, the photo fix), on the store and in the admin panel. A photo with fixed copies
 * (packages/shared media.ts) is a responsive <img> straight from Supabase's CDN: the browser picks the copy for the
 * `sizes` given. A photo without them yet (uploaded a moment ago) shows as it is. Nothing goes through a resizer, so
 * a view never costs anything and never runs out. Fills its positioned frame, like the `fill` next/image it replaced.
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
  const srcSet = photoSrcSet(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed copies on the CDN: no resizer in between (D-140)
    <img
      src={photoUrl(src, 640)}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
}
