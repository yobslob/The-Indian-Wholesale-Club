import { parseDeliveryDays } from '../delivery';
import { packGrams } from '../variants';

import { offerScore, targetMatcher, words } from './match';

import type { Offer, SourcingShop, SourcingTarget } from './types';

/**
 * From every shop's results for a target to the listings worth making (D-118): keep the results that are the target,
 * in stock and (when the result says) reach the hub in time; put the same product on different shops together (its
 * other shops become backup sources); best first. Pure, no I/O.
 */

export interface Candidate {
  /** The result whose page becomes the listing. */
  best: Offer;
  /** The same product elsewhere (other shops, or the same shop's other pack sizes are read from its page). */
  others: Offer[];
  score: number;
}

const brandOf = (o: Offer): string =>
  (o.brand ?? o.title.split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Words that tell products apart: not the pack size, not the shop's filler. */
const identity = (o: Offer): Set<string> =>
  new Set(words(o.title.replace(/\(?\b\d+(\.\d+)?\s*(g|gm|gms|kg|ml|l|pcs|pieces)\b\)?/gi, ' ')));

function similar(a: Offer, b: Offer): boolean {
  const ba = brandOf(a);
  const bb = brandOf(b);
  if (ba && bb && ba !== bb && !ba.startsWith(bb) && !bb.startsWith(ba)) return false;
  const ga = packGrams(a.pack ?? a.title);
  const gb = packGrams(b.pack ?? b.title);
  if (ga && gb && ga !== gb) return false;
  const ia = identity(a);
  const ib = identity(b);
  const shared = [...ia].filter((w) => ib.has(w)).length;
  return shared / Math.max(1, new Set([...ia, ...ib]).size) >= 0.5;
}

/** Delivery days of a result: its own promise, else the shop's usual (null = unknown). */
export function offerDeliveryDays(
  offer: Offer,
  shop: SourcingShop | undefined,
  now: Date,
): number | null {
  return parseDeliveryDays(offer.deliveryText, now) ?? shop?.delivery_days ?? null;
}

/** Whether a shop price is inside the target's band (D-121); a target without one takes any price. */
export function inBand(target: SourcingTarget, paise: number | null): boolean {
  if (paise === null) return false;
  return (
    (target.min_price_paise == null || paise >= target.min_price_paise) &&
    (target.max_price_paise == null || paise <= target.max_price_paise)
  );
}

/** The shops a target searches: its own list, else every enabled shop that sells its type (D-118, D-121). */
export function shopsFor(target: SourcingTarget, shops: SourcingShop[]): SourcingShop[] {
  return shops.filter(
    (s) =>
      s.product_types.includes(target.product_type) &&
      (!target.sites?.length || target.sites.includes(s.site)),
  );
}

export function pickCandidates(
  target: SourcingTarget,
  offers: Offer[],
  shops: SourcingShop[],
  opts: { maxDays: number; known: Set<string>; now: Date; limit: number },
): Candidate[] {
  const matcher = targetMatcher(target);
  const shopOf = new Map(shops.map((s) => [s.site, s]));
  const usable = offers.filter((o) => {
    if (!matcher.matches(o.title) || o.inStock === false || !inBand(target, o.pricePaise)) return false;
    if (target.sites?.length && !target.sites.includes(o.site)) return false;
    if (opts.known.has(`${o.site}|${o.key}`)) return false;
    const days = offerDeliveryDays(o, shopOf.get(o.site), opts.now);
    // unknown here (Amazon, Flipkart search pages): the product page must show it before anything is added
    return days === null || days <= opts.maxDays;
  });
  const ranked = usable
    .map((o) => ({ o, score: offerScore(o, matcher) }))
    .sort((a, b) => b.score - a.score);

  const clusters: Candidate[] = [];
  for (const { o, score } of ranked) {
    const home = clusters.find(
      (c) =>
        (o.group && o.group === c.best.group && o.site === c.best.site) ||
        (o.site !== c.best.site && similar(o, c.best) && !c.others.some((x) => x.site === o.site)),
    );
    if (home) home.others.push(o);
    else clusters.push({ best: o, others: [], score });
  }
  // different brands first, so three listings are three real choices
  const seenBrands = new Set<string>();
  const firstPass: Candidate[] = [];
  const rest: Candidate[] = [];
  for (const c of clusters) {
    const brand = brandOf(c.best);
    if (seenBrands.has(brand)) rest.push(c);
    else {
      seenBrands.add(brand);
      firstPass.push(c);
    }
  }
  // a few extra, because some pages turn out slow or sold out when read
  return [...firstPass, ...rest].slice(0, opts.limit * 3);
}
