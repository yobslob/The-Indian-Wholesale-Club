import { deskTimeLine } from '@repo/shared/admin';

import { moveOrderAction } from './actions/orders';
import { CYCLE_STATUS } from './chips';
import { FormButton } from './confirm';
import { Field, input, myDesk, When } from './ui';

import type { Enum } from '@repo/db';

interface CycleOption {
  id: string;
  code: string;
  status: Enum<'cycle_status'>;
  cutoff_at: string;
}
interface Move {
  id: string;
  earlier: boolean;
  moved_at: string;
  note: string | null;
  shipped_confirmed_at: string | null;
  offer_status: string;
  from_cycle: { code: string } | null;
  to_cycle: { code: string } | null;
}

const MOVABLE = ['confirmed', 'collecting', 'packed'];
const ACCEPTING = ['open', 'collecting', 'packed'];

/** Whether "Move to another cycle…" applies now: before it leaves India, with somewhere to go (D-096). */
export function canMove(order: { status: string; cycle_id: string | null }, cycles: CycleOption[]): boolean {
  return MOVABLE.includes(order.status) && cycles.some((c) => ACCEPTING.includes(c.status) && c.id !== order.cycle_id);
}

/**
 * flows.md §6b, D-045: put an order in the cycle it really travels with. Earlier: the customer is told nothing until
 * the move is confirmed on the cycle (then the D-064 offer). Later: the window changes and the customer sees it.
 */
export async function MoveOrderButton({
  order,
  cycles,
}: {
  order: { id: string; status: string; cycle_id: string | null };
  cycles: CycleOption[];
}): Promise<React.JSX.Element> {
  const desk = await myDesk();
  const targets = cycles.filter((c) => ACCEPTING.includes(c.status) && c.id !== order.cycle_id);
  return (
    <FormButton label="Move to another cycle…" title="Move to another cycle" submit="Move order" action={moveOrderAction.bind(null, order.id)}>
      <Field label="Move the whole order to">
        <select name="toCycleId" required className={input}>
          {targets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} ({CYCLE_STATUS[c.status][0]}, cutoff {deskTimeLine(c.cutoff_at, desk)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Internal note">
        <input name="note" className={input} placeholder="Squeezed into the earlier export" />
      </Field>
      <p className="text-ink-muted text-[13px]">
        Earlier: nothing changes for the customer until you confirm it left, on the cycle page. Later: the delivery window
        moves and the customer sees it.
      </p>
    </FormButton>
  );
}

/** The order's moves between cycles, for its timeline panel. */
export function MovesList({ moves }: { moves: Move[] }): React.JSX.Element | null {
  if (moves.length === 0) return null;
  return (
    <ul className="text-ink-muted mt-3 space-y-1 text-[13px]">
      {moves.map((m) => (
        <li key={m.id}>
          <When iso={m.moved_at} inline /> · moved {m.from_cycle?.code} → {m.to_cycle?.code} ({m.earlier ? 'earlier' : 'later'})
          {m.shipped_confirmed_at ? ' · confirmed shipped' : ''}
          {m.offer_status !== 'none' ? ` · offer ${m.offer_status}` : ''}
          {m.note ? ` · ${m.note}` : ''}
        </li>
      ))}
    </ul>
  );
}
