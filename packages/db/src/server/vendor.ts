import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

/**
 * Vendor accounts' server-only steps (D-102, D-103), SERVICE-ROLE client only: the website's server makes a vendor
 * account's auth user, redeems a one-time sign-in code and saves "Join as a vendor?" requests (rate-limited by the
 * route). Never shipped to a browser or the app.
 */

/** A vendor account's sign-in address: it has no inbox (sign-in is by code), so it uses a reserved domain. */
export const vendorAccountEmail = (vendorId: string, n: number): string => `vendor-${vendorId}-${n}@vendors.iwc.invalid`;

/** Makes the auth user for a new account on `vendorId` and links it (role vendor). Returns the user id. */
export async function createVendorAccount(
  service: IwcClient,
  input: { vendorId: string; language: string; createdBy: string },
): Promise<string> {
  const { count, error: countError } = await service
    .from('vendor_accounts')
    .select('user_id', { count: 'exact', head: true })
    .eq('vendor_id', input.vendorId);
  if (countError) throw new Error(`count_vendor_accounts: ${countError.message}`);
  const email = vendorAccountEmail(input.vendorId, (count ?? 0) + 1);
  const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`create_vendor_user: ${error?.message ?? 'no user'}`);
  unwrap(
    await service.rpc('_link_vendor_account', {
      p_user: data.user.id,
      p_vendor: input.vendorId,
      p_language: input.language,
      p_by: input.createdBy,
    }),
  );
  return data.user.id;
}

/**
 * Redeems a one-time code (it works once, before it expires) and returns a token the caller turns into a session with
 * `auth.verifyOtp({ type: 'magiclink', token_hash })`. No email is sent.
 */
export async function redeemVendorCode(service: IwcClient, code: string): Promise<{ tokenHash: string }> {
  const userId = z.string().uuid().parse(unwrap(await service.rpc('_redeem_vendor_code', { p_code: code })));
  const { data: user, error: userError } = await service.auth.admin.getUserById(userId);
  if (userError || !user.user?.email) throw new Error('vendor_user_missing');
  const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email: user.user.email });
  if (error || !data.properties?.hashed_token) throw new Error(`vendor_link: ${error?.message ?? 'no token'}`);
  return { tokenHash: data.properties.hashed_token };
}

export const joinRequestSchema = z.object({
  shop_name: z.string().trim().min(1).max(120),
  owner_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,24}$/),
  country: z.enum(['IN', 'US']),
  region_id: z.string().uuid().optional(),
  city: z.string().trim().max(120).optional(),
  sells: z.string().trim().max(1000).optional(),
  language: z.string().regex(/^[a-z]{2,3}$/).optional(),
}).refine((r) => r.country !== 'IN' || r.region_id, { message: 'region_needed', path: ['region_id'] });
export type JoinRequest = z.infer<typeof joinRequestSchema>;

export async function saveJoinRequest(service: IwcClient, request: JoinRequest): Promise<void> {
  unwrap(await service.from('vendor_applications').insert(request));
}
