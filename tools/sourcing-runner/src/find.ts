import { randomUUID } from 'node:crypto';

import { listingSlug } from '@repo/shared/domain';
import {
  buildListing,
  pickCandidates,
  shopsFor,
  targetMatcher,
  type Candidate,
  type Offer,
  type SourcingTarget,
} from '@repo/shared/sourcing/auto';

import { shopOf, type RunContext } from './context';
import { errorText, log } from './log';
import { copyPhotos } from './photos';
import { shopFor, type PageRead } from './shops';

import type { SourcedProduct } from '@repo/shared/sourcing';

/**
 * One target (D-118): search every shop that sells its type (or only its own shops, D-121), side by side; keep the
 * results that are the target, in stock, fast enough and inside its price band; read the best pages until its number
 * of listings (else `listings_per_target`) are made. Each listing carries all
 * of its items (flavours, packs, colours and sizes) and the same product on other shops as backups.
 */

async function search(ctx: RunContext, target: SourcingTarget, want: number): Promise<Offer[]> {
  const shops = shopsFor(target, ctx.plan.shops);
  const hint = { minPaise: target.min_price_paise, maxPaise: target.max_price_paise, want };
  const found = await Promise.all(
    shops.map(async (shop) => {
      try {
        const offers = await shopFor(shop.reader).search(ctx.lanes.of(shop.site), target.query, hint);
        ctx.stats.page(shop.site);
        log(`  ${shop.site}: ${offers.length} result${offers.length === 1 ? '' : 's'}`);
        return offers;
      } catch (error) {
        ctx.stats.page(shop.site, error);
        log(`  ${shop.site}: search failed: ${errorText(error)}`);
        return [];
      }
    }),
  );
  return found.flat();
}

async function readPage(ctx: RunContext, site: string, url: string): Promise<PageRead | null> {
  try {
    const read = await shopFor(shopOf(ctx, site)?.reader ?? null).read(
      ctx.lanes.of(site),
      url,
      ctx.now,
    );
    ctx.stats.page(site);
    return read;
  } catch (error) {
    ctx.stats.page(site, error);
    log(`  ${site}: ${url} unread: ${errorText(error)}`);
    return null;
  }
}

/**
 * The product with its sibling pages read in: Myntra's other colours (their sizes join the variants) and Flipkart's
 * other options (each its own page with its own price). `pageOf` remembers where an item was read.
 */
async function withSiblings(
  ctx: RunContext,
  product: SourcedProduct,
  offer: Offer,
  maxDays: number,
) {
  const pageOf = new Map<string, string>();
  let variants = product.variants;
  for (const url of offer.siblings.slice(0, 6)) {
    const read = await readPage(ctx, offer.site, url);
    if (!read?.product) continue;
    const late = read.pageDays !== null && read.pageDays > maxDays;
    for (const v of read.product.variants) {
      if (variants.some((x) => x.key === v.key)) continue;
      pageOf.set(v.key, read.product.url);
      variants = [
        ...variants,
        {
          ...v,
          inStock: late ? false : v.inStock,
          image: v.image ?? read.product.images[0] ?? null,
        },
      ];
    }
  }
  const unpriced = variants
    .filter((v) => v.pricePaise === null && v.url !== product.url)
    .slice(0, 8);
  for (const v of unpriced) {
    const read = await readPage(ctx, offer.site, v.url);
    const own = read?.product?.variants.find((x) => x.key === v.key);
    const late = read?.pageDays !== null && read?.pageDays !== undefined && read.pageDays > maxDays;
    variants = variants.map((x) =>
      x.key === v.key && own
        ? {
            ...x,
            pricePaise: own.pricePaise,
            mrpPaise: own.mrpPaise,
            inStock: late ? false : own.inStock,
          }
        : x,
    );
  }
  return { product: { ...product, variants }, pageOf };
}

async function tryCandidate(
  ctx: RunContext,
  target: SourcingTarget,
  c: Candidate,
): Promise<string | null> {
  const s = ctx.plan.settings;
  const shop = shopOf(ctx, c.best.site);
  if (!shop) return `${c.best.site}: not an enabled shop`;
  log(`  reading ${c.best.site}: ${c.best.title.slice(0, 80)}`);
  const read = await readPage(ctx, c.best.site, c.best.url);
  if (!read?.product) return `${c.best.site}: page unreadable`;
  if (!targetMatcher(target).matches(read.product.title))
    return `${c.best.site}: page is not the target`;
  const { product, pageOf } = await withSiblings(ctx, read.product, c.best, s.max_delivery_days);
  const draft = buildListing({
    product,
    target,
    shop,
    pageDays: read.pageDays,
    family: [c.best, ...c.others.filter((o) => o.site === c.best.site)],
    others: c.others.filter((o) => o.site !== c.best.site),
    shops: ctx.plan.shops,
    maxDays: s.max_delivery_days,
    now: ctx.now,
    pageOf,
  });
  if ('skip' in draft) return `${c.best.site}: ${draft.skip}`;
  const listing = {
    ...draft.listing,
    slug: listingSlug(draft.listing.name, randomUUID().slice(0, 4)),
  };
  if (!ctx.db) {
    log(
      `  would add "${listing.name}" from ${listing.site}: ${listing.variants.map((v) => `${v.label} ₹${v.price_paise / 100}`).join(', ')}` +
        `${listing.backups.length ? `; backups ${listing.backups.map((b) => b.site).join(', ')}` : ''}${draft.complete ? '' : ' (details to finish)'}`,
    );
    return null;
  }
  const added = await ctx.db.add(target.id, listing);
  for (const v of listing.variants) ctx.known.add(`${listing.site}|${v.item_key}`);
  if (!added.created) return `${c.best.site}: already listed`;
  const media = await copyPhotos(ctx, added.product_id, draft.photos, listing.page_url);
  const published = media.length
    ? await ctx.db.media(added.product_id, media, draft.complete)
    : { published: false, note: 'no photo could be copied' };
  log(
    `  added "${listing.name}" (${listing.variants.length} variant${listing.variants.length === 1 ? '' : 's'}) from ${listing.site}` +
      `${published.published ? ', live' : ', draft'}${published.note ? ` (${published.note})` : ''}`,
  );
  return null;
}

export async function findForTarget(ctx: RunContext, target: SourcingTarget): Promise<number> {
  const s = ctx.plan.settings;
  const want = target.listings ?? s.listings_per_target;
  const band =
    target.min_price_paise || target.max_price_paise
      ? `, ₹${(target.min_price_paise ?? 0) / 100}–${target.max_price_paise ? target.max_price_paise / 100 : 'any'}`
      : '';
  log(`target "${target.name}" (${target.region ?? 'all states'}, ${target.category}${band})`);
  const offers = await search(ctx, target, want);
  const candidates = pickCandidates(target, offers, ctx.plan.shops, {
    maxDays: s.max_delivery_days,
    known: ctx.known,
    now: ctx.now,
    limit: want,
  });
  log(
    `  ${candidates.length} candidate${candidates.length === 1 ? '' : 's'} are the target, in stock and fast enough`,
  );
  let added = 0;
  const reasons: string[] = [];
  for (const c of candidates) {
    if (added >= want) break;
    try {
      const why = await tryCandidate(ctx, target, c);
      if (why) reasons.push(why);
      else added += 1;
    } catch (error) {
      reasons.push(`${c.best.site}: ${errorText(error)}`);
    }
  }
  const note = added
    ? null
    : candidates.length
      ? reasons.slice(0, 4).join('; ')
      : `${offers.length} results, none the target in stock within ${s.max_delivery_days} days`;
  if (ctx.db) await ctx.db.targetDone(target.id, note);
  log(`  ${added} listing${added === 1 ? '' : 's'}${note ? `: ${note}` : ''}`);
  return added;
}
