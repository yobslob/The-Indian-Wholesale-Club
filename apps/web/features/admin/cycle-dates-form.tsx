import { isoToZoned, ZONES, deskOrder } from '@repo/shared/admin';

import { updateCycleDatesAction } from './actions/cycles';
import { button, Field, input, myDesk } from './ui';

interface CycleDates {
  id: string;
  status: string;
  cutoff_at: string;
  est_export_on: string | null;
  est_arrival_on: string;
}

/** D-045 / D-063: the dates a cycle opened with by itself are a guess to correct. The cutoff only while open. */
export async function CycleDatesForm({ cycle }: { cycle: CycleDates }): Promise<React.JSX.Element | null> {
  const desk = await myDesk();
  if (['arrived', 'fulfilling', 'closed'].includes(cycle.status)) return null;
  const open = cycle.status === 'open';
  return (
    <form
      action={updateCycleDatesAction.bind(null, cycle.id)}
      className="border-line bg-paper grid gap-3 rounded-[14px] border px-[18px] py-4 sm:grid-cols-3"
    >
      <h2 className="font-heading text-[15px] font-semibold sm:col-span-3">Dates</h2>
      {open ? (
        <Field label={`Cutoff (${ZONES[deskOrder(desk)[0]].place} time)`}>
          <input
            name="cutoffAt"
            type="datetime-local"
            required
            defaultValue={isoToZoned(cycle.cutoff_at, desk)}
            className={input}
          />
        </Field>
      ) : null}
      <Field label="Estimated export">
        <input name="estExportOn" type="date" defaultValue={cycle.est_export_on ?? ''} className={input} />
      </Field>
      <Field label="Estimated arrival in the US">
        <input name="estArrivalOn" type="date" required defaultValue={cycle.est_arrival_on} className={input} />
      </Field>
      <p className="text-ink-muted text-sm sm:col-span-3">
        Orders keep the delivery window they were promised. A later arrival means telling those customers (delay
        notice).
      </p>
      <div className="sm:col-span-3">
        <button type="submit" className={button}>
          Save dates
        </button>
      </div>
    </form>
  );
}
