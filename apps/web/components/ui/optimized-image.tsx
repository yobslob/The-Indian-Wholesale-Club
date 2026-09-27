import Image, { type ImageProps } from 'next/image';

import { getShimmerDataUrl, IMAGE_SIZES_PRESETS } from '@/lib/utils/image';

interface OptimizedImageProps extends Omit<ImageProps, 'src' | 'alt'> {
  src: string | null | undefined;
  alt: string;
  preset?: keyof typeof IMAGE_SIZES_PRESETS;
  fallbackText?: string;
}

export function OptimizedImage({
  src,
  alt,
  preset = 'grid',
  sizes,
  className = '',
  priority = false,
  fallbackText = 'No image available',
  ...rest
}: OptimizedImageProps): React.JSX.Element {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-xs text-neutral-400">
        {fallbackText}
      </div>
    );
  }

  const resolvedSizes = sizes || IMAGE_SIZES_PRESETS[preset];

  return (
    <Image
      src={src}
      alt={alt}
      sizes={resolvedSizes}
      priority={priority}
      placeholder="blur"
      blurDataURL={getShimmerDataUrl(300, 400)}
      className={`object-cover ${className}`}
      {...rest}
    />
  );
}
