import { unwrap, type IwcClient, type Update } from '../client';

/**
 * The admin's side of vendor accounts (D-102, D-103): the pieces vendors sent with their AI photo candidates, the
 * accounts and their sign-in codes, join requests and the house models (D-104). Admin RLS on every table.
 */

const SUBMISSION_COLUMNS = `id, status, product_type, details, variants, shop_price_paise, retake_reason, admin_note,
  created_at, submitted_at, decided_at, product_id,
  vendor:vendors(id, shop_name, status, region:regions(name, slug)),
  category:categories(id, name, slug),
  photos:vendor_submission_photos(view, storage_path, checks),
  jobs:photo_jobs(id, view, status, candidates, error, attempts, house_model_id, finished_at)`;

/** Pieces to look at: photos made first, then those still being made, then retakes asked for. */
export async function listVendorSubmissions(client: IwcClient, statuses: string[] = ['photos_ready', 'waiting', 'needs_retake']) {
  return unwrap(
    await client
      .from('vendor_submissions')
      .select(SUBMISSION_COLUMNS)
      .in('status', statuses as never)
      .order('submitted_at', { ascending: true, nullsFirst: false })
      .limit(100),
  );
}

export async function getVendorSubmission(client: IwcClient, id: string) {
  return unwrap(await client.from('vendor_submissions').select(SUBMISSION_COLUMNS).eq('id', id).maybeSingle());
}

/** Media: the photos the admin picked, already in product-media, in order; `is_ai` for the model photos. */
export async function approveSubmission(
  client: IwcClient,
  id: string,
  listing: Record<string, unknown>,
  media: { path: string; alt_text: string; is_ai: boolean }[],
): Promise<string> {
  return unwrap(
    await client.rpc('admin_approve_submission', { p_submission: id, p_listing: listing as never, p_media: media as never }),
  ) as string;
}

export async function requestRetake(client: IwcClient, id: string, reason: string, note?: string): Promise<void> {
  unwrap(await client.rpc('admin_request_retake', { p_submission: id, p_reason: reason, p_note: note }));
}

export async function declineSubmission(client: IwcClient, id: string, note?: string): Promise<void> {
  unwrap(await client.rpc('admin_decline_submission', { p_submission: id, p_note: note }));
}

export async function rerunPhotoJob(client: IwcClient, jobId: string, houseModelId?: string): Promise<void> {
  unwrap(await client.rpc('admin_rerun_photo_job', { p_job: jobId, p_house_model: houseModelId }));
}

// ---------------------------------------------------------------- accounts, codes, join requests

export async function listVendorAccounts(client: IwcClient) {
  return unwrap(
    await client
      .from('vendor_accounts')
      .select('user_id, vendor_id, language, is_active, created_at, last_seen_at')
      .order('created_at', { ascending: false }),
  );
}

export async function setVendorAccountActive(client: IwcClient, userId: string, active: boolean): Promise<void> {
  unwrap(await client.from('vendor_accounts').update({ is_active: active }).eq('user_id', userId));
}

export async function setVendorAccountLanguage(client: IwcClient, userId: string, language: string): Promise<void> {
  unwrap(await client.from('vendor_accounts').update({ language }).eq('user_id', userId));
}

/** A new one-time sign-in code (shown once as a QR and a link); older unused codes stop working. */
export async function newVendorSignInCode(client: IwcClient, userId: string, days = 7): Promise<string> {
  return unwrap(await client.rpc('admin_vendor_sign_in_code', { p_user: userId, p_days: days })) as string;
}

export async function listJoinRequests(client: IwcClient) {
  return unwrap(
    await client
      .from('vendor_applications')
      .select('id, shop_name, owner_name, phone, country, city, sells, language, status, admin_note, created_at, vendor_id, region:regions(name)')
      .order('created_at', { ascending: false })
      .limit(100),
  );
}

export async function updateJoinRequest(client: IwcClient, id: string, patch: Update<'vendor_applications'>): Promise<void> {
  unwrap(await client.from('vendor_applications').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id));
}

// ---------------------------------------------------------------- house models (D-104)

export async function listHouseModels(client: IwcClient) {
  return unwrap(
    await client
      .from('house_models')
      .select('id, slug, label, wears, front_path, back_path, is_active, sort_order')
      .order('wears')
      .order('sort_order')
      .order('slug'),
  );
}

export async function saveHouseModel(
  client: IwcClient,
  model: { slug: string; label: string; wears: 'women' | 'men'; front_path: string; back_path: string; sort_order?: number },
): Promise<void> {
  unwrap(await client.from('house_models').upsert(model, { onConflict: 'slug' }));
}

export async function setHouseModelActive(client: IwcClient, id: string, active: boolean): Promise<void> {
  unwrap(await client.from('house_models').update({ is_active: active }).eq('id', id));
}
