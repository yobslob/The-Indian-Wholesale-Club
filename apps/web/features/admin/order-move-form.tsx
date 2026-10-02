import { moveOrderAction } from './actions/orders';
import { button, Field, input, utc } from './ui';

interface CycleOption {
  id: string;
  code: string;
  status: string;
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

/**
 * flows.md §6b, D-045: put an order in the cycle it really travels with. Earlier: the customer is told nothing until
 * the move is confirmed on the cycle (then the D-064 offer). Later: the window changes and the customer sees it.
 */
export function OrderMoveForm({
  order,
  cycles,
  moves,
}: {
  order: { id: string; status: string; cycle_id: string | null };
  cycles: CycleOption[];
  moves: Move[];
}): React.JSX.Element {
  const targets = cycles.filter((c) => ACCEPTING.includes(c.status) && c.id !== order.cycle_id);
  const current = cycles.find((c) => c.id === order.cycle_id);
  return (
    <div className="border-line space-y-2 rounded-md border p-3">
      <h2 className="font-medium">Cycle {current?.code ?? '—'}</h2>
      {MOVABLE.includes(order.status) && targets.length > 0 ? (
        <form action={moveOrderAction.bind(null, order.id)} className="space-y-2">
          <Field label="Move the whole order to">
            <select name="toCycleId" required className={input}>
              {targets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} ({c.status}, cutoff {utc(c.cutoff_at)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Internal note">
            <input name="note" className={input} placeholder="Squeezed into the earlier export" />
          </Field>
          <p className="text-ink-muted text-xs">
            Earlier: nothing changes for the customer until you confirm it left, on the cycle page. Later: the delivery
            window moves and the customer sees it.
          </p>
          <button type="submit" className={button}>
            Move order
          </button>
        </form>
      ) : (
        <p className="text-ink-muted text-sm">It can move only before it leaves India.</p>
      )}
      {moves.length > 0 ? (
        <ul className="text-ink-muted space-y-1 text-sm">
          {moves.map((m) => (
            <li key={m.id}>
              {utc(m.moved_at)} · {m.from_cycle?.code} → {m.to_cycle?.code} ({m.earlier ? 'earlier' : 'later'})
              {m.shipped_confirmed_at ? ' · confirmed shipped' : ''}
              {m.offer_status !== 'none' ? ` · offer ${m.offer_status}` : ''}
              {m.note ? ` · ${m.note}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
