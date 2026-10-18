import Image from 'next/image';

import { COPY_WIDTHS, copyFor, hasCopies } from '@/lib/image-copies';

/**
 * A store photo (D-140, the photo fix). A photo with fixed copies (scripts/photo-copies.mjs) is a plain responsive
 * <img> straight from Supabase's CDN: the browser picks the copy for the `sizes` given, at no cost per view. Any
 * other image is next/image as before (Vercel's resizer). Same props as the `fill` next/image the store uses.
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
  if (!hasCopies(src)) return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed copies on the CDN: no resizer in between (D-140)
    <img
      src={copyFor(src, 640)}
      srcSet={COPY_WIDTHS.map((w) => `${copyFor(src, w)} ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
}
