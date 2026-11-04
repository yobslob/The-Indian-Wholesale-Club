import { Pressable, Text, View } from 'react-native';

import { stockRows } from './stock';

import type { StockProblemLine } from '@repo/shared/domain';

import { Photo } from '@/components/photo';
import { useBag } from '@/features/cart/store';

/**
 * §10 Y-3: at the top of checkout, each line the server says cannot go ahead as it is: its photo, name and option, "Not
 * available right now" with Remove, or "Only 2 left" with Keep 2. Payment stays locked until each is resolved; changing
 * the bag re-prices at once (the checkout screen).
 */
export function StockProblems({ problems }: { problems: StockProblemLine[] }): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const setQuantity = useBag((s) => s.setQuantity);
  const rows = stockRows(problems, lines);
  if (rows.length === 0) return null;
  return (
    <View className="border-line bg-paper gap-3 rounded-lg border p-4" accessibilityLiveRegion="polite">
      {rows.map((r) => (
        <View key={r.variantId} className="flex-row items-center gap-3">
          <View className="bg-land aspect-[3/4] w-14 overflow-hidden rounded-[10px]">{r.imagePath ? <Photo path={r.imagePath} width={56} /> : null}</View>
          <View className="flex-1 gap-0.5">
            <Text className="font-ui-semibold text-ink text-sm">{r.name}</Text>
            {r.option ? <Text className="font-ui text-ink-muted text-[13px]">{r.option}</Text> : null}
            <Text className="text-caution font-ui text-[13px]">{r.note}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={r.keep ? `Keep ${r.keep} of ${r.name}` : `Remove ${r.name}`}
            onPress={() => setQuantity(r.variantId, r.keep ?? 0)}
            className="border-line bg-paper rounded-pill min-h-10 justify-center border px-3.5"
          >
            <Text className="font-ui text-ink text-[13px]">{r.keep ? `Keep ${r.keep}` : 'Remove'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
