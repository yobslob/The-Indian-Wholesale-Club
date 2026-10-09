import Link from 'next/link';
import { notFound } from 'next/navigation';

import { listCycleMoves, listCycles, listPickups } from '@repo/db/admin';
import { nextCycleStatus, type CycleStatus } from '@repo/shared/domain';

import { advanceCycleAction, cutoffCycleAction } from '@/features/admin/actions/cycles';
import { ArrivalList } from '@/features/admin/arrival-list';
import { Chip, CYCLE_STATUS } from '@/features/admin/chips';
import { ConfirmButton } from '@/features/admin/confirm';
import { CycleDatesForm } from '@/features/admin/cycle-dates-form';
import { CycleExportForm } from '@/features/admin/cycle-export-form';
import { CycleFlow } from '@/features/admin/cycle-flow';
import { CycleMoves } from '@/features/admin/cycle-moves';
import { requireAdminPage } from '@/features/admin/guard';
import { PickupCards, Progress } from '@/features/admin/pickup-cards';
import { shortDate } from '@/features/admin/time';
import { button, FilterChips, PageHead, Panel, secondaryButton, When } from '@/features/admin/ui';

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ show?: string }>;

/** The one next step of a cycle, as its main button says it (D-096). */
const NEXT_LABEL: Partial<Record<CycleStatus, string>> = {
  packed: 'Mark packed',
  exported: 'Mark exported',
  arrived: 'Mark arrived',
  fulfilling: 'Start fulfilling',
  closed: 'Close the cycle',
};

/**
 * One cycle (D-096): its progress from Open to Closed with the next step as the main button, then the pickups as one
 * card per shop (Call, WhatsApp, Map, how far along, Picked / Unavailable per piece) filtered To pick · All ·
 * Unavailable; below, its dates, export details, arrival check-off and moved orders.
 */
export default async function CyclePage({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client, desk } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [cycles, pickups, moves] = await Promise.all([listCycles(client, 100), listPickups(client, id), listCycleMoves(client, id)]);
  const cycle = cycles.find((c) => c.id === id);
  if (!cycle) notFound();

  const next = nextCycleStatus(cycle.status);
  const picked = pickups.filter((p) => p.status === 'picked').length;
  const gone = pickups.filter((p) => p.status === 'unavailable').length;
  const toGo = pickups.length - picked - gone;
  const shops = new Set(pickups.map((p) => p.vendor?.id)).size;
  const { show: asked } = await searchParams;
  const show = asked === 'all' || asked === 'unavailable' || asked === 'topick' ? asked : toGo > 0 ? 'topick' : 'all';
  const pendingShops = new Set(pickups.filter((p) => p.status === 'pending').map((p) => p.vendor?.id));
  const shown =
    show === 'unavailable' ? pickups.filter((p) => p.status === 'unavailable') : show === 'topick' ? pickups.filter((p) => pendingShops.has(p.vendor?.id)) : pickups;
  const base = `/admin/cycles/${cycle.id}`;

  return (
    <>
      <PageHead
        back={{ href: '/admin/cycles', label: 'Cycles' }}
        code
        title={`Cycle ${cycle.code}`}
        sub={
          <>
            <Chip tone={CYCLE_STATUS[cycle.status][1]}>{CYCLE_STATUS[cycle.status][0]}</Chip>
            <span>
              · {cycle.status === 'open' ? 'cutoff' : 'cut off'} <When iso={cycle.cutoff_at} inline />
              {cycle.est_export_on ? ` · export est. ${shortDate(cycle.est_export_on)}` : ''} · arrival est. {shortDate(cycle.est_arrival_on)}
            </span>
          </>
        }
        actions={
          <>
            {picked > 0 ? (
              <Link href={`${base}/documents`} className={secondaryButton}>
                Documents
              </Link>
            ) : null}
            {!['open', 'collecting'].includes(cycle.status) ? (
              <a href="#export" className={secondaryButton}>
                Export details
              </a>
            ) : null}
            {cycle.status === 'open' ? (
              <ConfirmButton
                label="Cut off now…"
                className={button}
                title={`Cut off ${cycle.code} now?`}
                confirm="Cut off now"
                danger={false}
                action={cutoffCycleAction.bind(null, cycle.id)}
              >
                It closes ordering for this cycle, makes the pickup lists for the shops, tells its customers their order is being prepared, and
                opens the next cycle. It closes by itself at its cutoff anyway.
              </ConfirmButton>
            ) : next && NEXT_LABEL[next] ? (
              <form action={advanceCycleAction.bind(null, cycle.id)}>
                <button type="submit" className={button}>
                  {NEXT_LABEL[next]} →
                </button>
              </form>
            ) : null}
          </>
        }
      />
      {cycle.notes ? <p className="text-ink-muted -mt-2 mb-4 text-[14px]">{cycle.notes}</p> : null}
      <Panel className="mb-4">
        <CycleFlow cycle={cycle} desk={desk} variant="stepper" />
      </Panel>

      {pickups.length > 0 ? (
        <section aria-labelledby="pickups" className="mb-6">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <h2 id="pickups" className="font-heading text-[19px] font-semibold">
                Pickups
              </h2>
              <p className="text-ink-muted mt-1 text-[14px]">
                {picked} of {pickups.length} picked{gone ? ` · ${gone} unavailable` : ''} · {toGo} to go · {shops} shop{shops === 1 ? '' : 's'}
              </p>
            </div>
            <div className="md:ml-auto">
              <FilterChips
                items={[
                  { href: `${base}?show=topick`, label: 'To pick', count: toGo, on: show === 'topick' },
                  { href: `${base}?show=all`, label: 'All', count: pickups.length, on: show === 'all' },
                  { href: `${base}?show=unavailable`, label: 'Unavailable', count: gone, on: show === 'unavailable' },
                ]}
              />
            </div>
          </div>
          <p className="mb-4 flex">
            <Progress done={picked} gone={gone} total={pickups.length} />
          </p>
          {shown.length > 0 ? <PickupCards pickups={shown} cycleId={cycle.id} /> : <p className="text-ink-muted">Nothing here.</p>}
        </section>
      ) : cycle.status !== 'open' ? (
        <p className="text-ink-muted mb-6">No pickups in this cycle.</p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <CycleDatesForm cycle={cycle} />
        <div id="export" className="scroll-mt-20 empty:hidden">
          <CycleExportForm cycle={cycle} />
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        <ArrivalList cycle={cycle} pickups={pickups} />
        <CycleMoves cycle={cycle} moves={moves} />
      </div>
    </>
  );
}
