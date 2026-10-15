import { unwrap, type Enum, type Insert, type IwcClient, type Update } from '../client';

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

/** How many targets are in each state (the page's filter chips). */
export async function countTargets(client: IwcClient) {
  const rows = unwrap(await client.from('sourcing_targets').select('status'));
  const counts: Partial<Record<Enum<'sourcing_target_status'>, number>> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

export async function listTargets(
  client: IwcClient,
  status: Enum<'sourcing_target_status'> | null,
  limit = 200,
) {
  let query = client
    .from('sourcing_targets')
    .select(
      'id, name, query, must_match, product_type, tier, status, found_count, note, searched_at, sites, min_price_paise, max_price_paise, listings, region:regions(name), category:categories(name)',
    )
    .order('tier', { ascending: true, nullsFirst: false })
    .order('created_at')
    .limit(limit);
  if (status) query = query.eq('status', status);
  return unwrap(await query);
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
export async function listHeldSources(client: IwcClient) {
  return unwrap(
    await client
      .from('product_sources')
      .select(
        'id, site, item_url, price_paise, review, review_price_paise, checked_at, product:products(id, name), variant:product_variants!product_sources_variant_id_fkey(label)',
      )
      .not('review', 'is', null)
      .order('checked_at', { ascending: true }),
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

/** Drafts the runner made, with what publishing needs to know (photos, type, details). */
export async function listSourcedDrafts(client: IwcClient, limit = 200) {
  return unwrap(
    await client
      .from('products')
      .select('id, name, product_type, attributes, created_at, media:product_media(id)')
      .eq('status', 'draft')
      .not('sourcing_target_id', 'is', null)
      .order('created_at')
      .limit(limit),
  );
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
