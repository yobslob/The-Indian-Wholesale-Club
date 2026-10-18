import Link from 'next/link';

import { siteLabel } from '@repo/shared/sourcing';

import { signedUrls } from '../signed';
import { Panel } from '../ui';

import { ShopBillForm, type BillRow } from './shop-bill-form';

import type { IwcClient } from '@repo/db';
import type { getAdminOrder, ShopBill } from '@repo/db/admin';

type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

const rupeeText = (paise: number): string => (paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100));

/** The rows a new shop bill starts with, as admin_shop_bill() makes them: a row per active piece, then Delivery. */
function defaultRows(order: Order): BillRow[] {
  const pieces: BillRow[] = order.items
    .filter((i) => i.status === 'active')
    .map((i) => {
      const p = i.pickup;
      const unit = p?.paid_paise != null ? Math.round(p.paid_paise / i.quantity) : (p?.shop_price_paise ?? i.shop_price_paise ?? 0);
      const site = p?.source?.site ?? i.product?.source_site ?? null;
      return {
        key: i.id,
        kind: 'piece',
        order_item_id: i.id,
        label: `${i.product_name} · ${i.variant_label}`,
        quantity: i.quantity,
        unit: rupeeText(unit),
        shop: site ? siteLabel(site) : (p?.vendor?.shop_name ?? ''),
        shop_order_ref: p?.shop_order_ref ?? '',
      };
    });
  return [...pieces, { key: 'delivery', kind: 'delivery', order_item_id: null, label: 'Delivery', quantity: 1, unit: '0', shop: '', shop_order_ref: '' }];
}

/** Invoice C on the order page (D-140, F4): the shop bill form with its photos, and links to print the invoices. */
export async function ShopBillPanel({ client, order, bill }: { client: IwcClient; order: Order; bill: ShopBill | null }): Promise<React.JSX.Element> {
  const urls = await signedUrls(client, 'vendor-docs', bill?.photos.map((p) => p.storage_path) ?? []);
  const items = new Map(order.items.map((i) => [i.id, i]));
  const rows: BillRow[] = bill
    ? bill.lines
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => ({
          key: l.id,
          kind: l.kind as BillRow['kind'],
          order_item_id: l.order_item_id,
          label: l.kind === 'piece' && l.order_item_id && items.get(l.order_item_id) ? `${items.get(l.order_item_id)!.product_name} · ${items.get(l.order_item_id)!.variant_label}` : l.label,
          quantity: l.quantity,
          unit: rupeeText(l.unit_paise),
          shop: l.shop ?? '',
          shop_order_ref: l.shop_order_ref ?? '',
        }))
    : defaultRows(order);

  return (
    <Panel
      title="Shop bill · invoice C"
      note={
        <span className="flex gap-3">
          {(['a', 'b', 'c'] as const).map((k) => (
            <Link key={k} href={`/admin/orders/${order.id}/invoice/${k}`} className="underline" prefetch={false}>
              Print {k.toUpperCase()}
            </Link>
          ))}
        </span>
      }
    >
      <p className="text-ink-muted mb-3 text-[13px]">
        What the shops&apos; carts cost for this order: each piece at the price paid, the delivery and any extras. Mark ordered fills
        the rows in. Admins only.
      </p>
      <ShopBillForm
        orderId={order.id}
        initialRows={rows}
        initialNote={bill?.note ?? ''}
        final={bill?.status === 'final'}
        photos={(bill?.photos ?? []).map((p) => ({ id: p.id, url: urls.get(p.storage_path) ?? null, pdf: p.storage_path.endsWith('.pdf') }))}
      />
    </Panel>
  );
}
