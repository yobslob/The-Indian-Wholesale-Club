import { Pressable, Text, TextInput, View } from 'react-native';

import { variantLabel } from '@repo/shared/domain';
import tokens from '@repo/tokens';

export interface VariantDraft {
  colour: string;
  size: string;
  qty: number;
}

export const EMPTY_VARIANT: VariantDraft = { colour: '', size: '', qty: 1 };

const input = 'border-line bg-paper text-ink font-body min-h-11 w-0 min-w-0 flex-1 rounded-md border px-3 text-[15px]';
const step = 'border-line bg-paper min-h-11 min-w-11 items-center justify-center rounded-full border';

/**
 * The variants of a new listing (flows.md §2 step 3): colour and size (either can be empty) and the pieces the shop
 * has, with a − / + stepper as in the approved admin mockup. The label customers see is built from colour and size.
 */
export function VariantRows({
  variants,
  onChange,
}: {
  variants: VariantDraft[];
  onChange: (next: VariantDraft[]) => void;
}): React.JSX.Element {
  const set = (i: number, patch: Partial<VariantDraft>): void =>
    onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <View className="gap-3">
      {variants.map((v, i) => (
        <View key={i} className="border-line gap-2 rounded-md border p-3">
          <View className="flex-row gap-2">
            <TextInput
              value={v.colour}
              onChangeText={(colour) => set(i, { colour })}
              placeholder="Colour"
              placeholderTextColor={tokens.colors['ink-muted']}
              accessibilityLabel={`Variant ${i + 1} colour`}
              className={input}
            />
            <TextInput
              value={v.size}
              onChangeText={(size) => set(i, { size })}
              placeholder="Size"
              placeholderTextColor={tokens.colors['ink-muted']}
              accessibilityLabel={`Variant ${i + 1} size`}
              className={input}
            />
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-ui text-ink-muted flex-1 text-[13px]">{variantLabel(v)}</Text>
            <Pressable
              onPress={() => set(i, { qty: Math.max(0, v.qty - 1) })}
              accessibilityRole="button"
              accessibilityLabel={`One piece fewer for variant ${i + 1}`}
              className={step}
            >
              <Text className="font-ui text-ink text-lg">−</Text>
            </Pressable>
            <Text className="font-ui-semibold text-ink w-8 text-center" accessibilityLabel={`${v.qty} pieces`}>
              {v.qty}
            </Text>
            <Pressable
              onPress={() => set(i, { qty: Math.min(9999, v.qty + 1) })}
              accessibilityRole="button"
              accessibilityLabel={`One piece more for variant ${i + 1}`}
              className={step}
            >
              <Text className="font-ui text-ink text-lg">+</Text>
            </Pressable>
            {variants.length > 1 ? (
              <Pressable
                onPress={() => onChange(variants.filter((_, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove variant ${i + 1}`}
                className="min-h-11 justify-center pl-1"
              >
                <Text className="font-ui text-ink-muted text-[13px] underline">Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      <Pressable
        onPress={() => onChange([...variants, { ...EMPTY_VARIANT, colour: variants.at(-1)?.colour ?? '' }])}
        accessibilityRole="button"
        className="border-line bg-paper min-h-12 items-center justify-center rounded-md border"
      >
        <Text className="font-ui text-ink text-[15px]">＋ Add a variant</Text>
      </Pressable>
    </View>
  );
}
