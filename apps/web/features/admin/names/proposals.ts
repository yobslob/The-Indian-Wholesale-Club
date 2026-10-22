import { cleanTitle, guessBrands } from '@repo/shared/sourcing';
import { listingName } from '@repo/shared/sourcing/auto';

import type { ProductType } from '@repo/shared/domain';

export interface NameProposal {
  id: string;
  from: string;
  to: string;
  status: string;
}

/** True when every word of `name` appears in `title` in the same order and some of the title's words are missing. */
function cutFrom(name: string, title: string): boolean {
  const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean);
  const n = words(name);
  const t = words(title);
  let i = 0;
  for (const w of t) if (w === n[i]) i += 1;
  return i === n.length && t.length > n.length;
}

/** A name that is only what a shop calls itself ("ELVRIT Collections" → "Collections"): never proposed. */
const SHOP_WORD =
  /^(collections?|store|shop|official|fashions?|creations?|crafts?|handicrafts?|enterprises?|industries|international|india|traders?|world|house|studio|designs?|exports?|mart|bazaar)$/i;

/**
 * Imported names that IWC's naming would change (L1): each shop's brands are guessed from its own names (guessBrands),
 * then each name is cleaned (cleanTitle: only the brand or shop goes, 2026-10-21). A name that is a cut-down of the
 * shop's title (D-140's first rules dropped real words: "3 in 1 Incense Sticks" became "1 Incense Sticks") is made
 * again from the shop's title, so those words come back; a name an admin wrote is cleaned as it is. Only the ones that
 * change are proposed; food is never touched.
 */
export function nameProposals(
  rows: {
    id: string;
    name: string;
    product_type: string;
    status: string;
    vendor_id: string | null;
    source_site?: string | null;
    shop_title?: string | null;
  }[],
): NameProposal[] {
  const byShop = new Map<string, string[]>();
  // one shop's names together, across states (each state has its own vendor for a shop)
  const shopOf = (r: { vendor_id: string | null; source_site?: string | null }): string => r.source_site ?? r.vendor_id ?? '';
  const base = (r: { name: string; shop_title?: string | null }): string =>
    r.shop_title && r.shop_title !== r.name && cutFrom(r.name, r.shop_title) ? r.shop_title : r.name;
  for (const r of rows) byShop.set(shopOf(r), [...(byShop.get(shopOf(r)) ?? []), base(r)]);
  const brands = new Map([...byShop].map(([shop, names]) => [shop, guessBrands(names)]));
  const out: NameProposal[] = [];
  for (const r of rows) {
    const from = base(r);
    const lower = from.toLowerCase();
    const brand = (brands.get(shopOf(r)) ?? []).filter((b) => lower.startsWith(`${b} `)).sort((a, b) => b.length - a.length)[0];
    const cleaned = cleanTitle(from, { brand: brand ?? null, productType: r.product_type as ProductType });
    const to = from === r.name ? cleaned : listingName(cleaned);
    if (to !== r.name && !SHOP_WORD.test(to.trim())) out.push({ id: r.id, from: r.name, to, status: r.status });
  }
  return out;
}
