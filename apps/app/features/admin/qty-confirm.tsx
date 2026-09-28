import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { setListedQty } from '@repo/db/admin';
import tokens from '@repo/tokens';

import { utc } from './format';
import { useAction } from './use-action';

import { Button, ErrorText } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export interface VariantQty {
  id: string;
  label: string;
  qty_listed: number;
  qty_reserved: number;
  qty_confirmed_at: string | null;
}

/**
 * Confirm (or correct) how many pieces the shop still has for one variant.
 * The database logs it in the stock ledger and stamps it as re-confirmed (INV-4).
 */
export function QtyConfirm({
  variant,
  onDone,
}: {
  variant: VariantQty;
  onDone: () => void;
}): React.JSX.Element {
  const [qty, setQty] = useState(String(variant.qty_listed));
  const action = useAction(onDone);
  const value = Number(qty);
  const valid = /^\d+$/.test(qty.trim()) && value <= 10000;

  return (
    <View className="border-line gap-1 border-t py-2">
      <Text className="text-ink text-sm">
        {variant.label} · listed {variant.qty_listed} · reserved {variant.qty_reserved}
      </Text>
      <Text className="text-ink-muted text-xs">
        Confirmed with the shop {utc(variant.qty_confirmed_at)}
      </Text>
      <View className="flex-row items-center gap-3">
        <TextInput
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          accessibilityLabel={`Quantity for ${variant.label}`}
          placeholderTextColor={tokens.colors['ink-muted']}
          className="border-line text-ink min-h-11 w-20 rounded-sm border px-3"
        />
        <Button
          label="Confirm qty"
          disabled={action.busy || !valid}
          onPress={() =>
            void action.run(() => setListedQty(supabase, variant.id, value, 'confirmed in app'))
          }
        />
      </View>
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
    </View>
  );
}
