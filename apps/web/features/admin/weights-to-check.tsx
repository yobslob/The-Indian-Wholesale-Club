import Link from 'next/link';

import { formatGrams, unusualWeight, weightState, type ProductType } from '@repo/shared/domain';

import { Chip, PRODUCT_STATUS, StatusChip } from './chips';
import { Cell, Empty, rupees, Table } from './ui';
import { SizesWeightForm, sizeOptions, WeightBadge, WeightForm } from './weight';

import type { WeightToCheck } from '@repo/db/admin';

/**
 * D-129: Products → Weights to check. Each listing with an option that has no weight (not sold until it has one), a
 * weight from a matching item, one recorded before sources were kept, or one unusual for its category; live ones
 * first. A shop's weight the weight estimator doubts is listed too (D-131). Weigh it or type it here: the price
 * follows (D-128); a missing weight's box holds the estimator's suggestion, so Save weight accepts it.
 */
export function WeightsToCheck({ rows, missing }: { rows: WeightToCheck[]; missing: number }): React.JSX.Element {
  if (!rows.length) return <Empty>Every listing has a weight it can be priced on.</Empty>;
  return (
    <div className="space-y-3">
      <p className="text-ink-muted text-sm">
        {missing ? `${missing} listing${missing === 1 ? '' : 's'} without a weight cannot go live. ` : ''}
        The price comes from the weight, so a guessed weight is a guessed price. Weigh the piece packed (tick “weighed”),
        or type the weight the shop states; the auto-sourcing runner fills what it can read from the shops, and the
        weight estimator fills the ones it is sure of and suggests the rest.
      </p>
      <Table head={['Product', 'Option', 'Weight now', 'Set it']}>
        {rows.flatMap((p) => {
          const sizes = sizeOptions(p.variants);
          return [
            ...p.variants.map((v, i) => (
              <tr key={v.id}>
                <Cell>
                  {i === 0 ? (
                    <>
                      <Link href={`/admin/catalog/${p.id}`} className="font-semibold">
                        {p.name}
                      </Link>{' '}
                      <StatusChip map={PRODUCT_STATUS} status={p.status} />
                      <span className="text-ink-muted block text-xs">
                        {p.category}
                        {p.category_weight_g ? `, usually ${formatGrams(p.category_weight_g)}` : ''}
                      </span>
                    </>
                  ) : null}
                </Cell>
                <Cell>
                  {v.label}
                  {v.is_active ? null : <span className="text-ink-muted ml-1 text-xs">(not selling)</span>}
                  {v.shop_price_paise ? <span className="text-ink-muted block text-xs">shop {rupees(v.shop_price_paise)}</span> : null}
                </Cell>
                <Cell>
                  <WeightBadge v={v} type={p.product_type} categoryWeightG={p.category_weight_g} note={v.weight_note} />
                </Cell>
                <Cell>
                  <WeightForm
                    productId={p.id}
                    variantId={v.id}
                    grams={v.weight_g ?? v.weight_estimate_g}
                    label={`${p.name}, ${v.label}`}
                  />
                </Cell>
              </tr>
            )),
            ...(sizes.length > 1
              ? [
                  <tr key={`${p.id}-sizes`}>
                    <Cell />
                    <Cell className="text-ink-muted text-sm">Same weight for all</Cell>
                    <Cell />
                    <Cell>
                      <SizesWeightForm productId={p.id} variantIds={sizes} />
                    </Cell>
                  </tr>,
                ]
              : []),
          ];
        })}
      </Table>
    </div>
  );
}

/** The Products list's Weight cell: the range of its options' weights, red when one has none. */
export function WeightSummary({
  variants,
  type,
  categoryWeightG,
}: {
  variants: { is_active: boolean; weight_g: number | null; weight_source: string | null }[];
  type: ProductType;
  categoryWeightG: number | null;
}): React.JSX.Element {
  const active = variants.filter((v) => v.is_active);
  if (!active.length) return <span className="text-ink-muted">—</span>;
  if (active.some((v) => v.weight_g === null)) return <Chip tone="bad">No weight</Chip>;
  const grams = active.map((v) => v.weight_g!);
  const lo = Math.min(...grams);
  const hi = Math.max(...grams);
  const check = active.some(
    (v) => weightState(v, unusualWeight(v.weight_g!, type, categoryWeightG)) !== 'confirmed',
  );
  return (
    <Chip tone={check ? 'warn' : 'ok'}>
      {lo === hi ? formatGrams(lo) : `${formatGrams(lo)} – ${formatGrams(hi)}`}
      {check ? ' · check' : ''}
    </Chip>
  );
}
