import { Pressable, Text, View } from 'react-native';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

/** Search's type filter with each type's count (D-160, as the website's): All, then the types the search found. */
export function SearchTypePills({
  counts,
  type,
  onChange,
}: {
  counts: Partial<Record<string, number>>;
  type: ProductType | null;
  onChange: (type: ProductType | null) => void;
}): React.JSX.Element | null {
  const types = PRODUCT_TYPES.filter((t) => (counts[t] ?? 0) > 0);
  if (types.length < 2 && !type) return null;
  const all = types.reduce((n, t) => n + (counts[t] ?? 0), 0);
  return (
    <View className="flex-row flex-wrap gap-2">
      {[null, ...types].map((t) => (
        <Pressable
          key={t ?? 'all'}
          accessibilityRole="button"
          accessibilityState={{ selected: type === t }}
          onPress={() => onChange(t)}
          className={`min-h-11 justify-center rounded-pill border px-4 ${type === t ? 'bg-ink border-ink' : 'border-line bg-paper'}`}
        >
          <Text className={`font-ui text-sm ${type === t ? 'text-canvas' : 'text-ink'}`}>
            {t ? PRODUCT_TYPE_LABEL[t] : 'All'} {t ? (counts[t] ?? 0) : all}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
