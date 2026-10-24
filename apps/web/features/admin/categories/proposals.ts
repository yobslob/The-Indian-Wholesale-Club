import { checkCategory } from '@repo/shared/sourcing';

import type { ProductType } from '@repo/shared/domain';

export interface CategoryOption {
  id: string;
  slug: string;
  name: string;
  product_type: string;
}

export interface CategoryProposal {
  id: string;
  name: string;
  status: string;
  productType: string;
  from: { slug: string; name: string };
  /** The category its name reads as (move), or null when it is not of its type at all (`reason`). */
  to: CategoryOption | null;
  reason: string | null;
}

interface Listing {
  id: string;
  name: string;
  product_type: string;
  status: string;
  category: { id: string; slug: string; name: string } | null;
}

/**
 * Categories to check (founder, 2026-10-24): each food and home listing whose name plainly reads as another category
 * of its type, or as not its type at all (pet food, hair oil, a rakhi under Sweets, Mysore pak under Home & gifts), by
 * the shared rules (`checkCategory`). Moves first, by the category they go to; then the ones not of their type.
 */
export function categoryProposals(listings: Listing[], categories: CategoryOption[]): CategoryProposal[] {
  const bySlug = new Map(categories.map((c) => [`${c.product_type}/${c.slug}`, c]));
  const out: CategoryProposal[] = [];
  for (const l of listings) {
    if (!l.category) continue;
    const check = checkCategory(l.name, l.product_type as ProductType, l.category.slug);
    if (check.kind === 'ok') continue;
    const to = check.kind === 'move' ? (bySlug.get(`${l.product_type}/${check.to}`) ?? null) : null;
    if (check.kind === 'move' && !to) continue;
    out.push({
      id: l.id,
      name: l.name,
      status: l.status,
      productType: l.product_type,
      from: { slug: l.category.slug, name: l.category.name },
      to,
      reason: check.kind === 'not_type' ? check.reason : null,
    });
  }
  const key = (p: CategoryProposal): string => `${p.to ? 0 : 1}|${p.to?.name ?? p.reason}|${p.from.name}|${p.name}`;
  return out.sort((a, b) => key(a).localeCompare(key(b)));
}
