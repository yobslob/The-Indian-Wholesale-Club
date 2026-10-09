import Link from 'next/link';

import { listCycles } from '@repo/db/admin';

import { createCycleAction } from '@/features/admin/actions/cycles';
import { Chip, CYCLE_STATUS } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { deskOrder, shortDate, ZONES } from '@/features/admin/time';
import { button, Cell, Field, input, PageHead, Table, When } from '@/features/admin/ui';

/**
 * Cycles (flows.md §1): one open at a time (INV-5). Each closes at its cutoff and the next opens by itself (D-045,
 * D-063); an admin opens one here only when none is open (the first, or after a pause).
 */
export default async function CyclesPage(): Promise<React.JSX.Element> {
  const { client, desk } = await requireAdminPage();
  const cycles = await listCycles(client, 30);
  const hasOpen = cycles.some((c) => c.status === 'open');

  return (
    <div className="space-y-6">
      <PageHead title="Cycles" sub="One open at a time; each closes at its cutoff and the next opens by itself." />
      <Table head={['Code', 'Status', 'Cutoff', 'Est. export', 'Est. arrival']}>
        {cycles.map((c) => (
          <tr key={c.id}>
            <Cell>
              <Link href={`/admin/cycles/${c.id}`} className="font-semibold">
                {c.code}
              </Link>
            </Cell>
            <Cell>
              <Chip tone={CYCLE_STATUS[c.status][1]}>{CYCLE_STATUS[c.status][0]}</Chip>
            </Cell>
            <Cell><When iso={c.cutoff_at} /></Cell>
            <Cell>{shortDate(c.est_export_on)}</Cell>
            <Cell>{shortDate(c.est_arrival_on)}</Cell>
          </tr>
        ))}
      </Table>

      {hasOpen ? (
        <p className="text-ink-muted">
          A cycle is open. At its cutoff it closes and the next one opens by itself, with its dates moved forward by
          the days between cutoffs (Settings). Correct them on the cycle.
        </p>
      ) : (
        <form action={createCycleAction} className="border-line bg-paper grid max-w-md gap-3 rounded-[14px] border px-[18px] py-4">
          <h2 className="font-heading text-[15px] font-semibold">Open a new cycle</h2>
          <Field label="Code">
            <input name="code" required className={input} placeholder="2026-10-A" />
          </Field>
          <Field label={`Cutoff (${ZONES[deskOrder(desk)[0]].place} time)`}>
            <input name="cutoffAt" type="datetime-local" required className={input} />
          </Field>
          <Field label="Estimated export date">
            <input name="estExportOn" type="date" className={input} />
          </Field>
          <Field label="Estimated arrival in the US">
            <input name="estArrivalOn" type="date" required className={input} />
          </Field>
          <button type="submit" className={button}>
            Open cycle
          </button>
        </form>
      )}
    </div>
  );
}
