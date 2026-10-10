import { z } from 'zod';

import { unwrap, type Enum, type Insert, type IwcClient, type Update } from '../client';

import { filterWords, getOrderCounts } from './operations';

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
  /** D-070: express orders still in India (to pick up and send by courier). */
  expressToSend: number;
}

async function countRows(
  promise: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await promise;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getTodaySummary(client: IwcClient): Promise<TodaySummary> {
  const [counts, pendingPickups, unpaidPickedPickups, draftProducts, staleDays, stale] = await Promise.all([
    getOrderCounts(client),
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
    client.rpc('admin_stale_variants', undefined, { get: true }),
  ]);
  const ordersByStatus: TodaySummary['ordersByStatus'] = {};
  for (const status of OPEN_ORDER_STATUSES) {
    const n = counts.byStatus[status];
    if (n) ordersByStatus[status] = n;
  }
  const staleVariants = unwrap(staleDays).stale_listing_days === null ? null : unwrap(stale).length;
  return {
    ordersByStatus,
    pendingPickups,
    unpaidPickedPickups,
    draftProducts,
    staleVariants,
    expressToSend: counts.expressToSend,
  };
}

/** D-096: what waits behind each section of the admin's sidebar. Head counts only, one round trip each, in parallel. */
export interface WaitingCounts {
  ordersToShip: number;
  pickupsToDo: number;
  drafts: number;
  shopsOwed: number;
  reviews: number;
  returns: number;
  /** Vendor pieces whose AI photos are made: an admin picks and publishes (D-103). */
  vendorPieces: number;
  /** "Join as a vendor?" requests not yet answered (D-102). */
  joinRequests: number;
}

export async function getWaitingCounts(client: IwcClient): Promise<WaitingCounts> {
  const head = { count: 'exact', head: true } as const;
  const [ordersToShip, pickupsToDo, drafts, owed, reviews, returns, vendorPieces, joinRequests] = await Promise.all([
    countRows(client.from('orders').select('id', head).eq('status', 'arrived')),
    countRows(client.from('pickups').select('id', head).eq('status', 'pending')),
    countRows(client.from('products').select('id', head).eq('status', 'draft')),
    getOrderCounts(client),
    countRows(client.from('reviews').select('id', head).eq('status', 'pending')),
    countRows(client.from('returns').select('id', head).eq('status', 'requested')),
    countRows(client.from('vendor_submissions').select('id', head).eq('status', 'photos_ready')),
    countRows(client.from('vendor_applications').select('id', head).eq('status', 'new')),
  ]);
  return { ordersToShip, pickupsToDo, drafts, shopsOwed: owed.shopsOwed, reviews, returns, vendorPieces, joinRequests };
}

/**
 * Quick find (D-096, Ctrl+K): orders by number, email or the name they ship to; products by name; customers by
 * email or name; shops by name or town. Five of each, admin only (RLS). The words are stripped of PostgREST's
 * filter characters before they reach `or()`.
 */
export async function adminQuickFind(client: IwcClient, words: string) {
  const q = filterWords(words);
  if (q.length < 2) return { orders: [], products: [], customers: [], vendors: [] };
  const like = `%${q}%`;
  const [orders, products, customers, vendors] = await Promise.all([
    client
      .from('orders')
      .select('id, order_number, email, status, shipping_address, created_at')
      .or(`order_number.ilike.${like},email.ilike.${like},shipping_address->>fullName.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(5),
    client
      .from('products')
      .select('id, name, status, region:regions(name), media:product_media(storage_path, is_primary)')
      .ilike('name', like)
      .order('updated_at', { ascending: false })
      .limit(5),
    client.from('profiles').select('id, email, full_name').eq('role', 'customer').or(`email.ilike.${like},full_name.ilike.${like}`).limit(5),
    client.from('vendors').select('id, shop_name, town, region:regions(name)').or(`shop_name.ilike.${like},town.ilike.${like}`).limit(5),
  ]);
  return { orders: unwrap(orders), products: unwrap(products), customers: unwrap(customers), vendors: unwrap(vendors) };
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
  const data = unwrap(await client.rpc('admin_sales', since ? { p_since: since.toISOString() } : {}, { get: true }));
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
  const data = unwrap(await client.rpc('admin_demand', since ? { p_since: since.toISOString() } : {}, { get: true }));
  return demandSchema.parse(data);
}

const attentionSchema = z.object({ errors_24h: z.number(), payments_to_check: z.number(), emails_stuck: z.number() });
export type Attention = z.infer<typeof attentionSchema>;

/** B-8: what an admin should look at (server errors in 24 h, payments to check, stuck customer emails). Counts only. */
export async function getAttention(client: IwcClient): Promise<Attention> {
  return attentionSchema.parse(unwrap(await client.rpc('admin_attention', undefined, { get: true })));
}

/** The lines an admin reads for Attention; empty when all is well. */
export function attentionLines(a: Attention): string[] {
  return [
    a.payments_to_check > 0
      ? `${a.payments_to_check} payment(s) refunded or unmatched: check them in Stripe (failed_reconciliations)`
      : '',
    a.emails_stuck > 0 ? `${a.emails_stuck} customer email(s) stuck in the outbox: is email set up (ops.md)?` : '',
    a.errors_24h > 0 ? `${a.errors_24h} server error(s) in the last 24 hours (admin_error_events, the logs)` : '',
  ].filter(Boolean);
}
