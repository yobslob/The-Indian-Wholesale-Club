import { NextResponse } from 'next/server';

import { joinRequestSchema, saveJoinRequest } from '@repo/db/server';

import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

/** Saves a "Join as a vendor?" request (D-102) for an admin to read. Rate-limited; validated with zod. */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await limitRequest(request.headers, 'vendorJoin');
  if (limited) return limited;
  const parsed = joinRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  try {
    await saveJoinRequest(serviceClient(), parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('vendor.join_failed', { error: errorMessage(error) });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
