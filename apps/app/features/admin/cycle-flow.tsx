import { Text, View } from 'react-native';

import { CYCLE_STATUS, deskTime, shortDate, type Desk } from '@repo/shared/admin';
import { CYCLE_FLOW, type CycleStatus } from '@repo/shared/domain';

interface FlowCycle {
  status: CycleStatus;
  cutoff_at: string;
  est_export_on: string | null;
  est_arrival_on: string;
}

/**
 * A cycle's progress (D-096, D-097): Open → Collecting → Packed → Exported → Arrived → Fulfilling → Closed, the steps
 * done in ink and the current one in the brand colour, with the dates known (cutoff, estimated export and arrival).
 */
export function CycleFlow({ cycle, desk, dates = false }: { cycle: FlowCycle; desk: Desk | null; dates?: boolean }): React.JSX.Element {
  const at = CYCLE_FLOW.indexOf(cycle.status);
  const when: Partial<Record<CycleStatus, string>> = {
    open: deskTime(cycle.cutoff_at, desk).main.split(',')[0],
    ...(cycle.est_export_on ? { exported: shortDate(cycle.est_export_on) } : {}),
    arrived: shortDate(cycle.est_arrival_on),
  };
  return (
    <View className="flex-row gap-1" accessibilityLabel={`Cycle progress: ${CYCLE_STATUS[cycle.status][0]}`}>
      {CYCLE_FLOW.map((step, i) => {
        const state = i < at || cycle.status === 'closed' ? 'done' : i === at ? 'now' : 'next';
        return (
          <View key={step} className="min-w-0 flex-1">
            <View className={`h-1.5 rounded-[3px] ${state === 'done' ? 'bg-ink' : state === 'now' ? 'bg-brand' : 'bg-line'}`} />
            <Text numberOfLines={1} className={`font-ui-semibold mt-1.5 text-[9.5px] ${state === 'done' ? 'text-ink' : state === 'now' ? 'text-brand' : 'text-ink-muted'}`}>
              {CYCLE_STATUS[step][0]}
            </Text>
            {dates ? (
              <Text numberOfLines={1} className="font-body text-ink-muted text-[9.5px]">
                {when[step] ?? ' '}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
