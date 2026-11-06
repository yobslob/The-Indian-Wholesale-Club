import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { listPickupProductIds } from '@repo/db/admin';

import { isAdminBearer } from '@/features/admin/guard';
import { refreshListings, refreshProductPages } from '@/features/admin/refresh-listings';
import { STORE_TAG } from '@/features/catalog/data';
import { limitRequest } from '@/lib/rate-limit';
import { serviceClient } from '@/lib/supabase/service';

const ids = z.array(z.string().uuid()).max(100);
const body = z.object({
  /** Listings put on or taken off the store: their pages, Home and See all. */
  listings: ids.optional(),
  /** Listings whose stock or price moved: their own pages. */
  products: ids.optional(),
  /** Pickups weighed or found unavailable: the same, by the pickup. */
  pickups: ids.optional(),
  /** The whole store, for what touches everything (the e2e tests' reset). */
  all: z.boolean().optional(),
});

/**
 * POST /admin/revalidate (B-17): the app's admin writes straight to the database, so after a change customers see it
 * names what moved and the website refreshes those pages now. D-189: an empty body refreshes nothing. It used to refresh
 * the whole store, and the app sent one after every admin action, a tracking number included, so every page was written
 * again on its next visit. Admins only (the same 404 as any unknown page for anyone else, D-006).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await limitRequest(request.headers, 'checkout');
  if (limited) return limited;
  if (!(await isAdminBearer(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Unknown pages.' }, { status: 400 });
  const { all, listings = [], products = [], pickups = [] } = parsed.data;
  if (all) {
    revalidateTag(STORE_TAG);
    return NextResponse.json({ ok: true });
  }
  const client = serviceClient();
  await refreshListings(client, listings, true);
  await refreshProductPages(client, [...products, ...(await listPickupProductIds(client, pickups))]);
  return NextResponse.json({ ok: true });
}
