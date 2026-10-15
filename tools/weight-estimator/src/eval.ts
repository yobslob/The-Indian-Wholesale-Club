import { randomUUID } from 'node:crypto';

import type { EstimateListing, ReferenceItem } from '@repo/shared/sourcing/estimate';

import { log, modelEnv } from './env';
import { estimateListing, groupText, pool, type Estimator } from './estimate';

import type { Db } from './db';

/**
 * How close the estimator comes (D-131). Each known weight is left out in turn and estimated from its name and
 * category alone (a real run also reads fabric, material and description, so it does at least this well):
 * weighed ones first, then typed, then the shops'. Then its record against the hub's scale: the estimates it made
 * before those pieces were weighed.
 */

const TRUST = { weighed: 0, admin: 1, shop: 2 } as const;

const pct = (n: number, of: number): string => (of ? `${Math.round((n / of) * 100)}%` : '—');

function report(label: string, errors: number[]): void {
  if (!errors.length) return log(`${label}: none`);
  const sorted = [...errors].sort((a, b) => a - b);
  const at = (q: number): number =>
    Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! * 100);
  log(
    `${label}: ${errors.length} items, typical error ${at(0.5)}%, 4 in 5 within ${at(0.8)}%; within 10% ` +
      `${pct(errors.filter((e) => e <= 0.1).length, errors.length)}, within 25% ${pct(errors.filter((e) => e <= 0.25).length, errors.length)}`,
  );
}

const asListing = (item: ReferenceItem): EstimateListing => ({
  product_id: item.productId,
  name: item.name,
  product_type: item.type,
  category: item.category,
  category_weight_g: null,
  summary: null,
  description: null,
  attributes: {},
  variants: [
    {
      id: randomUUID(),
      label: item.pack ?? 'One size',
      options: item.pack ? { pack: item.pack } : {},
      weight_g: null,
      weight_source: null,
      weight_note: null,
      wanted: true,
    },
  ],
});

export async function evaluate(db: Db, est: Estimator, limit: number): Promise<number> {
  const items = est.references
    .map((r) => r.item)
    .sort((a, b) => TRUST[a.source] - TRUST[b.source])
    .slice(0, limit);
  const all: number[] = [];
  const sure: number[] = [];
  const started = Date.now();
  const listings = items.map(asListing);
  await est.vectors.load(
    listings.map((l) =>
      groupText(l, {
        key: 'piece',
        label: '',
        pack: l.variants[0]!.options.pack ?? null,
        statedNetG: null,
        variantIds: [],
      }),
    ),
  );
  await pool(
    items.map((item, i) => ({ item, listing: listings[i]! })),
    modelEnv().IWC_WEIGHT_PARALLEL,
    async ({ item, listing }) => {
      const w = (await estimateListing(est, listing)).writes[0];
      if (!w) return;
      const error = Math.abs(w.weight_g - item.grams) / item.grams;
      all.push(error);
      if (w.sure) sure.push(error);
      log(
        `  ${error <= 0.25 ? 'ok ' : 'off'} ${item.grams} g (${item.source}) → ${w.weight_g} g${w.sure ? '' : ' (to check)'}: ${item.name.slice(0, 60)}`,
      );
    },
  );
  log(`eval: ${items.length} items in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  report('all estimates', all);
  report(`sure ones (${pct(sure.length, all.length)} were sure)`, sure);
  const scale = (await db.references()).filter(
    (r) => r.weight_source === 'weighed' && r.weight_estimate_g !== null,
  );
  report(
    'estimates made before the hub weighed the piece',
    scale.map((r) => Math.abs(r.weight_estimate_g! - r.weight_g) / r.weight_g),
  );
  return 0;
}
