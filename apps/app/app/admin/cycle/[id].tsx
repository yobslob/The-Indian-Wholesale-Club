import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { advanceCycle, cutoffCycle, listCycles, listPickups, markPickup } from '@repo/db/admin';
import { nextCycleStatus } from '@repo/shared/domain';

import { Body, Button, Card, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { rupees, utc } from '@/features/admin/format';
import { useAction } from '@/features/admin/use-action';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

type Pickups = Awaited<ReturnType<typeof listPickups>>;

/**
 * One cycle: cutoff / next step, and the pickup checklist per shop
 * (admin.md: one screen per job). The COO marks each piece picked or
 * unavailable at the shop; the database moves stock and orders (flows.md §4).
 */
export default function AdminCycleScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useQuery(`admin:cycle:${id}`, async () => {
    const [cycles, pickups] = await Promise.all([
      listCycles(supabase, 100),
      listPickups(supabase, id),
    ]);
    return { cycle: cycles.find((c) => c.id === id) ?? null, pickups };
  });
  const action = useAction(reload);

  const cycle = data?.cycle;
  if (!cycle) {
    return (
      <Screen refreshing={loading} onRefresh={reload}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading ? <Loading /> : <Body muted>Cycle not found.</Body>}
      </Screen>
    );
  }

  const byVendor = new Map<string, { name: string; details: string; rows: Pickups }>();
  for (const p of data.pickups) {
    const key = p.vendor?.id ?? 'unknown';
    const group = byVendor.get(key) ?? {
      name: p.vendor?.shop_name ?? 'Unknown shop',
      details: [p.vendor?.town, p.vendor?.phone].filter(Boolean).join(' · '),
      rows: [],
    };
    group.rows.push(p);
    byVendor.set(key, group);
  }
  const next = nextCycleStatus(cycle.status);
  const cycleId = cycle.id;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>Cycle {cycle.code}</Title>
      <Body muted>
        {cycle.status} · cutoff {utc(cycle.cutoff_at)} · est. export {cycle.est_export_on ?? '—'} ·
        est. arrival {cycle.est_arrival_on}
      </Body>
      {cycle.status === 'open' ? (
        <Button
          label="Cut off now (closes ordering, creates pickups)"
          disabled={action.busy}
          onPress={() => void action.run(() => cutoffCycle(supabase, cycleId))}
        />
      ) : next ? (
        <Button
          label={`Move to “${next}”`}
          disabled={action.busy}
          onPress={() => void action.run(() => advanceCycle(supabase, cycleId))}
        />
      ) : null}
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}

      {[...byVendor.entries()].map(([vendorId, group]) => (
        <Card key={vendorId}>
          <Text className="text-ink font-medium">{group.name}</Text>
          {group.details ? <Body muted>{group.details}</Body> : null}
          {group.rows.map((p) => (
            <View key={p.id} className="border-line gap-2 border-t py-2">
              <Text className="text-ink text-sm">
                {p.item?.product_name} · {p.variant?.label} × {p.quantity} ·{' '}
                {rupees(p.shop_price_paise)}
              </Text>
              {p.status === 'pending' ? (
                <View className="flex-row items-center gap-4">
                  <Button
                    label="Picked"
                    disabled={action.busy}
                    onPress={() => void action.run(() => markPickup(supabase, p.id, 'picked'))}
                  />
                  <Button
                    kind="link"
                    label="Unavailable"
                    disabled={action.busy}
                    onPress={() => void action.run(() => markPickup(supabase, p.id, 'unavailable'))}
                  />
                </View>
              ) : (
                <Text
                  className={
                    p.status === 'unavailable' ? 'text-caution text-sm' : 'text-positive text-sm'
                  }
                >
                  {p.status}
                </Text>
              )}
            </View>
          ))}
        </Card>
      ))}
      {data.pickups.length === 0 && cycle.status !== 'open' ? (
        <Body muted>No pickups in this cycle.</Body>
      ) : null}
    </Screen>
  );
}
