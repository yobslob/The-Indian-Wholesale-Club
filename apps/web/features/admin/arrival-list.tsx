import Link from 'next/link';

import { checkOffArrivalAction } from './actions/cycles';
import { button, linkButton } from './ui';

interface Pickup {
  id: string;
  status: string;
  quantity: number;
  arrived_at: string | null;
  variant: { label: string } | null;
  item: { product_name: string; order_id: string; order: { order_number: string } | null } | null;
}

/**
 * flows.md §6.3: once the export has arrived, the founder ticks off each order's picked pieces as they come out of
 * the box, order by order (the way they will be packed for the customer).
 */
export function ArrivalList({
  cycle,
  pickups,
}: {
  cycle: { id: string; status: string };
  pickups: Pickup[];
}): React.JSX.Element | null {
  if (!['arrived', 'fulfilling'].includes(cycle.status)) return null;
  const picked = pickups.filter((p) => p.status === 'picked');
  const byOrder = new Map<string, { number: string; rows: Pickup[] }>();
  for (const p of picked) {
    const key = p.item?.order_id ?? 'unknown';
    const group = byOrder.get(key) ?? { number: p.item?.order?.order_number ?? '—', rows: [] };
    group.rows.push(p);
    byOrder.set(key, group);
  }
  const done = picked.filter((p) => p.arrived_at).length;

  return (
    <section className="border-line space-y-3 rounded-md border p-3">
      <h2 className="font-medium">
        Arrival check-off · {done} of {picked.length} pieces
      </h2>
      {[...byOrder.entries()].map(([orderId, group]) => (
        <div key={orderId} className="space-y-1">
          <Link href={`/admin/orders/${orderId}`} className="font-medium underline">
            {group.number}
          </Link>
          <ul className="divide-line divide-y">
            {group.rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1">
                  {p.item?.product_name} · {p.variant?.label} × {p.quantity}
                </span>
                <form action={checkOffArrivalAction.bind(null, p.id, !p.arrived_at, cycle.id)}>
                  {p.arrived_at ? (
                    <button type="submit" className={linkButton}>
                      <span className="text-positive">Arrived</span> · undo
                    </button>
                  ) : (
                    <button type="submit" className={button}>
                      Arrived
                    </button>
                  )}
                </form>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
