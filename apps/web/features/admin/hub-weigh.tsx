import { weighPickupAction } from './actions/weights';

/**
 * D-130: weighing a piece at the hub. The scale's weight (one piece, packed) becomes its option's weight, the listing
 * is repriced for the next customer, and the pickup keeps what changed.
 */

/** The optional weight next to Picked: weighed as it is marked picked. */
export function PickedWeightInput({ label }: { label: string }): React.JSX.Element {
  return (
    <input
      name="grams"
      type="number"
      min="1"
      max="50000"
      inputMode="numeric"
      placeholder="g"
      title="Weight of one piece, packed (optional)"
      aria-label={`Weight of one piece, packed, in grams: ${label}`}
      className="border-line min-h-11 w-20 rounded-sm border px-2 text-right md:h-10 md:min-h-0"
    />
  );
}

/** A picked piece: what weighing it changed, or a form to weigh it. */
export function WeighPicked({
  pickupId,
  weighedG,
  note,
  label,
  path,
}: {
  pickupId: string;
  weighedG: number | null;
  note: string | null;
  label: string;
  path: string;
}): React.JSX.Element {
  if (weighedG)
    return <small className="text-ink-muted block text-[12.5px]">{note ?? `Weighed ${weighedG} g`}</small>;
  return (
    <form action={weighPickupAction.bind(null, pickupId, path)} className="flex items-center gap-1.5">
      <PickedWeightInput label={label} />
      <button type="submit" className="min-h-11 text-[13px] font-semibold underline md:min-h-0">
        Weigh it
      </button>
    </form>
  );
}
