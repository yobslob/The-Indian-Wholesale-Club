import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { getOrderById } from '@/lib/queries/orders';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email')?.trim().toLowerCase();

    // 1. Fetch order
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

    let order = null;
    if (isUuid) {
      order = await getOrderById(supabaseAdmin, id);
    } else {
      const { data } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*), tracking_events(*)')
        .eq('order_number', id.trim())
        .maybeSingle();
      if (data) {
        order = {
          ...data,
          items: data.order_items || [],
          tracking_events: data.tracking_events || [],
        };
      }
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Auth verification: must be order owner or provide matching customer email (C2)
    const orderAddress = (order.shipping_address as Record<string, unknown>) || {};
    const orderEmail = ((orderAddress.email as string) || '').toLowerCase();

    let isAuthorized = false;

    // Check matching email param
    if (emailParam && orderEmail && emailParam === orderEmail) {
      isAuthorized = true;
    }

    // Check authenticated session
    if (!isAuthorized) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user && (user.id === order.user_id || user.email?.toLowerCase() === orderEmail)) {
          isAuthorized = true;
        }
      } catch {
        // Not authenticated
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Email verification is required to view order details' },
        { status: 401 },
      );
    }

    // 3. Customer-facing events only: status + description as admins wrote them
    //    (no rewriting, D-004). Internal fields (raw_status, location) are never
    //    returned to customers (D-003).
    const customerTrackingEvents = (order.tracking_events || []).map((event) => ({
      id: event.id,
      status: event.customer_facing_status ?? event.status,
      customer_facing_status: event.customer_facing_status ?? event.status,
      description: event.description,
      event_timestamp: event.event_timestamp,
    }));

    return NextResponse.json({
      order: {
        ...order,
        tracking_events: customerTrackingEvents,
      },
    });
  } catch (err: unknown) {
    logger.error('orders.detail.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Unable to load order details. Please try again.' },
      { status: 500 },
    );
  }
}
