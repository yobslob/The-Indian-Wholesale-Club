import { DbError, unwrap, type Enum, type Insert, type IwcClient, type Update } from '../client';

// ---------------------------------------------------------------- cycles (flows.md §1)

const CYCLE_COLUMNS = `id, code, status, cutoff_at, est_export_on, est_arrival_on, exported_at, arrived_at, closed_at, awb, forwarder,
  freight_cents, duty_cents, fx_inr_per_usd, notes, created_at, updated_at`;

export async function listCycles(client: IwcClient, limit = 20) {
  return unwrap(
    await client
      .from('cycles')
      .select(CYCLE_COLUMNS)
      .order('cutoff_at', { ascending: false })
      .limit(limit),
  );
}

export async function getOpenCycle(client: IwcClient) {
  return unwrap(
    await client.from('cycles').select(CYCLE_COLUMNS).eq('status', 'open').maybeSingle(),
  );
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

/** flows.md §1/§6: collecting → packed → exported → arrived → fulfilling → closed, with its orders. */
export async function advanceCycle(
  client: IwcClient,
  cycleId: string,
): Promise<Enum<'cycle_status'>> {
  const status = unwrap(await client.rpc('advance_cycle', { p_cycle: cycleId }));
  if (status === null) throw new DbError('advance_cycle_empty', 'advance_cycle returned no status');
  return status;
}

// ---------------------------------------------------------------- pickups + payouts (flows.md §4, §5)

export async function listPickups(client: IwcClient, cycleId: string) {
  return unwrap(
    await client
      .from('pickups')
      .select(
        `id, status, quantity, shop_price_paise, picked_at, photo_path, note, payout_id,
          vendor:vendors(id, shop_name, phone, whatsapp, town),
          variant:product_variants(id, label, sku),
          item:order_items(id, product_name, variant_label, order_id)`,
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
      .select(
        'id, cycle_id, quantity, shop_price_paise, picked_at, item:order_items(product_name, variant_label)',
      )
      .eq('vendor_id', vendorId)
      .eq('status', 'picked')
      .is('payout_id', null)
      .order('picked_at'),
  );
}

/** The amount is computed in SQL from the pickups (never typed in). Returns the payout id. */
export async function recordPayout(
  client: IwcClient,
  input: {
    vendorId: string;
    pickupIds: string[];
    method: string;
    reference?: string;
    receiptPath?: string;
    note?: string;
  },
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

/** Every picked, unpaid piece across vendors (Payouts screen), grouped by the caller. */
export async function listAllPayablePickups(client: IwcClient) {
  return unwrap(
    await client
      .from('pickups')
      .select(
        `id, cycle_id, quantity, shop_price_paise, picked_at, vendor:vendors(id, shop_name, payment_method, payment_reference),
          item:order_items(product_name, variant_label)`,
      )
      .eq('status', 'picked')
      .is('payout_id', null)
      .order('picked_at'),
  );
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
