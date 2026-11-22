import { writeFileSync } from 'node:fs';

import { autoPrice, formatGrams } from '@repo/shared/domain';
import { labelMatches, labelSummary, type LabelResult } from '@repo/shared/sourcing/estimate';

/**
 * D-202: the label reader's sheet (label-weights.csv, label-eval.csv), rewritten after every page so a run that stops
 * keeps what it read, and the closing summary: what was read, what the checks held back and why, and the drops to
 * look at before writing (one pack's label on a listing of several lowers its weight, so its price).
 */

const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
const usd = (cents: number | null | undefined): string =>
  cents == null ? '' : `$${(cents / 100).toFixed(2)}`;

/** The weight before, for the change: the option's own, or the listing's only active one's. */
const before = (r: LabelResult) => r.variant ?? r.listing.variants.find((x) => x.is_active) ?? null;

/** The change in percent from the weight before, or null. */
export function change(r: LabelResult): number | null {
  const g = before(r)?.weight_g;
  return g && r.grams ? Math.round(((r.grams - g) * 100) / g) : null;
}

/** A drop this large is the sign of one pack's label on a listing of several packs (Saritas: 1 kg read as 500 g). */
export const BIG_DROP = -40;

/** The result's kind, for counting: the reasons without their numbers. */
export function kind(result: string): string {
  if (result === 'read') return 'read';
  if (result.startsWith('may hold several packs')) return 'held: may hold several packs';
  if (result.startsWith('the name says')) return "held: the name's weight differs";
  if (result.startsWith('price check doubts')) return 'held: the price check doubts it';
  if (result.startsWith('only one reader')) return 'only one reader found it';
  if (result.startsWith('the readers disagree')) return 'the readers disagree';
  return result;
}

export function summary(rows: LabelResult[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(kind(r.result), (counts.get(kind(r.result)) ?? 0) + 1);
  const read = rows.filter((r) => r.result === 'read');
  const changes = read.map(change);
  const drops = changes.filter((c) => c !== null && c <= BIG_DROP).length;
  const same = changes.filter((c) => c !== null && Math.abs(c) <= 2).length;
  const up = changes.filter((c) => c !== null && c > 2).length;
  const down = changes.filter((c) => c !== null && c < -2).length;
  const kinds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${k}`)
    .join(', ');
  return (
    `${rows.length} options: ${kinds}. Of the ${read.length} read: ${same} keep their weight, ${up} go up, ` +
    `${down} go down (${drops} by over ${-BIG_DROP}%: look at those first), ${read.length - same - up - down} had none.`
  );
}

export function writeSheet(file: string, rows: LabelResult[], evaluate: boolean): void {
  const head = [
    'Listing',
    'Category',
    'Option',
    'Weight before',
    'Source before',
    'Label says',
    'New weight',
    'Change',
    'Price before',
    'Price after',
    ...(evaluate ? ['Matches'] : []),
    'Result',
    'Photo',
  ];
  const lines = rows.map((r) => {
    const v = before(r);
    const shop = v?.shop_price_paise ?? r.listing.shop_price_paise;
    const price = (g: number | null | undefined) =>
      g && shop
        ? usd(autoPrice({ shopPricePaise: shop, weightG: g, productType: 'food' })?.priceCents)
        : '';
    const c = change(r);
    return [
      r.listing.name,
      r.listing.category,
      v?.label ?? '',
      v?.weight_g ? formatGrams(v.weight_g) : '',
      v?.weight_source ?? '',
      r.parts ? labelSummary(r) : '',
      r.grams ? formatGrams(r.grams) : '',
      c ? `${c > 0 ? '+' : ''}${c}%` : '',
      price(v?.weight_g),
      r.grams ? price(r.grams) : '',
      ...(evaluate ? [labelMatches(r)] : []),
      r.result,
      r.photo ?? '',
    ]
      .map(cell)
      .join(',');
  });
  writeFileSync(file, `\uFEFF${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`, 'utf8');
}
