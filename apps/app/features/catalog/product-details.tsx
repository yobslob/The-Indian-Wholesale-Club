import { Text, View } from 'react-native';

import { clothingAttributesSchema, detailRows, photoNote } from '@repo/shared/domain';

import type { Media, Product, Variant } from '@repo/db/store';

import { Row } from '@/components/ui';

/**
 * Description, craft, attributes, where it is from and what the photos are (D-100), then the story: the "Details"
 * section, above the Size chart. The rows are shared with the website (`@repo/shared/domain`).
 */
export function Details({ product, media }: { product: Product; media: Media[] }): React.JSX.Element {
  const rows = detailRows(product, photoNote(media));
  return (
    <View className="gap-2">
      {product.description ? <Text className="font-body text-ink text-sm leading-5">{product.description}</Text> : null}
      {product.craft ? <Row label="Craft" value={product.craft} /> : null}
      {rows.map(([label, value]) => (
        <Row key={label} label={label} value={value} />
      ))}
      {product.story ? <Text className="font-body text-ink-muted text-sm leading-5">{product.story}</Text> : null}
    </View>
  );
}

/** "Size chart" rows from what the listing really holds (sizes, fabric length); empty when there is nothing. */
export function sizeRows(product: Product, variants: Variant[]): [string, string][] {
  if (product.product_type !== 'clothing') return [];
  const attrs = clothingAttributesSchema.safeParse(product.attributes);
  const length = attrs.success && attrs.data.length_m !== undefined ? `${attrs.data.length_m} m` : '';
  // Each size once, even when it comes in several colours.
  const sizes = [...new Set(variants.map((v) => (typeof v.options.size === 'string' ? v.options.size : null)).filter((s): s is string => s !== null))];
  if (sizes.length === 0 && !length) return [];
  return (sizes.length > 0 ? sizes : ['One size']).map((size) => [size, length]);
}
