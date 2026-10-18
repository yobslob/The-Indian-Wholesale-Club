import { unwrap, unwrapPage, type Enum, type Insert, type IwcClient, type Update } from '../client';

/**
 * Auto-sourcing (D-118): the runner's settings, the shops it searches, the targets it finds listings for, the sources
 * of every sourced listing and the run log. Admin only (RLS is_admin()); none of it reaches a store_* view (D-003).
 */

export async function getSourcingSettings(client: IwcClient) {
  return unwrap(await client.from('sourcing_settings').select('*').eq('id', 1).single());
}

export async function updateSourcingSettings(
  client: IwcClient,
  patch: Omit<Update<'sourcing_settings'>, 'id' | 'updated_at'>,
) {
  unwrap(
    await client
      .from('sourcing_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1),
  );
}

export async function listSourcingShops(client: IwcClient) {
  return unwrap(await client.from('sourcing_shops').select('*').order('sort_order'));
}

export async function updateSourcingShop(
  client: IwcClient,
  site: string,
  patch: Pick<Update<'sourcing_shops'>, 'is_enabled' | 'delivery_days'>,
) {
  unwrap(await client.from('sourcing_shops').update(patch).eq('site', site));
}

const TARGET_STATUSES = ['queued', 'searching', 'found', 'none', 'paused'] as const;

/**
 * How many targets are in each state (the page's filter chips), counted in the database: fetching the rows stopped at
 * the API's 1,000-row cap with 1,000+ targets loaded (PR-3).
 */
export async function countTargets(client: IwcClient) {
  const head = { count: 'exact', head: true } as const;
  const results = await Promise.all(
    TARGET_STATUSES.map((s) => client.from('sourcing_targets').select('id', head).eq('status', s)),
  );
  const counts: Partial<Record<Enum<'sourcing_target_status'>, number>> = {};
  TARGET_STATUSES.forEach((s, i) => {
    const r = results[i]!;
    if (r.error) throw new Error(r.error.message);
    counts[s] = r.count ?? 0;
  });
  return counts;
}

/** A page of targets, best tier first, and how many match in all (D-140: no silent cap at 200). */
export async function pageTargets(
  client: IwcClient,
  filter: { status?: Enum<'sourcing_target_status'> | null; search?: string; offset?: number; limit?: number } = {},
) {
  let query = client
    .from('sourcing_targets')
    .select(
      'id, name, query, must_match, product_type, tier, status, found_count, note, searched_at, sites, min_price_paise, max_price_paise, listings, region:regions(name), category:categories(name)',
      { count: 'exact' },
    );
  if (filter.status) query = query.eq('status', filter.status);
  const words = (filter.search ?? '').replace(/[%,()*]/g, ' ').trim();
  if (words) query = query.or(`name.ilike.%${words}%,query.ilike.%${words}%`);
  const offset = filter.offset ?? 0;
  return unwrapPage(
    await query
      .order('tier', { ascending: true, nullsFirst: false })
      .order('created_at')
      .order('id')
      .range(offset, offset + (filter.limit ?? 50) - 1),
  );
}

/**
 * New targets; one already there for the same name and state (or for all states, region_id null, D-121) is left as it
 * is. Returns how many were added.
 */
export async function addTargets(
  client: IwcClient,
  rows: Insert<'sourcing_targets'>[],
): Promise<number> {
  if (!rows.length) return 0;
  const regions = [...new Set(rows.map((r) => r.region_id).filter((id): id is string => !!id))];
  const filter = [
    ...(regions.length ? [`region_id.in.(${regions.join(',')})`] : []),
    ...(rows.some((r) => !r.region_id) ? ['region_id.is.null'] : []),
  ].join(',');
  const existing = unwrap(
    await client.from('sourcing_targets').select('name, region_id').or(filter),
  );
  const key = (r: { name: string; region_id?: string | null }) =>
    `${r.region_id ?? 'all'}|${r.name.trim().toLowerCase()}`;
  const seen = new Set(existing.map(key));
  const fresh = rows.filter((r) => !seen.has(key(r)) && !!seen.add(key(r)));
  if (!fresh.length) return 0;
  unwrap(await client.from('sourcing_targets').insert(fresh));
  return fresh.length;
}

/** Every target where nothing fit, back to the queue (a run the shops blocked marks them all, 2026-10-16). */
export async function requeueNothingFit(client: IwcClient): Promise<number> {
  const rows = unwrap(
    await client
      .from('sourcing_targets')
      .update({ status: 'queued', claimed_at: null })
      .eq('status', 'none')
      .select('id'),
  );
  return rows.length;
}

export async function setTargetsStatus(
  client: IwcClient,
  ids: string[],
  status: Extract<Enum<'sourcing_target_status'>, 'queued' | 'paused'>,
) {
  unwrap(
    await client
      .from('sourcing_targets')
      .update({ status, claimed_at: null })
      .in('id', ids)
      .neq('status', 'searching'),
  );
}

export async function deleteTarget(client: IwcClient, id: string) {
  unwrap(await client.from('sourcing_targets').delete().eq('id', id));
}

/** Sources whose new price waits for an admin (the price-jump guard). */
/** A page of the prices held for an admin (a jump past the guard), oldest check first, and how many in all. */
export async function pageHeldSources(client: IwcClient, offset = 0, limit = 25) {
  return unwrapPage(
    await client
      .from('product_sources')
      .select(
        'id, site, item_url, price_paise, review, review_price_paise, checked_at, product:products(id, name), variant:product_variants!product_sources_variant_id_fkey(label)',
        { count: 'exact' },
      )
      .not('review', 'is', null)
      .order('checked_at', { ascending: true })
      .order('id')
      .range(offset, offset + limit - 1),
  );
}

export async function reviewSource(client: IwcClient, sourceId: string, accept: boolean) {
  unwrap(await client.rpc('admin_sourcing_review', { p_source: sourceId, p_accept: accept }));
}

/** A listing's sources, for its admin page and the India desk (where to order it). */
export async function listProductSources(client: IwcClient, productId: string) {
  return unwrap(
    await client
      .from('product_sources')
      .select(
        'id, variant_id, site, item_url, price_paise, mrp_paise, in_stock, delivery_days, checked_at, fail_count, last_error, review, review_price_paise',
      )
      .eq('product_id', productId)
      .order('price_paise', { ascending: true, nullsFirst: false }),
  );
}

/** Check a listing in the next run (its check date goes back). */
export async function checkSourcesSoon(client: IwcClient, productId: string) {
  unwrap(await client.from('products').update({ source_checked_at: null }).eq('id', productId));
}

export async function listSourcingRuns(client: IwcClient, limit = 8) {
  return unwrap(
    await client
      .from('sourcing_runs')
      .select('*')
      .order('finished_at', { ascending: false })
      .limit(limit),
  );
}

/**
 * Every draft the runner made, with what publishing needs to know (photos, type, details), read 1,000 at a time so
 * none is left out (it stopped at 200, D-140).
 */
export async function listSourcedDrafts(client: IwcClient) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = unwrap(
      await client
        .from('products')
        .select('id, name, product_type, attributes, created_at, media:product_media(id)')
        .eq('status', 'draft')
        .not('sourcing_target_id', 'is', null)
        .order('created_at')
        .order('id')
        .range(from, from + 999),
    );
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

export async function publishProducts(client: IwcClient, ids: string[]) {
  if (!ids.length) return;
  unwrap(
    await client
      .from('products')
      .update({ status: 'live', published_at: new Date().toISOString() })
      .in('id', ids)
      .eq('status', 'draft'),
  );
}
