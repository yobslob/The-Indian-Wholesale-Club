import 'server-only';

import { listMyAddresses } from '@repo/db/account';

import { currentUser, sessionClient } from '@/lib/supabase/server';

import type { SavedDetails } from './types';

/**
 * D-114: what checkout can fill in for a signed-in customer: their email and saved addresses (default first). Null
 * for a guest, or when the read fails (checkout then simply asks, as for a guest).
 */
export async function savedCheckoutDetails(): Promise<SavedDetails | null> {
  try {
    const client = await sessionClient();
    const user = await currentUser(client);
    if (!user) return null;
    const rows = await listMyAddresses(client);
    return {
      email: user.email,
      addresses: rows.map((r) => ({
        id: r.id,
        label: r.label,
        fullName: r.full_name,
        line1: r.line1,
        line2: r.line2,
        city: r.city,
        state: r.state,
        zipCode: r.zip_code,
        phone: r.phone,
        isDefault: r.is_default,
      })),
    };
  } catch {
    return null;
  }
}
