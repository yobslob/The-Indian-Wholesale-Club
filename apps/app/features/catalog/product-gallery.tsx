import { useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';

import type { Media } from '@repo/db/store';

import { Photo } from '@/components/photo';

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
        <Photo path={main.storage_path} width={Dimensions.get('window').width} accessibilityLabel={main.alt_text || name} transition={150} />
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
              <Photo path={m.storage_path} width={Dimensions.get('window').width / 3} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
