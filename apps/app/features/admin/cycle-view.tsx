import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { advanceCycle, cutoffCycle, listCycles, listPickups } from '@repo/db/admin';
import { CYCLE_STATUS, shortDate } from '@repo/shared/admin';
import { nextCycleStatus, type CycleStatus } from '@repo/shared/domain';

import { ArrivalList } from './arrival-list';
import { CycleFlow } from './cycle-flow';
import { Progress, ShopCard } from './shop-pickups';
import { AdminButton, AdminHead, ConfirmSheet, Group, Panel, StatusChip, useDesk } from './ui';
import { useAction } from './use-action';

import { Body, ErrorText, Loading, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const NEXT_LABEL: Partial<Record<CycleStatus, string>> = {
  packed: 'Mark packed →',
  exported: 'Mark exported →',
  arrived: 'Mark arrived →',
  fulfilling: 'Start fulfilling →',
  closed: 'Close the cycle →',
};
type Show = 'topick' | 'all' | 'unavailable';

/**
 * A cycle (D-097): its progress from Open to Closed with the one next step, then the pickups as one card per shop
 * filtered To pick · All · Unavailable, and the arrival check-off once it is in the US. `id` null = the cycle being
 * worked on now (the oldest with pickups to do, else the newest not closed): the Cycle tab.
 */
export function CycleView({ id }: { id: string | null }): React.JSX.Element {
  const router = useRouter();
  const desk = useDesk();
  const { data, error, loading, reload } = useQuery(`admin:cycle:${id ?? 'now'}`, async () => {
    const cycles = await listCycles(supabase, 30);
    let cycle = id ? (cycles.find((c) => c.id === id) ?? null) : null;
    if (!id) {
      // The newest cycle that is cut off but not closed, else the open one.
      cycle = cycles.find((c) => !['open', 'closed'].includes(c.status)) ?? cycles.find((c) => c.status === 'open') ?? cycles[0] ?? null;
    }
    const pickups = cycle ? await listPickups(supabase, cycle.id) : [];
    return { cycle, pickups, others: cycles.filter((c) => c.id !== cycle?.id).slice(0, 8) };
  });
  const action = useAction(reload);
  const [show, setShow] = useState<Show | null>(null);
  const [cutting, setCutting] = useState(false);
  const cycle = data?.cycle;
  const head = id ? undefined : 'Cycle';

  if (!cycle) {
    return (
      <Screen back={!!id} title={id ? 'Cycle' : undefined} refreshing={loading} onRefresh={reload}>
        {head ? <AdminHead title={head} /> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading ? <Loading /> : <Body muted>No cycles yet. Open the first one on the web panel.</Body>}
      </Screen>
    );
  }

  const pickups = data.pickups;
  const picked = pickups.filter((p) => p.status === 'picked').length;
  const gone = pickups.filter((p) => p.status === 'unavailable').length;
  const toGo = pickups.length - picked - gone;
  const view: Show = show ?? (toGo > 0 ? 'topick' : 'all');
  const pending = new Set(pickups.filter((p) => p.status === 'pending').map((p) => p.vendor?.id));
  const shown = view === 'unavailable' ? pickups.filter((p) => p.status === 'unavailable') : view === 'topick' ? pickups.filter((p) => pending.has(p.vendor?.id)) : pickups;
  const byShop = new Map<string, typeof pickups>();
  for (const p of shown) byShop.set(p.vendor?.id ?? '?', [...(byShop.get(p.vendor?.id ?? '?') ?? []), p]);
  const next = nextCycleStatus(cycle.status);
  const cycleId = cycle.id;

  return (
    <Screen back={!!id} title={id ? `Cycle ${cycle.code}` : undefined} refreshing={loading} onRefresh={reload}>
      {head ? <AdminHead title={`Cycle ${cycle.code}`} code /> : null}
      <View className="-mt-2 flex-row flex-wrap items-center gap-1.5">
        <StatusChip map={CYCLE_STATUS} status={cycle.status} />
        <Text className="font-ui text-ink-muted text-[12.5px]">
          {cycle.est_export_on ? `export est. ${shortDate(cycle.est_export_on)} · ` : ''}arrival est. {shortDate(cycle.est_arrival_on)}
        </Text>
      </View>
      <CycleFlow cycle={cycle} desk={desk} dates />
      {cycle.status === 'open' ? (
        <AdminButton big label="Cut off now…" onPress={() => setCutting(true)} />
      ) : next && NEXT_LABEL[next] ? (
        <AdminButton big label={NEXT_LABEL[next]} disabled={action.busy} onPress={() => void action.run(() => advanceCycle(supabase, cycleId))} />
      ) : null}
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}

      {pickups.length > 0 ? (
        <View className="gap-3">
          <Text className="font-ui text-ink-muted text-[12.5px]">
            {picked} of {pickups.length} picked{gone ? ` · ${gone} unavailable` : ''} · {toGo} to go
          </Text>
          <Progress done={picked} gone={gone} total={pickups.length} />
          <View className="flex-row gap-1.5">
            {(
              [
                ['topick', 'To pick', toGo],
                ['all', 'All', pickups.length],
                ['unavailable', 'Unavailable', gone],
              ] as const
            ).map(([key, label, n]) => (
              <Pressable
                key={key}
                onPress={() => setShow(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: view === key }}
                className={`h-9 flex-row items-center gap-1.5 rounded-pill border px-3 ${view === key ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
              >
                <Text className={`font-ui text-[13px] ${view === key ? 'text-paper' : 'text-ink'}`}>{label}</Text>
                <Text className={`font-ui-semibold text-[13px] ${view === key ? 'text-[rgba(251,248,243,0.7)]' : 'text-ink-muted'}`}>{n}</Text>
              </Pressable>
            ))}
          </View>
          {[...byShop.entries()].map(([key, rows]) => (
            <ShopCard key={key} rows={rows} desk={desk} busy={action.busy} run={action.run} />
          ))}
          {shown.length === 0 ? <Body muted>Nothing here.</Body> : null}
        </View>
      ) : cycle.status !== 'open' ? (
        <Body muted>No pickups in this cycle.</Body>
      ) : null}

      {['arrived', 'fulfilling'].includes(cycle.status) ? (
        <Panel title="Arrival check-off">
          <ArrivalList status={cycle.status} pickups={pickups} busy={action.busy} run={action.run} />
        </Panel>
      ) : null}

      {!id && data.others.length > 0 ? (
        <View className="gap-2">
          <Group>Other cycles</Group>
          {data.others.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/admin/cycle/[id]', params: { id: c.id } })}
              accessibilityRole="button"
              className="border-line min-h-12 flex-row items-center gap-2.5 border-b"
            >
              <Text className="font-ui-semibold text-ink flex-1 text-[14px]">{c.code}</Text>
              <View>
                <StatusChip map={CYCLE_STATUS} status={c.status} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ConfirmSheet
        open={cutting}
        title={`Cut off ${cycle.code} now?`}
        confirm="Cut off now"
        busy={action.busy}
        onClose={() => setCutting(false)}
        onConfirm={() => void action.run(() => cutoffCycle(supabase, cycleId)).then(() => setCutting(false))}
      >
        It closes ordering for this cycle, makes the pickup lists for the shops, tells its customers their order is being
        prepared, and opens the next cycle. It closes by itself at its cutoff anyway.
      </ConfirmSheet>
    </Screen>
  );
}
