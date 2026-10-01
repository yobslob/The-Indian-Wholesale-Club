import { View } from 'react-native';

import { ProductStrip } from './product-row';

import type { RegionProductCard } from '@repo/db/store';

import { Body, Heading, Label } from '@/components/ui';

/** "Curated for you" in one card (D-051), its picks in a sideways row (D-062). Nothing when there are no picks. */
export function CuratedCard({ products, regionName }: { products: RegionProductCard[]; regionName: string }): React.JSX.Element | null {
  if (products.length === 0) return null;
  return (
    <View className="bg-surface gap-4 overflow-hidden rounded-lg px-4 py-5">
      <View className="gap-1">
        <Label>Curated for you</Label>
        <Heading>Picked for you</Heading>
        <Body muted>Chosen by us from {regionName}.</Body>
      </View>
      <ProductStrip products={products} />
    </View>
  );
}
