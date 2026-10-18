import { cleanTitle, guessBrands } from '@repo/shared/sourcing';

import type { ProductType } from '@repo/shared/domain';

export interface NameProposal {
  id: string;
  from: string;
  to: string;
  status: string;
}

/**
 * Imported names saved before D-140 that IWC's naming would change (L1): each shop's brands are guessed from its own names
 * (guessBrands), then each name is cleaned (cleanTitle). Only the ones that change are proposed; food is never touched.
 */
export function nameProposals(
  rows: { id: string; name: string; product_type: string; status: string; vendor_id: string | null; source_site?: string | null }[],
): NameProposal[] {
  const byShop = new Map<string, string[]>();
  // one shop's names together, across states (each state has its own vendor for a shop)
  const shopOf = (r: { vendor_id: string | null; source_site?: string | null }): string => r.source_site ?? r.vendor_id ?? '';
  for (const r of rows) byShop.set(shopOf(r), [...(byShop.get(shopOf(r)) ?? []), r.name]);
  const brands = new Map([...byShop].map(([shop, names]) => [shop, guessBrands(names)]));
  const out: NameProposal[] = [];
  for (const r of rows) {
    const lower = r.name.toLowerCase();
    const brand = (brands.get(shopOf(r)) ?? []).filter((b) => lower.startsWith(`${b} `)).sort((a, b) => b.length - a.length)[0];
    const to = cleanTitle(r.name, { brand: brand ?? null, productType: r.product_type as ProductType });
    if (to !== r.name) out.push({ id: r.id, from: r.name, to, status: r.status });
  }
  return out;
}
