import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import { browseHref, inQuickStore } from '@/features/catalog/browse-query';

/** The types the 7-day store sells (its shops sell food and home goods), in the order its switch shows them. */
export const QUICK_TYPES: readonly ProductType[] = ['food', 'home'];

/** D-154: a 7-day store's See all page: /7-day-delivery/food, or one category of it (?category=sweets). */
export function quickHref(productType: ProductType, category?: string): string {
  return browseHref(productType, inQuickStore({ sizes: [], sort: 'low', ...(category ? { category } : {}) }));
}

export interface QuickCategory {
  slug: string;
  name: string;
  productType: ProductType;
  href: string;
}

/**
 * The front page's categories (biggest first, with their photo) with the type each belongs to, from the list's own
 * categories (store_quick_browse names the type, store_quick_front does not). One without a known type is left out.
 */
export function quickCategories<T extends { slug: string; name: string }>(
  categories: T[],
  typed: { slug: string; product_type: string }[],
): (T & QuickCategory)[] {
  return categories.flatMap((c) => {
    const productType = PRODUCT_TYPES.find((t) => t === typed.find((x) => x.slug === c.slug)?.product_type);
    return productType ? [{ ...c, productType, href: quickHref(productType, c.slug) }] : [];
  });
}
