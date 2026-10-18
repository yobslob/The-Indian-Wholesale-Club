import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

/**
 * Ordering sold pieces from their shops and the shop bill, invoice C (D-140, plan F3, F4; migration 20261018090000).
 * Admin only: the functions check is_admin() and the tables are admin-only under RLS (D-003).
 */

/** Every piece of a paid, open order still to order from its shop, oldest first, with the shop item in use. */
export async function listToOrder(client: IwcClient) {
  return unwrap(await client.rpc('admin_to_order', undefined, { get: true }));
}

export type ToOrderRow = Awaited<ReturnType<typeof listToOrder>>[number];

/** How many pieces wait to be ordered and since when (Today's India desk, the sidebar). */
export async function toOrderSummary(client: IwcClient): Promise<{ count: number; oldest: string | null }> {
  const rows = await listToOrder(client);
  return { count: rows.length, oldest: rows[0]?.ordered_on ?? null };
}

export const markOrderedSchema = z.object({
  lines: z
    .array(z.object({ pickup: z.string().uuid(), paid_paise: z.number().int().min(0).max(100_000_000).nullable().optional() }))
    .min(1)
    .max(200),
  shopOrderRef: z.string().trim().max(120).optional(),
  billPath: z.string().regex(/^shop-bills\/[\w./-]+$/).max(300).optional(),
});

export async function markOrdered(client: IwcClient, input: z.infer<typeof markOrderedSchema>): Promise<number> {
  const { lines, shopOrderRef, billPath } = markOrderedSchema.parse(input);
  return unwrap(
    await client.rpc('admin_mark_ordered', {
      p_lines: lines.map((l) => (l.paid_paise === undefined || l.paid_paise === null ? { pickup: l.pickup } : l)),
      ...(shopOrderRef ? { p_shop_order_ref: shopOrderRef } : {}),
      ...(billPath ? { p_bill_path: billPath } : {}),
    }),
  ) as number;
}

export async function unmarkOrdered(client: IwcClient, pickupId: string): Promise<void> {
  unwrap(await client.rpc('admin_unmark_ordered', { p_pickup: pickupId }));
}

/** The order's shop bill with its rows and photos, or null before anyone opened it. */
export async function getShopBill(client: IwcClient, orderId: string) {
  return unwrap(
    await client
      .from('shop_bills')
      .select(
        `id, status, note, finalized_at, updated_at,
         lines:shop_bill_lines(id, order_item_id, kind, label, quantity, unit_paise, shop, shop_order_ref, sort_order),
         photos:shop_bill_photos(id, storage_path, created_at)`,
      )
      .eq('order_id', orderId)
      .maybeSingle(),
  );
}

export type ShopBill = NonNullable<Awaited<ReturnType<typeof getShopBill>>>;

/** The order's shop bill, made with a row per piece and a Delivery row the first time. */
export async function ensureShopBill(client: IwcClient, orderId: string): Promise<string> {
  return unwrap(await client.rpc('admin_shop_bill', { p_order: orderId })) as string;
}

export const shopBillLineSchema = z.object({
  kind: z.enum(['piece', 'delivery', 'extra']),
  order_item_id: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  unit_paise: z.number().int().min(-10_000_000).max(10_000_000),
  shop: z.string().trim().max(120).nullable().optional(),
  shop_order_ref: z.string().trim().max(120).nullable().optional(),
});
export type ShopBillLine = z.infer<typeof shopBillLineSchema>;

export async function saveShopBill(client: IwcClient, billId: string, lines: ShopBillLine[], note: string): Promise<void> {
  const rows = z.array(shopBillLineSchema).max(200).parse(lines);
  unwrap(await client.rpc('admin_save_shop_bill', { p_bill: billId, p_lines: rows, p_note: note.slice(0, 1000) }));
}

export async function setShopBillFinal(client: IwcClient, billId: string, final: boolean): Promise<void> {
  unwrap(await client.rpc('admin_set_shop_bill_final', { p_bill: billId, p_final: final }));
}

export async function addShopBillPhoto(client: IwcClient, billId: string, storagePath: string, userId: string): Promise<void> {
  unwrap(await client.from('shop_bill_photos').insert({ bill_id: billId, storage_path: storagePath, created_by: userId }));
}

export async function removeShopBillPhoto(client: IwcClient, photoId: string): Promise<string | null> {
  const row = unwrap(await client.from('shop_bill_photos').delete().eq('id', photoId).select('storage_path').maybeSingle());
  return row?.storage_path ?? null;
}

/** D-115: the made-to-order pilot is on while Settings has its delivery days (no cycles, pieces ordered at once). */
export async function isMadeToOrderPilot(client: IwcClient): Promise<boolean> {
  const row = unwrap(
    await client.from('pricing_settings').select('pilot_delivery_days_min, pilot_delivery_days_max').eq('id', 1).maybeSingle(),
  );
  return row?.pilot_delivery_days_min != null && row.pilot_delivery_days_max != null;
}

const PIECE_COLUMNS = `id, status, quantity, shop_price_paise, paid_paise, shop_order_ref, ordered_at, picked_at, weighed_g, weigh_note,
  source:product_sources(site, item_url, delivery_days),
  variant:product_variants(label, product:products(id, name, source_site, media:product_media(storage_path, is_primary, sort_order))),
  item:order_items!inner(id, product_name, variant_label, status, order:orders!inner(id, order_number, created_at))`;

/** Pieces ordered from their shop and not yet at the hub, the longest on the way first. */
export async function listOrderedPieces(client: IwcClient) {
  return unwrap(
    await client
      .from('pickups')
      .select(PIECE_COLUMNS)
      .eq('status', 'pending')
      .not('ordered_at', 'is', null)
      .eq('item.status', 'active')
      .order('ordered_at')
      .limit(500),
  );
}

/** Pieces at the hub (picked) not yet weighed and not yet sent on (D-130). */
export async function listToWeigh(client: IwcClient) {
  return unwrap(
    await client
      .from('pickups')
      .select(PIECE_COLUMNS)
      .eq('status', 'picked')
      .is('weighed_g', null)
      .is('arrived_at', null)
      .order('picked_at')
      .limit(500),
  );
}

export type PipelinePiece = Awaited<ReturnType<typeof listToWeigh>>[number];

/** Today's India desk in the pilot: how many pieces are ordered, at the hub to weigh, and prices held for an admin. */
export async function pilotPipelineCounts(client: IwcClient): Promise<{ ordered: number; toWeigh: number; held: number }> {
  const head = { count: 'exact', head: true } as const;
  const [ordered, toWeigh, held] = await Promise.all([
    client.from('pickups').select('id, item:order_items!inner(status)', head).eq('status', 'pending').not('ordered_at', 'is', null).eq('item.status', 'active'),
    client.from('pickups').select('id', head).eq('status', 'picked').is('weighed_g', null).is('arrived_at', null),
    client.from('product_sources').select('id', head).not('review', 'is', null),
  ]);
  for (const r of [ordered, toWeigh, held]) if (r.error) throw new Error(r.error.message);
  return { ordered: ordered.count ?? 0, toWeigh: toWeigh.count ?? 0, held: held.count ?? 0 };
}
