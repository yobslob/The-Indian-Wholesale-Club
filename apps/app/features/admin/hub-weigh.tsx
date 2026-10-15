import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { markPickup, weighPickup } from '@repo/db/admin';

import { AdminButton } from './ui';

import { supabase } from '@/lib/supabase';

const input = 'border-line bg-paper text-ink font-body min-h-11 w-20 rounded-[10px] border px-3 text-right text-[15px]';

/** Whole grams 1 – 50,000, or null (empty or not a weight). */
const gramsOf = (text: string): number | null => {
  const n = Number(text.trim());
  return text.trim() && Number.isInteger(n) && n >= 1 && n <= 50_000 ? n : null;
};

/**
 * D-130: Picked with the piece's weight from the hub's scale (one piece, packed; optional). The weight becomes its
 * option's weight and the listing is repriced for the next customer; Unavailable is the screen's own (it asks first).
 */
export function PickWithWeight({
  pickupId,
  name,
  big = false,
  busy,
  run,
  onUnavailable,
}: {
  pickupId: string;
  name: string;
  big?: boolean;
  busy: boolean;
  run: (task: () => Promise<unknown>) => Promise<boolean>;
  onUnavailable: () => void;
}): React.JSX.Element {
  const [text, setText] = useState('');
  const grams = gramsOf(text);
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        placeholder="g"
        accessibilityLabel={`Weight of one piece, packed, in grams: ${name}`}
        className={input}
      />
      <View className="flex-1">
        <AdminButton
          big={big}
          label={grams ? `Picked · ${grams} g` : 'Picked'}
          disabled={busy || (text.trim() !== '' && grams === null)}
          onPress={() =>
            void run(async () => {
              await markPickup(supabase, pickupId, 'picked');
              if (grams) await weighPickup(supabase, pickupId, grams);
            })
          }
        />
      </View>
      <View className="flex-1">
        <AdminButton big={big} kind="secondary" label="Unavailable" disabled={busy} onPress={onUnavailable} />
      </View>
    </View>
  );
}

/** A picked piece: what weighing it changed, or a box to weigh it. */
export function WeighPicked({
  pickupId,
  weighedG,
  note,
  name,
  busy,
  run,
}: {
  pickupId: string;
  weighedG: number | null;
  note: string | null;
  name: string;
  busy: boolean;
  run: (task: () => Promise<unknown>) => Promise<boolean>;
}): React.JSX.Element {
  const [text, setText] = useState('');
  const grams = gramsOf(text);
  if (weighedG) return <Text className="font-body text-ink-muted text-[12.5px]">{note ?? `Weighed ${weighedG} g`}</Text>;
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        value={text}
        onChangeText={setText}
        keyboardType="number-pad"
        placeholder="g"
        accessibilityLabel={`Weight of one piece, packed, in grams: ${name}`}
        className={input}
      />
      <AdminButton
        kind="secondary"
        label="Weigh it"
        disabled={busy || grams === null}
        onPress={() => void run(() => weighPickup(supabase, pickupId, grams!))}
      />
    </View>
  );
}
