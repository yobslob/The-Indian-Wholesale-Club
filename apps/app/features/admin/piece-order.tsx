import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { markOrdered, unmarkOrdered } from '@repo/db/admin';

import { rupees } from '@/features/admin/format';
import { AdminButton, Chip } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';

/**
 * A sold piece from an online shop on the app's order screen (D-140, F3): Order it opens the shop item in use (the
 * variant's source, D-118); Mark ordered records it at the price shown and reads Ordered at once, going back with a line
 * if the database refuses (rule 0.1). The amount, the shop's order number and the bill photo are typed on the web panel.
 */
export function PieceOrder({
  pickupId,
  itemUrl,
  quantity,
  pricePaise,
  ordered,
}: {
  pickupId: string;
  itemUrl: string;
  quantity: number;
  pricePaise: number | null;
  ordered: boolean;
}): React.JSX.Element {
  const [done, setDone] = useState(ordered);
  const [error, setError] = useState<string | null>(null);

  const toggle = (): void => {
    const next = !done;
    setDone(next);
    setError(null);
    const write = next
      ? markOrdered(supabase, { lines: [{ pickup: pickupId, paid_paise: pricePaise === null ? null : pricePaise * quantity }] })
      : unmarkOrdered(supabase, pickupId);
    write.catch(() => {
      setDone(!next);
      setError(next ? 'Not marked ordered. Try again.' : 'Not undone. Try again.');
    });
  };

  return (
    <View className="mt-1 gap-1.5">
      <Text accessibilityRole="link" onPress={() => void Linking.openURL(itemUrl)} className="font-ui-semibold text-ink text-[13px] underline">
        Order it online{pricePaise !== null ? ` · ${rupees(pricePaise * quantity)}` : ''}
      </Text>
      {done ? (
        <View className="flex-row items-center gap-3">
          <Chip tone="blue">Ordered</Chip>
          <Text accessibilityRole="button" onPress={toggle} className="font-ui text-ink text-[13px] underline">
            Undo
          </Text>
        </View>
      ) : (
        <AdminButton kind="secondary" label="Mark ordered" onPress={toggle} />
      )}
      {error ? <Text className="font-body text-danger text-[12.5px]">{error}</Text> : null}
    </View>
  );
}
