import { Text, View } from 'react-native';

import { clothingAttributesSchema, spiceAttributesSchema } from '@repo/shared/domain';

import type { Product, Variant } from '@repo/db/store';

import { Row } from '@/components/ui';

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

/** True when the listing has anything for the "Details" section. */
export function hasDetails(product: Product): boolean {
  return Boolean(product.description || product.craft || product.story) || attributeRows(product).length > 0;
}

/** Description, craft, attributes and story (the "Details" section). */
export function Details({ product }: { product: Product }): React.JSX.Element {
  const rows = attributeRows(product);
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
  const sizes = variants.map((v) => (typeof v.options.size === 'string' ? v.options.size : null)).filter((s): s is string => s !== null);
  if (sizes.length === 0 && !length) return [];
  return (sizes.length > 0 ? sizes : ['One size']).map((size) => [size, length]);
}
