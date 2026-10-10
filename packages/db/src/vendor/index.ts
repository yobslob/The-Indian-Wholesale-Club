import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

/**
 * '@repo/db/vendor': what a vendor account reads and writes (D-102, D-103), only through the vendor_* functions,
 * which filter by the caller's own vendor (INV-10). Website /vendor and the app's vendor mode.
 */

const STATUSES = ['adding', 'waiting', 'photos_ready', 'needs_retake', 'approved', 'declined'] as const;
const VIEWS = ['front', 'back', 'closeup'] as const;
const REASONS = ['blurry', 'dark', 'background', 'not_whole', 'wrong_piece', 'other'] as const;

export const vendorMeSchema = z.object({
  shop_name: z.string(),
  owner_name: z.string().nullable(),
  region: z.object({ slug: z.string(), name: z.string(), languages: z.array(z.string()) }),
  language: z.string(),
});

export const vendorPieceSchema = z.object({
  kind: z.enum(['submission', 'product']),
  id: z.string().uuid(),
  status: z.string(),
  retake_reason: z.enum(REASONS).nullable(),
  name: z.string().nullable(),
  category: z.string().nullable(),
  created_at: z.string(),
  photo_bucket: z.enum(['vendor-uploads', 'product-media']),
  photo_path: z.string().nullable(),
  pieces_left: z.number().int().nullable(),
});

export const vendorSubmissionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
  retake_reason: z.enum(REASONS).nullable(),
  product_type: z.enum(['clothing', 'spice']),
  category_id: z.string().uuid().nullable(),
  details: z.record(z.string()),
  variants: z.array(z.object({ label: z.string(), qty: z.number().int() })),
  shop_price_paise: z.number().int().nullable(),
  created_at: z.string(),
  submitted_at: z.string().nullable(),
  photos: z.record(z.enum(VIEWS), z.string()),
  product: z
    .object({ id: z.string().uuid(), name: z.string(), status: z.string(), photo_path: z.string().nullable() })
    .nullable(),
});

export const keepReadySchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  variant_label: z.string(),
  quantity: z.number().int(),
  collect_after: z.string().nullable(),
  photo_path: z.string().nullable(),
});

export const moneySchema = z.object({
  owed_paise: z.number().int(),
  unpriced_pieces: z.number().int(),
  collected: z.array(
    z.object({
      picked_at: z.string().nullable(),
      product_name: z.string(),
      variant_label: z.string(),
      quantity: z.number().int(),
      amount_paise: z.number().int().nullable(),
      paid: z.boolean(),
    }),
  ),
  payouts: z.array(
    z.object({ paid_at: z.string(), amount_paise: z.number().int(), method: z.string(), reference: z.string().nullable() }),
  ),
});

export type VendorMe = z.infer<typeof vendorMeSchema>;
export type VendorPiece = z.infer<typeof vendorPieceSchema>;
export type VendorSubmission = z.infer<typeof vendorSubmissionSchema>;
export type KeepReady = z.infer<typeof keepReadySchema>;
export type VendorMoney = z.infer<typeof moneySchema>;
export type SubmissionStatus = (typeof STATUSES)[number];
export type RetakeReason = (typeof REASONS)[number];

/** Is the signed-in user a vendor account? (role + an active account, checked by the database.) */
export async function isVendor(client: IwcClient): Promise<boolean> {
  return unwrap(await client.rpc('is_vendor', undefined, { get: true })) === true;
}

export async function vendorMe(client: IwcClient): Promise<VendorMe> {
  return vendorMeSchema.parse(unwrap(await client.rpc('vendor_me', undefined, { get: true })));
}

export async function vendorPieces(client: IwcClient, offset = 0, limit = 30) {
  const data = unwrap(await client.rpc('vendor_pieces', { p_offset: offset, p_limit: limit }, { get: true }));
  return z.object({ total: z.number().int(), items: z.array(vendorPieceSchema) }).parse(data);
}

export async function vendorSubmission(client: IwcClient, id: string): Promise<VendorSubmission | null> {
  const data = unwrap(await client.rpc('vendor_submission', { p_submission: id }, { get: true }));
  return data === null ? null : vendorSubmissionSchema.parse(data);
}

export async function vendorKeepReady(client: IwcClient): Promise<KeepReady[]> {
  return z.array(keepReadySchema).parse(unwrap(await client.rpc('vendor_keep_ready', undefined, { get: true })));
}

export async function vendorMoney(client: IwcClient): Promise<VendorMoney> {
  return moneySchema.parse(unwrap(await client.rpc('vendor_money', undefined, { get: true })));
}

export async function newSubmission(client: IwcClient, productType: 'clothing' | 'spice' = 'clothing'): Promise<string> {
  return z.string().uuid().parse(unwrap(await client.rpc('vendor_new_submission', { p_type: productType })));
}

export async function addPhoto(
  client: IwcClient,
  input: { submissionId: string; view: (typeof VIEWS)[number]; path: string; checks: Record<string, unknown> },
): Promise<void> {
  unwrap(
    await client.rpc('vendor_add_photo', {
      p_submission: input.submissionId,
      p_view: input.view,
      p_path: input.path,
      p_checks: input.checks as never,
    }),
  );
}

/** Sends the piece (vendor_submit checks it again). `details` from toSubmitDetails (@repo/shared/vendor). */
export async function submitPiece(client: IwcClient, submissionId: string, details: Record<string, unknown>): Promise<void> {
  unwrap(await client.rpc('vendor_submit', { p_submission: submissionId, p_details: details as never }));
}

export async function deleteSubmission(client: IwcClient, submissionId: string): Promise<void> {
  unwrap(await client.rpc('vendor_delete_submission', { p_submission: submissionId }));
}

const categorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  product_type: z.enum(['clothing', 'spice']),
});
export type VendorCategory = z.infer<typeof categorySchema>;

/** The clothing and spice categories a vendor picks from (customer-safe: store_categories). */
export async function vendorCategories(client: IwcClient): Promise<VendorCategory[]> {
  const rows = unwrap(
    await client.from('store_categories').select('id, slug, name, product_type').order('sort_order').order('name'),
  );
  return z.array(categorySchema).parse(rows);
}

/** The regions for "Join as a vendor?" (customer-safe: store_regions). */
export async function joinRegions(client: IwcClient): Promise<{ id: string; name: string }[]> {
  const rows = unwrap(await client.from('store_regions').select('id, name').order('name'));
  return z.array(z.object({ id: z.string().uuid(), name: z.string() })).parse(rows);
}
