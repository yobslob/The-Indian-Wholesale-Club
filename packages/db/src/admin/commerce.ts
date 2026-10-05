import { z } from 'zod';

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
  /** Live variants to re-check with the shop; null until the founder sets the number of days (D-047). */
  staleVariants: number | null;
}

async function countRows(
  promise: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await promise;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getTodaySummary(client: IwcClient): Promise<TodaySummary> {
  const [orders, pendingPickups, unpaidPickedPickups, draftProducts, staleDays, stale] = await Promise.all([
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
    client.from('pricing_settings').select('stale_listing_days').eq('id', 1).single(),
    client.rpc('admin_stale_variants'),
  ]);
  const ordersByStatus: TodaySummary['ordersByStatus'] = {};
  for (const row of unwrap(orders))
    ordersByStatus[row.status] = (ordersByStatus[row.status] ?? 0) + 1;
  const staleVariants = unwrap(staleDays).stale_listing_days === null ? null : unwrap(stale).length;
  return { ordersByStatus, pendingPickups, unpaidPickedPickups, draftProducts, staleVariants };
}

// ---------------------------------------------------------------- Insights (real numbers only, no fabricated analytics)

const salesLineSchema = z.object({
  name: z.string(),
  pieces: z.number(),
  revenue_cents: z.number(),
  shop_cost_paise: z.number().optional(),
});
const salesSchema = z.object({
  totals: z.object({ orders: z.number(), pieces: z.number(), revenue_cents: z.number() }),
  by_region: z.array(salesLineSchema),
  by_category: z.array(salesLineSchema),
  by_shop: z.array(salesLineSchema),
});
export type Sales = z.infer<typeof salesSchema>;

/**
 * Pieces and revenue by state, category and shop, computed in SQL (admin_sales): active lines of paid orders that
 * were not cancelled, placed since `since` (all time when null). Revenue is before tax and shipping.
 */
export async function getSales(client: IwcClient, since: Date | null): Promise<Sales> {
  const data = unwrap(await client.rpc('admin_sales', since ? { p_since: since.toISOString() } : {}));
  return salesSchema.parse(data);
}

const demandSchema = z.object({
  top_searches: z.array(z.object({ query: z.string(), count: z.number(), last_results: z.number() })),
  empty_searches: z.array(z.object({ query: z.string(), count: z.number() })),
  most_saved: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      region: z.string(),
      status: z.string(),
      saves: z.number(),
      available: z.number(),
    }),
  ),
});
export type Demand = z.infer<typeof demandSchema>;

/** What customers look for (searches, including ones that found nothing) and save, since `since` (admin_demand). */
export async function getDemand(client: IwcClient, since: Date | null): Promise<Demand> {
  const data = unwrap(await client.rpc('admin_demand', since ? { p_since: since.toISOString() } : {}));
  return demandSchema.parse(data);
}
