import { z } from 'zod';

import { ADMIN_PRODUCT_SORTS, type AdminProductFilter, type AdminProductSort } from '@repo/db/admin';
import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

const STATUSES = ['draft', 'live', 'paused', 'archived'] as const;
type Status = (typeof STATUSES)[number];

/**
 * Products' view in the address (D-136): the tab (?status=, ?us=1), the search (?q=) and the filters (?type=,
 * ?region= an id or "none" for all-India, ?category=, ?shop=, ?min= / ?max= in dollars, ?sort=). One parser for the
 * page and Download Excel, so the sheet is always the page's view.
 */
export interface ProductView {
  q: string;
  status?: Status;
  usStock: boolean;
  type?: ProductType;
  region?: string;
  category?: string;
  shop?: string;
  min?: number;
  max?: number;
  sort: AdminProductSort;
  /** D-140: who it is for, or 'none' (clothing without it). */
  wears?: WearsFilter;
}

const WEARS_FILTERS = ['women', 'men', 'kids', 'unisex', 'none'] as const;
export type WearsFilter = (typeof WEARS_FILTERS)[number];

type Raw = URLSearchParams | Record<string, string | string[] | undefined>;
const get = (raw: Raw, key: string): string | undefined => {
  const v = raw instanceof URLSearchParams ? raw.get(key) ?? undefined : raw[key];
  return Array.isArray(v) ? v[0] : v;
};
const id = z.string().uuid().optional().catch(undefined);
const dollars = z.coerce.number().min(0).max(100_000).optional().catch(undefined);

export function parseProductView(raw: Raw): ProductView {
  const status = get(raw, 'status');
  const type = get(raw, 'type');
  const sort = get(raw, 'sort');
  const region = get(raw, 'region');
  const wears = get(raw, 'for');
  return {
    q: get(raw, 'q')?.trim().slice(0, 100) ?? '',
    status: STATUSES.includes(status as Status) ? (status as Status) : undefined,
    usStock: get(raw, 'us') === '1',
    type: PRODUCT_TYPES.includes(type as ProductType) ? (type as ProductType) : undefined,
    region: region === 'none' ? 'none' : id.parse(region),
    category: id.parse(get(raw, 'category')),
    shop: id.parse(get(raw, 'shop')),
    min: dollars.parse(get(raw, 'min') || undefined),
    max: dollars.parse(get(raw, 'max') || undefined),
    sort: ADMIN_PRODUCT_SORTS.includes(sort as AdminProductSort) ? (sort as AdminProductSort) : 'updated',
    ...(WEARS_FILTERS.includes(wears as WearsFilter) ? { wears: wears as WearsFilter } : {}),
  };
}

export function toAdminFilter(v: ProductView): AdminProductFilter {
  return {
    search: v.q || undefined,
    status: v.status,
    usStock: v.usStock,
    productType: v.type,
    regionId: v.region && v.region !== 'none' ? v.region : undefined,
    noRegion: v.region === 'none',
    categoryId: v.category,
    vendorId: v.shop,
    minCents: v.min !== undefined ? Math.round(v.min * 100) : undefined,
    maxCents: v.max !== undefined ? Math.round(v.max * 100) : undefined,
    sort: v.sort,
    wears: v.wears,
  };
}

/** The view's query string; `extra` adds the page number or the Weights tab. */
export function productViewQuery(v: ProductView, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (v.q) p.set('q', v.q);
  if (v.status) p.set('status', v.status);
  if (v.usStock) p.set('us', '1');
  if (v.type) p.set('type', v.type);
  if (v.region) p.set('region', v.region);
  if (v.category) p.set('category', v.category);
  if (v.shop) p.set('shop', v.shop);
  if (v.min !== undefined) p.set('min', String(v.min));
  if (v.max !== undefined) p.set('max', String(v.max));
  if (v.sort !== 'updated') p.set('sort', v.sort);
  if (v.wears) p.set('for', v.wears);
  for (const [k, val] of Object.entries(extra)) p.set(k, val);
  return p.toString();
}

export const hasProductFilters = (v: ProductView): boolean =>
  Boolean(v.type || v.region || v.category || v.shop || v.wears || v.min !== undefined || v.max !== undefined || v.sort !== 'updated');
