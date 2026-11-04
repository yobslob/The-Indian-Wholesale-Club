import { z } from 'zod';

import { unwrap, type Enum, type IwcClient, type Update } from '../client';

// ---------------------------------------------------------------- orders

export interface AdminOrderFilter {
  status?: Enum<'order_status'>;
  /** Order number, email or the name it ships to (D-096). */
  search?: string;
  limit?: number;
  /** Skip this many (the next page). */
  offset?: number;
}

/** Words safe inside PostgREST's or() filter. */
export function filterWords(words: string): string {
  return words.replace(/[%*,()\\:"']/g, ' ').trim().slice(0, 60);
}

/** One page of orders, newest first, and how many match in all (D-096: pages of 50). */
export async function listAdminOrders(client: IwcClient, filter: AdminOrderFilter = {}) {
  let query = client.from('orders').select(
    `id, order_number, email, status, payment_status, shipping_method, shipping_address, est_delivery_from,
        est_delivery_to, total_cents, tracking_number, carrier, created_at, items:order_items(id, status, quantity),
        shipments:order_shipments!order_shipments_order_id_fkey(kind, status)`,
    { count: 'exact' },
  );
  if (filter.status) query = query.eq('status', filter.status);
  const q = filterWords(filter.search ?? '');
  if (q.length >= 2) query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%,shipping_address->>fullName.ilike.%${q}%`);
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id')
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { orders: data ?? [], total: count ?? 0 };
}

const orderCountsSchema = z.object({ by_status: z.record(z.string(), z.number().int()) });

/**
 * Counted in the database (admin_order_counts, migration 31): every order by status. Counting rows sent over stopped
 * at the API's 1,000-row cap.
 */
export async function getOrderCounts(client: IwcClient) {
  const data = orderCountsSchema.parse(unwrap(await client.rpc('admin_order_counts', undefined, { get: true })));
  return { byStatus: data.by_status as Partial<Record<Enum<'order_status'>, number>> };
}

/** The Orders page's chips (D-096): how many orders are in each status. */
export async function countOrdersByStatus(client: IwcClient) {
  const { byStatus } = await getOrderCounts(client);
  const all = Object.values(byStatus).reduce((n, c) => n + (c ?? 0), 0);
  return { byStatus, all };
}

export async function getAdminOrder(client: IwcClient, id: string) {
  return unwrap(
    await client
      .from('orders')
      .select(
        `*, items:order_items(*, product:products(source_url, source_site, made_in, media:product_media(storage_path, alt_text, is_primary, sort_order)),
            pickup:pickups(id, status, site, picked_at, arrived_at, shop_price_paise, weighed_g, weigh_note,
              ordered_at, paid_paise, shop_order_ref, shop_bill_path,
              source:product_sources(site, item_url, price_paise, in_stock, delivery_days))),
          events:order_events(id, kind, visible_to_customer, message, internal_note, actor, created_at, shipment_id),
          shipments:order_shipments!order_shipments_order_id_fkey(id, seq, kind, status, est_delivery_from, est_delivery_to,
            shipping_cents, carrier, tracking_number, shipped_at)`,
      )
      .eq('id', id)
      .maybeSingle(),
  );
}

export async function addOrderEvent(
  client: IwcClient,
  input: {
    orderId: string;
    kind: string;
    visibleToCustomer: boolean;
    message?: string;
    internalNote?: string;
  },
) {
  unwrap(
    await client.from('order_events').insert({
      order_id: input.orderId,
      kind: input.kind,
      visible_to_customer: input.visibleToCustomer,
      message: input.message ?? null,
      internal_note: input.internalNote ?? null,
    }),
  );
}

/** The order leaves in a parcel (D-066), with its tracking number, once its pieces are at the hub. */
export async function markOrderShipped(
  client: IwcClient,
  orderId: string,
  carrier: string,
  trackingNumber: string,
) {
  unwrap(
    await client.rpc('ship_order', { p_order: orderId, p_carrier: carrier, p_tracking: trackingNumber }),
  );
}

export async function markOrderDelivered(client: IwcClient, orderId: string) {
  unwrap(await client.rpc('deliver_order', { p_order: orderId }));
}

/** D-008 / INV-6: the only way to move a promised window. Adds a customer-visible event. */
export async function changeDeliveryWindow(
  client: IwcClient,
  input: { orderId: string; from: string; to: string; note?: string },
) {
  unwrap(
    await client.rpc('change_delivery_window', {
      p_order: input.orderId,
      p_from: input.from,
      p_to: input.to,
      ...(input.note ? { p_note: input.note } : {}),
    }),
  );
}

// ---------------------------------------------------------------- settings

/** Empty values stay NULL until the founder sets them (D-047). Never default them in code. */
export async function getPricingSettings(client: IwcClient) {
  return unwrap(
    await client
      .from('pricing_settings')
      .select(
        `domestic_days_min, domestic_days_max, stale_listing_days, shipping_flat_cents, free_shipping_min_cents,
          leaving_soon_max, cancel_fee_pct, export_cancel_deduction_pct, return_claim_days, return_tier1_days,
          return_tier1_pct, return_tier2_days, return_tier2_pct, return_tier3_days, return_tier3_pct,
          clearance_discount_pct, min_order_cents, small_order_shipping_cents, small_order_retailer_cents,
          delivery_days_min, delivery_days_max, food_delivery_days_min, food_delivery_days_max, food_billed_pct,
          bulk_saving_pct, bulk_saving_cap_cents, bulk_saving_from_cents, home_est_g_per_rupee, home_est_min_g,
          retailer_pct, shipping_cents_per_kg, heavy_line_off_pct, updated_at`,
      )
      .eq('id', 1)
      .single(),
  );
}

export async function updatePricingSettings(
  client: IwcClient,
  patch: Omit<Update<'pricing_settings'>, 'id'>,
) {
  unwrap(await client.from('pricing_settings').update(patch).eq('id', 1));
}

/** D-007: the signed-in admin's desk ('us' or 'india'), which orders their Today. Null when not set. */
export async function getMyDesk(client: IwcClient, userId: string): Promise<Enum<'ops_desk'> | null> {
  const row = unwrap(await client.from('profiles').select('desk').eq('id', userId).maybeSingle());
  return row?.desk ?? null;
}

/** D-074: the business and compliance details (exporter, importer, broker, FDA, contact), each flagged while a placeholder. */
export async function listBusinessDetails(client: IwcClient) {
  return unwrap(
    await client
      .from('business_details')
      .select('key, label, value, is_placeholder, group_name, sort_order')
      .order('group_name')
      .order('sort_order'),
  );
}

/** Saves the details that changed; a saved value is no longer a placeholder. */
export async function updateBusinessDetails(client: IwcClient, values: Record<string, string>) {
  const current = await listBusinessDetails(client);
  for (const d of current) {
    const next = values[d.key]?.trim();
    if (next === undefined || next === d.value) continue;
    unwrap(
      await client
        .from('business_details')
        .update({ value: next, is_placeholder: next === '' || /^TO FILL/i.test(next), updated_at: new Date().toISOString() })
        .eq('key', d.key),
    );
  }
}
