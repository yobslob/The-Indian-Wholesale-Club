import { NextResponse } from 'next/server';
import { z } from 'zod';

import { redeemVendorCode } from '@repo/db/server';

import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

const bodySchema = z.object({ code: z.string().trim().min(20).max(100) });

/**
 * Redeems a vendor's one-time sign-in code (D-102, D-103): good once, before it expires, for an active account. Returns
 * a token the browser (or the app) turns into the vendor's session. Rate-limited; a wrong code gets the same plain
 * answer as an expired one.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await limitRequest(request.headers, 'vendorSignIn');
  if (limited) return limited;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'code_not_valid' }, { status: 400 });
  try {
    const { tokenHash } = await redeemVendorCode(serviceClient(), parsed.data.code);
    return NextResponse.json({ tokenHash }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = errorMessage(error);
    if (!message.includes('code_not_valid')) logger.error('vendor.sign_in_failed', { error: message });
    return NextResponse.json({ error: 'code_not_valid' }, { status: 400 });
  }
}
