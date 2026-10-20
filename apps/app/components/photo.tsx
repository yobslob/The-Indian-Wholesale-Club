import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { PixelRatio } from 'react-native';

import { hasCopies, mediaPath, photoJpegUrl, photoUrl } from '@repo/shared/domain';

import { API_BASE_URL } from '@/lib/api';
import { mediaUrl } from '@/lib/supabase';

const SITE = API_BASE_URL.replace(/\/+$/, '');

/**
 * Photos at the width they are drawn (D-140, the photo fix): a stored photo's AVIF copy (640 or 1200 pixels) for the
 * frame's width times the screen's pixel ratio, from the website's `/media/` address, so a 164-point card never
 * downloads a 2,400-pixel original. If that copy can't be shown, the same copy as a JPEG (app/media/jpeg). A photo
 * still in Supabase's storage (uploaded a moment ago) shows as it is, straight from Supabase if the website can't be
 * reached (development on a phone without it).
 */
export function Photo({
  path,
  width,
  ...props
}: { path: string; width: number } & Omit<ImageProps, 'source'>): React.JSX.Element {
  const [failed, setFailed] = useState<string | null>(null);
  const pixels = Math.ceil(width * PixelRatio.get());
  const address = `${SITE}${mediaPath('product-media', path)}`;
  const source =
    failed !== path
      ? photoUrl(address, pixels)
      : hasCopies(path)
        ? `${SITE}${photoJpegUrl(mediaPath('product-media', path), pixels)}`
        : mediaUrl(path);
  return (
    <Image
      source={source}
      onError={() => setFailed(path)}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      {...props}
    />
  );
}
