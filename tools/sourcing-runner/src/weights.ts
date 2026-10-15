import {
  isSameItem,
  pieceWeight,
  wantsWeight,
  weightsFromOwnPage,
  weightsFromSimilar,
  type WeightPlanListing,
  type WeightWrite,
} from '@repo/shared/sourcing/auto';

import { readPage } from './find';
import { errorText, log } from './log';
import { shopFor } from './shops';

import type { RunContext } from './context';
import type { WeightReading } from '@repo/shared/sourcing';

/**
 * D-129: weights for listings that have none (a price on a guessed weight loses the customer). For each listing the
 * plan names: its own shop pages first (the shop's statement), then the same item on the marketplaces that print
 * weights (Amazon, Flipkart), where at least two pages must agree. Nothing over a person's weight; what stays
 * missing waits in Products → Weights to check.
 */

/** Shops whose pages carry an item, package or net weight in their details. */
const WEIGHT_SHOPS = new Set(['amazon', 'flipkart']);

async function ownPage(ctx: RunContext, listing: WeightPlanListing): Promise<WeightWrite[]> {
  const pages = [
    ...new Set(
      listing.sources
        .filter((s) => !listing.site || s.site === listing.site)
        .map((s) => s.page_url)
        .concat(listing.page_url ? [listing.page_url] : []),
    ),
  ].slice(0, 2);
  const out = new Map<string, WeightWrite>();
  for (const url of pages) {
    const site = listing.site ?? new URL(url).hostname.replace(/^www\./, '');
    const read = await readPage(ctx, site, url);
    if (!read?.product) continue;
    for (const w of weightsFromOwnPage(listing, read.product)) if (!out.has(w.variant_id)) out.set(w.variant_id, w);
  }
  return [...out.values()];
}

async function elsewhere(ctx: RunContext, listing: WeightPlanListing): Promise<WeightWrite[]> {
  const shops = ctx.plan.shops.filter(
    (s) => s.reader && WEIGHT_SHOPS.has(s.reader) && s.product_types.includes(listing.product_type),
  );
  const found: { site: string; title: string; reading: WeightReading }[] = [];
  for (const shop of shops) {
    try {
      const offers = (await shopFor(shop.reader).search(ctx.lanes.of(shop.site), listing.name)).filter((o) =>
        isSameItem(listing.name, o.title),
      );
      ctx.stats.page(shop.site);
      for (const offer of offers.slice(0, 2)) {
        const read = await readPage(ctx, shop.site, offer.url);
        const reading = read?.product ? pieceWeight(read.product, listing.product_type) : null;
        if (reading) found.push({ site: shop.site, title: read!.product!.title, reading });
      }
    } catch (error) {
      ctx.stats.page(shop.site, error);
      log(`  ${shop.site}: weight search failed: ${errorText(error)}`);
    }
  }
  return weightsFromSimilar(listing, found);
}

/** Fills what it can; returns how many options got a weight. */
export async function fillWeights(ctx: RunContext, limit: number): Promise<number> {
  if (!ctx.db) return 0;
  const plan = await ctx.db.weightPlan(limit);
  if (plan.length) log(`weights: ${plan.length} listing${plan.length === 1 ? '' : 's'} without a sure weight`);
  let filled = 0;
  for (const listing of plan) {
    try {
      const own = await ownPage(ctx, listing);
      const covered = new Set(own.map((w) => w.variant_id));
      const stillMissing = listing.variants.some((v) => wantsWeight(v) && !covered.has(v.id));
      const similar = stillMissing
        ? (await elsewhere(ctx, listing)).filter((w) => !covered.has(w.variant_id))
        : [];
      const writes = [...own, ...similar];
      const n = writes.length ? await ctx.db.setWeights(writes) : 0;
      filled += n;
      log(
        `  "${listing.name.slice(0, 60)}": ${n ? `${n} weight${n === 1 ? '' : 's'} (${writes.map((w) => `${w.weight_g} g ${w.source}`).join(', ')})` : 'no weight found: weigh it at the hub'}`,
      );
    } catch (error) {
      log(`  "${listing.name.slice(0, 60)}": ${errorText(error)}`);
    }
  }
  return filled;
}
