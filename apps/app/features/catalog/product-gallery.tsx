import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Media } from '@repo/db/store';

import { Photo } from '@/components/photo';

/**
 * The full-screen photo viewer (D-082, D-095): every photo of the product, swipe between them, a count, ×. Opens at
 * the photo that was tapped; Back (Android) closes it.
 */
function Viewer({ media, start, name, onClose }: { media: Media[]; start: number; name: string; onClose: () => void }): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(start);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-[rgba(20,17,15,0.96)]">
        <SafeAreaView className="flex-1">
          <View className="flex-row justify-end px-3">
            <Pressable accessibilityRole="button" accessibilityLabel="Close photos" onPress={onClose} className="h-11 w-11 items-center justify-center">
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
          <FlatList
            data={media}
            keyExtractor={(m) => m.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={start}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setAt(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index }) => (
              <View style={{ width, height: height - 170 }} className="items-center justify-center">
                <Photo path={item.storage_path} width={width} contentFit="contain" accessibilityLabel={item.alt_text || `${name}, photo ${index + 1}`} />
              </View>
            )}
          />
          <View className="flex-row justify-center gap-1.5 pb-3">
            {media.map((m, i) => (
              <View key={m.id} className={`h-1.5 w-1.5 rounded-full ${i === at ? 'bg-white' : 'bg-[rgba(255,255,255,0.4)]'}`} />
            ))}
          </View>
          <Text className="font-ui pb-6 text-center text-sm text-white" accessibilityLiveRegion="polite">
            {at + 1} / {media.length}
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * Product photos on a phone (D-051, D-082, D-095): the main photo edge to edge at 3 : 4, up to three more in a row
 * under it; any photo opens the full-screen viewer at that photo.
 */
export function ProductGallery({ media, name }: { media: Media[]; name: string }): React.JSX.Element {
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<number | null>(null);
  if (media.length === 0) {
    return (
      <View className="bg-land aspect-[3/4] items-center justify-center">
        <Text className="font-ui text-ink-muted text-sm">Photo coming soon</Text>
      </View>
    );
  }
  const [main, ...rest] = media;
  return (
    <View className="gap-2">
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Open photo 1 of ${media.length}`} onPress={() => setOpen(0)} className="bg-land aspect-[3/4] overflow-hidden">
        <Photo path={main.storage_path} width={width} accessibilityLabel={main.alt_text || name} transition={150} />
      </Pressable>
      {rest.length > 0 ? (
        <View className="flex-row gap-2 px-4">
          {rest.slice(0, 3).map((m, i) => (
            <Pressable
              key={m.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Open photo ${i + 2} of ${media.length}`}
              onPress={() => setOpen(i + 1)}
              className="bg-land aspect-[3/4] flex-1 overflow-hidden rounded-xl"
            >
              <Photo path={m.storage_path} width={width / 3} />
            </Pressable>
          ))}
          {/* Keep three equal columns when there are fewer than three small photos. */}
          {Array.from({ length: Math.max(0, 3 - rest.length) }, (_, i) => (
            <View key={`gap-${i}`} className="flex-1" />
          ))}
        </View>
      ) : null}
      {main.credit ? (
        // A free-licence photo's attribution (demo round, D-078).
        <Text className="font-body text-ink-muted px-4 text-xs">Photo: {main.credit}</Text>
      ) : null}
      {open !== null ? <Viewer media={media} start={open} name={name} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}
