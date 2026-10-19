import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { PixelRatio } from 'react-native';

import { photoUrl } from '@repo/shared/domain';

import { API_BASE_URL } from '@/lib/api';
import { mediaUrl } from '@/lib/supabase';

/**
 * Photos at the width they are drawn (D-140, the photo fix): a photo's fixed copy for the frame's width times the
 * screen's pixel ratio, from the website's `/media/` address (Vercel's CDN keeps it a year; next.config.js), so a
 * 164-point card never downloads a 2,400-pixel original and no resizer is in between. A photo without copies yet
 * (uploaded a moment ago) shows as it is. If the website can't be reached (development on a phone without it), the
 * photo comes straight from Supabase.
 */
export function Photo({
  path,
  width,
  ...props
}: { path: string; width: number } & Omit<ImageProps, 'source'>): React.JSX.Element {
  const [failed, setFailed] = useState<string | null>(null);
  const original = mediaUrl(path);
  const viaSite = original.replace(/^.*\/storage\/v1\/object\/public\//, `${API_BASE_URL.replace(/\/+$/, '')}/media/`);
  const source = failed !== path ? photoUrl(viaSite, Math.ceil(width * PixelRatio.get())) : original;
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
