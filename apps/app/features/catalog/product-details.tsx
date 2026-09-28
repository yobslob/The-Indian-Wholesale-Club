import { Dimensions, Image, ScrollView, Text, View } from 'react-native';

import { clothingAttributesSchema, spiceAttributesSchema } from '@repo/shared/domain';

import type { Media, Product } from '@repo/db/store';

import { Row } from '@/components/ui';
import { mediaUrl } from '@/lib/supabase';

/** Attribute rows for customers. Invalid attribute data is not shown (D-003). */
function attributeRows(product: Product): [string, string][] {
  if (product.product_type === 'clothing') {
    const parsed = clothingAttributesSchema.safeParse(product.attributes);
    if (!parsed.success) return [];
    const a = parsed.data;
    const rows: [string, string][] = [
      ['Fabric', a.fibre_content],
      ['Care', a.care],
    ];
    if (a.length_m !== undefined) rows.push(['Length', `${a.length_m} m`]);
    if (a.notes) rows.push(['Notes', a.notes]);
    return rows;
  }
  const parsed = spiceAttributesSchema.safeParse(product.attributes);
  if (!parsed.success) return [];
  const a = parsed.data;
  const rows: [string, string][] = [
    ['Ingredients', a.ingredients],
    ['Allergens', a.allergens.length > 0 ? a.allergens.join(', ') : 'None declared'],
    ['Shelf life', `${a.shelf_life_days} days`],
  ];
  if (a.storage) rows.push(['Storage', a.storage]);
  return rows;
}

export function Gallery({ media, name }: { media: Media[]; name: string }): React.JSX.Element {
  const width = Dimensions.get('window').width - 32;
  if (media.length === 0) {
    return (
      <View
        className="bg-surface items-center justify-center rounded-md"
        style={{ width, height: width * 1.25 }}
      >
        <Text className="text-ink-muted text-sm">Photo coming soon</Text>
      </View>
    );
  }
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
      {media.map((m) => (
        <Image
          key={m.id}
          source={{ uri: mediaUrl(m.storage_path) }}
          accessibilityLabel={m.alt_text || name}
          style={{ width, height: width * 1.25 }}
          className="bg-surface rounded-md"
          resizeMode="cover"
        />
      ))}
    </ScrollView>
  );
}

/** Description, craft, attributes and the honest origin line (D-004). */
export function Details({ product }: { product: Product }): React.JSX.Element {
  const rows = attributeRows(product);
  return (
    <View className="gap-2">
      {product.description ? <Text className="text-ink text-sm">{product.description}</Text> : null}
      {product.craft ? <Row label="Craft" value={product.craft} /> : null}
      {rows.map(([label, value]) => (
        <Row key={label} label={label} value={value} />
      ))}
      {product.story ? <Text className="text-ink-muted text-sm">{product.story}</Text> : null}
      <Text className="border-line text-ink border-t pt-2 text-sm">
        Made in India · from {product.region_name} · Imported
      </Text>
    </View>
  );
}
