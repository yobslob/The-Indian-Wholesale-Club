import { unwrap, type Enum, type Insert, type IwcClient, type Update } from '../client';

// ---------------------------------------------------------------- promo codes (kept from the old admin)

export async function listPromoCodes(client: IwcClient) {
  return unwrap(
    await client
      .from('promo_codes')
      .select(
        'id, code, discount_type, discount_value, min_order_cents, max_uses, uses_count, valid_from, valid_until, is_active, created_at',
      )
      .order('created_at', { ascending: false }),
  );
}

/** Codes are stored upper-case (CHECK). */
export async function createPromoCode(client: IwcClient, input: Insert<'promo_codes'>) {
  unwrap(
    await client.from('promo_codes').insert({ ...input, code: input.code.trim().toUpperCase() }),
  );
}

export async function updatePromoCode(client: IwcClient, id: string, patch: Update<'promo_codes'>) {
  unwrap(await client.from('promo_codes').update(patch).eq('id', id));
}

// ---------------------------------------------------------------- customers

export async function listCustomers(client: IwcClient, limit = 200) {
  return unwrap(
    await client
      .from('profiles')
      .select('id, email, full_name, phone, created_at, orders(count)')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .limit(limit),
  );
}

// ---------------------------------------------------------------- Today (admin.md: what needs doing now)

const OPEN_ORDER_STATUSES: Enum<'order_status'>[] = [
  'pending_payment',
  'confirmed',
  'collecting',
  'packed',
  'in_transit',
  'arrived',
  'shipped',
];

export interface TodaySummary {
  ordersByStatus: Partial<Record<Enum<'order_status'>, number>>;
  pendingPickups: number;
  unpaidPickedPickups: number;
  draftProducts: number;
}

async function countRows(
  promise: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await promise;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getTodaySummary(client: IwcClient): Promise<TodaySummary> {
  const [orders, pendingPickups, unpaidPickedPickups, draftProducts] = await Promise.all([
    client.from('orders').select('status').in('status', OPEN_ORDER_STATUSES).limit(5000),
    countRows(
      client.from('pickups').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ),
    countRows(
      client
        .from('pickups')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'picked')
        .is('payout_id', null),
    ),
    countRows(
      client.from('products').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ),
  ]);
  const ordersByStatus: TodaySummary['ordersByStatus'] = {};
  for (const row of unwrap(orders))
    ordersByStatus[row.status] = (ordersByStatus[row.status] ?? 0) + 1;
  return { ordersByStatus, pendingPickups, unpaidPickedPickups, draftProducts };
}

// ---------------------------------------------------------------- Insights (real numbers only, no fabricated analytics)

export interface RegionSales {
  regionName: string;
  pieces: number;
  revenueCents: number;
}

/** Sales per region from paid order items (active items only). */
export async function salesByRegion(client: IwcClient): Promise<RegionSales[]> {
  const rows = unwrap(
    await client
      .from('order_items')
      .select(
        'region_name, quantity, total_price_cents, status, order:orders!inner(payment_status)',
      )
      .eq('status', 'active')
      .eq('order.payment_status', 'paid')
      .limit(10000),
  );
  const byRegion = new Map<string, RegionSales>();
  for (const row of rows) {
    const entry = byRegion.get(row.region_name) ?? {
      regionName: row.region_name,
      pieces: 0,
      revenueCents: 0,
    };
    entry.pieces += row.quantity;
    entry.revenueCents += row.total_price_cents;
    byRegion.set(row.region_name, entry);
  }
  return [...byRegion.values()].sort((a, b) => b.revenueCents - a.revenueCents);
}
