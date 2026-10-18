import { z } from 'zod';

import { unwrap, type Enum, type IwcClient, type Update } from '../client';

// ---------------------------------------------------------------- orders

export interface AdminOrderFilter {
  status?: Enum<'order_status'>;
  cycleId?: string;
  /** D-070: express orders still in India (no cycle, not yet sent by courier). */
  expressToSend?: boolean;
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
    `id, order_number, email, status, payment_status, cycle_id, shipping_method, shipping_address, est_delivery_from,
        est_delivery_to, total_cents, tracking_number, carrier, created_at, items:order_items(id, status, quantity)`,
    { count: 'exact' },
  );
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.cycleId) query = query.eq('cycle_id', filter.cycleId);
  if (filter.expressToSend) {
    query = query.eq('shipping_method', 'express').is('cycle_id', null).in('status', ['confirmed', 'collecting']);
  }
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

const orderCountsSchema = z.object({
  by_status: z.record(z.string(), z.number().int()),
  express_to_send: z.number().int(),
  shops_owed: z.number().int(),
});

/**
 * Counted in the database (admin_order_counts, migration 31): every order by status, express orders still to send and
 * the shops owed for picked pieces. Counting rows sent over stopped at the API's 1,000-row cap.
 */
export async function getOrderCounts(client: IwcClient) {
  const data = orderCountsSchema.parse(unwrap(await client.rpc('admin_order_counts', undefined, { get: true })));
  return {
    byStatus: data.by_status as Partial<Record<Enum<'order_status'>, number>>,
    expressToSend: data.express_to_send,
    shopsOwed: data.shops_owed,
  };
}

/** The Orders page's chips (D-096): how many orders are in each status, and express orders still to send. */
export async function countOrdersByStatus(client: IwcClient) {
  const { byStatus, expressToSend } = await getOrderCounts(client);
  const all = Object.values(byStatus).reduce((n, c) => n + (c ?? 0), 0);
  return { byStatus, all, expressToSend };
}

export async function getAdminOrder(client: IwcClient, id: string) {
  return unwrap(
    await client
      .from('orders')
      .select(
        `*, cycle:cycles(id, code, status),
          items:order_items(*, product:products(source_url, source_site, media:product_media(storage_path, alt_text, is_primary, sort_order)),
            pickup:pickups(id, status, vendor_id, picked_at, arrived_at, payout_id, shop_price_paise, weighed_g, weigh_note,
              ordered_at, paid_paise, shop_order_ref, shop_bill_path,
              source:product_sources(site, item_url, price_paise, in_stock, delivery_days),
              vendor:vendors(id, shop_name, town))),
          events:order_events(id, kind, visible_to_customer, message, internal_note, actor, created_at)`,
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

/** US desk: the order leaves in a domestic parcel (flows.md §6.4, D-066). Only once its export has arrived. */
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

/** All values start NULL until the founder sets them (D-047). Never default them in code. */
export async function getPricingSettings(client: IwcClient) {
  return unwrap(
    await client
      .from('pricing_settings')
      .select(
        `fx_inr_per_usd, fx_buffer_pct, fx_auto, fx_updated_at, fx_source, india_handling_pct, ship_alloc_paise_per_kg,
          min_order_cents, india_handling_paise, freight_cents_per_kg,
          volumetric_pct, broker_cents_per_shipment, shipment_kg, duty_pct, us_handling_cents, us_last_mile_cents_per_kg,
          us_last_mile_min_cents, returns_allowance_pct, margin_pct, card_fee_pct, card_fee_fixed_cents,
          express_base_cents, express_courier_cents_per_kg, express_min_kg, domestic_days_min, domestic_days_max,
          shipping_flat_cents, free_shipping_min_cents, express_shipping_cents, express_days_min, express_days_max,
          stale_listing_days, leaving_soon_max, cycle_days, fast_offer_cents, food_cleared, margin_clothing_pct, margin_food_pct,
          margin_home_pct, small_order_shipping_cents, small_order_retailer_cents, pilot_delivery_days_min,
          pilot_delivery_days_max, shop_divisor, ship_paise_per_100g, margin_clothing_min_pct, margin_home_min_pct,
          taper_clothing_from_cents, taper_clothing_to_cents, taper_home_from_cents, taper_home_to_cents, food_fee_paise,
          food_parcel_kg, food_billed_pct, courier_first_kg_paise, courier_next_kg_paise, parcel_fixed_paise,
          duty_clothing_pct, duty_food_pct, duty_home_pct, min_profit_clothing_cents, min_profit_food_cents,
          min_profit_home_cents, min_profit_pct, min_profit_food_pct, guard_card_fee_pct, bulk_saving_pct,
          bulk_saving_cap_cents, small_food_max_shop_paise, small_food_max_g, small_food_ship_share_pct,
          small_food_floor_cents, small_food_ceiling_cents, home_est_g_per_rupee, home_est_min_g,
          food_ship_share_pct, retailer_pct, food_off_step_cents, food_off_step_pct, food_off_max_pct,
          food_margin_max_pct, beta_pricing, shown_shipping_cents_per_kg, updated_at`,
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

/** Settings that hold Claude's researched estimates (D-047): source, link and date each. Empty = all the founder's. */
export async function listPricingEstimates(client: IwcClient) {
  return unwrap(
    await client.from('pricing_estimates').select('setting, source, source_url, checked_on').order('setting'),
  );
}

/** The settings the automatic price is built from whose estimate label matters on a listing (shared/domain autoPrice, D-119). */
export const PRICE_SUGGESTION_SETTINGS = [
  'fx_inr_per_usd', 'fx_buffer_pct', 'margin_pct', 'food_fee_paise', 'food_parcel_kg', 'food_billed_pct',
  'parcel_fixed_paise', 'duty_clothing_pct', 'duty_food_pct', 'duty_home_pct',
];

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

/** D-074: food may be published once the founder clears them. */
export async function setFoodCleared(client: IwcClient, cleared: boolean) {
  unwrap(await client.from('pricing_settings').update({ food_cleared: cleared }).eq('id', 1));
}
