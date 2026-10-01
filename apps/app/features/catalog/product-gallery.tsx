import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Media } from '@repo/db/store';

import { mediaUrl } from '@/lib/supabase';

/**
 * Product photos on a phone (D-051): the main photo large at 3 : 4 and up to three more below it; tapping one puts
 * it in the large spot.
 */
export function ProductGallery({ media, name }: { media: Media[]; name: string }): React.JSX.Element {
  const [mainIndex, setMainIndex] = useState(0);
  if (media.length === 0) {
    return (
      <View className="bg-land aspect-[3/4] items-center justify-center rounded-lg">
        <Text className="font-ui text-ink-muted text-sm">Photo coming soon</Text>
      </View>
    );
  }
  const main = media[mainIndex] ?? media[0];
  const others = media.filter((_, i) => i !== mainIndex).slice(0, 3);
  return (
    <View className="gap-2.5">
      <View className="bg-land aspect-[3/4] overflow-hidden rounded-lg">
        <Image source={mediaUrl(main.storage_path)} accessibilityLabel={main.alt_text || name} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      </View>
      {others.length > 0 ? (
        <View className="flex-row gap-2.5">
          {others.map((m) => (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={`Show photo: ${m.alt_text || name}`}
              onPress={() => setMainIndex(media.indexOf(m))}
              className="bg-land aspect-[3/4] flex-1 overflow-hidden rounded-md"
            >
              <Image source={mediaUrl(m.storage_path)} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
