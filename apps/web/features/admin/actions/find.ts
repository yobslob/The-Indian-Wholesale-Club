'use server';

import { z } from 'zod';

import { adminQuickFind } from '@repo/db/admin';

import { mediaUrl } from '@/lib/site';

import { ORDER_STATUS, PRODUCT_STATUS, type Tone } from '../chips';
import { requireAdminAction } from '../guard';

export interface FoundItem {
  href: string;
  title: string;
  sub: string;
  chip?: [string, Tone];
  photo?: string;
}
export type Found = { group: 'Orders' | 'Products' | 'Customers' | 'Vendors'; items: FoundItem[] }[];

/** Quick find (D-096): what the Ctrl+K box shows. Admin only; anyone else gets a 404 like every admin action. */
export async function quickFindAction(words: string): Promise<Found> {
  const { client } = await requireAdminAction();
  const r = await adminQuickFind(client, z.string().max(200).parse(words));
  const name = (address: unknown): string => {
    const a = address as { fullName?: string } | null;
    return a?.fullName ?? '';
  };
  return [
    {
      group: 'Orders' as const,
      items: r.orders.map((o) => ({
        href: `/admin/orders/${o.id}`,
        title: o.order_number,
        sub: [name(o.shipping_address), o.email].filter(Boolean).join(' · '),
        chip: ORDER_STATUS[o.status],
      })),
    },
    {
      group: 'Products' as const,
      items: r.products.map((p) => {
        const main = p.media.find((m) => m.is_primary) ?? p.media[0];
        return {
          href: `/admin/catalog/${p.id}`,
          title: p.name,
          sub: p.region?.name ?? '',
          chip: PRODUCT_STATUS[p.status],
          ...(main ? { photo: mediaUrl(main.storage_path) } : {}),
        };
      }),
    },
    {
      group: 'Customers' as const,
      items: r.customers.map((c) => ({
        href: `/admin/orders?q=${encodeURIComponent(c.email ?? '')}`,
        title: c.full_name || c.email || 'Customer',
        sub: c.full_name ? (c.email ?? '') : 'their orders',
      })),
    },
    {
      group: 'Vendors' as const,
      items: r.vendors.map((v) => ({
        href: `/admin/vendors#v-${v.id}`,
        title: v.shop_name,
        sub: [v.town, v.region?.name].filter(Boolean).join(' · '),
      })),
    },
  ].filter((g) => g.items.length > 0);
}
