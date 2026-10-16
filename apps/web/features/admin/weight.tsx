import {
  estimateDisagrees,
  formatGrams,
  unusualWeight,
  WEIGHT_SOURCE_LABEL,
  weightState,
  WEIGHT_SOURCES,
  type ProductType,
  type WeightSource,
} from '@repo/shared/domain';

import { setWeightAction, setWeightForSizesAction } from './actions/weights';
import { Chip } from './chips';
import { Sub } from './ui';

/**
 * D-129: every option's weight on the admin screens, with where it came from. The price rests on it (D-128), so a
 * missing one says what the listing is priced on until it has one, and a weight to check says why.
 */

interface WeightRow {
  weight_g: number | null;
  weight_source: string | null;
  /** D-131: the weight estimator's latest weight and note. */
  weight_estimate_g?: number | null;
  weight_estimate_note?: string | null;
}

/** What the estimator thinks, when it adds something: a suggestion for a missing weight, or a doubt. */
function EstimateLine({ v }: { v: WeightRow }): React.JSX.Element | null {
  if (v.weight_estimate_g == null || v.weight_source === 'estimated') return null;
  const lead =
    v.weight_g === null
      ? `Estimator suggests ${formatGrams(v.weight_estimate_g)}`
      : estimateDisagrees(v)
        ? `The estimator says ${formatGrams(v.weight_estimate_g)}`
        : null;
  if (!lead) return null;
  return (
    <Sub>
      {lead}
      {v.weight_estimate_note ? `: ${v.weight_estimate_note}` : ''}
    </Sub>
  );
}

const isSource = (s: string | null): s is WeightSource => WEIGHT_SOURCES.includes(s as WeightSource);

/** "450 g · Weighed", "No weight · its price is an estimate", "90 g · unusual for its category". */
export function WeightBadge({
  v,
  type,
  categoryWeightG,
  note,
}: {
  v: WeightRow;
  type: ProductType;
  categoryWeightG: number | null;
  note?: string | null;
}): React.JSX.Element {
  if (v.weight_g === null)
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Chip tone="bad">No weight</Chip>
        <Sub>its price is an estimate until it has one; it cannot go live</Sub>
        {note ? <Sub>{note}</Sub> : null}
        <EstimateLine v={v} />
      </span>
    );
  const unusual = unusualWeight(v.weight_g, type, categoryWeightG);
  const state = weightState(v, unusual || estimateDisagrees(v));
  const from = isSource(v.weight_source) ? WEIGHT_SOURCE_LABEL[v.weight_source] : 'Source not recorded';
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Chip tone={state === 'confirmed' ? 'ok' : 'warn'}>{formatGrams(v.weight_g)}</Chip>
      <Sub>
        {from}
        {unusual && categoryWeightG ? ` · unusual (its category is usually ${formatGrams(categoryWeightG)})` : ''}
      </Sub>
      {note ? <Sub>{note}</Sub> : null}
      <EstimateLine v={v} />
    </span>
  );
}

/**
 * One option's weight: grams, "weighed on a scale", an optional note. One weighed at the hub is replaced only by a
 * new weighing (D-133: the hub's scale first, then an admin's typed weight, then the system).
 */
export function WeightForm({
  productId,
  variantId,
  grams,
  label,
  weighed = false,
}: {
  productId: string;
  variantId: string;
  grams: number | null;
  label: string;
  /** Its weight was weighed at the hub. */
  weighed?: boolean;
}): React.JSX.Element {
  return (
    <form action={setWeightAction.bind(null, productId, variantId)} className="flex flex-wrap items-center gap-2">
      <WeightFields grams={grams} label={label} weighed={weighed} />
    </form>
  );
}

/** Every size and colour of one piece at once (packs keep their own). */
export function SizesWeightForm({
  productId,
  variantIds,
}: {
  productId: string;
  variantIds: string[];
}): React.JSX.Element {
  return (
    <form
      action={setWeightForSizesAction.bind(null, productId, variantIds)}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-sm font-semibold">All {variantIds.length} sizes and colours:</span>
      <WeightFields grams={null} label="every size and colour" />
    </form>
  );
}

function WeightFields({
  grams,
  label,
  weighed = false,
}: {
  grams: number | null;
  label: string;
  weighed?: boolean;
}): React.JSX.Element {
  return (
    <>
      <input
        name="grams"
        type="number"
        min="1"
        max="50000"
        required
        defaultValue={grams ?? undefined}
        aria-label={`Weight in grams, ${label}`}
        placeholder="g"
        className="border-line min-h-11 w-24 rounded-sm border px-2 text-right"
      />
      <label className="flex min-h-11 items-center gap-1.5 text-sm">
        {weighed ? (
          <>
            <input type="hidden" name="weighed" value="on" /> weighed again on a scale (a weighed weight is replaced only by a new weighing)
          </>
        ) : (
          <>
            <input type="checkbox" name="weighed" /> weighed on a scale
          </>
        )}
      </label>
      <input
        name="note"
        maxLength={200}
        placeholder="note (packed in its box)"
        aria-label={`Weight note, ${label}`}
        className="border-line min-h-11 w-48 rounded-sm border px-2"
      />
      <button type="submit" className="min-h-11 underline">
        Save weight
      </button>
    </>
  );
}

/** A listing's options that share one weight: sizes and colours, never packs, nor one weighed at the hub (D-133). */
export function sizeOptions(
  variants: { id: string; options: unknown; is_active: boolean; weight_source?: string | null }[],
): string[] {
  return variants
    .filter(
      (v) =>
        v.is_active && v.weight_source !== 'weighed' && !(v.options && typeof v.options === 'object' && 'pack' in v.options),
    )
    .map((v) => v.id);
}
