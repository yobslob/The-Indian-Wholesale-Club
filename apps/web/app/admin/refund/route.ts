import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminOrder, itemRefundCents, recordItemRefund } from '@repo/db/admin';

import { sendEmailsSoon } from '@/features/admin/emails-soon';
import { isAdminBearer } from '@/features/admin/guard';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';
import { errorMessage, logger } from '@/lib/logger';
import { limitRequest } from '@/lib/rate-limit';
import { stripeServer } from '@/lib/stripe';

import type { Database } from '@repo/db';

const body = z.object({ orderId: z.string().uuid(), itemId: z.string().uuid() });

/**
 * POST /admin/refund (D-140, plan A5): the app refunds a piece that turned out unavailable, as the web panel does
 * (refundItemAction): the amount from the database's rule (D-030, D-042), Stripe first, then the database, which
 * checks the amount again. The Stripe key never leaves the server; the app sends its admin's own token, and the
 * database runs as that admin (RLS, is_admin()). Anyone else gets the same 404 as an unknown page (D-006).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const limited = await limitRequest(request.headers, 'checkout');
  if (limited) return limited;
  if (!(await isAdminBearer(request))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Which piece?' }, { status: 400 });
  const { orderId, itemId } = parsed.data;
  const token = request.headers.get('authorization')!.slice(7).trim();
  const client = createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    const order = await getAdminOrder(client, orderId);
    if (!order?.payment_intent_id || !order.items.some((i) => i.id === itemId)) {
      return NextResponse.json({ error: 'This order has no card payment for that piece.' }, { status: 400 });
    }
    const amount = await itemRefundCents(client, itemId);
    const refund = await stripeServer().refunds.create(
      { payment_intent: order.payment_intent_id, amount },
      { idempotencyKey: `iwc-item-${itemId}` },
    );
    await recordItemRefund(client, itemId, amount, refund.id);
    sendEmailsSoon();
    revalidatePath(`/admin/orders/${orderId}`);
    return NextResponse.json({ ok: true, refundedCents: amount });
  } catch (error) {
    logger.error('admin.app_refund_failed', { orderId, itemId, error: errorMessage(error) });
    return NextResponse.json({ error: 'The refund did not go through. Try again or use the web panel.' }, { status: 500 });
  }
}
