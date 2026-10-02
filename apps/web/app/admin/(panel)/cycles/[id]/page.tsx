import { notFound } from 'next/navigation';

import { listCycleMoves, listCycles, listPickups } from '@repo/db/admin';
import { nextCycleStatus } from '@repo/shared/domain';

import {
  advanceCycleAction,
  cutoffCycleAction,
  markPickupAction,
} from '@/features/admin/actions/cycles';
import { CycleDatesForm } from '@/features/admin/cycle-dates-form';
import { CycleMoves } from '@/features/admin/cycle-moves';
import { requireAdminPage } from '@/features/admin/guard';
import { button, PageTitle, rupees, utc } from '@/features/admin/ui';

type Params = Promise<{ id: string }>;

/** One cycle: timeline actions and the per-shop pickup checklists (admin.md: one screen per job). */
export default async function CyclePage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [cycles, pickups, moves] = await Promise.all([
    listCycles(client, 100),
    listPickups(client, id),
    listCycleMoves(client, id),
  ]);
  const cycle = cycles.find((c) => c.id === id);
  if (!cycle) notFound();

  const byVendor = new Map<
    string,
    { name: string; phone: string | null; town: string | null; rows: typeof pickups }
  >();
  for (const p of pickups) {
    const key = p.vendor?.id ?? 'unknown';
    const group = byVendor.get(key) ?? {
      name: p.vendor?.shop_name ?? 'Unknown shop',
      phone: p.vendor?.phone ?? null,
      town: p.vendor?.town ?? null,
      rows: [],
    };
    group.rows.push(p);
    byVendor.set(key, group);
  }
  const next = nextCycleStatus(cycle.status);

  return (
    <div className="space-y-6">
      <PageTitle>Cycle {cycle.code}</PageTitle>
      <p>
        {cycle.status} · cutoff {utc(cycle.cutoff_at)} · est. export {cycle.est_export_on ?? '—'} ·
        est. arrival {cycle.est_arrival_on}
      </p>
      {cycle.notes ? <p className="text-ink-muted">{cycle.notes}</p> : null}
      {cycle.status === 'open' ? (
        <form action={cutoffCycleAction.bind(null, cycle.id)}>
          <button type="submit" className={button}>
            Cut off now (closes ordering, creates pickups, opens the next cycle)
          </button>
        </form>
      ) : next ? (
        <form action={advanceCycleAction.bind(null, cycle.id)}>
          <button type="submit" className={button}>
            Move to “{next}”
          </button>
        </form>
      ) : null}
      <CycleDatesForm cycle={cycle} />
      <CycleMoves cycle={cycle} moves={moves} />

      {[...byVendor.entries()].map(([vendorId, group]) => (
        <section key={vendorId} className="border-line space-y-2 rounded-md border p-3">
          <h2 className="font-medium">
            {group.name}
            <span className="text-ink-muted ml-2 font-normal">
              {[group.town, group.phone].filter(Boolean).join(' · ')}
            </span>
          </h2>
          <ul className="divide-line divide-y">
            {group.rows.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1">
                  {p.item?.product_name} · {p.variant?.label} × {p.quantity} ·{' '}
                  {rupees(p.shop_price_paise)}
                </span>
                {p.status === 'pending' ? (
                  <>
                    <form action={markPickupAction.bind(null, p.id, 'picked', cycle.id)}>
                      <button type="submit" className={button}>
                        Picked
                      </button>
                    </form>
                    <form action={markPickupAction.bind(null, p.id, 'unavailable', cycle.id)}>
                      <button type="submit" className="min-h-11 underline">
                        Unavailable
                      </button>
                    </form>
                  </>
                ) : (
                  <span className={p.status === 'unavailable' ? 'text-caution' : 'text-positive'}>
                    {p.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {pickups.length === 0 && cycle.status !== 'open' ? (
        <p className="text-ink-muted">No pickups in this cycle.</p>
      ) : null}
    </div>
  );
}
