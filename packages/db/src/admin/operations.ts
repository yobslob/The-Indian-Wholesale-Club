import { unwrap, type Enum, type IwcClient, type Update } from '../client';

// ---------------------------------------------------------------- orders

export interface AdminOrderFilter {
  status?: Enum<'order_status'>;
  cycleId?: string;
  limit?: number;
}

export async function listAdminOrders(client: IwcClient, filter: AdminOrderFilter = {}) {
  let query = client.from('orders').select(
    `id, order_number, email, status, payment_status, cycle_id, est_delivery_from, est_delivery_to, total_cents,
        tracking_number, carrier, created_at, items:order_items(id, status)`,
  );
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.cycleId) query = query.eq('cycle_id', filter.cycleId);
  return unwrap(await query.order('created_at', { ascending: false }).limit(filter.limit ?? 100));
}

export async function getAdminOrder(client: IwcClient, id: string) {
  return unwrap(
    await client
      .from('orders')
      .select(
        `*, items:order_items(*, pickup:pickups(id, status, vendor_id, picked_at, arrived_at, payout_id)),
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
        `fx_inr_per_usd, fx_buffer_pct, fx_auto, fx_updated_at, fx_source, india_handling_paise, freight_cents_per_kg,
          volumetric_pct, broker_cents_per_shipment, shipment_kg, duty_pct, us_handling_cents, us_last_mile_cents_per_kg,
          us_last_mile_min_cents, returns_allowance_pct, margin_pct, card_fee_pct, card_fee_fixed_cents,
          express_base_cents, express_courier_cents_per_kg, express_min_kg, domestic_days_min, domestic_days_max,
          shipping_flat_cents, free_shipping_min_cents, express_shipping_cents, express_days_min, express_days_max,
          stale_listing_days, leaving_soon_max, cycle_days, fast_offer_cents, spices_cleared, updated_at`,
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

/** The settings the automatic price is built from (shared/domain autoPrice, D-075). */
export const PRICE_SUGGESTION_SETTINGS = [
  'fx_inr_per_usd', 'fx_buffer_pct', 'india_handling_paise', 'freight_cents_per_kg', 'volumetric_pct',
  'broker_cents_per_shipment', 'shipment_kg', 'duty_pct', 'us_handling_cents', 'us_last_mile_cents_per_kg',
  'us_last_mile_min_cents', 'returns_allowance_pct', 'margin_pct', 'card_fee_pct', 'card_fee_fixed_cents',
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

/** D-074: spices may be published once the founder clears them. */
export async function setSpicesCleared(client: IwcClient, cleared: boolean) {
  unwrap(await client.from('pricing_settings').update({ spices_cleared: cleared }).eq('id', 1));
}
