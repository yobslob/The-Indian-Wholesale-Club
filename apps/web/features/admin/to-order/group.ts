import { shopCartUrl, siteLabel } from '@repo/shared/sourcing';

import type { ToOrderRow } from '@repo/db/admin';

/** One shop's share of the To order list (D-140, F3): its pieces oldest first, their totals and its cart link. */
export interface ShopGroup {
  key: string;
  label: string;
  rows: ToOrderRow[];
  soldPaise: number;
  nowPaise: number;
  /** Puts every piece in the shop's cart at once (Amazon, Shopify shops); null: open each piece. */
  cartUrl: string | null;
  oldest: string;
}

export function groupByShop(rows: ToOrderRow[]): ShopGroup[] {
  const groups = new Map<string, ToOrderRow[]>();
  for (const r of rows) {
    const key = r.site ?? `vendor:${r.vendor_name ?? '?'}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const withUrl = list.filter((r) => r.item_url);
      return {
        key,
        label: list[0]!.site ? siteLabel(list[0]!.site) : (list[0]!.vendor_name ?? 'Shop'),
        rows: list,
        soldPaise: list.reduce((s, r) => s + (r.sold_paise ?? 0) * r.quantity, 0),
        nowPaise: list.reduce((s, r) => s + (r.now_paise ?? r.sold_paise ?? 0) * r.quantity, 0),
        cartUrl: withUrl.length === list.length ? shopCartUrl(list.map((r) => ({ itemUrl: r.item_url!, quantity: r.quantity }))) : null,
        oldest: list.reduce((o, r) => (r.ordered_on < o ? r.ordered_on : o), list[0]!.ordered_on),
      };
    })
    .sort((a, b) => a.oldest.localeCompare(b.oldest));
}

/** "3 days", "5 hours", "12 minutes", "a moment": how long since a time (a piece waiting, a piece on its way). */
export function waited(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'a moment';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
