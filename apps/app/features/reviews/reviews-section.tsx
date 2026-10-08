import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { ReviewSheet } from './review-sheet';

import type { ReviewsSummary } from '@repo/db/store';

import { Button, Heading } from '@/components/ui';
import { reviewPhotoUrl } from '@/lib/supabase';


const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function Stars({ rating, label }: { rating: number; label: string }): React.JSX.Element {
  const n = Math.round(rating);
  return (
    <Text accessibilityLabel={label} className="text-brand text-base tracking-[2px]">
      {'★'.repeat(n)}
      <Text className="text-line">{'★'.repeat(5 - n)}</Text>
    </Text>
  );
}

/**
 * Reviews on the product screen (D-051, D-056, D-082): the summary of every approved review, then the three newest as
 * a sideways row. Write a review opens the form as a sheet in the app (D-090, D-095).
 */
export function ReviewsSection({
  reviews,
  productId,
}: {
  reviews: ReviewsSummary;
  productId: string;
}): React.JSX.Element {
  const { width } = useWindowDimensions();
  const [writing, setWriting] = useState(false);
  return (
    <View className="gap-4 pt-2">
      <Heading>Reviews</Heading>
      {reviews.count === 0 ? (
        <View className="bg-surface rounded-lg p-5">
          <Text className="font-body text-ink text-xl">No reviews yet.</Text>
        </View>
      ) : (
        <>
          <View className="bg-surface gap-1 rounded-lg p-5">
            <Text className="font-heading text-ink text-[52px] leading-[56px]">
              {reviews.average?.toFixed(1)}
            </Text>
            <Stars
              rating={reviews.average ?? 0}
              label={`${reviews.average?.toFixed(1)} out of 5`}
            />
            <Text className="font-body text-ink-muted text-sm">
              Based on {reviews.count} {reviews.count === 1 ? 'review' : 'reviews'}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * 0.82 + 12}
            decelerationRate="fast"
            className="-mx-4"
            contentContainerClassName="gap-3 px-4"
          >
            {reviews.items.slice(0, 3).map((r) => (
              <View
                key={r.id}
                style={{ width: width * 0.82 }}
                className="border-line bg-paper gap-2.5 rounded-lg border p-5"
              >
                <Stars rating={r.rating} label={`${r.rating} out of 5`} />
                <Text className="font-body text-ink text-[14.5px] leading-[22px]">{r.body}</Text>
                {r.photos.length > 0 ? (
                  <View className="flex-row gap-2">
                    {r.photos.map((path) => (
                      <Image
                        key={path}
                        source={reviewPhotoUrl(path)}
                        accessibilityLabel={`Photo from ${r.display_name}`}
                        style={{ width: 64, height: 64, borderRadius: 10 }}
                        contentFit="cover"
                      />
                    ))}
                  </View>
                ) : null}
                <View className="flex-row justify-between">
                  <Text className="font-ui text-ink-muted text-xs">
                    {r.is_demo ? <Text className="text-caution">Demo review · </Text> : null}
                    {r.is_verified_buyer ? (
                      <Text className="text-positive">✓ Verified buyer · </Text>
                    ) : null}
                    {r.display_name}
                  </Text>
                  <Text className="font-ui text-ink-muted text-xs">
                    {dateFormat.format(new Date(r.created_at))}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
      <Button kind="secondary" label="Write a review" onPress={() => setWriting(true)} />
      <ReviewSheet productId={productId} open={writing} onClose={() => setWriting(false)} />
    </View>
  );
}
