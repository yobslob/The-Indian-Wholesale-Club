import { Text, View } from 'react-native';

import { checkOffArrival, type listPickups } from '@repo/db/admin';

import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type Pickups = Awaited<ReturnType<typeof listPickups>>;

/**
 * flows.md §6.3, as on the website: once the export has arrived, tick off each order's picked pieces as they come
 * out of the box, order by order.
 */
export function ArrivalList({
  status,
  pickups,
  busy,
  run,
}: {
  status: string;
  pickups: Pickups;
  busy: boolean;
  run: (task: () => Promise<unknown>) => Promise<boolean>;
}): React.JSX.Element | null {
  if (!['arrived', 'fulfilling'].includes(status)) return null;
  const picked = pickups.filter((p) => p.status === 'picked');
  const byOrder = new Map<string, { number: string; rows: Pickups }>();
  for (const p of picked) {
    const key = p.item?.order_id ?? 'unknown';
    const group = byOrder.get(key) ?? { number: p.item?.order?.order_number ?? '—', rows: [] };
    group.rows.push(p);
    byOrder.set(key, group);
  }
  const done = picked.filter((p) => p.arrived_at).length;

  return (
    <Card>
      <Text className="font-ui text-ink text-[15px]">
        Arrival check-off · {done} of {picked.length} pieces
      </Text>
      {[...byOrder.entries()].map(([orderId, group]) => (
        <View key={orderId} className="border-line gap-2 border-t py-2">
          <Text className="text-ink font-medium">{group.number}</Text>
          {group.rows.map((p) => (
            <View key={p.id} className="gap-1">
              <Text className="text-ink text-sm">
                {p.item?.product_name} · {p.variant?.label} × {p.quantity}
              </Text>
              {p.arrived_at ? (
                <Button
                  kind="link"
                  label="Arrived · undo"
                  disabled={busy}
                  onPress={() => void run(() => checkOffArrival(supabase, p.id, false))}
                />
              ) : (
                <Button
                  kind="secondary"
                  label="Arrived"
                  disabled={busy}
                  onPress={() => void run(() => checkOffArrival(supabase, p.id))}
                />
              )}
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}
