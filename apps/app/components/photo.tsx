import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { PixelRatio, Platform } from 'react-native';

import { resizedPhotoUrl } from '@repo/shared/domain';

import { API_BASE_URL } from '@/lib/api';
import { mediaUrl } from '@/lib/supabase';

/**
 * Photos come resized by the website (engineering.md §App specifics): the same resizer and quality as the website's own
 * photos, at the width they are drawn on this screen, so a 164-point card no longer downloads a 2,400-pixel original.
 * Development on a phone keeps the originals: the website only resizes photos from its own Supabase address, and the
 * phone reaches Supabase through the computer's LAN address. The web preview reads 127.0.0.1 like the website, so it
 * resizes too.
 */
const RESIZE = !__DEV__ || Platform.OS === 'web';

/** A product or region photo (`product-media`), filling its frame. `width` is the frame's width in points. */
export function Photo({
  path,
  width,
  ...props
}: { path: string; width: number } & Omit<ImageProps, 'source'>): React.JSX.Element {
  // If the resized copy can't be had (the website unreachable), the original still shows.
  const [failed, setFailed] = useState<string | null>(null);
  const original = mediaUrl(path);
  const source =
    RESIZE && failed !== path ? resizedPhotoUrl(API_BASE_URL, original, width, PixelRatio.get()) : original;
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
