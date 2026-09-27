import { DbError, unwrap, type Enum, type Insert, type IwcClient, type Update } from '../client';

// ---------------------------------------------------------------- cycles (flows.md §1)

const CYCLE_COLUMNS =
  'id, code, status, cutoff_at, est_export_on, est_arrival_on, exported_at, arrived_at, closed_at, awb, forwarder, ' +
  'freight_cents, duty_cents, fx_inr_per_usd, notes, created_at, updated_at';

export async function listCycles(client: IwcClient, limit = 20) {
  return unwrap(await client.from('cycles').select(CYCLE_COLUMNS).order('cutoff_at', { ascending: false }).limit(limit));
}

export async function getOpenCycle(client: IwcClient) {
  return unwrap(await client.from('cycles').select(CYCLE_COLUMNS).eq('status', 'open').maybeSingle());
}

/** Dates are always entered by an admin (D-026). The DB allows only one open cycle (INV-5). */
export async function createCycle(client: IwcClient, input: Insert<'cycles'>) {
  return unwrap(await client.from('cycles').insert(input).select('id').single());
}

export async function updateCycle(client: IwcClient, id: string, patch: Update<'cycles'>) {
  unwrap(await client.from('cycles').update(patch).eq('id', id));
}

/** flows.md §4.1: closes the cycle and creates one pickup per ordered piece. Returns the pickup count. */
export async function cutoffCycle(client: IwcClient, cycleId: string): Promise<number> {
  const count = unwrap(await client.rpc('cutoff_cycle', { p_cycle: cycleId }));
  if (count === null) throw new DbError('cutoff_cycle_empty', 'cutoff_cycle returned no count');
  return count;
}

// ---------------------------------------------------------------- pickups + payouts (flows.md §4, §5)

export async function listPickups(client: IwcClient, cycleId: string) {
  return unwrap(
    await client
      .from('pickups')
      .select(
        'id, status, quantity, shop_price_paise, picked_at, photo_path, note, payout_id, ' +
          'vendor:vendors(id, shop_name, phone, whatsapp, town), ' +
          'variant:product_variants(id, label, sku), ' +
          'item:order_items(id, product_name, variant_label, order_id)',
      )
      .eq('cycle_id', cycleId)
      .order('vendor_id'),
  );
}

export async function markPickup(
  client: IwcClient,
  pickupId: string,
  status: Exclude<Enum<'pickup_status'>, 'pending'>,
  options: { photoPath?: string; note?: string } = {},
) {
  unwrap(
    await client.rpc('mark_pickup', {
      p_pickup: pickupId,
      p_status: status,
      ...(options.photoPath ? { p_photo_path: options.photoPath } : {}),
      ...(options.note ? { p_note: options.note } : {}),
    }),
  );
}

/** Picked pieces of a vendor not yet covered by a payout. */
export async function listPayablePickups(client: IwcClient, vendorId: string) {
  return unwrap(
    await client
      .from('pickups')
      .select('id, cycle_id, quantity, shop_price_paise, picked_at, item:order_items(product_name, variant_label)')
      .eq('vendor_id', vendorId)
      .eq('status', 'picked')
      .is('payout_id', null)
      .order('picked_at'),
  );
}

/** The amount is computed in SQL from the pickups (never typed in). Returns the payout id. */
export async function recordPayout(
  client: IwcClient,
  input: { vendorId: string; pickupIds: string[]; method: string; reference?: string; receiptPath?: string; note?: string },
): Promise<string> {
  const payoutId = unwrap(
    await client.rpc('record_payout', {
      p_vendor: input.vendorId,
      p_pickups: input.pickupIds,
      p_method: input.method,
      ...(input.reference ? { p_reference: input.reference } : {}),
      ...(input.receiptPath ? { p_receipt_path: input.receiptPath } : {}),
      ...(input.note ? { p_note: input.note } : {}),
    }),
  );
  if (payoutId === null) throw new DbError('record_payout_empty', 'record_payout returned no id');
  return payoutId;
}

export async function listPayouts(client: IwcClient, vendorId: string) {
  return unwrap(
    await client
      .from('vendor_payouts')
      .select('id, cycle_id, amount_paise, method, reference, paid_at, receipt_path, note')
      .eq('vendor_id', vendorId)
      .order('paid_at', { ascending: false }),
  );
}

// ---------------------------------------------------------------- orders

export interface AdminOrderFilter {
  status?: Enum<'order_status'>;
  cycleId?: string;
  limit?: number;
}

export async function listAdminOrders(client: IwcClient, filter: AdminOrderFilter = {}) {
  let query = client
    .from('orders')
    .select(
      'id, order_number, email, status, payment_status, cycle_id, est_delivery_from, est_delivery_to, total_cents, ' +
        'tracking_number, carrier, created_at, items:order_items(id, status)',
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
        '*, items:order_items(*, pickup:pickups(id, status, vendor_id, picked_at, payout_id)), ' +
          'events:order_events(id, kind, visible_to_customer, message, internal_note, actor, created_at)',
      )
      .eq('id', id)
      .maybeSingle(),
  );
}

export async function addOrderEvent(
  client: IwcClient,
  input: { orderId: string; kind: string; visibleToCustomer: boolean; message?: string; internalNote?: string },
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
export async function markOrderShipped(client: IwcClient, orderId: string, carrier: string, trackingNumber: string) {
  unwrap(
    await client.from('orders').update({ status: 'shipped', carrier, tracking_number: trackingNumber }).eq('id', orderId),
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

/** All values start NULL until the founder sets them (Q-15). Never default them in code. */
export async function getPricingSettings(client: IwcClient) {
  return unwrap(
    await client
      .from('pricing_settings')
      .select(
        'fx_inr_per_usd, freight_cents_per_kg, duty_pct, margin_pct, domestic_days_min, domestic_days_max, ' +
          'stale_listing_days, updated_at',
      )
      .eq('id', 1)
      .single(),
  );
}

export async function updatePricingSettings(client: IwcClient, patch: Omit<Update<'pricing_settings'>, 'id'>) {
  unwrap(await client.from('pricing_settings').update(patch).eq('id', 1));
}
