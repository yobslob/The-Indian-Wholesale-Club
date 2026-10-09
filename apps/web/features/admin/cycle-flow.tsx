import { CYCLE_FLOW, type CycleStatus } from '@repo/shared/domain';

import { CYCLE_STATUS } from './chips';
import { deskTime, shortDate, type Desk } from './time';

interface FlowCycle {
  status: CycleStatus;
  cutoff_at: string;
  est_export_on: string | null;
  est_arrival_on: string;
}

/** The dates known for each step: the cutoff, the estimated export and the estimated arrival (D-008, D-045). */
function stepDates(c: FlowCycle, desk: Desk | null): Partial<Record<CycleStatus, string>> {
  const cutoffDay = deskTime(c.cutoff_at, desk).main.split(',')[0];
  return {
    open: c.status === 'open' ? `until ${cutoffDay}` : `to ${cutoffDay}`,
    ...(c.est_export_on ? { exported: `est. ${shortDate(c.est_export_on)}` } : {}),
    arrived: `est. ${shortDate(c.est_arrival_on)}`,
  };
}

/**
 * A cycle's progress (D-096): Open → Collecting → Packed → Exported → Arrived → Fulfilling → Closed, the steps done in
 * ink and the current one in the brand colour. `bar` is Today's thin bar, `stepper` the cycle page's.
 */
export function CycleFlow({ cycle, desk, variant = 'bar' }: { cycle: FlowCycle; desk: Desk | null; variant?: 'bar' | 'stepper' }): React.JSX.Element {
  const at = CYCLE_FLOW.indexOf(cycle.status);
  const dates = stepDates(cycle, desk);
  return (
    <ol aria-label="Cycle progress" className={variant === 'bar' ? 'mt-3.5 flex gap-1' : 'grid grid-cols-7 gap-1'}>
      {CYCLE_FLOW.map((step, i) => {
        const state = i < at || cycle.status === 'closed' ? 'done' : i === at ? 'now' : 'next';
        const label = CYCLE_STATUS[step][0];
        const tone = state === 'done' ? 'text-ink' : state === 'now' ? 'text-brand' : 'text-ink-muted';
        const line = state === 'done' ? 'bg-ink' : state === 'now' ? 'bg-brand' : 'bg-line';
        return (
          <li key={step} aria-current={state === 'now' ? 'step' : undefined} className="min-w-0 flex-1">
            <i className={`block rounded-[3px] ${variant === 'bar' ? 'h-1.5' : 'h-1'} ${line}`} />
            <small className={`font-ui mt-1.5 block truncate text-[9.5px] font-semibold tracking-[-0.01em] md:tracking-normal leading-tight md:text-[11px] ${variant === 'stepper' ? 'md:text-[12.5px]' : ''} ${tone}`}>
              {label}
              <em className="text-ink-muted hidden truncate font-normal not-italic md:block">{dates[step] ?? ' '}</em>
            </small>
          </li>
        );
      })}
    </ol>
  );
}
