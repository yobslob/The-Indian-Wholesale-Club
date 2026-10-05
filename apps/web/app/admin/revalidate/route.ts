import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { isAdminBearer } from '@/features/admin/guard';
import { STORE_TAG } from '@/features/catalog/data';
import { limitRequest } from '@/lib/rate-limit';

/**
 * POST /admin/revalidate (B-17): the app's admin writes straight to the database, so after a change customers
 * see (a listing published, a quantity confirmed, a piece picked) it asks the website to refresh its store pages now
 * instead of within the 5-minute fallback. Admins only (the same 404 as any unknown page for anyone else, D-006).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await limitRequest(request.headers, 'checkout');
  if (limited) return limited;
  if (!(await isAdminBearer(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  revalidateTag(STORE_TAG);
  return NextResponse.json({ ok: true });
}
