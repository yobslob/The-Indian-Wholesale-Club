import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { RegionPage } from '@repo/db/store';

import { mediaUrl } from '@/lib/supabase';

type Photo = RegionPage['album'][number];

/** The mockup's tile pattern, as on the website (apps/web/features/regions/region-album.tsx). */
const BLOCKS: [number, [number, number, number, number][]][] = [
  [4, [[0, 0, 4, 2], [0, 2, 2, 2], [2, 2, 2, 2]]],
  [2, [[0, 0, 2, 2], [0, 2, 2, 2]]],
  [5, [[0, 0, 5, 4]]],
  [3, [[0, 0, 3, 2], [0, 2, 3, 2]]],
  [3, [[0, 0, 3, 4]]],
  [4, [[0, 0, 2, 2], [2, 0, 2, 2], [0, 2, 4, 2]]],
];
const TILES_PER_PATTERN = BLOCKS.reduce((n, [, tiles]) => n + tiles.length, 0);
const CELLS_PER_PATTERN = BLOCKS.reduce((n, [w]) => n + w, 0);
const CELL = 56;
const GAP = 8;
/** About the website's drift speed. */
const PX_PER_SECOND = 22;
const ALBUM_MINIMUM = 3;

function Mosaic({ photos, patterns, hidden }: { photos: Photo[]; patterns: number; hidden?: boolean }): React.JSX.Element {
  const tiles: React.JSX.Element[] = [];
  let x = 0;
  for (let p = 0; p < patterns; p++) {
    for (const [width, list] of BLOCKS) {
      for (const [tx, ty, tw, th] of list) {
        const photo = photos[tiles.length % photos.length]!;
        tiles.push(
          <View
            key={tiles.length}
            className="bg-land absolute overflow-hidden rounded-[14px]"
            style={{
              left: (x + tx) * (CELL + GAP),
              top: ty * (CELL + GAP),
              width: tw * CELL + (tw - 1) * GAP,
              height: th * CELL + (th - 1) * GAP,
            }}
          >
            <Image
              source={mediaUrl(photo.storage_path)}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              accessible={!hidden}
              accessibilityLabel={hidden ? undefined : photo.alt_text}
            />
          </View>,
        );
      }
      x += width;
    }
  }
  return (
    <View
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
      style={{ width: x * (CELL + GAP), height: 4 * CELL + 3 * GAP }}
    >
      {tiles}
    </View>
  );
}

/**
 * The region album (D-051, D-052): the region's photos as a mosaic that drifts sideways by itself. Not touchable
 * and no pause control (founder's decision); still when the phone asks for reduced motion. Hidden below three photos.
 */
export function RegionAlbum({ photos }: { photos: Photo[] }): React.JSX.Element | null {
  const reduced = useReducedMotion();
  const patterns = Math.max(1, Math.ceil(photos.length / TILES_PER_PATTERN));
  const width = patterns * CELLS_PER_PATTERN * (CELL + GAP);
  const shift = useSharedValue(0);

  useEffect(() => {
    if (reduced || photos.length < ALBUM_MINIMUM) return;
    shift.value = 0;
    shift.value = withRepeat(withTiming(-width, { duration: (width / PX_PER_SECOND) * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(shift);
  }, [reduced, width, photos.length, shift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  if (photos.length < ALBUM_MINIMUM) return null;
  return (
    <View pointerEvents="none" className="-mx-4 overflow-hidden" style={{ height: 4 * CELL + 3 * GAP }}>
      <Animated.View style={[{ flexDirection: 'row', width: width * 2 }, style]}>
        <Mosaic photos={photos} patterns={patterns} />
        <Mosaic photos={photos} patterns={patterns} hidden />
      </Animated.View>
    </View>
  );
}
