/**
 * Cycle lifecycle (flows.md §1). open → collecting happens ONLY through the
 * cutoff_cycle() SQL function (it creates the pickups). The later steps are
 * admin actions in this order.
 */
export const CYCLE_FLOW = ['open', 'collecting', 'packed', 'exported', 'arrived', 'fulfilling', 'closed'] as const;
export type CycleStatus = (typeof CYCLE_FLOW)[number];

export function nextCycleStatus(status: CycleStatus): CycleStatus | null {
  const index = CYCLE_FLOW.indexOf(status);
  return index >= 0 && index < CYCLE_FLOW.length - 1 ? (CYCLE_FLOW[index + 1] ?? null) : null;
}
