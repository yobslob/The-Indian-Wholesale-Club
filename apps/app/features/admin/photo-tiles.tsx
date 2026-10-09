import { Image } from 'expo-image';
import { Pressable, Text, TextInput, View } from 'react-native';

import tokens from '@repo/tokens';

import type { ListingPhoto } from './listing-photos';

const round = 'absolute top-1.5 h-7 w-7 items-center justify-center rounded-full bg-[rgba(20,17,15,0.7)]';

/**
 * A new listing's photos (D-097): three to a row, the first is the main photo, ← moves one earlier, × removes it, and
 * what it shows (alt text) under each, for screen readers.
 */
export function PhotoTiles({ photos, onChange }: { photos: ListingPhoto[]; onChange: (next: ListingPhoto[]) => void }): React.JSX.Element | null {
  if (photos.length === 0) return null;
  const move = (i: number): void => {
    const next = photos.slice();
    const [it] = next.splice(i, 1);
    next.splice(i - 1, 0, it!);
    onChange(next);
  };
  return (
    <View className="flex-row flex-wrap gap-2">
      {photos.map((p, i) => (
        <View key={p.uri} className="w-[31.5%] gap-1">
          <View className="bg-land aspect-[3/4] overflow-hidden rounded-[10px]">
            <Image source={p.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </View>
          {i === 0 ? (
            <View className="bg-ink absolute left-1.5 top-1.5 rounded-pill px-[7px] py-[3px]">
              <Text className="font-ui-semibold text-paper text-[10px] uppercase tracking-[0.6px]">Main</Text>
            </View>
          ) : (
            <Pressable onPress={() => move(i)} accessibilityRole="button" accessibilityLabel={`Move photo ${i + 1} earlier`} className={`${round} left-1.5`}>
              <Text className="font-ui-semibold text-[13px] text-white">←</Text>
            </Pressable>
          )}
          <Pressable onPress={() => onChange(photos.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} className={`${round} right-1.5`}>
            <Text className="font-ui-semibold text-[13px] text-white">×</Text>
          </Pressable>
          <TextInput
            value={p.alt}
            onChangeText={(alt) => onChange(photos.map((x, j) => (j === i ? { ...x, alt } : x)))}
            placeholder="Add alt text"
            placeholderTextColor={tokens.colors['ink-muted']}
            accessibilityLabel={`What photo ${i + 1} shows`}
            className="border-line bg-canvas text-ink font-body min-h-9 rounded-[7px] border px-2 text-[12px]"
          />
        </View>
      ))}
    </View>
  );
}
