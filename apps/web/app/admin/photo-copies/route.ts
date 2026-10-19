import { NextResponse } from 'next/server';
import { z } from 'zod';

import { listProductPhotosWithoutCopies } from '@repo/db/admin';

import { isAdminBearer } from '@/features/admin/guard';
import { copyPhotosNow } from '@/features/admin/photo-sweep';
import { tokenClient } from '@/lib/supabase/server';

const body = z.object({ productId: z.string().uuid() });

/**
 * POST /admin/photo-copies (D-140, the photo fix): the app uploads a listing's photos straight to storage, then asks
 * for their fixed copies here (sharp runs on the server, not on the phone). The app sends its admin's own token and
 * the work runs as that admin (RLS, is_admin()). Anyone else gets the same 404 as an unknown page (D-006). The old file
 * stays, so store pages cached with it keep working; a photo this misses still shows as it is, and the admin panel's
 * sweep gives it copies later.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isAdminBearer(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Which listing?' }, { status: 400 });
  const client = tokenClient(request.headers.get('authorization')!.slice(7).trim());
  const done = await copyPhotosNow(client, await listProductPhotosWithoutCopies(client, parsed.data.productId));
  return NextResponse.json({ ok: true, done });
}
