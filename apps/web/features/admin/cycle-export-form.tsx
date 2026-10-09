import { updateCycleExportAction } from './actions/cycles';
import { button, Field, input } from './ui';

interface CycleExport {
  id: string;
  status: string;
  awb: string | null;
  forwarder: string | null;
  freight_cents: number | null;
  duty_cents: number | null;
  fx_inr_per_usd: number | null;
}

const dollars = (cents: number | null): string => (cents === null ? '' : (cents / 100).toFixed(2));

/** flows.md §6.2: the export's air waybill, forwarder and real costs, once it is being packed. */
export function CycleExportForm({ cycle }: { cycle: CycleExport }): React.JSX.Element | null {
  if (['open', 'collecting'].includes(cycle.status)) return null;
  const missing = !cycle.awb || !cycle.forwarder;
  return (
    <form
      action={updateCycleExportAction.bind(null, cycle.id)}
      className="border-line bg-paper grid gap-3 rounded-[14px] border px-[18px] py-4 sm:grid-cols-3"
    >
      <h2 className="font-heading text-[15px] font-semibold sm:col-span-3">Export</h2>
      {missing && cycle.status !== 'packed' ? (
        <p className="text-caution text-sm sm:col-span-3">The air waybill or the forwarder is not recorded yet.</p>
      ) : null}
      <Field label="Air waybill (AWB)">
        <input name="awb" defaultValue={cycle.awb ?? ''} className={input} />
      </Field>
      <Field label="Forwarder">
        <input name="forwarder" defaultValue={cycle.forwarder ?? ''} className={input} />
      </Field>
      <Field label="Exchange rate (₹ per $)">
        <input
          name="fx"
          type="number"
          step="0.0001"
          min="0"
          defaultValue={cycle.fx_inr_per_usd ?? ''}
          className={input}
        />
      </Field>
      <Field label="Freight paid ($)">
        <input name="freight" type="number" step="0.01" min="0" defaultValue={dollars(cycle.freight_cents)} className={input} />
      </Field>
      <Field label="Duty paid ($)">
        <input name="duty" type="number" step="0.01" min="0" defaultValue={dollars(cycle.duty_cents)} className={input} />
      </Field>
      <div className="self-end">
        <button type="submit" className={button}>
          Save export details
        </button>
      </div>
    </form>
  );
}
