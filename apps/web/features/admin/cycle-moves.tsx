import Link from 'next/link';

import { formatUsd } from '@repo/shared/domain';

import { confirmMoveShippedAction } from './actions/cycles';
import { button, When } from './ui';

interface Move {
  id: string;
  order_id: string;
  earlier: boolean;
  moved_at: string;
  shipped_confirmed_at: string | null;
  offer_status: string;
  offer_cents: number | null;
  from_cycle: { code: string } | null;
  order: { order_number: string; cycle_id: string | null } | null;
}

const EXPORTED = ['exported', 'arrived', 'fulfilling', 'closed'];

/**
 * Orders moved into this cycle (D-045). Once the export has left, the admin confirms each really went with it; an
 * earlier one is then offered faster delivery (D-064) when its price is set in Settings.
 */
export function CycleMoves({
  cycle,
  moves,
}: {
  cycle: { id: string; status: string };
  moves: Move[];
}): React.JSX.Element | null {
  const current = moves.filter((m) => m.order?.cycle_id === cycle.id);
  if (current.length === 0) return null;
  const exported = EXPORTED.includes(cycle.status);
  return (
    <section className="border-line space-y-2 rounded-md border p-3">
      <h2 className="font-medium">Orders moved into this cycle</h2>
      <ul className="divide-line divide-y">
        {current.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1">
              <Link href={`/admin/orders/${m.order_id}`} className="underline">
                {m.order?.order_number}
              </Link>{' '}
              from {m.from_cycle?.code} ({m.earlier ? 'earlier' : 'later'}) · <When iso={m.moved_at} inline />
            </span>
            {m.shipped_confirmed_at ? (
              <span className="text-positive">
                left with this export
                {m.offer_status === 'offered' && m.offer_cents
                  ? ` · offered faster delivery for ${formatUsd(m.offer_cents)}`
                  : m.offer_status !== 'none'
                    ? ` · offer ${m.offer_status}`
                    : ''}
              </span>
            ) : exported ? (
              <form action={confirmMoveShippedAction.bind(null, m.id, cycle.id)}>
                <button type="submit" className={button}>
                  It left with this export
                </button>
              </form>
            ) : (
              <span className="text-ink-muted text-sm">confirm once the export has left</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
