import { oneLine, parseRupeesToPaise } from '../../text';
import { offerSchema, type Offer } from '../types';

/** Helpers for the shop readers: they walk untrusted JSON from a shop's page, so nothing is assumed about it. */

export type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
export const num = (v: unknown): number | null => {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string' && v.trim()
        ? Number(v.replace(/,/g, ''))
        : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Every object inside `root` that `pick` accepts (depth- and count-capped). */
export function collect(root: unknown, pick: (o: Obj) => boolean, max = 2000): Obj[] {
  const found: Obj[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number): void => {
    if (
      found.length >= max ||
      depth > 24 ||
      node === null ||
      typeof node !== 'object' ||
      seen.has(node)
    )
      return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const x of node) visit(x, depth + 1);
      return;
    }
    const o = node as Obj;
    if (pick(o)) found.push(o);
    for (const key of Object.keys(o)) visit(o[key], depth + 1);
  };
  visit(root, 0);
  return found;
}

/** Rupees as a shop's JSON gives them ("138", 138, 138.5) in paise. */
export const rupees = (v: unknown): number | null =>
  parseRupeesToPaise(typeof v === 'number' ? v : str(v));

const httpsImage = (v: unknown): string | null => {
  const s = str(v).replace(/^\/\//, 'https://');
  return /^https:\/\/\S+$/.test(s) && s.length <= 2000 ? s : null;
};
export { httpsImage };

/** An offer from a reader's fields, or null when it is not a usable result (checked against offerSchema). */
export function makeOffer(
  fields: Partial<Offer> & Pick<Offer, 'site' | 'url' | 'key' | 'title'>,
): Offer | null {
  const parsed = offerSchema.safeParse({
    brand: null,
    pricePaise: null,
    mrpPaise: null,
    inStock: null,
    deliveryText: null,
    pack: null,
    rating: null,
    ratingCount: null,
    sponsored: false,
    image: null,
    group: null,
    siblings: [],
    ...fields,
    title: oneLine(fields.title).slice(0, 400),
  });
  if (!parsed.success || !parsed.data.title) return null;
  const o = parsed.data;
  if (o.mrpPaise !== null && o.pricePaise !== null && o.mrpPaise < o.pricePaise) o.mrpPaise = null;
  return o;
}

/** One offer per key (the first seen wins). */
export function uniqueOffers(list: (Offer | null)[]): Offer[] {
  const seen = new Set<string>();
  return list.filter((o): o is Offer => !!o && !seen.has(o.key) && !!seen.add(o.key));
}

/**
 * A shop's collection and the pages a target reads of it (NEWME, Savana; D-170, D-171): "collection:dresses pages:5-8"
 * → { handle: "dresses", from: 5, to: 8 }; pages default to the first one; at most 10 pages, so one target's search
 * never runs away.
 */
export function pagedCollection(query: string): { handle: string; from: number; to: number } | null {
  const m = query
    .trim()
    .match(/^collection:([a-z0-9][a-z0-9/-]{0,80})(?:\s+pages?:(\d{1,3})(?:-(\d{1,3}))?)?$/i);
  if (!m) return null;
  const from = Math.max(1, Number(m[2] ?? 1));
  const to = Math.max(from, Number(m[3] ?? from));
  return { handle: m[1]!.toLowerCase(), from, to: Math.min(to, from + 9) };
}

/**
 * A women's-only shop's name for a piece (NEWME, Savana: "Co-ord Set") with who it is for, "Women's co-ord set", so
 * the store knows who wears it (D-140: told from the name) when the shop's own name does not say.
 */
export const womensName = (name: string): string =>
  !name || /\b(women|womens|women's|woman|ladies|lady|girls?|girl's|kids?|boys?|men|mens|men's|unisex)\b/i.test(name)
    ? name
    : `Women's ${name}`;
