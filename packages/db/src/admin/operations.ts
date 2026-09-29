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
        `*, items:order_items(*, pickup:pickups(id, status, vendor_id, picked_at, payout_id)),
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

/** US desk: the order leaves in a domestic parcel (flows.md §6.4). */
export async function markOrderShipped(
  client: IwcClient,
  orderId: string,
  carrier: string,
  trackingNumber: string,
) {
  unwrap(
    await client
      .from('orders')
      .update({ status: 'shipped', carrier, tracking_number: trackingNumber })
      .eq('id', orderId),
  );
  await addOrderEvent(client, { orderId, kind: 'shipped', visibleToCustomer: true });
}

export async function markOrderDelivered(client: IwcClient, orderId: string) {
  unwrap(await client.from('orders').update({ status: 'delivered' }).eq('id', orderId));
  await addOrderEvent(client, { orderId, kind: 'delivered', visibleToCustomer: true });
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
        `fx_inr_per_usd, freight_cents_per_kg, duty_pct, margin_pct, domestic_days_min, domestic_days_max,
          shipping_flat_cents, free_shipping_min_cents, express_shipping_cents, express_days_min, express_days_max,
          stale_listing_days, updated_at`,
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
